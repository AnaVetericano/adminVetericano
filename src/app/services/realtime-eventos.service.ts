import { Injectable } from '@angular/core';
import { EMPTY, MonoTypeOperatorFunction, Observable, Subject } from 'rxjs';
import { debounceTime, filter, groupBy, mergeMap } from 'rxjs/operators';
import { EventoRealtime } from '../models/notificaciones';

function compilarPatron(patron: string): RegExp {
  const limpio = patron.trim();
  if (limpio === '*' || limpio === '**') {
    return /^.*$/;
  }
  const escapado = limpio
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escapado}$`);
}

/**
 * Bus desacoplado de eventos en tiempo real.
 * Sin dependencias inyectadas para que los dashboards puedan suscribirse
 * sin afectar sus pruebas unitarias existentes.
 */
@Injectable({
  providedIn: 'root'
})
export class RealtimeEventosService {
  private readonly eventos$ = new Subject<EventoRealtime>();

  emitir(evento: EventoRealtime): void {
    if (!evento || !evento.event_type) {
      return;
    }
    this.eventos$.next(evento);
  }

  on(patrones: string | string[]): Observable<EventoRealtime> {
    const lista = (Array.isArray(patrones) ? patrones : [patrones])
      .map((p) => (p || '').trim())
      .filter(Boolean);

    if (lista.length === 0) {
      return EMPTY;
    }

    const matchers = lista.map(compilarPatron);

    return this.eventos$.asObservable().pipe(
      filter((evento) => matchers.some((rx) => rx.test(evento.event_type)))
    );
  }
}

/**
 * Debounce independiente por `event_type`: si en la misma ventana llegan eventos de tipos distintos
 * (p. ej. `peticion.asignada` y `kit.stock_actualizado`), cada uno dispara su propia recarga.
 * Con un `debounceTime` único solo sobreviviría el último y una vista quedaría sin refrescar.
 */
export function debouncePorTipo(ms = 1000): MonoTypeOperatorFunction<EventoRealtime> {
  return (fuente) =>
    fuente.pipe(
      groupBy((evento) => evento.event_type),
      mergeMap((grupo) => grupo.pipe(debounceTime(ms)))
    );
}
