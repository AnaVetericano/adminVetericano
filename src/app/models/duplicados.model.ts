/** Estados posibles de revisión de una alerta persistida de posible duplicado. */
export type EstadoRevisionAlerta = 'PENDIENTE' | 'CONFIRMADO' | 'DESCARTADO';

/** Decisiones válidas permitidas al resolver manualmente una alerta. */
export type DecisionResolucionAlerta = 'CONFIRMADO' | 'DESCARTADO';

/** Origen de creación de la alerta registrado por Django. */
export type OrigenDeteccionDuplicado = 'REGISTRO_PETICION' | 'ENDPOINT_MANUAL' | 'REANALISIS' | string;

/** Criterios de coincidencia reportados por el motor de detección. */
export type CriterioCoincidenciaDuplicado = 'texto' | 'gps' | 'imagen' | string;

/** Códigos normalizados para errores HTTP de los endpoints de duplicados. */
export type CodigoErrorDuplicados =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export interface UsuarioAlerta {
  id_usuario: number | null;
  nombre: string;
  apellido: string;
  nombre_completo: string | null;
  email: string | null;
  matricula_profesional?: string | null;
}

export interface UbicacionAlerta {
  id_ubicacion: number | null;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
}

export interface EstadoPeticionAlerta {
  id_estado: number | null;
  nombre: string | null;
  descripcion?: string | null;
  orden?: number | null;
}

export interface TipoPeticionAlerta {
  id_tipo: number | null;
  nombre: string | null;
}

export interface AsignacionAlerta {
  asignada: boolean;
  asignado_a: UsuarioAlerta | null;
  asignado_por: UsuarioAlerta | null;
  fecha_asignacion: string | null;
}

export interface EvidenciaAlerta {
  id_evidencia: number | null;
  ruta_archivo: string | null;
  descripcion: string | null;
}

export interface PeticionAlertaResumen {
  id_peticion: number | null;
  numero_radicado: string | null;
  codigo: string | null;
  tipo: TipoPeticionAlerta | null;
  estado: EstadoPeticionAlerta | null;
  ubicacion: UbicacionAlerta | null;
  descripcion: string | null;
  prioridad: string | null;
  fecha: string | null;
  foto: string | null;
  fotos: string[];
  total_fotos: number;
  asignacion: AsignacionAlerta;
}

export interface PeticionAlertaDetalle extends PeticionAlertaResumen {
  evidencias: EvidenciaAlerta[];
  es_peticion_origen: boolean;
  es_peticion_principal: boolean;
}

export interface MetricasDuplicado {
  similitud_texto: number | null;
  coincidencia_texto: boolean;
  distancia_metros: number | null;
  coincidencia_gps: boolean;
  distancia_hamming: number | null;
  similitud_imagen: number | null;
  coincidencia_imagen: boolean;
  score_combinado: number;
  criterios_coincidencia: CriterioCoincidenciaDuplicado[];
}

export interface ComparacionAlertaDuplicado {
  peticion_menor_id: number | null;
  peticion_mayor_id: number | null;
  mismo_tipo: boolean;
  mismo_estado: boolean;
  ambas_asignadas: boolean;
  mismo_veterinario_asignado: boolean;
  diferencia_tiempo_horas: number | null;
  metricas: MetricasDuplicado;
}

/** Alerta persistida en `peticion_posible_duplicado` (listados paginados). */
export interface AlertaDuplicadoResumen {
  id_alerta: number;
  estado_revision: EstadoRevisionAlerta;
  peticion_menor_id: number;
  peticion_mayor_id: number;
  peticion_origen_id: number | null;
  peticion_principal_id: number | null;
  similitud_texto: number | null;
  coincidencia_texto: boolean;
  distancia_metros: number | null;
  coincidencia_gps: boolean;
  distancia_hamming: number | null;
  similitud_imagen: number | null;
  coincidencia_imagen: boolean;
  score_combinado: number;
  criterios_coincidencia: CriterioCoincidenciaDuplicado[];
  origen_deteccion: OrigenDeteccionDuplicado;
  observacion_revision: string | null;
  revisado_por: UsuarioAlerta | null;
  fecha_revision: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
  peticion_menor: PeticionAlertaResumen | null;
  peticion_mayor: PeticionAlertaResumen | null;
}

