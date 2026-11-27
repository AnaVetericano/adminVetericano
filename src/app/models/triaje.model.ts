export type EstadoAnalisisTriaje =
  | 'PENDIENTE'
  | 'EN_PROCESO'
  | 'COMPLETADO'
  | 'PARCIAL'
  | 'FALLIDO';

export type EstadoEnvioTriaje =
  | 'PENDIENTE'
  | 'ENVIANDO'
  | 'ENVIADO'
  | 'FALLO_TEMPORAL'
  | 'FALLO_DEFINITIVO'
  | 'OMITIDO';

export type DecisionHumanaTriaje = 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA' | 'NO_APLICA';

export type TipoRecomendacionTriaje = 'PRIORIDAD' | 'VETERINARIO';

export type CodigoErrorTriaje =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export interface CargaVeterinarioTriaje {
  id_veterinario: number;
  nombre_completo?: string;
  id_sede: number | null;
  sede_nombre: string | null;
  total_asignados: number;
  pendientes: number;
  en_proceso: number;
  finalizadas: number;
  carga_activa: number;
  urgentes_activos: number;
  saturado: boolean;
  porcentaje_completado: number;
}

export interface DuplicadoTriajeDetalle {
  id_peticion: number;
  numero_radicado: string | null;
  score_combinado: number | null;
  similitud_texto: number | null;
  distancia_metros: number | null;
  porcentaje_similitud_visual: number | null;
  similitud_imagen?: number | null;
  metodo_imagen: string | null;
  criterios_coincidencia: string[];
  estado: string | null;
  id_alerta: number | null;
  estado_revision: 'PENDIENTE' | 'CONFIRMADO' | 'DESCARTADO' | null;
}

export interface HistorialDecisionTriaje {
  tipo_recomendacion: TipoRecomendacionTriaje;
  decision: 'ACEPTADA' | 'RECHAZADA';
  valor_sugerido: string | null;
  valor_anterior: string | null;
  valor_resultante: string | null;
  observacion: string;
  usuario_id: number | null;
  usuario_nombre: string;
  usuario_rol: string;
  fecha: string;
}

export interface TriajePeticionDetalle {
  id_triaje: number;
  id_peticion: number;
  numero_radicado: string | null;
  clave_idempotencia: string;
  automatizacion_activa: boolean;
  tiene_fotografias: boolean;
  puede_reintentar: boolean;
  estado_envio: EstadoEnvioTriaje;
  estado_analisis: EstadoAnalisisTriaje;
  intentos_envio: number;
  max_intentos: number;
  lease_expira_en: string | null;
  ultimo_intento_en: string | null;
  proximo_reintento_en: string | null;
  ultimo_codigo_http: number | null;
  ultimo_error_envio: string;
  enviado_en: string | null;
  completado_en: string | null;
  n8n_execution_id: string;
  version_resultado: number;
  prioridad_original: string | null;
  prioridad_actual_peticion: string | null;
  estado_peticion: string | null;
  prioridad_sugerida: string | null;
  nivel_confianza: number | null;
  justificacion: string;
  resumen_texto: string;
  resumen_vision: string;
  signos_detectados: string[];
  signos_reportados: string[];
  signos_fotografia: string[];
  contradiccion_foto_descripcion: boolean;
  advertencias_contradiccion: string[];
  posibles_duplicados: DuplicadoTriajeDetalle[];
  posibles_duplicados_detalle: DuplicadoTriajeDetalle[];
  total_duplicados_detectados: number;
  asignado_a_id_peticion: number | null;
  veterinario_recomendado_id: number | null;
  veterinario_recomendado_nombre: string | null;
  veterinario_recomendado_sede_id: number | null;
  veterinario_recomendado_sede: string | null;
  veterinario_recomendado_carga: CargaVeterinarioTriaje | null;
  justificacion_recomendacion: string;
  carga_veterinarios_snapshot: CargaVeterinarioTriaje[];
  decision_prioridad: DecisionHumanaTriaje;
  decision_prioridad_por_id: number | null;
  decision_prioridad_por_nombre: string | null;
  decision_prioridad_en: string | null;
  decision_prioridad_observacion: string;
  prioridad_aplicada: string | null;
  decision_veterinario: DecisionHumanaTriaje;
  decision_veterinario_por_id: number | null;
  decision_veterinario_por_nombre: string | null;
  decision_veterinario_en: string | null;
  decision_veterinario_observacion: string;
  veterinario_asignado_decision_id: number | null;
  historial_decisiones: HistorialDecisionTriaje[];
  modelo_texto_usado: string;
  modelo_vision_usado: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface EstadoConsultaTriaje {
  existe_triaje: boolean;
  automatizacion_activa: boolean;
  triaje: TriajePeticionDetalle | null;
}

export interface ReintentoTriajeResponse {
  ejecutado: boolean;
  idempotente?: boolean;
  asincrono?: boolean;
  motivo?: string;
  automatizacion_activa?: boolean;
  id_triaje?: number;
  estado_envio?: EstadoEnvioTriaje;
}

export interface DecisionTriajePayload {
  tipo_recomendacion: TipoRecomendacionTriaje;
  decision: 'ACEPTADA' | 'RECHAZADA';
  observacion?: string;
  motivo?: string;
}

export interface DecisionTriajeResponse {
  mensaje: string;
  triaje: TriajePeticionDetalle;
}

export interface ErrorTriajeApi {
  status: number;
  codigo: CodigoErrorTriaje;
  mensaje: string;
}
