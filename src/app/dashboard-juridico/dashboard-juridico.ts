import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectorRef
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

    this.chartPeticiones = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: [
            '#F59E0B', // Amber (Pendiente)
            '#3B82F6', // Blue (En proceso)
            '#10B981', // Emerald (Finalizada)
            '#EF4444', // Red (Urgente)
            '#8B5CF6', // Purple
            '#06B6D4'  // Cyan
          ],
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
              color: '#475569'
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
            backgroundColor: '#FBBF24', // Amber
            borderRadius: 6
          },
          {
            label: 'En Proceso',
            data: dataEnProceso,
            backgroundColor: '#3B82F6', // Blue
            borderRadius: 6
          },
          {
            label: 'Finalizada',
            data: dataFinalizadas,
            backgroundColor: '#10B981', // Emerald
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
              color: '#475569'
            }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              font: { family: 'Nunito', size: 11 },
              color: '#94a3b8'
            },
            grid: { color: '#f1f5f9' }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 12,
              font: { family: 'Nunito', size: 11, weight: 'bold' },
              color: '#475569'
            }
          }
        }
      }
    });
  }

  /**
   * 3. Gráfica de Barras Horizontales / Donut: Animales ingresados al CBA y sus estados
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

    this.chartCBA = new Chart(ctx, {
      type: 'polarArea',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: [
            'rgba(99, 102, 241, 0.75)',  // Indigo
            'rgba(245, 158, 11, 0.75)',  // Amber
            'rgba(16, 185, 129, 0.75)',  // Emerald
            'rgba(239, 68, 68, 0.75)',   // Rose
            'rgba(14, 165, 233, 0.75)'   // Sky
          ],
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
              color: '#475569'
            }
          }
        },
        scales: {
          r: {
            ticks: { display: false },
            grid: { color: '#e2e8f0' }
          }
        }
      }
    });
  }

  irAGestionPeticiones(): void {
    this.router.navigate(['/inicio-admin/peticion']);
  }
}
