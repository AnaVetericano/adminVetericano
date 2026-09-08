import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-examen-clinico',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './examen-clinico.html',
  styleUrl: './examen-clinico.css',
})
export class ExamenClinicoComponent {
  modalAbierto: boolean = false;
  
  examen: any = {
    nombre_tipo: '',
    descripcion: '',
    tipo: '',
    observaciones: '',
    estado: ''
  };

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  abrirModalCrear() {
    this.modalAbierto = true;
  }

  cerrarModal() {
    this.modalAbierto = false;
    this.router.navigate(['/inicio-admin/examenes-clinicos']);
  }

  guardarExamen() {
    const payload = {
      nombre_tipo: this.examen.nombre || this.examen.nombre_tipo
    };

    if (!payload.nombre_tipo) {
      alert('Por favor ingresa el nombre del examen.');
      return;
    }

    this.authService.crearCatalogo(payload).subscribe({
      next: () => {
        alert('¡Examen creado con éxito!');
        this.cerrarModal();
      },
      error: (err: any) => {
        console.error('Error al crear:', err);
        alert('Error al crear examen');
      }
    });
  }
}