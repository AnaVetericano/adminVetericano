import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { environment } from '../../environments/environment';
import { Peticion } from '../peticion/peticion';
import { AlertaDuplicadoComparacionComponent } from '../peticion/alerta-duplicado-comparacion/alerta-duplicado-comparacion';
import {
  AlertaDuplicadoDetalle,
  AlertaDuplicadoResumen,
  ListadoAlertasDuplicadosResponse,
  ResolverAlertaDuplicadoResponse
} from '../models/duplicados.model';
import { AlertasDuplicadosService } from '../services/alertas-duplicados.service';
import { AuthService, UserRole } from '../services/auth';
import {
  DashboardJuridicoService,
  ResumenDashboardJuridico
} from '../services/dashboard-juridico.service';
import { DashboardJuridicoComponent } from './dashboard-juridico';

interface RolMockEstado {
  autenticado: boolean;
  id_rol: number;
  rol: string;
}

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

  return {
    estado,
    isAuthenticated: () => estado().autenticado,
    currentUser: () =>
      estado().autenticado
        ? {
            id_usuario: 99,
            email: 'juridico@vetericano.test',
            nombre: 'Jurídico',
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

function crearResumenDashboardMock(): ResumenDashboardJuridico {
  return {
    peticiones: {
      total: 12,
      pendientes: 4,
      enProceso: 5,
      finalizadas: 3,
      urgentes: 2,
      distribucionEstados: { Pendiente: 4, 'En proceso': 5, Finalizada: 3 }
    },
    casosVeterinarios: [
      {
        id_veterinario: 7,
        nombre_completo: 'Dra. Laura Gómez',
        total_asignados: 8,
        pendientes: 2,
        en_proceso: 3,
        finalizadas: 3,
        porcentaje_completado: 38
      }
    ],
    cba: {
      totalIngresadosCBA: 8,
      enObservacion: 3,
      enTratamiento: 2,
      aptosAdopcion: 3,
      adoptadosOtras: 0,
      distribucionEstados: { 'En Observación': 3, 'En Tratamiento': 2, 'Apto Adopción': 3 },
      ultimosIngresos: []
    }
  };
}

function crearAlertaMock(overrides: Partial<AlertaDuplicadoResumen> = {}): AlertaDuplicadoResumen {
  const menorId = overrides.peticion_menor_id ?? 101;
  const mayorId = overrides.peticion_mayor_id ?? 205;

  return {
    id_alerta: 10,
    estado_revision: 'PENDIENTE',
    peticion_menor_id: menorId,
    peticion_mayor_id: mayorId,
    peticion_origen_id: mayorId,
    peticion_principal_id: null,
    similitud_texto: 0.87,
    coincidencia_texto: true,
    distancia_metros: 30,
    coincidencia_gps: true,
    distancia_hamming: 2,
    similitud_imagen: 0.94,
    coincidencia_imagen: true,
    score_combinado: 0.9,
    criterios_coincidencia: ['texto', 'gps', 'imagen'],
    origen_deteccion: 'REGISTRO_PETICION',
    observacion_revision: null,
    revisado_por: null,
    fecha_revision: null,
    fecha_creacion: '2026-11-14T08:00:00Z',
    fecha_actualizacion: '2026-11-14T08:00:00Z',
    peticion_menor: {
      id_peticion: menorId,
      numero_radicado: `RAD-PET-${menorId}`,
      codigo: `RAD-PET-${menorId}`,
      tipo: { id_tipo: 2, nombre: 'Maltrato animal' },
      estado: { id_estado: 1, nombre: 'Pendiente' },
      ubicacion: { id_ubicacion: menorId, direccion: 'Calle 10 # 5-20', latitud: 4.6, longitud: -74.08 },
      descripcion: 'Reporte original de maltrato.',
      prioridad: 'Alta',
      fecha: '2026-11-14T07:00:00Z',
      foto: null,
      fotos: [],
      total_fotos: 0,
      asignacion: { asignada: false, asignado_a: null, asignado_por: null, fecha_asignacion: null }
    },
    peticion_mayor: {
      id_peticion: mayorId,
      numero_radicado: `RAD-PET-${mayorId}`,
      codigo: `RAD-PET-${mayorId}`,
      tipo: { id_tipo: 2, nombre: 'Maltrato animal' },
      estado: { id_estado: 1, nombre: 'Pendiente' },
      ubicacion: { id_ubicacion: mayorId, direccion: 'Calle 10 # 5-24', latitud: 4.6001, longitud: -74.0801 },
      descripcion: 'Segundo reporte coincidente.',
      prioridad: 'Alta',
      fecha: '2026-11-14T08:00:00Z',
      foto: null,
      fotos: [],
      total_fotos: 0,
      asignacion: { asignada: false, asignado_a: null, asignado_por: null, fecha_asignacion: null }
    },
    ...overrides
  };
}

function crearDetalleMock(alerta: AlertaDuplicadoResumen): AlertaDuplicadoDetalle {
  return {
    ...alerta,
    peticion_menor: alerta.peticion_menor
      ? { ...alerta.peticion_menor, evidencias: [], es_peticion_origen: false, es_peticion_principal: false }
      : null,
    peticion_mayor: alerta.peticion_mayor
      ? { ...alerta.peticion_mayor, evidencias: [], es_peticion_origen: true, es_peticion_principal: false }
      : null,
    comparacion: {
      peticion_menor_id: alerta.peticion_menor_id,
      peticion_mayor_id: alerta.peticion_mayor_id,
      mismo_tipo: true,
      mismo_estado: true,
      ambas_asignadas: false,
      mismo_veterinario_asignado: false,
      diferencia_tiempo_horas: 1,
      metricas: {
        similitud_texto: alerta.similitud_texto,
        coincidencia_texto: alerta.coincidencia_texto,
        distancia_metros: alerta.distancia_metros,
        coincidencia_gps: alerta.coincidencia_gps,
        distancia_hamming: alerta.distancia_hamming,
        similitud_imagen: alerta.similitud_imagen,
        coincidencia_imagen: alerta.coincidencia_imagen,
        score_combinado: alerta.score_combinado,
        criterios_coincidencia: alerta.criterios_coincidencia
      }
    }
  };
}

describe('Integración Etapa 5: Dashboard Jurídico + Alertas de Duplicados', () => {
  const basePeticionesUrl = environment.apiUrlPeticiones.replace(/\/+$/, '');
  let httpMock: HttpTestingController;
  let authMock: ReturnType<typeof crearAuthServiceMock>;
  let dashboardServiceMock: { obtenerDatosDashboard: ReturnType<typeof vi.fn> };
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
      email: 'juridico@vetericano.test',
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

    vi.spyOn(Swal, 'fire').mockResolvedValue({
      isConfirmed: true,
      isDenied: false,
      isDismissed: false
    } as any);

    authMock = crearAuthServiceMock({ autenticado: true, id_rol: 2, rol: 'Jurídico' });
    configurarToken({ autenticado: true, id_rol: 2, rol: 'Jurídico' });

    dashboardServiceMock = {
      obtenerDatosDashboard: vi.fn(() => of(crearResumenDashboardMock()))
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DashboardJuridicoComponent, Peticion],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'inicio-admin/dashboard-juridico', component: DashboardJuridicoComponent },
          { path: 'inicio-admin/peticion', component: Peticion },
          { path: '**', redirectTo: 'inicio-admin/dashboard-juridico' }
        ]),
        { provide: AuthService, useValue: authMock },
        { provide: DashboardJuridicoService, useValue: dashboardServiceMock },
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
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
      TestBed.resetTestingModule();
    }
  });

  it('debe mostrar tarjeta PENDIENTE, resumen CONFIRMADO/DESCARTADO, lista compacta más reciente y reaccionar al resolver (rol 2)', () => {
    const alertas: AlertaDuplicadoResumen[] = [
      crearAlertaMock({ id_alerta: 1, peticion_menor_id: 101, peticion_mayor_id: 102, fecha_creacion: '2026-11-14T01:00:00Z' }),
      crearAlertaMock({ id_alerta: 2, peticion_menor_id: 103, peticion_mayor_id: 104, fecha_creacion: '2026-11-14T02:00:00Z' }),
      crearAlertaMock({ id_alerta: 3, peticion_menor_id: 105, peticion_mayor_id: 106, fecha_creacion: '2026-11-14T03:00:00Z' }),
      crearAlertaMock({ id_alerta: 4, peticion_menor_id: 107, peticion_mayor_id: 108, fecha_creacion: '2026-11-14T04:00:00Z' }),
      crearAlertaMock({ id_alerta: 5, peticion_menor_id: 109, peticion_mayor_id: 110, fecha_creacion: '2026-11-14T05:00:00Z' }),
      crearAlertaMock({ id_alerta: 6, peticion_menor_id: 111, peticion_mayor_id: 112, fecha_creacion: '2026-11-14T09:30:00Z' }),
      crearAlertaMock({
        id_alerta: 7,
        estado_revision: 'CONFIRMADO',
        peticion_menor_id: 113,
        peticion_mayor_id: 114,
        peticion_principal_id: 113,
        fecha_creacion: '2026-11-14T10:00:00Z'
      })
    ];

    const fixture = TestBed.createComponent(DashboardJuridicoComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) =>
        r.method === 'GET' &&
        r.url === `${basePeticionesUrl}/duplicados/alertas/` &&
        r.params.get('page_size') === '100'
    );
    const resp: ListadoAlertasDuplicadosResponse = {
      count: alertas.length,
      next: null,
      previous: null,
      page: 1,
      page_size: 100,
      total_pages: 1,
      resumen: { PENDIENTE: 6, CONFIRMADO: 1, DESCARTADO: 2, total: 9 },
      results: alertas
    };
    req.flush(resp);
    fixture.detectChanges();

    // Métricas jurídicas actuales intactas
    const pageText = fixture.nativeElement.textContent as string;
    expect(pageText).toContain('Total Peticiones');
    expect(pageText).toContain('12');
    expect(pageText).toContain('Dra. Laura Gómez');
    expect(pageText).toContain('Atención Urgente');

    // Tarjeta PENDIENTE y resumen CONFIRMADO / DESCARTADO
    const cardPend = fixture.debugElement.query(By.css('[data-testid="tarjeta-duplicados-pendientes"]'));
    const cardConf = fixture.debugElement.query(By.css('[data-testid="resumen-duplicados-confirmados"]'));
    const cardDesc = fixture.debugElement.query(By.css('[data-testid="resumen-duplicados-descartados"]'));
    expect(cardPend.nativeElement.textContent).toContain('6');
    expect(cardConf.nativeElement.textContent).toContain('1');
    expect(cardDesc.nativeElement.textContent).toContain('2');

    // Lista compacta: máximo 5 pendientes más recientes, ordenadas por fecha descendente (#6 primero, #1 excluida)
    const items = fixture.debugElement.queryAll(By.css('[data-testid="lista-alertas-duplicados-recientes"] button'));
    expect(items.length).toBe(5);
    expect(items[0].nativeElement.textContent).toContain('Alerta #6');
    expect(items[0].nativeElement.textContent).toContain('RAD-PET-111');
    expect(items[4].nativeElement.textContent).toContain('Alerta #2');
    expect(pageText).not.toContain('Alerta #7');

    // Actualización reactiva al resolver alerta #6 mediante AlertasDuplicadosService
    const service = TestBed.inject(AlertasDuplicadosService);
    const alerta6Actualizada = { ...alertas[5], estado_revision: 'DESCARTADO' as const };
    let completado = false;
    service.resolverAlerta(6, { estado_revision: 'DESCARTADO' }).subscribe(() => {
      completado = true;
    });

    const reqResolver = httpMock.expectOne(
      (r) => r.method === 'POST' && r.url === `${basePeticionesUrl}/duplicados/alertas/6/resolver/`
    );
    const resolverResp: ResolverAlertaDuplicadoResponse = {
      mensaje: 'Alerta descartada.',
      cambiada: true,
      estado_anterior: 'PENDIENTE',
      estado_nuevo: 'DESCARTADO',
      alerta: crearDetalleMock(alerta6Actualizada)
    };
    reqResolver.flush(resolverResp);
    expect(completado).toBe(true);

    fixture.detectChanges();
    expect(cardPend.nativeElement.textContent).toContain('5');
    expect(cardDesc.nativeElement.textContent).toContain('3');
    const itemsDespues = fixture.debugElement.queryAll(By.css('[data-testid="lista-alertas-duplicados-recientes"] button'));
    expect(itemsDespues[0].nativeElement.textContent).toContain('Alerta #5');
  });

  it('debe navegar a /inicio-admin/peticion?vista=duplicados y abrir comparación directa con queryParams', async () => {
    const alerta42 = crearAlertaMock({ id_alerta: 42, peticion_menor_id: 201, peticion_mayor_id: 202 });
    const fixture = TestBed.createComponent(DashboardJuridicoComponent);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.method === 'GET' && r.url === `${basePeticionesUrl}/duplicados/alertas/`)
      .flush({
        count: 1,
        page: 1,
        page_size: 100,
        total_pages: 1,
        resumen: { PENDIENTE: 1, CONFIRMADO: 0, DESCARTADO: 0, total: 1 },
        results: [alerta42]
      });
    fixture.detectChanges();

    // 1. Botón "Ver todas las alertas"
    const navSpy = vi.spyOn(router, 'navigate');
    const btnVerTodas = fixture.debugElement.query(By.css('[data-testid="btn-ver-todas-alertas-duplicados"]'));
    expect(btnVerTodas).toBeTruthy();
    expect(btnVerTodas.nativeElement.textContent).toContain('Ver todas las alertas');
    btnVerTodas.nativeElement.click();
    await navSpy.mock.results[0]?.value;

    expect(navSpy).toHaveBeenCalledWith(['/inicio-admin/peticion'], {
      queryParams: { vista: 'duplicados' }
    });
    expect(router.url).toBe('/inicio-admin/peticion?vista=duplicados');

    // 2. Clic en tarjeta de alerta #42 navega con ?vista=duplicados&alerta=42
    fixture.debugElement.query(By.css('[data-testid="alerta-reciente-42"]')).nativeElement.click();
    await navSpy.mock.results[1]?.value;
    expect(navSpy).toHaveBeenCalledWith(['/inicio-admin/peticion'], {
      queryParams: { vista: 'duplicados', alerta: 42 }
    });
    expect(router.url).toBe('/inicio-admin/peticion?vista=duplicados&alerta=42');

    // 3. Verificación end-to-end de apertura del comparador al navegar a Peticion con ?vista=duplicados&alerta=42
    await router.navigateByUrl('/inicio-admin/peticion?vista=duplicados&alerta=42');
    const peticionFixture = TestBed.createComponent(Peticion);
    peticionFixture.detectChanges();

    for (const r of httpMock.match((req) => req.method === 'GET' && !req.url.includes('duplicad'))) {
      r.flush([]);
    }
    for (const r of httpMock.match((req) => req.method === 'GET' && req.url === `${basePeticionesUrl}/duplicados/alertas/`)) {
      r.flush({
        count: 1,
        page: 1,
        page_size: 100,
        total_pages: 1,
        resumen: { PENDIENTE: 1, CONFIRMADO: 0, DESCARTADO: 0, total: 1 },
        results: [alerta42]
      });
    }
    httpMock
      .expectOne((req) => req.method === 'GET' && req.url === `${basePeticionesUrl}/duplicados/alertas/42/`)
      .flush(crearDetalleMock(alerta42));
    peticionFixture.detectChanges();

    expect(peticionFixture.componentInstance.vistaModulo).toBe('duplicados');
    expect(peticionFixture.componentInstance.alertaComparacionId).toBe(42);
    expect(peticionFixture.debugElement.query(By.directive(AlertaDuplicadoComparacionComponent))).toBeTruthy();
  });

  it('debe manejar carga, error aislado y estado sin alertas sin afectar los indicadores jurídicos', () => {
    const fixture = TestBed.createComponent(DashboardJuridicoComponent);
    fixture.detectChanges();

    // Estado de carga activo mientras las métricas jurídicas ya están visibles
    expect(fixture.debugElement.query(By.css('[data-testid="cargando-duplicados-dashboard"]'))).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Total Peticiones');
    expect(fixture.nativeElement.textContent).toContain('12');

    const reqFail = httpMock.expectOne((r) => r.method === 'GET' && r.url === `${basePeticionesUrl}/duplicados/alertas/`);
    reqFail.flush({ detail: 'Error temporal en duplicados' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    // Error localizado solo en duplicados; dashboard principal sigue sin errorCarga
    expect(fixture.componentInstance.errorCarga).toBe('');
    expect(fixture.debugElement.query(By.css('[data-testid="error-duplicados-dashboard"]'))).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Error temporal en duplicados');
    expect(fixture.nativeElement.textContent).toContain('Atención Urgente');

    // Reintentar devuelve 0 pendientes
    const btnReintentar = fixture.debugElement.query(
      By.css('[data-testid="error-duplicados-dashboard"] button')
    );
    btnReintentar.nativeElement.click();
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.method === 'GET' && r.url === `${basePeticionesUrl}/duplicados/alertas/`)
      .flush({
        count: 0,
        page: 1,
        page_size: 100,
        total_pages: 1,
        resumen: { PENDIENTE: 0, CONFIRMADO: 1, DESCARTADO: 2, total: 3 },
        results: []
      });
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('[data-testid="error-duplicados-dashboard"]'))).toBeNull();
    expect(fixture.debugElement.query(By.css('[data-testid="sin-alertas-duplicados-dashboard"]'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('[data-testid="tarjeta-duplicados-pendientes"]')).nativeElement.textContent).toContain('0');
    expect(fixture.debugElement.query(By.css('[data-testid="resumen-duplicados-confirmados"]')).nativeElement.textContent).toContain('1');
    expect(fixture.debugElement.query(By.css('[data-testid="btn-ver-todas-alertas-duplicados"]'))).toBeTruthy();
  });

  it('debe ocultar sección y omitir HTTP en roles 3 y 5, y reutilizar índice cacheado sin llamadas duplicadas', () => {
    // 1. Veterinario (rol 3)
    configurarToken({ autenticado: true, id_rol: 3, rol: 'Veterinario' });
    const fixtureVet = TestBed.createComponent(DashboardJuridicoComponent);
    fixtureVet.detectChanges();
    expect(fixtureVet.debugElement.query(By.css('[data-testid="dashboard-juridico-duplicados"]'))).toBeNull();
    httpMock.expectNone((r) => r.url.toLowerCase().includes('duplicad'));
    fixtureVet.destroy();

    // 2. Super Administrador (rol 5)
    configurarToken({ autenticado: true, id_rol: 5, rol: 'Super Administrador' });
    const fixtureSuper = TestBed.createComponent(DashboardJuridicoComponent);
    fixtureSuper.detectChanges();
    expect(fixtureSuper.debugElement.query(By.css('[data-testid="dashboard-juridico-duplicados"]'))).toBeNull();
    httpMock.expectNone((r) => r.url.toLowerCase().includes('duplicad'));
    fixtureSuper.destroy();

    // 3. Jurídico reutilizando caché precargada de AlertasDuplicadosService (0 llamadas nuevas al montar)
    configurarToken({ autenticado: true, id_rol: 2, rol: 'Jurídico' });
    const service = TestBed.inject(AlertasDuplicadosService);
    const alertaCache = crearAlertaMock({ id_alerta: 88, peticion_menor_id: 501, peticion_mayor_id: 502 });
    service.cargarIndiceAlertas({ page_size: 100 }, false).subscribe();
    httpMock
      .expectOne((r) => r.method === 'GET' && r.url === `${basePeticionesUrl}/duplicados/alertas/`)
      .flush({
        count: 1,
        page: 1,
        page_size: 100,
        total_pages: 1,
        resumen: { PENDIENTE: 1, CONFIRMADO: 0, DESCARTADO: 0, total: 1 },
        results: [alertaCache]
      });

    const fixtureReuso = TestBed.createComponent(DashboardJuridicoComponent);
    fixtureReuso.detectChanges();
    httpMock.expectNone((r) => r.url.toLowerCase().includes('duplicad'));
    expect(fixtureReuso.debugElement.query(By.css('[data-testid="alerta-reciente-88"]'))).toBeTruthy();

    // 4. Error en dashboardService principal NO impide renderizar la sección de duplicados
    dashboardServiceMock.obtenerDatosDashboard.mockReturnValueOnce(
      throwError(() => new Error('Backend métricas caído'))
    );
    fixtureReuso.componentInstance.cargarDatos(false);
    fixtureReuso.detectChanges();
    expect(fixtureReuso.componentInstance.errorCarga).toContain('No se pudieron sincronizar');
    expect(fixtureReuso.debugElement.query(By.css('[data-testid="alerta-reciente-88"]'))).toBeTruthy();
  });
});
