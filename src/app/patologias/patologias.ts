import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { debounceTime } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { AuthService, Patologia } from '../services/auth';
import { RealtimeEventosService } from '../services/realtime-eventos.service';
import { AnimalIconComponent } from '../animal-icon/animal-icon';
import { PageTitleComponent } from '../page-title/page-title';

@Component({
  selector: 'app-patologias',
  standalone: true,
  imports: [CommonModule, FormsModule, AnimalIconComponent, PageTitleComponent],
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
  
  editandoId: number | null = null; 
  patologia = {
    nombre: '',
    descripcion: '',
    activo: true
  };

  constructor(
    private router: Router, 
    private authService: AuthService,
    private cdr: ChangeDetectorRef // 2. Inyecta ChangeDetectorRef
  ) {
    inject(RealtimeEventosService)
      .on('catalogo.clinico_actualizado')
      .pipe(debounceTime(1000), takeUntilDestroyed())
      .subscribe(() => this.obtenerPatologias());
  }

  ngOnInit(): void {
    this.obtenerPatologias();
  }

  obtenerPatologias(): void {
    this.cargando = true;
    this.authService.listarPatologias().subscribe({
      next: (data: any) => {
        const lista: Patologia[] = Array.isArray(data) ? data : (data?.results || []);
        this.patologias = lista;
        this.patologiasOriginales = lista;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error al listar:', err);
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  filtrarPatologias(): void {
    const termino = (this.filtroBusqueda || '').toLowerCase().trim();
    if (!termino) {
      this.patologias = [...this.patologiasOriginales];
      return;
    }
    this.patologias = this.patologiasOriginales.filter(p =>
      (p.nombre || '').toLowerCase().includes(termino) ||
      (p.descripcion || '').toLowerCase().includes(termino)
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
    if (!this.patologia.nombre || !this.patologia.nombre.trim()) {
      Swal.fire({
        title: 'Campo obligatorio',
        text: 'Ingrese el nombre de la patología para continuar.',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    if (this.editandoId !== null) {
      this.authService.actualizarPatologia(this.editandoId, this.patologia).subscribe({
        next: () => {
          this.cerrarModal();
          this.obtenerPatologias();
        },
        error: (err: any) => {
          console.error('Error al actualizar:', err);
          Swal.fire({
            title: 'No fue posible actualizar la patología',
            text: err?.error?.detail || 'Ocurrió un error al guardar los cambios. Intente nuevamente.',
            icon: 'error',
            confirmButtonText: 'Aceptar'
          });
          this.cdr.detectChanges();
        }
      });
    } else {
      this.authService.crearPatologia(this.patologia).subscribe({
        next: () => {
          this.cerrarModal();
          this.obtenerPatologias();
          this.patologia = { nombre: '', descripcion: '', activo: true };
        },
        error: (err: any) => {
          console.error('Error al guardar:', err);
          Swal.fire({
            title: 'No fue posible crear la patología',
            text: err?.error?.detail || 'Ocurrió un error al guardar la patología. Intente nuevamente.',
            icon: 'error',
            confirmButtonText: 'Aceptar'
          });
          this.cdr.detectChanges();
        }
      });
    }
  }
}