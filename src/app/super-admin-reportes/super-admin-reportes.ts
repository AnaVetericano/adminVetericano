import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Chart } from 'chart.js/auto';
import {
  SuperAdminService,
  EstadisticasSuperAdmin,
  FiltroReportesSuperAdmin,
  PeticionAtendidaReporte,
  VeterinarioRendimiento
} from '../services/super-admin.service';

@Component({
  selector: 'app-super-admin-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './super-admin-reportes.html',
  styleUrl: './super-admin-reportes.css'
})
export class SuperAdminReportesComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartEstadosReporte') chartEstadosReporte?: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartVeterinariosReporte') chartVeterinariosReporte?: ElementRef<HTMLCanvasElement>;

  private chartEstados?: Chart;
  private chartVeterinarios?: Chart;

  cargando = false;
  errorMensaje = '';

  // Filtros de consulta conectados al backend
  filtros: FiltroReportesSuperAdmin = {
    fecha: '',
    fecha_desde: '',
    fecha_hasta: '',
    estado: '',
    veterinario: ''
  };

  estadisticas: EstadisticasSuperAdmin | null = null;
  peticionesAtendidas: PeticionAtendidaReporte[] = [];
  veterinariosCatalogo: VeterinarioRendimiento[] = [];

  // Modal de detalle de caso atendido
  peticionSeleccionada: PeticionAtendidaReporte | null = null;

  constructor(
    private superAdminService: SuperAdminService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.consultarReportes(true);
  }

  ngAfterViewInit(): void {
    if (!this.cargando && this.estadisticas) {
      this.renderizarGraficas();
    }
  }

  ngOnDestroy(): void {
    this.destruirGraficas();
  }

  consultarReportes(esCargaInicial = false): void {
    this.cargando = true;
    this.errorMensaje = '';

    const params: FiltroReportesSuperAdmin = {};
    if (this.filtros.fecha) params.fecha = this.filtros.fecha;
    if (this.filtros.fecha_desde) params.fecha_desde = this.filtros.fecha_desde;
    if (this.filtros.fecha_hasta) params.fecha_hasta = this.filtros.fecha_hasta;
    if (this.filtros.estado) params.estado = this.filtros.estado;
    if (this.filtros.veterinario) params.veterinario = this.filtros.veterinario;

    forkJoin({
      estadisticas: this.superAdminService.obtenerEstadisticas(params).pipe(
        catchError((err) => {
          console.error('Error al obtener estadísticas de reportes:', err);
          this.errorMensaje = this.extraerMensajeError(err);
          return of(null);
        })
      ),
      atendidas: this.superAdminService.obtenerReporteAtendidas(params).pipe(
        catchError((err) => {
          console.error('Error al obtener peticiones atendidas:', err);
          if (!this.errorMensaje) {
            this.errorMensaje = this.extraerMensajeError(err);
          }
          return of([] as PeticionAtendidaReporte[]);
        })
      )
    }).subscribe(({ estadisticas, atendidas }) => {
      this.estadisticas = estadisticas;
      this.peticionesAtendidas = atendidas || [];

      if (esCargaInicial && estadisticas?.por_veterinario) {
        this.veterinariosCatalogo = estadisticas.por_veterinario;
      } else if (this.veterinariosCatalogo.length === 0 && estadisticas?.por_veterinario) {
        this.veterinariosCatalogo = estadisticas.por_veterinario;
      }

      this.cargando = false;
      this.cdr.detectChanges();
      setTimeout(() => this.renderizarGraficas(), 50);
    });
  }

  limpiarFiltros(): void {
    this.filtros = {
      fecha: '',
      fecha_desde: '',
      fecha_hasta: '',
      estado: '',
      veterinario: ''
    };
    this.consultarReportes();
  }

  verDetalleCaso(caso: PeticionAtendidaReporte): void {
    this.peticionSeleccionada = caso;
  }

  cerrarDetalleCaso(): void {
    this.peticionSeleccionada = null;
  }

  private extraerMensajeError(err: any): string {
    const status = err?.status;
    if (status === 401) {
      return 'Sesión no autenticada o expirada (HTTP 401). Inicia sesión nuevamente.';
    }
    if (status === 403) {
      return err?.error?.detail || 'Permisos insuficientes: acceso exclusivo para Super Administrador (HTTP 403).';
    }
    if (status === 404) {
      return err?.error?.detail || 'El recurso de reportes solicitado no fue encontrado (HTTP 404).';
    }
    if (status >= 500) {
      return 'Error interno del servidor al procesar el reporte (HTTP 500).';
    }
    const body = err?.error;
    if (body && typeof body === 'object') {
      if (body.detail) return String(body.detail);
      const primerValor = Object.values(body)[0];
      if (Array.isArray(primerValor)) return primerValor.join(' ');
      if (typeof primerValor === 'string') return primerValor;
    }
    return 'No fue posible obtener los reportes estadísticos desde el servidor.';
  }

  get estadosDisponibles(): string[] {
    const lista = this.estadisticas?.por_estado || [];
    if (lista.length > 0) {
      return lista.map((e) => e.estado);
    }
    return ['Pendiente', 'En Proceso', 'Finalizada'];
  }

  private destruirGraficas(): void {
    if (this.chartEstados) {
      this.chartEstados.destroy();
      this.chartEstados = undefined;
    }
    if (this.chartVeterinarios) {
      this.chartVeterinarios.destroy();
      this.chartVeterinarios = undefined;
    }
  }

  private renderizarGraficas(): void {
    if (!this.estadisticas) return;
    this.destruirGraficas();

    if (this.chartEstadosReporte?.nativeElement) {
      const porEstado = this.estadisticas.por_estado || [];
      const labels =
        porEstado.length > 0
          ? porEstado.map((e) => e.estado)
          : ['Pendientes', 'En Proceso', 'Finalizadas'];
      const data =
        porEstado.length > 0
          ? porEstado.map((e) => e.total)
          : [
              this.estadisticas.pendientes || 0,
              this.estadisticas.en_proceso || 0,
              this.estadisticas.finalizadas || 0
            ];

      this.chartEstados = new Chart(this.chartEstadosReporte.nativeElement, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [
            {
              data,
              backgroundColor: ['#4141A5', '#F1C63C', '#10B981', '#170B3D', '#F43F5E'],
              borderWidth: 2,
              borderColor: '#ffffff'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                font: { family: 'Nunito', size: 11, weight: 'bold' }
              }
            }
          }
        }
      });
    }

    if (this.chartVeterinariosReporte?.nativeElement) {
      const vets = this.estadisticas.por_veterinario || [];
      const labels =
        vets.length > 0
          ? vets.map((v) => v.nombre_completo || `${v.nombre} ${v.apellido}`)
          : ['Sin datos'];
      const asignadas = vets.length > 0 ? vets.map((v) => v.total_asignadas) : [0];
      const atendidas = vets.length > 0 ? vets.map((v) => v.casos_atendidos) : [0];

      this.chartVeterinarios = new Chart(this.chartVeterinariosReporte.nativeElement, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Asignadas',
              data: asignadas,
              backgroundColor: '#4141A5',
              borderRadius: 6,
              maxBarThickness: 32
            },
            {
              label: 'Atendidas',
              data: atendidas,
              backgroundColor: '#10B981',
              borderRadius: 6,
              maxBarThickness: 32
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                font: { family: 'Nunito', size: 11, weight: 'bold' }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1 }
            }
          }
        }
      });
    }
  }
}

