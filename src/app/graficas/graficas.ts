import { Component, ElementRef, ViewChild, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
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
import { AnimalIconComponent } from '../animal-icon/animal-icon';
import { PageTitleComponent } from '../page-title/page-title';

@Component({
  selector: 'app-graficas',
  standalone: true,
  imports: [NgIf, CommonModule, RouterLink, FormsModule, AnimalIconComponent, PageTitleComponent],
  templateUrl: './graficas.html',
  styleUrl: './graficas.css',
})
export class Graficas implements OnInit, AfterViewInit, OnDestroy {
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

  usuarios: any[] = [];
  usuariosFiltrados: any[] = [];
  busquedaUsuario: string = '';
  filtroRol: string = 'TODOS';

  get totalUsuarios(): number {
    return this.activosPie + this.inactivosPie;
  }

  get totalOperativo(): number {
    return this.rolAdm + this.rolJud + this.rolVet;
  }

  get porcentajeActivos(): number {
    return this.totalUsuarios > 0 ? Math.round((this.activosPie / this.totalUsuarios) * 100) : 0;
  }

  get porcentajeOperativo(): number {
    return this.totalUsuarios > 0 ? Math.round((this.totalOperativo / this.totalUsuarios) * 100) : 0;
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

  ngAfterViewInit() {
    setTimeout(() => {
      if (!this.chartUsersActive && !this.cargandoGrafica) {
        this.LoadGraficUsersActive();
        this.LoadGraficUsersRol();
      }
    }, 200);
  }

  ListAllUsersActives() {
    this.cargandoGrafica = true;

    this.authService.listUsersActive().subscribe({
      next: (response: any[]) => {
        const lista = Array.isArray(response) ? response : [];
        this.usuarios = lista;
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

        this.filtrarUsuarios();
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

  filtrarUsuarios(): void {
    const term = (this.busquedaUsuario || '').toLowerCase().trim();
    this.usuariosFiltrados = this.usuarios.filter(u => {
      const matchTexto = !term ||
        (u.nombre && u.nombre.toLowerCase().includes(term)) ||
        (u.apellido && u.apellido.toLowerCase().includes(term)) ||
        (u.email && u.email.toLowerCase().includes(term)) ||
        (u.identificacion && String(u.identificacion).includes(term));

      if (!matchTexto) return false;

      if (this.filtroRol === 'TODOS') return true;
      const r = String(u.nombre_rol || '').toLowerCase();
      const id = Number(u.id_rol);
      if (this.filtroRol === 'ADMIN') return r.includes('adm') || id === 1;
      if (this.filtroRol === 'JURIDICO') return r.includes('jur') || id === 2;
      if (this.filtroRol === 'VETERINARIO') return r.includes('vet') || id === 3;
      if (this.filtroRol === 'PETICIONARIO') return r.includes('pet') || id === 4;
      return true;
    });
  }

  setFiltroRol(rol: string): void {
    this.filtroRol = rol;
    this.filtrarUsuarios();
  }

  obtenerClaseRol(rolNombre: string, idRol?: number): string {
    const r = String(rolNombre || '').toLowerCase();
    const id = Number(idRol);
    if (r.includes('adm') || id === 1) return 'bg-[#170B3D]/10 text-[#170B3D] border-[#170B3D]/20';
    if (r.includes('jur') || id === 2) return 'bg-[#4141A5]/10 text-[#4141A5] border-[#4141A5]/20';
    if (r.includes('vet') || id === 3) return 'bg-[#F1C63C]/15 text-[#170B3D] border-[#F1C63C]/50';
    return 'bg-slate-50 text-slate-600 border-slate-200';
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
            '#CBD5E1'  // Slate referencia
          ],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              usePointStyle: true,
              font: { family: 'Nunito', size: 11, weight: 'bold' },
              color: '#475569',
              padding: 12
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
            '#170B3D',
            '#4141A5',
            'rgba(65, 65, 165, 0.55)',
            'rgba(65, 65, 165, 0.28)'
          ],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              usePointStyle: true,
              font: { family: 'Nunito', size: 11, weight: 'bold' },
              color: '#475569',
              padding: 12
            }
          }
        }
      }
    });
  }
}
