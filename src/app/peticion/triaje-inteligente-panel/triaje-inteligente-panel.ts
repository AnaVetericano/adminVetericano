import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AnimalIconComponent } from '../../animal-icon/animal-icon';
import { AlertaDuplicadoResumen } from '../../models/duplicados.model';
import {
  DecisionHumanaTriaje,
  DuplicadoTriajeDetalle,
  ErrorTriajeApi,
  EstadoAnalisisTriaje,
  TriajePeticionDetalle
} from '../../models/triaje.model';
import { TriajeIaService } from '../../services/triaje-ia.service';

@Component({
  selector: 'app-triaje-inteligente-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, AnimalIconComponent],
  templateUrl: './triaje-inteligente-panel.html',
  styleUrl: './triaje-inteligente-panel.css'
})
export class TriajeInteligentePanelComponent implements OnChanges, OnDestroy {
  private readonly triajeService = inject(TriajeIaService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() idPeticion: number | null = null;
  @Input() peticion: any = null;
  @Input() alertasPeticion: AlertaDuplicadoResumen[] = [];
  @Input() esDuplicada: boolean = false;

  @Output() abrirAlertaDuplicado = new EventEmitter<number>();
  @Output() peticionActualizada = new EventEmitter<TriajePeticionDetalle>();
  @Output() triajeCargado = new EventEmitter<TriajePeticionDetalle>();

  cargando = false;
  reintentando = false;
  procesandoDecision: 'PRIORIDAD' | 'VETERINARIO' | null = null;

  triaje: TriajePeticionDetalle | null = null;
  automatizacionActiva = false;
  existeTriaje = false;

  errorCarga: string | null = null;
  errorCargaCodigo: string | null = null;
  errorAccion: string | null = null;
  mensajeExito: string | null = null;

  observacionPrioridad = '';
  observacionVeterinario = '';
  mostrarHistorialDecisiones = false;

  private consultaSub: Subscription | null = null;
  private reintentoSub: Subscription | null = null;
  private decisionSub: Subscription | null = null;
  private pollingTimer: ReturnType<typeof setTimeout> | null = null;
  private intentosPolling = 0;
  private readonly maxIntentosPolling = 15;
  private readonly intervaloPollingMs = 3000;

  get puedeConsultarTriaje(): boolean {
    return this.triajeService.puedeConsultarTriaje();
  }

  get estadoAnalisisEtiqueta(): string {
    const est = this.triaje?.estado_analisis;
    const mapa: Record<EstadoAnalisisTriaje, string> = {
      PENDIENTE: 'Pendiente',
      EN_PROCESO: 'Procesando',
      COMPLETADO: 'Completado',
      PARCIAL: 'Parcial',
      FALLIDO: 'Fallido'
    };
    if (est && est in mapa) {
      if (est === 'PENDIENTE' && this.triaje?.estado_envio === 'FALLO_DEFINITIVO') {
        return 'Fallido';
      }
      return mapa[est];
    }
    return 'Sin triaje';
  }

  get estadoAnalisisBadgeClase(): string {
    const est = this.triaje?.estado_analisis;
    if (est === 'COMPLETADO') {
      return 'bg-[#ECFDF3] text-[#067647] border-[#ABEFC6]';
    }
    if (est === 'PARCIAL') {
      return 'bg-[#FFF4E5] text-[#9A5B13] border-[#FCD9A6]';
    }
    if (est === 'EN_PROCESO') {
      return 'bg-[#4141A5]/5 text-[#4141A5] border-[#4141A5]/20';
    }
    if (est === 'FALLIDO' || (est === 'PENDIENTE' && this.triaje?.estado_envio === 'FALLO_DEFINITIVO')) {
      return 'bg-[#FEECEB] text-[#B42318] border-[#F5B7B1]';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  }

  get signosReportadosCiudadano(): string[] {
    if (!this.triaje) return [];
    if (this.triaje.signos_reportados.length > 0) {
      return this.triaje.signos_reportados;
    }
    // Solo si no hay campo separado y no hay fotos, los signos detectados provienen del relato textual
    if (!this.tieneEvidenciaVisual && this.triaje.signos_detectados.length > 0) {
      return this.triaje.signos_detectados;
    }
    return [];
  }

  get tieneEvidenciaVisual(): boolean {
    return Boolean(this.triaje?.tiene_fotografias || this.triaje?.imagen_sintetica_demo);
  }

  get signosObservadosFotografia(): string[] {
    if (!this.triaje || !this.tieneEvidenciaVisual) {
      return [];
    }
    return this.triaje.signos_fotografia;
  }

  get signosContextoCombinados(): string[] {
    if (!this.triaje) return [];
    if (
      this.triaje.signos_reportados.length === 0 &&
      this.triaje.signos_fotografia.length === 0 &&
      this.tieneEvidenciaVisual &&
      this.triaje.signos_detectados.length > 0
    ) {
      return this.triaje.signos_detectados;
    }
    return [];
  }

  get advertenciasContradiccion(): string[] {
    if (!this.triaje) return [];
    return this.triaje.advertencias_contradiccion || [];
  }

  get tieneContradiccion(): boolean {
    if (!this.triaje) return false;
    return this.triaje.contradiccion_foto_descripcion || this.advertenciasContradiccion.length > 0;
  }

  get posiblesDuplicadosLista(): DuplicadoTriajeDetalle[] {
    if (!this.triaje) return [];
    const base =
      this.triaje.posibles_duplicados_detalle.length > 0
        ? this.triaje.posibles_duplicados_detalle
        : this.triaje.posibles_duplicados;

    return base.map((dup) => {
      if (dup.id_alerta) return dup;
      const alertaMatch = (this.alertasPeticion || []).find(
        (a) =>
          Number(a.peticion_menor_id) === Number(dup.id_peticion) ||
          Number(a.peticion_mayor_id) === Number(dup.id_peticion)
      );
      if (!alertaMatch) return dup;
      return {
        ...dup,
        id_alerta: alertaMatch.id_alerta,
        estado_revision: alertaMatch.estado_revision
      };
    });
  }

  get puedeMostrarReintento(): boolean {
    if (!this.triaje) {
      return true;
    }
    if (this.triaje.puede_reintentar) {
      return true;
    }
    return (
      this.triaje.estado_analisis === 'FALLIDO' ||
      this.triaje.estado_analisis === 'PARCIAL' ||
      this.triaje.estado_analisis === 'PENDIENTE' ||
      this.triaje.estado_analisis === 'EN_PROCESO' ||
      this.triaje.estado_envio === 'FALLO_DEFINITIVO' ||
      this.triaje.estado_envio === 'FALLO_TEMPORAL' ||
      this.triaje.estado_envio === 'OMITIDO'
    );
  }

  get esEstadoTerminalPeticion(): boolean {
    const est = String(
      this.triaje?.estado_peticion || this.peticion?.estado || ''
    )
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    return ['finalizada', 'resuelta', 'cancelada', 'rechazada', 'alta medica', 'fallecido'].includes(est);
  }

  get veterinarioYaAsignadoEsRecomendado(): boolean {
    if (!this.triaje?.veterinario_recomendado_id) return false;
    const asigId = Number(
      this.triaje.asignado_a_id_peticion ??
        this.peticion?.asignado_a ??
        this.peticion?.id_veterinario ??
        0
    );
    return asigId > 0 && asigId === Number(this.triaje.veterinario_recomendado_id);
  }

  get prioridadActualTexto(): string {
    return (
      this.triaje?.prioridad_actual_peticion ||
      this.peticion?.prioridad ||
      this.triaje?.prioridad_original ||
      'Estándar'
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['idPeticion']) {
      this.detenerPolling();
      this.intentosPolling = 0;
      this.resetearMensajes();
      this.observacionPrioridad = '';
      this.observacionVeterinario = '';
      this.mostrarHistorialDecisiones = false;
      this.cargarTriaje();
    }
  }

  ngOnDestroy(): void {
    this.detenerPolling();
    this.consultaSub?.unsubscribe();
    this.reintentoSub?.unsubscribe();
    this.decisionSub?.unsubscribe();
  }

  cargarTriaje(silencioso = false): void {
    if (!this.puedeConsultarTriaje || !this.idPeticion || this.idPeticion <= 0) {
      this.detenerPolling();
      this.triaje = null;
      this.existeTriaje = false;
      this.cargando = false;
      return;
    }

    if (!silencioso) {
      this.detenerPolling();
      this.intentosPolling = 0;
      this.cargando = true;
      this.errorCarga = null;
      this.errorCargaCodigo = null;
    }
    this.consultaSub?.unsubscribe();

    const idConsultado = Number(this.idPeticion);
    this.consultaSub = this.triajeService.obtenerTriajePeticion(idConsultado).subscribe({
      next: (res) => {
        this.cargando = false;
        this.existeTriaje = res.existe_triaje;
        this.automatizacionActiva = res.automatizacion_activa;
        this.triaje = res.triaje;
        if (res.triaje) {
          this.triajeCargado.emit(res.triaje);
        }
        this.programarPollingSiPendiente(idConsultado);
        this.cdr.detectChanges();
      },
      error: (err: ErrorTriajeApi) => {
        this.cargando = false;
        if (!silencioso) {
          this.triaje = null;
          this.existeTriaje = false;
          this.errorCargaCodigo = err.codigo;
          this.errorCarga = err.mensaje || 'No se pudo consultar el análisis de triaje.';
        }
        this.detenerPolling();
        this.cdr.detectChanges();
      }
    });
  }

  private programarPollingSiPendiente(idConsultado: number): void {
    this.detenerPolling();
    if (!this.automatizacionActiva || !this.triaje) {
      return;
    }
    const enCurso =
      (this.triaje.estado_analisis === 'PENDIENTE' || this.triaje.estado_analisis === 'EN_PROCESO') &&
      this.triaje.estado_envio !== 'FALLO_DEFINITIVO';
    if (!enCurso || this.intentosPolling >= this.maxIntentosPolling) {
      return;
    }
    this.pollingTimer = setTimeout(() => {
      this.pollingTimer = null;
      if (Number(this.idPeticion) !== idConsultado) {
        return;
      }
      this.intentosPolling += 1;
      this.cargarTriaje(true);
    }, this.intervaloPollingMs);
  }

  private detenerPolling(): void {
    if (this.pollingTimer !== null) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  reintentarTriaje(): void {
    if (!this.idPeticion || this.reintentando || !this.automatizacionActiva) {
      return;
    }
    this.resetearMensajes();
    this.reintentando = true;
    const forzar = Boolean(this.triaje);
    this.reintentoSub?.unsubscribe();

    this.reintentoSub = this.triajeService.reintentarTriajePeticion(this.idPeticion, forzar).subscribe({
      next: (res) => {
        this.reintentando = false;
        if (!res.ejecutado && res.motivo === 'DESACTIVADO') {
          this.automatizacionActiva = false;
          this.errorAccion =
            'La automatización de triaje inteligente está desactivada en este entorno.';
        } else if (!res.ejecutado && res.idempotente) {
          this.mensajeExito = 'El análisis de triaje ya está en curso o completado.';
          this.cargarTriaje();
        } else {
          this.mensajeExito =
            'Se reencoló el análisis de triaje inteligente. Los resultados se actualizarán al completarse.';
          this.cargarTriaje();
        }
        this.cdr.detectChanges();
      },
      error: (err: ErrorTriajeApi) => {
        this.reintentando = false;
        this.errorAccion = err.mensaje || 'No fue posible reintentar el análisis de triaje.';
        this.cdr.detectChanges();
      }
    });
  }

  decidirPrioridad(decision: 'ACEPTADA' | 'RECHAZADA'): void {
    if (!this.idPeticion || !this.triaje?.prioridad_sugerida || this.procesandoDecision) {
      return;
    }
    this.resetearMensajes();
    this.procesandoDecision = 'PRIORIDAD';
    this.decisionSub?.unsubscribe();

    this.decisionSub = this.triajeService
      .registrarDecisionTriaje(this.idPeticion, {
        tipo_recomendacion: 'PRIORIDAD',
        decision,
        observacion: this.observacionPrioridad.trim()
      })
      .subscribe({
        next: (resp) => {
          this.procesandoDecision = null;
          this.triaje = resp.triaje;
          this.observacionPrioridad = '';
          this.mensajeExito =
            decision === 'ACEPTADA'
              ? `Prioridad actualizada a ${resp.triaje.prioridad_sugerida} y registrada en el historial.`
              : 'Recomendación de prioridad rechazada; la prioridad actual del caso se conserva.';
          this.peticionActualizada.emit(resp.triaje);
          this.cdr.detectChanges();
        },
        error: (err: ErrorTriajeApi) => {
          this.procesandoDecision = null;
          this.errorAccion = err.mensaje || 'No fue posible registrar la decisión sobre la prioridad.';
          this.cdr.detectChanges();
        }
      });
  }

  decidirVeterinario(decision: 'ACEPTADA' | 'RECHAZADA'): void {
    if (!this.idPeticion || !this.triaje?.veterinario_recomendado_id || this.procesandoDecision) {
      return;
    }
    this.resetearMensajes();
    this.procesandoDecision = 'VETERINARIO';
    this.decisionSub?.unsubscribe();

    const obs = this.observacionVeterinario.trim();
    const obs$ =
      decision === 'ACEPTADA'
        ? this.triajeService.aceptarYAsignarVeterinarioRecomendado(
            this.idPeticion,
            this.triaje.veterinario_recomendado_id,
            obs
          )
        : this.triajeService.registrarDecisionTriaje(this.idPeticion, {
            tipo_recomendacion: 'VETERINARIO',
            decision: 'RECHAZADA',
            observacion: obs
          });

    this.decisionSub = obs$.subscribe({
      next: (resp) => {
        this.procesandoDecision = null;
        this.triaje = resp.triaje;
        this.observacionVeterinario = '';
        this.mensajeExito =
          decision === 'ACEPTADA'
            ? `Veterinario ${resp.triaje.veterinario_recomendado_nombre || ''} asignado mediante el flujo autorizado y decisión registrada.`
            : 'Recomendación de veterinario rechazada y registrada. Puedes asignar manualmente desde el detalle.';
        this.peticionActualizada.emit(resp.triaje);
        this.cdr.detectChanges();
      },
      error: (err: ErrorTriajeApi) => {
        this.procesandoDecision = null;
        this.errorAccion =
          err.mensaje || 'No fue posible procesar la decisión sobre el veterinario recomendado.';
        this.cdr.detectChanges();
      }
    });
  }

  abrirComparador(idAlerta: number | null): void {
    if (idAlerta && idAlerta > 0) {
      this.abrirAlertaDuplicado.emit(idAlerta);
    }
  }

  etiquetaDecision(decision: DecisionHumanaTriaje | undefined): string {
    switch (decision) {
      case 'ACEPTADA':
        return 'Aceptada';
      case 'RECHAZADA':
        return 'Rechazada';
      case 'NO_APLICA':
        return 'No aplica';
      default:
        return 'Pendiente de revisión';
    }
  }

  claseBadgeDecision(decision: DecisionHumanaTriaje | undefined): string {
    switch (decision) {
      case 'ACEPTADA':
        return 'bg-[#ECFDF3] text-[#067647] border-[#ABEFC6]';
      case 'RECHAZADA':
        return 'bg-[#FEECEB] text-[#B42318] border-[#F5B7B1]';
      case 'NO_APLICA':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-[#FFF4E5] text-[#9A5B13] border-[#FCD9A6]';
    }
  }

  claseBadgePrioridad(prio: string | null | undefined): string {
    const p = String(prio || '').toUpperCase();
    if (p === 'URGENTE' || p === 'ALTA') {
      return 'bg-[#FEECEB] text-[#B42318] border-[#F5B7B1]';
    }
    if (p === 'MEDIA') {
      return 'bg-[#FFF4E5] text-[#9A5B13] border-[#FCD9A6]';
    }
    if (p === 'BAJA') {
      return 'bg-[#ECFDF3] text-[#067647] border-[#ABEFC6]';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  }

  formatearPorcentajeTexto(val: number | null | undefined): string {
    if (val === null || val === undefined || Number.isNaN(Number(val))) {
      return 'No disponible';
    }
    const num = Number(val);
    const pct = num <= 1 ? num * 100 : num;
    return `${pct.toFixed(1)}%`;
  }

  formatearPorcentajeImagen(dup: DuplicadoTriajeDetalle): string {
    const pct = dup.porcentaje_similitud_visual;
    if (pct !== null && pct !== undefined && !Number.isNaN(Number(pct))) {
      return `${Number(pct).toFixed(1)}%`;
    }
    const sim = dup.similitud_imagen;
    if (sim !== null && sim !== undefined && !Number.isNaN(Number(sim))) {
      const val = Number(sim) <= 1 ? Number(sim) * 100 : Number(sim);
      return `${val.toFixed(1)}%`;
    }
    return 'No disponible';
  }

  formatearMetodoImagen(metodo: string | null | undefined): string {
    if (!metodo) return '';
    const m = metodo.toLowerCase();
    if (m.includes('dinov2')) return 'DINOv2';
    if (m.includes('dhash')) return 'dHash';
    return metodo;
  }

  formatearDistancia(metros: number | null | undefined): string {
    if (metros === null || metros === undefined || Number.isNaN(Number(metros))) {
      return 'No disponible';
    }
    const m = Number(metros);
    if (m >= 1000) {
      return `${(m / 1000).toFixed(2)} km`;
    }
    return `${Math.round(m)} m`;
  }

  formatearFechaHora(valor: string | null | undefined): string {
    if (!valor) return 'No disponible';
    try {
      const d = new Date(valor);
      if (Number.isNaN(d.getTime())) return String(valor);
      return d.toLocaleString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(valor);
    }
  }

  private resetearMensajes(): void {
    this.errorAccion = null;
    this.mensajeExito = null;
  }
}
