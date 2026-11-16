import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AlertaDuplicadoDetalle,
  AlertaDuplicadoResumen,
  CandidatoDuplicadoManual,
  DetectarDuplicadosResponse,
  ErrorDuplicadosApi,
  ListadoAlertasDuplicadosResponse,
  PeticionAlertasDuplicadosResponse,
  ResolverAlertaDuplicadoResponse,
  convertirSimilitudAPorcentaje,
  esAlertaPersistida,
  esCandidatoManual,
  extraerIdAlertaDeNotificacion,
  formatearDistanciaMetros,
  formatearPorcentajeSimilitud,
  formatearSimilitudImagen
} from '../models/duplicados.model';
import { AlertasDuplicadosService } from './alertas-duplicados.service';
import { AuthService } from './auth';

interface RolMockEstado {
  autenticado: boolean;
  id_rol: number;
  rol: string;
}

function crearAuthServiceMock(estadoInicial: RolMockEstado) {
  const estado = signal<RolMockEstado>(estadoInicial);

  const mock = {
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

  return mock;
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
    origen_deteccion: 'ENDPOINT_MANUAL',
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

describe('AlertasDuplicadosService (Etapa 1)', () => {
  let service: AlertasDuplicadosService;
  let httpMock: HttpTestingController;
  let authMock: ReturnType<typeof crearAuthServiceMock>;
  const baseUrl = environment.apiUrlPeticiones.replace(/\/+$/, '');

  beforeEach(() => {
    authMock = crearAuthServiceMock({
      autenticado: true,
      id_rol: 2,
      rol: 'Jurídico'
    });

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authMock },
        AlertasDuplicadosService
      ]
    });

    service = TestBed.inject(AlertasDuplicadosService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('debe restringir llamadas HTTP exclusivamente a Administrador (1) y Jurídico (2)', () => {
    const rolesBloqueados: RolMockEstado[] = [
      { autenticado: false, id_rol: 0, rol: '' },
      { autenticado: true, id_rol: 3, rol: 'Veterinario' },
      { autenticado: true, id_rol: 4, rol: 'Peticionario' },
      { autenticado: true, id_rol: 5, rol: 'Super Administrador' }
    ];

    const capturarError = (obs$: Observable<unknown>): ErrorDuplicadosApi | undefined => {
      let err: ErrorDuplicadosApi | undefined;
      obs$.subscribe({ error: (e) => (err = e) });
      return err;
    };

    for (const rolEstado of rolesBloqueados) {
      authMock.estado.set(rolEstado);
      expect(service.puedeGestionarAlertas()).toBe(false);
      const statusEsperado = rolEstado.autenticado ? 403 : 401;

      expect(capturarError(service.listarAlertas())?.status).toBe(statusEsperado);
      expect(capturarError(service.obtenerDetalleAlerta(10))?.status).toBe(statusEsperado);
      expect(
        capturarError(
          service.resolverAlerta(10, { estado_revision: 'DESCARTADO', observacion: 'No aplica' })
        )?.status
      ).toBe(statusEsperado);
      expect(capturarError(service.obtenerAlertasPorPeticion(101))?.status).toBe(statusEsperado);
      expect(
        capturarError(service.detectarDuplicadosManual({ descripcion: 'Canino herido' }))?.status
      ).toBe(statusEsperado);
    }

    httpMock.expectNone(() => true);

    authMock.estado.set({ autenticado: true, id_rol: 1, rol: 'Administrador' });
    expect(service.puedeGestionarAlertas()).toBe(true);

    authMock.estado.set({ autenticado: true, id_rol: 2, rol: 'Jurídico' });
    expect(service.puedeGestionarAlertas()).toBe(true);
  });

  it('debe consultar GET /duplicados/alertas/ con filtros y actualizar el resumen reactivo', () => {
    let respuestaRecibida: ListadoAlertasDuplicadosResponse | undefined;
    let ultimoResumenObs: number | undefined;

    const sub = service.resumen$.subscribe((r) => (ultimoResumenObs = r.PENDIENTE));

    service
      .listarAlertas({ estado_revision: 'PENDIENTE', solo_pendientes: true, page: 1, page_size: 20 })
      .subscribe((res) => (respuestaRecibida = res));

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/duplicados/alertas/`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('estado_revision')).toBe('PENDIENTE');
    expect(req.request.params.get('solo_pendientes')).toBe('true');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('page_size')).toBe('20');

    const alerta = crearAlertaMock();
    req.flush({
      count: 1,
      next: null,
      previous: null,
      page: 1,
      page_size: 20,
      total_pages: 1,
      resumen: { PENDIENTE: 3, CONFIRMADO: 2, DESCARTADO: 1, total: 6 },
      results: [alerta]
    });

    expect(respuestaRecibida?.results.length).toBe(1);
    expect(service.totalPendientes()).toBe(3);
    expect(ultimoResumenObs).toBe(3);
    sub.unsubscribe();
  });

  it('debe paginar automáticamente en cargarIndiceAlertas e indexar por ambos IDs evitando N+1', () => {
    const alertaPag1 = crearAlertaMock({ id_alerta: 1, peticion_menor_id: 10, peticion_mayor_id: 20 });
    const alertaPag2 = crearAlertaMock({
      id_alerta: 2,
      estado_revision: 'CONFIRMADO',
      peticion_menor_id: 20,
      peticion_mayor_id: 35,
      peticion_principal_id: 20
    });

    let mapa1: ReadonlyMap<number, AlertaDuplicadoResumen[]> | undefined;
    let mapa2: ReadonlyMap<number, AlertaDuplicadoResumen[]> | undefined;

    // Dos llamadas concurrentes deben compartir una sola secuencia de peticiones HTTP
    service.cargarIndiceAlertas().subscribe((m) => (mapa1 = m));
    service.cargarIndiceAlertas().subscribe((m) => (mapa2 = m));

    const reqPag1 = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/duplicados/alertas/` &&
        r.params.get('page') === '1' &&
        r.params.get('page_size') === '100'
    );
    reqPag1.flush({
      count: 2,
      next: 'http://backend.local/api/peticiones/duplicados/alertas/?page=2',
      previous: null,
      page: 1,
      page_size: 100,
      total_pages: 2,
      resumen: { PENDIENTE: 1, CONFIRMADO: 1, DESCARTADO: 0, total: 2 },
      results: [alertaPag1]
    });

    const reqPag2 = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/duplicados/alertas/` &&
        r.params.get('page') === '2' &&
        r.params.get('page_size') === '100'
    );
    reqPag2.flush({
      count: 2,
      next: null,
      previous: 'http://backend.local/api/peticiones/duplicados/alertas/?page=1',
      page: 2,
      page_size: 100,
      total_pages: 2,
      resumen: { PENDIENTE: 1, CONFIRMADO: 1, DESCARTADO: 0, total: 2 },
      results: [alertaPag2]
    });

    expect(mapa1).toBe(mapa2);
    expect(service.obtenerAlertasDePeticionEnIndice(10).map((a) => a.id_alerta)).toEqual([1]);
    expect(service.obtenerAlertasDePeticionEnIndice(20).map((a) => a.id_alerta)).toEqual([1, 2]);
    expect(service.obtenerAlertasDePeticionEnIndice(35).map((a) => a.id_alerta)).toEqual([2]);
    expect(service.tienePosibleDuplicadoPendiente(10)).toBe(true);
    expect(service.tienePosibleDuplicadoPendiente(35)).toBe(false);
    expect(service.tieneDuplicadoConfirmado(35)).toBe(true);

    // Nueva llamada sin forzarRecarga reutiliza índice sin emitir más HTTP
    let mapaCache: ReadonlyMap<number, AlertaDuplicadoResumen[]> | undefined;
    service.cargarIndiceAlertas().subscribe((m) => (mapaCache = m));
    expect(mapaCache?.size).toBe(3);
    httpMock.expectNone(() => true);
  });

  it('no debe emitir peticiones duplicadas cuando hay llamadas concurrentes a detalle o listado', () => {
    const alerta = crearAlertaMock({ id_alerta: 77 });
    const detalle = crearDetalleMock(alerta);

    let resA: AlertaDuplicadoDetalle | undefined;
    let resB: AlertaDuplicadoDetalle | undefined;

    service.obtenerDetalleAlerta(77).subscribe((d) => (resA = d));
    service.obtenerDetalleAlerta(77).subscribe((d) => (resB = d));

    const reqDetalle = httpMock.expectOne(`${baseUrl}/duplicados/alertas/77/`);
    expect(reqDetalle.request.method).toBe('GET');
    reqDetalle.flush(detalle);

    expect(resA?.id_alerta).toBe(77);
    expect(resB?.comparacion.metricas.similitud_texto).toBe(0.8542);
    expect(service.alertaDetalleActiva()?.id_alerta).toBe(77);
  });

  it('debe consultar GET /api/peticiones/{id}/duplicados/ sin enviar id_peticion repetido en query params', () => {
    let respuesta: PeticionAlertasDuplicadosResponse | undefined;
    service
      .obtenerAlertasPorPeticion(101, { estado_revision: 'DESCARTADO', page: 1, page_size: 10 })
      .subscribe((r) => (respuesta = r));

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/101/duplicados/`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('id_peticion')).toBe(false);
    expect(req.request.params.get('estado_revision')).toBe('DESCARTADO');

    req.flush({
      count: 0,
      resumen: { PENDIENTE: 0, CONFIRMADO: 0, DESCARTADO: 1, total: 1 },
      id_peticion: 101,
      numero_radicado: 'RAD-PET-101',
      results: []
    });

    expect(respuesta?.id_peticion).toBe(101);
    expect(respuesta?.resumen.DESCARTADO).toBe(1);
  });

  it('debe validar petición principal al confirmar y prohibirla al descartar antes de llamar POST resolver', () => {
    const alerta = crearAlertaMock({
      id_alerta: 15,
      peticion_menor_id: 500,
      peticion_mayor_id: 501
    });

    // Poblar índice en memoria para conocer el par (500, 501)
    service.cargarIndiceAlertas().subscribe();
    httpMock.expectOne((r) => r.url === `${baseUrl}/duplicados/alertas/`).flush({
      count: 1,
      next: null,
      previous: null,
      page: 1,
      page_size: 100,
      total_pages: 1,
      resumen: { PENDIENTE: 1, CONFIRMADO: 0, DESCARTADO: 0, total: 1 },
      results: [alerta]
    });

    // 1. Falta peticion_principal al confirmar -> error local 400
    let errorFaltaPrincipal: ErrorDuplicadosApi | undefined;
    service
      .resolverAlerta(15, { estado_revision: 'CONFIRMADO', peticion_principal: 0 })
      .subscribe({ error: (e) => (errorFaltaPrincipal = e) });
    expect(errorFaltaPrincipal?.status).toBe(400);

    // 2. peticion_principal fuera del par -> error local 400
    let errorFueraPar: ErrorDuplicadosApi | undefined;
    service
      .resolverAlerta(15, { estado_revision: 'CONFIRMADO', peticion_principal: 999 })
      .subscribe({ error: (e) => (errorFueraPar = e) });
    expect(errorFueraPar?.status).toBe(400);

    // 3. DESCARTADO con peticion_principal -> error local 400
    let errorDescartadoConPrincipal: ErrorDuplicadosApi | undefined;
    service
      .resolverAlerta(15, {
        estado_revision: 'DESCARTADO',
        peticion_principal: 500 as unknown as null
      })
      .subscribe({ error: (e) => (errorDescartadoConPrincipal = e) });
    expect(errorDescartadoConPrincipal?.status).toBe(400);

    httpMock.expectNone(() => true);

    // 4. Confirmación válida -> POST + actualización reactiva de resumen e índice
    let resConfirmacion: ResolverAlertaDuplicadoResponse | undefined;
    service
      .resolverAlerta(15, {
        estado_revision: 'CONFIRMADO',
        peticion_principal: 500,
        observacion: '  Mismo canino reportado dos veces  '
      })
      .subscribe((r) => (resConfirmacion = r));

    const reqPost = httpMock.expectOne(`${baseUrl}/duplicados/alertas/15/resolver/`);
    expect(reqPost.request.method).toBe('POST');
    expect(reqPost.request.body).toEqual({
      estado_revision: 'CONFIRMADO',
      peticion_principal: 500,
      observacion: 'Mismo canino reportado dos veces'
    });

    const alertaConfirmada = crearAlertaMock({
      id_alerta: 15,
      estado_revision: 'CONFIRMADO',
      peticion_menor_id: 500,
      peticion_mayor_id: 501,
      peticion_principal_id: 500,
      observacion_revision: 'Mismo canino reportado dos veces'
    });

    reqPost.flush({
      mensaje: 'Alerta de duplicado confirmada correctamente.',
      cambiada: true,
      estado_anterior: 'PENDIENTE',
      estado_nuevo: 'CONFIRMADO',
      alerta: crearDetalleMock(alertaConfirmada)
    });

    expect(resConfirmacion?.cambiada).toBe(true);
    expect(service.totalPendientes()).toBe(0);
    expect(service.resumen().CONFIRMADO).toBe(1);
    expect(service.tienePosibleDuplicadoPendiente(500)).toBe(false);
    expect(service.tieneDuplicadoConfirmado(501)).toBe(true);
  });

  it('debe distinguir candidatos manuales de alertas persistidas sin alterar el índice', () => {
    let errorVacio: ErrorDuplicadosApi | undefined;
    service.detectarDuplicadosManual({}).subscribe({ error: (e) => (errorVacio = e) });
    expect(errorVacio?.status).toBe(400);
    httpMock.expectNone(() => true);

    let respuestaManual: DetectarDuplicadosResponse | undefined;
    service
      .detectarDuplicadosManual({ id_peticion: 101, umbral: 0.35 })
      .subscribe((r) => (respuestaManual = r));

    const reqManual = httpMock.expectOne(`${baseUrl}/detectar-duplicados/`);
    expect(reqManual.request.method).toBe('POST');
    expect(reqManual.request.body).toEqual({ id_peticion: 101, umbral: 0.35 });

    const candidato: CandidatoDuplicadoManual = {
      id_peticion: 205,
      numero_radicado: 'RAD-PET-205',
      descripcion: 'Perro herido',
      fecha: '2026-11-14T07:30:00Z',
      similitud: 0.78,
      similitud_texto: 0.78,
      porcentaje_similitud: 78,
      coincidencia_texto: true,
      distancia_metros: null,
      coincidencia_gps: false,
      coincidencia_imagen: false,
      distancia_hamming: null,
      similitud_imagen: null,
      posible_duplicado: true,
      criterios_coincidencia: ['texto'],
      score_combinado: 0.78,
      id_estado: 1,
      estado: 'Pendiente',
      ubicacion: null,
      foto: null,
      fotos: [],
      tiene_fotografia: false
    };

    reqManual.flush({
      advertencia_duplicado: true,
      posible_duplicado: true,
      total_candidatos: 1,
      posibles_duplicados: [candidato],
      mensaje: 'Se encontraron 1 posible(s) reporte(s) similar(es) para revisión humana.',
      parametros: {
        umbral_similitud: 0.35,
        radio_metros: 200,
        dias_ventana: 30,
        longitud_minima_descripcion: 15,
        limite: 10,
        id_peticion_excluido: 101,
        texto_activo: true,
        gps_activo: false,
        imagen_activa: false,
        umbral_hamming: 10
      }
    });

    const alertaPersistida = crearAlertaMock();
    expect(esCandidatoManual(candidato)).toBe(true);
    expect(esAlertaPersistida(candidato)).toBe(false);
    expect(esAlertaPersistida(alertaPersistida)).toBe(true);
    expect(esCandidatoManual(alertaPersistida)).toBe(false);
    expect(respuestaManual?.posibles_duplicados.length).toBe(1);
    expect(service.indicePorPeticion().size).toBe(0);
    expect(service.resumen().total).toBe(0);
  });

  it('debe normalizar correctamente errores HTTP 400, 401, 403, 404 y 409', () => {
    const casos: Array<{
      status: number;
      body: Record<string, unknown> | string | null;
      codigoEsperado: ErrorDuplicadosApi['codigo'];
      textoEsperado: string;
    }> = [
      {
        status: 400,
        body: { peticion_principal: ['Debe indicar una peticion_principal válida.'] },
        codigoEsperado: 'VALIDATION_ERROR',
        textoEsperado: 'Debe indicar una peticion_principal válida.'
      },
      {
        status: 401,
        body: { detail: 'Authentication credentials were not provided.' },
        codigoEsperado: 'UNAUTHORIZED',
        textoEsperado: 'Authentication credentials were not provided.'
      },
      {
        status: 403,
        body: { detail: 'Se requieren permisos de Administrador o Jurídico.' },
        codigoEsperado: 'FORBIDDEN',
        textoEsperado: 'Se requieren permisos de Administrador o Jurídico.'
      },
      {
        status: 404,
        body: { error: 'La alerta de duplicado #999 no fue encontrada.' },
        codigoEsperado: 'NOT_FOUND',
        textoEsperado: 'La alerta de duplicado #999 no fue encontrada.'
      },
      {
        status: 409,
        body: { error: 'Conflicto de concurrencia al resolver la alerta.' },
        codigoEsperado: 'CONFLICT',
        textoEsperado: 'Conflicto de concurrencia al resolver la alerta.'
      }
    ];

    for (const caso of casos) {
      let errCapturado: ErrorDuplicadosApi | undefined;
      service
        .resolverAlerta(999, { estado_revision: 'DESCARTADO', observacion: 'Test' })
        .subscribe({ error: (e) => (errCapturado = e) });

      const req = httpMock.expectOne(`${baseUrl}/duplicados/alertas/999/resolver/`);
      req.flush(caso.body, { status: caso.status, statusText: 'Error' });

      expect(errCapturado?.status).toBe(caso.status);
      expect(errCapturado?.codigo).toBe(caso.codigoEsperado);
      expect(errCapturado?.mensaje).toContain(caso.textoEsperado);
      expect(service.errorActual()?.status).toBe(caso.status);
    }
  });

  it('debe convertir similitud 0–1 a porcentaje y manejar valores null sin mutar los datos originales', () => {
    const alertaConNulls = crearAlertaMock({
      similitud_texto: 0.8542,
      distancia_metros: null,
      similitud_imagen: null,
      distancia_hamming: null,
      score_combinado: 0.42
    });

    expect(convertirSimilitudAPorcentaje(alertaConNulls.similitud_texto, 1)).toBe(85.4);
    expect(convertirSimilitudAPorcentaje(null)).toBeNull();
    expect(convertirSimilitudAPorcentaje(undefined)).toBeNull();

    expect(formatearPorcentajeSimilitud(alertaConNulls.similitud_texto, 1)).toBe('85.4%');
    expect(formatearPorcentajeSimilitud(null, 1, 'N/A')).toBe('N/A');

    expect(formatearDistanciaMetros(null)).toBe('Sin GPS');
    expect(formatearDistanciaMetros(45.28)).toBe('45.3 m');
    expect(formatearDistanciaMetros(1500)).toBe('1.50 km');

    expect(formatearSimilitudImagen(alertaConNulls)).toBe('Sin comparación visual');
    expect(
      formatearSimilitudImagen({ similitud_imagen: 0.9375, distancia_hamming: 4 })
    ).toBe('93.8% (Hamming: 4)');

    // El objeto original conserva sus valores crudos 0–1 y null
    expect(alertaConNulls.similitud_texto).toBe(0.8542);
    expect(alertaConNulls.similitud_imagen).toBeNull();

    // Extracción de ID de alerta en notificaciones POSIBLE_DUPLICADO
    expect(
      extraerIdAlertaDeNotificacion({
        tipo: 'POSIBLE_DUPLICADO',
        mensaje: 'Posible duplicado detectado (alerta #42, par #10-#20): ...'
      })
    ).toBe(42);
    expect(
      extraerIdAlertaDeNotificacion({
        tipo: 'NUEVA_URGENTE',
        mensaje: 'Petición urgente alerta #42'
      })
    ).toBeNull();
  });
});
