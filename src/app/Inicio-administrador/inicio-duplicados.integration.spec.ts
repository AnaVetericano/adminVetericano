import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
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
import { VeterinaryInventoryService } from '../services/veterinary-inventory.service';
import { InicioAdministradorComponent } from './Inicio-administrador';

interface RolMockEstado {
  autenticado: boolean;
  id_rol: number;
  rol: string;
}

@Component({ standalone: true, template: '<p>Ruta placeholder</p>' })
class DummyRouteComponent {}

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
            email: 'tester@vetericano.test',
            nombre: 'Tester',
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
    },
    logout: vi.fn()
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
    similitud_texto: 0.88,
    coincidencia_texto: true,
    distancia_metros: 25,
    coincidencia_gps: true,
    distancia_hamming: 2,
    similitud_imagen: 0.95,
    coincidencia_imagen: true,
    score_combinado: 0.91,
    criterios_coincidencia: ['texto', 'gps', 'imagen'],
    origen_deteccion: 'AUTOMATICO_CREACION',
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
      ubicacion: {
        id_ubicacion: 1,
        direccion: 'Calle 5 # 10-20, Popayán',
        latitud: 2.4448,
        longitud: -76.6147
      },
      descripcion: 'Canino herido en vía pública',
      prioridad: 'Alta',
      fecha: '2026-11-13T10:00:00Z',
      foto: null,
      fotos: [],
      total_fotos: 0,
      asignacion: {
        asignada: false,
        asignado_a: null,
        asignado_por: null,
        fecha_asignacion: null
      }
    },
    peticion_mayor: {
      id_peticion: mayorId,
      numero_radicado: `RAD-PET-${mayorId}`,
      codigo: `RAD-PET-${mayorId}`,
      tipo: { id_tipo: 2, nombre: 'Maltrato animal' },
      estado: { id_estado: 2, nombre: 'Asignada' },
      ubicacion: {
        id_ubicacion: 2,
        direccion: 'Calle 5 # 10-25, Popayán',
        latitud: 2.4449,
        longitud: -76.6148
      },
      descripcion: 'Perro herido cerca de la calle 5',
      prioridad: 'Urgente',
      fecha: '2026-11-14T07:30:00Z',
      foto: null,
      fotos: [],
      total_fotos: 0,
      asignacion: {
        asignada: false,
        asignado_a: null,
        asignado_por: null,
        fecha_asignacion: null
      }
    },
    ...overrides
  };
}

