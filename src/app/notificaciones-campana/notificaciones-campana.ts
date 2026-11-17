import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NotificacionItem } from '../models/notificaciones';
import { NotificacionesRealtimeService } from '../services/notificaciones-realtime.service';

@Component({
  selector: 'app-notificaciones-campana',
  standalone: true,
  templateUrl: './notificaciones-campana.html',
  styleUrl: './notificaciones-campana.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificacionesCampanaComponent {
  readonly realtime = inject(NotificacionesRealtimeService);
  readonly abierto = signal(false);
  readonly estado = this.realtime.estado;
  readonly notificaciones = this.realtime.notificaciones;
  readonly noLeidas = this.realtime.noLeidas;

  readonly contadorTexto = computed(() => {
    const n = this.noLeidas();
    return n > 99 ? '99+' : String(n);
  });

  readonly estadoVisual = computed(() => {
    const est = this.estado();
    if (est === 'conectado') {
      return {
        clasePunto: 'bg-[#067647]',
        clasePill: 'bg-[#ECFDF3] text-[#067647] border-[#ABEFC6]',
        texto: 'En vivo'
      };
    }
    if (est === 'apagado') {
      return {
        clasePunto: 'bg-slate-400',
        clasePill: 'bg-slate-100 text-slate-600 border-slate-200',
        texto: 'Desconectado'
      };
    }
    return {
      clasePunto: 'bg-[#DC6803]',
      clasePill: 'bg-[#FFF4E5] text-[#9A5B13] border-[#FCD9A6]',
      texto: est === 'degradado' ? 'Solo REST' : 'Conectando'
    };
  });

  togglePanel(): void {
    this.abierto.update((v) => !v);
  }

  cerrarPanel(): void {
    this.abierto.set(false);
  }

  marcarLeida(item: NotificacionItem): void {
    if (item && !item.leida) {
      this.realtime.marcarLeida(item.clave);
    }
  }

  marcarTodas(): void {
    if (this.noLeidas() > 0) {
      this.realtime.marcarTodasLeidas();
    }
  }

  etiquetaModulo(modulo?: string | null): string {
    const k = (modulo || '').toLowerCase().trim();
    if (!k || k === 'transversal') return 'General';
    if (k === 'clinica') return 'Clínica';
    return k[0].toUpperCase() + k.slice(1);
  }

  tiempoRelativo(fechaIso?: string | null): string {
    const ms = fechaIso ? Date.parse(fechaIso) : NaN;
    if (Number.isNaN(ms)) return 'Reciente';
    const seg = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (seg < 60) return 'Hace un momento';
    const min = Math.floor(seg / 60);
    if (min < 60) return `Hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `Hace ${h} h`;
    const d = Math.floor(h / 24);
    return d < 7 ? `Hace ${d} d` : new Date(ms).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  }
}
