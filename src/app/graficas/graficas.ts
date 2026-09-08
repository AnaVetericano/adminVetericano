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
  
  GraficUserConst: Chart | undefined;
  cargandoGrafica: boolean = false;
  activosPie = 0;
  inactivosPie = 0;

  constructor(private authService: AuthService){}

  ngOnInit(){
     this.ListAllUsersActives();
  }

  ListAllUsersActives(){
    this.authService.listUsersActive().subscribe({
      next: (response: any[]) => {
        this.activosPie = response.filter(u => u.activo === true).length;
        this.inactivosPie = response.filter(u => u.activo === false).length;
        this.cargandoGrafica = true;
        this.LoadGraficUsersActive();
      },
      error: (err) => console.error(err)
    });
  }

  LoadGraficUsersActive(){
    if (!this.GraficUsers) return;

    if (this.GraficUserConst) {
      this.GraficUserConst.destroy();
    }

    this.GraficUserConst = new Chart(this.GraficUsers.nativeElement, {
      type: 'pie',
      data: {
        labels: ['Usuarios activos ' + this.activosPie, 'Usuarios inactivos ' + this.inactivosPie],
        datasets: [{
          label: 'Cantidad',
          data: [this.activosPie, this.inactivosPie], // Aquí ya van con el valor de la API
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
}
