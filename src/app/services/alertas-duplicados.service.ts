import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { BehaviorSubject, EMPTY, Observable, of, throwError } from 'rxjs';
import { catchError, expand, finalize, map, reduce, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';
import {
  AlertaDuplicadoDetalle,
  AlertaDuplicadoResumen,
  CodigoErrorDuplicados,
  DetectarDuplicadosRequest,
  DetectarDuplicadosResponse,
  ErrorDuplicadosApi,
  EstadoRevisionAlerta,
  FiltrosAlertasDuplicados,
  ListadoAlertasDuplicadosResponse,
  MetricasDuplicado,
  PeticionAlertasDuplicadosResponse,
  ResolverAlertaDuplicadoPayload,
  ResolverAlertaDuplicadoResponse,
  ResumenConteosAlertas,
  convertirSimilitudAPorcentaje,
  crearResumenAlertasVacio,
  extraerIdAlertaDeNotificacion,
  formatearDistanciaMetros,
  formatearPorcentajeSimilitud,
  formatearSimilitudImagen
} from '../models/duplicados.model';

const ESTADOS_ALERTA_VALIDOS: ReadonlySet<EstadoRevisionAlerta> = new Set([
  'PENDIENTE',
  'CONFIRMADO',
  'DESCARTADO'
]);

const MAX_PAGE_SIZE_BACKEND = 100;
const MAX_PAGINAS_INDICE = 50;
const MAX_LONGITUD_OBSERVACION = 2000;

const MENSAJES_HTTP_DEFECTO: Record<number, { codigo: CodigoErrorDuplicados; mensaje: string }> = {
  400: {
    codigo: 'VALIDATION_ERROR',
    mensaje: 'Los datos enviados para consultar o resolver alertas no son válidos.'
  },
  401: {
    codigo: 'UNAUTHORIZED',
    mensaje: 'Tu sesión expiró o no estás autenticado para consultar alertas.'
  },
  403: {
    codigo: 'FORBIDDEN',
    mensaje: 'Solo los roles Administrador y Jurídico tienen acceso a las alertas de duplicados.'
  },
  404: {
    codigo: 'NOT_FOUND',
    mensaje: 'La alerta o petición solicitada no fue encontrada.'
  },
  409: {
    codigo: 'CONFLICT',
    mensaje: 'La alerta ya fue resuelta previamente o presentó un conflicto de concurrencia.'
  },
  0: {
    codigo: 'NETWORK_ERROR',
    mensaje: 'No se pudo conectar con el servidor de Vetericano. Verifica tu conexión.'
  }
};

export interface ResultadoValidacionResolucion {
  valido: boolean;
  error?: string;
}

/**
 * Servicio centralizado para consultar, indexar y resolver alertas de posibles
 * peticiones duplicadas consumiendo exclusivamente los endpoints Django autorizados
 * para Administrador (`id_rol = 1`) y Jurídico (`id_rol = 2`).
 */
@Injectable({
  providedIn: 'root'
})
export class AlertasDuplicadosService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private readonly basePeticionesUrl = environment.apiUrlPeticiones.replace(/\/+$/, '');

  // Estado reactivo compartido entre futuras vistas (Signals + RxJS)
  private readonly resumenState = signal<ResumenConteosAlertas>(crearResumenAlertasVacio());
  private readonly resumenSubject = new BehaviorSubject<ResumenConteosAlertas>(crearResumenAlertasVacio());

  private readonly indiceState = signal<ReadonlyMap<number, AlertaDuplicadoResumen[]>>(new Map());
  private readonly indiceSubject = new BehaviorSubject<ReadonlyMap<number, AlertaDuplicadoResumen[]>>(new Map());

  private readonly cargandoIndiceState = signal<boolean>(false);
  private readonly errorActualState = signal<ErrorDuplicadosApi | null>(null);
  private readonly alertaDetalleActivaState = signal<AlertaDuplicadoDetalle | null>(null);

  private readonly alertasPorId = new Map<number, AlertaDuplicadoResumen>();
  private indiceCargado = false;
  private ultimoFiltroIndiceKey = '';

  // Deduplicación de solicitudes concurrentes en vuelo
  private indiceEnVuelo$: Observable<ReadonlyMap<number, AlertaDuplicadoResumen[]>> | null = null;
  private indiceEnVueloKey = '';
  private readonly listadosEnVuelo = new Map<string, Observable<ListadoAlertasDuplicadosResponse>>();
  private readonly alertasPeticionEnVuelo = new Map<string, Observable<PeticionAlertasDuplicadosResponse>>();
  private readonly detallesEnVuelo = new Map<number, Observable<AlertaDuplicadoDetalle>>();
  private readonly resolucionesEnVuelo = new Map<number, Observable<ResolverAlertaDuplicadoResponse>>();

  readonly resumen = this.resumenState.asReadonly();
  readonly resumen$ = this.resumenSubject.asObservable();
  readonly totalPendientes = computed(() => this.resumenState().PENDIENTE);

  readonly indicePorPeticion = this.indiceState.asReadonly();
  readonly indicePorPeticion$ = this.indiceSubject.asObservable();

  readonly cargandoIndice = this.cargandoIndiceState.asReadonly();
  readonly errorActual = this.errorActualState.asReadonly();
  readonly alertaDetalleActiva = this.alertaDetalleActivaState.asReadonly();

  /**
   * Verifica que la sesión activa corresponda exclusivamente a Administrador (1) o Jurídico (2).
   * Impide que Veterinario (3), Peticionario (4) y Super Administrador (5) disparen peticiones.
   */
  puedeGestionarAlertas(): boolean {
    if (!this.authService.isAuthenticated()) {
      return false;
    }
    if (this.authService.isSuperAdmin() || this.authService.isVeterinario()) {
      return false;
    }
    const sesion = this.authService.currentUser();
    const idRol = Number(sesion?.id_rol);
    if (!Number.isNaN(idRol) && idRol > 0) {
      return idRol === 1 || idRol === 2;
    }
    const rolTexto = String(this.authService.userRole() || '').toLowerCase();
    if (rolTexto.includes('peticionario')) {
      return false;
    }
    return this.authService.isAdmin() || this.authService.isJuridico();
  }

  /**
   * GET `/api/peticiones/duplicados/alertas/`
   * Lista alertas paginadas filtrando por `PENDIENTE`, `CONFIRMADO`, `DESCARTADO` o petición.
   */
  listarAlertas(filtros: FiltrosAlertasDuplicados = {}): Observable<ListadoAlertasDuplicadosResponse> {
    const errorAcceso = this.validarAccesoEndpoint();
    if (errorAcceso) {
      return throwError(() => errorAcceso);
    }

    const params = this.construirParamsAlertas(filtros, true);
    const cacheKey = params.toString();
    const enVuelo = this.listadosEnVuelo.get(cacheKey);
    if (enVuelo) {
      return enVuelo;
    }

    const url = `${this.basePeticionesUrl}/duplicados/alertas/`;
    const peticion$ = this.http.get<ListadoAlertasDuplicadosResponse>(url, { params }).pipe(
      map((resp) => this.normalizarListadoResponse(resp)),
      tap((resp) => {
        if (!filtros.id_peticion) {
          this.actualizarResumen(resp.resumen);
        }
        this.registrarAlertasEnMapa(resp.results);
        this.errorActualState.set(null);
      }),
      catchError((err) => this.manejarYPropagarError(err)),
      finalize(() => {
        this.listadosEnVuelo.delete(cacheKey);
      }),
      shareReplay(1)
    );

    this.listadosEnVuelo.set(cacheKey, peticion$);
    return peticion$;
  }

  /**
   * Carga todas las páginas necesarias de `/duplicados/alertas/` (`page_size = 100`) y construye
   * un índice en memoria por ambos IDs (`peticion_menor_id` y `peticion_mayor_id`) para evitar N+1.
   * Coalesce llamadas concurrentes y reutiliza el índice ya cargado salvo `forzarRecarga = true`.
   */
  cargarIndiceAlertas(
    filtros: Omit<FiltrosAlertasDuplicados, 'page' | 'id_peticion'> = {},
    forzarRecarga: boolean = false
  ): Observable<ReadonlyMap<number, AlertaDuplicadoResumen[]>> {
    const errorAcceso = this.validarAccesoEndpoint();
    if (errorAcceso) {
      return throwError(() => errorAcceso);
    }

    const pageSize = this.normalizarPageSize(filtros.page_size);
    const estadoNorm = this.normalizarEstadoFiltro(filtros.estado_revision);
    const soloPendientes = Boolean(filtros.solo_pendientes);
    const filtroKey = `${estadoNorm ?? 'ALL'}|${soloPendientes}|${pageSize}`;

    if (!forzarRecarga && this.indiceCargado && this.ultimoFiltroIndiceKey === filtroKey) {
      return of(this.indiceState());
    }

    if (this.indiceEnVuelo$ && this.indiceEnVueloKey === filtroKey) {
      return this.indiceEnVuelo$;
    }

    this.cargandoIndiceState.set(true);
    this.errorActualState.set(null);

    const url = `${this.basePeticionesUrl}/duplicados/alertas/`;
    const consultarPagina = (pagina: number): Observable<ListadoAlertasDuplicadosResponse> => {
      const params = this.construirParamsAlertas(
        {
          estado_revision: estadoNorm,
          solo_pendientes: soloPendientes,
          page: pagina,
          page_size: pageSize
        },
        false
      );
      return this.http.get<ListadoAlertasDuplicadosResponse>(url, { params }).pipe(
        map((resp) => this.normalizarListadoResponse(resp))
      );
    };

    const flujo$ = consultarPagina(1).pipe(
      expand((resp, index) => {
        const paginaActual = resp.page ?? index + 1;
        const tieneMasPorTotal = resp.total_pages !== undefined && paginaActual < resp.total_pages;
        const tieneSiguiente = Boolean(resp.next) || tieneMasPorTotal;
        if (!tieneSiguiente || paginaActual >= MAX_PAGINAS_INDICE) {
          return EMPTY;
        }
        return consultarPagina(paginaActual + 1);
      }),
      reduce(
        (acum, paginaResp) => ({
          alertas: acum.alertas.concat(paginaResp.results),
          resumen: paginaResp.resumen
        }),
        { alertas: [] as AlertaDuplicadoResumen[], resumen: crearResumenAlertasVacio() }
      ),
      map(({ alertas, resumen }) => {
        this.alertasPorId.clear();
        this.registrarAlertasEnMapa(alertas);
        const nuevoIndice = this.construirIndicePorPeticion(alertas);
        this.actualizarIndice(nuevoIndice);
        this.actualizarResumen(resumen);
        this.indiceCargado = true;
        this.ultimoFiltroIndiceKey = filtroKey;
        return nuevoIndice;
      }),
      catchError((err) => this.manejarYPropagarError(err)),
      finalize(() => {
        this.cargandoIndiceState.set(false);
        this.indiceEnVuelo$ = null;
        this.indiceEnVueloKey = '';
      }),
      shareReplay(1)
    );

    this.indiceEnVuelo$ = flujo$;
    this.indiceEnVueloKey = filtroKey;
    return flujo$;
  }

  /**
   * GET `/api/peticiones/duplicados/alertas/{id_alerta}/`
   * Consulta la comparación detallada lado a lado de una alerta.
   */
  obtenerDetalleAlerta(idAlerta: number): Observable<AlertaDuplicadoDetalle> {
    const errorAcceso = this.validarAccesoEndpoint();
    if (errorAcceso) {
      return throwError(() => errorAcceso);
    }

    const idValido = this.validarIdPositivo(idAlerta, 'id_alerta');
    if (!idValido) {
      return throwError(() =>
        this.crearErrorLocal(400, 'VALIDATION_ERROR', "El identificador 'id_alerta' debe ser un entero positivo.")
      );
    }

    const enVuelo = this.detallesEnVuelo.get(idValido);
    if (enVuelo) {
      return enVuelo;
    }

    const url = `${this.basePeticionesUrl}/duplicados/alertas/${idValido}/`;
    const peticion$ = this.http.get<AlertaDuplicadoDetalle>(url).pipe(
      tap((detalle) => {
        this.registrarAlertasEnMapa([detalle]);
        this.alertaDetalleActivaState.set(detalle);
        this.errorActualState.set(null);
      }),
      catchError((err) => this.manejarYPropagarError(err)),
      finalize(() => {
        this.detallesEnVuelo.delete(idValido);
      }),
      shareReplay(1)
    );

    this.detallesEnVuelo.set(idValido, peticion$);
    return peticion$;
  }

  /**
   * POST `/api/peticiones/duplicados/alertas/{id_alerta}/resolver/`
   * Resuelve manualmente una alerta como `CONFIRMADO` (exigiendo `peticion_principal` del par)
   * o `DESCARTADO` (prohibiendo `peticion_principal`). No altera estados ni asignaciones.
   */
  resolverAlerta(
    idAlerta: number,
    payload: ResolverAlertaDuplicadoPayload,
    opciones?: { idsPeticionesDelPar?: readonly [number, number] }
  ): Observable<ResolverAlertaDuplicadoResponse> {
    const errorAcceso = this.validarAccesoEndpoint();
    if (errorAcceso) {
      return throwError(() => errorAcceso);
    }

    const validacion = this.validarResolucionAlerta(idAlerta, payload, opciones?.idsPeticionesDelPar);
    if (!validacion.valido) {
      return throwError(() =>
        this.crearErrorLocal(400, 'VALIDATION_ERROR', validacion.error || 'Datos inválidos para resolver la alerta.')
      );
    }

    const enVuelo = this.resolucionesEnVuelo.get(idAlerta);
    if (enVuelo) {
      return enVuelo;
    }

    const body = this.construirPayloadResolucion(payload);
    const url = `${this.basePeticionesUrl}/duplicados/alertas/${idAlerta}/resolver/`;

    const peticion$ = this.http.post<ResolverAlertaDuplicadoResponse>(url, body).pipe(
      tap((resp) => {
        this.aplicarResolucionEnEstadoLocal(resp);
        this.errorActualState.set(null);
      }),
      catchError((err) => this.manejarYPropagarError(err)),
      finalize(() => {
        this.resolucionesEnVuelo.delete(idAlerta);
      }),
      shareReplay(1)
    );

    this.resolucionesEnVuelo.set(idAlerta, peticion$);
    return peticion$;
  }

  /**
   * GET `/api/peticiones/{id_peticion}/duplicados/`
   * Consulta directamente las alertas persistidas asociadas a una petición específica.
   */
  obtenerAlertasPorPeticion(
    idPeticion: number,
    filtros: Omit<FiltrosAlertasDuplicados, 'id_peticion'> = {}
  ): Observable<PeticionAlertasDuplicadosResponse> {
    const errorAcceso = this.validarAccesoEndpoint();
    if (errorAcceso) {
      return throwError(() => errorAcceso);
    }

    const idValido = this.validarIdPositivo(idPeticion, 'id_peticion');
    if (!idValido) {
      return throwError(() =>
        this.crearErrorLocal(400, 'VALIDATION_ERROR', "El identificador 'id_peticion' debe ser un entero positivo.")
      );
    }

    const params = this.construirParamsAlertas(filtros, false);
    const cacheKey = `${idValido}|${params.toString()}`;
    const enVuelo = this.alertasPeticionEnVuelo.get(cacheKey);
    if (enVuelo) {
      return enVuelo;
    }

    const url = `${this.basePeticionesUrl}/${idValido}/duplicados/`;
    const peticion$ = this.http.get<PeticionAlertasDuplicadosResponse>(url, { params }).pipe(
      map((resp) => ({
        ...this.normalizarListadoResponse(resp),
        id_peticion: resp?.id_peticion ?? idValido,
        numero_radicado: resp?.numero_radicado ?? null
      })),
      tap((resp) => {
        this.registrarAlertasEnMapa(resp.results);
        this.errorActualState.set(null);
      }),
      catchError((err) => this.manejarYPropagarError(err)),
      finalize(() => {
        this.alertasPeticionEnVuelo.delete(cacheKey);
      }),
      shareReplay(1)
    );

    this.alertasPeticionEnVuelo.set(cacheKey, peticion$);
    return peticion$;
  }

  /**
   * POST `/api/peticiones/detectar-duplicados/`
   * Ejecuta detección manual de candidatos sin almacenar alertas ni modificar el índice persistido.
   */
  detectarDuplicadosManual(payload: DetectarDuplicadosRequest): Observable<DetectarDuplicadosResponse> {
    const errorAcceso = this.validarAccesoEndpoint();
    if (errorAcceso) {
      return throwError(() => errorAcceso);
    }

    const errorPayload = this.validarSolicitudDeteccionManual(payload);
    if (errorPayload) {
      return throwError(() => errorPayload);
    }

    const url = `${this.basePeticionesUrl}/detectar-duplicados/`;
    const body = this.limpiarCamposUndefined(payload);

    return this.http.post<DetectarDuplicadosResponse>(url, body).pipe(
      map((resp) => ({
        ...resp,
        posibles_duplicados: Array.isArray(resp?.posibles_duplicados) ? resp.posibles_duplicados : []
      })),
      tap(() => {
        this.errorActualState.set(null);
      }),
      catchError((err) => this.manejarYPropagarError(err))
    );
  }

  /**
   * Valida reglas locales de resolución antes de invocar el backend:
   * - `CONFIRMADO` exige `peticion_principal` positivo perteneciente al par (si el par es conocido).
   * - `DESCARTADO` rechaza especificar `peticion_principal`.
   */
  validarResolucionAlerta(
    idAlerta: number,
    payload: ResolverAlertaDuplicadoPayload | null | undefined,
    idsPeticionesDelPar?: readonly [number, number]
  ): ResultadoValidacionResolucion {
    if (!this.validarIdPositivo(idAlerta, 'id_alerta')) {
      return { valido: false, error: "El identificador 'id_alerta' debe ser un entero positivo." };
    }
    if (!payload || typeof payload !== 'object') {
      return { valido: false, error: 'Debe proporcionar la decisión de revisión de la alerta.' };
    }

    const decision = String(payload.estado_revision || '').trim().toUpperCase();
    if (decision !== 'CONFIRMADO' && decision !== 'DESCARTADO') {
      return { valido: false, error: "La decisión 'estado_revision' debe ser CONFIRMADO o DESCARTADO." };
    }

    if (payload.observacion !== undefined && payload.observacion !== null) {
      if (typeof payload.observacion === 'string' && payload.observacion.trim().length > MAX_LONGITUD_OBSERVACION) {
        return {
          valido: false,
          error: `La observación no puede superar los ${MAX_LONGITUD_OBSERVACION} caracteres.`
        };
      }
    }

    if (decision === 'CONFIRMADO') {
      const principalRaw = (payload as { peticion_principal?: unknown }).peticion_principal;
      const principal = typeof principalRaw === 'number' ? principalRaw : Number(principalRaw);
      if (principalRaw === null || principalRaw === undefined || !Number.isInteger(principal) || principal <= 0) {
        return {
          valido: false,
          error: "Debe indicar una 'peticion_principal' válida perteneciente al par para confirmar la alerta como duplicado."
        };
      }

      const par = this.resolverParConocido(idAlerta, idsPeticionesDelPar);
      if (par && principal !== par[0] && principal !== par[1]) {
        return {
          valido: false,
          error: `La petición principal #${principal} no pertenece al par (#${par[0]}, #${par[1]}) de la alerta #${idAlerta}.`
        };
      }
      return { valido: true };
    }

    const principalDescartado = (payload as { peticion_principal?: unknown }).peticion_principal;
    if (principalDescartado !== undefined && principalDescartado !== null) {
      return {
        valido: false,
        error: "No debe especificar 'peticion_principal' cuando la decisión es DESCARTADO."
      };
    }

    return { valido: true };
  }

  /** Devuelve desde el índice en memoria todas las alertas asociadas a una petición (sin N+1). */
  obtenerAlertasDePeticionEnIndice(idPeticion: number): AlertaDuplicadoResumen[] {
    if (!this.puedeGestionarAlertas() || !Number.isInteger(idPeticion) || idPeticion <= 0) {
      return [];
    }
    return this.indiceState().get(idPeticion) ?? [];
  }

  /** Devuelve únicamente las alertas `PENDIENTE` asociadas en memoria a la petición indicada. */
  obtenerAlertasPendientesDePeticion(idPeticion: number): AlertaDuplicadoResumen[] {
    return this.obtenerAlertasDePeticionEnIndice(idPeticion).filter(
      (alerta) => alerta.estado_revision === 'PENDIENTE'
    );
  }

  /** Indica si la petición tiene al menos una alerta `PENDIENTE` registrada en el índice local. */
  tienePosibleDuplicadoPendiente(idPeticion: number): boolean {
    return this.obtenerAlertasPendientesDePeticion(idPeticion).length > 0;
  }

  /** Indica si la petición participa en al menos una alerta `CONFIRMADO` en el índice local. */
  tieneDuplicadoConfirmado(idPeticion: number): boolean {
    return this.obtenerAlertasDePeticionEnIndice(idPeticion).some(
      (alerta) => alerta.estado_revision === 'CONFIRMADO'
    );
  }

  /** Limpia estado reactivo e índice local (útil al cerrar sesión o cambiar de usuario). */
  limpiarEstado(): void {
    this.alertasPorId.clear();
    this.indiceCargado = false;
    this.ultimoFiltroIndiceKey = '';
    this.actualizarIndice(new Map());
    this.actualizarResumen(crearResumenAlertasVacio());
    this.alertaDetalleActivaState.set(null);
    this.errorActualState.set(null);
  }

  // Helpers de presentación delegados (nunca mutan los valores 0–1 originales)
  convertirSimilitudAPorcentaje(valor: number | null | undefined, decimales: number = 1): number | null {
    return convertirSimilitudAPorcentaje(valor, decimales);
  }

  formatearPorcentajeSimilitud(
    valor: number | null | undefined,
    decimales: number = 1,
    fallback: string = 'No disponible'
  ): string {
    return formatearPorcentajeSimilitud(valor, decimales, fallback);
  }

  formatearDistanciaMetros(distancia: number | null | undefined, fallback: string = 'Sin GPS'): string {
    return formatearDistanciaMetros(distancia, fallback);
  }

  formatearSimilitudImagen(
    metrica: Pick<MetricasDuplicado, 'similitud_imagen' | 'distancia_hamming'> | null | undefined,
    fallback: string = 'Sin comparación visual'
  ): string {
    return formatearSimilitudImagen(metrica, fallback);
  }

  extraerIdAlertaDeNotificacion(
    notificacion: { tipo?: string | null; mensaje?: string | null } | null | undefined
  ): number | null {
    return extraerIdAlertaDeNotificacion(notificacion);
  }

  private validarAccesoEndpoint(): ErrorDuplicadosApi | null {
    if (!this.authService.isAuthenticated()) {
      const error = this.crearErrorLocal(
        401,
        'UNAUTHORIZED',
        MENSAJES_HTTP_DEFECTO[401].mensaje
      );
      this.errorActualState.set(error);
      return error;
    }
    if (!this.puedeGestionarAlertas()) {
      const error = this.crearErrorLocal(
        403,
        'FORBIDDEN',
        MENSAJES_HTTP_DEFECTO[403].mensaje
      );
      this.errorActualState.set(error);
      return error;
    }
    return null;
  }

  private validarIdPositivo(valor: number, _campo: string): number | null {
    return Number.isInteger(valor) && valor > 0 ? valor : null;
  }

  private validarSolicitudDeteccionManual(payload: DetectarDuplicadosRequest | null | undefined): ErrorDuplicadosApi | null {
    if (!payload || typeof payload !== 'object') {
      return this.crearErrorLocal(
        400,
        'VALIDATION_ERROR',
        "Debe enviar 'descripcion', coordenadas GPS ('latitud'/'longitud'), fotografías o 'id_peticion'."
      );
    }
    const tieneDescripcion = payload.descripcion !== undefined;
    const tieneId = payload.id_peticion != null || payload.excluir_id_peticion != null;
    const tieneCoords = payload.latitud !== undefined || payload.longitud !== undefined;
    const tieneFotos = payload.foto !== undefined || payload.fotos !== undefined;

    if (!tieneDescripcion && !tieneId && !tieneCoords && !tieneFotos) {
      return this.crearErrorLocal(
        400,
        'VALIDATION_ERROR',
        "Debe enviar 'descripcion', coordenadas GPS ('latitud'/'longitud'), fotografías o 'id_peticion'."
      );
    }
    return null;
  }

  private resolverParConocido(
    idAlerta: number,
    idsPeticionesDelPar?: readonly [number, number]
  ): readonly [number, number] | null {
    if (idsPeticionesDelPar) {
      return idsPeticionesDelPar;
    }
    const cacheada = this.alertasPorId.get(idAlerta) ?? this.alertaDetalleActivaState();
    if (cacheada && cacheada.id_alerta === idAlerta) {
      return [cacheada.peticion_menor_id, cacheada.peticion_mayor_id];
    }
    return null;
  }

  private construirPayloadResolucion(payload: ResolverAlertaDuplicadoPayload): Record<string, unknown> {
    const decision = String(payload.estado_revision).trim().toUpperCase();
    const obsRaw = payload.observacion;
    const observacion =
      typeof obsRaw === 'string' ? obsRaw.trim() || null : obsRaw === null ? null : undefined;

    const body: Record<string, unknown> = { estado_revision: decision };
    if (decision === 'CONFIRMADO') {
      body['peticion_principal'] = Number((payload as { peticion_principal: number }).peticion_principal);
    }
    if (observacion !== undefined) {
      body['observacion'] = observacion;
    }
    return body;
  }

  private construirParamsAlertas(
    filtros: FiltrosAlertasDuplicados,
    incluirFiltroPeticion: boolean
  ): HttpParams {
    let params = new HttpParams();

    const estado = this.normalizarEstadoFiltro(filtros.estado_revision);
    if (estado) {
      params = params.set('estado_revision', estado);
    }
    if (filtros.solo_pendientes === true) {
      params = params.set('solo_pendientes', 'true');
    }
    if (incluirFiltroPeticion && filtros.id_peticion != null && Number.isInteger(filtros.id_peticion) && filtros.id_peticion > 0) {
      params = params.set('id_peticion', String(filtros.id_peticion));
    }
    if (filtros.page !== undefined && Number.isInteger(filtros.page) && filtros.page > 0) {
      params = params.set('page', String(filtros.page));
    }
    if (filtros.page_size !== undefined && Number.isInteger(filtros.page_size) && filtros.page_size > 0) {
      params = params.set('page_size', String(this.normalizarPageSize(filtros.page_size)));
    }
    return params;
  }

  private normalizarEstadoFiltro(estado: EstadoRevisionAlerta | string | null | undefined): EstadoRevisionAlerta | undefined {
    if (!estado) {
      return undefined;
    }
    const normalizado = String(estado).trim().toUpperCase() as EstadoRevisionAlerta;
    return ESTADOS_ALERTA_VALIDOS.has(normalizado) ? normalizado : undefined;
  }

  private normalizarPageSize(pageSize?: number): number {
    if (pageSize === undefined || !Number.isInteger(pageSize) || pageSize <= 0) {
      return MAX_PAGE_SIZE_BACKEND;
    }
    return Math.min(pageSize, MAX_PAGE_SIZE_BACKEND);
  }

  private normalizarListadoResponse(resp: ListadoAlertasDuplicadosResponse | null | undefined): ListadoAlertasDuplicadosResponse {
    const results = Array.isArray(resp?.results) ? resp.results : [];
    const baseResumen = crearResumenAlertasVacio();
    const resumen: ResumenConteosAlertas = {
      PENDIENTE: Number(resp?.resumen?.PENDIENTE ?? baseResumen.PENDIENTE),
      CONFIRMADO: Number(resp?.resumen?.CONFIRMADO ?? baseResumen.CONFIRMADO),
      DESCARTADO: Number(resp?.resumen?.DESCARTADO ?? baseResumen.DESCARTADO),
      total: Number(resp?.resumen?.total ?? baseResumen.total)
    };
    return {
      count: Number(resp?.count ?? results.length),
      next: resp?.next ?? null,
      previous: resp?.previous ?? null,
      page: resp?.page,
      page_size: resp?.page_size,
      total_pages: resp?.total_pages,
      resumen,
      results
    };
  }

  private registrarAlertasEnMapa(alertas: AlertaDuplicadoResumen[]): void {
    for (const alerta of alertas) {
      if (alerta && typeof alerta.id_alerta === 'number') {
        this.alertasPorId.set(alerta.id_alerta, alerta);
      }
    }
  }

  private construirIndicePorPeticion(alertas: AlertaDuplicadoResumen[]): Map<number, AlertaDuplicadoResumen[]> {
    const mapa = new Map<number, AlertaDuplicadoResumen[]>();

    const anexar = (idPeticion: number, alerta: AlertaDuplicadoResumen) => {
      if (!Number.isInteger(idPeticion) || idPeticion <= 0) {
        return;
      }
      const existentes = mapa.get(idPeticion);
      if (!existentes) {
        mapa.set(idPeticion, [alerta]);
        return;
      }
      if (!existentes.some((item) => item.id_alerta === alerta.id_alerta)) {
        existentes.push(alerta);
      }
    };

    for (const alerta of alertas) {
      anexar(alerta.peticion_menor_id, alerta);
      anexar(alerta.peticion_mayor_id, alerta);
    }
    return mapa;
  }

  private aplicarResolucionEnEstadoLocal(resp: ResolverAlertaDuplicadoResponse): void {
    const alertaActualizada = resp?.alerta;
    if (!alertaActualizada) {
      return;
    }

    this.alertasPorId.set(alertaActualizada.id_alerta, alertaActualizada);
    this.alertaDetalleActivaState.set(alertaActualizada);

    const indiceActual = this.indiceState();
    const siguienteIndice = new Map<number, AlertaDuplicadoResumen[]>(indiceActual);

    const actualizarEntrada = (idPeticion: number) => {
      const lista = siguienteIndice.get(idPeticion);
      if (!lista) {
        siguienteIndice.set(idPeticion, [alertaActualizada]);
        return;
      }
      const existe = lista.some((item) => item.id_alerta === alertaActualizada.id_alerta);
      const nuevaLista = existe
        ? lista.map((item) => (item.id_alerta === alertaActualizada.id_alerta ? alertaActualizada : item))
        : [alertaActualizada, ...lista];
      siguienteIndice.set(idPeticion, nuevaLista);
    };

    actualizarEntrada(alertaActualizada.peticion_menor_id);
    actualizarEntrada(alertaActualizada.peticion_mayor_id);
    this.actualizarIndice(siguienteIndice);

    if (resp.cambiada && resp.estado_anterior !== resp.estado_nuevo) {
      const actual = { ...this.resumenState() };
      if (actual[resp.estado_anterior] > 0) {
        actual[resp.estado_anterior] -= 1;
      }
      actual[resp.estado_nuevo] = (actual[resp.estado_nuevo] ?? 0) + 1;
      actual.total = actual.PENDIENTE + actual.CONFIRMADO + actual.DESCARTADO;
      this.actualizarResumen(actual);
    }
  }

  private actualizarResumen(resumen: ResumenConteosAlertas): void {
    this.resumenState.set(resumen);
    this.resumenSubject.next(resumen);
  }

  private actualizarIndice(indice: Map<number, AlertaDuplicadoResumen[]>): void {
    this.indiceState.set(indice);
    this.indiceSubject.next(indice);
  }

  private limpiarCamposUndefined<T extends object>(obj: T): Record<string, unknown> {
    const limpio: Record<string, unknown> = {};
    for (const [clave, valor] of Object.entries(obj)) {
      if (valor !== undefined) {
        limpio[clave] = valor;
      }
    }
    return limpio;
  }

  private manejarYPropagarError(err: unknown): Observable<never> {
    const normalizado = this.normalizarErrorHttp(err);
    this.errorActualState.set(normalizado);
    return throwError(() => normalizado);
  }

  private crearErrorLocal(status: number, codigo: CodigoErrorDuplicados, mensaje: string): ErrorDuplicadosApi {
    return { status, codigo, mensaje };
  }

  private normalizarErrorHttp(err: unknown): ErrorDuplicadosApi {
    if (err instanceof HttpErrorResponse) {
      const defecto = MENSAJES_HTTP_DEFECTO[err.status] ?? {
        codigo: 'UNKNOWN' as CodigoErrorDuplicados,
        mensaje: 'Ocurrió un error inesperado al comunicarse con el módulo de duplicados.'
      };

      const { mensajeExtraido, erroresCampo } = this.extraerDetalleErrorBody(err.error);
      return {
        status: err.status,
        codigo: defecto.codigo,
        mensaje: mensajeExtraido || defecto.mensaje,
        erroresCampo,
        original: err
      };
    }

    if (err && typeof err === 'object' && 'status' in err && 'codigo' in err && 'mensaje' in err) {
      return err as ErrorDuplicadosApi;
    }

    return {
      status: 0,
      codigo: 'UNKNOWN',
      mensaje: 'Error inesperado al procesar la operación de duplicados.',
      original: err
    };
  }

  private extraerDetalleErrorBody(body: unknown): {
    mensajeExtraido?: string;
    erroresCampo?: Record<string, string[]>;
  } {
    if (!body) {
      return {};
    }
    if (typeof body === 'string') {
      const limpio = body.trim();
      return limpio ? { mensajeExtraido: limpio } : {};
    }
    if (typeof body !== 'object') {
      return {};
    }

    const registro = body as Record<string, unknown>;
    for (const claveDirecta of ['error', 'detail', 'mensaje', 'message']) {
      const valor = registro[claveDirecta];
      if (typeof valor === 'string' && valor.trim()) {
        return { mensajeExtraido: valor.trim() };
      }
    }

    const erroresCampo: Record<string, string[]> = {};
    const mensajesAcumulados: string[] = [];

    for (const [campo, valor] of Object.entries(registro)) {
      if (Array.isArray(valor)) {
        const textos = valor.map((item) => String(item).trim()).filter(Boolean);
        if (textos.length > 0) {
          erroresCampo[campo] = textos;
          mensajesAcumulados.push(textos.join(' '));
        }
      } else if (typeof valor === 'string' && valor.trim()) {
        erroresCampo[campo] = [valor.trim()];
        mensajesAcumulados.push(valor.trim());
      }
    }

    return {
      mensajeExtraido: mensajesAcumulados.length > 0 ? mensajesAcumulados.join(' | ') : undefined,
      erroresCampo: Object.keys(erroresCampo).length > 0 ? erroresCampo : undefined
    };
  }
}
