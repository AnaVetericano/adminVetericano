import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AlertaDuplicadoDetalle,
  AlertaDuplicadoResumen,
  ResolverAlertaDuplicadoResponse
} from '../models/duplicados.model';
import { AlertasDuplicadosService } from '../services/alertas-duplicados.service';
import { AuthService, UserRole } from '../services/auth';
import { Graficas } from './graficas';

interface RolMockEstado {
  autenticado: boolean;
  id_rol: number;
  rol: string;
}

@Component({ standalone: true, template: '<p>Bandeja peticiones mock</p>' })
class DummyPeticionRouteComponent {}

function crearJwtFalso(payload: Record<string, unknown>): string {
  const encodeBase64Url = (obj: Record<string, unknown>): string => {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = '';
    for (const b of bytes) {
      bin += String.fromCharCode(b);
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return `${encodeBase64Url({ alg: 'HS256', typ: 'JWT' })}.${encodeBase64Url(payload)}.firma-test`;
}

function crearAuthServiceMock(estadoInicial: RolMockEstado) {
  const estado = signal<RolMockEstado>(estadoInicial);

  const norm = (txt: string) =>
    (txt || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const isSuperAdmin = () => estado().autenticado && estado().id_rol === 5;
  const isAdmin = () => estado().autenticado && estado().id_rol === 1 && !isSuperAdmin();
  const isJuridico = () => estado().autenticado && estado().id_rol === 2;
  const isVeterinario = () => estado().autenticado && estado().id_rol === 3;

  const listUsersActive = vi.fn(() =>
    of([
      { id_usuario: 1, activo: true, id_rol: 1, nombre_rol: 'Administrador' },
      { id_usuario: 2, activo: true, id_rol: 2, nombre_rol: 'Jurídico' },
      { id_usuario: 3, activo: true, id_rol: 3, nombre_rol: 'Veterinario' },
      { id_usuario: 4, activo: false, id_rol: 4, nombre_rol: 'Peticionario' },
      { id_usuario: 5, activo: true, id_rol: 4, nombre_rol: 'Peticionario' }
    ])
  );

  return {
    estado,
    listUsersActive,
    isAuthenticated: () => estado().autenticado,
    currentUser: () =>
      estado().autenticado
        ? {
            id_usuario: 99,
            email: 'admin@vetericano.test',
            nombre: 'Admin',
            apellido: 'Vetericano',
            rol: estado().rol,
            id_rol: estado().id_rol
          }
        : null,
    userRole: () => estado().rol,
    isSuperAdmin,
    isAdmin,
    isJuridico,
    isVeterinario,
    hasRole: (allowedRoles: UserRole[]) => {
      const actual = norm(estado().rol);
      if (!estado().autenticado || !actual) return false;
      return allowedRoles.some((r) => {
        const target = norm(String(r));
        if (target === 'super administrador' || target === 'super_administrador') return isSuperAdmin();
        if (target === 'administrador' || target === 'admin') return isAdmin();
        if (target === 'juridico') return isJuridico();
        if (target === 'veterinario') return isVeterinario();
        return actual === target;
      });
    }
  };
}

function crearAlertaMock(idAlerta: number): AlertaDuplicadoResumen {
  return {
    id_alerta: idAlerta,
    estado_revision: 'PENDIENTE',
    peticion_menor_id: 100 + idAlerta,
    peticion_mayor_id: 200 + idAlerta,
    peticion_origen_id: 200 + idAlerta,
    peticion_principal_id: null,
    similitud_texto: 0.85,
    coincidencia_texto: true,
    distancia_metros: 20,
    coincidencia_gps: true,
    distancia_hamming: null,
    similitud_imagen: null,
    coincidencia_imagen: false,
    score_combinado: 0.85,
    criterios_coincidencia: ['texto', 'gps'],
    origen_deteccion: 'REGISTRO_PETICION',
    observacion_revision: null,
    revisado_por: null,
    fecha_revision: null,
    fecha_creacion: '2026-11-14T08:00:00Z',
    fecha_actualizacion: '2026-11-14T08:00:00Z',
    peticion_menor: null,
    peticion_mayor: null
  };
}

describe('Integración Etapa 5: Panel Administrador (Graficas) + Duplicados', () => {
  const basePeticionesUrl = environment.apiUrlPeticiones.replace(/\/+$/, '');
  let httpMock: HttpTestingController;
  let authMock: ReturnType<typeof crearAuthServiceMock>;
  let router: Router;
  let storageStore: Map<string, string>;

  function configurarToken(rolEstado: RolMockEstado): void {
    authMock.estado.set(rolEstado);
    if (!rolEstado.autenticado) {
      localStorage.removeItem('token');
      localStorage.removeItem('user_session');
      return;
    }
    const jwt = crearJwtFalso({
      id_usuario: 99,
      email: 'admin@vetericano.test',
      id_rol: rolEstado.id_rol,
      rol: rolEstado.rol
    });
    localStorage.setItem('token', jwt);
    localStorage.setItem(
      'user_session',
      JSON.stringify({ id_usuario: 99, id_rol: rolEstado.id_rol, rol: rolEstado.rol })
    );
  }

  beforeEach(() => {
    storageStore = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      get length() {
        return storageStore.size;
      },
      clear: () => storageStore.clear(),
      getItem: (key: string) => storageStore.get(key) ?? null,
      key: (index: number) => Array.from(storageStore.keys())[index] ?? null,
      removeItem: (key: string) => {
        storageStore.delete(key);
      },
      setItem: (key: string, value: string) => {
        storageStore.set(key, String(value));
      }
    } satisfies Storage);

    authMock = crearAuthServiceMock({ autenticado: true, id_rol: 1, rol: 'Administrador' });
    configurarToken({ autenticado: true, id_rol: 1, rol: 'Administrador' });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Graficas],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'inicio-admin/graficas', component: Graficas },
          { path: 'inicio-admin/peticion', component: DummyPeticionRouteComponent }
        ]),
        { provide: AuthService, useValue: authMock },
        AlertasDuplicadosService
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    try {
      httpMock?.verify();
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      TestBed.resetTestingModule();
    }
  });

  it('debe mostrar tarjeta discreta de posibles duplicados con contador reactivo y enlace manteniendo métricas y gráficas de usuarios (rol 1)', async () => {
    const spyGraficaActivos = vi.spyOn(Graficas.prototype, 'LoadGraficUsersActive');
    const spyGraficaRoles = vi.spyOn(Graficas.prototype, 'LoadGraficUsersRol');

    const fixture = TestBed.createComponent(Graficas);
    fixture.detectChanges();

    const alerta1 = crearAlertaMock(1);
    const alerta2 = crearAlertaMock(2);
    const alerta3 = crearAlertaMock(3);

    const req = httpMock.expectOne(
      (r) =>
        r.method === 'GET' &&
        r.url === `${basePeticionesUrl}/duplicados/alertas/` &&
        r.params.get('page_size') === '100'
    );
    req.flush({
      count: 3,
      page: 1,
      page_size: 100,
      total_pages: 1,
      resumen: { PENDIENTE: 3, CONFIRMADO: 1, DESCARTADO: 2, total: 6 },
      results: [alerta1, alerta2, alerta3]
    });
    fixture.detectChanges();

    // Métricas y gráficas de usuarios intactas
    expect(fixture.componentInstance.totalUsuarios).toBe(5);
    expect(fixture.componentInstance.activosPie).toBe(4);
    expect(fixture.componentInstance.inactivosPie).toBe(1);
    expect(fixture.componentInstance.totalOperativo).toBe(3);
    expect(spyGraficaActivos).toHaveBeenCalledTimes(1);
    expect(spyGraficaRoles).toHaveBeenCalledTimes(1);
    expect(fixture.debugElement.queryAll(By.css('canvas')).length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Distribución de Usuarios');
    expect(fixture.nativeElement.textContent).toContain('Roles de Usuarios Registrados');

    // Tarjeta discreta de duplicados pendientes
    const card = fixture.debugElement.query(By.css('[data-testid="graficas-duplicados-card"]'));
    const contador = fixture.debugElement.query(By.css('[data-testid="graficas-duplicados-contador"]'));
    const enlace = fixture.debugElement.query(By.css('[data-testid="graficas-duplicados-enlace"]'));

    expect(card).toBeTruthy();
    expect(card.nativeElement.textContent).toContain('Posibles duplicados pendientes');
    expect(contador.nativeElement.textContent.trim()).toBe('3');
    expect(card.nativeElement.textContent).toContain('1 confirmados');
    expect(card.nativeElement.textContent).toContain('2 descartados');
    expect(enlace).toBeTruthy();
    expect(enlace.nativeElement.getAttribute('href')).toBe('/inicio-admin/peticion?vista=duplicados');

    // Actualización reactiva cuando cambia el estado en AlertasDuplicadosService
    const service = TestBed.inject(AlertasDuplicadosService);
    const detalleResuelto: AlertaDuplicadoDetalle = {
      ...alerta1,
      estado_revision: 'CONFIRMADO',
      peticion_principal_id: alerta1.peticion_menor_id,
      peticion_menor: null,
      peticion_mayor: null,
      comparacion: {
        peticion_menor_id: alerta1.peticion_menor_id,
        peticion_mayor_id: alerta1.peticion_mayor_id,
        mismo_tipo: true,
        mismo_estado: true,
        ambas_asignadas: false,
        mismo_veterinario_asignado: false,
        diferencia_tiempo_horas: 0,
        metricas: {
          similitud_texto: 0.85,
          coincidencia_texto: true,
          distancia_metros: 20,
          coincidencia_gps: true,
          distancia_hamming: null,
          similitud_imagen: null,
          coincidencia_imagen: false,
          score_combinado: 0.85,
          criterios_coincidencia: ['texto', 'gps']
        }
      }
    };
    const respResolver: ResolverAlertaDuplicadoResponse = {
      mensaje: 'Confirmada.',
      cambiada: true,
      estado_anterior: 'PENDIENTE',
      estado_nuevo: 'CONFIRMADO',
      alerta: detalleResuelto
    };
    service.resolverAlerta(1, { estado_revision: 'CONFIRMADO', peticion_principal: alerta1.peticion_menor_id }).subscribe();
    httpMock
      .expectOne((r) => r.method === 'POST' && r.url === `${basePeticionesUrl}/duplicados/alertas/1/resolver/`)
      .flush(respResolver);
    fixture.detectChanges();

    expect(contador.nativeElement.textContent.trim()).toBe('2');

    // Navegación desde el enlace hacia la bandeja
    enlace.nativeElement.click();
    await fixture.whenStable();
    expect(router.url).toBe('/inicio-admin/peticion?vista=duplicados');
  });

  it('debe conservar gráficas de usuarios ante error en duplicados y mostrar estado sin pendientes al reintentar', () => {
    const spyGraficaActivos = vi.spyOn(Graficas.prototype, 'LoadGraficUsersActive');
    const spyGraficaRoles = vi.spyOn(Graficas.prototype, 'LoadGraficUsersRol');

    const fixture = TestBed.createComponent(Graficas);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.method === 'GET' && r.url === `${basePeticionesUrl}/duplicados/alertas/`)
      .flush({ detail: 'Servicio de alertas temporalmente no disponible' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    // Gráficas de usuarios operativas sin impacto
    expect(spyGraficaActivos).toHaveBeenCalledTimes(1);
    expect(spyGraficaRoles).toHaveBeenCalledTimes(1);
    expect(fixture.debugElement.queryAll(By.css('canvas')).length).toBe(2);
    expect(fixture.componentInstance.totalUsuarios).toBe(5);

    const card = fixture.debugElement.query(By.css('[data-testid="graficas-duplicados-card"]'));
    expect(card.nativeElement.textContent).toContain('Servicio de alertas temporalmente no disponible');
    const btnReintentar = card.query(By.css('button'));
    expect(btnReintentar).toBeTruthy();

    btnReintentar.nativeElement.click();
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.method === 'GET' && r.url === `${basePeticionesUrl}/duplicados/alertas/`)
      .flush({
        count: 0,
        page: 1,
        page_size: 100,
        total_pages: 1,
        resumen: { PENDIENTE: 0, CONFIRMADO: 0, DESCARTADO: 0, total: 0 },
        results: []
      });
    fixture.detectChanges();

    expect(card.nativeElement.textContent).toContain('Sin alertas pendientes por revisar');
    expect(fixture.debugElement.query(By.css('[data-testid="graficas-duplicados-contador"]')).nativeElement.textContent.trim()).toBe('0');
  });

  it('debe ocultar tarjeta y omitir llamadas de duplicados para roles 3 y 5, y reutilizar índice cacheado', () => {
    // 1. Veterinario (rol 3)
    configurarToken({ autenticado: true, id_rol: 3, rol: 'Veterinario' });
    const fixtureVet = TestBed.createComponent(Graficas);
    fixtureVet.detectChanges();
    expect(fixtureVet.debugElement.query(By.css('[data-testid="graficas-duplicados-card"]'))).toBeNull();
    httpMock.expectNone((r) => r.url.toLowerCase().includes('duplicad'));
    fixtureVet.destroy();

    // 2. Super Administrador (rol 5)
    configurarToken({ autenticado: true, id_rol: 5, rol: 'Super Administrador' });
    const fixtureSuper = TestBed.createComponent(Graficas);
    fixtureSuper.detectChanges();
    expect(fixtureSuper.debugElement.query(By.css('[data-testid="graficas-duplicados-card"]'))).toBeNull();
    httpMock.expectNone((r) => r.url.toLowerCase().includes('duplicad'));
    fixtureSuper.destroy();

    // 3. Administrador con caché ya cargada en AlertasDuplicadosService -> 0 llamadas extra
    configurarToken({ autenticado: true, id_rol: 1, rol: 'Administrador' });
    const service = TestBed.inject(AlertasDuplicadosService);
    service.cargarIndiceAlertas({ page_size: 100 }, false).subscribe();
    httpMock
      .expectOne((r) => r.method === 'GET' && r.url === `${basePeticionesUrl}/duplicados/alertas/`)
      .flush({
        count: 1,
        page: 1,
        page_size: 100,
        total_pages: 1,
        resumen: { PENDIENTE: 1, CONFIRMADO: 0, DESCARTADO: 0, total: 1 },
        results: [crearAlertaMock(55)]
      });

    const fixtureCache = TestBed.createComponent(Graficas);
    fixtureCache.detectChanges();
    httpMock.expectNone((r) => r.url.toLowerCase().includes('duplicad'));
    expect(fixtureCache.debugElement.query(By.css('[data-testid="graficas-duplicados-contador"]')).nativeElement.textContent.trim()).toBe('1');
  });
});
