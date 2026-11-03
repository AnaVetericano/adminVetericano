import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
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
    'Otro'
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
        const lista = Array.isArray(data) ? data : (data.results || []);
        this.medicamentos = lista;
        this.medicamentosOriginales = lista;
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
      this.medicamentos = this.medicamentosOriginales.filter(m => m.activo === estado);
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

    this.medicamento = {
      nombre: m?.nombre || '',
      descripcion: m?.descripcion || '',
      cantidad_ml: cantRaw !== null && !isNaN(cantRaw) ? cantRaw : null,
      tipo: m?.tipo || '',
      via_administracion: this.normalizarViaParaSelector(m?.via_administracion || m?.via || '', m?.tipo || ''),
      activo: m?.activo !== undefined ? m.activo : true
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
    const nuevoEstado = !m.activo;
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
}
