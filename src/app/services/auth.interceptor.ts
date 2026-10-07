import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

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
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  // 1. Si es login/registro/recuperación, viaja sin token
  const esPublica = PUBLIC_ENDPOINTS.some((url) => req.url.includes(url));
  if (esPublica) {
    return next(req);
  }

  // 2. Obtener el token que ya guardas en el login
  const token = localStorage.getItem('token');

  // 3. Si existe un token, clonar la petición y agregar el encabezado Authorization
  const peticion = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  // 4. Si el backend dice 401 (token expirado/inválido), limpiar sesión y
  // mandar al login. Es la ÚNICA salida automática; cerrar la ventana NO
  // cierra sesión, solo el botón "Cerrar sesión" del sidebar.
  return next(peticion).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && localStorage.getItem('token')) {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        router.navigate(['/iniciodesesionadministrador']);
      }
      return throwError(() => err);
    })
  );
};
