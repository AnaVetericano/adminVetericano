import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import Swal from 'sweetalert2';

import { AuthService, EventoVoluntariado } from '../services/auth';

@Component({
  selector: 'app-eventos-voluntariado',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './eventos-voluntariado.html',
  styleUrl: './eventos-voluntariado.css'
})
export class EventosVoluntariado implements OnInit {

  // VARIABLES DE ESTADO

  eventos: EventoVoluntariado[] = [];
  eventosFiltrados: EventoVoluntariado[] = [];
  cargando: boolean = true;
  guardando: boolean = false;
  modalAbierto: boolean = false;
  editandoId: number | null = null;
  filtroBusqueda: string = '';

  // Modelo para el formulario
  eventoForm = {
    titulo: '',
    descripcion: '',
    fecha: ''
  };

  archivoImagenSeleccionado: File | null = null;
  vistaPreviaImagen: string | null = null;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.obtenerEventos();
  }


  // obtener eventos

  obtenerEventos(): void {
    this.cargando = true;
    this.authService.listarEventosVoluntariado().subscribe({
      next: (data: EventoVoluntariado[]) => {
        this.eventos = data;
        this.filtrarEventos();
        this.cargando = false;
      },
      error: (err: any) => {
        console.error('Error al listar eventos:', err);
        this.cargando = false;
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar las jornadas de voluntariado.',
          icon: 'error',
          confirmButtonColor: '#1B1947'
        });
      }
    });
  }

  // filtrar eventos

  filtrarEventos(): void {
    const query = this.filtroBusqueda.trim().toLowerCase();
    if (!query) {
      this.eventosFiltrados = [...this.eventos];
      return;
    }

    this.eventosFiltrados = this.eventos.filter(e => {
      const titulo = (e.titulo || '').toLowerCase();
      const desc = (e.descripcion || '').toLowerCase();
      const fecha = (e.fecha || '').toLowerCase();
      return titulo.includes(query) || desc.includes(query) || fecha.includes(query);
    });
  }

  // CONTROL DE MODAL

  abrirModalCrear(): void {
    this.editandoId = null;
    this.eventoForm = {
      titulo: '',
      descripcion: '',
      fecha: ''
    };
    this.archivoImagenSeleccionado = null;
    this.vistaPreviaImagen = null;
    this.modalAbierto = true;
  }

  abrirModalEditar(evento: EventoVoluntariado): void {
    this.editandoId = evento.id || null;
    this.eventoForm = {
      titulo: this.limpiarTexto(evento.titulo),
      descripcion: this.limpiarTexto(evento.descripcion),
      fecha: evento.fecha || ''
    };
    this.archivoImagenSeleccionado = null;
    this.vistaPreviaImagen = evento.imagen || null;
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.editandoId = null;
    this.archivoImagenSeleccionado = null;
    this.vistaPreviaImagen = null;
  }

  // GESTIÓN DE IMÁGENES

  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const archivo = input.files[0];

      // Validar tipo de archivo
      if (!archivo.type.startsWith('image/')) {
        Swal.fire({
          title: 'Formato inválido',
          text: 'Por favor selecciona un archivo de imagen válido (PNG, JPG, JPEG, WEBP).',
          icon: 'warning',
          confirmButtonColor: '#1B1947'
        });
        input.value = '';
        return;
      }

      // Validar tamaño máximo (ej. 5MB)
      if (archivo.size > 5 * 1024 * 1024) {
        Swal.fire({
          title: 'Imagen muy pesada',
          text: 'El tamaño máximo permitido para la imagen es de 5MB.',
          icon: 'warning',
          confirmButtonColor: '#1B1947'
        });
        input.value = '';
        return;
      }

      this.archivoImagenSeleccionado = archivo;

      // Generar preview
      const reader = new FileReader();
      reader.onload = () => {
        this.vistaPreviaImagen = reader.result as string;
      };
      reader.readAsDataURL(archivo);
    }
  }

  quitarImagen(): void {
    this.archivoImagenSeleccionado = null;
    this.vistaPreviaImagen = null;
  }

  // guardar (CREAR O EDITAR)

  guardarEvento(): void {
    // Validaciones
    if (!this.eventoForm.titulo.trim()) {
      Swal.fire({
        title: 'Campo obligatorio',
        text: 'El título de la jornada es obligatorio.',
        icon: 'warning',
        confirmButtonColor: '#1B1947'
      });
      return;
    }

    if (!this.eventoForm.fecha) {
      Swal.fire({
        title: 'Campo obligatorio',
        text: 'La fecha de la jornada es obligatoria.',
        icon: 'warning',
        confirmButtonColor: '#1B1947'
      });
      return;
    }

    if (!this.eventoForm.descripcion.trim()) {
      Swal.fire({
        title: 'Campo obligatorio',
        text: 'La descripción de la jornada es obligatoria.',
        icon: 'warning',
        confirmButtonColor: '#1B1947'
      });
      return;
    }

    // Al crear es obligatorio subir la imagen
    if (this.editandoId === null && !this.archivoImagenSeleccionado) {
      Swal.fire({
        title: 'Imagen requerida',
        text: 'Debes seleccionar una imagen para la jornada.',
        icon: 'warning',
        confirmButtonColor: '#1B1947'
      });
      return;
    }

    const formData = new FormData();
    formData.append('titulo', this.eventoForm.titulo.trim());
    formData.append('descripcion', this.eventoForm.descripcion.trim());
    formData.append('fecha', this.eventoForm.fecha);

    if (this.archivoImagenSeleccionado) {
      formData.append('imagen', this.archivoImagenSeleccionado);
    }

    this.guardando = true;

    // actualizar
    if (this.editandoId !== null) {
      this.authService.actualizarEventoVoluntariado(this.editandoId, formData).subscribe({
        next: () => {
          this.guardando = false;
          this.cerrarModal();
          this.obtenerEventos();
          Swal.fire({
            title: '¡Actualizada!',
            text: 'La jornada de voluntariado se actualizó con éxito.',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
          });
        },
        error: (err: any) => {
          console.error('Error al actualizar evento:', err);
          this.guardando = false;
          Swal.fire({
            title: 'Error',
            text: 'Ocurrió un error al actualizar la jornada.',
            icon: 'error',
            confirmButtonColor: '#1B1947'
          });
        }
      });
      return;
    }

    // crear
    this.authService.crearEventoVoluntariado(formData).subscribe({
      next: () => {
        this.guardando = false;
        this.cerrarModal();
        this.obtenerEventos();
        Swal.fire({
          title: '¡Creada con éxito!',
          text: 'La nueva jornada ya está disponible para que los voluntarios se postulen.',
          icon: 'success',
          timer: 2500,
          showConfirmButton: false
        });
      },
      error: (err: any) => {
        console.error('Error al crear evento:', err);
        this.guardando = false;
        Swal.fire({
          title: 'Error',
          text: 'No se pudo crear la jornada. Revisa los datos ingresados.',
          icon: 'error',
          confirmButtonColor: '#1B1947'
        });
      }
    });
  }


  // eliminar evento


  eliminarEvento(evento: EventoVoluntariado): void {
    if (!evento.id) return;

    Swal.fire({
      title: '¿Eliminar jornada?',
      text: `Se eliminará la jornada "${this.limpiarTexto(evento.titulo)}". Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#1B1947',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.authService.eliminarEventoVoluntariado(evento.id!).subscribe({
          next: () => {
            this.obtenerEventos();
            Swal.fire({
              title: 'Eliminada',
              text: 'La jornada ha sido eliminada exitosamente.',
              icon: 'success',
              timer: 2000,
              showConfirmButton: false
            });
          },
          error: (err: any) => {
            console.error('Error al eliminar evento:', err);
            Swal.fire({
              title: 'Error',
              text: 'No se pudo eliminar la jornada. Es posible que ya tenga voluntarios postulados asociados.',
              icon: 'error',
              confirmButtonColor: '#1B1947'
            });
          }
        });
      }
    });
  }





  limpiarTexto(texto?: string): string {
    if (!texto) return '';
    return texto.replace(/^["']|["']$/g, '').trim();
  }
}