function crearDetalleMock(alerta: AlertaDuplicadoResumen): AlertaDuplicadoDetalle {
  return {
    ...alerta,
    peticion_menor: alerta.peticion_menor
      ? {
          ...alerta.peticion_menor,
          evidencias: [],
          es_peticion_origen: alerta.peticion_origen_id === alerta.peticion_menor_id,
          es_peticion_principal: alerta.peticion_principal_id === alerta.peticion_menor_id
        }
      : null,
    peticion_mayor: alerta.peticion_mayor
      ? {
          ...alerta.peticion_mayor,
          evidencias: [],
          es_peticion_origen: alerta.peticion_origen_id === alerta.peticion_mayor_id,
          es_peticion_principal: alerta.peticion_principal_id === alerta.peticion_mayor_id
        }
      : null,
    comparacion: {
      peticion_menor_id: alerta.peticion_menor_id,
      peticion_mayor_id: alerta.peticion_mayor_id,
      mismo_tipo: true,
      mismo_estado: false,
      ambas_asignadas: false,
      mismo_veterinario_asignado: false,
      diferencia_tiempo_horas: 21.5,
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

describe('Integración Etapa 4: Sidebar, acceso global y reactividad de duplicados', () => {
  const basePeticionesUrl = environment.apiUrlPeticiones.replace(/\/+$/, '');
  let httpMock: HttpTestingController;
  let authMock: ReturnType<typeof crearAuthServiceMock>;
  let router: Router;
  let overflowOriginal: string;
  let alertasMaletin$: BehaviorSubject<any[]>;
  let inventoryMock: {
    alertasMaletin$: ReturnType<BehaviorSubject<any[]>['asObservable']>;
    obtenerMiKit: ReturnType<typeof vi.fn>;
    obtenerAlertasKit: ReturnType<typeof vi.fn>;
    setAlertasMaletin: ReturnType<typeof vi.fn>;
  };

  function configurarToken(rolEstado: RolMockEstado): void {
    authMock.estado.set(rolEstado);
    if (!rolEstado.autenticado) {
      localStorage.removeItem('token');
      localStorage.removeItem('user_session');
      return;
    }
    const jwt = crearJwtFalso({
      id_usuario: 99,
      email: 'tester@vetericano.test',
      id_rol: rolEstado.id_rol,
      rol: rolEstado.rol
    });
    localStorage.setItem('token', jwt);
    localStorage.setItem(
      'user_session',
      JSON.stringify({
        id_usuario: 99,
        email: 'tester@vetericano.test',
        id_rol: rolEstado.id_rol,
        rol: rolEstado.rol
      })
    );
  }

  function flushPeticionesNoDuplicadas(peticiones: any[] = []): void {
    const pendientes = httpMock.match(
      (req) => req.method === 'GET' && !req.url.toLowerCase().includes('duplicad')
    );
    for (const req of pendientes) {
      if (req.request.url.endsWith('/listar/')) {
        req.flush(peticiones);
      } else {
        req.flush([]);
      }
    }
  }

  beforeEach(() => {
    overflowOriginal = document.body.style.overflow;
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState({}, '', '/');
    }

    const storageStore = new Map<string, string>();
    const storageMock: Storage = {
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
    };
    vi.stubGlobal('localStorage', storageMock);
    vi.spyOn(Swal, 'fire').mockResolvedValue({
      isConfirmed: true,
      isDenied: false,
      isDismissed: false
    } as any);

    alertasMaletin$ = new BehaviorSubject<any[]>([]);
    inventoryMock = {
      alertasMaletin$: alertasMaletin$.asObservable(),
      obtenerMiKit: vi.fn(() =>
        of({
          total_unidades: 2,
          items: [{ id_medicamento: 9, nombre: 'Amoxicilina', saldo_disponible: 2, saldo_vencido: 0, lotes: [] }]
        })
      ),
      obtenerAlertasKit: vi.fn(() =>
        of({
          agotados: [],
          criticos: [{ id_medicamento: 9, nombre: 'Amoxicilina', saldo_disponible: 2 }],
          bajos: [],
          vencidos: [],
          proximos_a_vencer: []
        })
      ),
      setAlertasMaletin: vi.fn((list: any[]) => alertasMaletin$.next(list))
    };

    authMock = crearAuthServiceMock({ autenticado: true, id_rol: 1, rol: 'Administrador' });
    configurarToken({ autenticado: true, id_rol: 1, rol: 'Administrador' });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [InicioAdministradorComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          {
            path: 'inicio-admin',
            component: InicioAdministradorComponent,
            children: [
              { path: '', component: DummyRouteComponent },
              { path: 'graficas', component: DummyRouteComponent },
              { path: 'dashboard-juridico', component: DummyRouteComponent },
              { path: 'dashboard-veterinario', component: DummyRouteComponent },
              { path: 'super-dashboard', component: DummyRouteComponent },
              { path: 'peticion', component: Peticion }
            ]
          },
          { path: '**', component: DummyRouteComponent }
        ]),
        { provide: AuthService, useValue: authMock },
        { provide: VeterinaryInventoryService, useValue: inventoryMock },
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
      document.body.style.overflow = overflowOriginal;
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState({}, '', '/');
      }
      TestBed.resetTestingModule();
    }
  });

  it('debe mostrar contador reactivo en sidebar Peticiones, acceso global discreto y conservar alertas de inventario para Administrador (rol 1)', async () => {
    await router.navigateByUrl('/inicio-admin/graficas');
    const fixture = TestBed.createComponent(InicioAdministradorComponent);
    fixture.detectChanges();

    const alerta1 = crearAlertaMock({ id_alerta: 101 });
    const alerta2 = crearAlertaMock({ id_alerta: 102, peticion_menor_id: 103, peticion_mayor_id: 206 });

    // 1 sola llamada al índice compartido
    const reqIndice = httpMock.expectOne(
      (req) =>
        req.method === 'GET' &&
        req.url === `${basePeticionesUrl}/duplicados/alertas/` &&
        req.params.get('page_size') === '100'
    );
    const listadoResp: ListadoAlertasDuplicadosResponse = {
      count: 2,
      next: null,
      previous: null,
      page: 1,
      page_size: 100,
      total_pages: 1,
      resumen: { PENDIENTE: 2, CONFIRMADO: 1, DESCARTADO: 0, total: 3 },
      results: [alerta1, alerta2]
    };
    reqIndice.flush(listadoResp);
    fixture.detectChanges();

    const badgeSidebar = fixture.debugElement.query(By.css('[data-testid="sidebar-peticiones-duplicados-badge"]'));
    expect(badgeSidebar).toBeTruthy();
    expect(badgeSidebar.nativeElement.textContent.trim()).toBe('2');

    const accesoGlobal = fixture.debugElement.query(By.css('[data-testid="acceso-global-duplicados"]'));
    expect(accesoGlobal).toBeTruthy();
    expect(accesoGlobal.nativeElement.textContent).toContain('Duplicados');
    expect(accesoGlobal.nativeElement.textContent).toContain('2');

    // Alertas de inventario del maletín siguen independientes y operativas
    expect(fixture.componentInstance.totalMedicamentosAlertas).toBe(1);
    const btnAlertasInv = fixture.debugElement
      .queryAll(By.css('header button'))
      .find((b) => (b.nativeElement.getAttribute('title') || '').includes('Maletín'));
    expect(btnAlertasInv).toBeTruthy();
    btnAlertasInv!.nativeElement.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Alertas de Maletín');
    expect(fixture.nativeElement.textContent.toLowerCase()).toContain('amoxicilina');
  });

  it('debe navegar desde acceso global a /inicio-admin/peticion?vista=duplicados reutilizando AlertasDuplicadosService y actualizar sidebar al resolver (rol 2)', async () => {
    configurarToken({ autenticado: true, id_rol: 2, rol: 'Jurídico' });
    await router.navigateByUrl('/inicio-admin/dashboard-juridico');

    const fixture = TestBed.createComponent(InicioAdministradorComponent);
    fixture.detectChanges();

    const alerta10 = crearAlertaMock({ id_alerta: 10, peticion_menor_id: 101, peticion_mayor_id: 205 });
    const alerta11 = crearAlertaMock({ id_alerta: 11, peticion_menor_id: 301, peticion_mayor_id: 302 });

    httpMock
      .expectOne(
        (req) =>
          req.method === 'GET' &&
          req.url === `${basePeticionesUrl}/duplicados/alertas/` &&
          req.params.get('page_size') === '100'
      )
      .flush({
        count: 2,
        next: null,
        previous: null,
        page: 1,
        page_size: 100,
        total_pages: 1,
        resumen: { PENDIENTE: 2, CONFIRMADO: 0, DESCARTADO: 0, total: 2 },
        results: [alerta10, alerta11]
      });
    fixture.detectChanges();

    // Clic en el acceso global del header -> navega a /inicio-admin/peticion?vista=duplicados
    const accesoGlobal = fixture.debugElement.query(By.css('[data-testid="acceso-global-duplicados"]'));
    accesoGlobal.nativeElement.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.url).toContain('/inicio-admin/peticion');
    expect(router.url).toContain('vista=duplicados');

    // Reutiliza caché del índice (NO vuelve a pedir page_size=100) y solo carga la bandeja
    flushPeticionesNoDuplicadas();
    httpMock.expectNone(
      (req) =>
        req.method === 'GET' &&
        req.url === `${basePeticionesUrl}/duplicados/alertas/` &&
        req.params.get('page_size') === '100'
    );
    const reqBandeja = httpMock.expectOne(
      (req) =>
        req.method === 'GET' &&
        req.url === `${basePeticionesUrl}/duplicados/alertas/` &&
        req.params.get('page_size') !== '100'
    );
    reqBandeja.flush({
      count: 2,
      next: null,
      previous: null,
      page: 1,
      page_size: 10,
      total_pages: 1,
      resumen: { PENDIENTE: 2, CONFIRMADO: 0, DESCARTADO: 0, total: 2 },
      results: [alerta10, alerta11]
    });
    fixture.detectChanges();

    const peticionDebug = fixture.debugElement.query(By.directive(Peticion));
    expect(peticionDebug).toBeTruthy();
    expect((peticionDebug.componentInstance as Peticion).vistaModulo).toBe('duplicados');

    // Resolver alerta #10 desde el comparador -> contador del sidebar se actualiza reactivamente de 2 a 1
    const btnComparar = peticionDebug.queryAll(By.css('table tbody tr button'))[0];
    btnComparar.nativeElement.click();
    fixture.detectChanges();

    httpMock
      .expectOne((req) => req.method === 'GET' && req.url === `${basePeticionesUrl}/duplicados/alertas/10/`)
      .flush(crearDetalleMock(alerta10));
    fixture.detectChanges();

    const compDebug = fixture.debugElement.query(By.directive(AlertaDuplicadoComparacionComponent));
    const btnDescartarOpc = compDebug
      .queryAll(By.css('button'))
      .find((b) => (b.nativeElement.textContent as string).includes('Descartar posible duplicado'));
    btnDescartarOpc!.nativeElement.click();
    fixture.detectChanges();

    const btnEnviarDescarte = compDebug
      .queryAll(By.css('button'))
      .find((b) => (b.nativeElement.textContent as string).includes('Descartar Alerta'));
    btnEnviarDescarte!.nativeElement.click();
    fixture.detectChanges();

    const reqResolver = httpMock.expectOne(
      (req) => req.method === 'POST' && req.url === `${basePeticionesUrl}/duplicados/alertas/10/resolver/`
    );
    const alerta10Resuelta = crearAlertaMock({ id_alerta: 10, estado_revision: 'DESCARTADO' });
    const respResolver: ResolverAlertaDuplicadoResponse = {
      mensaje: 'Alerta descartada.',
      cambiada: true,
      estado_anterior: 'PENDIENTE',
      estado_nuevo: 'DESCARTADO',
      alerta: crearDetalleMock(alerta10Resuelta)
    };
    reqResolver.flush(respResolver);
    fixture.detectChanges();

    const badgeSidebar = fixture.debugElement.query(By.css('[data-testid="sidebar-peticiones-duplicados-badge"]'));
    expect(badgeSidebar.nativeElement.textContent.trim()).toBe('1');
    expect(fixture.debugElement.query(By.css('[data-testid="topbar-duplicados-count"]')).nativeElement.textContent.trim()).toBe('1');
  });

  it('debe ocultar contador y acceso global de duplicados sin consultar endpoints para Veterinario (rol 3) y Super Administrador (rol 5)', async () => {
    // 1. Veterinario (rol 3): conserva enlace Peticiones y alertas de inventario, pero 0 duplicados ni 403
    configurarToken({ autenticado: true, id_rol: 3, rol: 'Veterinario' });
    await router.navigateByUrl('/inicio-admin/dashboard-veterinario');

    const fixtureVet = TestBed.createComponent(InicioAdministradorComponent);
    fixtureVet.detectChanges();

    httpMock.expectNone((req) => req.url.toLowerCase().includes('duplicad'));
    httpMock.expectNone((req) => req.url.toLowerCase().includes('notificaciones'));

    expect(fixtureVet.componentInstance.puedeVerAlertasDuplicados).toBe(false);
    expect(fixtureVet.debugElement.query(By.css('[data-testid="sidebar-peticiones-duplicados-badge"]'))).toBeNull();
    expect(fixtureVet.debugElement.query(By.css('[data-testid="acceso-global-duplicados"]'))).toBeNull();
    expect(fixtureVet.nativeElement.textContent).toContain('Peticiones');
    expect(fixtureVet.componentInstance.totalMedicamentosAlertas).toBe(1);

    // 2. Super Administrador (rol 5): sin enlace Peticiones, sin acceso global, 0 duplicados
    fixtureVet.destroy();
    configurarToken({ autenticado: true, id_rol: 5, rol: 'Super Administrador' });
    await router.navigateByUrl('/inicio-admin/super-dashboard');

    const fixtureSuper = TestBed.createComponent(InicioAdministradorComponent);
    fixtureSuper.detectChanges();

    httpMock.expectNone((req) => req.url.toLowerCase().includes('duplicad'));
    httpMock.expectNone((req) => req.url.toLowerCase().includes('notificaciones'));
    expect(fixtureSuper.componentInstance.puedeVerAlertasDuplicados).toBe(false);
    expect(fixtureSuper.debugElement.query(By.css('[data-testid="sidebar-peticiones-duplicados-badge"]'))).toBeNull();
    expect(fixtureSuper.debugElement.query(By.css('[data-testid="acceso-global-duplicados"]'))).toBeNull();
  });

  it('debe invocar limpiarEstado de AlertasDuplicadosService al confirmar onLogout', async () => {
    await router.navigateByUrl('/inicio-admin/graficas');
    const fixture = TestBed.createComponent(InicioAdministradorComponent);
    fixture.detectChanges();

    const alerta1 = crearAlertaMock({ id_alerta: 101 });
    httpMock
      .expectOne(
        (req) =>
          req.method === 'GET' &&
          req.url === `${basePeticionesUrl}/duplicados/alertas/` &&
          req.params.get('page_size') === '100'
      )
      .flush({
        count: 1,
        next: null,
        previous: null,
        page: 1,
        page_size: 100,
        total_pages: 1,
        resumen: { PENDIENTE: 1, CONFIRMADO: 0, DESCARTADO: 0, total: 1 },
        results: [alerta1]
      });
    fixture.detectChanges();

    const alertasService = TestBed.inject(AlertasDuplicadosService);
    const limpiarSpy = vi.spyOn(alertasService, 'limpiarEstado');
    expect(alertasService.totalPendientes()).toBe(1);

    fixture.componentInstance.onLogout();
    await fixture.whenStable();

    expect(authMock.logout).toHaveBeenCalledTimes(1);
    expect(limpiarSpy).toHaveBeenCalledTimes(1);
    expect(alertasService.totalPendientes()).toBe(0);
  });
});
