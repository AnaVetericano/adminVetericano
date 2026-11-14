import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  AlertaDuplicadoDetalle,
  DecisionResolucionAlerta,
  ErrorDuplicadosApi,
  EstadoRevisionAlerta,
  MetricasDuplicado,
  PeticionAlertaDetalle,
  ResolverAlertaDuplicadoPayload,
  ResolverAlertaDuplicadoResponse,
  UsuarioAlerta
} from '../../models/duplicados.model';
import { AlertasDuplicadosService } from '../../services/alertas-duplicados.service';

export type TipoMediaEvidencia = 'imagen' | 'video' | 'archivo';

export interface MediaEvidenciaVM {
  url: string;
  tipo: TipoMediaEvidencia;
  descripcion: string | null;
  esPrincipal: boolean;
}

export interface PeticionComparadaVM {
  lado: 'menor' | 'mayor';
  etiquetaLado: string;
  idPeticion: number | null;
  radicado: string;
  tipo: string;
  estado: string;
  estadoClase: string;
  prioridad: string;
  prioridadClase: string;
  descripcion: string;
  direccion: string;
  coordenadasTexto: string;
  mapaUrl: string | null;
  veterinarioNombre: string;
  veterinarioDetalle: string | null;
  fechaReporte: string;
  esOrigen: boolean;
  esPrincipalGuardada: boolean;
  multimedia: MediaEvidenciaVM[];
  totalFotos: number;
  totalVideos: number;
}

export interface CriterioChipVM {
  clave: string;
  etiqueta: string;
}

const TEXTOS_NO_DISPONIBLE = 'No disponible';
const MAX_OBSERVACION_LEN = 2000;

const ETIQUETAS_CRITERIOS = new Map<string, string>([
  ['texto', 'Similitud de texto'],
  ['gps', 'Proximidad GPS'],
  ['imagen', 'Similitud visual (dHash)']
]);

const EXTENSIONES_VIDEO_REGEX = /\.(mp4|webm|mov|m4v|avi|mkv|ogv|3gp)$/i;
const EXTENSIONES_IMAGEN_REGEX = /\.(jpg|jpeg|png|webp|gif|bmp|avif|svg|heic|heif)$/i;
const EXTENSIONES_ARCHIVO_REGEX = /\.(pdf|doc|docx|xls|xlsx|txt|csv|zip|rar)$/i;

/**
 * Componente standalone reutilizable para comparar visualmente dos peticiones asociadas
 * a una alerta de posible duplicado y permitir su resolución (`CONFIRMADO` / `DESCARTADO`)
 * exclusivamente por roles Administrador (1) y Jurídico (2).
 */
@Component({
  selector: 'app-alerta-duplicado-comparacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alerta-duplicado-comparacion.html',
  styleUrl: './alerta-duplicado-comparacion.css'
})
export class AlertaDuplicadoComparacionComponent implements OnInit, OnDestroy {
  private readonly alertasService = inject(AlertasDuplicadosService);
  private readonly cdr = inject(ChangeDetectorRef);

  private _idAlerta: number | null = null;
  private idAlertaCrudo: unknown = null;
  private inicializado = false;

  private detalleSub: Subscription | null = null;
  private resolucionSub: Subscription | null = null;

  /** Presenta el componente dentro de un overlay modal (`true`) o integrado en flujo normal (`false`). */
  @Input() modoModal: boolean = true;

  /** Permite que el componente contenedor coordine la tecla Escape entre múltiples modales apilados. */
  @Input() manejarEscapeExterno: boolean = false;

  /** Identificador numérico de la alerta persistida en `peticion_posible_duplicado`. */
  @Input()
  set idAlerta(valor: number | null | undefined) {
    const crudoAnterior = this.idAlertaCrudo;
    this.idAlertaCrudo = valor;
    const numero = Number(valor);
    const normalizado =
      valor !== null && valor !== undefined && Number.isInteger(numero) && numero > 0 ? numero : null;
    const cambio = normalizado !== this._idAlerta || (normalizado === null && valor !== crudoAnterior);
    this._idAlerta = normalizado;

    if (this.inicializado && cambio) {
      this.cargarDetalle();
    }
  }
  get idAlerta(): number | null {
    return this._idAlerta;
  }

