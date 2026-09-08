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
  patologiasOriginales: Patologia[] = []; 
  filtroBusqueda: string = ''; 
  menuFiltroAbierto: boolean = false;
  cargando: boolean = true;
  
  editandoId: number | null = null; // Controla si estamos editando o creando

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
        this.patologiasOriginales = data; 
        this.cargando = false;
      },
      error: (err: any) => {
        console.error('Error al listar:', err);
        this.cargando = false;
      }
    });
  }

  filtrarPatologias(): void {
    const termino = this.filtroBusqueda.toLowerCase().trim();
    if (!termino) {
      this.patologias = [...this.patologiasOriginales];
      return;
    }
    this.patologias = this.patologiasOriginales.filter(p => 
      p.nombre.toLowerCase().includes(termino) || 
      p.descripcion.toLowerCase().includes(termino)
    );
  }

  toggleMenuFiltro(): void {
    this.menuFiltroAbierto = !this.menuFiltroAbierto;
  }

  filtrarPorEstado(estado: boolean | null): void {
    this.menuFiltroAbierto = false;
    if (estado === null) {
      this.patologias = [...this.patologiasOriginales];
    } else {
      this.patologias = this.patologiasOriginales.filter(p => p.activo === estado);
    }
  }

  abrirModalCrear(): void {
    this.editandoId = null; 
    this.patologia = { nombre: '', descripcion: '', activo: true }; 
    this.modalAbierto = true;
  }

  abrirModalEditar(p: Patologia): void {
    this.editandoId = p.id_patologia ?? null;
    this.patologia = {
      nombre: p.nombre,
      descripcion: p.descripcion,
      activo: p.activo
    };
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.editandoId = null;
  }

  guardarPatologia(): void {
    if (this.editandoId !== null) {
      this.authService.actualizarPatologia(this.editandoId, this.patologia).subscribe({
        next: (res: any) => {
          console.log('Actualizado con éxito:', res);
          this.cerrarModal();
          this.obtenerPatologias();
        },
        error: (err: any) => {
          console.error('Error al actualizar:', err);
        }
      });
    } else {
      this.authService.crearPatologia(this.patologia).subscribe({
        next: (res: any) => {
          console.log('Creado con éxito:', res);
          this.cerrarModal();
          this.obtenerPatologias(); 
          this.patologia = { nombre: '', descripcion: '', activo: true };
        },
        error: (err: any) => {
          console.error('Error al guardar:', err);
        }
      });
    }
  }
}