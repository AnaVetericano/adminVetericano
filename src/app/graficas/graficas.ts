import { Component, ElementRef, ViewChild, OnInit, ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../services/auth';
import { Chart } from 'chart.js/auto';

@Component({
  selector: 'app-graficas',
  imports: [],
  templateUrl: './graficas.html',
  styleUrl: './graficas.css',
})
export class Graficas implements OnInit {
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

  constructor(private authService: AuthService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.ListAllUsersActives();
  }

  ListAllUsersActives() {
    this.cargandoGrafica = true;

    this.authService.listUsersActive().subscribe({
      next: (response: any[]) => {
        this.activosPie = response.filter(u => u.activo === true).length;
        this.inactivosPie = response.filter(u => u.activo === false).length;

        this.rolPet = response.filter(u => u.nombre_rol === 'Peticionario').length;
        this.rolVet = response.filter(u => u.nombre_rol === 'Veterinario').length;
        this.rolJud = response.filter(u => u.nombre_rol === 'Juridico').length;
        this.rolAdm = response.filter(u => u.nombre_rol === 'Administrador').length;

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
      type: 'pie',
      data: {
        labels: ['Usuarios activos: ' + this.activosPie, 'Usuarios inactivos: ' + this.inactivosPie],
        datasets: [{
          label: 'Cantidad',
          data: [this.activosPie, this.inactivosPie],
          backgroundColor: ['#10B981', '#F1C63C']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top'
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
      type: 'pie',
      data: {
        labels: [
          'Administradores: ' + this.rolAdm,
          'Juridicos: ' + this.rolJud,
          'Veterinarios: ' + this.rolVet,
          'Peticionarios: ' + this.rolPet
        ],
        datasets: [{
          label: 'Cantidad',
          data: [this.rolAdm, this.rolJud, this.rolVet, this.rolPet],
          backgroundColor: [
            '#10B981',
            '#F1C63C',
            '#3B82F6',
            '#EF4444'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top'
          }
        }
      }
    });
  }
}