  /** Solicita cerrar la vista/modal de comparación. */
  @Output() cerrar = new EventEmitter<void>();

  /** Notifica al contenedor cuando la alerta se resolvió con éxito (`CONFIRMADO` o `DESCARTADO`). */
  @Output() alertaResuelta = new EventEmitter<ResolverAlertaDuplicadoResponse>();

  // Estado principal de detalle
  cargando = false;
  resolviendo = false;
  sinPermiso = false;

  detalle: AlertaDuplicadoDetalle | null = null;
  columnasComparacion: PeticionComparadaVM[] = [];
  criteriosChips: CriterioChipVM[] = [];

  errorCarga: string | null = null;
  errorValidacion: string | null = null;
  errorResolucion: string | null = null;
  mensajeConflicto409: string | null = null;
  mensajeExito: string | null = null;

  // Formulario de resolución
  decisionSeleccionada: DecisionResolucionAlerta | null = null;
  peticionPrincipalSeleccionada: number | null = null;
  observacion = '';
  readonly maxObservacion = MAX_OBSERVACION_LEN;

  // Visor lightbox multimedia y tracking de medios que fallen al cargar
  mediaActiva: MediaEvidenciaVM | null = null;
  private readonly urlsMediaConError = new Set<string>();

  ngOnInit(): void {
    this.inicializado = true;
    this.cargarDetalle();
  }

