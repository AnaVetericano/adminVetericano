import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import Swal from 'sweetalert2';

import {
  AuthService,
  EventoVoluntariado,
  PostulacionVoluntariado
} from '../services/auth';
import { RealtimeEventosService, debouncePorTipo } from '../services/realtime-eventos.service';
import { AnimalIconComponent } from '../animal-icon/animal-icon';
import { PageTitleComponent } from '../page-title/page-title';
import { PaginadorComponent, PaginarPipe, TAMANO_PAGINA_PREDETERMINADO } from '../paginador/paginador';

@Component({
  selector: 'app-voluntarios',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    AnimalIconComponent,
    PageTitleComponent,
    PaginadorComponent,
    PaginarPipe
  ],
  templateUrl: './voluntarios.html',
  styleUrl: './voluntarios.css'
})
export class Voluntarios implements OnInit {

  // VARIABLES DE LA VISTA

  modalAbierto: boolean = false;

  menuFiltroAbierto: boolean = false;

  cargando: boolean = true;

  filtroBusqueda: string = '';

  pagina: number = 1;

  tamanoPagina: number = TAMANO_PAGINA_PREDETERMINADO;

  editandoId: number | null = null;


  // LISTAS

  voluntarios: PostulacionVoluntariado[] = [];

  voluntariosOriginales: PostulacionVoluntariado[] = [];

  eventos: EventoVoluntariado[] = [];


  // OBJETO PARA CREAR / EDITAR

  voluntario: PostulacionVoluntariado = {

    evento: null,

    correo: '',

    identificacion: '',

    nombre_completo: '',

    edad: 0,

    telefono: ''

  };



  // CONSTRUCTOR


  constructor(
    private authService: AuthService
  ) {
    inject(RealtimeEventosService)
      .on('voluntariado.*')
      .pipe(debouncePorTipo(1000), takeUntilDestroyed())
      .subscribe((ev) => (ev.event_type === 'voluntariado.evento_actualizado' ? this.obtenerEventos() : this.obtenerVoluntarios()));
  }


  // INICIALIZAR


  ngOnInit(): void {

    this.obtenerVoluntarios();

    this.obtenerEventos();

  }


  // LISTAR VOLUNTARIOS

  obtenerVoluntarios(): void {

    this.cargando = true;

    this.authService
      .listarPostulacionesVoluntariado()
      .subscribe({

        next: (data: PostulacionVoluntariado[]) => {

          this.voluntarios = data;

          this.voluntariosOriginales = [...data];

          this.cargando = false;

        },

        error: (err: any) => {

          console.error(
            'Error al listar voluntarios:',
            err
          );

          this.cargando = false;

        }

      });

  }


  // LISTAR EVENTOS

  obtenerEventos(): void {

    this.authService
      .listarEventosVoluntariado()
      .subscribe({

        next: (data: EventoVoluntariado[]) => {

          this.eventos = data;

        },

        error: (err: any) => {

          console.error(
            'Error al listar eventos:',
            err
          );

        }

      });

  }


  // BUSCAR VOLUNTARIOS

  filtrarVoluntarios(): void {

    this.pagina = 1;

    const termino = this.filtroBusqueda
      .toLowerCase()
      .trim();


    // Si no escribió nada,
    // mostramos todos

    if (!termino) {

      this.voluntarios = [
        ...this.voluntariosOriginales
      ];

      return;

    }


    // Filtramos por diferentes campos

    this.voluntarios =
      this.voluntariosOriginales.filter(
        v =>
          String(v.nombre_completo || '').toLowerCase().includes(termino) ||
          String(v.correo || '').toLowerCase().includes(termino) ||
          String(v.identificacion || '').toLowerCase().includes(termino) ||
          String(v.telefono || '').toLowerCase().includes(termino)
      );

  }


  // ABRIR / CERRAR MENÚ DE FILTROS

  toggleMenuFiltro(): void {

    this.menuFiltroAbierto =
      !this.menuFiltroAbierto;

  }


  // FILTRAR POR EVENTO

  filtrarPorEvento(
    idEvento: number | null
  ): void {

    this.pagina = 1;

    // Cerramos el menú

    this.menuFiltroAbierto = false;


    // Si seleccionó "Todos"

    if (idEvento === null) {

      this.voluntarios = [
        ...this.voluntariosOriginales
      ];

      return;

    }


    // Filtrar por evento

    this.voluntarios =
      this.voluntariosOriginales.filter(
        v => v.evento === idEvento
      );

  }


  // ABRIR MODAL CREAR

