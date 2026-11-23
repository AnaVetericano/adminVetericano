import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { debounceTime } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { AuthService, Patologia, CrearPatologia } from '../services/auth';
import { RealtimeEventosService } from '../services/realtime-eventos.service';
import { AnimalIconComponent } from '../animal-icon/animal-icon';
import { PageTitleComponent } from '../page-title/page-title';
import { PaginadorComponent, PaginarPipe, TAMANO_PAGINA_PREDETERMINADO } from '../paginador/paginador';
import {
  esEndpointNoDisponible,
  leerPrimeraHojaExcel,
  normalizarTextoExcel,
  obtenerValorColumnaExcel
} from '../utils/excel-import.util';

@Component({
  selector: 'app-patologias',
  standalone: true,
  imports: [CommonModule, FormsModule, AnimalIconComponent, PageTitleComponent, PaginadorComponent, PaginarPipe],
  templateUrl: './patologias.html',
  styleUrl: './patologias.css',
})
export class Patologias implements OnInit {
  modalAbierto: boolean = false;
  patologias: Patologia[] = [];
  patologiasOriginales: Patologia[] = []; 
  pagina = 1;
  tamanoPagina = TAMANO_PAGINA_PREDETERMINADO;
  filtroBusqueda: string = ''; 
  filtroEstado: boolean | null = null;
  filtroTipo: string = '';
  menuFiltroAbierto: boolean = false;
  cargando: boolean = true;
  importandoExcel: boolean = false;
  
  editandoId: number | null = null; 
  patologia = {
    nombre: '',
    descripcion: '',
    tipo_de_enfermedad: '',
    activo: true
  };

  constructor(
    private router: Router, 
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    inject(RealtimeEventosService)
      .on('catalogo.clinico_actualizado')
      .pipe(debounceTime(1000), takeUntilDestroyed())
      .subscribe(() => this.obtenerPatologias());
  }

  ngOnInit(): void {
    this.obtenerPatologias();
  }

  get esAdmin(): boolean {
    return this.authService.isAdmin();
  }

