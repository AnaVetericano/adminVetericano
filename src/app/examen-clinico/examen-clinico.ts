import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router,RouterLink } from '@angular/router';

@Component({
  selector: 'app-examen-clinico',
  imports: [CommonModule,FormsModule,RouterLink],
  templateUrl: './examen-clinico.html',
  styleUrl: './examen-clinico.css',
})
export class ExamenClinico {
   examen = {
    nombre: '',
    tipo: '',
    descripcion: '',
    observaciones: '',
    estado: ''
  };

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  guardarExamen() {
    this.http.post('https://tu-api.com/rest/v1/examenClinico', this.examen, {
      headers: { 'Content-Type': 'application/json' }
    }).subscribe({
      next: (respuesta) => {
        alert('Examen creado correctamente ');
        console.log(respuesta);
        this.router.navigate(['/examenes-clinicos']);
      },
      error: (err) => {
        console.log(err);
        alert('Error al crear examen ');
      }
    });
  }
}
