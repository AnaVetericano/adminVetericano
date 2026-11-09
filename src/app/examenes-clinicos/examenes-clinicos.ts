import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import {
  ExamenesClinicosService,
  ExamenClinico
} from '../services/examenes-clinicos.service';

@Component({
  selector: 'app-examenes-clinicos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './examenes-clinicos.html',
  styleUrl: './examenes-clinicos.css',
})
export class ExamenesClinicos implements OnInit {
  // Catálogo completo y catálogo filtrado
  listaCatalogo: ExamenClinico[] = [];
  listaFiltrada: ExamenClinico[] = [];

  // Estado de carga, búsqueda y filtros
  cargando: boolean = true;
  guardando: boolean = false;
  filtroBusqueda: string = '';
  filtroEstado: 'todos' | 'activo' | 'inactivo' = 'todos';
  filtroCategoria: 'todos' | 'examenes' | 'tests' = 'todos';
  menuFiltroAbierto: boolean = false;

  // Control del modal de creación / edición
  modalAbierto: boolean = false;
  esEdicion: boolean = false;
  categoriaModal: 'examen' | 'test' = 'examen';

  tiposSugeridos: string[] = [
    'Prueba Diagnóstica',
    'Laboratorio Hematológico',
    'Química Sanguínea',
    'Imagenología',
    'Imagenología Ultrasonográfica',
    'Endoscopia',
    'Urianálisis',
    'Parasitología',
    'Dermatología',
    'Inmunodiagnóstico Rápido',
    'Inmunodiagnóstico Felino',
    'Citopatología',
    'Cardiología',
    'Prueba de Punto de Atención (POC)',
    'Clínico'
  ];

  examenActual: {
    id_examen: number | null;
    id_procedimiento_catalogo: number | null;
    nombre_tipo: string;
    tipo: string;
    descripcion: string;
    estado: 'activo' | 'inactivo';
  } = {
    id_examen: null,
    id_procedimiento_catalogo: null,
    nombre_tipo: '',
    tipo: 'Prueba Diagnóstica',
    descripcion: '',
    estado: 'activo'
  };

  // Control de paginación
  paginaActual: number = 1;
  tamanoPagina: number = 6;
  totalRegistros: number = 0;
  totalPaginas: number = 1;

  constructor(
    private examenesService: ExamenesClinicosService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarCatalogo();
  }