  abrirModalCrear(): void {

    this.editandoId = null;


    this.voluntario = {

      evento: null,

      correo: '',

      identificacion: '',

      nombre_completo: '',

      edad: 0,

      telefono: ''

    };


    this.modalAbierto = true;

  }


  // =========================================================
  // ABRIR MODAL EDITAR
  // =========================================================

  abrirModalEditar(
    voluntario: PostulacionVoluntariado
  ): void {

    this.editandoId =
      voluntario.id ?? null;


    this.voluntario = {

      evento: voluntario.evento,

      correo: voluntario.correo,

      identificacion: voluntario.identificacion,

      nombre_completo:
        voluntario.nombre_completo,

      edad: voluntario.edad,

      telefono: voluntario.telefono

    };


    this.modalAbierto = true;

  }


  // =========================================================
  // CERRAR MODAL
  // =========================================================

  cerrarModal(): void {

    this.modalAbierto = false;

    this.editandoId = null;

  }


  // =========================================================
  // GUARDAR VOLUNTARIO
  // =========================================================

  guardarVoluntario(): void {


    // =======================================================
    // VALIDACIONES BÁSICAS
    // =======================================================

    if (
      !this.voluntario.nombre_completo.trim()
    ) {

      console.error(
        'El nombre completo es obligatorio'
      );

      return;

    }


    if (
      !this.voluntario.identificacion.trim()
    ) {

      console.error(
        'La identificación es obligatoria'
      );

      return;

    }


    if (
      !this.voluntario.correo.trim()
    ) {

      console.error(
        'El correo es obligatorio'
      );

      return;

    }


    if (
      !this.voluntario.telefono.trim()
    ) {

      console.error(
        'El teléfono es obligatorio'
      );

      return;

    }


    if (
      this.voluntario.edad <= 0
    ) {

      console.error(
        'La edad debe ser mayor a cero'
      );

      return;

    }


    // =======================================================
    // EDITAR
    // =======================================================

    if (
      this.editandoId !== null
    ) {

      this.authService
        .actualizarPostulacionVoluntariado(
          this.editandoId,
          this.voluntario
        )
        .subscribe({

          next: (res: any) => {

            console.log(
              'Voluntario actualizado correctamente:',
              res
            );


            this.cerrarModal();

            this.obtenerVoluntarios();

          },

          error: (err: any) => {

            console.error(
              'Error al actualizar voluntario:',
              err
            );

          }

        });

      return;

    }


    // =======================================================
    // CREAR
    // =======================================================

    this.authService
      .crearPostulacionVoluntariado(
        this.voluntario
      )
      .subscribe({

        next: (res: any) => {

          console.log(
            'Voluntario creado correctamente:',
            res
          );


          this.cerrarModal();

          this.obtenerVoluntarios();


          // Limpiar formulario

          this.voluntario = {

            evento: null,

            correo: '',

            identificacion: '',

            nombre_completo: '',

            edad: 0,

            telefono: ''

          };

        },

        error: (err: any) => {

          console.error(
            'Error al crear voluntario:',
            err
          );

        }

      });

  }


  // =========================================================
  // ELIMINAR VOLUNTARIO
  // =========================================================

  eliminarVoluntario(
    id: number
  ): void {
    Swal.fire({
      title: 'Confirmar eliminación',
      text: 'Se eliminará esta postulación de voluntariado. Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      customClass: { popup: 'qa-destructivo' }
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.authService
        .eliminarPostulacionVoluntariado(id)
        .subscribe({
          next: () => {
            this.obtenerVoluntarios();
            Swal.fire({
              title: 'Registro eliminado',
              text: 'La postulación de voluntariado fue eliminada correctamente.',
              icon: 'success',
              timer: 1800,
              showConfirmButton: false
            });
          },
          error: (err: any) => {
            console.error('Error al eliminar voluntario:', err);
            Swal.fire({
              title: 'No fue posible eliminar el registro',
              text: err?.error?.detail || 'Ocurrió un error al eliminar la postulación. Intente nuevamente.',
              icon: 'error',
              confirmButtonText: 'Aceptar'
            });
          }
        });
    });
  }


  // =========================================================
  // OBTENER NOMBRE DEL EVENTO
  // =========================================================

  obtenerNombreEvento(
    idEvento: number | null
  ): string {


    // Si no tiene evento

    if (
      idEvento === null
    ) {

      return 'Sin evento';

    }


    // Buscar el evento

    const evento =
      this.eventos.find(
        e => e.id === idEvento
      );


    // Si encontró el evento

    if (evento) {

      return evento.titulo;

    }


    // Si no encontró

    return 'Evento no encontrado';

  }

}