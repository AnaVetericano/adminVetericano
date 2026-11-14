import { Component, ElementRef, ViewChild, OnInit, OnDestroy, ChangeDetectorRef, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth';
import { Chart } from 'chart.js/auto';
import { CommonModule, NgIf } from '@angular/common';
import { Subscription } from 'rxjs';
import { AlertasDuplicadosService } from '../services/alertas-duplicados.service';
import {
  ErrorDuplicadosApi,
  ResumenConteosAlertas,
  crearResumenAlertasVacio
} from '../models/duplicados.model';

@Component({
  selector: 'app-graficas',
  imports: [NgIf, CommonModule, RouterLink],
  templateUrl: './graficas.html',
  styleUrl: './graficas.css',
})
export class Graficas implements OnInit, OnDestroy {
  @ViewChild('GraficUsers') GraficUsers!: ElementRef<HTMLCanvasElement>;
  @ViewChild('GraficUsersRol') GraficUsersRol!: ElementRef<HTMLCanvasElement>;

  chartUsersActive: Chart | undefined;
  chartUsersRol: Chart | undefined;

  cargandoGrafica: boolean = true;
  activosPie = 0;
  inactivosPie = 0;
  rolPet = 0;
  rolVet = 0;
  rolJud = 0;
  rolAdm = 0;

  readonly alertasDuplicadosService = inject(AlertasDuplicadosService);
  cargandoDuplicados = false;
  errorDuplicados = '';
  private duplicadosSub?: Subscription;

  readonly resumenDuplicados = computed<ResumenConteosAlertas>(() =>
    this.puedeGestionarDuplicados
      ? this.alertasDuplicadosService.resumen()
      : crearResumenAlertasVacio()
  );

  get puedeGestionarDuplicados(): boolean {
    return this.alertasDuplicadosService.puedeGestionarAlertas();
  }

  get totalPendientesDuplicados(): number {
    return this.puedeGestionarDuplicados ? this.alertasDuplicadosService.totalPendientes() : 0;
  }

  get totalUsuarios(): number {
    return this.activosPie + this.inactivosPie;
  }

  get totalOperativo(): number {
    return this.rolAdm + this.rolJud + this.rolVet;
  }

  constructor(private authService: AuthService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.ListAllUsersActives();
    this.cargarResumenDuplicados(false);
  }

  ngOnDestroy(): void {
    this.duplicadosSub?.unsubscribe();
    this.chartUsersActive?.destroy();
    this.chartUsersRol?.destroy();
  }

  /**
   * Reutiliza `AlertasDuplicadosService` para obtener el contador reactivo de
   * posibles duplicados únicamente cuando el rol activo está autorizado.
   */
  cargarResumenDuplicados(forzarRecarga: boolean = false): void {
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
            err?.mensaje || 'No se pudo consultar el resumen de duplicados.';
          this.cdr.detectChanges();
        }
      });
  }

  ListAllUsersActives() {
    this.cargandoGrafica = true;

    this.authService.listUsersActive().subscribe({
      next: (response: any[]) => {
        const lista = Array.isArray(response) ? response : [];
        this.activosPie = lista.filter(u => u.activo === true).length;
        this.inactivosPie = lista.filter(u => u.activo === false).length;

        const normalizarRol = (u: any): string => {
          const id = Number(u.id_rol);
          if (id === 1) return 'admin';
          if (id === 2) return 'juridico';
          if (id === 3) return 'veterinario';
          if (id === 4) return 'peticionario';
          const n = String(u.nombre_rol || '').toLowerCase();
          if (n.includes('adm')) return 'admin';
          if (n.includes('jur')) return 'juridico';
          if (n.includes('vet')) return 'veterinario';
          if (n.includes('pet')) return 'peticionario';
          return '';
        };

        this.rolAdm = lista.filter(u => normalizarRol(u) === 'admin').length;
        this.rolJud = lista.filter(u => normalizarRol(u) === 'juridico').length;
        this.rolVet = lista.filter(u => normalizarRol(u) === 'veterinario').length;
        this.rolPet = lista.filter(u => normalizarRol(u) === 'peticionario').length;

        this.cargandoGrafica = false;

        this.LoadGraficUsersActive();
        this.LoadGraficUsersRol();

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error obteniendo usuarios:', err);
        this.cargandoGrafica = false;
        this.cdr.detectChanges();
      }
    });
  }

  LoadGraficUsersActive() {
    if (!this.GraficUsers) return;

    if (this.chartUsersActive) {
      this.chartUsersActive.destroy();
    }

    this.chartUsersActive = new Chart(this.GraficUsers.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Activos: ' + this.activosPie, 'Inactivos: ' + this.inactivosPie],
        datasets: [{
          data: [this.activosPie, this.inactivosPie],
          backgroundColor: [
            '#4141A5', // Indigo corporativo VETERICANO
            '#64748B'  // Slate corporativo
          ],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              font: { family: 'Nunito', size: 12, weight: 'bold' },
              color: '#475569',
              padding: 16
            }
          }
        }
      }
    });
  }

  LoadGraficUsersRol() {
    if (!this.GraficUsersRol) return;

    if (this.chartUsersRol) {
      this.chartUsersRol.destroy();
    }

    this.chartUsersRol = new Chart(this.GraficUsersRol.nativeElement, {
      type: 'doughnut',
      data: {
        labels: [
          'Administradores: ' + this.rolAdm,
          'Jurídicos: ' + this.rolJud,
          'Veterinarios: ' + this.rolVet,
          'Peticionarios: ' + this.rolPet
        ],
        datasets: [{
          data: [this.rolAdm, this.rolJud, this.rolVet, this.rolPet],
          backgroundColor: [
            '#170B3D', // Deep Navy institucional
            '#4141A5', // Indigo corporativo
            '#6366F1', // Indigo claro
            '#64748B'  // Slate institucional
          ],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              font: { family: 'Nunito', size: 12, weight: 'bold' },
              color: '#475569',
              padding: 16
            }
          }
        }
      }
    });
  }
}