  ngOnDestroy(): void {
    this.cancelarSuscripciones();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.manejarEscapeExterno) {
      return;
    }
    if (this.mediaActiva) {
      this.cerrarVisorMedia();
      return;
    }
    if (this.modoModal && !this.resolviendo) {
      this.solicitarCerrar();
    }
  }

  get tieneVisorMediaAbierto(): boolean {
    return this.mediaActiva !== null;
  }

  get esSoloLectura(): boolean {
    return this.detalle !== null && this.detalle.estado_revision !== 'PENDIENTE';
  }

  get puedeEditarResolucion(): boolean {
    return !this.sinPermiso && this.detalle !== null && this.detalle.estado_revision === 'PENDIENTE';
  }

  /** Vuelve a consultar `GET /api/peticiones/duplicados/alertas/{id_alerta}/`. */
  recargarDetalle(preservarConflicto: boolean = false): void {
    this.cargarDetalle(preservarConflicto);
  }

  /** Selecciona la decisión (`CONFIRMADO` o `DESCARTADO`) aplicando reglas de `peticion_principal`. */
  seleccionarDecision(decision: DecisionResolucionAlerta): void {
    if (!this.puedeEditarResolucion || this.resolviendo) {
      return;
    }
    this.decisionSeleccionada = decision;
    this.errorValidacion = null;
    this.errorResolucion = null;

    if (decision === 'DESCARTADO') {
      this.peticionPrincipalSeleccionada = null;
    }
    this.cdr.markForCheck();
  }

  /** Selecciona una de las dos peticiones comparadas como `peticion_principal` (solo al confirmar). */
  seleccionarPeticionPrincipal(idPeticion: number | null): void {
    if (!this.puedeEditarResolucion || this.resolviendo || !idPeticion) {
      return;
    }
    if (!this.esPeticionDelPar(idPeticion)) {
      return;
    }
    if (this.decisionSeleccionada !== 'CONFIRMADO') {
      this.decisionSeleccionada = 'CONFIRMADO';
    }
    this.peticionPrincipalSeleccionada = idPeticion;
    this.errorValidacion = null;
    this.errorResolucion = null;
    this.cdr.markForCheck();
  }

  /** Envía `POST /api/peticiones/duplicados/alertas/{id_alerta}/resolver/` evitando doble envío y manejando HTTP 409. */
  confirmarResolucion(): void {
    if (this.resolviendo || !this.puedeEditarResolucion || !this.detalle) {
      return;
    }

    if (!this.alertasService.puedeGestionarAlertas()) {
      this.sinPermiso = true;
      this.errorResolucion = 'Solo Administrador y Jurídico tienen permiso para resolver alertas.';
      return;
    }

    this.errorValidacion = null;
    this.errorResolucion = null;
    this.mensajeConflicto409 = null;
    this.mensajeExito = null;

    if (!this.decisionSeleccionada) {
      this.errorValidacion = 'Selecciona si deseas confirmar el duplicado o descartar la alerta.';
      return;
    }

    const obsLimpia = this.observacion.trim();
    if (obsLimpia.length > MAX_OBSERVACION_LEN) {
      this.errorValidacion = `La observación no puede superar los ${MAX_OBSERVACION_LEN} caracteres.`;
      return;
    }

    let payload: ResolverAlertaDuplicadoPayload;
    if (this.decisionSeleccionada === 'CONFIRMADO') {
      if (this.peticionPrincipalSeleccionada === null) {
        this.errorValidacion =
          'Debes elegir cuál de las dos peticiones quedará registrada como petición principal antes de confirmar.';
        return;
      }
      payload = {
        estado_revision: 'CONFIRMADO',
        peticion_principal: this.peticionPrincipalSeleccionada,
        observacion: obsLimpia || null
      };
    } else {
      // Al descartar nunca se envía peticion_principal
      payload = {
        estado_revision: 'DESCARTADO',
        observacion: obsLimpia || null
      };
    }

    const parIds: readonly [number, number] = [
      this.detalle.peticion_menor_id,
      this.detalle.peticion_mayor_id
    ];

    const validacion = this.alertasService.validarResolucionAlerta(
      this.detalle.id_alerta,
      payload,
      parIds
    );
    if (!validacion.valido) {
      this.errorValidacion = validacion.error || 'Los datos de resolución no son válidos.';
      return;
    }

    this.resolviendo = true;
    this.resolucionSub?.unsubscribe();

    const idObjetivo = this.detalle.id_alerta;
    this.resolucionSub = this.alertasService
      .resolverAlerta(idObjetivo, payload, { idsPeticionesDelPar: parIds })
      .subscribe({
        next: (resp) => {
          this.resolviendo = false;
          this.mensajeExito = resp.mensaje || 'Resolución registrada correctamente.';
          this.aplicarDetalle(resp.alerta);
          this.alertaResuelta.emit(resp);
          this.cdr.markForCheck();
        },
        error: (err: ErrorDuplicadosApi) => {
          this.resolviendo = false;
          if (err?.status === 409) {
            this.manejarConflicto409(err);
          } else {
            this.errorResolucion =
              err?.mensaje || 'No fue posible registrar la resolución de la alerta.';
          }
          this.cdr.markForCheck();
        }
      });
  }

  solicitarCerrar(): void {
    if (this.resolviendo) {
      return;
    }
    this.cerrar.emit();
  }

  onBackdropClick(): void {
    if (this.modoModal && !this.resolviendo) {
      this.solicitarCerrar();
    }
  }

  abrirVisorMedia(item: MediaEvidenciaVM): void {
    this.mediaActiva = item;
    this.cdr.markForCheck();
  }

  cerrarVisorMedia(): void {
    this.mediaActiva = null;
    this.cdr.markForCheck();
  }

  marcarMediaConError(url: string): void {
    if (url) {
      this.urlsMediaConError.add(url);
      this.cdr.markForCheck();
    }
  }

  mediaTuvoError(url: string): boolean {
    return this.urlsMediaConError.has(url);
  }

  formatearSimilitudTexto(detalle: AlertaDuplicadoDetalle): string {
    const metricas = this.obtenerMetricas(detalle);
    return this.alertasService.formatearPorcentajeSimilitud(
      metricas.similitud_texto,
      1,
      TEXTOS_NO_DISPONIBLE
    );
  }

  formatearScoreCombinado(detalle: AlertaDuplicadoDetalle): string {
    const metricas = this.obtenerMetricas(detalle);
    return this.alertasService.formatearPorcentajeSimilitud(
      metricas.score_combinado,
      1,
      TEXTOS_NO_DISPONIBLE
    );
  }

  formatearDistanciaGpsMetros(detalle: AlertaDuplicadoDetalle): string {
    const metricas = this.obtenerMetricas(detalle);
    if (metricas.distancia_metros === null || metricas.distancia_metros === undefined) {
      return TEXTOS_NO_DISPONIBLE;
    }
    const metros = Number(metricas.distancia_metros);
    if (!Number.isFinite(metros) || metros < 0) {
      return TEXTOS_NO_DISPONIBLE;
    }
    if (metros >= 1000) {
      return `${Math.round(metros)} m (${(metros / 1000).toFixed(2)} km)`;
    }
    return `${Math.round(metros * 10) / 10} m`;
  }

  tieneSimilitudImagen(detalle: AlertaDuplicadoDetalle): boolean {
    const metricas = this.obtenerMetricas(detalle);
    return metricas.similitud_imagen !== null && metricas.similitud_imagen !== undefined;
  }

  formatearSimilitudImagenMetrica(detalle: AlertaDuplicadoDetalle): string {
    const metricas = this.obtenerMetricas(detalle);
    return this.alertasService.formatearSimilitudImagen(metricas, TEXTOS_NO_DISPONIBLE);
  }

  formatearDiferenciaTiempo(detalle: AlertaDuplicadoDetalle): string {
    const horas = detalle.comparacion?.diferencia_tiempo_horas;
    if (horas === null || horas === undefined || !Number.isFinite(Number(horas))) {
      return TEXTOS_NO_DISPONIBLE;
    }
    const valor = Number(horas);
    if (valor < 1) {
      return `${Math.round(valor * 60)} min`;
    }
    return `${valor.toFixed(1)} h`;
  }

  formatearUsuario(usuario: UsuarioAlerta | null | undefined): string {
    if (!usuario) {
      return TEXTOS_NO_DISPONIBLE;
    }
    const nombre = (usuario.nombre_completo || `${usuario.nombre || ''} ${usuario.apellido || ''}`).trim();
    return nombre || usuario.email?.trim() || TEXTOS_NO_DISPONIBLE;
  }

  formatearFechaLegible(valor: string | null | undefined): string {
    if (!valor || !String(valor).trim()) {
      return TEXTOS_NO_DISPONIBLE;
    }
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) {
      return String(valor);
    }
    return fecha.toLocaleString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  radicadoDePeticionId(idPeticion: number | null | undefined): string {
    if (!idPeticion || !this.detalle) {
      return TEXTOS_NO_DISPONIBLE;
    }
    const col = this.columnasComparacion.find((c) => c.idPeticion === idPeticion);
    if (col && col.radicado !== TEXTOS_NO_DISPONIBLE) {
      return `${col.radicado} (#${idPeticion})`;
    }
    return `#${idPeticion}`;
  }

  claseEstadoRevision(estado: EstadoRevisionAlerta): string {
    switch (estado) {
      case 'PENDIENTE':
        return 'badge-status-warning';
      case 'CONFIRMADO':
        return 'badge-status-success';
      case 'DESCARTADO':
        return 'badge-status-neutral';
      default:
        return 'badge-status-neutral';
    }
  }

  etiquetaEstadoRevision(estado: EstadoRevisionAlerta): string {
    switch (estado) {
      case 'PENDIENTE':
        return 'Pendiente de revisión';
      case 'CONFIRMADO':
        return 'Duplicado confirmado';
      case 'DESCARTADO':
        return 'Descartado (no duplicado)';
      default:
        return estado;
    }
  }

  private cargarDetalle(preservarConflicto: boolean = false): void {
    this.detalleSub?.unsubscribe();
    this.urlsMediaConError.clear();
    this.mediaActiva = null;
    this.errorValidacion = null;
    this.errorResolucion = null;

    if (!preservarConflicto) {
      this.mensajeConflicto409 = null;
      this.mensajeExito = null;
    }

    if (!this.alertasService.puedeGestionarAlertas()) {
      this.sinPermiso = true;
      this.cargando = false;
      this.detalle = null;
      this.columnasComparacion = [];
      this.criteriosChips = [];
      this.errorCarga =
        'Acceso restringido: solo los roles Administrador y Jurídico pueden ver o resolver alertas de duplicados.';
      this.cdr.markForCheck();
      return;
    }

    this.sinPermiso = false;

    if (this._idAlerta === null) {
      this.cargando = false;
      this.detalle = null;
      this.columnasComparacion = [];
      this.criteriosChips = [];
      const hayValorInvalido = this.idAlertaCrudo !== null && this.idAlertaCrudo !== undefined && this.idAlertaCrudo !== '';
      this.errorCarga = hayValorInvalido
        ? 'El identificador de la alerta no es válido.'
        : 'No se ha seleccionado ninguna alerta para comparar.';
      this.cdr.markForCheck();
      return;
    }

    this.cargando = true;
    this.errorCarga = null;

    this.detalleSub = this.alertasService.obtenerDetalleAlerta(this._idAlerta).subscribe({
      next: (detalle) => {
        this.cargando = false;
        this.aplicarDetalle(detalle, preservarConflicto);
        this.cdr.markForCheck();
      },
      error: (err: ErrorDuplicadosApi) => {
        this.cargando = false;
        if (!preservarConflicto) {
          this.detalle = null;
          this.columnasComparacion = [];
          this.criteriosChips = [];
        }
        if (err?.status === 401 || err?.status === 403) {
          this.sinPermiso = true;
        }
        this.errorCarga = err?.mensaje || 'No se pudo cargar el detalle comparativo de la alerta.';
        this.cdr.markForCheck();
      }
    });
  }

  private manejarConflicto409(err: ErrorDuplicadosApi): void {
    const detalleServidor = err?.mensaje?.trim();
    this.mensajeConflicto409 = detalleServidor
      ? `Otra persona ya resolvió esta alerta o cambió su estado (${detalleServidor}). Se recargó la información actualizada.`
      : 'Otra persona ya resolvió esta alerta o cambió su estado. Se recargó la información actualizada.';

    this.decisionSeleccionada = null;
    this.peticionPrincipalSeleccionada = null;
    this.recargarDetalle(true);
  }

  private aplicarDetalle(detalle: AlertaDuplicadoDetalle, preservarFormularioSiPendiente: boolean = false): void {
    this.detalle = detalle;
    this.columnasComparacion = [
      this.construirPeticionVM('menor', detalle.peticion_menor, detalle.peticion_menor_id, detalle),
      this.construirPeticionVM('mayor', detalle.peticion_mayor, detalle.peticion_mayor_id, detalle)
    ];
    this.criteriosChips = this.construirCriterios(this.obtenerMetricas(detalle).criterios_coincidencia);

    if (detalle.estado_revision !== 'PENDIENTE') {
      this.decisionSeleccionada = detalle.estado_revision;
      this.peticionPrincipalSeleccionada =
        detalle.estado_revision === 'CONFIRMADO' ? detalle.peticion_principal_id : null;
      this.observacion = detalle.observacion_revision ?? '';
    } else if (!preservarFormularioSiPendiente) {
      this.decisionSeleccionada = null;
      this.peticionPrincipalSeleccionada = null;
      this.observacion = '';
    }
  }

  private construirPeticionVM(
    lado: 'menor' | 'mayor',
    peticion: PeticionAlertaDetalle | null | undefined,
    idFallback: number,
    alerta: AlertaDuplicadoDetalle
  ): PeticionComparadaVM {
    const idPeticion = peticion?.id_peticion ?? (Number.isInteger(idFallback) && idFallback > 0 ? idFallback : null);
    const radicado = peticion?.numero_radicado?.trim() || peticion?.codigo?.trim() || TEXTOS_NO_DISPONIBLE;
    const tipo = peticion?.tipo?.nombre?.trim() || TEXTOS_NO_DISPONIBLE;
    const estado = peticion?.estado?.nombre?.trim() || TEXTOS_NO_DISPONIBLE;
    const prioridad = peticion?.prioridad?.trim() || TEXTOS_NO_DISPONIBLE;
    const descripcion = peticion?.descripcion?.trim() || TEXTOS_NO_DISPONIBLE;
    const direccion = peticion?.ubicacion?.direccion?.trim() || TEXTOS_NO_DISPONIBLE;

    const lat = peticion?.ubicacion?.latitud;
    const lng = peticion?.ubicacion?.longitud;
    const tieneCoordsValidas =
      lat !== null &&
      lat !== undefined &&
      lng !== null &&
      lng !== undefined &&
      Number.isFinite(Number(lat)) &&
      Number.isFinite(Number(lng)) &&
      Math.abs(Number(lat)) <= 90 &&
      Math.abs(Number(lng)) <= 180;

    const coordenadasTexto = tieneCoordsValidas
      ? `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`
      : TEXTOS_NO_DISPONIBLE;
    const mapaUrl = tieneCoordsValidas
      ? `https://www.google.com/maps?q=${Number(lat)},${Number(lng)}`
      : null;

    const asignacion = peticion?.asignacion;
    const vetAsignado = asignacion?.asignada && asignacion.asignado_a
      ? this.formatearUsuario(asignacion.asignado_a)
      : TEXTOS_NO_DISPONIBLE;

    let veterinarioDetalle: string | null = null;
    if (asignacion?.asignada && asignacion.asignado_a) {
      const partes: string[] = [];
      if (asignacion.asignado_a.matricula_profesional?.trim()) {
        partes.push(`TP: ${asignacion.asignado_a.matricula_profesional.trim()}`);
      }
      if (asignacion.fecha_asignacion) {
        partes.push(`Asignada: ${this.formatearFechaLegible(asignacion.fecha_asignacion)}`);
      }
      veterinarioDetalle = partes.length > 0 ? partes.join(' · ') : null;
    } else if (asignacion && !asignacion.asignada) {
      veterinarioDetalle = 'Sin veterinario asignado';
    }

    const multimedia = this.extraerMultimediaPeticion(peticion);
    const totalFotos = multimedia.filter((m) => m.tipo === 'imagen').length;
    const totalVideos = multimedia.filter((m) => m.tipo === 'video').length;

    const esOrigen = Boolean(
      peticion?.es_peticion_origen ||
        (alerta.peticion_origen_id !== null && idPeticion !== null && alerta.peticion_origen_id === idPeticion)
    );
    const esPrincipalGuardada = Boolean(
      peticion?.es_peticion_principal ||
        (alerta.peticion_principal_id !== null && idPeticion !== null && alerta.peticion_principal_id === idPeticion)
    );

    return {
      lado,
      etiquetaLado: lado === 'menor' ? 'Petición A' : 'Petición B',
      idPeticion,
      radicado,
      tipo,
      estado,
      estadoClase: this.claseEstadoPeticion(estado),
      prioridad,
      prioridadClase: this.clasePrioridadPeticion(prioridad),
      descripcion,
      direccion,
      coordenadasTexto,
      mapaUrl,
      veterinarioNombre: vetAsignado,
      veterinarioDetalle,
      fechaReporte: this.formatearFechaLegible(peticion?.fecha),
      esOrigen,
      esPrincipalGuardada,
      multimedia,
      totalFotos,
      totalVideos
    };
  }

  private extraerMultimediaPeticion(peticion: PeticionAlertaDetalle | null | undefined): MediaEvidenciaVM[] {
    if (!peticion) {
      return [];
    }

    const items: MediaEvidenciaVM[] = [];
    const vistas = new Set<string>();

    const agregar = (urlRaw: string | null | undefined, descripcion: string | null, esPrincipal: boolean) => {
      const url = this.normalizarUrlMedia(urlRaw);
      if (!url || vistas.has(url)) {
        return;
      }
      vistas.add(url);
      items.push({
        url,
        tipo: this.clasificarTipoMedia(url),
        descripcion: descripcion?.trim() || null,
        esPrincipal
      });
    };

    const fotoPrincipalUrl = this.normalizarUrlMedia(peticion.foto);

    if (Array.isArray(peticion.evidencias)) {
      for (const ev of peticion.evidencias) {
        const ruta = this.normalizarUrlMedia(ev?.ruta_archivo);
        agregar(ruta, ev?.descripcion ?? null, Boolean(ruta && fotoPrincipalUrl && ruta === fotoPrincipalUrl));
      }
    }

    if (Array.isArray(peticion.fotos)) {
      for (const f of peticion.fotos) {
        const ruta = this.normalizarUrlMedia(f);
        agregar(ruta, null, Boolean(ruta && fotoPrincipalUrl && ruta === fotoPrincipalUrl));
      }
    }

    agregar(fotoPrincipalUrl, null, true);

    return items;
  }

  private normalizarUrlMedia(urlRaw: string | null | undefined): string | null {
    if (typeof urlRaw !== 'string') {
      return null;
    }
    const limpia = urlRaw.trim();
    if (!limpia) {
      return null;
    }
    const lower = limpia.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) {
      return null;
    }
    if (
      lower.startsWith('https://') ||
      lower.startsWith('http://') ||
      lower.startsWith('/') ||
      lower.startsWith('data:image/') ||
      lower.startsWith('data:video/')
    ) {
      return limpia;
    }
    return null;
  }

  private clasificarTipoMedia(url: string): TipoMediaEvidencia {
    const lower = url.toLowerCase();
    if (lower.startsWith('data:video/')) {
      return 'video';
    }
    if (lower.startsWith('data:image/')) {
      return 'imagen';
    }

    const sinQueryNiHash = lower.split(/[?#]/)[0];
    if (
      sinQueryNiHash.includes('/video/upload/') ||
      EXTENSIONES_VIDEO_REGEX.test(sinQueryNiHash) ||
      lower.includes('resource_type=video') ||
      lower.includes('mime_type=video')
    ) {
      return 'video';
    }
    if (EXTENSIONES_ARCHIVO_REGEX.test(sinQueryNiHash) || sinQueryNiHash.includes('/raw/upload/')) {
      return 'archivo';
    }
    if (sinQueryNiHash.includes('/image/upload/') || EXTENSIONES_IMAGEN_REGEX.test(sinQueryNiHash)) {
      return 'imagen';
    }
    return 'imagen';
  }

  private construirCriterios(criterios: string[] | null | undefined): CriterioChipVM[] {
    if (!Array.isArray(criterios) || criterios.length === 0) {
      return [];
    }
    return criterios
      .map((raw) => String(raw || '').trim())
      .filter(Boolean)
      .map((clave) => ({
        clave,
        etiqueta: ETIQUETAS_CRITERIOS.get(clave.toLowerCase()) ?? clave
      }));
  }

  private obtenerMetricas(detalle: AlertaDuplicadoDetalle): MetricasDuplicado {
    return (
      detalle.comparacion?.metricas ?? {
        similitud_texto: detalle.similitud_texto,
        coincidencia_texto: detalle.coincidencia_texto,
        distancia_metros: detalle.distancia_metros,
        coincidencia_gps: detalle.coincidencia_gps,
        distancia_hamming: detalle.distancia_hamming,
        similitud_imagen: detalle.similitud_imagen,
        coincidencia_imagen: detalle.coincidencia_imagen,
        score_combinado: detalle.score_combinado,
        criterios_coincidencia: detalle.criterios_coincidencia
      }
    );
  }

  private esPeticionDelPar(idPeticion: number): boolean {
    if (!this.detalle) {
      return false;
    }
    return idPeticion === this.detalle.peticion_menor_id || idPeticion === this.detalle.peticion_mayor_id;
  }

  private claseEstadoPeticion(nombre: string): string {
    if (nombre === TEXTOS_NO_DISPONIBLE) {
      return 'badge-status-neutral';
    }
    const v = nombre.toLowerCase();
    if (v.includes('pendiente') || v.includes('revisi')) {
      return 'badge-status-warning';
    }
    if (v.includes('asignad') || v.includes('proceso') || v.includes('atenci') || v.includes('curso')) {
      return 'badge-status-info';
    }
    if (v.includes('resuelt') || v.includes('finaliz') || v.includes('atendid') || v.includes('adopci')) {
      return 'badge-status-success';
    }
    return 'badge-status-neutral';
  }

  private clasePrioridadPeticion(prioridad: string): string {
    if (prioridad === TEXTOS_NO_DISPONIBLE) {
      return 'badge-status-neutral';
    }
    const v = prioridad.toLowerCase();
    if (v.includes('alta') || v.includes('urgente') || v.includes('crít') || v.includes('crit')) {
      return 'badge-status-critical';
    }
    if (v.includes('media')) {
      return 'badge-status-warning';
    }
    if (v.includes('baja')) {
      return 'badge-status-info';
    }
    return 'badge-status-neutral';
  }

  private cancelarSuscripciones(): void {
    this.detalleSub?.unsubscribe();
    this.detalleSub = null;
    this.resolucionSub?.unsubscribe();
    this.resolucionSub = null;
  }
}
