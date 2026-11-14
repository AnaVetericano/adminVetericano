import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { environment } from '../../environments/environment';
import {
  AlertaDuplicadoDetalle,
  AlertaDuplicadoResumen,
  ListadoAlertasDuplicadosResponse,
  ResolverAlertaDuplicadoResponse
} from '../models/duplicados.model';

type ResumenAlertas = ListadoAlertasDuplicadosResponse['resumen'];
import { AlertasDuplicadosService } from '../services/alertas-duplicados.service';
import { AuthService } from '../services/auth';
import { AlertaDuplicadoComparacionComponent } from './alerta-duplicado-comparacion/alerta-duplicado-comparacion';
import { Peticion } from './peticion';

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

  return {
    estado,
    isAuthenticated: () => estado().autenticado,
    currentUser: () =>
      estado().autenticado
        ? {
            id_usuario: 99,
            email: 'tester@vetericano.test',
            nombre: 'Usuario',
            apellido: 'Prueba',
            rol: estado().rol,
            id_rol: estado().id_rol
          }
        : null,
    userRole: () => estado().rol,
    isSuperAdmin: () => estado().autenticado && estado().id_rol === 5,
    isAdmin: () => estado().autenticado && estado().id_rol === 1,
    isJuridico: () => estado().autenticado && estado().id_rol === 2,
    isVeterinario: () => estado().autenticado && estado().id_rol === 3
  };
}

