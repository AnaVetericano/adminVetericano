import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { AuthService, CrearMedicamento, ActualizarMedicamento } from '../services/auth';

export interface OpcionViaAdministracion {
  valor: string;
  etiqueta: string;
  unidad: 'und' | 'ml' | 'g';
  nombreUnidad: string;
  labelCantidad: string;
  placeholder: string;
}

@Component({
  selector: 'app-medicamentos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './crear-medicamentos.html',
  styleUrl: './crear-medicamentos.css',
})
export class Medicamentos implements OnInit {
  modalAbierto: boolean = false;
  medicamentos: any[] = [];
  medicamentosOriginales: any[] = [];
  filtroBusqueda: string = '';
  menuFiltroAbierto: boolean = false;
  cargando: boolean = true;

  editandoId: number | null = null;
  importandoExcel: boolean = false;

  viasAdministracion: OpcionViaAdministracion[] = [
    {
      valor: 'Oral (Pastilla / Tableta)',
      etiqueta: 'Oral (Pastilla / Tableta / Cápsula) — Unidades (und)',
      unidad: 'und',
      nombreUnidad: 'unidades',
      labelCantidad: 'Cantidad (Unidades)',
      placeholder: 'Ej. 20'
    },
    {
      valor: 'Oral (Jarabe / Suspensión)',
      etiqueta: 'Oral (Jarabe / Suspensión líquida) — Mililitros (ml)',
      unidad: 'ml',
      nombreUnidad: 'ml',
      labelCantidad: 'Cantidad (ml)',
      placeholder: 'Ej. 100'
    },
    {
      valor: 'Subcutánea (SC)',
      etiqueta: 'Subcutánea (SC - Inyectable) — Mililitros (ml)',
      unidad: 'ml',
      nombreUnidad: 'ml',
      labelCantidad: 'Cantidad (ml)',
      placeholder: 'Ej. 50'
    },
    {
      valor: 'Intramuscular (IM)',
      etiqueta: 'Intramuscular (IM - Inyectable) — Mililitros (ml)',
      unidad: 'ml',
      nombreUnidad: 'ml',
      labelCantidad: 'Cantidad (ml)',
      placeholder: 'Ej. 50'
    },
    {
      valor: 'Intravenosa (IV)',
      etiqueta: 'Intravenosa (IV - Inyectable / Suero) — Mililitros (ml)',
      unidad: 'ml',
      nombreUnidad: 'ml',
      labelCantidad: 'Cantidad (ml)',
      placeholder: 'Ej. 100'
    },
    {
      valor: 'Tópica (Crema / Pomada)',
      etiqueta: 'Tópica (Crema / Pomada / Pasta) — Gramos (g)',
      unidad: 'g',
      nombreUnidad: 'gramos (g)',
      labelCantidad: 'Cantidad (g)',
      placeholder: 'Ej. 30'
    },
    {
      valor: 'Tópica (Spray / Solución)',
      etiqueta: 'Tópica (Spray / Solución líquida) — Mililitros (ml)',
      unidad: 'ml',
      nombreUnidad: 'ml',
      labelCantidad: 'Cantidad (ml)',
      placeholder: 'Ej. 120'
    },
    {
      valor: 'Tópica (Pipeta / Spot-on)',
      etiqueta: 'Tópica (Pipeta / Spot-on) — Unidades (und)',
      unidad: 'und',
      nombreUnidad: 'unidades',
      labelCantidad: 'Cantidad (Unidades)',
      placeholder: 'Ej. 1'
    },
    {
      valor: 'Ótica (Oídos)',
      etiqueta: 'Ótica (Gotas / Limpiador de oídos) — Mililitros (ml)',
      unidad: 'ml',
      nombreUnidad: 'ml',
      labelCantidad: 'Cantidad (ml)',
      placeholder: 'Ej. 15'
    },
    {
      valor: 'Oftálmica (Ojos)',
      etiqueta: 'Oftálmica (Colirio / Gotas oculares) — Mililitros (ml)',
      unidad: 'ml',
      nombreUnidad: 'ml',
      labelCantidad: 'Cantidad (ml)',
      placeholder: 'Ej. 10'
    },
    {
      valor: 'Otros',
      etiqueta: 'Otros — Sin clasificar / General',
      unidad: 'und',
      nombreUnidad: 'unidades',
      labelCantidad: 'Cantidad',
      placeholder: 'Ej. 1'
    }
  ];