  /**
   * Carga los datos del catálogo consumiendo el servicio adaptado al backend
   */
  cargarCatalogo(): void {
    this.cargando = true;
    this.examenesService.obtenerTodos().subscribe({
      next: (data: ExamenClinico[]) => {
        this.listaCatalogo = data || [];
        this.filtrarExamenes();
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error al cargar catálogo de exámenes clínicos:', err);
        this.listaCatalogo = [];
        this.listaFiltrada = [];
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Verifica si el examen se encuentra en estado activo
   */
  verificarEstadoActivo(item: any): boolean {
    if (!item || item.estado === undefined || item.estado === null) return true;
    const val = String(item.estado).toLowerCase().trim();
    return val === 'activo' || val === 'true' || val === '1';
  }

  /**
   * Identifica si un registro corresponde a un Test Rápido / Kit diagnóstico
   */
  esTest(item: any): boolean {
    if (!item) return false;
    const nombre = (item.nombre || item.nombre_tipo || item.nombre_tipo_examen || '').toLowerCase();
    const tipo = (item.tipo || item.ruta_archivo_resultado || '').toLowerCase();
    return (
      nombre.includes('test') ||
      tipo.includes('test') ||
      tipo.includes('inmuno') ||
      nombre.includes('kit') ||
      nombre.includes('prueba rápida') ||
      nombre.includes('prueba rapida') ||
      tipo.includes('punto de atención') ||
      tipo.includes('poc')
    );
  }

  get totalExamenesCount(): number {
    return this.listaCatalogo.filter(item => !this.esTest(item)).length;
  }

  get totalTestsCount(): number {
    return this.listaCatalogo.filter(item => this.esTest(item)).length;
  }

  filtrarPorCategoria(categoria: 'todos' | 'examenes' | 'tests'): void {
    this.filtroCategoria = categoria;
    this.paginaActual = 1;
    this.filtrarExamenes();
  }

  /**
   * Búsqueda reactiva por nombre, tipo o descripción y filtro por estado y categoría
   */
  filtrarExamenes(): void {
    const texto = (this.filtroBusqueda || '').toLowerCase().trim();

    this.listaFiltrada = this.listaCatalogo.filter(item => {
      const coincideTexto =
        !texto ||
        (item.nombre && item.nombre.toLowerCase().includes(texto)) ||
        (item.nombre_tipo && item.nombre_tipo.toLowerCase().includes(texto)) ||
        (item.tipo && item.tipo.toLowerCase().includes(texto)) ||
        (item.descripcion && item.descripcion.toLowerCase().includes(texto));

      const activo = this.verificarEstadoActivo(item);
      const coincideEstado =
        this.filtroEstado === 'todos' ||
        (this.filtroEstado === 'activo' && activo) ||
        (this.filtroEstado === 'inactivo' && !activo);

      const esItemTest = this.esTest(item);
      const coincideCategoria =
        this.filtroCategoria === 'todos' ||
        (this.filtroCategoria === 'tests' && esItemTest) ||
        (this.filtroCategoria === 'examenes' && !esItemTest);

      return coincideTexto && coincideEstado && coincideCategoria;
    });

    this.totalRegistros = this.listaFiltrada.length;
    this.totalPaginas = Math.ceil(this.totalRegistros / this.tamanoPagina) || 1;
    if (this.paginaActual > this.totalPaginas) {
      this.paginaActual = 1;
    }
  }

  toggleMenuFiltro(): void {
    this.menuFiltroAbierto = !this.menuFiltroAbierto;
  }

  filtrarPorEstado(estado: 'todos' | 'activo' | 'inactivo'): void {
    this.filtroEstado = estado;
    this.menuFiltroAbierto = false;
    this.paginaActual = 1;
    this.filtrarExamenes();
  }

  /**
   * Limpia el campo de búsqueda y restablece el catálogo completo
   */
  limpiarBusqueda(): void {
    this.filtroBusqueda = '';
    this.filtroEstado = 'todos';
    this.filtroCategoria = 'todos';
    this.paginaActual = 1;
    this.filtrarExamenes();
  }

  // =========================================================================
  // CREAR, EDITAR, ACTIVAR Y DESACTIVAR EXÁMENES CLÍNICOS
  // =========================================================================

  setCategoriaModal(cat: 'examen' | 'test'): void {
    this.categoriaModal = cat;
    if (cat === 'test') {
      if (!this.examenActual.tipo || this.examenActual.tipo === 'Prueba Diagnóstica') {
        this.examenActual.tipo = 'Inmunodiagnóstico Rápido';
      }
    } else {
      if (this.examenActual.tipo === 'Inmunodiagnóstico Rápido' || this.examenActual.tipo === 'Inmunodiagnóstico Felino') {
        this.examenActual.tipo = 'Prueba Diagnóstica';
      }
    }
  }

  abrirModalCrear(): void {
    this.esEdicion = false;
    this.categoriaModal = this.filtroCategoria === 'tests' ? 'test' : 'examen';
    this.examenActual = {
      id_examen: null,
      id_procedimiento_catalogo: null,
      nombre_tipo: '',
      tipo: this.categoriaModal === 'test' ? 'Inmunodiagnóstico Rápido' : 'Prueba Diagnóstica',
      descripcion: '',
      estado: 'activo'
    };
    this.modalAbierto = true;
    this.cdr.detectChanges();
  }

  abrirModalEditar(item: ExamenClinico): void {
    this.esEdicion = true;
    this.categoriaModal = this.esTest(item) ? 'test' : 'examen';
    const id = item.id_procedimiento_catalogo || item.id_examen || (item as any).id || null;
    const esActivo = this.verificarEstadoActivo(item);
    const tipoActual = (item.tipo || 'Prueba Diagnóstica').trim();
    if (tipoActual && !this.tiposSugeridos.includes(tipoActual)) {
      this.tiposSugeridos = [tipoActual, ...this.tiposSugeridos];
    }

    this.examenActual = {
      id_examen: id,
      id_procedimiento_catalogo: id,
      nombre_tipo: item.nombre || item.nombre_tipo || item.nombre_tipo_examen || '',
      tipo: tipoActual,
      descripcion: item.descripcion === 'Sin descripción clínica registrada en el sistema.'
        ? ''
        : (item.descripcion || item.descripcion_hallazgos || ''),
      estado: esActivo ? 'activo' : 'inactivo'
    };
    this.modalAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.esEdicion = false;
    this.guardando = false;
    this.cdr.detectChanges();
  }

  guardarExamen(): void {
    const nombreLimpio = (this.examenActual.nombre_tipo || '').trim();
    if (!nombreLimpio) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo obligatorio',
        text: 'Por favor ingresa el nombre del examen clínico antes de guardar.',
        confirmButtonColor: '#4141a5'
      });
      return;
    }

    const estadoNormalizado: 'activo' | 'inactivo' =
      String(this.examenActual.estado || 'activo').toLowerCase().trim() === 'inactivo'
        ? 'inactivo'
        : 'activo';

    const descripcionLimpia = (this.examenActual.descripcion || '').trim() || '.';
    let tipoLimpio = (this.examenActual.tipo || '').trim();
    if (this.categoriaModal === 'test' && (!tipoLimpio || tipoLimpio === 'Prueba Diagnóstica')) {
      tipoLimpio = 'Inmunodiagnóstico Rápido';
    } else if (!tipoLimpio) {
      tipoLimpio = 'Prueba Diagnóstica';
    }
    const idARecuperar = this.examenActual.id_procedimiento_catalogo || this.examenActual.id_examen;

    const payload: Partial<ExamenClinico> = {
      nombre: nombreLimpio,
      nombre_tipo: nombreLimpio,
      nombre_tipo_examen: nombreLimpio,
      tipo: tipoLimpio,
      ruta_archivo_resultado: tipoLimpio,
      descripcion: descripcionLimpia,
      descripcion_hallazgos: descripcionLimpia,
      estado: estadoNormalizado,
      solicitado: true
    };

    this.examenesService.guardarTipoLocal(idARecuperar, nombreLimpio, tipoLimpio);
    this.guardando = true;

    if (this.esEdicion && idARecuperar) {
      payload.id_examen = idARecuperar;
      payload.id_procedimiento_catalogo = idARecuperar;

      this.examenesService.actualizarExamen(idARecuperar, payload).subscribe({
        next: () => {
          this.cerrarModal();
          this.cargarCatalogo();
          Swal.fire({
            icon: 'success',
            title: '¡Actualizado!',
            text: 'El examen clínico se ha actualizado correctamente.',
            timer: 1600,
            showConfirmButton: false
          });
        },
        error: (err: any) => {
          console.error('Error al actualizar examen clínico:', err);
          this.guardando = false;
          this.cdr.detectChanges();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo actualizar el examen clínico.',
            confirmButtonColor: '#4141a5'
          });
        }
      });
    } else {
      this.examenesService.crearExamen(payload).subscribe({
        next: () => {
          this.cerrarModal();
          this.cargarCatalogo();
          Swal.fire({
            icon: 'success',
            title: '¡Creado!',
            text: 'El examen clínico se ha registrado correctamente.',
            timer: 1600,
            showConfirmButton: false
          });
        },
        error: (err: any) => {
          console.error('Error al crear examen clínico:', err);
          this.guardando = false;
          this.cdr.detectChanges();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo registrar el examen clínico.',
            confirmButtonColor: '#4141a5'
          });
        }
      });
    }
  }

  cambiarEstado(item: ExamenClinico): void {
    const id = item.id_procedimiento_catalogo || item.id_examen || (item as any).id;
    if (!id) {
      Swal.fire('Error', 'No se encontró el identificador del examen.', 'error');
      return;
    }

    const esActivo = this.verificarEstadoActivo(item);
    const nuevoEstado: 'activo' | 'inactivo' = esActivo ? 'inactivo' : 'activo';
    const accion = esActivo ? 'inactivar' : 'activar';
    const nombreMostrar = item.nombre || item.nombre_tipo || 'este examen';

    Swal.fire({
      title: `¿Deseas ${accion} este examen?`,
      text: `El examen clínico "${nombreMostrar}" quedará como ${nuevoEstado}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4141a5',
      cancelButtonColor: '#64748b',
      confirmButtonText: `Sí, ${accion}`,
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.examenesService.cambiarEstadoExamen(id, nuevoEstado, item).subscribe({
        next: (res: any) => {
          const estadoFinal = (res && res.estado)
            ? String(res.estado).toLowerCase().trim()
            : nuevoEstado;

          item.estado = estadoFinal;
          const target = this.listaCatalogo.find(
            x => (x.id_procedimiento_catalogo || x.id_examen || (x as any).id) === id
          );
          if (target) {
            target.estado = estadoFinal;
          }
          this.filtrarExamenes();
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
          console.error('Error al cambiar estado del examen:', err);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cambiar el estado del examen clínico.',
            confirmButtonColor: '#4141a5'
          });
        }
      });
    });
  }

  // =========================================================================
  // CONTROL DE PAGINACIÓN
  // =========================================================================

  /**
   * Obtiene la totalidad de exámenes filtrados para visualización continua
   */
  get examenesPaginados(): ExamenClinico[] {
    return this.listaFiltrada;
  }

  cambiarPagina(nuevaPagina: number): void {
    if (nuevaPagina >= 1 && nuevaPagina <= this.totalPaginas) {
      this.paginaActual = nuevaPagina;
    }
  }

  paginaAnterior(): void {
    if (this.paginaActual > 1) {
      this.paginaActual--;
    }
  }

  paginaSiguiente(): void {
    if (this.paginaActual < this.totalPaginas) {
      this.paginaActual++;
    }
  }

  get paginasDisponibles(): number[] {
    const paginas: number[] = [];
    for (let i = 1; i <= this.totalPaginas; i++) {
      paginas.push(i);
    }
    return paginas;
  }

  get indiceInicio(): number {
    if (this.totalRegistros === 0) return 0;
    return (this.paginaActual - 1) * this.tamanoPagina + 1;
  }

  get indiceFin(): number {
    return Math.min(this.paginaActual * this.tamanoPagina, this.totalRegistros);
  }
}
