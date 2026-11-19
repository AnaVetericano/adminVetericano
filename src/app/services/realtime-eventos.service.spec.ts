import { TestBed } from '@angular/core/testing';
import { EventoRealtime } from '../models/notificaciones';
import { RealtimeEventosService, debouncePorTipo } from './realtime-eventos.service';

function crearEvento(eventType: string, id = 'evt-1'): EventoRealtime {
  return {
    type: 'event',
    schema_version: '1',
    event_id: id,
    event_type: eventType,
    categoria: 'AS',
    modulo: eventType.split('.')[0] || 'general',
    timestamp: '2026-11-17T10:00:00',
    data: { accion: 'actualizado', referencia: {} }
  };
}

describe('RealtimeEventosService', () => {
  let service: RealtimeEventosService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RealtimeEventosService);
  });

  it('debe entregar coincidencia exacta y con comodín por prefijo ("peticion.*", "kit.*")', () => {
    const recibidosPeticion: string[] = [];
    const recibidosKit: string[] = [];
    const recibidosExacto: string[] = [];

    const s1 = service.on('peticion.*').subscribe((e) => recibidosPeticion.push(e.event_type));
    const s2 = service.on('kit.*').subscribe((e) => recibidosKit.push(e.event_type));
    const s3 = service.on('catalogo.clinico_actualizado').subscribe((e) => recibidosExacto.push(e.event_type));

    service.emitir(crearEvento('peticion.asignada', '1'));
    service.emitir(crearEvento('peticion.urgente', '2'));
    service.emitir(crearEvento('kit.solicitud_creada', '3'));
    service.emitir(crearEvento('catalogo.clinico_actualizado', '4'));
    service.emitir(crearEvento('catalogo.medicamentos_actualizado', '5'));

    expect(recibidosPeticion).toEqual(['peticion.asignada', 'peticion.urgente']);
    expect(recibidosKit).toEqual(['kit.solicitud_creada']);
    expect(recibidosExacto).toEqual(['catalogo.clinico_actualizado']);

    s1.unsubscribe();
    s2.unsubscribe();
    s3.unsubscribe();
  });

  it('debe soportar comodín global "*" y arreglo de patrones múltiples', () => {
    const todos: string[] = [];
    const multiples: string[] = [];

    const s1 = service.on('*').subscribe((e) => todos.push(e.event_type));
    const s2 = service
      .on(['inventario.*', 'admin.sede_actualizada'])
      .subscribe((e) => multiples.push(e.event_type));

    service.emitir(crearEvento('inventario.movimiento_bodega', '1'));
    service.emitir(crearEvento('admin.sede_actualizada', '2'));
    service.emitir(crearEvento('admin.usuario_gestionado', '3'));
    service.emitir(crearEvento('voluntariado.evento_actualizado', '4'));

    expect(todos).toEqual([
      'inventario.movimiento_bodega',
      'admin.sede_actualizada',
      'admin.usuario_gestionado',
      'voluntariado.evento_actualizado'
    ]);
    expect(multiples).toEqual(['inventario.movimiento_bodega', 'admin.sede_actualizada']);

    s1.unsubscribe();
    s2.unsubscribe();
  });

  it('debouncePorTipo agrupa por event_type: tipos distintos en la misma ventana no se pisan', () => {
    vi.useFakeTimers();
    try {
      const recibidos: string[] = [];
      const sub = service
        .on(['peticion.*', 'kit.*'])
        .pipe(debouncePorTipo(1000))
        .subscribe((e) => recibidos.push(e.event_type));

      service.emitir(crearEvento('peticion.asignada', 'a'));
      service.emitir(crearEvento('kit.stock_actualizado', 'b'));
      service.emitir(crearEvento('peticion.asignada', 'c'));
      vi.advanceTimersByTime(999);
      expect(recibidos).toEqual([]);
      vi.advanceTimersByTime(1);
      expect(recibidos.sort()).toEqual(['kit.stock_actualizado', 'peticion.asignada']);
      sub.unsubscribe();
    } finally {
      vi.useRealTimers();
    }
  });
});
