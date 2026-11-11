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
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Chart } from 'chart.js/auto';
import {
  SuperAdminService,
  EstadisticasSuperAdmin,
  AdministradorUsuario,
  VeterinarioRendimiento
} from '../services/super-admin.service';
import { SedesService, Sede } from '../services/sedes.service';

@Component({
  selector: 'app-super-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './super-admin-dashboard.html',
  styleUrl: './super-admin-dashboard.css'
})
export class SuperAdminDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartEstadosCanvas') chartEstadosCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartRolesCanvas') chartRolesCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartPrioridadCanvas') chartPrioridadCanvas?: ElementRef<HTMLCanvasElement>;

  private chartEstados?: Chart;
  private chartRoles?: Chart;
  private chartPrioridad?: Chart;

  cargando = true;
  errorMensaje = '';

  estadisticas: EstadisticasSuperAdmin | null = null;
  administradores: AdministradorUsuario[] = [];
  sedes: Sede[] = [];

  constructor(
    private superAdminService: SuperAdminService,
    private sedesService: SedesService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarDatosDashboard();
  }

  ngAfterViewInit(): void {
    if (!this.cargando && this.estadisticas) {
      this.renderizarGraficas();
    }
  }

  ngOnDestroy(): void {
    this.destruirGraficas();
  }

  cargarDatosDashboard(): void {
    this.cargando = true;
    this.errorMensaje = '';

    forkJoin({
      estadisticas: this.superAdminService.obtenerEstadisticas().pipe(
        catchError((err) => {
          console.error('Error al cargar estadísticas del Superadministrador:', err);
          if (err?.status === 401) {
            this.errorMensaje = 'Sesión no autenticada o expirada (HTTP 401). Por favor inicia sesión.';
          } else if (err?.status === 403) {
            this.errorMensaje = err?.error?.detail || 'Permisos insuficientes: acceso exclusivo para Super Administrador (HTTP 403).';
          } else if (err?.status >= 500) {
            this.errorMensaje = 'Error interno del servidor al consultar estadísticas (HTTP 500).';
          } else {
            this.errorMensaje =
              err?.error?.detail ||
              'No fue posible obtener las estadísticas institucionales desde el servidor.';
          }
          return of(null);
        })
      ),
      administradores: this.superAdminService.listarAdministradores().pipe(
        catchError((err) => {
          console.error('Error al listar administradores:', err);
          return of([] as AdministradorUsuario[]);
        })
      ),
      sedes: this.sedesService.listarSedes().pipe(
        catchError((err) => {
          console.error('Error al listar sedes:', err);
          return of([] as Sede[]);
        })
      )
    }).subscribe(({ estadisticas, administradores, sedes }) => {
      this.estadisticas = estadisticas;
      this.administradores = administradores;
      this.sedes = sedes;
      this.cargando = false;
      this.cdr.detectChanges();
      setTimeout(() => this.renderizarGraficas(), 50);
    });
  }

  get totalAdministradores(): number {
    return (
      this.estadisticas?.usuarios?.por_rol?.administrador ??
      this.administradores.length
    );
  }

  get administradoresActivos(): number {
    return this.administradores.filter((a) => a.activo).length;
  }

  get administradoresInactivos(): number {
    return this.administradores.filter((a) => !a.activo).length;
  }

  get totalSedes(): number {
    return this.estadisticas?.sedes?.total_sedes ?? this.sedes.length;
  }

  get sedesActivas(): number {
    return (
      this.estadisticas?.sedes?.activas ??
      this.sedes.filter((s) => s.activo).length
    );
  }

  get sedesInactivas(): number {
    return (
      this.estadisticas?.sedes?.inactivas ??
      this.sedes.filter((s) => !s.activo).length
    );
  }

  get rendimientoVeterinarios(): VeterinarioRendimiento[] {
    return this.estadisticas?.por_veterinario || [];
  }

  get prioridadesLista(): { nombre: string; total: number }[] {
    const mapa = this.estadisticas?.por_prioridad || {};
    return Object.entries(mapa).map(([nombre, total]) => ({
      nombre,
      total: Number(total || 0)
    }));
  }

  private destruirGraficas(): void {
    if (this.chartEstados) {
      this.chartEstados.destroy();
      this.chartEstados = undefined;
    }
    if (this.chartRoles) {
      this.chartRoles.destroy();
      this.chartRoles = undefined;
    }
    if (this.chartPrioridad) {
      this.chartPrioridad.destroy();
      this.chartPrioridad = undefined;
    }
  }

  private renderizarGraficas(): void {
    if (!this.estadisticas) return;
    this.destruirGraficas();

    // 1. Gráfica de Peticiones por Estado
    if (this.chartEstadosCanvas?.nativeElement) {
      const estados = this.estadisticas.por_estado || [];
      const labels =
        estados.length > 0
          ? estados.map((e) => e.estado)
          : ['Pendientes', 'En Proceso', 'Finalizadas'];
      const valores =
        estados.length > 0
          ? estados.map((e) => e.total)
          : [
              this.estadisticas.pendientes || 0,
              this.estadisticas.en_proceso || 0,
              this.estadisticas.finalizadas || 0
            ];

      this.chartEstados = new Chart(this.chartEstadosCanvas.nativeElement, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [
            {
              data: valores,
              backgroundColor: [
                '#4141A5',
                '#F1C63C',
                '#10B981',
                '#170B3D',
                '#F43F5E',
                '#64748B'
              ],
              borderWidth: 2,
              borderColor: '#ffffff',
              hoverOffset: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '64%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                font: { family: 'Nunito', size: 11, weight: 'bold' },
                color: '#334155',
                padding: 12
              }
            }
          }
        }
      });
    }

    // 2. Gráfica de Usuarios por Rol Institucional
    if (this.chartRolesCanvas?.nativeElement) {
      const roles = this.estadisticas.usuarios?.por_rol || {
        administrador: 0,
        juridico: 0,
        veterinario: 0,
        peticionario: 0,
        super_administrador: 0
      };

      this.chartRoles = new Chart(this.chartRolesCanvas.nativeElement, {
        type: 'bar',
        data: {
          labels: [
            'Super Admin',
            'Administradores',
            'Jurídicos',
            'Veterinarios',
            'Peticionarios'
          ],
          datasets: [
            {
              label: 'Usuarios registrados',
              data: [
                roles.super_administrador || 0,
                roles.administrador || 0,
                roles.juridico || 0,
                roles.veterinario || 0,
                roles.peticionario || 0
              ],
              backgroundColor: [
                '#F1C63C',
                '#170B3D',
                '#4141A5',
                '#10B981',
                '#64748B'
              ],
              borderRadius: 8,
              maxBarThickness: 38
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1, font: { family: 'Nunito', size: 11 } },
              grid: { color: '#F1F5F9' }
            },
            x: {
              ticks: { font: { family: 'Nunito', size: 11, weight: 'bold' } },
              grid: { display: false }
            }
          }
        }
      });
    }

    // 3. Gráfica de Peticiones por Prioridad / Tipo
    if (this.chartPrioridadCanvas?.nativeElement) {
      const tipos = this.estadisticas.por_tipo || [];
      const prioridades = this.prioridadesLista;

      const usarTipos = tipos.length > 0;
      const labels = usarTipos
        ? tipos.map((t) => t.tipo)
        : prioridades.map((p) => p.nombre);
      const data = usarTipos
        ? tipos.map((t) => t.total)
        : prioridades.map((p) => p.total);

      this.chartPrioridad = new Chart(this.chartPrioridadCanvas.nativeElement, {
        type: 'bar',
        data: {
          labels: labels.length > 0 ? labels : ['Sin datos'],
          datasets: [
            {
              label: usarTipos ? 'Casos por Tipo' : 'Casos por Prioridad',
              data: data.length > 0 ? data : [0],
              backgroundColor: '#4141A5',
              borderRadius: 8,
              maxBarThickness: 36
            }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: { stepSize: 1, font: { family: 'Nunito', size: 11 } },
              grid: { color: '#F1F5F9' }
            },
            y: {
              ticks: { font: { family: 'Nunito', size: 11, weight: 'bold' } },
              grid: { display: false }
            }
          }
        }
      });
    }
  }
}

