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
  
  examenActual: any = {
    id_procedimiento_catalogo: null,
    nombre_tipo: '',
    tipo: '',
    descripcion: '',
    estado: 'activo'
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
      next: (data: any) => {
        const resultados = Array.isArray(data) ? data : (data?.results || []);
        this.listaCatalogo = resultados;
        this.listaFiltrada = [...this.listaCatalogo];
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error al cargar el catálogo:', err);
        this.listaCatalogo = [];
        this.listaFiltrada = [];
        this.cargando = false;
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

  // MÉTODO AGREGADO PARA EL BOTÓN LIMPIAR EN LA BARRA DE BÚSQUEDA
  limpiarBusqueda() {
    this.filtroBusqueda = '';
    this.filtrarExamenes();
  }

  verificarEstadoActivo(item: any): boolean {
    if (!item || item.estado === undefined || item.estado === null) return true;
    const val = String(item.estado).toLowerCase().trim();
    return val === 'activo' || val === 'true' || val === '1';
  }

  toggleEstado(item: any) {
    const estadoActual = this.verificarEstadoActivo(item);
    const nuevoEstado = estadoActual ? 'inactivo' : 'activo';
    const idARecuperar = item.id_procedimiento_catalogo || item.id_examen || item.id;

    if (!idARecuperar) {
      Swal.fire('Error', 'No se encontró el identificador del examen.', 'error');
      return;
    }

    const payload = {
      ...item,
      id_procedimiento_catalogo: idARecuperar,
      id_examen: idARecuperar,
      estado: nuevoEstado
    };

    this.authService.actualizarCatalogo(idARecuperar, payload).subscribe({
      next: (res: any) => {
        const estadoFinal = (res && res.estado) ? res.estado.toString().toLowerCase().trim() : nuevoEstado;
        item.estado = estadoFinal;
        const target = this.listaCatalogo.find(x => (x.id_procedimiento_catalogo || x.id_examen || (x as any).id) === idARecuperar);
        if (target) {
          target.estado = estadoFinal;
        }
        this.cdr.detectChanges();
        Swal.fire({
          icon: 'success',
          title: '¡Estado actualizado!',
          text: `El examen ahora está ${estadoFinal}.`,
          timer: 1500,
          showConfirmButton: false
        });
      },
      error: (err: any) => {
        console.error('Error al cambiar estado:', err);
        Swal.fire('Error', 'No se pudo cambiar el estado del examen.', 'error');
      }
    });
  }

  abrirModalCrear() {
    this.esEdicion = false;
    this.examenActual = {
      id_procedimiento_catalogo: null,
      nombre_tipo: '',
      tipo: '',
      descripcion: '',
      estado: 'activo'
    };
    this.modalAbierto = true;
    this.cdr.detectChanges();
  }

  abrirModalEditar(item: any) {
    this.esEdicion = true;
    const esActivo = this.verificarEstadoActivo(item);
    this.examenActual = { 
      ...item,
      id_procedimiento_catalogo: item.id_procedimiento_catalogo || item.id_examen || item.id,
      estado: esActivo ? 'activo' : 'inactivo'
    };
    this.modalAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModal() {
    this.modalAbierto = false;
    this.cdr.detectChanges();
  }

  guardarExamen() {
    if (!this.examenActual.nombre_tipo || !this.examenActual.nombre_tipo.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo incompleto',
        text: 'Por favor ingresa el nombre del examen antes de guardar.'
      });
      return;
    }

    this.examenActual.estado = this.examenActual.estado ? this.examenActual.estado.toLowerCase().trim() : 'activo';

    const idARecuperar = this.examenActual.id_procedimiento_catalogo || this.examenActual.id_examen || this.examenActual.id;

    if (this.esEdicion && idARecuperar) {
      this.examenActual.id_procedimiento_catalogo = idARecuperar;
      this.examenActual.id_examen = idARecuperar;

      this.authService.actualizarCatalogo(idARecuperar, this.examenActual).subscribe({
        next: () => {
          this.cerrarModal();
          this.cargarCatalogo();
          Swal.fire({
            icon: 'success',
            title: '¡Actualizado!',
            text: 'El estado y datos se han actualizado correctamente.',
            timer: 1500,
            showConfirmButton: false
          });
        },
        error: (err: any) => {
          console.error('Error al actualizar:', err);
          Swal.fire('Error', 'No se pudo actualizar el examen.', 'error');
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
            timer: 1500,
            showConfirmButton: false
          });
        },
        error: (err: any) => {
          console.error('Error al crear:', err);
          Swal.fire('Error', 'No se pudo registrar el examen.', 'error');
        }
      });
    }
  }

  // MÉTODO ACTUALIZADO: REEMPLAZA "ELIMINAR" POR "INACTIVAR" Y USA COLORES DE LA APP (#4141a5 Y #170B3D)
  eliminarExamen(item: any) {
    const idParaInactivar = item.id_procedimiento_catalogo || item.id_examen || item.id;
    if (!idParaInactivar) {
      Swal.fire('Error', 'No se encontró el identificador del examen.', 'error');
      return;
    }

    const esActivo = this.verificarEstadoActivo(item);
    const accion = esActivo ? 'inactivar' : 'activar';

    Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Deseas ${accion} el examen clínico "${item.nombre_tipo}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4141a5', // Color primario
      cancelButtonColor: '#170B3D',  // Color secundario
      confirmButtonText: `Sí, ${accion}`,
      cancelButtonText: 'Cancelar',
      iconColor: '#F1C63C'
    }).then((result) => {
      if (result.isConfirmed) {
        this.toggleEstado(item);
      }
    });
  }
}