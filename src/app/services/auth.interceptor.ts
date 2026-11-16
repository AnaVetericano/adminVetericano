import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, filter, finalize, map, of, shareReplay, switchMap, take, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';

// Endpoints públicos que NO deben llevar Authorization.
// Si enviamos un access viejo/expirado en el login, DRF lo valida primero
// y responde 401 "Given token not valid for any token type" sin revisar
// las credenciales, aunque el correo/clave sean correctos.
const PUBLIC_ENDPOINTS = [
  '/api/usuarios/login/',
  '/api/usuarios/register/',
  '/api/usuarios/registro/',
  '/api/usuarios/recuperar-password/',
  '/api/usuarios/confirmar-password/',
  '/api/token/refresh/',
];

const URL_RENOVAR_TOKEN = `${environment.backendUrl}/api/token/refresh/`;

// Renovación en curso compartida: si varias peticiones reciben 401 a la vez,
// todas esperan la misma renovación en lugar de pedir una cada una.
let renovacionEnCurso: Observable<string> | null = null;

function renovarToken(next: HttpHandlerFn, authService: AuthService): Observable<string> {
  if (renovacionEnCurso) {
    return renovacionEnCurso;
  }

  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) {
    return throwError(() => new Error('No hay token de renovación.'));
  }

  // Se envía con next() para que no pase de nuevo por este interceptor
  // y viaje sin Authorization.
  renovacionEnCurso = next(new HttpRequest('POST', URL_RENOVAR_TOKEN, { refresh })).pipe(
    filter((evento): evento is HttpResponse<any> => evento instanceof HttpResponse),
    take(1),
    map((res) => {
      const access = res.body?.access;
      if (!access) {
        throw new Error('El servidor no devolvió un token nuevo.');
      }
      authService.guardarTokensRenovados(access, res.body?.refresh);
      return access as string;
    }),
    finalize(() => {
      renovacionEnCurso = null;
    }),
    shareReplay(1)
  );

  return renovacionEnCurso;
}

function conToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  // 1. Si es login/registro/recuperación o servicio externo como Cloudinary, viaja sin token
  const esExterna = req.url.includes('cloudinary.com') || req.url.includes('api.cloudinary.com');
  const esPublica = PUBLIC_ENDPOINTS.some((url) => req.url.includes(url));
  if (esExterna || esPublica) {
    return next(req);
  }

  // 2. Obtener el token que ya guardas en el login
  const tokenUsado = localStorage.getItem('token');

  // Cierre completo: token, refresh y user_session (para no dejar un rol viejo guardado)
  const cerrarSesion = <T>(err: unknown): Observable<T> => {
    if (localStorage.getItem('token') || localStorage.getItem('refresh_token')) {
      authService.logout();
      router.navigate(['/iniciodesesionadministrador']);
    }
    return throwError(() => err);
  };

  // 3. Si el backend dice 401 (token vencido), renovar con el refresh_token
  // y repetir la petición una sola vez. Si el refresh también es rechazado
  // (vencido o usuario desactivado), cerrar sesión. Si falla por red o por
  // un error del servidor, no se cierra sesión: solo se devuelve el error.
  // Cerrar la ventana NO cierra sesión; el refresh dura 30 días.
  return next(conToken(req, tokenUsado)).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || !tokenUsado) {
        return throwError(() => err);
      }

      // Otra petición ya renovó el token mientras esta viajaba: solo repetir
      const tokenActual = localStorage.getItem('token');
      const token$: Observable<string> = tokenActual && tokenActual !== tokenUsado
        ? of(tokenActual)
        : renovarToken(next, authService).pipe(
            catchError((errRenovacion) => {
              const rechazado =
                !(errRenovacion instanceof HttpErrorResponse) ||
                errRenovacion.status === 400 ||
                errRenovacion.status === 401;
              return rechazado ? cerrarSesion<string>(err) : throwError(() => err);
            })
          );

      return token$.pipe(
        switchMap((nuevoToken) =>
          next(conToken(req, nuevoToken)).pipe(
            catchError((errRepetida: HttpErrorResponse) =>
              errRepetida.status === 401 ? cerrarSesion<HttpEvent<unknown>>(errRepetida) : throwError(() => errRepetida)
            )
          )
        )
      );
    })
  );
};
