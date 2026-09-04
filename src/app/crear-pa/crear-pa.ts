import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router,RouterLink } from '@angular/router';
@Component({
  selector: 'app-crear-pa',
  imports: [CommonModule,RouterLink,FormsModule],
  templateUrl: './crear-pa.html',
  styleUrl: './crear-pa.css',
})
export class CrearPa {
  patoLogias = {
    nombre: '',
    tipo: '',
    descripcion: '',
    signos:'',
    especie:'',
    observaciones: '',
    estado: ''
  };

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  guardarpat() {
    this.http.post('https://tu-api.com/rest/v1/examenClinico', this.patoLogias, {
      headers: { 'Content-Type': 'application/json' }
    }).subscribe({
      next: (respuesta) => {
        alert('patologia creada correctamente ');
        console.log(respuesta);
        this.router.navigate(['/patologias']);
      },
      error: (err) => {
        console.log(err);
        alert('Error al crear patologias ');
      }
    });
  }
}