  tiposSugeridos: string[] = [
    'Antibiótico',
    'Analgésico',
    'Antiinflamatorio',
    'Antiparasitario',
    'Vacuna',
    'Calmante / Sedante',
    'Cicatrizante / Antiséptico',
    'Vitaminas / Suplemento',
    'Otro',
    'Otros'
  ];

  medicamento = {
    nombre: '',
    descripcion: '',
    cantidad_ml: null as number | null,
    tipo: '',
    via_administracion: '',
    activo: true
  };

  constructor(
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.obtenerMedicamentos();
  }

  private normalizarTexto(texto?: string | null): string {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /**
   * Determina la unidad de medida ('und', 'ml', 'g') y etiquetas dinámicas
   * según la vía de administración (y tipo/descripción como respaldo).
   */
  obtenerInfoUnidad(via?: string | null, tipo?: string | null, descripcion?: string | null): OpcionViaAdministracion {
    const viaRaw = (via || '').trim();
    const coincidenciaExacta = this.viasAdministracion.find(
      v => this.normalizarTexto(v.valor) === this.normalizarTexto(viaRaw)
    );
    if (coincidenciaExacta) {
      return coincidenciaExacta;
    }

    const v = this.normalizarTexto(viaRaw);
    const t = this.normalizarTexto(tipo);
    const d = this.normalizarTexto(descripcion);

    // 1. Si menciona jarabe, suspensión, spray o solución líquida -> ml
    if (
      v.includes('jarabe') ||
      v.includes('suspension') ||
      v.includes('spray') ||
      v.includes('solucion') ||
      v.includes('liquido')
    ) {
      return this.viasAdministracion[1]; // ml
    }

    // 2. Si la vía es Oral (pastilla/tableta/cápsula) o Pipeta -> Unidades (und)
    if (
      v.includes('oral') ||
      v.includes('pastilla') ||
      v.includes('tableta') ||
      v.includes('capsula') ||
      v.includes('comprimido') ||
      v.includes('pipeta') ||
      v.includes('spot') ||
      v.includes('unidad')
    ) {
      return this.viasAdministracion[0]; // und
    }

    // 3. Si es crema, pomada, pasta, ungüento o tópica sólida -> Gramos (g)
    if (
      v.includes('crema') ||
      v.includes('pomada') ||
      v.includes('pasta') ||
      v.includes('unguento') ||
      v.includes('gel') ||
      t.includes('pasta') ||
      t.includes('crema') ||
      t.includes('pomada')
    ) {
      return this.viasAdministracion[5]; // g
    }

    // 4. Si la vía no está definida pero el tipo o descripción indica pastilla/tableta -> Unidades (und)
    if (
      !v &&
      (t.includes('pastilla') ||
        t.includes('tableta') ||
        t.includes('capsula') ||
        t.includes('comprimido') ||
        d.includes('pastilla') ||
        d.includes('tableta') ||
        d.includes('capsula'))
    ) {
      return this.viasAdministracion[0]; // und
    }

    // 5. Por defecto (Subcutánea, Intramuscular, Intravenosa, Ótica, Oftálmica, Tópica líquida, etc.) -> ml
    return this.viasAdministracion[2]; // ml
  }

  get infoUnidadActual(): OpcionViaAdministracion {
    return this.obtenerInfoUnidad(
      this.medicamento.via_administracion,
      this.medicamento.tipo,
      this.medicamento.descripcion
    );
  }

  /**
   * Formatea la cantidad de cada fila en la tabla con su unidad correspondiente ('und', 'ml', 'g'),
   * evitando duplicar sufijos si algún registro antiguo ya traía letras en cantidad_ml (ej. '2ml').
   */
  formatearCantidadTabla(m: any): string {
    if (m?.cantidad_ml === null || m?.cantidad_ml === undefined || m?.cantidad_ml === '') {
      return '-';
    }
    const raw = String(m.cantidad_ml).trim();
    const soloNumero = raw.replace(/[a-zA-Z\s]+$/, '').trim() || raw;
    const info = this.obtenerInfoUnidad(m?.via_administracion || m?.via, m?.tipo, m?.descripcion);
    return `${soloNumero} ${info.unidad}`;
  }

  /**
   * Normaliza vías antiguas guardadas en texto libre para que al editar un medicamento
   * el selector (<select>) marque la opción adecuada.
   */
  private normalizarViaParaSelector(viaRaw?: string, tipoRaw?: string): string {
    const limpia = (viaRaw || '').trim();
    if (!limpia) return '';

    const exacta = this.viasAdministracion.find(
      v => this.normalizarTexto(v.valor) === this.normalizarTexto(limpia)
    );
    if (exacta) return exacta.valor;

    const v = this.normalizarTexto(limpia);
    const t = this.normalizarTexto(tipoRaw);

    if (v.includes('oral')) {
      return v.includes('jarabe') || v.includes('suspension')
        ? 'Oral (Jarabe / Suspensión)'
        : 'Oral (Pastilla / Tableta)';
    }
    if (v.includes('subcutanea') || v === 'sc') return 'Subcutánea (SC)';
    if (v.includes('intramuscular') || v === 'im') return 'Intramuscular (IM)';
    if (v.includes('intravenosa') || v === 'iv') return 'Intravenosa (IV)';
    if (v.includes('otica') || v.includes('oido') || v.includes('oreja')) return 'Ótica (Oídos)';
    if (v.includes('oftalmica') || v.includes('ojo')) return 'Oftálmica (Ojos)';
    if (v.includes('pipeta') || v.includes('spot')) return 'Tópica (Pipeta / Spot-on)';
    if (v.includes('topica') || v.includes('cutanea')) {
      if (t.includes('pasta') || t.includes('crema') || t.includes('pomada') || v.includes('crema')) {
        return 'Tópica (Crema / Pomada)';
      }
      return 'Tópica (Spray / Solución)';
    }

    return limpia;
  }

  esViaPersonalizada(via?: string): boolean {
    if (!via || !via.trim()) return false;
    return !this.viasAdministracion.some(v => v.valor === via);
  }

  obtenerMedicamentos(): void {
    this.cargando = true;
    this.authService.listarMedicamentos().subscribe({
      next: (data: any) => {
        const rawList = Array.isArray(data) ? data : (data.results || []);

        // Unificar estado/activo para que siempre reflejen un valor booleano (por defecto activo)
        const lista = rawList.map((m: any) => {
          const esActivo = m.activo !== undefined ? Boolean(m.activo) : (m.estado !== undefined ? Boolean(m.estado) : true);
          return {
            ...m,
            activo: esActivo,
            estado: esActivo
          };
        });

        // Organizar alfabéticamente el campo nombre de la A a la Z
        lista.sort((a: any, b: any) => {
          const nomA = (a?.nombre || '').trim();
          const nomB = (b?.nombre || '').trim();
          return nomA.localeCompare(nomB, 'es', { sensitivity: 'base', numeric: true });
        });

        this.medicamentos = lista;
        this.medicamentosOriginales = [...lista];
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error al listar medicamentos:', err);
        this.cargando = false;
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los medicamentos.',
          icon: 'error',
          confirmButtonColor: '#d33'
        });
      }
    });
  }

  filtrarMedicamentos(): void {
    const termino = this.filtroBusqueda.toLowerCase().trim();
    if (!termino) {
      this.medicamentos = [...this.medicamentosOriginales];
      return;
    }
    this.medicamentos = this.medicamentosOriginales.filter(m =>
      m?.nombre?.toLowerCase().includes(termino) ||
      m?.descripcion?.toLowerCase().includes(termino) ||
      m?.tipo?.toLowerCase().includes(termino) ||
      m?.via_administracion?.toLowerCase().includes(termino) ||
      m?.via?.toLowerCase().includes(termino)
    );
  }

  toggleMenuFiltro(): void {
    this.menuFiltroAbierto = !this.menuFiltroAbierto;
  }

  filtrarPorEstado(estado: boolean | null): void {
    this.menuFiltroAbierto = false;
    if (estado === null) {
      this.medicamentos = [...this.medicamentosOriginales];
    } else {
      this.medicamentos = this.medicamentosOriginales.filter(m => m.activo === estado || m.estado === estado);
    }
  }

  abrirModalCrear(): void {
    this.editandoId = null;
    this.medicamento = {
      nombre: '',
      descripcion: '',
      cantidad_ml: null,
      tipo: '',
      via_administracion: 'Oral (Pastilla / Tableta)',
      activo: true
    };
    this.modalAbierto = true;
  }

  abrirModalEditar(m: any): void {
    this.editandoId = m?.id || m?.id_medicamento || null;
    const cantRaw = m?.cantidad_ml !== null && m?.cantidad_ml !== undefined
      ? parseFloat(String(m.cantidad_ml).replace(/[^\d.]/g, ''))
      : null;

    const esActivo = m?.activo !== undefined ? Boolean(m.activo) : (m?.estado !== undefined ? Boolean(m.estado) : true);

    this.medicamento = {
      nombre: m?.nombre || '',
      descripcion: m?.descripcion || '',
      cantidad_ml: cantRaw !== null && !isNaN(cantRaw) ? cantRaw : null,
      tipo: m?.tipo || '',
      via_administracion: this.normalizarViaParaSelector(m?.via_administracion || m?.via || '', m?.tipo || ''),
      activo: esActivo
    };
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.editandoId = null;
  }

  guardarMedicamento(): void {
    if (!this.medicamento.nombre.trim()) {
      Swal.fire({
        title: 'Campo obligatorio',
        text: 'Debes ingresar el nombre del medicamento.',
        icon: 'warning',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    if (!this.medicamento.tipo.trim()) {
      Swal.fire({
        title: 'Campo obligatorio',
        text: 'Debes ingresar el tipo de medicamento.',
        icon: 'warning',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    if (!this.medicamento.via_administracion?.trim()) {
      Swal.fire({
        title: 'Campo obligatorio',
        text: 'Debes seleccionar la vía de administración.',
        icon: 'warning',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    if (this.medicamento.cantidad_ml === null || this.medicamento.cantidad_ml === undefined || Number(this.medicamento.cantidad_ml) <= 0) {
      const info = this.infoUnidadActual;
      Swal.fire({
        title: 'Campo obligatorio',
        text: `Debes ingresar una cantidad válida en ${info.nombreUnidad}.`,
        icon: 'warning',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    const viaFinal = this.medicamento.via_administracion?.trim() || '';

    const payload: CrearMedicamento = {
      nombre: this.medicamento.nombre.trim(),
      descripcion: this.medicamento.descripcion ? this.medicamento.descripcion.trim() : '',
      cantidad_ml: Number(this.medicamento.cantidad_ml),
      tipo: this.medicamento.tipo.trim(),
      activo: this.medicamento.activo,
      estado: this.medicamento.activo,
      ...(viaFinal ? { via_administracion: viaFinal } : {})
    };

    if (this.editandoId !== null) {
      this.authService.actualizarMedicamento(this.editandoId, payload).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: '¡Actualizado!',
            text: 'Medicamento actualizado con éxito.',
            confirmButtonColor: '#4141A5',
            timer: 2000
          });
          this.cerrarModal();
          this.obtenerMedicamentos();
        },
        error: (err: any) => {
          console.error('Error al actualizar:', err);
          let msj = 'No se pudo actualizar el medicamento.';
          if (err?.error) {
            if (typeof err.error === 'string') msj = err.error;
            else if (err.error.detail) msj = err.error.detail;
            else if (typeof err.error === 'object') {
              const primerCampo = Object.keys(err.error)[0];
              const valor = err.error[primerCampo];
              msj = `${primerCampo}: ${Array.isArray(valor) ? valor.join(' ') : valor}`;
            }
          }
          Swal.fire({ icon: 'error', title: 'Error', text: msj, confirmButtonColor: '#d33' });
        }
      });
    } else {
      this.authService.crearMedicamento(payload).subscribe({
        next: () => {
          Swal.fire({
            title: '¡Éxito!',
            text: 'Medicamento creado correctamente.',
            icon: 'success',
            confirmButtonColor: '#4141A5',
            timer: 2000
          });
          this.cerrarModal();
          this.obtenerMedicamentos();
          this.medicamento = {
            nombre: '',
            descripcion: '',
            cantidad_ml: null,
            tipo: '',
            via_administracion: 'Oral (Pastilla / Tableta)',
            activo: true
          };
        },
        error: (err: any) => {
          console.error('Error al crear:', err);
          let msj = 'No se pudo crear el medicamento.';
          if (err?.error) {
            if (typeof err.error === 'string') msj = err.error;
            else if (err.error.detail) msj = err.error.detail;
            else if (typeof err.error === 'object') {
              const primerCampo = Object.keys(err.error)[0];
              const valor = err.error[primerCampo];
              msj = `${primerCampo}: ${Array.isArray(valor) ? valor.join(' ') : valor}`;
            }
          }
          Swal.fire({ title: 'Error', text: msj, icon: 'error', confirmButtonColor: '#d33' });
        }
      });
    }
  }

  cambiarEstado(m: any): void {
    const idReal = m.id || m.id_medicamento;
    const estadoActual = m.activo !== undefined ? Boolean(m.activo) : Boolean(m.estado);
    const nuevoEstado = !estadoActual;
    const accion = nuevoEstado ? 'activar' : 'inactivar';

    Swal.fire({
      title: `¿Deseas ${accion} este medicamento?`,
      text: `El medicamento "${m.nombre}" será ${nuevoEstado ? 'activado' : 'inactivado'}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4141A5',
      cancelButtonColor: '#64748b',
      confirmButtonText: `Sí, ${accion}`,
      cancelButtonText: 'Cancelar'
    }).then((resultado) => {
      if (!resultado.isConfirmed) return;

      this.authService.cambiarEstadoMedicamento(idReal, nuevoEstado).subscribe({
        next: () => {
          m.activo = nuevoEstado;
          m.estado = nuevoEstado;
          this.medicamentosOriginales = [...this.medicamentos];
          this.cdr.detectChanges();

          Swal.fire({
            title: `Medicamento ${nuevoEstado ? 'activado' : 'inactivado'} correctamente`,
            icon: 'success',
            timer: 1800,
            showConfirmButton: false
          });
        },
        error: (err: any) => {
          console.error(`Error al ${accion}:`, err);
          const msj = err?.error?.detail || `No se pudo ${accion} el medicamento.`;
          Swal.fire({ title: 'Error', text: msj, icon: 'error', confirmButtonColor: '#4141A5' });
        }
      });
    });
  }

  // ==========================================
  // MÓDULO DE IMPORTACIÓN MASIVA DESDE EXCEL
  // ==========================================

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
        text: 'Por favor selecciona un archivo de Excel válido (.xlsx o .xls).',
        icon: 'warning',
        confirmButtonColor: '#4141A5'
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
            text: 'La primera hoja del archivo no contiene filas con datos.',
            icon: 'info',
            confirmButtonColor: '#4141A5'
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
          confirmButtonColor: '#d33'
        });
      } finally {
        input.value = '';
      }
    };

    reader.onerror = () => {
      Swal.fire({
        title: 'Error de archivo',
        text: 'Ocurrió un error al cargar el archivo seleccionado.',
        icon: 'error',
        confirmButtonColor: '#d33'
      });
      input.value = '';
    };

    reader.readAsArrayBuffer(file);
  }

  async procesarImportacionFilas(filas: any[], nombreArchivo: string): Promise<void> {
    const registrosAProcesar: { payload: CrearMedicamento; tuvoOtros: boolean }[] = [];

    for (const r of filas) {
      const nombreRaw = this.obtenerValorColumna(r, [
        'NOMBRE', 'Nombre', 'nombre', 'MEDICAMENTO', 'Medicamento', 'Producto', 'PRODUCTO', 'Item'
      ]);
      if (!nombreRaw) {
        // Fila sin nombre o encabezado repetido, se descarta
        continue;
      }

      let descRaw = this.obtenerValorColumna(r, [
        'DESCRIPCIÓN', 'DESCRIPCION', 'Descripción', 'Descripcion', 'Detalle', 'Indicaciones'
      ]);
      const tipoRaw = this.obtenerValorColumna(r, [
        'TIPO', 'Tipo', 'tipo', 'Categoría', 'Categoria', 'Forma Farmacéutica', 'Forma Farmaceutica', 'Clase'
      ]);
      const viaRaw = this.obtenerValorColumna(r, [
        'VÍA DE ADMINISTRACIÓN', 'VIA DE ADMINISTRACION', 'Vía de Administración', 'Via de Administracion', 'Vía', 'Via', 'Ruta'
      ]);
      const cantRaw = this.obtenerValorColumna(r, [
        'CANTIDAD', 'Cantidad', 'cantidad', 'Presentación', 'Presentacion', 'Unidad de Medida', 'Stock', 'Contenido'
      ]);

      // Campos complementarios opcionales
      const concentracionRaw = this.obtenerValorColumna(r, [
        'CONCENTRACIÓN', 'CONCENTRACION', 'Concentración', 'Concentracion'
      ]);
      const loteRaw = this.obtenerValorColumna(r, ['LOTE', 'Lote', 'lote']);
      const vencimientoRaw = this.obtenerValorColumna(r, [
        'VENCIMIENTO', 'Vencimiento', 'Fecha Vencimiento', 'Expiración', 'Expiracion'
      ]);

      // Si hay lote, vencimiento o concentración, enriquecer la descripción si no los incluye ya
      const extras: string[] = [];
      if (concentracionRaw && !descRaw.toLowerCase().includes(concentracionRaw.toLowerCase())) {
        extras.push(`Conc: ${concentracionRaw}`);
      }
      if (loteRaw && !descRaw.toLowerCase().includes(loteRaw.toLowerCase())) {
        extras.push(`Lote: ${loteRaw}`);
      }
      if (vencimientoRaw && !descRaw.toLowerCase().includes(vencimientoRaw.toLowerCase())) {
        extras.push(`Vence: ${vencimientoRaw}`);
      }
      if (extras.length > 0) {
        descRaw = descRaw ? `${descRaw} [${extras.join(' | ')}]` : `[${extras.join(' | ')}]`;
      }

      let tuvoOtros = false;

      // 1. REGLA TIPO: Validación estricta contra desplegable de tipos
      let tipoFinal = 'Otros';
      const tipoNorm = this.normalizarTexto(tipoRaw);
      const coincidenciaTipo = this.tiposSugeridos.find(
        t => this.normalizarTexto(t) === tipoNorm
      );
      if (coincidenciaTipo) {
        tipoFinal = coincidenciaTipo === 'Otro' ? 'Otros' : coincidenciaTipo;
      } else {
        tipoFinal = 'Otros';
        tuvoOtros = true;
      }

      // 2. REGLA VÍA DE ADMINISTRACIÓN Y DEPENDENCIAS
      let viaFinal = '';
      let unidadEsperada: 'und' | 'ml' | 'g' = 'und';
      const viaNorm = this.normalizarTexto(viaRaw);
      const cantNorm = this.normalizarTexto(cantRaw);
      const descNorm = this.normalizarTexto(descRaw);

      // Verificación directa en el catálogo de vías
      const coincidenciaVia = this.viasAdministracion.find(
        v => this.normalizarTexto(v.valor) === viaNorm
      );

      if (coincidenciaVia && coincidenciaVia.valor !== 'Otros') {
        viaFinal = coincidenciaVia.valor;
        unidadEsperada = coincidenciaVia.unidad;
      } else if (viaNorm.includes('oral')) {
        // Regla Vía Oral: dependencias según forma física
        const esPastilla =
          cantNorm.includes('tableta') ||
          cantNorm.includes('pastilla') ||
          cantNorm.includes('capsula') ||
          cantNorm.includes('comprimido') ||
          cantNorm.includes('blist') ||
          descNorm.includes('tableta') ||
          descNorm.includes('capsula') ||
          descNorm.includes('pastilla');

        const esLiquido =
          cantNorm.includes('jarabe') ||
          cantNorm.includes('suspension') ||
          cantNorm.includes('gotas') ||
          cantNorm.includes('ml') ||
          cantNorm.includes('mililitro') ||
          descNorm.includes('jarabe') ||
          descNorm.includes('suspension');

        if (esPastilla) {
          viaFinal = 'Oral (Pastilla / Tableta)';
          unidadEsperada = 'und';
        } else if (esLiquido) {
          viaFinal = 'Oral (Jarabe / Suspensión)';
          unidadEsperada = 'ml';
        } else {
          viaFinal = 'Otros';
          unidadEsperada = 'und';
          tuvoOtros = true;
        }
      } else if (viaNorm.includes('subcutanea') && !viaNorm.includes('intravenosa') && !viaNorm.includes('intramuscular')) {
        // Regla Vía Subcutánea: unidad ml automática
        viaFinal = 'Subcutánea (SC)';
        unidadEsperada = 'ml';
      } else if (viaNorm.includes('intramuscular') && !viaNorm.includes('subcutanea') && !viaNorm.includes('intravenosa')) {
        viaFinal = 'Intramuscular (IM)';
        unidadEsperada = 'ml';
      } else if (viaNorm.includes('intravenosa') && !viaNorm.includes('subcutanea') && !viaNorm.includes('intramuscular')) {
        viaFinal = 'Intravenosa (IV)';
        unidadEsperada = 'ml';
      } else if (viaNorm.includes('topica')) {
        if (viaNorm.includes('crema') || viaNorm.includes('pomada') || cantNorm.includes('crema') || cantNorm.includes('pomada')) {
          viaFinal = 'Tópica (Crema / Pomada)';
          unidadEsperada = 'g';
        } else if (viaNorm.includes('pipeta') || viaNorm.includes('spot')) {
          viaFinal = 'Tópica (Pipeta / Spot-on)';
          unidadEsperada = 'und';
        } else {
          viaFinal = 'Tópica (Spray / Solución)';
          unidadEsperada = 'ml';
        }
      } else {
        viaFinal = 'Otros';
        unidadEsperada = 'und';
        tuvoOtros = true;
      }

      // 3. EXTRACCIÓN Y REGLA DE CANTIDAD / UNIDAD DE MEDIDA
      let cantidadNum = 1;
      const matchNum = cantRaw.match(/(\d+(?:[.,]\d+)?)/);
      if (matchNum) {
        cantidadNum = parseFloat(matchNum[1].replace(',', '.'));
        // Conversión si viene en litros y la unidad requerida es ml
        if (cantNorm.includes('litro') && !cantNorm.includes('mili')) {
          cantidadNum = cantidadNum * 1000;
        }
      } else {
        cantidadNum = 1;
      }

      if (isNaN(cantidadNum) || cantidadNum <= 0) {
        cantidadNum = 1;
      }

      // 4. REGLA DE CONSISTENCIA FINAL
      // En caso de que la combinación entre vía, tipo o unidad sea discordante, asignar "Otros"
      if (unidadEsperada === 'ml' && (cantNorm.includes('gramo') || cantNorm.includes('tableta') || cantNorm.includes('pastilla') || cantNorm.includes('capsula') || cantNorm.includes('unidad'))) {
        viaFinal = 'Otros';
        unidadEsperada = 'und';
        tuvoOtros = true;
      } else if (unidadEsperada === 'und' && viaFinal !== 'Otros' && (cantNorm.includes(' ml') || cantNorm.includes('mililitro') || cantNorm.includes('litro'))) {
        viaFinal = 'Otros';
        unidadEsperada = 'und';
        tuvoOtros = true;
      } else if (unidadEsperada === 'g' && (cantNorm.includes(' ml') || cantNorm.includes('litro') || cantNorm.includes('tableta'))) {
        viaFinal = 'Otros';
        unidadEsperada = 'und';
        tuvoOtros = true;
      }

      const payload: CrearMedicamento = {
        nombre: nombreRaw,
        descripcion: descRaw,
        cantidad_ml: cantidadNum,
        tipo: tipoFinal,
        via_administracion: viaFinal,
        activo: true,
        estado: true
      };

      registrosAProcesar.push({ payload, tuvoOtros });
    }

    if (registrosAProcesar.length === 0) {
      Swal.fire({
        title: 'Sin registros válidos',
        text: 'No se encontraron registros de medicamentos con nombre válido para importar.',
        icon: 'warning',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    // Modal de confirmación previo
    const confirmacion = await Swal.fire({
      title: '¿Iniciar importación masiva?',
      html: `
        <div class="text-left text-sm space-y-2">
          <p>Archivo: <b class="text-[#4141A5]">${nombreArchivo}</b></p>
          <p>Total de medicamentos identificados: <b>${registrosAProcesar.length}</b></p>
          <p class="text-xs text-gray-500 mt-2">Los medicamentos que no coincidan exactamente con el catálogo se clasificarán automáticamente como <b>"Otros"</b>.</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4141A5',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, importar ahora',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    this.importandoExcel = true;
    this.cdr.detectChanges();

    // Diálogo de progreso interactivo
    Swal.fire({
      title: 'Importando medicamentos...',
      html: `Procesando <b>0</b> de <b>${registrosAProcesar.length}</b> medicamentos...`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    let exitosos = 0;
    let conOtros = 0;
    let fallidos = 0;
    const TAMANO_LOTE = 5;

    try {
      for (let i = 0; i < registrosAProcesar.length; i += TAMANO_LOTE) {
        const lote = registrosAProcesar.slice(i, i + TAMANO_LOTE);

        await Promise.all(
          lote.map(async item => {
            try {
              await firstValueFrom(this.authService.crearMedicamento(item.payload));
              exitosos++;
              if (item.tuvoOtros) {
                conOtros++;
              }
            } catch (err) {
              console.error(`Error guardando medicamento "${item.payload.nombre}":`, err);
              fallidos++;
            }
          })
        );

        const procesadosHastaAhora = Math.min(i + TAMANO_LOTE, registrosAProcesar.length);
        const porcentaje = Math.round((procesadosHastaAhora / registrosAProcesar.length) * 100);

        Swal.update({
          html: `
            <div class="space-y-2">
              <p>Guardando medicamentos: <b>${procesadosHastaAhora}</b> de <b>${registrosAProcesar.length}</b> (${porcentaje}%)</p>
              <div class="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div class="bg-[#4141A5] h-2.5 rounded-full transition-all duration-200" style="width: ${porcentaje}%"></div>
              </div>
            </div>
          `
        });
      }

      this.importandoExcel = false;
      this.obtenerMedicamentos();
      this.cdr.detectChanges();

      // Alerta final de resumen SweetAlert2
      Swal.fire({
        icon: fallidos === 0 ? 'success' : 'warning',
        title: fallidos === 0 ? '¡Importación Completada!' : 'Importación Finalizada con Novedades',
        html: `
          <div class="text-left text-sm space-y-2.5 py-1">
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <div class="flex justify-between items-center text-slate-700">
                <span>Total de filas leídas:</span>
                <b>${registrosAProcesar.length}</b>
              </div>
              <div class="flex justify-between items-center text-[#4141A5] font-semibold">
                <span>Guardados con éxito:</span>
                <b>${exitosos}</b>
              </div>
              <div class="flex justify-between items-center text-amber-700 font-semibold">
                <span>Asignados con campos en "Otros":</span>
                <b>${conOtros}</b>
              </div>
              ${fallidos > 0 ? `
              <div class="flex justify-between items-center text-rose-600 font-semibold">
                <span>No se pudieron registrar:</span>
                <b>${fallidos}</b>
              </div>` : ''}
            </div>
            <p class="text-xs text-gray-500">
              ${conOtros > 0 ? 'Los medicamentos con discrepancias de catálogo fueron asignados a "Otros" para mantener la consistencia de inventario.' : 'Todos los medicamentos coincidieron exactamente con el catálogo.'}
            </p>
          </div>
        `,
        confirmButtonColor: '#4141A5',
        confirmButtonText: 'Entendido'
      });
    } catch (error) {
      console.error('Error general durante la importación:', error);
      this.importandoExcel = false;
      this.obtenerMedicamentos();
      this.cdr.detectChanges();

      Swal.fire({
        title: 'Error en la importación',
        text: 'Ocurrió un error inesperado al procesar la importación masiva.',
        icon: 'error',
        confirmButtonColor: '#d33'
      });
    }
  }
}
