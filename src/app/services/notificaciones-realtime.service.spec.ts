import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { environment } from '../../environments/environment';
import { EventoRealtime, NotificacionItem, NotificacionesRealtimeConfig } from '../models/notificaciones';
import { AuthService, UserSession } from './auth';
import {
  NOTIFICACIONES_REALTIME_CONFIG,
  NotificacionesRealtimeService
} from './notificaciones-realtime.service';
import { RealtimeEventosService } from './realtime-eventos.service';

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  sentMessages: string[] = [];
  closedWith: { code?: number; reason?: string } | null = null;

  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.closedWith = { code, reason };
  }

  simularOpen(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  simularMensaje(payload: unknown): void {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.onmessage?.(new MessageEvent('message', { data }));
  }

  simularClose(code: number, reason = ''): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code, reason } as CloseEvent);
  }
}

function crearJwt(expSeg: number, extras: Record<string, unknown> = {}): string {
  const b64 = (obj: Record<string, unknown>) => {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ user_id: 12, id_rol: 3, exp: expSeg, ...extras })}.firma`;
}

function crearItem(overrides: Partial<NotificacionItem> = {}): NotificacionItem {
  const id = overrides.id_notificacion ?? 893;
  return {
    clave: overrides.clave ?? `pet-${id}`,
    origen: 'peticiones',
    id_notificacion: id,
    event_type: 'peticion.asignada',
    modulo: 'peticiones',
    tipo: 'ASIGNACION',
    titulo: `Petición asignada #${id}`,
    mensaje: 'Se asignó un nuevo caso',
    prioridad: 'Urgente',
    leida: false,
    fecha_creacion: '2026-11-17T10:00:00',
    fecha_lectura: null,
    referencia: { id_peticion: id, numero_radicado: `RAD-2026-0${id}` },
    ...overrides
  };
}

