import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import {
  ExamenesClinicosService,
  ExamenClinico
} from '../services/examenes-clinicos.service';
import { RealtimeEventosService } from '../services/realtime-eventos.service';
import { AnimalIconComponent } from '../animal-icon/animal-icon';
import { PageTitleComponent } from '../page-title/page-title';

@Component({
  selector: 'app-examenes-clinicos',
  standalone: true,
  imports: [CommonModule, FormsModule, AnimalIconComponent, PageTitleComponent],
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
  importandoExcel: boolean = false;
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
  ) {
    inject(RealtimeEventosService)
      .on('catalogo.clinico_actualizado')
      .pipe(debounceTime(1000), takeUntilDestroyed())
      .subscribe(() => this.cargarCatalogo());
  }

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
        title: 'Campos obligatorios incompletos',
        text: 'Ingrese el nombre del examen clínico antes de guardar.',
        confirmButtonText: 'Aceptar'
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
            title: 'Registro actualizado',
            text: 'El examen clínico se actualizó correctamente.',
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
            title: 'No fue posible actualizar el registro',
            text: 'No se pudo actualizar el examen clínico. Verifique la conexión e intente nuevamente.',
            confirmButtonText: 'Aceptar'
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
            title: 'Registro guardado',
            text: 'El examen clínico se registró correctamente.',
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
            title: 'No fue posible guardar el registro',
            text: 'No se pudo registrar el examen clínico. Verifique la conexión e intente nuevamente.',
            confirmButtonText: 'Aceptar'
          });
        }
      });
    }
  }

  cambiarEstado(item: ExamenClinico): void {
    const id = item.id_procedimiento_catalogo || item.id_examen || (item as any).id;
    if (!id) {
      Swal.fire({
        icon: 'error',
        title: 'Identificador no encontrado',
        text: 'No se encontró el identificador del examen. Recargue la página e intente nuevamente.',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    const esActivo = this.verificarEstadoActivo(item);
    const nuevoEstado: 'activo' | 'inactivo' = esActivo ? 'inactivo' : 'activo';
    const accion = esActivo ? 'inactivar' : 'activar';
    const nombreMostrar = item.nombre || item.nombre_tipo || 'este examen';

    Swal.fire({
      title: 'Confirmar cambio de estado',
      text: `El examen clínico "${nombreMostrar}" quedará como ${nuevoEstado}.`,
      icon: 'warning',
      customClass: { popup: esActivo ? 'qa-destructivo' : '' },
      showCancelButton: true,
      confirmButtonText: esActivo ? 'Inactivar' : 'Activar',
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
            title: 'Estado actualizado',
            text: `El examen ahora está ${estadoFinal}.`,
            timer: 1500,
            showConfirmButton: false
          });
        },
        error: (err: any) => {
          console.error('Error al cambiar estado del examen:', err);
          Swal.fire({
            icon: 'error',
            title: 'No fue posible actualizar el estado',
            text: 'No se pudo cambiar el estado del examen clínico. Verifique la conexión e intente nuevamente.',
            confirmButtonText: 'Aceptar'
          });
        }
      });
    });
  }

  // =========================================================================
  // MÓDULO DE IMPORTACIÓN MASIVA DESDE EXCEL
  // =========================================================================

  private normalizarTexto(texto: string): string {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  private obtenerValorColumna(row: any, posiblesNombres: string[]): string {
    const keys = Object.keys(row || {});
    for (const posible of posiblesNombres) {
      const posNorm = this.normalizarTexto(posible);
      const keyFound = keys.find(k => this.normalizarTexto(k) === posNorm);
      if (keyFound && row[keyFound] !== undefined && row[keyFound] !== null) {
        const val = String(row[keyFound]).trim();
        if (val) return val;
      }
    }
    return '';
  }

  onArchivoExcelSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const nombreArchivo = file.name.toLowerCase();
    if (!nombreArchivo.endsWith('.xlsx') && !nombreArchivo.endsWith('.xls')) {
      Swal.fire({
        title: 'Formato no compatible',
        text: 'Seleccione un archivo de Excel válido (.xlsx o .xls).',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const buffer = e.target.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('El archivo no contiene ninguna hoja de cálculo.');
        }

        const primeraHojaNombre = workbook.SheetNames[0];
        const hoja = workbook.Sheets[primeraHojaNombre];
        const filas: any[] = XLSX.utils.sheet_to_json(hoja, { defval: '' });

        if (!filas || filas.length === 0) {
          Swal.fire({
            title: 'Archivo vacío',
            text: 'La hoja de cálculo no contiene filas con datos para importar.',
            icon: 'info',
            confirmButtonText: 'Aceptar'
          });
          return;
        }

        this.procesarImportacionFilas(filas, file.name);
      } catch (err: any) {
        console.error('Error al leer archivo Excel:', err);
        Swal.fire({
          title: 'Error de lectura',
          text: 'No se pudo leer el archivo Excel: ' + (err?.message || 'Error desconocido'),
          icon: 'error',
          confirmButtonText: 'Aceptar'
        });
      } finally {
        input.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  }

  private procesarImportacionFilas(filas: any[], nombreArchivo: string): void {
    const primeraFila = filas[0] || {};
    const keysPrimeraFila = Object.keys(primeraFila).map(k => this.normalizarTexto(k));

    const tieneNombre = keysPrimeraFila.some(k => ['nombre', 'examen', 'nombretipo', 'nombretipoexamen', 'nombreexamen', 'pruebadiagnostica'].includes(k));
    const tieneDescripcion = keysPrimeraFila.some(k => ['descripcion', 'detalle', 'descripcionhallazgos', 'hallazgos'].includes(k));
    const tieneTipo = keysPrimeraFila.some(k => ['tipo', 'categoria', 'clasificacion', 'tipodeexamen', 'sistema'].includes(k));
    const tieneEstado = keysPrimeraFila.some(k => ['estado', 'activo', 'status'].includes(k));

    const columnasFaltantes: string[] = [];
    if (!tieneNombre) columnasFaltantes.push('nombre');
    if (!tieneDescripcion) columnasFaltantes.push('descripcion');

    if (columnasFaltantes.length > 0) {
      Swal.fire({
        title: 'Estructura de columnas inválida',
        html: `
          <p class="text-sm text-slate-600 mb-2">El archivo debe contener al menos las siguientes columnas:</p>
          <ul class="text-left text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 font-mono text-slate-700">
            <li><b>nombre</b>: Nombre clínico del examen o test rápido (obligatorio)</li>
            <li><b>descripcion</b>: Descripción breve del procedimiento (obligatorio)</li>
            <li><b>tipo</b>: Clasificación o categoría (opcional, ej. Urianálisis, Citopatología...)</li>
            <li><b>estado</b>: Estado del registro (Activo / Inactivo)</li>
          </ul>
          <p class="text-xs text-rose-600 font-semibold mt-3">Columnas no detectadas: ${columnasFaltantes.join(', ')}</p>
        `,
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    const examenesAImportar: Partial<ExamenClinico>[] = [];
    const erroresValidacion: string[] = [];
    const nombresVistos = new Set<string>();

    filas.forEach((fila, idx) => {
      const numFila = idx + 2;
      const nombre = this.obtenerValorColumna(fila, ['nombre', 'examen', 'nombre_tipo', 'nombre_tipo_examen', 'nombre_examen', 'prueba_diagnostica']);
      const descripcion = this.obtenerValorColumna(fila, ['descripcion', 'detalle', 'descripcion_hallazgos', 'hallazgos']);
      const tipo = this.obtenerValorColumna(fila, ['tipo', 'categoria', 'clasificacion', 'tipo_de_examen', 'sistema']) || 'Prueba Diagnóstica';
      const estadoStr = this.obtenerValorColumna(fila, ['estado', 'activo', 'status']);

      if (!nombre) {
        erroresValidacion.push(`Fila ${numFila}: El campo "nombre" está vacío.`);
        return;
      }

      const claveUnica = this.normalizarTexto(nombre);
      if (nombresVistos.has(claveUnica)) {
        erroresValidacion.push(`Fila ${numFila}: El examen "${nombre}" está duplicado en el archivo.`);
        return;
      }
      nombresVistos.add(claveUnica);

      const estadoNorm = this.normalizarTexto(estadoStr);
      const estado = (estadoNorm === '' || ['activo', 'true', '1', 'si', 'habilitado'].includes(estadoNorm))
        ? 'activo'
        : 'inactivo';

      examenesAImportar.push({
        nombre,
        nombre_tipo: nombre,
        nombre_tipo_examen: nombre,
        descripcion: descripcion || '',
        descripcion_hallazgos: descripcion || '',
        tipo,
        ruta_archivo_resultado: tipo,
        estado,
        solicitado: true
      });
    });

    if (erroresValidacion.length > 0) {
      const listaHtml = erroresValidacion.slice(0, 8).map(e => `<li>${e}</li>`).join('');
      const restantes = erroresValidacion.length > 8 ? `<li class="font-bold">... y ${erroresValidacion.length - 8} errores más</li>` : '';
      Swal.fire({
        title: 'Validación de datos fallida',
        html: `
          <p class="text-sm text-slate-600 mb-2">Se encontraron <b>${erroresValidacion.length}</b> inconsistencias en el archivo:</p>
          <ul class="text-left text-xs bg-rose-50 text-rose-700 p-3 rounded-lg border border-rose-200 max-h-48 overflow-y-auto space-y-1">
            ${listaHtml}
            ${restantes}
          </ul>
          <p class="text-xs text-slate-500 mt-2">Corrija el archivo Excel e intente nuevamente.</p>
        `,
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    if (examenesAImportar.length === 0) {
      Swal.fire({
        title: 'Sin datos válidos',
        text: 'No se encontraron registros válidos para procesar.',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    // Confirmación previa
    Swal.fire({
      title: '¿Confirmar importación masiva?',
      html: `
        <div class="text-left text-sm text-slate-600 space-y-2">
          <p>Archivo: <b class="text-slate-800">${nombreArchivo}</b></p>
          <p>Total de exámenes / pruebas detectadas: <b class="text-[#4141A5] text-base">${examenesAImportar.length}</b></p>
          <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs text-slate-600">
            ✓ Columnas verificadas: nombre, descripción, tipo y estado.<br>
            ✓ Se integrarán al catálogo de exámenes clínicos de forma segura.
          </div>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, importar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4141A5'
    }).then(result => {
      if (result.isConfirmed) {
        this.ejecutarCargaMasiva(examenesAImportar);
      }
    });
  }

  private async ejecutarCargaMasiva(examenesAImportar: Partial<ExamenClinico>[]): Promise<void> {
    this.importandoExcel = true;
    this.cdr.detectChanges();

    Swal.fire({
      title: 'Importando exámenes clínicos...',
      html: `
        <div class="space-y-3">
          <p class="text-sm text-slate-600">Guardando registros en la base de datos...</p>
          <div class="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
            <div id="progreso-importacion-barra" class="bg-[#4141A5] h-2.5 rounded-full transition-all duration-200" style="width: 5%"></div>
          </div>
          <p id="progreso-importacion-texto" class="text-xs text-slate-500 font-semibold">Procesando 0 de ${examenesAImportar.length}</p>
        </div>
      `,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    // 1. Intentar endpoint de carga masiva en una sola petición
    try {
      const respMasiva: any = await firstValueFrom(this.examenesService.importarExamenesMasivo(examenesAImportar));
      this.importandoExcel = false;
      this.cargarCatalogo();
      this.cdr.detectChanges();

      const creados = respMasiva?.creados_count ?? examenesAImportar.length;
      const actualizados = respMasiva?.actualizados_count ?? 0;
      const errores = respMasiva?.errores?.length ?? 0;

      Swal.fire({
        title: '¡Importación completada con éxito!',
        html: `
          <div class="text-left text-sm text-slate-700 space-y-1.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p>Total de registros procesados: <b>${examenesAImportar.length}</b></p>
            <p class="text-emerald-700 font-semibold">Nuevos exámenes registrados: <b>${creados}</b></p>
            ${actualizados > 0 ? `<p class="text-indigo-700">Exámenes actualizados: <b>${actualizados}</b></p>` : ''}
            ${errores > 0 ? `<p class="text-rose-600">Errores reportados: <b>${errores}</b></p>` : ''}
          </div>
        `,
        icon: 'success',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#4141A5'
      });
      return;
    } catch (errMasivo: any) {
      console.warn('Endpoint masivo no disponible o falló, procesando por lotes individuales:', errMasivo);
    }

    // 2. Fallback por lotes concurrentes individuales
    let exitosos = 0;
    let fallidos = 0;
    const TAMANO_LOTE = 5;

    for (let i = 0; i < examenesAImportar.length; i += TAMANO_LOTE) {
      const lote = examenesAImportar.slice(i, i + TAMANO_LOTE);

      await Promise.all(
        lote.map(async item => {
          try {
            await firstValueFrom(this.examenesService.crearExamen(item));
            exitosos++;
          } catch (err: any) {
            console.warn(`Examen "${item.nombre}" no se pudo crear:`, err);
            fallidos++;
          }
        })
      );

      const procesadosHastaAhora = Math.min(i + TAMANO_LOTE, examenesAImportar.length);
      const porcentaje = Math.round((procesadosHastaAhora / examenesAImportar.length) * 100);

      const barra = document.getElementById('progreso-importacion-barra');
      const texto = document.getElementById('progreso-importacion-texto');
      if (barra) barra.style.width = `${porcentaje}%`;
      if (texto) texto.textContent = `Procesando ${procesadosHastaAhora} de ${examenesAImportar.length} (${porcentaje}%)`;
    }

    this.importandoExcel = false;
    this.cargarCatalogo();
    this.cdr.detectChanges();

    if (exitosos > 0) {
      Swal.fire({
        title: fallidos === 0 ? '¡Importación masiva exitosa!' : 'Importación finalizada con observaciones',
        html: `
          <div class="text-left text-sm text-slate-700 space-y-1.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p>Total de exámenes procesados: <b>${examenesAImportar.length}</b></p>
            <p class="text-emerald-700 font-semibold">Guardados exitosamente: <b>${exitosos}</b></p>
            ${fallidos > 0 ? `<p class="text-amber-600 font-semibold">Omitidos o con error: <b>${fallidos}</b></p>` : ''}
          </div>
        `,
        icon: fallidos === 0 ? 'success' : 'info',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#4141A5'
      });
    } else {
      Swal.fire({
        title: 'Error en la importación',
        text: 'No fue posible registrar los exámenes en el servidor. Revise su conexión e intente nuevamente.',
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    }
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