  get tiposDisponibles(): string[] {
    const set = new Set<string>();
    for (const p of this.patologiasOriginales) {
      const t = (p.tipo_de_enfermedad || '').trim();
      if (t) set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }

  obtenerPatologias(): void {
    this.cargando = true;
    this.authService.listarPatologias().subscribe({
      next: (data: any) => {
        const lista: Patologia[] = Array.isArray(data) ? data : (data?.results || []);
        this.patologiasOriginales = lista;
        this.filtrarPatologias(false);
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

  filtrarPatologias(reiniciarPagina = true): void {
    if (reiniciarPagina) {
      this.pagina = 1;
    }
    const termino = (this.filtroBusqueda || '').toLowerCase().trim();
    const tipoSel = (this.filtroTipo || '').toLowerCase().trim();

    this.patologias = this.patologiasOriginales.filter(p => {
      const coincideTexto = !termino ||
        (p.nombre || '').toLowerCase().includes(termino) ||
        (p.descripcion || '').toLowerCase().includes(termino) ||
        (p.tipo_de_enfermedad || '').toLowerCase().includes(termino);
      const coincideEstado = this.filtroEstado === null || p.activo === this.filtroEstado;
      const coincideTipo = !tipoSel || (p.tipo_de_enfermedad || '').toLowerCase().trim() === tipoSel;
      return coincideTexto && coincideEstado && coincideTipo;
    });
  }

  toggleMenuFiltro(): void {
    this.menuFiltroAbierto = !this.menuFiltroAbierto;
  }

  filtrarPorEstado(estado: boolean | null): void {
    this.filtroEstado = estado;
    this.menuFiltroAbierto = false;
    this.filtrarPatologias();
  }

  filtrarPorTipo(tipo: string): void {
    this.filtroTipo = tipo;
    this.menuFiltroAbierto = false;
    this.filtrarPatologias();
  }

  abrirModalCrear(): void {
    if (!this.esAdmin) return;
    this.editandoId = null; 
    this.patologia = { nombre: '', descripcion: '', tipo_de_enfermedad: '', activo: true }; 
    this.modalAbierto = true;
  }

  abrirModalEditar(p: Patologia): void {
    if (!this.esAdmin) return;
    this.editandoId = p.id_patologia ?? null;
    this.patologia = {
      nombre: p.nombre || '',
      descripcion: p.descripcion || '',
      tipo_de_enfermedad: p.tipo_de_enfermedad || '',
      activo: p.activo ?? true
    };
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.editandoId = null;
  }

  guardarPatologia(): void {
    if (!this.esAdmin) return;
    const nombreLimpio = (this.patologia.nombre || '').trim();
    if (!nombreLimpio) {
      Swal.fire({
        title: 'Campo obligatorio',
        text: 'Ingrese el nombre de la patología para continuar.',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    if (nombreLimpio.length > 150) {
      Swal.fire({
        title: 'Límite de caracteres excedido',
        text: 'El nombre de la patología no puede superar los 150 caracteres.',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    const tipoLimpio = (this.patologia.tipo_de_enfermedad || '').trim();
    if (tipoLimpio.length > 100) {
      Swal.fire({
        title: 'Límite de caracteres excedido',
        text: 'El tipo de enfermedad no puede superar los 100 caracteres.',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    const descLimpia = (this.patologia.descripcion || '').trim();
    const payload: CrearPatologia = {
      nombre: nombreLimpio,
      descripcion: descLimpia || null,
      tipo_de_enfermedad: tipoLimpio || null,
      activo: this.patologia.activo
    };

    if (this.editandoId !== null) {
      this.authService.actualizarPatologia(this.editandoId, payload).subscribe({
        next: () => {
          this.cerrarModal();
          this.obtenerPatologias();
          Swal.fire({
            title: 'Actualizada',
            text: 'La patología se actualizó correctamente.',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
        },
        error: (err: any) => {
          console.error('Error al actualizar:', err);
          Swal.fire({
            title: 'No fue posible actualizar la patología',
            text: err?.error?.detail || err?.error?.nombre?.[0] || 'Ocurrió un error al guardar los cambios. Intente nuevamente.',
            icon: 'error',
            confirmButtonText: 'Aceptar'
          });
          this.cdr.detectChanges();
        }
      });
    } else {
      this.authService.crearPatologia(payload).subscribe({
        next: () => {
          this.cerrarModal();
          this.obtenerPatologias();
          this.patologia = { nombre: '', descripcion: '', tipo_de_enfermedad: '', activo: true };
          Swal.fire({
            title: 'Creada',
            text: 'La patología se registró con éxito en el catálogo.',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
        },
        error: (err: any) => {
          console.error('Error al guardar:', err);
          Swal.fire({
            title: 'No fue posible crear la patología',
            text: err?.error?.detail || err?.error?.nombre?.[0] || 'Ocurrió un error al guardar la patología. Intente nuevamente.',
            icon: 'error',
            confirmButtonText: 'Aceptar'
          });
          this.cdr.detectChanges();
        }
      });
    }
  }

  eliminarPatologia(p: Patologia): void {
    if (!this.esAdmin || !p.id_patologia) return;

    Swal.fire({
      title: '¿Eliminar patología?',
      text: `Se eliminará "${p.nombre}" del catálogo clínico veterinario.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then(result => {
      if (result.isConfirmed) {
        this.authService.eliminarPatologia(p.id_patologia!).subscribe({
          next: () => {
            Swal.fire({
              title: 'Eliminada',
              text: 'La patología ha sido eliminada con éxito.',
              icon: 'success',
              timer: 1500,
              showConfirmButton: false
            });
            this.obtenerPatologias();
          },
          error: (err: any) => {
            console.error('Error al eliminar:', err);
            Swal.fire({
              title: 'No fue posible eliminar',
              text: err?.error?.detail || 'No se pudo eliminar la patología seleccionada.',
              icon: 'error',
              confirmButtonText: 'Aceptar'
            });
          }
        });
      }
    });
  }

  // ==========================================
  // MÓDULO DE IMPORTACIÓN MASIVA DESDE EXCEL
  // ==========================================

  async onArchivoExcelSeleccionado(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!this.esAdmin) {
      input.value = '';
      return;
    }
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

    try {
      const filas = await leerPrimeraHojaExcel(file);
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
  }

  private procesarImportacionFilas(filas: Record<string, any>[], nombreArchivo: string): void {
    const primeraFila = filas[0] || {};
    const keysPrimeraFila = Object.keys(primeraFila).map(k => normalizarTextoExcel(k));
    const tieneNombre = keysPrimeraFila.some(k => ['nombre', 'patologia', 'nombrepatologia', 'enfermedad'].includes(k));

    if (!tieneNombre) {
      Swal.fire({
        title: 'Estructura de columnas inválida',
        html: `
          <p class="text-sm text-slate-600 mb-2">El archivo debe incluir al menos la columna obligatoria <b>nombre</b> (y opcionalmente <b>descripcion</b>, <b>tipo_de_enfermedad</b>, <b>estado</b>):</p>
          <ul class="text-left text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 font-mono text-slate-700">
            <li><b>nombre</b>: Nombre clínico o común de la patología (obligatorio)</li>
            <li><b>tipo_de_enfermedad</b>: Clasificación o sistema afectado (opcional)</li>
            <li><b>descripcion</b>: Descripción de la patología (opcional)</li>
            <li><b>estado</b>: Estado del registro (Activo / Inactivo, opcional)</li>
          </ul>
        `,
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    const patologiasAImportar: CrearPatologia[] = [];
    const erroresValidacion: string[] = [];
    const nombresVistos = new Set<string>();

    filas.forEach((fila, idx) => {
      const numFila = idx + 2;
      const nombre = obtenerValorColumnaExcel(fila, ['nombre', 'patologia', 'nombre_patologia', 'enfermedad']);
      const descripcion = obtenerValorColumnaExcel(fila, ['descripcion', 'detalle']);
      const tipo = obtenerValorColumnaExcel(fila, ['tipo_de_enfermedad', 'tipo_enfermedad', 'tipo', 'clasificacion', 'sistema']);
      const estadoStr = obtenerValorColumnaExcel(fila, ['estado', 'activo', 'status']);

      if (!nombre) {
        erroresValidacion.push(`Fila ${numFila}: El campo "nombre" está vacío.`);
        return;
      }
      if (nombre.length > 150) {
        erroresValidacion.push(`Fila ${numFila}: El nombre "${nombre.slice(0, 30)}..." supera los 150 caracteres.`);
        return;
      }
      if (tipo.length > 100) {
        erroresValidacion.push(`Fila ${numFila} ("${nombre}"): El campo "tipo_de_enfermedad" supera los 100 caracteres.`);
        return;
      }

      const claveUnica = normalizarTextoExcel(nombre);
      if (nombresVistos.has(claveUnica)) {
        erroresValidacion.push(`Fila ${numFila}: La patología "${nombre}" está duplicada en el archivo.`);
        return;
      }
      nombresVistos.add(claveUnica);

      const estadoNorm = normalizarTextoExcel(estadoStr);
      const activo = estadoNorm === '' || ['activo', 'true', '1', 'si', 'habilitado'].includes(estadoNorm);

      patologiasAImportar.push({
        nombre,
        descripcion: descripcion || null,
        tipo_de_enfermedad: tipo || null,
        activo
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

    if (patologiasAImportar.length === 0) {
      Swal.fire({
        title: 'Sin datos válidos',
        text: 'No se encontraron patologías válidas para procesar.',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    Swal.fire({
      title: '¿Confirmar importación masiva?',
      html: `
        <div class="text-left text-sm text-slate-600 space-y-2">
          <p>Archivo: <b class="text-slate-800">${nombreArchivo}</b></p>
          <p>Total de patologías detectadas: <b class="text-[#4141A5] text-base">${patologiasAImportar.length}</b></p>
          <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs text-slate-600">
            ✓ Registros validados sin duplicados internos.<br>
            ✓ Los registros existentes conservarán sus campos si las columnas opcionales vienen vacías.
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
        this.ejecutarCargaMasiva(patologiasAImportar);
      }
    });
  }

  private async ejecutarCargaMasiva(patologiasAImportar: CrearPatologia[]): Promise<void> {
    this.importandoExcel = true;
    this.cdr.detectChanges();

    Swal.fire({
      title: 'Importando patologías...',
      html: `
        <div class="space-y-3">
          <p class="text-sm text-slate-600">Guardando registros en la base de datos...</p>
          <div class="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
            <div id="progreso-importacion-barra" class="bg-[#4141A5] h-2.5 rounded-full transition-all duration-200" style="width: 15%"></div>
          </div>
          <p id="progreso-importacion-texto" class="text-xs text-slate-500 font-semibold">Procesando ${patologiasAImportar.length} registros...</p>
        </div>
      `,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const respMasiva: any = await firstValueFrom(this.authService.importarPatologiasMasivo(patologiasAImportar));
      this.importandoExcel = false;
      this.obtenerPatologias();
      this.cdr.detectChanges();

      const creados = respMasiva?.creados_count ?? patologiasAImportar.length;
      const actualizados = respMasiva?.actualizados_count ?? 0;
      const listaErrores: string[] = Array.isArray(respMasiva?.errores) ? respMasiva.errores : [];
      const erroresHtml = listaErrores.length > 0
        ? `<ul class="text-left text-xs text-rose-700 bg-rose-50 p-2 rounded border border-rose-200 max-h-32 overflow-y-auto mt-2">${listaErrores.slice(0, 5).map(e => `<li>${e}</li>`).join('')}</ul>`
        : '';

      Swal.fire({
        title: listaErrores.length === 0 ? '¡Importación completada con éxito!' : 'Importación completada con observaciones',
        html: `
          <div class="text-left text-sm text-slate-700 space-y-1.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p>Total de patologías procesadas: <b>${patologiasAImportar.length}</b></p>
            <p class="text-emerald-700 font-semibold">Nuevas patologías registradas: <b>${creados}</b></p>
            ${actualizados > 0 ? `<p class="text-indigo-700">Patologías actualizadas: <b>${actualizados}</b></p>` : ''}
            ${listaErrores.length > 0 ? `<p class="text-rose-600">Errores reportados: <b>${listaErrores.length}</b></p>` : ''}
            ${erroresHtml}
          </div>
        `,
        icon: listaErrores.length === 0 ? 'success' : 'info',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#4141A5'
      });
      return;
    } catch (errMasivo: any) {
      if (!esEndpointNoDisponible(errMasivo)) {
        this.importandoExcel = false;
        this.cdr.detectChanges();
        const detalle = errMasivo?.error?.errores?.[0] || errMasivo?.error?.detail || 'No fue posible completar la importación masiva.';
        Swal.fire({
          title: 'Error en la importación',
          text: detalle,
          icon: 'error',
          confirmButtonText: 'Aceptar'
        });
        return;
      }
      console.warn('Endpoint masivo no disponible, procesando por lotes individuales:', errMasivo);
    }

    let exitosos = 0;
    let fallidos = 0;
    const TAMANO_LOTE = 5;

    for (let i = 0; i < patologiasAImportar.length; i += TAMANO_LOTE) {
      const lote = patologiasAImportar.slice(i, i + TAMANO_LOTE);
      await Promise.all(
        lote.map(async item => {
          try {
            await firstValueFrom(this.authService.crearPatologia(item));
            exitosos++;
          } catch {
            fallidos++;
          }
        })
      );

      const procesadosHastaAhora = Math.min(i + TAMANO_LOTE, patologiasAImportar.length);
      const porcentaje = Math.round((procesadosHastaAhora / patologiasAImportar.length) * 100);
      const barra = document.getElementById('progreso-importacion-barra');
      const texto = document.getElementById('progreso-importacion-texto');
      if (barra) barra.style.width = `${porcentaje}%`;
      if (texto) texto.textContent = `Procesando ${procesadosHastaAhora} de ${patologiasAImportar.length} (${porcentaje}%)`;
    }

    this.importandoExcel = false;
    this.obtenerPatologias();
    this.cdr.detectChanges();

    if (exitosos > 0) {
      Swal.fire({
        title: fallidos === 0 ? '¡Importación masiva exitosa!' : 'Importación finalizada con observaciones',
        html: `
          <div class="text-left text-sm text-slate-700 space-y-1.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p>Total de patologías procesadas: <b>${patologiasAImportar.length}</b></p>
            <p class="text-emerald-700 font-semibold">Guardadas exitosamente: <b>${exitosos}</b></p>
            ${fallidos > 0 ? `<p class="text-amber-600 font-semibold">Omitidas o ya existentes: <b>${fallidos}</b></p>` : ''}
          </div>
        `,
        icon: fallidos === 0 ? 'success' : 'info',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#4141A5'
      });
    } else {
      Swal.fire({
        title: 'Error en la importación',
        text: 'No fue posible registrar las patologías en el servidor. Revise su conexión e intente nuevamente.',
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    }
  }
}