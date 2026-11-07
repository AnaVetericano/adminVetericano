import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  Output,
  EventEmitter
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Chart } from 'chart.js/auto';
import {
  DashboardJuridicoService,
  ResumenDashboardJuridico,
  CasoVeterinario
} from '../services/dashboard-juridico.service';

@Component({
  selector: 'app-dashboard-juridico',
  standalone: true,
  imports: [CommonModule],
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

  constructor(
    private dashboardService: DashboardJuridicoService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  ngOnDestroy(): void {
    this.destruirGraficas();
  }

  cargarDatos(): void {
    this.cargando = true;
    this.errorCarga = '';

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

  /**
   * Resuelve el color exacto para las series de datos según la paleta institucional jurídica:
   * - Serie Primaria (En proceso / En observación): Índigo #4338CA
   * - Serie Secundaria (Pendiente / Asignada): Gris azulado #94A3B8
   * - Serie Oscura (En revisión / Finalizada / Egresado / Adopción): Azul marino casi negro #151236
   * - Serie Alerta (En tratamiento / Crítico / Urgente): Rojo #DC2626
   */
  obtenerColorGrafica(nombre: string, indexFallback: number = 0): string {
    const n = (nombre || '').toLowerCase();
    // Serie Alerta: Rojo #DC2626 (En tratamiento / Crítico / Urgente / Grave)
    if (n.includes('tratam') || n.includes('crit') || n.includes('urgente') || n.includes('grave')) {
      return '#DC2626';
    }
    // Serie Primaria: Índigo #4338CA (En proceso / En curso / En observación)
    if (n.includes('proceso') || n.includes('curso') || n.includes('observaci')) {
      return '#4338CA';
    }
    // Serie Secundaria: Gris azulado #94A3B8 (Pendiente / Asignada / Advertencia)
    if (n.includes('pend') || n.includes('asig') || n.includes('advert')) {
      return '#94A3B8';
    }
    // Serie Oscura: Azul marino casi negro #151236 (En revisión / Finalizada / Cerrada / Adopción)
    if (n.includes('finaliz') || n.includes('revis') || n.includes('cerr') || n.includes('adop') || n.includes('egres')) {
      return '#151236';
    }
    const paleta = ['#4338CA', '#94A3B8', '#151236', '#DC2626'];
    return paleta[indexFallback % paleta.length];
  }

  /**
   * Mapea un estado semántico a las clases CSS permitidas del Panel Jurídico:
   * - Crítico / Urgente / Tratamiento: bg-red-50/70 border-red-100 text-red-600
   * - Pendientes / Advertencia: bg-amber-50 border-amber-100 text-amber-700
   * - En Proceso / En Curso: bg-blue-50 border-blue-100 text-blue-600
   * - Finalizadas / Óptimo / Apto: bg-emerald-50 border-emerald-100 text-emerald-600
   */
  obtenerClaseEstadoBadge(estado: string): string {
    const e = (estado || '').toLowerCase();
    if (e.includes('tratam') || e.includes('crit') || e.includes('urgente') || e.includes('grave')) {
      return 'bg-red-50/70 text-red-600 border-red-100';
    }
    if (e.includes('pend') || e.includes('advert') || e.includes('bajo')) {
      return 'bg-amber-50 text-amber-700 border-amber-100';
    }
    if (e.includes('proceso') || e.includes('curso') || e.includes('asig') || e.includes('observ')) {
      return 'bg-blue-50 text-blue-600 border-blue-100';
    }
    if (e.includes('adop') || e.includes('finaliz') || e.includes('optimo') || e.includes('recuperad')) {
      return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    }
    return 'bg-indigo-50 text-indigo-600 border-indigo-100';
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

    const colores = labels.map((label, idx) => this.obtenerColorGrafica(label, idx));

    this.chartPeticiones = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colores,
          borderWidth: 2,
          borderColor: '#ffffff',
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
              boxWidth: 12,
              font: { family: 'Nunito', size: 12, weight: 'bold' },
              color: '#64748B' // text-slate-500
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const total = context.dataset.data.reduce((a: any, b: any) => Number(a) + Number(b), 0);
                const valor = Number(context.raw || 0);
                const porcentaje = total > 0 ? Math.round((valor / total) * 100) : 0;
                return ` ${context.label}: ${valor} casos (${porcentaje}%)`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });
  }

  /**
   * 2. Gráfica de Barras Apiladas: Casos asignados y sus estados por veterinario
   * - Pendiente: #94A3B8 (Serie Secundaria)
   * - En Proceso: #4338CA (Serie Primaria)
   * - Finalizada: #151236 (Serie Oscura)
   */
  private crearGraficaVeterinarios(): void {
    if (!this.chartVeterinariosRef?.nativeElement) return;

    const ctx = this.chartVeterinariosRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Tomamos hasta 7 veterinarios más activos
    const vets = this.metricas.casosVeterinarios.slice(0, 7);
    const labels = vets.length > 0
      ? vets.map((v) => v.nombre_completo.split(' ')[0] + ' ' + (v.nombre_completo.split(' ')[1] || ''))
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
            backgroundColor: '#94A3B8', // Serie Secundaria: Gris azulado
            borderRadius: 6
          },
          {
            label: 'En Proceso',
            data: dataEnProceso,
            backgroundColor: '#4338CA', // Serie Primaria: Índigo
            borderRadius: 6
          },
          {
            label: 'Finalizada',
            data: dataFinalizadas,
            backgroundColor: '#151236', // Serie Oscura: Azul marino casi negro
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: {
              font: { family: 'Nunito', size: 11, weight: 'bold' },
              color: '#64748B' // text-slate-500
            }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              font: { family: 'Nunito', size: 11 },
              color: '#94A3B8' // text-slate-400
            },
            grid: { color: '#F1F5F9' } // border-slate-100
          }
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 12,
              font: { family: 'Nunito', size: 11, weight: 'bold' },
              color: '#64748B' // text-slate-500
            }
          }
        }
      }
    });
  }

  /**
   * 3. Gráfica Polar Area: Animales ingresados al CBA y sus estados
   * - En Observación: #4338CA (Serie Primaria)
   * - En Tratamiento: #DC2626 (Serie Alerta)
   * - Apto Adopción: #151236 (Serie Oscura)
   */
  private crearGraficaCBA(): void {
    if (!this.chartCBARef?.nativeElement) return;

    const ctx = this.chartCBARef.nativeElement.getContext('2d');
    if (!ctx) return;

    const estados = Object.keys(this.metricas.cba.distribucionEstados);
    const valores = Object.values(this.metricas.cba.distribucionEstados);

    const labels = estados.length > 0 ? estados : ['En Observación', 'En Tratamiento', 'Apto Adopción'];
    const data = valores.length > 0 ? valores : [
      this.metricas.cba.enObservacion || 1,
      this.metricas.cba.enTratamiento || 1,
      this.metricas.cba.aptosAdopcion || 1
    ];

    const colores = labels.map((label, idx) => this.obtenerColorGrafica(label, idx));

    this.chartCBA = new Chart(ctx, {
      type: 'polarArea',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colores,
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 12,
              font: { family: 'Nunito', size: 11, weight: 'bold' },
              color: '#64748B' // text-slate-500
            }
          }
        },
        scales: {
          r: {
            ticks: { display: false },
            grid: { color: '#E2E8F0' } // border-slate-200
          }
        }
      }
    });
  }

  irAGestionPeticiones(): void {
    this.verCasos.emit();
    this.router.navigate(['/inicio-admin/peticion'], { queryParams: { tab: 'peticiones' } });
  }
}