function crearPeticionCardMock(
  id: number,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id_peticion: id,
    numero_radicado: `RAD-PET-${id}`,
    descripcion: `Reporte clínico #${id} en vía pública`,
    estado: 'Pendiente',
    prioridad: 'Media',
    fecha: '2026-11-13T10:00:00Z',
    tipo_peticion_nombre: 'Maltrato animal',
    nombre_tipo: 'Maltrato animal',
    ubicacion: {
      id_ubicacion: id,
      direccion: `Calle ${id} # 10-20`,
      latitud: 2.4448,
      longitud: -76.6147
    },
    foto: 'https://res.cloudinary.com/demo/image/upload/v1/pet.jpg',
    fotos: ['https://res.cloudinary.com/demo/image/upload/v1/pet.jpg'],
    total_fotos: 1,
    ...overrides
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
    similitud_texto: 0.8542,
    coincidencia_texto: true,
    distancia_metros: 42.5,
    coincidencia_gps: true,
    distancia_hamming: 4,
    similitud_imagen: 0.9375,
    coincidencia_imagen: true,
    score_combinado: 0.891,
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
      foto: 'https://res.cloudinary.com/demo/image/upload/v1/pet.jpg',
      fotos: ['https://res.cloudinary.com/demo/image/upload/v1/pet.jpg'],
      total_fotos: 1,
      asignacion: {
        asignada: true,
        asignado_a: {
          id_usuario: 33,
          nombre: 'Laura',
          apellido: 'Gómez',
          nombre_completo: 'Laura Gómez',
          email: 'laura.vet@vetericano.test'
        },
        asignado_por: null,
        fecha_asignacion: '2026-11-14T07:45:00Z'
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
          evidencias: [
            {
              id_evidencia: 7,
              ruta_archivo: 'https://res.cloudinary.com/demo/image/upload/v1/pet.jpg',
              descripcion: 'Foto principal'
            }
          ],
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

function crearListadoResponse(
  results: AlertaDuplicadoResumen[],
  resumen: ResumenAlertas,
  overrides: Partial<ListadoAlertasDuplicadosResponse> = {}
): ListadoAlertasDuplicadosResponse {
  return {
    count: overrides.count ?? results.length,
    next: overrides.next ?? null,
    previous: overrides.previous ?? null,
    page: overrides.page ?? 1,
    page_size: overrides.page_size ?? 10,
    total_pages: overrides.total_pages ?? 1,
    resumen,
    results,
    ...overrides
  };
}

describe('Integración Etapa 3: Peticion + Alertas de Duplicados', () => {
  const basePeticionesUrl = environment.apiUrlPeticiones.replace(/\/+$/, '');
  let httpMock: HttpTestingController;
  let authMock: ReturnType<typeof crearAuthServiceMock>;
  let router: Router;
  let overflowOriginal: string;
  let storageStore: Map<string, string>;

  const peticionesBase = [
    crearPeticionCardMock(101),
    crearPeticionCardMock(205, { prioridad: 'Urgente' }),
    crearPeticionCardMock(301),
    crearPeticionCardMock(401)
  ];

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

  function flushPeticionesNoDuplicadas(peticiones = peticionesBase): void {
    const pendientes = httpMock.match(
      (req) => req.method === 'GET' && !req.url.toLowerCase().includes('duplicad')
    );

    for (const req of pendientes) {
      if (
        req.request.url === `${basePeticionesUrl}/listar/` ||
        req.request.url.endsWith('/listar/') ||
        req.request.url === `${basePeticionesUrl}/` ||
        req.request.url === basePeticionesUrl
      ) {
        req.flush(peticiones);
      } else if (/\/api\/peticiones\/\d+\/$/.test(req.request.url)) {
        const idStr = req.request.url.match(/\/(\d+)\/$/)?.[1];
        const encontrada = peticiones.find((p) => Number(p['id_peticion']) === Number(idStr));
        req.flush(encontrada ?? crearPeticionCardMock(Number(idStr || 101)));
      } else {
        req.flush([]);
      }
    }
  }

  function flushIndiceAlertas(
    results: AlertaDuplicadoResumen[],
    resumen: ResumenAlertas
  ): void {
    const reqs = httpMock.match(
      (req) =>
        req.method === 'GET' &&
        req.url === `${basePeticionesUrl}/duplicados/alertas/` &&
        req.params.get('page_size') === '100'
    );
    expect(reqs.length).toBeGreaterThan(0);
    for (const req of reqs) {
      req.flush(crearListadoResponse(results, resumen, { page: 1, page_size: 100 }));
    }
  }

  function crearFixture(): ComponentFixture<Peticion> {
    const fixture = TestBed.createComponent(Peticion);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    overflowOriginal = document.body.style.overflow;
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState({}, '', '/');
    }
    storageStore = new Map<string, string>();
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

    authMock = crearAuthServiceMock({
      autenticado: true,
      id_rol: 2,
      rol: 'Jurídico'
    });
    configurarToken({ autenticado: true, id_rol: 2, rol: 'Jurídico' });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Peticion],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: '', component: Peticion },
          { path: '**', component: Peticion }
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
      document.body.style.overflow = overflowOriginal;
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState({}, '', '/');
      }
      TestBed.resetTestingModule();
    }
  });

  it('debe mostrar pestaña con contador e indicadores en tarjetas sin consultas N+1 para Jurídico (rol 2)', () => {
    const alerta10 = crearAlertaMock({ id_alerta: 10, peticion_menor_id: 101, peticion_mayor_id: 205 });
    const alerta11 = crearAlertaMock({ id_alerta: 11, peticion_menor_id: 205, peticion_mayor_id: 402 });
    const alertaConfirmada = crearAlertaMock({
      id_alerta: 12,
      estado_revision: 'CONFIRMADO',
      peticion_menor_id: 301,
      peticion_mayor_id: 403,
      peticion_principal_id: 301
    });
    const resumen: ResumenAlertas = { PENDIENTE: 2, CONFIRMADO: 1, DESCARTADO: 0, total: 3 };

    const fixture = crearFixture();
    flushPeticionesNoDuplicadas();
    flushIndiceAlertas([alerta10, alerta11, alertaConfirmada], resumen);
    fixture.detectChanges();

    const htmlText = fixture.nativeElement.textContent as string;
    expect(htmlText).toContain('Alertas de duplicados');

    const tabDuplicados = fixture.debugElement
      .queryAll(By.css('button[role="tab"]'))
      .find((b) => (b.nativeElement.textContent as string).includes('Alertas de duplicados'));
    expect(tabDuplicados).toBeTruthy();
    expect(tabDuplicados!.nativeElement.textContent).toContain('2');

    const badgesPendientes = fixture.debugElement.queryAll(
      By.css('button[title="Revisar alerta de posible duplicado"]')
    );
    expect(badgesPendientes.length).toBe(2);
    expect(badgesPendientes[0].nativeElement.textContent).toContain('Posible duplicado');
    expect(badgesPendientes[1].nativeElement.textContent).toContain('Posible duplicado');
    expect(badgesPendientes[1].nativeElement.textContent).toContain('(2)');

    expect(htmlText).toContain('Duplicado confirmado');
  });

  it('debe gestionar bandeja, filtros por estado, paginación y estados vacío/error para Administrador (rol 1)', () => {
    configurarToken({ autenticado: true, id_rol: 1, rol: 'Administrador' });

    const alertaPendiente = crearAlertaMock({
      id_alerta: 21,
      estado_revision: 'PENDIENTE',
      peticion_menor_id: 101,
      peticion_mayor_id: 205
    });
    const alertaConfirmadaPag2 = crearAlertaMock({
      id_alerta: 22,
      estado_revision: 'CONFIRMADO',
      peticion_menor_id: 301,
      peticion_mayor_id: 205,
      peticion_principal_id: 301,
      similitud_texto: 0.92,
      distancia_metros: 15
    });

    const fixture = crearFixture();
    flushPeticionesNoDuplicadas();
    flushIndiceAlertas(
      [alertaPendiente],
      { PENDIENTE: 1, CONFIRMADO: 2, DESCARTADO: 1, total: 4 }
    );
    fixture.detectChanges();

    // Abrir pestaña Alertas de duplicados (inicia mostrando filtro TODOS)
    const tabDuplicados = fixture.debugElement
      .queryAll(By.css('button[role="tab"]'))
      .find((b) => (b.nativeElement.textContent as string).includes('Alertas de duplicados'));
    tabDuplicados!.nativeElement.click();
    fixture.detectChanges();

    const reqBandeja1 = httpMock.expectOne(
      (req) =>
        req.method === 'GET' &&
        req.url === `${basePeticionesUrl}/duplicados/alertas/` &&
        req.params.get('page_size') !== '100'
    );
    expect(reqBandeja1.request.params.has('estado_revision')).toBe(false);
    expect(reqBandeja1.request.params.get('page')).toBe('1');
    reqBandeja1.flush(
      crearListadoResponse([alertaPendiente], {
        PENDIENTE: 1,
        CONFIRMADO: 2,
        DESCARTADO: 1,
        total: 4
      })
    );
    fixture.detectChanges();

    const rows = fixture.debugElement.queryAll(By.css('table tbody tr'));
    expect(rows.length).toBe(1);
    const rowText = rows[0].nativeElement.textContent as string;
    expect(rowText).toContain('#21');
    expect(rowText).toContain('RAD-PET-101');
    expect(rowText).toContain('RAD-PET-205');
    expect(rowText).toContain('PENDIENTE');
    expect(rowText).toContain('85.4%');
    expect(rowText).toContain('42.5 m');
    expect(rowText).toContain('Comparar');

    // Filtrar explícitamente por PENDIENTE
    const btnPendientes = fixture.debugElement
      .queryAll(By.css('div[role="group"] button'))
      .find((b) => b.nativeElement.textContent.trim() === 'Pendientes');
    btnPendientes!.nativeElement.click();
    fixture.detectChanges();

    const reqPendientes = httpMock.expectOne(
      (req) =>
        req.method === 'GET' &&
        req.url === `${basePeticionesUrl}/duplicados/alertas/` &&
        req.params.get('estado_revision') === 'PENDIENTE'
    );
    reqPendientes.flush(
      crearListadoResponse([alertaPendiente], {
        PENDIENTE: 1,
        CONFIRMADO: 2,
        DESCARTADO: 1,
        total: 4
      })
    );
    fixture.detectChanges();

    // Filtrar por CONFIRMADO con 2 páginas
    const btnConfirmadas = fixture.debugElement
      .queryAll(By.css('div[role="group"] button'))
      .find((b) => b.nativeElement.textContent.trim() === 'Confirmadas');
    btnConfirmadas!.nativeElement.click();
    fixture.detectChanges();

    const reqConfirmadas = httpMock.expectOne(
      (req) =>
        req.method === 'GET' &&
        req.url === `${basePeticionesUrl}/duplicados/alertas/` &&
        req.params.get('estado_revision') === 'CONFIRMADO'
    );
    reqConfirmadas.flush(
      crearListadoResponse(
        [alertaConfirmadaPag2],
        { PENDIENTE: 1, CONFIRMADO: 2, DESCARTADO: 1, total: 4 },
        { count: 2, page: 1, page_size: 10, total_pages: 2 }
      )
    );
    fixture.detectChanges();

    // Ir a página 2
    const btnSiguiente = fixture.debugElement
      .queryAll(By.css('button'))
      .find((b) => b.nativeElement.textContent.trim() === 'Siguiente');
    expect(btnSiguiente!.nativeElement.disabled).toBe(false);
    btnSiguiente!.nativeElement.click();
    fixture.detectChanges();

    const reqPag2 = httpMock.expectOne(
      (req) =>
        req.method === 'GET' &&
        req.url === `${basePeticionesUrl}/duplicados/alertas/` &&
        req.params.get('estado_revision') === 'CONFIRMADO' &&
        req.params.get('page') === '2'
    );
    reqPag2.flush(
      crearListadoResponse(
        [],
        { PENDIENTE: 1, CONFIRMADO: 2, DESCARTADO: 1, total: 4 },
        { count: 2, page: 2, page_size: 10, total_pages: 2 }
      )
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay alertas de duplicados para este filtro');

    // Probar estado de error y botón Reintentar en DESCARTADO
    const btnDescartadas = fixture.debugElement
      .queryAll(By.css('div[role="group"] button'))
      .find((b) => b.nativeElement.textContent.trim() === 'Descartadas');
    btnDescartadas!.nativeElement.click();
    fixture.detectChanges();

    const reqError = httpMock.expectOne(
      (req) =>
        req.method === 'GET' &&
        req.url === `${basePeticionesUrl}/duplicados/alertas/` &&
        req.params.get('estado_revision') === 'DESCARTADO'
    );
    reqError.flush({ detail: 'Error temporal del servidor' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const btnReintentar = fixture.debugElement
      .queryAll(By.css('button'))
      .find((b) => b.nativeElement.textContent.trim() === 'Reintentar');
    expect(btnReintentar).toBeTruthy();

    btnReintentar!.nativeElement.click();
    fixture.detectChanges();

    const reqReintento = httpMock.expectOne(
      (req) =>
        req.method === 'GET' &&
        req.url === `${basePeticionesUrl}/duplicados/alertas/` &&
        req.params.get('estado_revision') === 'DESCARTADO'
    );
    reqReintento.flush(
      crearListadoResponse([], { PENDIENTE: 1, CONFIRMADO: 2, DESCARTADO: 1, total: 4 })
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay alertas de duplicados para este filtro');
  });

  it('debe abrir comparador desde modal detalle, resolver CONFIRMADO vía HTTP mock y sincronizar tarjeta, bandeja y modal', () => {
    const alerta10 = crearAlertaMock({ id_alerta: 10, peticion_menor_id: 101, peticion_mayor_id: 205 });
    const alerta11 = crearAlertaMock({ id_alerta: 11, peticion_menor_id: 205, peticion_mayor_id: 401 });
    const detalle10 = crearDetalleMock(alerta10);

    const fixture = crearFixture();
    flushPeticionesNoDuplicadas();
    flushIndiceAlertas([alerta10, alerta11], { PENDIENTE: 2, CONFIRMADO: 0, DESCARTADO: 0, total: 2 });
    fixture.detectChanges();

    // Clic en badge con 2 alertas pendientes en tarjeta #205 -> abre modal detalle
    const badges = fixture.debugElement.queryAll(
      By.css('button[title="Revisar alerta de posible duplicado"]')
    );
    badges[1].nativeElement.click();
    fixture.detectChanges();

    // Modal detalle consulta GET /api/peticiones/205/duplicados/ y endpoints auxiliares del detalle
    flushPeticionesNoDuplicadas();
    const reqDetallePeticion = httpMock.expectOne(
      (req) => req.method === 'GET' && req.url === `${basePeticionesUrl}/205/duplicados/`
    );
    reqDetallePeticion.flush({
      count: 2,
      resumen: { PENDIENTE: 2, CONFIRMADO: 0, DESCARTADO: 0, total: 2 },
      id_peticion: 205,
      numero_radicado: 'RAD-PET-205',
      results: [alerta10, alerta11]
    });
    fixture.detectChanges();

    const modalText = fixture.nativeElement.textContent as string;
    expect(modalText).toContain('6. Alertas de Posibles Duplicados');
    expect(modalText).toContain('Alerta #10');
    expect(modalText).toContain('RAD-PET-101');

    // Clic en Comparar de Alerta #10 dentro del modal detalle
    const btnCompararModal = fixture.debugElement
      .queryAll(By.css('button'))
      .find((b) => b.nativeElement.textContent.trim() === 'Comparar');
    expect(btnCompararModal).toBeTruthy();
    btnCompararModal!.nativeElement.click();
    fixture.detectChanges();

    // El componente AlertaDuplicadoComparacionComponent carga el detalle de la alerta #10
    const reqAlertaDetalle = httpMock.expectOne(
      (req) => req.method === 'GET' && req.url === `${basePeticionesUrl}/duplicados/alertas/10/`
    );
    reqAlertaDetalle.flush(detalle10);
    fixture.detectChanges();

    const compDebug = fixture.debugElement.query(By.directive(AlertaDuplicadoComparacionComponent));
    expect(compDebug).toBeTruthy();

    // Seleccionar petición #101 como principal y confirmar duplicado mediante clics reales en DOM (mocked POST)
    const compInstance = compDebug.componentInstance as AlertaDuplicadoComparacionComponent;
    const btnElegirMenor = compDebug.query(By.css('[data-testid="btn-elegir-principal-menor"]'));
    expect(btnElegirMenor).toBeTruthy();
    btnElegirMenor.nativeElement.click();
    compInstance.observacion = 'Confirmado en prueba de integración';
    fixture.detectChanges();

    const btnConfirmar = compDebug
      .queryAll(By.css('button'))
      .find((b) => (b.nativeElement.textContent as string).includes('Confirmar Duplicado'));
    expect(btnConfirmar).toBeTruthy();
    btnConfirmar!.nativeElement.click();
    fixture.detectChanges();

    const reqPostResolver = httpMock.expectOne(
      (req) => req.method === 'POST' && req.url === `${basePeticionesUrl}/duplicados/alertas/10/resolver/`
    );
    expect(reqPostResolver.request.body).toEqual({
      estado_revision: 'CONFIRMADO',
      peticion_principal: 101,
      observacion: 'Confirmado en prueba de integración'
    });

    const alertaConfirmada = crearAlertaMock({
      id_alerta: 10,
      estado_revision: 'CONFIRMADO',
      peticion_menor_id: 101,
      peticion_mayor_id: 205,
      peticion_principal_id: 101,
      observacion_revision: 'Confirmado en prueba de integración'
    });
    const respConfirmada: ResolverAlertaDuplicadoResponse = {
      mensaje: 'Alerta confirmada.',
      cambiada: true,
      estado_anterior: 'PENDIENTE',
      estado_nuevo: 'CONFIRMADO',
      alerta: crearDetalleMock(alertaConfirmada)
    };
    reqPostResolver.flush(respConfirmada);
    fixture.detectChanges();

    // Comparador pasa a modo solo lectura inmediatamente
    expect(compDebug.nativeElement.textContent).toContain('CONFIRMADO');
    expect(compDebug.nativeElement.textContent).toContain('Solo lectura');

    // Tab contador bajó a 1, tarjeta #101 muestra Duplicado confirmado y modal detalle refleja CONFIRMADO
    const tabDuplicados = fixture.debugElement
      .queryAll(By.css('button[role="tab"]'))
      .find((b) => (b.nativeElement.textContent as string).includes('Alertas de duplicados'));
    expect(tabDuplicados!.nativeElement.textContent).toContain('1');

    expect(fixture.componentInstance.tienePosibleDuplicadoPendiente(peticionesBase[0])).toBe(false);
    expect(fixture.componentInstance.tieneDuplicadoConfirmadoPeticion(peticionesBase[0])).toBe(true);
    expect(
      fixture.componentInstance.alertasPeticionDetalle.find((a) => a.id_alerta === 10)?.estado_revision
    ).toBe('CONFIRMADO');
  });

  it('debe abrir pestaña y comparador mediante query params ?vista=duplicados&alerta=42 y limpiar alerta al cerrar', async () => {
    const alerta42 = crearAlertaMock({
      id_alerta: 42,
      estado_revision: 'DESCARTADO',
      peticion_menor_id: 101,
      peticion_mayor_id: 205
    });

    await router.navigateByUrl('/?vista=duplicados&estado=DESCARTADO&alerta=42');

    const fixture = crearFixture();
    flushPeticionesNoDuplicadas();

    const reqIndice = httpMock.expectOne(
      (req) =>
        req.method === 'GET' &&
        req.url === `${basePeticionesUrl}/duplicados/alertas/` &&
        req.params.get('page_size') === '100'
    );
    reqIndice.flush(
      crearListadoResponse([alerta42], { PENDIENTE: 0, CONFIRMADO: 0, DESCARTADO: 1, total: 1 })
    );

    const reqBandeja = httpMock.expectOne(
      (req) =>
        req.method === 'GET' &&
        req.url === `${basePeticionesUrl}/duplicados/alertas/` &&
        req.params.get('estado_revision') === 'DESCARTADO'
    );
    reqBandeja.flush(
      crearListadoResponse([alerta42], { PENDIENTE: 0, CONFIRMADO: 0, DESCARTADO: 1, total: 1 })
    );

    const reqAlerta42 = httpMock.expectOne(
      (req) => req.method === 'GET' && req.url === `${basePeticionesUrl}/duplicados/alertas/42/`
    );
    reqAlerta42.flush(crearDetalleMock(alerta42));
    fixture.detectChanges();

    expect(fixture.componentInstance.vistaModulo).toBe('duplicados');
    expect(fixture.componentInstance.alertaComparacionId).toBe(42);
    expect(document.body.style.overflow).toBe('hidden');

    const compDebug = fixture.debugElement.query(By.directive(AlertaDuplicadoComparacionComponent));
    expect(compDebug).toBeTruthy();
    expect(compDebug.nativeElement.textContent).toContain('DESCARTADO');
    expect(compDebug.nativeElement.textContent).toContain('Solo lectura');

    const navSpy = vi.spyOn(router, 'navigate');
    fixture.componentInstance.cerrarComparadorDuplicado();
    fixture.detectChanges();

    expect(fixture.componentInstance.alertaComparacionId).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(navSpy).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { alerta: null },
        queryParamsHandling: 'merge',
        replaceUrl: true
      })
    );
  });

  it('debe coordinar Escape por capas (visor media -> comparador -> modal detalle) sin cerrar capas inferiores', () => {
    const alerta10 = crearAlertaMock({ id_alerta: 10, peticion_menor_id: 101, peticion_mayor_id: 205 });

    const fixture = crearFixture();
    flushPeticionesNoDuplicadas();
    flushIndiceAlertas([alerta10], { PENDIENTE: 1, CONFIRMADO: 0, DESCARTADO: 0, total: 1 });
    fixture.detectChanges();

    // 1. Abrir modal detalle
    fixture.componentInstance.abrirModalDetalle(peticionesBase[0]);
    fixture.detectChanges();
    flushPeticionesNoDuplicadas();
    httpMock
      .expectOne((req) => req.method === 'GET' && req.url === `${basePeticionesUrl}/101/duplicados/`)
      .flush({
        count: 1,
        resumen: { PENDIENTE: 1, CONFIRMADO: 0, DESCARTADO: 0, total: 1 },
        id_peticion: 101,
        numero_radicado: 'RAD-PET-101',
        results: [alerta10]
      });
    fixture.detectChanges();

    // 2. Abrir comparador sobre el modal detalle y abrir su visor interno de media
    fixture.componentInstance.abrirComparadorDuplicado(10);
    fixture.detectChanges();
    httpMock
      .expectOne((req) => req.method === 'GET' && req.url === `${basePeticionesUrl}/duplicados/alertas/10/`)
      .flush(crearDetalleMock(alerta10));
    fixture.detectChanges();

    const compDebug = fixture.debugElement.query(By.directive(AlertaDuplicadoComparacionComponent));
    const compInstance = compDebug.componentInstance as AlertaDuplicadoComparacionComponent;
    const btnThumbImg = compDebug.query(By.css('button img')).parent!;
    btnThumbImg.nativeElement.click();
    fixture.detectChanges();
    expect(compInstance.tieneVisorMediaAbierto).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    // Escape #1: cierra solo el visor de media interno del comparador
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(compInstance.tieneVisorMediaAbierto).toBe(false);
    expect(fixture.componentInstance.alertaComparacionId).toBe(10);
    expect(fixture.componentInstance.modalDetalleAbierto).toBe(true);

    // Escape #2: cierra el comparador dejando abierto modalDetalleAbierto
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.alertaComparacionId).toBeNull();
    expect(fixture.componentInstance.modalDetalleAbierto).toBe(true);

    // Escape #3: cierra modalDetalleAbierto y libera overflow
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.modalDetalleAbierto).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('debe ocultar completamente interfaz y endpoints de duplicados para Veterinario (rol 3)', async () => {
    configurarToken({ autenticado: true, id_rol: 3, rol: 'Veterinario' });
    await router.navigateByUrl('/?vista=duplicados&alerta=42');

    const fixture = crearFixture();
    flushPeticionesNoDuplicadas();
    fixture.detectChanges();

    // Veterinario nunca debe disparar ninguna petición a endpoints de duplicados
    httpMock.expectNone((req) => req.url.toLowerCase().includes('duplicad'));

    expect(fixture.componentInstance.puedeGestionarDuplicados).toBe(false);
    expect(fixture.componentInstance.vistaModulo).toBe('listado');
    expect(fixture.componentInstance.alertaComparacionId).toBeNull();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Alertas de duplicados');
    expect(text).not.toContain('Posible duplicado');
    expect(fixture.debugElement.query(By.directive(AlertaDuplicadoComparacionComponent))).toBeNull();

    // Abrir modal detalle tampoco debe consultar /duplicados/ ni mostrar sección 6
    fixture.componentInstance.abrirModalDetalle(peticionesBase[0]);
    fixture.detectChanges();
    flushPeticionesNoDuplicadas();
    httpMock.expectNone((req) => req.url.toLowerCase().includes('duplicad'));
    expect(fixture.nativeElement.textContent).not.toContain('6. Alertas de Posibles Duplicados');
  });

  it('debe resolver DESCARTADO desde la bandeja de alertas sin petición principal y actualizar lista y contador', () => {
    const alerta31 = crearAlertaMock({ id_alerta: 31, peticion_menor_id: 101, peticion_mayor_id: 205 });
    const fixture = crearFixture();
    flushPeticionesNoDuplicadas();
    flushIndiceAlertas([alerta31], { PENDIENTE: 1, CONFIRMADO: 0, DESCARTADO: 0, total: 1 });
    fixture.detectChanges();

    // Ir a pestaña Alertas de duplicados y filtrar PENDIENTE
    const tabDuplicados = fixture.debugElement
      .queryAll(By.css('button[role="tab"]'))
      .find((b) => (b.nativeElement.textContent as string).includes('Alertas de duplicados'));
    tabDuplicados!.nativeElement.click();
    fixture.detectChanges();

    httpMock
      .expectOne(
        (req) =>
          req.method === 'GET' &&
          req.url === `${basePeticionesUrl}/duplicados/alertas/` &&
          req.params.get('page_size') !== '100'
      )
      .flush(
        crearListadoResponse([alerta31], { PENDIENTE: 1, CONFIRMADO: 0, DESCARTADO: 0, total: 1 })
      );
    fixture.detectChanges();

    const btnPendientes = fixture.debugElement
      .queryAll(By.css('div[role="group"] button'))
      .find((b) => b.nativeElement.textContent.trim() === 'Pendientes');
    btnPendientes!.nativeElement.click();
    fixture.detectChanges();

    httpMock
      .expectOne(
        (req) =>
          req.method === 'GET' &&
          req.url === `${basePeticionesUrl}/duplicados/alertas/` &&
          req.params.get('estado_revision') === 'PENDIENTE'
      )
      .flush(
        crearListadoResponse([alerta31], { PENDIENTE: 1, CONFIRMADO: 0, DESCARTADO: 0, total: 1 })
      );
    fixture.detectChanges();

    // Abrir comparador desde botón Comparar de la bandeja
    const btnComparar = fixture.debugElement
      .queryAll(By.css('table tbody tr button'))
      .find((b) => b.nativeElement.textContent.trim() === 'Comparar');
    btnComparar!.nativeElement.click();
    fixture.detectChanges();

    httpMock
      .expectOne((req) => req.method === 'GET' && req.url === `${basePeticionesUrl}/duplicados/alertas/31/`)
      .flush(crearDetalleMock(alerta31));
    fixture.detectChanges();

    const compDebug = fixture.debugElement.query(By.directive(AlertaDuplicadoComparacionComponent));
    const btnDescartarOpcion = compDebug
      .queryAll(By.css('button'))
      .find((b) => (b.nativeElement.textContent as string).includes('Descartar posible duplicado'));
    expect(btnDescartarOpcion).toBeTruthy();
    btnDescartarOpcion!.nativeElement.click();
    fixture.detectChanges();

    const btnEnviarDescarte = compDebug
      .queryAll(By.css('button'))
      .find((b) => (b.nativeElement.textContent as string).includes('Descartar Alerta'));
    expect(btnEnviarDescarte).toBeTruthy();
    btnEnviarDescarte!.nativeElement.click();
    fixture.detectChanges();

    const reqPost = httpMock.expectOne(
      (req) => req.method === 'POST' && req.url === `${basePeticionesUrl}/duplicados/alertas/31/resolver/`
    );
    expect(reqPost.request.body).toEqual({
      estado_revision: 'DESCARTADO',
      observacion: null
    });

    const alertaDescartada = crearAlertaMock({
      id_alerta: 31,
      estado_revision: 'DESCARTADO',
      peticion_menor_id: 101,
      peticion_mayor_id: 205,
      peticion_principal_id: null
    });
    reqPost.flush({
      mensaje: 'Alerta descartada.',
      cambiada: true,
      estado_anterior: 'PENDIENTE',
      estado_nuevo: 'DESCARTADO',
      alerta: crearDetalleMock(alertaDescartada)
    });
    fixture.detectChanges();

    // En filtro PENDIENTE la fila desaparece inmediatamente y el badge pasa a 0
    expect(fixture.debugElement.queryAll(By.css('table tbody tr')).length).toBe(0);
    expect(fixture.componentInstance.totalPendientesDuplicados).toBe(0);
    expect(fixture.componentInstance.resumenAlertas.DESCARTADO).toBe(1);
    expect(fixture.componentInstance.tienePosibleDuplicadoPendiente(peticionesBase[0])).toBe(false);
  });

  // =========================================================================
  // ETAPA 4: CENTRO DE NOTIFICACIONES JURÍDICAS Y POSIBLE_DUPLICADO
  // =========================================================================

  it('Etapa 4: debe mostrar badge Posible duplicado, extraer ID de alerta y abrir comparador sin afectar urgencias', () => {
    const alerta42 = crearAlertaMock({ id_alerta: 42, peticion_menor_id: 101, peticion_mayor_id: 205 });
    const notifDupConId = {
      id_notificacion: 15,
      id_peticion: 205,
      numero_radicado: 'RAD-PET-205',
      tipo: 'POSIBLE_DUPLICADO',
      mensaje:
        'Posible duplicado detectado (alerta #42, par #101-#205): la petición RAD-PET-205 coincide con RAD-PET-101 [criterios: texto, gps; score: 0.89].',
      leida: false,
      fecha_creacion: '2026-11-14T08:00:00Z'
    };
    const notifUrgente = {
      id_notificacion: 16,
      id_peticion: 101,
      numero_radicado: 'RAD-PET-101',
      tipo: 'URGENTE',
      mensaje: 'Caso urgente requiere atención veterinaria inmediata.',
      leida: false,
      fecha_creacion: '2026-11-14T08:05:00Z'
    };

    const fixture = crearFixture();

    const reqNotif = httpMock.expectOne(
      (req) => req.method === 'GET' && req.url === `${basePeticionesUrl}/notificaciones/?todas=true`
    );
    reqNotif.flush([notifDupConId, notifUrgente]);

    flushPeticionesNoDuplicadas();
    flushIndiceAlertas([alerta42], { PENDIENTE: 1, CONFIRMADO: 0, DESCARTADO: 0, total: 1 });
    fixture.detectChanges();

    expect(fixture.componentInstance.notificacionesNoLeidas).toBe(2);

    // Abrir centro de notificaciones desde el botón de campana existente
    const btnCampana = fixture.debugElement.query(
      By.css('button[title="Notificaciones de nuevas peticiones y urgencias"]')
    );
    expect(btnCampana).toBeTruthy();
    btnCampana.nativeElement.click();
    fixture.detectChanges();

    const panelText = fixture.nativeElement.textContent as string;
    expect(panelText).toContain('Centro de');
    expect(panelText).toContain('Posible duplicado');
    expect(panelText).toContain('Urgente');
    expect(panelText).toContain('2 nuevas');

    // Clic en la notificación POSIBLE_DUPLICADO con alerta #42 en el mensaje
    const itemsNotif = fixture.debugElement.queryAll(By.css('.max-h-72 > div'));
    expect(itemsNotif.length).toBe(2);
    expect(itemsNotif[0].nativeElement.textContent).toContain('Posible duplicado');
    expect(itemsNotif[0].nativeElement.textContent).not.toContain('🚨 Urgente');
    expect(itemsNotif[1].nativeElement.textContent).toContain('🚨 Urgente');

    itemsNotif[0].nativeElement.click();
    fixture.detectChanges();

    const reqMarcar = httpMock.expectOne(
      (req) => req.method === 'PATCH' && req.url === `${basePeticionesUrl}/notificaciones/15/marcar-leida/`
    );
    reqMarcar.flush({ mensaje: 'Marcada como leída.' });
    fixture.detectChanges();

    // No consulta /205/duplicados/ porque extrajo el ID #42 del mensaje
    httpMock.expectNone((req) => req.url === `${basePeticionesUrl}/205/duplicados/`);

    const reqDetalle42 = httpMock.expectOne(
      (req) => req.method === 'GET' && req.url === `${basePeticionesUrl}/duplicados/alertas/42/`
    );
    reqDetalle42.flush(crearDetalleMock(alerta42));
    fixture.detectChanges();

    expect(fixture.componentInstance.notificacionesNoLeidas).toBe(1);
    expect(fixture.componentInstance.panelNotificacionesAbierto).toBe(false);
    expect(fixture.componentInstance.alertaComparacionId).toBe(42);
    expect(fixture.debugElement.query(By.directive(AlertaDuplicadoComparacionComponent))).toBeTruthy();
  });

  it('Etapa 4: si POSIBLE_DUPLICADO no contiene ID en mensaje debe consultar GET /peticiones/{id}/duplicados/ y abrir comparador o fallback a detalle', () => {
    const alerta77 = crearAlertaMock({ id_alerta: 77, peticion_menor_id: 101, peticion_mayor_id: 205 });
    const notifSinId = {
      id_notificacion: 21,
      id_peticion: 205,
      numero_radicado: 'RAD-PET-205',
      tipo: 'POSIBLE_DUPLICADO',
      mensaje: 'Se detectó coincidencia preliminar con un reporte anterior.',
      leida: false,
      fecha_creacion: '2026-11-14T08:10:00Z'
    };
    const notifSinAlertas = {
      id_notificacion: 22,
      id_peticion: 101,
      numero_radicado: 'RAD-PET-101',
      tipo: 'POSIBLE_DUPLICADO',
      mensaje: 'Coincidencia preliminar sin alerta activa.',
      leida: false,
      fecha_creacion: '2026-11-14T08:11:00Z'
    };

    const fixture = crearFixture();
    httpMock
      .expectOne((req) => req.method === 'GET' && req.url === `${basePeticionesUrl}/notificaciones/?todas=true`)
      .flush([notifSinId, notifSinAlertas]);

    flushPeticionesNoDuplicadas();
    flushIndiceAlertas([alerta77], { PENDIENTE: 1, CONFIRMADO: 0, DESCARTADO: 0, total: 1 });
    fixture.detectChanges();

    // 1. Notificación #21 sin ID en mensaje -> encuentra alerta #77 vía GET /205/duplicados/
    fixture.debugElement
      .query(By.css('button[title="Notificaciones de nuevas peticiones y urgencias"]'))
      .nativeElement.click();
    fixture.detectChanges();

    fixture.debugElement.queryAll(By.css('.max-h-72 > div'))[0].nativeElement.click();
    fixture.detectChanges();

    httpMock
      .expectOne((req) => req.method === 'PATCH' && req.url === `${basePeticionesUrl}/notificaciones/21/marcar-leida/`)
      .flush({ ok: true });

    const reqDup205 = httpMock.expectOne(
      (req) => req.method === 'GET' && req.url === `${basePeticionesUrl}/205/duplicados/`
    );
    reqDup205.flush({
      count: 1,
      resumen: { PENDIENTE: 1, CONFIRMADO: 0, DESCARTADO: 0, total: 1 },
      id_peticion: 205,
      numero_radicado: 'RAD-PET-205',
      results: [alerta77]
    });

    httpMock
      .expectOne((req) => req.method === 'GET' && req.url === `${basePeticionesUrl}/duplicados/alertas/77/`)
      .flush(crearDetalleMock(alerta77));
    fixture.detectChanges();

    expect(fixture.componentInstance.alertaComparacionId).toBe(77);
    fixture.componentInstance.cerrarComparadorDuplicado();
    fixture.detectChanges();

    // 2. Notificación #22 sin ID y sin alertas -> fallback a abrir modal detalle de petición #101
    fixture.debugElement
      .query(By.css('button[title="Notificaciones de nuevas peticiones y urgencias"]'))
      .nativeElement.click();
    fixture.detectChanges();

    fixture.debugElement.queryAll(By.css('.max-h-72 > div'))[1].nativeElement.click();
    fixture.detectChanges();

    httpMock
      .expectOne((req) => req.method === 'PATCH' && req.url === `${basePeticionesUrl}/notificaciones/22/marcar-leida/`)
      .flush({ ok: true });

    httpMock
      .expectOne((req) => req.method === 'GET' && req.url === `${basePeticionesUrl}/101/duplicados/`)
      .flush({
        count: 0,
        resumen: { PENDIENTE: 0, CONFIRMADO: 0, DESCARTADO: 0, total: 0 },
        id_peticion: 101,
        numero_radicado: 'RAD-PET-101',
        results: []
      });
    fixture.detectChanges();

    // Se abre modal detalle normal (y ese modal consulta detalle/historial/duplicados de 101)
    expect(fixture.componentInstance.modalDetalleAbierto).toBe(true);
    expect(fixture.componentInstance.peticionDetalle?.id_peticion).toBe(101);
    expect(fixture.componentInstance.alertaComparacionId).toBeNull();

    httpMock
      .expectOne((req) => req.method === 'GET' && req.url === `${basePeticionesUrl}/101/duplicados/`)
      .flush({
        count: 0,
        resumen: { PENDIENTE: 0, CONFIRMADO: 0, DESCARTADO: 0, total: 0 },
        id_peticion: 101,
        numero_radicado: 'RAD-PET-101',
        results: []
      });
    flushPeticionesNoDuplicadas();
  });

  it('Etapa 4: notificaciones antiguas de urgencias y marcar todas leídas mantienen flujo original', () => {
    const notifAntigua = {
      id_notificacion: 30,
      id_peticion: 101,
      numero_radicado: 'RAD-PET-101',
      tipo: 'URGENTE',
      mensaje: 'Nueva petición urgente asignada.',
      leida: false,
      fecha_creacion: '2026-11-14T07:00:00Z'
    };
    const notifOtra = {
      id_notificacion: 31,
      id_peticion: 205,
      numero_radicado: 'RAD-PET-205',
      tipo: 'NUEVA_PETICION',
      mensaje: 'Nueva petición ciudadana registrada.',
      leida: false,
      fecha_creacion: '2026-11-14T07:05:00Z'
    };

    const fixture = crearFixture();
    httpMock
      .expectOne((req) => req.method === 'GET' && req.url === `${basePeticionesUrl}/notificaciones/?todas=true`)
      .flush([notifAntigua, notifOtra]);
    flushPeticionesNoDuplicadas();
    flushIndiceAlertas([], { PENDIENTE: 0, CONFIRMADO: 0, DESCARTADO: 0, total: 0 });
    fixture.detectChanges();

    // Abrir panel y hacer clic en notificación antigua URGENTE -> abre detalle de petición 101 sin llamar alertas/42
    fixture.debugElement
      .query(By.css('button[title="Notificaciones de nuevas peticiones y urgencias"]'))
      .nativeElement.click();
    fixture.detectChanges();

    fixture.debugElement.queryAll(By.css('.max-h-72 > div'))[0].nativeElement.click();
    fixture.detectChanges();

    httpMock
      .expectOne((req) => req.method === 'PATCH' && req.url === `${basePeticionesUrl}/notificaciones/30/marcar-leida/`)
      .flush({ ok: true });
    fixture.detectChanges();

    expect(fixture.componentInstance.modalDetalleAbierto).toBe(true);
    expect(fixture.componentInstance.peticionDetalle?.id_peticion).toBe(101);
    expect(fixture.componentInstance.alertaComparacionId).toBeNull();
    expect(fixture.componentInstance.notificacionesNoLeidas).toBe(1);

    httpMock
      .expectOne((req) => req.method === 'GET' && req.url === `${basePeticionesUrl}/101/duplicados/`)
      .flush({
        count: 0,
        resumen: { PENDIENTE: 0, CONFIRMADO: 0, DESCARTADO: 0, total: 0 },
        id_peticion: 101,
        numero_radicado: 'RAD-PET-101',
        results: []
      });
    flushPeticionesNoDuplicadas();

    // Cerrar detalle, abrir panel de nuevo y usar "Marcar todas leídas"
    fixture.componentInstance.cerrarModalDetalle();
    fixture.debugElement
      .query(By.css('button[title="Notificaciones de nuevas peticiones y urgencias"]'))
      .nativeElement.click();
    fixture.detectChanges();

    const btnMarcarTodas = fixture.debugElement
      .queryAll(By.css('button'))
      .find((b) => b.nativeElement.textContent.trim() === 'Marcar todas leídas');
    expect(btnMarcarTodas).toBeTruthy();
    btnMarcarTodas!.nativeElement.click();
    fixture.detectChanges();

    const reqTodas = httpMock.expectOne(
      (req) => req.method === 'PATCH' && req.url === `${basePeticionesUrl}/notificaciones/marcar-leida/`
    );
    expect(reqTodas.request.body).toEqual({ marcar_todas: true });
    reqTodas.flush({ actualizadas: 1 });
    fixture.detectChanges();

    expect(fixture.componentInstance.notificacionesNoLeidas).toBe(0);
  });

  it('Etapa 4: Veterinario (rol 3) y Super Administrador (rol 5) no reciben HTTP 403 por notificaciones jurídicas ni duplicados', () => {
    // 1. Veterinario (rol 3)
    configurarToken({ autenticado: true, id_rol: 3, rol: 'Veterinario' });
    const fixtureVet = crearFixture();
    flushPeticionesNoDuplicadas();
    fixtureVet.detectChanges();

    httpMock.expectNone((req) => req.url.toLowerCase().includes('notificaciones'));
    httpMock.expectNone((req) => req.url.toLowerCase().includes('duplicad'));

    // Veterinario conserva su botón de campana visual actual sin emitir 403 al abrirlo
    const btnCampanaVet = fixtureVet.debugElement.query(
      By.css('button[title="Notificaciones de nuevas peticiones y urgencias"]')
    );
    expect(btnCampanaVet).toBeTruthy();
    btnCampanaVet.nativeElement.click();
    fixtureVet.detectChanges();

    httpMock.expectNone((req) => req.url.toLowerCase().includes('notificaciones'));
    httpMock.expectNone((req) => req.url.toLowerCase().includes('duplicad'));
    expect(fixtureVet.nativeElement.textContent).toContain('No hay notificaciones');
    fixtureVet.destroy();

    // 2. Super Administrador (rol 5)
    configurarToken({ autenticado: true, id_rol: 5, rol: 'Super Administrador' });
    const fixtureSuper = crearFixture();
    flushPeticionesNoDuplicadas();
    fixtureSuper.detectChanges();

    httpMock.expectNone((req) => req.url.toLowerCase().includes('notificaciones'));
    httpMock.expectNone((req) => req.url.toLowerCase().includes('duplicad'));
  });
});
