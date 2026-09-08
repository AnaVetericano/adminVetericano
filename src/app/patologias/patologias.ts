import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, Patologia } from '../services/auth';
@Component({
  selector: 'app-patologias',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './patologias.html',
  styleUrl: './patologias.css',
})
export class Patologias implements OnInit {
  modalAbierto: boolean = false;
  patologias: Patologia[] = [];
  cargando: boolean = true;
  
  patologia = {
    nombre: '',
    descripcion: '',
    activo: true
  };

  constructor(private router: Router, private authService: AuthService) {}

  ngOnInit(): void {
    this.obtenerPatologias();
  }

  obtenerPatologias(): void {
    this.cargando = true;
    this.authService.listarPatologias().subscribe({
      next: (data: Patologia[]) => {
        this.patologias = data;
        this.cargando = false;
      },
      error: (err: any) => {
        console.error('Error al listar:', err);
        this.cargando = false;
      }
    });
  }

  abrirModalCrear(): void {
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
  }

  guardarPatologia(): void {
    this.authService.crearPatologia(this.patologia).subscribe({
      next: (res: any) => {
        console.log('Creado con éxito:', res);
        this.cerrarModal();
        this.obtenerPatologias(); // Recarga la lista sola
        this.patologia = { nombre: '', descripcion: '', activo: true };
      },
      error: (err: any) => {
        console.error('Error al guardar:', err);
      }
    });
  }
}