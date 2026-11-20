import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  Output,
  EventEmitter,
  inject,
  computed
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Chart, Plugin } from 'chart.js/auto';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { RealtimeEventosService } from '../services/realtime-eventos.service';
import {
  DashboardJuridicoService,
  ResumenDashboardJuridico,
  CasoVeterinario
} from '../services/dashboard-juridico.service';
import { AlertasDuplicadosService } from '../services/alertas-duplicados.service';
import {
  AlertaDuplicadoResumen,
  ErrorDuplicadosApi,
  ResumenConteosAlertas,
  crearResumenAlertasVacio
} from '../models/duplicados.model';
import { PageTitleComponent } from '../page-title/page-title';
import { AuthService } from '../services/auth';

const MAX_ALERTAS_PENDIENTES_DASHBOARD = 5;

@Component({
  selector: 'app-dashboard-juridico',
  standalone: true,
  imports: [CommonModule, PageTitleComponent, RouterLink],
  templateUrl: './dashboard-juridico.html',
  styleUrl: './dashboard-juridico.css'
})
export class DashboardJuridicoComponent implements OnInit, OnDestroy {
  @Output() verCasos = new EventEmitter<void>();
  @ViewChild('chartPeticiones') chartPeticionesRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartVeterinarios') chartVeterinariosRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartCBA') chartCBARef!: ElementRef<HTMLCanvasElement>;

  cargando = true;
  errorCarga = '';
  fechaActual = new Date();

  metricas: ResumenDashboardJuridico = {
    peticiones: {
      total: 0,
      pendientes: 0,
      enProceso: 0,
      finalizadas: 0,
      urgentes: 0,
      distribucionEstados: {}
    },
    casosVeterinarios: [],
    cba: {
      totalIngresadosCBA: 0,
      enObservacion: 0,
      enTratamiento: 0,
      aptosAdopcion: 0,
      adoptadosOtras: 0,
      distribucionEstados: {},
      ultimosIngresos: []
    }
  };

  private chartPeticiones?: Chart;
  private chartVeterinarios?: Chart;
  private chartCBA?: Chart;

  readonly alertasDuplicadosService = inject(AlertasDuplicadosService);
  // Para mostrar el selector de vistas por rol solo al Administrador (supervisión)
  readonly authService = inject(AuthService);
  cargandoDuplicados = false;
  errorDuplicados = '';
  private duplicadosSub?: Subscription;

  readonly resumenDuplicados = computed<ResumenConteosAlertas>(() =>
    this.puedeGestionarDuplicados
      ? this.alertasDuplicadosService.resumen()
      : crearResumenAlertasVacio()
  );

  readonly alertasPendientesRecientes = computed<AlertaDuplicadoResumen[]>(() => {
    if (!this.puedeGestionarDuplicados) {
      return [];
    }
    const mapaPorId = new Map<number, AlertaDuplicadoResumen>();
    for (const alertas of this.alertasDuplicadosService.indicePorPeticion().values()) {
      for (const alerta of alertas) {
        if (alerta.estado_revision === 'PENDIENTE' && !mapaPorId.has(alerta.id_alerta)) {
          mapaPorId.set(alerta.id_alerta, alerta);
        }
      }
    }
    return Array.from(mapaPorId.values())
      .sort((a, b) => {
        const fechaB = Date.parse(b.fecha_creacion || '') || 0;
        const fechaA = Date.parse(a.fecha_creacion || '') || 0;
        if (fechaB !== fechaA) {
          return fechaB - fechaA;
        }
        return b.id_alerta - a.id_alerta;
      })
      .slice(0, MAX_ALERTAS_PENDIENTES_DASHBOARD);
  });

  get puedeGestionarDuplicados(): boolean {
    return this.alertasDuplicadosService.puedeGestionarAlertas();
  }

  constructor(
    private dashboardService: DashboardJuridicoService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {
    inject(RealtimeEventosService)
      .on(['peticion.*', 'clinica.atencion_registrada', 'adopcion.catalogo_actualizado'])
      .pipe(debounceTime(1000), takeUntilDestroyed())
      .subscribe(() => this.cargarDatos(true));
  }

  ngOnInit(): void {
    this.cargarDatos(false);
  }

  ngOnDestroy(): void {
    this.duplicadosSub?.unsubscribe();
    this.destruirGraficas();
  }

  cargarDatos(forzarDuplicados: boolean = false): void {
    this.cargando = true;
    this.errorCarga = '';
    this.cargarAlertasDuplicados(forzarDuplicados);

    this.dashboardService.obtenerDatosDashboard().subscribe({
      next: (datos) => {
        this.metricas = datos;
        this.cargando = false;
        this.cdr.detectChanges();

        // Renderizar las 3 gráficas en el siguiente ciclo
        setTimeout(() => {
          this.construirGraficas();
        }, 80);
      },
      error: (err) => {
        console.error('Error al cargar métricas del Dashboard Jurídico:', err);
        this.cargando = false;
        this.errorCarga = 'No se pudieron sincronizar los datos del servidor.';
        this.cdr.detectChanges();
      }
    });
  }

  private destruirGraficas(): void {
    if (this.chartPeticiones) {
      this.chartPeticiones.destroy();
      this.chartPeticiones = undefined;
    }
    if (this.chartVeterinarios) {
      this.chartVeterinarios.destroy();
      this.chartVeterinarios = undefined;
    }
    if (this.chartCBA) {
      this.chartCBA.destroy();
      this.chartCBA = undefined;
    }
  }

  private construirGraficas(): void {
    this.destruirGraficas();
    this.crearGraficaPeticiones();
    this.crearGraficaVeterinarios();
    this.crearGraficaCBA();
  }

  // Getters para cálculos analíticos
  get totalCasosAsignados(): number {
    const total = this.metricas?.peticiones?.total || 0;
    const pendientes = this.metricas?.peticiones?.pendientes || 0;
    return Math.max(0, total - pendientes);
  }

  get porcentajeEfectividadGlobal(): number {
    const total = this.metricas?.peticiones?.total || 0;
    const finalizadas = this.metricas?.peticiones?.finalizadas || 0;
    if (total === 0) return 0;
    return Math.min(100, Math.round((finalizadas / total) * 100));
  }

  get porcentajePendientes(): number {
    const total = this.metricas?.peticiones?.total || 0;
    return total > 0 ? Math.round(((this.metricas?.peticiones?.pendientes || 0) / total) * 100) : 0;
  }

  get porcentajeEnProceso(): number {
    const total = this.metricas?.peticiones?.total || 0;
    return total > 0 ? Math.round(((this.metricas?.peticiones?.enProceso || 0) / total) * 100) : 0;
  }

  get porcentajeFinalizadas(): number {
    const total = this.metricas?.peticiones?.total || 0;
    return total > 0 ? Math.round(((this.metricas?.peticiones?.finalizadas || 0) / total) * 100) : 0;
  }

  irACasosUrgentes(): void {
    this.verCasos.emit();
    this.router.navigate(['/inicio-admin/peticion'], { queryParams: { tab: 'peticiones', urgentes: 'true' } });
  }

  /**
   * Formatea una cadena a Title Case (ej. "RUBY NORAYDA" -> "Ruby Norayda").
   */
  formatearTitleCase(texto: string): string {
    return (texto || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Resuelve el color semántico diferenciado para cada estado en las gráficas:
   * - En revisión: Índigo #4141A5
   * - En observación: Azul medio #0284C7
   * - En tratamiento / Crítico / Urgente: Rojo clínico #C83E4D
   * - En proceso / En curso: Violeta #7C3AED
   * - Asignada / Pendiente / Advertencia: Dorado #F1C63C
   * - Alta médica / Duplicada / Descartada: Gris #94A3B8
   * - Finalizada / Cerrada / Apto / Adopción: Tinta #170B3D
   */
  obtenerColorGrafica(nombre: string, indexFallback: number = 0): string {
    const n = (nombre || '').toLowerCase();
    if (n.includes('revis')) {
      return '#4141A5';
    }
    if (n.includes('observaci')) {
      return '#0284C7';
    }
    if (n.includes('tratam') || n.includes('crit') || n.includes('urgente') || n.includes('grave')) {
      return '#C83E4D';
    }
    if (n.includes('proceso') || n.includes('curso')) {
      return '#7C3AED';
    }
    if (n.includes('pend') || n.includes('asig') || n.includes('advert')) {
      return '#F1C63C';
    }
    if (n.includes('alta') || n.includes('duplic') || n.includes('descart') || n.includes('anulad')) {
      return '#94A3B8';
    }
    if (n.includes('finaliz') || n.includes('cerr') || n.includes('atendid') || n.includes('resuelt') || n.includes('adop') || n.includes('apto') || n.includes('egres')) {
      return '#170B3D';
    }
    const paleta = ['#4141A5', '#0284C7', '#F1C63C', '#C83E4D', '#94A3B8', '#170B3D', '#7C3AED'];
    return paleta[indexFallback % paleta.length];
  }

  /**
   * Mapea un estado semántico a las clases CSS permitidas del Panel Jurídico:
   * - Crítico / Urgente / Tratamiento: bg-[#FEECEB] text-[#B42318] border-[#F5B7B1]
   * - Pendientes / Advertencia: bg-[#FFF4E5] text-[#9A5B13] border-[#FCD9A6]
   * - En Proceso / En Curso: bg-[#4141A5]/5 text-[#4141A5] border-[#4141A5]/20
   * - Finalizadas / Óptimo / Apto: bg-[#ECFDF3] text-[#067647] border-[#ABEFC6]
   */
  obtenerClaseEstadoBadge(estado: string): string {
    const e = (estado || '').toLowerCase();
    if (e.includes('tratam') || e.includes('crit') || e.includes('urgente') || e.includes('grave')) {
      return 'bg-[#FEECEB] text-[#B42318] border-[#F5B7B1]';
    }
    if (e.includes('pend') || e.includes('advert') || e.includes('bajo')) {
      return 'bg-[#FFF4E5] text-[#9A5B13] border-[#FCD9A6]';
    }
    if (e.includes('proceso') || e.includes('curso') || e.includes('asig') || e.includes('observ')) {
      return 'bg-[#4141A5]/5 text-[#4141A5] border-[#4141A5]/20';
    }
    if (e.includes('adop') || e.includes('finaliz') || e.includes('optimo') || e.includes('recuperad') || e.includes('favor')) {
      return 'bg-slate-100 text-slate-700 border-slate-200';
    }
    return 'bg-slate-50 text-slate-600 border-slate-200';
  }

  /**
   * 1. Gráfica de Dona: Total de peticiones y distribución de estados
   */
  private crearGraficaPeticiones(): void {
    if (!this.chartPeticionesRef?.nativeElement) return;

    const estados = Object.keys(this.metricas.peticiones.distribucionEstados);
    const valores = Object.values(this.metricas.peticiones.distribucionEstados);

    const labels = estados.length > 0 ? estados : ['Pendientes', 'En Proceso', 'Finalizadas'];
    const data = valores.length > 0 ? valores : [
      this.metricas.peticiones.pendientes,
      this.metricas.peticiones.enProceso,
      this.metricas.peticiones.finalizadas
    ];

    const ctx = this.chartPeticionesRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const paletaFallback = ['#4141A5', '#0284C7', '#F1C63C', '#C83E4D', '#94A3B8', '#170B3D', '#7C3AED'];
    const usados = new Set<string>();
    const colores = labels.map((label, idx) => {
      let color = this.obtenerColorGrafica(label, idx);
      if (usados.has(color)) {
        const alternativo = paletaFallback.find((c) => !usados.has(c));
        if (alternativo) {
          color = alternativo;
        }
      }
      usados.add(color);
      return color;
    });

    const totalPeticiones =
      this.metricas?.peticiones?.total ||
      data.reduce((acc, val) => acc + (Number(val) || 0), 0);

    const centerTextPlugin: Plugin<'doughnut'> = {
      id: 'centerTextPlugin',
      afterDraw: (chart) => {
        const { ctx: chartCtx, chartArea } = chart;
        if (!chartArea) return;

        const centerX = (chartArea.left + chartArea.right) / 2;
        const centerY = (chartArea.top + chartArea.bottom) / 2;

        chartCtx.save();
        chartCtx.textAlign = 'center';
        chartCtx.textBaseline = 'middle';

        chartCtx.font = "bold 24px 'Nunito', sans-serif";
        chartCtx.fillStyle = '#170B3D';
        chartCtx.fillText(String(totalPeticiones), centerX, centerY - 7);

        chartCtx.font = "bold 11px 'Nunito', sans-serif";
        chartCtx.fillStyle = '#64748B';
        chartCtx.fillText('TOTAL CASOS', centerX, centerY + 13);

        chartCtx.restore();
      }
    };

    this.chartPeticiones = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colores,
          borderWidth: 2,
          borderColor: '#FFFFFF',
          borderRadius: 4,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 14,
              font: { family: 'Nunito', size: 11, weight: 'bold' },
              color: '#475569'
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const total = (context.dataset.data as number[]).reduce(
                  (a, b) => Number(a) + Number(b),
                  0
                );
                const valor = Number(context.raw || 0);
                const porcentaje = total > 0 ? Math.round((valor / total) * 100) : 0;
                return ` ${context.label}: ${valor} (${porcentaje}%)`;
              }
            }
          }
        },
        cutout: '72%'
      },
      plugins: [centerTextPlugin]
    });
  }

  /**
   * 2. Gráfica de Barras Apiladas: Casos asignados y sus estados por veterinario
   */
  private crearGraficaVeterinarios(): void {
    if (!this.chartVeterinariosRef?.nativeElement) return;

    const ctx = this.chartVeterinariosRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Tomamos hasta 7 veterinarios más activos y normalizamos sus nombres a Title Case
    const vets = this.metricas.casosVeterinarios.slice(0, 7);
    const labels = vets.length > 0
      ? vets.map((v) => {
          const primerosDosNombres = (v.nombre_completo || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .join(' ');
          return this.formatearTitleCase(primerosDosNombres) || 'Sin nombre';
        })
      : ['Sin asignación'];

    const dataPendientes = vets.length > 0 ? vets.map((v) => v.pendientes) : [0];
    const dataEnProceso = vets.length > 0 ? vets.map((v) => v.en_proceso) : [0];
    const dataFinalizadas = vets.length > 0 ? vets.map((v) => v.finalizadas) : [0];

    this.chartVeterinarios = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Pendiente',
            data: dataPendientes,
            backgroundColor: '#94A3B8',
            borderRadius: 4,
            maxBarThickness: 32
          },
          {
            label: 'En Proceso',
            data: dataEnProceso,
            backgroundColor: '#4141A5',
            borderRadius: 4,
            maxBarThickness: 32
          },
          {
            label: 'Finalizada',
            data: dataFinalizadas,
            backgroundColor: '#170B3D',
            borderRadius: 4,
            maxBarThickness: 32
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: {
              font: { family: 'Nunito', size: 11 },
              color: '#64748B'
            }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              font: { family: 'Nunito', size: 11 },
              color: '#64748B'
            },
            grid: { color: '#EEF0F3' }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 10,
              usePointStyle: true,
              font: { family: 'Nunito', size: 11, weight: 'bold' },
              color: '#475569'
            }
          },
          tooltip: {
            callbacks: {
              footer: (tooltipItems) => {
                const total = tooltipItems.reduce(
                  (acc, item) => acc + (Number(item.parsed?.y ?? item.raw) || 0),
                  0
                );
                return `Total asignados: ${total}`;
              }
            }
          }
        }
      }
    });
  }

  /**
   * 3. Gráfica de Barras Horizontales: Animales ingresados al CBA y sus estados clínicos
   */
  private crearGraficaCBA(): void {
    if (!this.chartCBARef?.nativeElement) return;

    const ctx = this.chartCBARef.nativeElement.getContext('2d');
    if (!ctx) return;

    let obs = Number(this.metricas?.cba?.enObservacion ?? 0);
    let trat = Number(this.metricas?.cba?.enTratamiento ?? 0);
    let adop = Number(this.metricas?.cba?.aptosAdopcion ?? 0);

    const dist = this.metricas?.cba?.distribucionEstados;
    if (obs === 0 && trat === 0 && adop === 0 && dist && Object.keys(dist).length > 0) {
      for (const [clave, valor] of Object.entries(dist)) {
        const k = clave.toLowerCase();
        const cantidad = Number(valor) || 0;
        if (k.includes('tratam') || k.includes('crit') || k.includes('grave')) {
          trat += cantidad;
        } else if (k.includes('adop') || k.includes('apto') || k.includes('recuperad') || k.includes('favor')) {
          adop += cantidad;
        } else if (k.includes('observ') || k.includes('evalua')) {
          obs += cantidad;
        }
      }
    }

    const labels = ['En Observación', 'En Tratamiento', 'Apto Adopción'];
    const data = [obs, trat, adop];
    const colores = ['#4141A5', '#C83E4D', '#170B3D'];

    this.chartCBA = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Seres en CBA',
          data,
          backgroundColor: colores,
          borderRadius: 6,
          barThickness: 22
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              font: { family: 'Nunito', size: 11 },
              color: '#64748B'
            },
            grid: { color: '#EEF0F3' }
          },
          y: {
            grid: { display: false },
            ticks: {
              font: { family: 'Nunito', size: 11, weight: 'bold' },
              color: '#475569'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const datasetData = context.dataset.data as number[];
                const total = datasetData.reduce((a, b) => Number(a) + Number(b), 0);
                const valor = Number(context.parsed?.x ?? context.raw ?? 0);
                const porcentaje = total > 0 ? Math.round((valor / total) * 100) : 0;
                return ` ${context.label}: ${valor} seres (${porcentaje}%)`;
              }
            }
          }
        }
      }
    });
  }

  irAGestionPeticiones(): void {
    this.verCasos.emit();
    this.router.navigate(['/inicio-admin/peticion'], { queryParams: { tab: 'peticiones' } });
  }

  /**
   * Consulta o sincroniza las alertas de duplicados desde `AlertasDuplicadosService`
   * únicamente para roles autorizados (Administrador y Jurídico).
   */
  cargarAlertasDuplicados(forzarRecarga: boolean = false): void {
    if (!this.puedeGestionarDuplicados) {
      this.cargandoDuplicados = false;
      this.errorDuplicados = '';
      return;
    }

    this.cargandoDuplicados = true;
    this.errorDuplicados = '';
    this.duplicadosSub?.unsubscribe();

    this.duplicadosSub = this.alertasDuplicadosService
      .cargarIndiceAlertas({ page_size: 100 }, forzarRecarga)
      .subscribe({
        next: () => {
          this.cargandoDuplicados = false;
          this.errorDuplicados = '';
          this.cdr.detectChanges();
        },
        error: (err: ErrorDuplicadosApi) => {
          this.cargandoDuplicados = false;
          this.errorDuplicados =
            err?.mensaje || 'No se pudieron consultar las alertas de duplicados.';
          this.cdr.detectChanges();
        }
      });
  }

  irABandejaDuplicados(): void {
    if (!this.puedeGestionarDuplicados) {
      return;
    }
    this.router.navigate(['/inicio-admin/peticion'], {
      queryParams: { vista: 'duplicados' }
    });
  }

  abrirAlertaDuplicado(idAlerta: number): void {
    if (!this.puedeGestionarDuplicados || !Number.isInteger(idAlerta) || idAlerta <= 0) {
      return;
    }
    this.router.navigate(['/inicio-admin/peticion'], {
      queryParams: { vista: 'duplicados', alerta: idAlerta }
    });
  }

  obtenerRadicadoAlerta(alerta: AlertaDuplicadoResumen, lado: 'menor' | 'mayor'): string {
    const pet = lado === 'menor' ? alerta.peticion_menor : alerta.peticion_mayor;
    const idFallback = lado === 'menor' ? alerta.peticion_menor_id : alerta.peticion_mayor_id;
    return pet?.numero_radicado || `Petición #${idFallback}`;
  }

  obtenerTipoAlerta(alerta: AlertaDuplicadoResumen): string {
    return (
      alerta.peticion_mayor?.tipo?.nombre ||
      alerta.peticion_menor?.tipo?.nombre ||
      'Reporte ciudadano'
    );
  }

  formatearSimilitudAlerta(alerta: AlertaDuplicadoResumen): string {
    return this.alertasDuplicadosService.formatearPorcentajeSimilitud(alerta.similitud_texto);
  }

  formatearDistanciaAlerta(alerta: AlertaDuplicadoResumen): string {
    return this.alertasDuplicadosService.formatearDistanciaMetros(alerta.distancia_metros);
  }
}
