import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth';
import { roleGuard } from './auth.guard';
import { iniciarSincronizacionSesion } from './sesion-sync';
import { environment } from '../../environments/environment';

const URL_REFRESH = `${environment.backendUrl}/api/token/refresh/`;

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.firma`;
}

function guardarSesion(token: string | null, refresh: string | null, sesion?: object): void {
  localStorage.clear();
  if (token) localStorage.setItem('token', token);
  if (refresh) localStorage.setItem('refresh_token', refresh);
  if (sesion) localStorage.setItem('user_session', JSON.stringify(sesion));
}

let router: { navigate: ReturnType<typeof vi.fn> };

function configurar(): void {
  router = { navigate: vi.fn().mockResolvedValue(true) };
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: Router, useValue: router }
    ]
  });
}

function iniciar(): void {
  TestBed.runInInjectionContext(() => iniciarSincronizacionSesion());
}

function cambioEnOtraPestana(key: string | null): void {
  window.dispatchEvent(new StorageEvent('storage', { key }));
}

const tokenAdmin = jwt({ user_id: 7, id_rol: 1, nombre_rol: 'Administrador' });
const sesionAdmin = { id_usuario: 7, email: 'a@b.co', id_rol: 1, rol: 'Administrador' };

describe('Sincronización de sesión', () => {
  let backend: HttpTestingController;

  afterEach(() => {
    backend?.verify();
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  describe('renovación al abrir y al volver a la pestaña', () => {
    it('al abrir renueva el token y muestra el rol actual del servidor', () => {
      guardarSesion(tokenAdmin, 'refresh-1', sesionAdmin);
      configurar();
      backend = TestBed.inject(HttpTestingController);
      const auth = TestBed.inject(AuthService);
      expect(auth.userRole()).toBe('Administrador');

      iniciar();
      const refresh = backend.expectOne(URL_REFRESH);
      expect(refresh.request.body).toEqual({ refresh: 'refresh-1' });
      refresh.flush({ access: jwt({ user_id: 7, id_rol: 3 }), refresh: 'refresh-2' });

      expect(auth.userRole()).toBe('Veterinario');
      expect(localStorage.getItem('refresh_token')).toBe('refresh-2');
    });

    it('sin sesión guardada no pide nada al abrir', () => {
      guardarSesion(null, null);
      configurar();
      backend = TestBed.inject(HttpTestingController);
      iniciar();
      backend.expectNone(URL_REFRESH);
    });

    it('si el servidor rechaza el refresh al abrir, cierra la sesión', () => {
      guardarSesion(tokenAdmin, 'refresh-1', sesionAdmin);
      configurar();
      backend = TestBed.inject(HttpTestingController);
      iniciar();
      backend.expectOne(URL_REFRESH).flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user_session')).toBeNull();
      expect(TestBed.inject(AuthService).currentUser()).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/iniciodesesionadministrador']);
    });

    it('si falla por red al abrir, NO cierra la sesión', () => {
      guardarSesion(tokenAdmin, 'refresh-1', sesionAdmin);
      configurar();
      backend = TestBed.inject(HttpTestingController);
      iniciar();
      backend.expectOne(URL_REFRESH).error(new ProgressEvent('error'));

      expect(localStorage.getItem('token')).toBe(tokenAdmin);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('al volver a la pestaña renueva solo si pasaron 5 minutos', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        guardarSesion(tokenAdmin, 'refresh-1', sesionAdmin);
        configurar();
        backend = TestBed.inject(HttpTestingController);
        iniciar();
        backend.expectOne(URL_REFRESH).flush({ access: tokenAdmin, refresh: 'refresh-2' });

        document.dispatchEvent(new Event('visibilitychange'));
        backend.expectNone(URL_REFRESH);

        vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1);
        document.dispatchEvent(new Event('visibilitychange'));
        backend.expectOne(URL_REFRESH).flush({ access: tokenAdmin });
      } finally {
        vi.useRealTimers();
      }
    });

    it('si mientras se renueva se inicia sesión con otra cuenta, no pisa los tokens nuevos', () => {
      guardarSesion(tokenAdmin, 'refresh-1', sesionAdmin);
      configurar();
      backend = TestBed.inject(HttpTestingController);
      iniciar();

      const tokenOtraCuenta = jwt({ user_id: 9, id_rol: 2 });
      localStorage.setItem('token', tokenOtraCuenta);
      localStorage.setItem('refresh_token', 'refresh-otra');
      backend.expectOne(URL_REFRESH).flush({ access: jwt({ user_id: 7, id_rol: 1 }), refresh: 'refresh-2' });

      expect(localStorage.getItem('token')).toBe(tokenOtraCuenta);
      expect(localStorage.getItem('refresh_token')).toBe('refresh-otra');
    });

    it('si se pide otra renovación mientras la de arranque sigue en curso, se reutiliza la misma', () => {
      guardarSesion(tokenAdmin, 'refresh-1', sesionAdmin);
      configurar();
      backend = TestBed.inject(HttpTestingController);
      iniciar();

      const auth = TestBed.inject(AuthService);
      auth.renovarToken().subscribe();
      expect(backend.match(URL_REFRESH).length).toBe(1);
    });
  });

  describe('entre pestañas', () => {
    beforeEach(() => {
      guardarSesion(tokenAdmin, 'refresh-1', sesionAdmin);
      configurar();
      backend = TestBed.inject(HttpTestingController);
      iniciar();
      backend.expectOne(URL_REFRESH).flush({ access: tokenAdmin, refresh: 'refresh-1' });
      router.navigate.mockClear();
    });

    it('si en otra pestaña se cierra sesión, esta también se cierra', () => {
      localStorage.clear();
      cambioEnOtraPestana('token');

      expect(TestBed.inject(AuthService).currentUser()).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/iniciodesesionadministrador']);
    });

    it('si otra pestaña renueva el token de la misma cuenta, aquí se actualiza el rol', () => {
      const auth = TestBed.inject(AuthService);
      localStorage.setItem('token', jwt({ user_id: 7, id_rol: 2 }));
      cambioEnOtraPestana('token');

      expect(auth.userRole()).toBe('Jurídico');
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('ignora cambios de otras claves del almacenamiento', () => {
      localStorage.removeItem('token');
      cambioEnOtraPestana('preferencia_tabla');
      expect(TestBed.inject(AuthService).currentUser()).not.toBeNull();
    });
  });
});

describe('Sin roles supuestos', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('token sin rol y sin sesión guardada: no supone «Administrador», limpia y queda sin sesión', () => {
    guardarSesion(jwt({ user_id: 7 }), 'refresh-1');
    configurar();
    const auth = TestBed.inject(AuthService);

    expect(auth.currentUser()).toBeNull();
    expect(auth.userRole()).toBe('');
    expect(auth.isAdmin()).toBe(false);
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('token y sesión sin rol: tampoco supone ninguno', () => {
    guardarSesion(jwt({ user_id: 7 }), 'refresh-1', { email: 'a@b.co', rol: '' });
    configurar();
    expect(TestBed.inject(AuthService).currentUser()).toBeNull();
  });

  it('sin sesión, actualizarSesion no crea una con rol «Veterinario»', () => {
    guardarSesion(null, null);
    configurar();
    const auth = TestBed.inject(AuthService);
    auth.actualizarSesion({ nombre: 'Ana' });

    expect(auth.currentUser()).toBeNull();
    expect(localStorage.getItem('user_session')).toBeNull();
  });

  it('si el login no trae rol, no entra y muestra un mensaje claro', async () => {
    guardarSesion(null, null);
    configurar();
    const backend = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthService);

    const resultado = firstValueFrom(auth.login({ email: 'a@b.co', password: 'x' } as any));
    backend.expectOne(`${environment.apiUrl}/login/`).flush({ id_usuario: 7, tokens: { access: jwt({ user_id: 7 }), refresh: 'r' } });

    await expect(resultado).rejects.toMatchObject({ error: { detail: expect.stringContaining('rol') } });
    expect(localStorage.getItem('token')).toBeNull();
    expect(auth.currentUser()).toBeNull();
  });

  it('el login con rol guarda la sesión con su id_rol', async () => {
    guardarSesion(null, null);
    configurar();
    const backend = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthService);

    const resultado = firstValueFrom(auth.login({ email: 'a@b.co', password: 'x' } as any));
    backend.expectOne(`${environment.apiUrl}/login/`).flush({ id_usuario: 7, id_rol: 1, tokens: { access: tokenAdmin, refresh: 'r' } });
    await resultado;

    expect(auth.userRole()).toBe('Administrador');
    expect(auth.currentUser()?.id_rol).toBe(1);
  });

  it('roleGuard sin rol identificable manda al login en vez de mostrar «Acceso restringido»', () => {
    guardarSesion(null, null);
    configurar();
    localStorage.setItem('token', jwt({ user_id: 7 }));

    const ruta = { data: { roles: ['Administrador'] } } as unknown as ActivatedRouteSnapshot;
    const permitido = TestBed.runInInjectionContext(() => roleGuard(ruta, {} as any));

    expect(permitido).toBe(false);
    expect(localStorage.getItem('token')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/iniciodesesionadministrador']);
  });
});