/** Alerta persistida con detalle completo y bloque comparativo lado a lado. */
export interface AlertaDuplicadoDetalle extends AlertaDuplicadoResumen {
  peticion_menor: PeticionAlertaDetalle | null;
  peticion_mayor: PeticionAlertaDetalle | null;
  comparacion: ComparacionAlertaDuplicado;
}

export interface ResumenConteosAlertas {
  PENDIENTE: number;
  CONFIRMADO: number;
  DESCARTADO: number;
  total: number;
}

export interface FiltrosAlertasDuplicados {
  estado_revision?: EstadoRevisionAlerta | null;
  solo_pendientes?: boolean;
  id_peticion?: number | null;
  page?: number;
  page_size?: number;
}

export interface ListadoAlertasDuplicadosResponse {
  count: number;
  next?: string | null;
  previous?: string | null;
  page?: number;
  page_size?: number;
  total_pages?: number;
  resumen: ResumenConteosAlertas;
  results: AlertaDuplicadoResumen[];
}

export interface PeticionAlertasDuplicadosResponse extends ListadoAlertasDuplicadosResponse {
  id_peticion: number;
  numero_radicado: string | null;
}

export interface ResolverAlertaConfirmadoPayload {
  estado_revision: 'CONFIRMADO';
  peticion_principal: number;
  observacion?: string | null;
}

export interface ResolverAlertaDescartadoPayload {
  estado_revision: 'DESCARTADO';
  peticion_principal?: null;
  observacion?: string | null;
}

export type ResolverAlertaDuplicadoPayload =
  | ResolverAlertaConfirmadoPayload
  | ResolverAlertaDescartadoPayload;

export interface ResolverAlertaDuplicadoResponse {
  mensaje: string;
  cambiada: boolean;
  estado_anterior: EstadoRevisionAlerta;
  estado_nuevo: EstadoRevisionAlerta;
  alerta: AlertaDuplicadoDetalle;
}

export interface DetectarDuplicadosRequest {
  descripcion?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  foto?: string | null;
  fotos?: string[] | null;
  id_peticion?: number | null;
  excluir_id_peticion?: number | null;
  umbral?: number;
  radio_metros?: number;
  umbral_hamming?: number;
  dias?: number;
  limite?: number;
}

export interface UbicacionCandidatoManual {
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
}

/**
 * Candidato devuelto por `POST /api/peticiones/detectar-duplicados/`.
 * No representa una alerta persistida ni posee `id_alerta` o `estado_revision`.
 */
export interface CandidatoDuplicadoManual {
  id_peticion: number;
  numero_radicado: string | null;
  descripcion: string | null;
  fecha: string | null;
  similitud: number;
  similitud_texto: number;
  porcentaje_similitud: number;
  coincidencia_texto: boolean;
  distancia_metros: number | null;
  coincidencia_gps: boolean;
  coincidencia_imagen: boolean;
  distancia_hamming: number | null;
  similitud_imagen: number | null;
  posible_duplicado: boolean;
  criterios_coincidencia: CriterioCoincidenciaDuplicado[];
  score_combinado: number;
  id_estado: number | null;
  estado: string | null;
  ubicacion: UbicacionCandidatoManual | null;
  foto: string | null;
  fotos: string[];
  tiene_fotografia: boolean;
}

export interface ParametrosDeteccionManual {
  umbral_similitud: number;
  radio_metros: number;
  dias_ventana: number;
  longitud_minima_descripcion: number;
  limite: number;
  id_peticion_excluido: number | null;
  texto_activo: boolean;
  gps_activo: boolean;
  imagen_activa: boolean;
  umbral_hamming: number;
}

export interface DetectarDuplicadosResponse {
  advertencia_duplicado: boolean;
  posible_duplicado: boolean;
  total_candidatos: number;
  posibles_duplicados: CandidatoDuplicadoManual[];
  mensaje: string;
  parametros: ParametrosDeteccionManual;
}

export interface ErrorDuplicadosApi {
  status: number;
  codigo: CodigoErrorDuplicados;
  mensaje: string;
  erroresCampo?: Record<string, string[]>;
  original?: unknown;
}

/** Crea un objeto de conteos inicial en ceros. */
export function crearResumenAlertasVacio(): ResumenConteosAlertas {
  return {
    PENDIENTE: 0,
    CONFIRMADO: 0,
    DESCARTADO: 0,
    total: 0
  };
}

