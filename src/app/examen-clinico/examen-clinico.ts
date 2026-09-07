import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-examen-clinico',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './examen-clinico.html',
  styleUrl: './examen-clinico.css',
})
export class ExamenClinico {
  // 1. Variable para controlar la visibilidad del modal
  modalAbierto: boolean = false;

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

  // 2. Funciones para abrir y cerrar el modal
  abrirModalCrear() {
    this.modalAbierto = true;
  }

  cerrarModal() {
    this.modalAbierto = false;
  }

  guardarExamen() {
    // Recuerda apuntar a tu endpoint real de Supabase o API
    this.http.post('https://tu-api.com/rest/v1/examenClinico', this.examen, {
      headers: { 'Content-Type': 'application/json' }
    }).subscribe({
      next: (respuesta) => {
        alert('Examen creado correctamente');
        console.log(respuesta);
        this.cerrarModal(); // Cierra el modal al guardar con éxito
        this.router.navigate(['/inicio-admin/examenes-clinicos']);
      },
      error: (err) => {
        console.log(err);
        alert('Error al crear examen');
      }
    });
  }
}