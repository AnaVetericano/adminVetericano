export type CategoriaNotificacion = 'NP' | 'AO' | 'AS' | 'ML';

export type NivelAlertaOperativa = 'info' | 'warning' | 'danger';

export type EstadoConexionRealtime =
  | 'apagado'
  | 'conectando'
  | 'autenticando'
  | 'conectado'
  | 'degradado';

export type ReferenciaNotificacion = Record<string, unknown>;

/** Ítem unificado de notificación (§5 del contrato v1: REST central y `data` de eventos NP). */
export interface NotificacionItem {
  clave: string;
  origen: 'peticiones' | 'sistema' | string;
  id_notificacion: number;
  event_type: string;
  modulo: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  prioridad?: string | null;
  leida: boolean;
  fecha_creacion: string;
  fecha_lectura: string | null;
  referencia?: ReferenciaNotificacion | null;
}

/** Payload `data` de eventos AO (§3). */
export interface AlertaOperativaData {
  titulo: string;
  mensaje: string;
  nivel: NivelAlertaOperativa;
  referencia?: ReferenciaNotificacion | null;
}

/** Payload `data` de eventos AS (§3). */
export interface ActualizacionSilenciosaData {
  accion: 'creado' | 'actualizado' | 'eliminado' | string;
  referencia?: ReferenciaNotificacion | null;
}

/** Payload `data` de `notificacion.leida` (§3). */
export interface NotificacionLeidaData {
  clave: string;
}

/** Payload `data` de `notificacion.todas_leidas` (§3). */
export interface TodasLeidasData {
  modulo: string | null;
}

/** Payload `data` de `sesion.revocada` (§3). */
export interface SesionRevocadaData {
  motivo: 'inactivado' | 'rol_cambiado' | string;
}

/** Sobre unificado de evento WebSocket (§3 del contrato v1). */
export interface EventoRealtime<T = any> {
  type: 'event';
  schema_version: string;
  event_id: string;
  event_type: string;
  categoria: CategoriaNotificacion;
  modulo: string;
  timestamp: string;
  data: T;
}

export type MensajeWsCliente =
  | { type: 'auth'; token: string }
  | { type: 'ping' };

export type MensajeWsServidor =
  | { type: 'auth_ok'; user_id: number; id_rol: number; token_exp: number }
  | { type: 'pong' }
  | EventoRealtime;

export interface AlertaRealtimeUI {
  titulo: string;
  mensaje: string;
  nivel: NivelAlertaOperativa;
  modulo: string;
  event_type: string;
  timestamp: string;
}

export interface FiltrosNotificaciones {
  solo_no_leidas?: boolean;
  modulo?: string;
  limit?: number;
  offset?: number;
}

export interface ListadoNotificacionesResponse {
  total: number;
  no_leidas: number;
  resultados: NotificacionItem[];
}

export interface ContadorNotificacionesResponse {
  no_leidas: number;
  por_modulo: Record<string, number>;
}

export interface MarcarTodasLeidasResponse {
  actualizadas: number;
}

export interface NotificacionesRealtimeConfig {
  notificacionesHabilitadas: boolean;
  wsHabilitado: boolean;
  wsUrl: string;
  wsRoles: number[];
}