/**
 * Distingue en tiempo de ejecución y tipado una alerta persistida (`id_alerta` + `estado_revision`)
 * frente a un candidato efímero devuelto por la detección manual.
 */
export function esAlertaPersistida(
  item: AlertaDuplicadoResumen | CandidatoDuplicadoManual | null | undefined
): item is AlertaDuplicadoResumen {
  if (!item || typeof item !== 'object') {
    return false;
  }
  return (
    'id_alerta' in item &&
    typeof item.id_alerta === 'number' &&
    'estado_revision' in item &&
    typeof item.estado_revision === 'string'
  );
}

/** Distingue un candidato manual no persistido (`detectar-duplicados/`). */
export function esCandidatoManual(
  item: AlertaDuplicadoResumen | CandidatoDuplicadoManual | null | undefined
): item is CandidatoDuplicadoManual {
  if (!item || typeof item !== 'object') {
    return false;
  }
  return !esAlertaPersistida(item) && 'posible_duplicado' in item && 'id_peticion' in item;
}

/**
 * Convierte un valor normalizado `0–1` en porcentaje `0–100` únicamente para presentación.
 * Devuelve `null` cuando el valor original es `null`, `undefined` o no numérico.
 */
export function convertirSimilitudAPorcentaje(
  valor: number | null | undefined,
  decimales: number = 1
): number | null {
  if (valor === null || valor === undefined) {
    return null;
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero)) {
    return null;
  }
  const acotado = Math.max(0, Math.min(1, numero));
  const factor = Math.pow(10, Math.max(0, Math.min(4, Math.trunc(decimales))));
  return Math.round(acotado * 100 * factor) / factor;
}

/** Formatea una similitud `0–1` como texto porcentual legible o un texto de respaldo si es `null`. */
export function formatearPorcentajeSimilitud(
  valor: number | null | undefined,
  decimales: number = 1,
  fallback: string = 'No disponible'
): string {
  const pct = convertirSimilitudAPorcentaje(valor, decimales);
  return pct === null ? fallback : `${pct}%`;
}

/** Formatea la distancia GPS en metros o kilómetros preservando `null` como no disponible. */
export function formatearDistanciaMetros(
  distancia: number | null | undefined,
  fallback: string = 'Sin GPS'
): string {
  if (distancia === null || distancia === undefined) {
    return fallback;
  }
  const metros = Number(distancia);
  if (!Number.isFinite(metros) || metros < 0) {
    return fallback;
  }
  if (metros >= 1000) {
    return `${(metros / 1000).toFixed(2)} km`;
  }
  return `${Math.round(metros * 10) / 10} m`;
}

/** Formatea el resultado perceptual dHash únicamente para visualización. */
export function formatearSimilitudImagen(
  metrica: Pick<MetricasDuplicado, 'similitud_imagen' | 'distancia_hamming'> | null | undefined,
  fallback: string = 'Sin comparación visual'
): string {
  if (!metrica) {
    return fallback;
  }
  const pct = convertirSimilitudAPorcentaje(metrica.similitud_imagen, 1);
  if (pct === null) {
    return fallback;
  }
  if (metrica.distancia_hamming !== null && metrica.distancia_hamming !== undefined) {
    return `${pct}% (Hamming: ${metrica.distancia_hamming})`;
  }
  return `${pct}%`;
}

/**
 * Extrae el ID numérico de alerta desde el mensaje de una notificación `POSIBLE_DUPLICADO`
 * (`Posible duplicado detectado (alerta #<id>, ...)`), devolviendo `null` si no aplica.
 */
export function extraerIdAlertaDeNotificacion(
  notificacion: { tipo?: string | null; mensaje?: string | null } | null | undefined
): number | null {
  if (!notificacion) {
    return null;
  }
  const tipo = String(notificacion.tipo ?? '').trim().toUpperCase();
  if (tipo && tipo !== 'POSIBLE_DUPLICADO') {
    return null;
  }
  const mensaje = String(notificacion.mensaje ?? '');
  const coincidencia = /alerta\s*#(\d+)/i.exec(mensaje);
  if (!coincidencia) {
    return null;
  }
  const id = Number(coincidencia[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}
