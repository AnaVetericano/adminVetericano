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
        
        // Notificación opcional si falla la carga inicial
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'No pudimos cargar la lista de exámenes. Revisa tu conexión.'
        });
        
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
    // Validación visual con SweetAlert
    if (!this.examenActual.nombre_tipo || !this.examenActual.nombre_tipo.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo incompleto',
        text: 'Por favor ingresa el nombre del examen antes de guardar.'
      });
      return;
    }

    if (this.esEdicion && this.examenActual.id_procedimiento_catalogo) {
      this.authService.actualizarCatalogo(this.examenActual.id_procedimiento_catalogo, this.examenActual).subscribe({
        next: () => {
          this.cerrarModal();
          this.cargarCatalogo();
          Swal.fire({
            icon: 'success',
            title: '¡Actualizado!',
            text: 'El examen clínico se ha actualizado correctamente.',
            timer: 2000,
            showConfirmButton: false
          });
        },
        error: (err: any) => {
          console.error('Error al actualizar:', err);
          Swal.fire({
            icon: 'error',
            title: 'Error de servidor',
            text: 'Hubo un problema al actualizar el examen en la base de datos.'
          });
        }
      });
    } else {
      this.authService.crearCatalogo(this.examenActual).subscribe({
        next: () => {
          this.cerrarModal();
          this.cargarCatalogo();
          Swal.fire({
            icon: 'success',
            title: '¡Creado!',
            text: 'El examen clínico se ha registrado correctamente.',
            timer: 2000,
            showConfirmButton: false
          });
        },
        error: (err: any) => {
          console.error('Error al crear:', err);
          Swal.fire({
            icon: 'error',
            title: 'Error de servidor',
            text: 'Hubo un problema al registrar el examen en la base de datos.'
          });
        }
      });
    }
  }

  eliminarExamen(id?: number) {
    if (!id) return;
    
    // Cuadro de confirmación interactivo
    Swal.fire({
      title: '¿Estás seguro?',
      text: "Esta acción eliminará el examen de forma permanente.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      // Solo si el usuario hace clic en "Sí, eliminar"
      if (result.isConfirmed) {
        this.authService.eliminarCatalogo(id).subscribe({
          next: () => {
            this.cargarCatalogo();
            Swal.fire(
              '¡Eliminado!',
              'El examen ha sido eliminado del catálogo.',
              'success'
            );
          },
          error: (err: any) => {
            console.error('Error al eliminar:', err);
            Swal.fire(
              'Error',
              'No se pudo eliminar el examen. Es posible que esté asociado a una consulta médica.',
              'error'
            );
          }
        });
      }
    });
  }
}