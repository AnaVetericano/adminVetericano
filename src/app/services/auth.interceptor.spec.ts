import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth';
import { environment } from '../../environments/environment';

const URL_REFRESH = `${environment.backendUrl}/api/token/refresh/`;
const URL_DATOS = `${environment.backendUrl}/api/peticiones/`;

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.firma`;
}

describe('authInterceptor · renovación de token', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let router: { navigate: ReturnType<typeof vi.fn> };

  const tokenViejo = jwt({ user_id: 7, id_rol: 1, nombre_rol: 'Administrador' });

  function configurar(): void {
    router = { navigate: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router }
      ]
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', tokenViejo);
    localStorage.setItem('refresh_token', 'refresh-1');
    localStorage.setItem('user_session', JSON.stringify({ id_usuario: 7, email: 'a@b.co', id_rol: 1, rol: 'Administrador' }));
    configurar();
  });

  afterEach(() => {
    backend.verify();
    localStorage.clear();
  });

  it('ante 401 renueva el token, repite la petición y actualiza el rol con el del token nuevo', () => {
    const auth = TestBed.inject(AuthService);
    expect(auth.userRole()).toBe('Administrador');

    let respuesta: unknown;
    http.get(URL_DATOS).subscribe((r) => (respuesta = r));

    const primera = backend.expectOne(URL_DATOS);
    expect(primera.request.headers.get('Authorization')).toBe(`Bearer ${tokenViejo}`);
    primera.flush({ detail: 'expirado' }, { status: 401, statusText: 'Unauthorized' });

    const refresh = backend.expectOne(URL_REFRESH);
    expect(refresh.request.method).toBe('POST');
    expect(refresh.request.body).toEqual({ refresh: 'refresh-1' });
    expect(refresh.request.headers.has('Authorization')).toBe(false);

    const tokenNuevo = jwt({ user_id: 7, id_rol: 3, nombre_rol: 'Veterinario' });
    refresh.flush({ access: tokenNuevo, refresh: 'refresh-2' });

    const repetida = backend.expectOne(URL_DATOS);
    expect(repetida.request.headers.get('Authorization')).toBe(`Bearer ${tokenNuevo}`);
    repetida.flush({ ok: true });

    expect(respuesta).toEqual({ ok: true });
    expect(localStorage.getItem('token')).toBe(tokenNuevo);
    expect(localStorage.getItem('refresh_token')).toBe('refresh-2');
    expect(auth.userRole()).toBe('Veterinario');
    expect(auth.isAdmin()).toBe(false);
    expect(JSON.parse(localStorage.getItem('user_session')!).id_rol).toBe(3);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('varias peticiones con 401 a la vez comparten una sola renovación', () => {
    const resultados: unknown[] = [];
    http.get(`${URL_DATOS}?a=1`).subscribe((r) => resultados.push(r));
    http.get(`${URL_DATOS}?b=2`).subscribe((r) => resultados.push(r));

    backend.expectOne(`${URL_DATOS}?a=1`).flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${URL_DATOS}?b=2`).flush({}, { status: 401, statusText: 'Unauthorized' });

    const tokenNuevo = jwt({ user_id: 7, id_rol: 1 });
    backend.expectOne(URL_REFRESH).flush({ access: tokenNuevo, refresh: 'refresh-2' });

    backend.expectOne(`${URL_DATOS}?a=1`).flush('a');
    backend.expectOne(`${URL_DATOS}?b=2`).flush('b');
    expect(resultados.sort()).toEqual(['a', 'b']);
  });

  it('si el refresh es rechazado, cierra la sesión por completo (incluido user_session)', () => {
    let error: any;
    http.get(URL_DATOS).subscribe({ error: (e) => (error = e) });

    backend.expectOne(URL_DATOS).flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(URL_REFRESH).flush({ detail: 'Token is invalid or expired' }, { status: 401, statusText: 'Unauthorized' });

    expect(error.status).toBe(401);
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(localStorage.getItem('user_session')).toBeNull();
    expect(TestBed.inject(AuthService).currentUser()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/iniciodesesionadministrador']);
  });

  it('sin refresh_token guardado, cierra la sesión sin intentar renovar', () => {
    localStorage.removeItem('refresh_token');
    http.get(URL_DATOS).subscribe({ error: () => {} });

    backend.expectOne(URL_DATOS).flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectNone(URL_REFRESH);

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user_session')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/iniciodesesionadministrador']);
  });

  it('si la renovación falla por red o error del servidor, NO cierra la sesión', () => {
    let error: any;
    http.get(URL_DATOS).subscribe({ error: (e) => (error = e) });

    backend.expectOne(URL_DATOS).flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(URL_REFRESH).flush({}, { status: 503, statusText: 'Service Unavailable' });

    expect(error.status).toBe(401);
    expect(localStorage.getItem('token')).toBe(tokenViejo);
    expect(localStorage.getItem('refresh_token')).toBe('refresh-1');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('si la petición repetida vuelve a dar 401, cierra sesión y no renueva otra vez', () => {
    http.get(URL_DATOS).subscribe({ error: () => {} });

    backend.expectOne(URL_DATOS).flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(URL_REFRESH).flush({ access: jwt({ user_id: 7, id_rol: 1 }) });
    backend.expectOne(URL_DATOS).flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectNone(URL_REFRESH);

    expect(localStorage.getItem('token')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/iniciodesesionadministrador']);
  });

  it('otros errores (403, 500) no tocan la sesión', () => {
    http.get(URL_DATOS).subscribe({ error: () => {} });
    backend.expectOne(URL_DATOS).flush({}, { status: 403, statusText: 'Forbidden' });
    backend.expectNone(URL_REFRESH);
    expect(localStorage.getItem('token')).toBe(tokenViejo);
  });

  it('el login viaja sin Authorization', () => {
    http.post(`${environment.apiUrl}/login/`, {}).subscribe();
    const login = backend.expectOne(`${environment.apiUrl}/login/`);
    expect(login.request.headers.has('Authorization')).toBe(false);
    login.flush({});
  });
});
