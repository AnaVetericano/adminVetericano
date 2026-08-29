import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router,RouterLink } from '@angular/router';

@Component({
  selector: 'app-editar-examen',
  imports: [CommonModule,FormsModule,RouterLink],
  templateUrl: './editar-examen.html',
  styleUrl: './editar-examen.css',
})
export class EditarExamen {

   ediexam = {
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

  editarexa() {
    this.http.patch('https://tu-api.com/rest/v1/examenClinico', this.ediexam, {
      headers: { 'Content-Type': 'application/json' }
    }).subscribe({
      next: (respuesta) => {
        alert('Examen editado correctamente ');
        console.log(respuesta);
        this.router.navigate(['/examenes-clinicos']);
      },
      error: (err) => {
        console.log(err);
        alert('Error al editar el examen ');
      }
    });
  }
}


