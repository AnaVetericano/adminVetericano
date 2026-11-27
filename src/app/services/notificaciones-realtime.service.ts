import {
  DestroyRef,
  Injectable,
  InjectionToken,
  computed,
  effect,
  inject,
  signal,
  untracked
} from '@angular/core';
import { Subscription, firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { environment } from '../../environments/environment';
import {
  AlertaOperativaData,
  AlertaRealtimeUI,
  EstadoConexionRealtime,
  EventoRealtime,
  NivelAlertaOperativa,
  NotificacionItem,
  NotificacionLeidaData,
  NotificacionesRealtimeConfig,
  SesionRevocadaData,
  TodasLeidasData
} from '../models/notificaciones';
import { AuthService, UserSession, renovacionRechazada } from './auth';
import { NotificacionesApiService } from './notificaciones-api.service';
import { RealtimeEventosService } from './realtime-eventos.service';

export const NOTIFICACIONES_REALTIME_CONFIG = new InjectionToken<NotificacionesRealtimeConfig>(
  'NOTIFICACIONES_REALTIME_CONFIG'
);

const HEARTBEAT_MS = 25_000;
const PONG_TIMEOUT_MS = 10_000;
const AUTH_TIMEOUT_MS = 10_000;
const RECONCILIACION_MS = 180_000;
const POLLING_DEGRADADO_MS = 60_000;
const BACKOFF_MIN_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const MAX_EVENT_IDS = 500;
const MARGEN_EXP_SEG = 60;
/** Ítems recientes (leídos y no leídos) que muestra la campana; el contador sale del servidor. */
const LIMITE_RECONCILIACION = 50;
const CANAL_BROADCAST = 'vetericano-notificaciones';

type AccionReconciliacion =
  | { tipo: 'np'; item: NotificacionItem }
  | { tipo: 'leida'; clave: string }
  // Solo las claves no leídas cargadas en ese momento: una NP nacida después NO se marca leída.
  | { tipo: 'todas_leidas'; claves: string[] };

/** Agrupa las consultas al contador (varias pestañas / eventos seguidos generan una sola petición). */
const DEBOUNCE_CONTADOR_MS = 300;

type MensajeCanal =
  | { tipo: 'np_recibida'; userId: number | null; item: NotificacionItem }
  | { tipo: 'leida'; userId: number | null; clave: string }
  | { tipo: 'todas_leidas'; userId: number | null; modulo: string | null };

@Injectable({ providedIn: 'root' })
export class NotificacionesRealtimeService {
  private readonly authService = inject(AuthService);
  private readonly api = inject(NotificacionesApiService);
  private readonly realtimeEventos = inject(RealtimeEventosService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly configOverride = inject(NOTIFICACIONES_REALTIME_CONFIG, { optional: true });

  private readonly _estado = signal<EstadoConexionRealtime>('apagado');
  private readonly _notificaciones = signal<NotificacionItem[]>([]);
  private readonly _ultimaAlerta = signal<AlertaRealtimeUI | null>(null);
  /**
   * No leídas según la BD que no están entre los ítems cargados (la campana carga solo los
   * LIMITE_RECONCILIACION más recientes). Sale de `no_leidas` del REST: la BD es la fuente de verdad.
   */
  private readonly _noLeidasFuera = signal(0);

  readonly estado = this._estado.asReadonly();
  readonly notificaciones = this._notificaciones.asReadonly();
  readonly noLeidas = computed(
    () => this._notificaciones().filter((n) => !n.leida).length + this._noLeidasFuera()
  );
  readonly ultimaAlerta = this._ultimaAlerta.asReadonly();

  private readonly toastMixin = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 4000,
    timerProgressBar: true
  });

  private ws: WebSocket | null = null;
  private activo = false;
  private conectando = false;
  private gen = 0;
  private usuarioActivoId: number | null = null;
  private usuarioAnteriorId: number | null = this.obtenerIdUsuario(this.authService.currentUser());

  private intentos = 0;
  private reintento4001Usado = false;
  private bloqueado4001 = false;
  private logoutEnCurso = false;

  private tAuth?: ReturnType<typeof setTimeout>;
  private tHeartbeat?: ReturnType<typeof setInterval>;
  private tPong?: ReturnType<typeof setTimeout>;
  private tReconexion?: ReturnType<typeof setTimeout>;
  private tPeriodico?: ReturnType<typeof setInterval>;

  private reconciliacionSub?: Subscription;
  private contadorSub?: Subscription;
  private tContador?: ReturnType<typeof setTimeout>;
  /** Cambia con cada modificación local del estado: una respuesta del contador anterior se descarta. */
  private genEstado = 0;
  private reconciliando = false;
  private buffer: AccionReconciliacion[] = [];

  private readonly eventosVistos = new Set<string>();
  private canal: BroadcastChannel | null = null;
  private listenersAbort: AbortController | null = null;

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();
      const nuevoId = this.obtenerIdUsuario(user);

      if (!user) {
        this.usuarioAnteriorId = null;
        untracked(() => this.detener());
        return;
      }

      if (this.usuarioAnteriorId !== null && nuevoId !== null && nuevoId !== this.usuarioAnteriorId) {
        const estabaActivo = this.activo;
        untracked(() => {
          this.detener();
          this.usuarioAnteriorId = nuevoId;
          if (estabaActivo) this.iniciar();
        });
        return;
      }

      this.usuarioAnteriorId = nuevoId;
    });

    this.destroyRef.onDestroy(() => this.detener());
  }

  private get config(): NotificacionesRealtimeConfig {
    return this.configOverride ?? environment;
  }

  get habilitado(): boolean {
    return Boolean(this.config.notificacionesHabilitadas);
  }

  iniciar(): void {
    const cfg = this.config;
    if (!cfg.notificacionesHabilitadas) return;

    const user = this.authService.currentUser();
    if ((!user && !this.authService.isAuthenticated()) || this.activo) return;

    this.activo = true;
    this.logoutEnCurso = this.reintento4001Usado = this.bloqueado4001 = false;
    this.intentos = 0;
    this.usuarioActivoId = this.obtenerIdUsuario(user);

    this.registrarListeners();
    this.abrirCanal();

    if (this.wsPermitido(cfg, user)) void this.conectarWs();
    else this.entrarSoloRest();
  }

  detener(): void {
    const limpiar = this.activo || this.ws !== null || this._estado() !== 'apagado';
    this.activo = this.conectando = this.reconciliando = false;
    this.gen += 1;

    this.limpiarTimers(true);
    this.reconciliacionSub?.unsubscribe();
    this.reconciliacionSub = undefined;
    this.contadorSub?.unsubscribe();
    this.contadorSub = undefined;
    clearTimeout(this.tContador);
    this.tContador = undefined;
    this.buffer = [];
    this._noLeidasFuera.set(0);

    this.listenersAbort?.abort();
    this.listenersAbort = null;
    try { this.canal?.close(); } catch {}
    this.canal = null;
    this.cerrarSocket(true);

    if (limpiar || this._notificaciones().length > 0 || this._ultimaAlerta() !== null) {
      this._estado.set('apagado');
      this._notificaciones.set([]);
      this._ultimaAlerta.set(null);
      this.eventosVistos.clear();
    }

    this.intentos = 0;
    this.reintento4001Usado = this.bloqueado4001 = false;
    this.usuarioActivoId = null;
  }

  /**
   * Marca una notificación como leída en la BD (PATCH central). La campana se actualiza al instante;
   * si el servidor rechaza la petición se revierte y se avisa: nunca queda "leída" solo en pantalla.
   */
  marcarLeida(clave: string): void {
    if (!this.habilitado || !clave) return;

    const prev = this._notificaciones().find((n) => n.clave === clave);
    if (prev?.leida) return;
    this.aplicarLecturaEnEstado((n) => n.clave === clave);
    if (this.reconciliando) this.buffer.push({ tipo: 'leida', clave });

    this.api.marcarLeida(clave).subscribe({
      next: (res) => {
        const claveRes = res ? this.claveDe(res) : '';
        if (claveRes) {
          this._notificaciones.update((lista) =>
            lista.map((n) => (n.clave === clave ? { ...n, ...res, clave: claveRes, leida: true } : n))
          );
        }
        this.emitirCanal({ tipo: 'leida', userId: this.usuarioActivoId, clave });
        this.refrescarContador();
      },
      error: () => {
        if (prev) {
          this.genEstado++;
          this._notificaciones.update((lista) =>
            lista.some((n) => n.clave === clave)
              ? lista.map((n) => (n.clave === clave ? { ...n, leida: false, fecha_lectura: prev.fecha_lectura } : n))
              : this.ordenar([...lista, { ...prev }])
          );
        }
        this.avisarError('No se pudo marcar la notificación como leída. Intenta de nuevo.');
        this.reconciliar(); // la BD decide el estado final
      }
    });
  }

  marcarTodasLeidas(modulo: string | null = null): void {
    if (!this.habilitado) return;

    const coincide = (n: NotificacionItem) => modulo === null || n.modulo === modulo;
    const afectadas = new Map(
      this._notificaciones().filter((n) => !n.leida && coincide(n)).map((n) => [n.clave, n.fecha_lectura])
    );
    this.aplicarLecturaEnEstado((n) => afectadas.has(n.clave));
    if (modulo === null) this._noLeidasFuera.set(0);
    if (this.reconciliando) this.buffer.push({ tipo: 'todas_leidas', claves: Array.from(afectadas.keys()) });

    this.api.marcarTodasLeidas(modulo).subscribe({
      next: () => {
        this.emitirCanal({ tipo: 'todas_leidas', userId: this.usuarioActivoId, modulo });
        this.refrescarContador();
      },
      error: () => {
        // Reversión inmediata de lo que marcó este clic y, después, la BD decide (reconciliación).
        this.genEstado++;
        this._notificaciones.update((lista) =>
          lista.map((n) =>
            afectadas.has(n.clave) ? { ...n, leida: false, fecha_lectura: afectadas.get(n.clave) ?? null } : n
          )
        );
        this.avisarError('No se pudieron marcar las notificaciones como leídas. Intenta de nuevo.');
        this.reconciliar();
      }
    });
  }

  /**
   * Trae de la BD las notificaciones recientes (leídas y no leídas) y el total real de no leídas.
   * Lo que llegó por WS o por otra pestaña mientras viajaba la consulta se aplica encima.
   */
  reconciliar(): void {
    if (!this.activo || !this.habilitado) return;

    this.reconciliacionSub?.unsubscribe();
    this.reconciliando = true;
    this.buffer = [];

    this.reconciliacionSub = this.api.listar({ limit: LIMITE_RECONCILIACION }).subscribe({
      next: (resp) => {
        const mapa = new Map<string, NotificacionItem>();
        for (const item of resp?.resultados ?? []) {
          const clave = this.claveDe(item);
          if (clave) mapa.set(clave, { ...item, clave });
        }

        const marcarLeida = (n: NotificacionItem): NotificacionItem =>
          n.leida ? n : { ...n, leida: true, fecha_lectura: n.fecha_lectura ?? this.ahoraIso() };
        for (const acc of this.buffer) {
          if (acc.tipo === 'np') {
            const clave = this.claveDe(acc.item);
            if (clave && !mapa.has(clave)) mapa.set(clave, { ...acc.item, clave });
          } else if (acc.tipo === 'leida') {
            const n = mapa.get(acc.clave);
            if (n) mapa.set(acc.clave, marcarLeida(n));
          } else {
            for (const k of acc.claves) {
              const n = mapa.get(k);
              if (n) mapa.set(k, marcarLeida(n));
            }
          }
        }
        const huboCambiosDurante = this.buffer.length > 0;

        const lista = this.ordenar(Array.from(mapa.values()));
        this.genEstado++;
        this._notificaciones.set(lista);
        const totalServidor = Number(resp?.no_leidas);
        const cargadas = lista.filter((n) => !n.leida).length;
        this._noLeidasFuera.set(Number.isFinite(totalServidor) ? Math.max(0, totalServidor - cargadas) : 0);
        this.reconciliando = false;
        this.buffer = [];
        // La foto REST pudo ser anterior a esos cambios: se confirma el total con la BD.
        if (huboCambiosDurante) this.refrescarContador();
      },
      error: () => {
        this.reconciliando = false;
        this.buffer = [];
      }
    });
  }

  private async conectarWs(tokenDirecto?: string): Promise<void> {
    if (!this.activo || this.ws || this.conectando) return;

    const cfg = this.config;
    if (!cfg.notificacionesHabilitadas || !this.wsPermitido(cfg, this.authService.currentUser())) {
      this.entrarSoloRest();
      return;
    }

    this.conectando = true;
    const gen = this.gen;
    this._estado.set('conectando');

    try {
      let token = tokenDirecto ?? this.leerStorage('token');
      if (!tokenDirecto && !this.esTokenVigente(token)) {
        try {
          token = await firstValueFrom(this.authService.renovarToken());
        } catch (err) {
          if (gen !== this.gen || !this.activo) return;
          if (renovacionRechazada(err) && this.leerStorage('refresh_token')) this.forzarLogout();
          else this.degradarConBackoff();
          return;
        }
      }

      if (gen !== this.gen || !this.activo) return;
      if (!token || typeof WebSocket === 'undefined') {
        this.entrarSoloRest();
        return;
      }

      this.cerrarSocket(false);
      let socket: WebSocket;
      try {
        socket = new WebSocket(cfg.wsUrl);
      } catch {
        this.degradarConBackoff();
        return;
      }

      this.ws = socket;

      socket.onopen = () => {
        if (this.ws !== socket || !this.activo) return;
        this._estado.set('autenticando');
        try {
          socket.send(JSON.stringify({ type: 'auth', token }));
        } catch {
          this.cerrarSocket(false);
          this.degradarConBackoff();
          return;
        }
        clearTimeout(this.tAuth);
        this.tAuth = setTimeout(() => {
          this.tAuth = undefined;
          if (this.ws === socket && this.activo && this._estado() === 'autenticando') {
            this.cerrarSocket(false);
            void this.manejarCierre4001(gen);
          }
        }, AUTH_TIMEOUT_MS);
      };

      socket.onmessage = (ev: MessageEvent) => {
        if (this.ws !== socket || !this.activo) return;
        let msg: any;
        try {
          msg = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        } catch {
          return;
        }
        if (!msg || typeof msg !== 'object') return;

        if (msg.type === 'auth_ok') {
          clearTimeout(this.tAuth);
          this.tAuth = undefined;
          this._estado.set('conectado');
          this.intentos = 0;
          this.reintento4001Usado = this.bloqueado4001 = false;
          this.iniciarHeartbeat();
          this.programarPeriodico(RECONCILIACION_MS);
          this.reconciliar();
        } else if (msg.type === 'pong') {
          clearTimeout(this.tPong);
          this.tPong = undefined;
        } else if (msg.type === 'event') {
          this.procesarEvento(msg as EventoRealtime);
        }
      };

      socket.onclose = (ev: CloseEvent) => {
        if (this.ws !== socket) return;
        this.limpiarTimers(false);
        this.ws = null;
        if (!this.activo) return;

        const code = ev?.code ?? 1006;
        if (code === 4003) {
          this.forzarLogout();
        } else if (code === 4001) {
          void this.manejarCierre4001(gen);
        } else if (code === 4002) {
          this.reintento4001Usado = false;
          void this.refrescarYReconectar(gen, false);
        } else {
          this.degradarConBackoff();
        }
      };
    } finally {
      this.conectando = false;
    }
  }

  private async manejarCierre4001(gen: number): Promise<void> {
    if (this.reintento4001Usado) {
      this.bloqueado4001 = true;
      this.entrarSoloRest();
      return;
    }
    this.reintento4001Usado = true;
    await this.refrescarYReconectar(gen, true);
  }

  private async refrescarYReconectar(gen: number, degradarSiFalla: boolean): Promise<void> {
    if (gen !== this.gen || !this.activo) return;
    try {
      const nuevo = await firstValueFrom(this.authService.renovarToken());
      if (gen !== this.gen || !this.activo) return;
      await this.conectarWs(nuevo);
    } catch (err) {
      if (gen !== this.gen || !this.activo) return;
      if (degradarSiFalla) {
        this.bloqueado4001 = true;
        this.entrarSoloRest();
      } else if (renovacionRechazada(err)) {
        this.forzarLogout();
      } else {
        this.degradarConBackoff();
      }
    }
  }

  private forzarLogout(): void {
    if (this.logoutEnCurso) return;
    this.logoutEnCurso = true;
    this.detener();
    this.authService.logout();
  }

  private entrarSoloRest(): void {
    if (!this.activo) return;
    clearTimeout(this.tReconexion);
    this.tReconexion = undefined;
    this.activarDegradado();
    this.reconciliar();
  }

  private degradarConBackoff(): void {
    if (!this.activo) return;
    this.activarDegradado();

    clearTimeout(this.tReconexion);
    const base = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * Math.pow(2, this.intentos));
    const jitter = Math.floor(Math.random() * Math.min(1000, Math.round(base * 0.2)));
    this.intentos += 1;

    this.tReconexion = setTimeout(() => {
      this.tReconexion = undefined;
      if (this.activo && !this.bloqueado4001) void this.conectarWs();
    }, Math.min(BACKOFF_MAX_MS, base + jitter));
  }

  private activarDegradado(): void {
    const yaDegradado = this._estado() === 'degradado';
    this._estado.set('degradado');
    if (!yaDegradado || !this.tPeriodico) {
      this.programarPeriodico(POLLING_DEGRADADO_MS);
    }
  }

  private programarPeriodico(ms: number): void {
    clearInterval(this.tPeriodico);
    this.tPeriodico = setInterval(() => {
      if (this.activo) this.reconciliar();
    }, ms);
  }

  private iniciarHeartbeat(): void {
    clearInterval(this.tHeartbeat);
    clearTimeout(this.tPong);
    this.tPong = undefined;

    this.tHeartbeat = setInterval(() => {
      const socket = this.ws;
      const openState = typeof WebSocket !== 'undefined' && typeof WebSocket.OPEN === 'number' ? WebSocket.OPEN : 1;
      if (!socket || socket.readyState !== openState) return;

      clearTimeout(this.tPong);
      this.tPong = setTimeout(() => {
        this.tPong = undefined;
        if (!this.activo) return;
        this.cerrarSocket(false);
        this.degradarConBackoff();
      }, PONG_TIMEOUT_MS);

      try {
        socket.send(JSON.stringify({ type: 'ping' }));
      } catch {
        clearTimeout(this.tPong);
        this.tPong = undefined;
        this.cerrarSocket(false);
        this.degradarConBackoff();
      }
    }, HEARTBEAT_MS);
  }

  private limpiarTimers(todos: boolean): void {
    clearTimeout(this.tAuth);
    clearInterval(this.tHeartbeat);
    clearTimeout(this.tPong);
    this.tAuth = this.tHeartbeat = this.tPong = undefined;
    if (!todos) return;
    clearTimeout(this.tReconexion);
    clearInterval(this.tPeriodico);
    this.tReconexion = this.tPeriodico = undefined;
  }

  private cerrarSocket(normal: boolean): void {
    const socket = this.ws;
    this.ws = null;
    this.limpiarTimers(false);
    if (!socket) return;
    socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
    try {
      if (normal) socket.close(1000, 'logout');
      else socket.close();
    } catch {}
  }

  private procesarEvento(ev: EventoRealtime): void {
    if (!ev?.event_type) return;
    if (ev.event_id) {
      if (this.eventosVistos.has(ev.event_id)) return;
      if (this.eventosVistos.size >= MAX_EVENT_IDS) {
        const primero = this.eventosVistos.values().next().value;
        if (primero !== undefined) this.eventosVistos.delete(primero);
      }
      this.eventosVistos.add(ev.event_id);
    }

    this.realtimeEventos.emitir(ev);

    if (ev.event_type === 'sesion.revocada') {
      const motivo = (ev.data as SesionRevocadaData | undefined)?.motivo;
      this.fijarAlerta(
        'Sesión finalizada',
        motivo === 'rol_cambiado' ? 'Rol actualizado. Inicia sesión de nuevo.' : 'Sesión revocada.',
        'danger',
        ev.modulo || 'seguridad',
        ev.event_type,
        ev.timestamp
      );
      this.forzarLogout();
    } else if (ev.event_type === 'notificacion.leida') {
      const clave = (ev.data as NotificacionLeidaData | undefined)?.clave;
      if (clave) {
        this.aplicarLecturaRemota(clave);
        this.emitirCanal({ tipo: 'leida', userId: this.usuarioActivoId, clave });
      }
    } else if (ev.event_type === 'notificacion.todas_leidas') {
      const modulo = (ev.data as TodasLeidasData | undefined)?.modulo ?? null;
      this.aplicarTodasLeidasRemoto(modulo);
      this.emitirCanal({ tipo: 'todas_leidas', userId: this.usuarioActivoId, modulo });
    } else if (ev.categoria === 'NP') {
      const raw = ev.data as NotificacionItem;
      const clave = raw ? this.claveDe(raw) : '';
      if (!raw || !clave) return;
      const item: NotificacionItem = { ...raw, clave };
      this.upsertNotificacion(item);
      if (this.reconciliando) this.buffer.push({ tipo: 'np', item });
      this.emitirCanal({ tipo: 'np_recibida', userId: this.usuarioActivoId, item });
      const nivel: NivelAlertaOperativa = (item.prioridad || '').toLowerCase().includes('urgente') ? 'warning' : 'info';
      this.fijarAlerta(item.titulo, item.mensaje, nivel, item.modulo || ev.modulo, ev.event_type, ev.timestamp || item.fecha_creacion);
    } else if (ev.categoria === 'AO') {
      const alerta = ev.data as AlertaOperativaData;
      if (alerta) {
        this.fijarAlerta(alerta.titulo, alerta.mensaje, alerta.nivel || 'info', ev.modulo, ev.event_type, ev.timestamp);
      }
    }
  }

  private fijarAlerta(
    titulo: string,
    mensaje: string,
    nivel: NivelAlertaOperativa,
    modulo: string,
    event_type: string,
    timestamp?: string
  ): void {
    this._ultimaAlerta.set({
      titulo,
      mensaje,
      nivel,
      modulo,
      event_type,
      timestamp: timestamp || this.ahoraIso()
    });
    const icon = nivel === 'danger' ? 'error' : nivel === 'warning' ? 'warning' : 'info';
    // SweetAlert muestra un solo popup a la vez: si el usuario tiene abierto un diálogo o formulario
    // (Swal.fire local), no se le interrumpe; la notificación queda igual en la campana.
    if (Swal.isVisible()) return;
    try {
      void this.toastMixin.fire({ icon, titleText: titulo, text: mensaje }).catch(() => {});
    } catch {}
  }

  private upsertNotificacion(item: NotificacionItem): void {
    const clave = this.claveDe(item);
    if (!clave) return;
    this.genEstado++;
    this._notificaciones.update((lista) => {
      const existe = lista.some((n) => n.clave === clave);
      // Una NP tardía (WS o canal) nunca vuelve a "no leída" algo que ya se leyó.
      const fusionar = (n: NotificacionItem): NotificacionItem => ({
        ...n, ...item, clave, leida: n.leida || item.leida, fecha_lectura: n.fecha_lectura ?? item.fecha_lectura
      });
      return this.ordenar(
        existe ? lista.map((n) => (n.clave === clave ? fusionar(n) : n)) : [{ ...item, clave }, ...lista]
      );
    });
  }

  /** Lectura hecha en otra pestaña o dispositivo (evento WS `notificacion.leida` o BroadcastChannel). */
  private aplicarLecturaRemota(clave: string): void {
    const estabaCargada = this._notificaciones().some((n) => n.clave === clave);
    this.aplicarLecturaEnEstado((n) => n.clave === clave);
    if (this.reconciliando) this.buffer.push({ tipo: 'leida', clave });
    // Si no estaba entre las cargadas, el total de no leídas pudo bajar: se consulta a la BD.
    if (!estabaCargada) this.refrescarContador();
  }

  private aplicarTodasLeidasRemoto(modulo: string | null): void {
    const claves = this._notificaciones()
      .filter((n) => !n.leida && (modulo === null || n.modulo === modulo))
      .map((n) => n.clave);
    const set = new Set(claves);
    this.aplicarLecturaEnEstado((n) => set.has(n.clave));
    if (this.reconciliando) this.buffer.push({ tipo: 'todas_leidas', claves });
    if (modulo === null) this._noLeidasFuera.set(0);
    else this.refrescarContador();
  }

  /**
   * Ajusta el contador al total real de no leídas de la BD (`GET /api/notificaciones/contador/`).
   * Agrupado (debounce) y descartando respuestas que llegan después de un cambio local del estado.
   */
  private refrescarContador(): void {
    if (!this.activo || !this.habilitado) return;
    clearTimeout(this.tContador);
    this.tContador = setTimeout(() => {
      this.tContador = undefined;
      if (!this.activo || !this.habilitado) return;
      this.contadorSub?.unsubscribe();
      const gen = this.genEstado;
      this.contadorSub = this.api.contador().subscribe({
        next: (resp) => {
          if (gen !== this.genEstado) {
            this.refrescarContador(); // el estado cambió mientras viajaba: se vuelve a preguntar
            return;
          }
          const total = Number(resp?.no_leidas);
          if (!Number.isFinite(total)) return;
          const cargadas = this._notificaciones().filter((n) => !n.leida).length;
          if (total < cargadas) {
            // La BD tiene menos no leídas que la campana (se leyeron en otro lado sin aviso): se recarga.
            this.reconciliar();
            return;
          }
          this._noLeidasFuera.set(total - cargadas);
        },
        error: () => {}
      });
    }, DEBOUNCE_CONTADOR_MS);
  }

  private avisarError(texto: string): void {
    if (Swal.isVisible()) return;
    try {
      void this.toastMixin.fire({ icon: 'error', titleText: 'Notificaciones', text: texto }).catch(() => {});
    } catch {}
  }

  private aplicarLecturaEnEstado(predicado: (n: NotificacionItem) => boolean): void {
    const ahora = this.ahoraIso();
    this.genEstado++;
    this._notificaciones.update((lista) =>
      lista.map((n) => (predicado(n) ? { ...n, leida: true, fecha_lectura: n.fecha_lectura ?? ahora } : n))
    );
  }

  private claveDe(item: NotificacionItem): string {
    if (item.clave) return item.clave;
    return item.id_notificacion != null ? `${item.origen === 'peticiones' ? 'pet' : 'sis'}-${item.id_notificacion}` : '';
  }

  private ordenar(lista: NotificacionItem[]): NotificacionItem[] {
    return [...lista].sort((a, b) => (Date.parse(b.fecha_creacion || '') || 0) - (Date.parse(a.fecha_creacion || '') || 0));
  }

  private registrarListeners(): void {
    this.listenersAbort?.abort();
    this.listenersAbort = new AbortController();
    const signal = this.listenersAbort.signal;

    const alRecuperar = () => {
      if (!this.activo) return;
      this.reconciliar();
      if (!this.ws && !this.conectando && !this.bloqueado4001 && this._estado() === 'degradado') {
        if (this.wsPermitido(this.config, this.authService.currentUser())) {
          clearTimeout(this.tReconexion);
          this.tReconexion = undefined;
          void this.conectarWs();
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') alRecuperar();
      }, { signal });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', alRecuperar, { signal });
    }
  }

  private abrirCanal(): void {
    try { this.canal?.close(); } catch {}
    this.canal = null;
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      const ch = new BroadcastChannel(CANAL_BROADCAST);
      ch.onmessage = (ev: MessageEvent<MensajeCanal>) => {
        const msg = ev?.data;
        if (!this.activo || !msg) return;
        if (msg.userId !== null && this.usuarioActivoId !== null && msg.userId !== this.usuarioActivoId) return;
        if (msg.tipo === 'np_recibida' && msg.item) {
          const clave = this.claveDe(msg.item);
          if (clave) {
            const norm = { ...msg.item, clave };
            this.upsertNotificacion(norm);
            if (this.reconciliando) this.buffer.push({ tipo: 'np', item: norm });
          }
        } else if (msg.tipo === 'leida' && msg.clave) {
          this.aplicarLecturaRemota(msg.clave);
        } else if (msg.tipo === 'todas_leidas') {
          this.aplicarTodasLeidasRemoto(msg.modulo ?? null);
        }
      };
      this.canal = ch;
    } catch {
      this.canal = null;
    }
  }

  private emitirCanal(msg: MensajeCanal): void {
    try { this.canal?.postMessage(msg); } catch {}
  }

  private wsPermitido(cfg: NotificacionesRealtimeConfig, user: UserSession | null): boolean {
    if (!cfg.wsHabilitado || !cfg.wsUrl?.trim()) return false;
    const rol = this.obtenerIdRol(user);
    return rol !== null && cfg.wsRoles.includes(rol);
  }

  private obtenerIdRol(user: UserSession | null): number | null {
    const idUser = Number(user?.id_rol);
    if (idUser > 0) return idUser;
    const idToken = Number(this.decodificarJwt(this.leerStorage('token'))?.['id_rol']);
    if (idToken > 0) return idToken;
    const rol = (this.authService.userRole?.() || user?.rol || '').toLowerCase();
    for (const [k, id] of [['super', 5], ['vet', 3], ['jur', 2], ['petic', 4], ['admin', 1]] as const) {
      if (rol.includes(k)) return id;
    }
    return null;
  }

  private obtenerIdUsuario(user: UserSession | null): number | null {
    const id = Number(user?.id_usuario ?? user?.['id']);
    if (id > 0) return id;
    const payload = this.decodificarJwt(this.leerStorage('token'));
    const idTok = Number(payload?.['user_id'] ?? payload?.['id_usuario'] ?? payload?.['id']);
    return idTok > 0 ? idTok : null;
  }

  private leerStorage(clave: string): string | null {
    try { return localStorage.getItem(clave); } catch { return null; }
  }

  private decodificarJwt(token: string | null): Record<string, any> | null {
    if (!token) return null;
    try {
      const part = token.split('.')[1];
      if (!part) return null;
      let b64 = part.replace(/-/g, '+').replace(/_/g, '/');
      b64 += '='.repeat((4 - (b64.length % 4)) % 4);
      const json = decodeURIComponent(
        atob(b64).replace(/./g, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      );
      return JSON.parse(json) as Record<string, any>;
    } catch {
      return null;
    }
  }

  private esTokenVigente(token: string | null): boolean {
    const exp = Number(this.decodificarJwt(token)?.['exp']);
    return Number.isFinite(exp) && exp > Math.floor(Date.now() / 1000) + MARGEN_EXP_SEG;
  }

  private ahoraIso(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
}
