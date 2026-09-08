import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService, ProcedimientoCatalogo } from '../services/auth';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-examenes-clinicos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './examenes-clinicos.html',
  styleUrl: './examenes-clinicos.css',
})
export class ExamenesClinicos implements OnInit {
  listaCatalogo: ProcedimientoCatalogo[] = [];
  listaFiltrada: ProcedimientoCatalogo[] = [];
  cargando: boolean = true;
  filtroBusqueda: string = '';

  modalAbierto: boolean = false;
  esEdicion: boolean = false;
  examenActual: ProcedimientoCatalogo = { 
    nombre_tipo: '', 
    tipo: '', 
    descripcion: '', 
    observaciones: '', 
    estado: '' 
  };

  constructor(
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.cargarCatalogo();
    });
  }

  ngOnInit(): void {
    this.cargarCatalogo();
  }

  cargarCatalogo() {
    this.cargando = true;
    this.authService.getCatalogo().subscribe({
      next: (data: ProcedimientoCatalogo[]) => {
        this.listaCatalogo = data || [];
        this.listaFiltrada = [...this.listaCatalogo];
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error al cargar el catálogo:', err);
        this.listaCatalogo = [];
        this.listaFiltrada = [];
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  filtrarExamenes() {
    const texto = this.filtroBusqueda.toLowerCase().trim();
    if (!texto) {
      this.listaFiltrada = [...this.listaCatalogo];
    } else {
      this.listaFiltrada = this.listaCatalogo.filter(item =>
        (item.nombre_tipo && item.nombre_tipo.toLowerCase().includes(texto)) ||
        (item.descripcion && item.descripcion.toLowerCase().includes(texto)) ||
        (item.tipo && item.tipo.toLowerCase().includes(texto))
      );
    }
  }

  abrirModalCrear() {
    this.esEdicion = false;
    this.examenActual = { 
      nombre_tipo: '', 
      tipo: '', 
      descripcion: '', 
      observaciones: '', 
      estado: '' 
    };
    this.modalAbierto = true;
    this.cdr.detectChanges();
  }

  abrirModalEditar(item: ProcedimientoCatalogo) {
    this.esEdicion = true;
    this.examenActual = { ...item };
    this.modalAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModal() {
    this.modalAbierto = false;
    this.cdr.detectChanges();
  }

  guardarExamen() {
    if (!this.examenActual.nombre_tipo || !this.examenActual.nombre_tipo.trim()) {
      alert('Por favor ingresa el nombre del examen.');
      return;
    }

    if (this.esEdicion && this.examenActual.id_procedimiento_catalogo) {
      this.authService.actualizarCatalogo(this.examenActual.id_procedimiento_catalogo, this.examenActual).subscribe({
        next: () => {
          this.cerrarModal();
          this.cargarCatalogo();
        },
        error: (err: any) => {
          console.error('Error al actualizar:', err);
          alert('Error al actualizar el examen en el servidor.');
        }
      });
    } else {
      this.authService.crearCatalogo(this.examenActual).subscribe({
        next: () => {
          this.cerrarModal();
          this.cargarCatalogo();
        },
        error: (err: any) => {
          console.error('Error al crear:', err);
          alert('Error al registrar el examen en el servidor.');
        }
      });
    }
  }

  eliminarExamen(id?: number) {
    if (!id) return;
    if (confirm('¿Estás seguro de que deseas eliminar este examen?')) {
      this.authService.eliminarCatalogo(id).subscribe({
        next: () => {
          this.cargarCatalogo();
        },
        error: (err: any) => {
          console.error('Error al eliminar:', err);
        }
      });
    }
  }
}