describe('NotificacionesRealtimeService', () => {
  const baseNotifUrl = `${environment.apiBaseUrl.replace(/\/+$/, '')}/notificaciones`;
  let httpMock: HttpTestingController;
  let currentUserSig: ReturnType<typeof signal<UserSession | null>>;
  let authMock: {
    currentUser: Signal<UserSession | null>;
    isAuthenticated: () => boolean;
    userRole: () => string;
    renovarToken: ReturnType<typeof vi.fn<() => Observable<string>>>;
    logout: ReturnType<typeof vi.fn<() => void>>;
  };
  let toastFireSpy: ReturnType<typeof vi.fn>;

  function configurar(
    configOverrides: Partial<NotificacionesRealtimeConfig> = {},
    user: UserSession | null = {
      id_usuario: 12,
      email: 'vet@vetericano.test',
      id_rol: 3,
      rol: 'Veterinario'
    }
  ): { service: NotificacionesRealtimeService; bus: RealtimeEventosService } {
    const config: NotificacionesRealtimeConfig = {
      notificacionesHabilitadas: true,
      wsHabilitado: true,
      wsUrl: 'ws://127.0.0.1:8001/ws/notificaciones/',
      wsRoles: [1, 2, 3, 5],
      ...configOverrides
    };

    currentUserSig = signal<UserSession | null>(user);
    const renovarMock = vi.fn<() => Observable<string>>(() => {
      const nuevo = crearJwt(Math.floor(Date.now() / 1000) + 3600);
      localStorage.setItem('token', nuevo);
      return of(nuevo);
    });
    authMock = {
      currentUser: currentUserSig.asReadonly(),
      isAuthenticated: () => currentUserSig() !== null || !!localStorage.getItem('token'),
      userRole: () => currentUserSig()?.rol || '',
      renovarToken: renovarMock,
      logout: vi.fn<() => void>(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        currentUserSig.set(null);
      })
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authMock },
        { provide: NOTIFICACIONES_REALTIME_CONFIG, useValue: config }
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(NotificacionesRealtimeService);
    const bus = TestBed.inject(RealtimeEventosService);
    return { service, bus };
  }

  async function conectarYAutenticar(service: NotificacionesRealtimeService): Promise<FakeWebSocket> {
    service.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    const ws = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
    ws.simularOpen();
    ws.simularMensaje({ type: 'auth_ok', user_id: 12, id_rol: 3, token_exp: Math.floor(Date.now() / 1000) + 3600 });
    return ws;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T10:00:00Z'));
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
    localStorage.clear();

    const tokenVigente = crearJwt(Math.floor(Date.now() / 1000) + 3600);
    localStorage.setItem('token', tokenVigente);
    localStorage.setItem('refresh_token', 'refresh-valido');

    toastFireSpy = vi.fn().mockResolvedValue({ isConfirmed: true });
    vi.spyOn(Swal, 'mixin').mockReturnValue({ fire: toastFireSpy } as any);
  });

  afterEach(() => {
    try {
      httpMock?.verify();
    } finally {
      TestBed.resetTestingModule();
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      vi.useRealTimers();
      localStorage.clear();
    }
  });

  it('con flags apagados (notificacionesHabilitadas=false) NO abre socket ni hace llamadas HTTP', async () => {
    const { service } = configurar({ notificacionesHabilitadas: false, wsHabilitado: false });

    service.iniciar();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(FakeWebSocket.instances.length).toBe(0);
    expect(service.estado()).toBe('apagado');
    httpMock.expectNone(() => true);
  });

  it('con wsHabilitado=false o rol fuera de wsRoles opera en modo solo REST (degradado cada 60 s)', async () => {
    const { service } = configurar(
      { wsHabilitado: true, wsRoles: [3] },
      { id_usuario: 50, email: 'pet@vetericano.test', id_rol: 4, rol: 'Peticionario' }
    );

    service.iniciar();
    expect(FakeWebSocket.instances.length).toBe(0);
    expect(service.estado()).toBe('degradado');

    const req1 = httpMock.expectOne(
      (r) => r.method === 'GET' && r.url === `${baseNotifUrl}/` && r.params.get('limit') === '50'
    );
    expect(req1.request.params.has('solo_no_leidas')).toBe(false);
    req1.flush({ total: 1, no_leidas: 1, resultados: [crearItem({ id_notificacion: 1 })] });
    expect(service.noLeidas()).toBe(1);

    await vi.advanceTimersByTimeAsync(60_000);
    const req2 = httpMock.expectOne((r) => r.method === 'GET' && r.url === `${baseNotifUrl}/`);
    req2.flush({ total: 1, no_leidas: 1, resultados: [crearItem({ id_notificacion: 1 })] });
    expect(FakeWebSocket.instances.length).toBe(0);
  });

  it('abre WebSocket SIN token en la URL y envía auth en el primer mensaje tras open; refresca si exp <= ahora+60s', async () => {
    const tokenPorVencer = crearJwt(Math.floor(Date.now() / 1000) + 30);
    localStorage.setItem('token', tokenPorVencer);

    const { service } = configurar();
    service.iniciar();
    await vi.advanceTimersByTimeAsync(0);

    expect(authMock.renovarToken).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances.length).toBe(1);
    const ws = FakeWebSocket.instances[0];
    expect(ws.url).toBe('ws://127.0.0.1:8001/ws/notificaciones/');
    expect(ws.url).not.toContain('token');

    ws.simularOpen();
    expect(service.estado()).toBe('autenticando');
    expect(ws.sentMessages.length).toBe(1);
    const authMsg = JSON.parse(ws.sentMessages[0]);
    expect(authMsg.type).toBe('auth');
    expect(authMsg.token).toBeTruthy();
    expect(authMsg.token).not.toBe(tokenPorVencer);

    // Idempotencia: iniciar() de nuevo no abre un segundo socket
    service.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeWebSocket.instances.length).toBe(1);
  });

  it('reconciliación tras auth_ok: no pierde NP llegado durante el REST, deduplica por clave y aplica leída remota', async () => {
    const { service } = configurar();
    const ws = await conectarYAutenticar(service);
    expect(service.estado()).toBe('conectado');

    const reqRest = httpMock.expectOne((r) => r.method === 'GET' && r.url === `${baseNotifUrl}/`);

    // Mientras REST sigue pendiente llegan eventos por WS:
    // 1) pet-101 ya viene en REST y también llega por WS (no debe duplicarse)
    // 2) pet-102 es nuevo NP llegado durante la consulta REST (no debe perderse)
    // 3) pet-100 es marcado como leído remotamente (debe quedar excluido de no leídas)
    const item100 = crearItem({ id_notificacion: 100, clave: 'pet-100', fecha_creacion: '2026-11-17T09:50:00' });
    const item101 = crearItem({ id_notificacion: 101, clave: 'pet-101', fecha_creacion: '2026-11-17T09:55:00' });
    const item102 = crearItem({ id_notificacion: 102, clave: 'pet-102', fecha_creacion: '2026-11-17T10:01:00' });

    ws.simularMensaje({
      type: 'event',
      schema_version: '1',
      event_id: 'e-101',
      event_type: 'peticion.asignada',
      categoria: 'NP',
      modulo: 'peticiones',
      timestamp: '2026-11-17T10:00:01',
      data: item101
    });
    ws.simularMensaje({
      type: 'event',
      schema_version: '1',
      event_id: 'e-102',
      event_type: 'peticion.urgente',
      categoria: 'NP',
      modulo: 'peticiones',
      timestamp: '2026-11-17T10:01:00',
      data: item102
    });
    ws.simularMensaje({
      type: 'event',
      schema_version: '1',
      event_id: 'e-leida-100',
      event_type: 'notificacion.leida',
      categoria: 'AS',
      modulo: 'transversal',
      timestamp: '2026-11-17T10:01:05',
      data: { clave: 'pet-100' }
    });

    // Ahora responde REST con la fotografía anterior [pet-100, pet-101]
    reqRest.flush({
      total: 2,
      no_leidas: 2,
      resultados: [item100, item101]
    });
    // pet-100 no estaba cargada cuando llegó su lectura remota: el contador se confirma con la BD
    await vi.advanceTimersByTimeAsync(300);
    httpMock.expectOne(`${baseNotifUrl}/contador/`).flush({ no_leidas: 2, por_modulo: { peticiones: 2 } });

    const claves = service.notificaciones().map((n) => n.clave);
    expect(claves).toEqual(['pet-102', 'pet-101', 'pet-100']);
    expect(service.noLeidas()).toBe(2);
    expect(claves.filter((c) => c === 'pet-101').length).toBe(1);
    // pet-100 sigue visible, pero como leída (no desaparece ni cuenta como no leída)
    expect(service.notificaciones().find((n) => n.clave === 'pet-100')?.leida).toBe(true);
  });

  it('el contador usa el total no_leidas de la BD aunque la campana cargue solo las 50 más recientes', async () => {
    const { service } = configurar();
    await conectarYAutenticar(service);
    const recientes = [
      crearItem({ id_notificacion: 2, clave: 'pet-2', fecha_creacion: '2026-11-17T09:59:00' }),
      crearItem({ id_notificacion: 1, clave: 'pet-1', fecha_creacion: '2026-11-17T09:58:00', leida: true, fecha_lectura: '2026-11-17T09:58:30' })
    ];
    httpMock
      .expectOne((r) => r.url === `${baseNotifUrl}/`)
      .flush({ total: 130, no_leidas: 120, resultados: recientes });

    // 1 no leída cargada + 119 que están en la BD pero fuera de las cargadas
    expect(service.noLeidas()).toBe(120);
    expect(service.notificaciones().find((n) => n.clave === 'pet-1')?.leida).toBe(true);

    service.marcarLeida('pet-2');
    expect(service.noLeidas()).toBe(119);
    httpMock.expectOne(`${baseNotifUrl}/pet-2/leer/`).flush(
      { ...recientes[0], leida: true, fecha_lectura: '2026-11-17T10:00:00' }
    );
    // Tras confirmar en la BD se vuelve a leer el contador real
    await vi.advanceTimersByTimeAsync(300);
    httpMock.expectOne(`${baseNotifUrl}/contador/`).flush({ no_leidas: 119, por_modulo: { peticiones: 119 } });
    expect(service.noLeidas()).toBe(119);
    expect(service.notificaciones().find((n) => n.clave === 'pet-2')?.fecha_lectura).toBe('2026-11-17T10:00:00');

    // Marcar todas deja el contador en 0 y lo confirma con la BD
    service.marcarTodasLeidas();
    expect(service.noLeidas()).toBe(0);
    const reqTodas = httpMock.expectOne((r) => r.url === `${baseNotifUrl}/leer-todas/`);
    expect(reqTodas.request.method).toBe('PATCH');
    reqTodas.flush({ actualizadas: 119 });
    await vi.advanceTimersByTimeAsync(300);
    httpMock.expectOne(`${baseNotifUrl}/contador/`).flush({ no_leidas: 0, por_modulo: {} });
    expect(service.noLeidas()).toBe(0);
  });

  it('marcarTodasLeidas revierte solo lo que marcó si el servidor falla y avisa al usuario', async () => {
    const { service } = configurar();
    const ws = await conectarYAutenticar(service);
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({
      total: 2, no_leidas: 5,
      resultados: [crearItem({ id_notificacion: 11, clave: 'pet-11' }), crearItem({ id_notificacion: 10, clave: 'pet-10', fecha_creacion: '2026-11-17T09:00:00' })]
    });
    expect(service.noLeidas()).toBe(5);

    service.marcarTodasLeidas();
    expect(service.noLeidas()).toBe(0);
    // Llega una NP nueva mientras viaja el PATCH: no debe perderse al revertir
    ws.simularMensaje({
      type: 'event', schema_version: '1', event_id: 'np-12', event_type: 'peticion.asignada', categoria: 'NP',
      modulo: 'peticiones', timestamp: '2026-11-17T10:00:05', data: crearItem({ id_notificacion: 12, clave: 'pet-12', fecha_creacion: '2026-11-17T10:00:05' })
    });
    toastFireSpy.mockClear();
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/leer-todas/`).flush({ detail: 'x' }, { status: 503, statusText: 'Unavailable' });

    // Reversión inmediata de lo marcado + aviso; la NP nueva no se pierde
    expect(service.notificaciones().map((n) => n.clave)).toEqual(['pet-12', 'pet-11', 'pet-10']);
    expect(service.notificaciones().every((n) => !n.leida)).toBe(true);
    expect(toastFireSpy).toHaveBeenCalledWith(expect.objectContaining({ icon: 'error' }));

    // Y después manda la BD (reconciliación)
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({
      total: 3, no_leidas: 6,
      resultados: [
        crearItem({ id_notificacion: 12, clave: 'pet-12', fecha_creacion: '2026-11-17T10:00:05' }),
        crearItem({ id_notificacion: 11, clave: 'pet-11' }),
        crearItem({ id_notificacion: 10, clave: 'pet-10', fecha_creacion: '2026-11-17T09:00:00' })
      ]
    });
    expect(service.noLeidas()).toBe(6);
  });

  it('"Marcar todas" durante una reconciliación NO marca como leída una NP nacida después (hallazgo revisión #1)', async () => {
    const { service } = configurar();
    const ws = await conectarYAutenticar(service);
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({
      total: 1, no_leidas: 1, resultados: [crearItem({ id_notificacion: 30, clave: 'pet-30', fecha_creacion: '2026-11-17T09:30:00' })]
    });

    // Reconciliación en vuelo
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    const reqRest = httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`);

    service.marcarTodasLeidas();
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/leer-todas/`).flush({ actualizadas: 1 });
    // Nace X después del PATCH
    const x = crearItem({ id_notificacion: 31, clave: 'pet-31', fecha_creacion: '2026-11-17T10:00:10' });
    ws.simularMensaje({
      type: 'event', schema_version: '1', event_id: 'np-31', event_type: 'peticion.asignada', categoria: 'NP',
      modulo: 'peticiones', timestamp: '2026-11-17T10:00:10', data: x
    });
    // La foto REST (posterior a X pero anterior al PATCH) trae ambas sin leer
    reqRest.flush({ total: 2, no_leidas: 2, resultados: [x, crearItem({ id_notificacion: 30, clave: 'pet-30', fecha_creacion: '2026-11-17T09:30:00' })] });

    expect(service.notificaciones().find((n) => n.clave === 'pet-31')?.leida).toBe(false);
    expect(service.notificaciones().find((n) => n.clave === 'pet-30')?.leida).toBe(true);
    // El total se confirma con la BD (una sola consulta agrupada)
    await vi.advanceTimersByTimeAsync(300);
    httpMock.expectOne(`${baseNotifUrl}/contador/`).flush({ no_leidas: 1, por_modulo: { peticiones: 1 } });
    expect(service.noLeidas()).toBe(1);
  });

  it('una NP tardía no vuelve a "no leída" una notificación ya leída (hallazgo revisión #9)', async () => {
    const { service } = configurar();
    const ws = await conectarYAutenticar(service);
    const leida = crearItem({ id_notificacion: 40, clave: 'pet-40', leida: true, fecha_lectura: '2026-11-17T09:59:00' });
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({ total: 1, no_leidas: 0, resultados: [leida] });

    ws.simularMensaje({
      type: 'event', schema_version: '1', event_id: 'np-40-tardia', event_type: 'peticion.asignada', categoria: 'NP',
      modulo: 'peticiones', timestamp: '2026-11-17T10:00:00', data: crearItem({ id_notificacion: 40, clave: 'pet-40' })
    });
    expect(service.notificaciones()[0].leida).toBe(true);
    expect(service.noLeidas()).toBe(0);
  });

  it('una lectura hecha en otro dispositivo (evento WS) de un ítem no cargado actualiza el contador desde la BD', async () => {
    const { service } = configurar();
    const ws = await conectarYAutenticar(service);
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({
      total: 60, no_leidas: 3, resultados: [crearItem({ id_notificacion: 40, clave: 'pet-40' })]
    });
    expect(service.noLeidas()).toBe(3);

    ws.simularMensaje({
      type: 'event', schema_version: '1', event_id: 'leida-remota-5', event_type: 'notificacion.leida', categoria: 'AS',
      modulo: 'transversal', timestamp: '2026-11-17T10:01:00', data: { clave: 'sis-5' }
    });
    await vi.advanceTimersByTimeAsync(300);
    httpMock.expectOne(`${baseNotifUrl}/contador/`).flush({ no_leidas: 2, por_modulo: { peticiones: 1, inventario: 1 } });
    expect(service.noLeidas()).toBe(2);

    // Lectura remota de un ítem cargado: se aplica sin consultar al servidor
    ws.simularMensaje({
      type: 'event', schema_version: '1', event_id: 'leida-remota-40', event_type: 'notificacion.leida', categoria: 'AS',
      modulo: 'transversal', timestamp: '2026-11-17T10:01:10', data: { clave: 'pet-40' }
    });
    expect(service.noLeidas()).toBe(1);
    expect(service.notificaciones()[0].leida).toBe(true);

    // Todas leídas en otro dispositivo
    ws.simularMensaje({
      type: 'event', schema_version: '1', event_id: 'todas-1', event_type: 'notificacion.todas_leidas', categoria: 'AS',
      modulo: 'transversal', timestamp: '2026-11-17T10:02:00', data: { modulo: null }
    });
    expect(service.noLeidas()).toBe(0);
  });

  it('si la BD tiene menos no leídas que la campana, recarga la lista desde la BD', async () => {
    const { service } = configurar();
    const ws = await conectarYAutenticar(service);
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({
      total: 2, no_leidas: 2,
      resultados: [crearItem({ id_notificacion: 21, clave: 'pet-21' }), crearItem({ id_notificacion: 20, clave: 'pet-20', fecha_creacion: '2026-11-17T09:00:00' })]
    });

    ws.simularMensaje({
      type: 'event', schema_version: '1', event_id: 'leida-remota-x', event_type: 'notificacion.leida', categoria: 'AS',
      modulo: 'transversal', timestamp: '2026-11-17T10:01:00', data: { clave: 'pet-999' }
    });
    await vi.advanceTimersByTimeAsync(300);
    httpMock.expectOne(`${baseNotifUrl}/contador/`).flush({ no_leidas: 0, por_modulo: {} });
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({
      total: 2, no_leidas: 0,
      resultados: [
        crearItem({ id_notificacion: 21, clave: 'pet-21', leida: true, fecha_lectura: '2026-11-17T10:00:30' }),
        crearItem({ id_notificacion: 20, clave: 'pet-20', fecha_creacion: '2026-11-17T09:00:00', leida: true, fecha_lectura: '2026-11-17T10:00:30' })
      ]
    });
    expect(service.noLeidas()).toBe(0);
    expect(service.notificaciones().length).toBe(2);
  });

  it('deduplica eventos repetidos por event_id (conjunto acotado de 500) y enruta NP / AO / AS', async () => {
    const { service, bus } = configurar();
    const ws = await conectarYAutenticar(service);
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({ total: 0, no_leidas: 0, resultados: [] });

    const busEvents: EventoRealtime[] = [];
    const sub = bus.on('*').subscribe((e) => busEvents.push(e));

    const np = crearItem({ id_notificacion: 500, clave: 'pet-500' });
    const eventoNp: EventoRealtime = {
      type: 'event',
      schema_version: '1',
      event_id: 'dup-uuid-1',
      event_type: 'peticion.asignada',
      categoria: 'NP',
      modulo: 'peticiones',
      timestamp: '2026-11-17T10:02:00',
      data: np
    };

    ws.simularMensaje(eventoNp);
    ws.simularMensaje(eventoNp); // duplicado por event_id

    expect(service.notificaciones().length).toBe(1);
    expect(busEvents.length).toBe(1);
    expect(toastFireSpy).toHaveBeenCalledTimes(1);

    // AO muestra toast con nivel y actualiza ultimaAlerta
    ws.simularMensaje({
      type: 'event',
      schema_version: '1',
      event_id: 'ao-uuid-1',
      event_type: 'inventario.alerta_bodega',
      categoria: 'AO',
      modulo: 'inventario',
      timestamp: '2026-11-17T10:03:00',
      data: { titulo: 'Stock crítico', mensaje: 'Quedan 2 unidades', nivel: 'danger', referencia: { id_lote: 7 } }
    });

    expect(service.ultimaAlerta()?.nivel).toBe('danger');
    expect(toastFireSpy).toHaveBeenCalledTimes(2);
    expect(toastFireSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ icon: 'error', titleText: 'Stock crítico', text: 'Quedan 2 unidades' })
    );
    // Seguridad: el título va como texto (titleText), nunca como HTML (title/html de SweetAlert2)
    const opcionesToast = toastFireSpy.mock.calls[toastFireSpy.mock.calls.length - 1][0] as Record<string, unknown>;
    expect(opcionesToast['title']).toBeUndefined();
    expect(opcionesToast['html']).toBeUndefined();

    // AS solo emite al bus sin toast ni bandeja
    ws.simularMensaje({
      type: 'event',
      schema_version: '1',
      event_id: 'as-uuid-1',
      event_type: 'inventario.movimiento_bodega',
      categoria: 'AS',
      modulo: 'inventario',
      timestamp: '2026-11-17T10:04:00',
      data: { accion: 'actualizado', referencia: { id_compra: 9 } }
    });

    expect(service.notificaciones().length).toBe(1);
    expect(toastFireSpy).toHaveBeenCalledTimes(2);
    expect(busEvents.map((e) => e.event_type)).toEqual([
      'peticion.asignada',
      'inventario.alerta_bodega',
      'inventario.movimiento_bodega'
    ]);

    sub.unsubscribe();
  });

  it('aplica backoff exponencial ante cierre 1013 o falta de pong en heartbeat', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { service } = configurar();
    const ws1 = await conectarYAutenticar(service);
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({ total: 0, no_leidas: 0, resultados: [] });

    // Cierre 1013 -> estado degradado y reconexión tras 1000ms
    ws1.simularClose(1013, 'overloaded');
    expect(service.estado()).toBe('degradado');
    expect(FakeWebSocket.instances.length).toBe(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(FakeWebSocket.instances.length).toBe(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(FakeWebSocket.instances.length).toBe(2);
    const ws2 = FakeWebSocket.instances[1];

    // Segundo fallo consecutivo -> backoff de 2000ms
    ws2.simularClose(1013, 'overloaded');
    await vi.advanceTimersByTimeAsync(1999);
    expect(FakeWebSocket.instances.length).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeWebSocket.instances.length).toBe(3);

    // Conectar ws3 y verificar heartbeat ping cada 25s + cierre si no llega pong en 10s
    const ws3 = FakeWebSocket.instances[2];
    ws3.simularOpen();
    ws3.simularMensaje({ type: 'auth_ok', user_id: 12, id_rol: 3, token_exp: Math.floor(Date.now() / 1000) + 3600 });
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({ total: 0, no_leidas: 0, resultados: [] });

    await vi.advanceTimersByTimeAsync(25_000);
    expect(ws3.sentMessages.some((m) => JSON.parse(m).type === 'ping')).toBe(true);

    // Sin pong en 10s -> cierra ws3 y programa reconexión
    await vi.advanceTimersByTimeAsync(10_000);
    expect(ws3.closedWith).not.toBeNull();
    expect(service.estado()).toBe('degradado');
  });

  it('un cierre 1000 que NO viene de nuestro logout (proxy/reinicio) reconecta con backoff', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { service } = configurar();
    const ws1 = await conectarYAutenticar(service);
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({ total: 0, no_leidas: 0, resultados: [] });

    ws1.simularClose(1000, 'server restart');
    expect(service.estado()).toBe('degradado');
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeWebSocket.instances.length).toBe(2);
  });

  it('no interrumpe un diálogo SweetAlert abierto: omite el toast pero conserva la NP en la campana', async () => {
    const { service } = configurar();
    const ws = await conectarYAutenticar(service);
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({ total: 0, no_leidas: 0, resultados: [] });
    vi.spyOn(Swal, 'isVisible').mockReturnValue(true);

    ws.simularMensaje({
      type: 'event', schema_version: '1', event_id: 'np-con-dialogo', event_type: 'peticion.asignada', categoria: 'NP',
      modulo: 'peticiones', timestamp: '2026-11-17T10:00:00',
      data: { clave: 'pet-77', origen: 'peticiones', id_notificacion: 77, event_type: 'peticion.asignada', modulo: 'peticiones',
              tipo: 'ASIGNACION', titulo: 'Petición asignada', mensaje: 'm', prioridad: null, leida: false,
              fecha_creacion: '2026-11-17T10:00:00', fecha_lectura: null, referencia: { id_peticion: 7 } }
    });

    expect(toastFireSpy).not.toHaveBeenCalled();
    expect(service.notificaciones().some((n) => n.clave === 'pet-77')).toBe(true);
  });

  it('código 4002 refresca el token y reconecta con el token nuevo', async () => {
    const { service } = configurar();
    const ws1 = await conectarYAutenticar(service);
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({ total: 0, no_leidas: 0, resultados: [] });

    ws1.simularClose(4002, 'token expired');
    await vi.advanceTimersByTimeAsync(0);

    expect(authMock.renovarToken).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances.length).toBe(2);
    const ws2 = FakeWebSocket.instances[1];
    ws2.simularOpen();
    expect(JSON.parse(ws2.sentMessages[0]).type).toBe('auth');
  });

  it('código 4001 intenta un refresh y reconexión; si vuelve a fallar pasa a degradado sin bucle', async () => {
    const { service } = configurar();
    const ws1 = await conectarYAutenticar(service);
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({ total: 0, no_leidas: 0, resultados: [] });

    ws1.simularClose(4001, 'auth invalid');
    await vi.advanceTimersByTimeAsync(0);
    expect(authMock.renovarToken).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances.length).toBe(2);

    // Si vuelve a cerrar con 4001 -> degradado (modo solo REST) y no abre más sockets
    const ws2 = FakeWebSocket.instances[1];
    ws2.simularClose(4001, 'still invalid');
    await vi.advanceTimersByTimeAsync(0);
    expect(service.estado()).toBe('degradado');
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({ total: 0, no_leidas: 0, resultados: [] });

    await vi.advanceTimersByTimeAsync(30_000);
    expect(FakeWebSocket.instances.length).toBe(2);
  });

  it('código 4003 y evento sesion.revocada llaman a logout sin reconectar', async () => {
    const { service } = configurar();
    const ws1 = await conectarYAutenticar(service);
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({ total: 0, no_leidas: 0, resultados: [] });

    ws1.simularClose(4003, 'usuario inactivo');
    await vi.advanceTimersByTimeAsync(30_000);

    expect(authMock.logout).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances.length).toBe(1);
    expect(service.estado()).toBe('apagado');
  });

  it('al hacer logout (effect sobre currentUser) cierra el socket con código 1000 y limpia estado', async () => {
    const { service } = configurar();
    const ws = await conectarYAutenticar(service);
    httpMock
      .expectOne((r) => r.url === `${baseNotifUrl}/`)
      .flush({ total: 1, no_leidas: 1, resultados: [crearItem({ id_notificacion: 70 })] });

    expect(service.noLeidas()).toBe(1);

    authMock.logout();
    TestBed.flushEffects();
    await vi.advanceTimersByTimeAsync(5000);

    expect(ws.closedWith?.code).toBe(1000);
    expect(service.estado()).toBe('apagado');
    expect(service.notificaciones()).toEqual([]);
    expect(FakeWebSocket.instances.length).toBe(1);
  });

  it('marcarLeida actualiza optimísticamente y revierte si PATCH REST falla', async () => {
    const { service } = configurar();
    await conectarYAutenticar(service);
    httpMock
      .expectOne((r) => r.url === `${baseNotifUrl}/`)
      .flush({ total: 1, no_leidas: 1, resultados: [crearItem({ id_notificacion: 88, clave: 'pet-88' })] });

    expect(service.noLeidas()).toBe(1);
    service.marcarLeida('pet-88');
    expect(service.noLeidas()).toBe(0);
    expect(service.notificaciones()[0].leida).toBe(true);

    const patchReq = httpMock.expectOne(`${baseNotifUrl}/pet-88/leer/`);
    expect(patchReq.request.method).toBe('PATCH');
    patchReq.flush({ detail: 'Error' }, { status: 500, statusText: 'Server Error' });

    // Revierte el estado optimista
    expect(service.noLeidas()).toBe(1);
    expect(service.notificaciones()[0].leida).toBe(false);
    // ...y confirma con la BD (reconciliación)
    httpMock
      .expectOne((r) => r.url === `${baseNotifUrl}/`)
      .flush({ total: 1, no_leidas: 1, resultados: [crearItem({ id_notificacion: 88, clave: 'pet-88' })] });
    expect(service.noLeidas()).toBe(1);
  });

  it('reconcilia cada 3 min conectado, en visibilitychange visible y en online', async () => {
    const { service } = configurar();
    const ws = await conectarYAutenticar(service);
    const origSend = ws.send.bind(ws);
    ws.send = (data: string) => {
      origSend(data);
      if (JSON.parse(data).type === 'ping') {
        ws.simularMensaje({ type: 'pong' });
      }
    };
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({ total: 0, no_leidas: 0, resultados: [] });

    await vi.advanceTimersByTimeAsync(180_000);
    expect(service.estado()).toBe('conectado');
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({ total: 0, no_leidas: 0, resultados: [] });

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({ total: 0, no_leidas: 0, resultados: [] });

    window.dispatchEvent(new Event('online'));
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({ total: 0, no_leidas: 0, resultados: [] });
  });

  it('evento sesion.revocada fuerza logout sin reconectar y limpia estado al cambiar de usuario', async () => {
    const { service } = configurar();
    const ws = await conectarYAutenticar(service);
    httpMock
      .expectOne((r) => r.url === `${baseNotifUrl}/`)
      .flush({ total: 1, no_leidas: 1, resultados: [crearItem({ id_notificacion: 91 })] });

    ws.simularMensaje({
      type: 'event',
      schema_version: '1',
      event_id: 'rev-1',
      event_type: 'sesion.revocada',
      categoria: 'AO',
      modulo: 'seguridad',
      timestamp: '2026-11-17T10:05:00',
      data: { motivo: 'rol_cambiado' }
    });

    expect(authMock.logout).toHaveBeenCalledTimes(1);
    expect(service.estado()).toBe('apagado');
    expect(service.notificaciones()).toEqual([]);

    // Nuevo usuario inicia sesión con estado limpio
    currentUserSig.set({ id_usuario: 77, email: 'admin@vetericano.test', id_rol: 1, rol: 'Administrador' });
    localStorage.setItem('token', crearJwt(Math.floor(Date.now() / 1000) + 3600, { user_id: 77, id_rol: 1 }));
    TestBed.flushEffects();
    expect(service.noLeidas()).toBe(0);
  });

  it('código 4002 con refresh rechazado (401) ejecuta logout', async () => {
    const { service } = configurar();
    authMock.renovarToken.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }))
    );
    const ws = await conectarYAutenticar(service);
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({ total: 0, no_leidas: 0, resultados: [] });

    ws.simularClose(4002, 'expired');
    await vi.advanceTimersByTimeAsync(0);

    expect(authMock.logout).toHaveBeenCalledTimes(1);
    expect(service.estado()).toBe('apagado');
  });

  it('propaga lecturas y nuevos ítems entre pestañas mediante BroadcastChannel("vetericano-notificaciones")', () => {
    const canales: Array<{ name: string; onmessage: ((ev: MessageEvent) => void) | null }> = [];
    class FakeBroadcastChannel {
      onmessage: ((ev: MessageEvent) => void) | null = null;
      constructor(public name: string) {
        canales.push(this);
      }
      postMessage(_msg: unknown): void {}
      close(): void {}
    }
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);

    const { service } = configurar({ wsHabilitado: false });
    service.iniciar();
    httpMock.expectOne((r) => r.url === `${baseNotifUrl}/`).flush({ total: 0, no_leidas: 0, resultados: [] });
    expect(service.estado()).toBe('degradado');
    expect(canales.length).toBe(1);
    expect(canales[0].name).toBe('vetericano-notificaciones');

    const item = crearItem({ id_notificacion: 321, clave: 'pet-321' });
    canales[0].onmessage?.(
      new MessageEvent('message', { data: { tipo: 'np_recibida', userId: 12, item } })
    );
    expect(service.noLeidas()).toBe(1);

    canales[0].onmessage?.(
      new MessageEvent('message', { data: { tipo: 'leida', userId: 12, clave: 'pet-321' } })
    );
    expect(service.noLeidas()).toBe(0);
    expect(service.notificaciones()[0].leida).toBe(true);
  });
});
