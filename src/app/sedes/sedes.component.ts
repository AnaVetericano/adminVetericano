import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { SedesService, Sede } from '../services/sedes.service';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-sedes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sedes.component.html',
  styleUrl: './sedes.component.css'
})
export class SedesComponent implements OnInit {
  // Lista de sedes
  sedes: Sede[] = [];
  sedesFiltradas: Sede[] = [];
  cargando: boolean = true;
  guardando: boolean = false;
  sedesEnTransicion: Set<number> = new Set<number>();

  // Filtros y Búsqueda
  filtroTexto: string = '';
  filtroEstado: 'todos' | 'activos' | 'inactivos' = 'todos';
  menuFiltroAbierto: boolean = false;

  // Modal Crear Sede
  modalCrearAbierto: boolean = false;
  nuevaSede = {
    nombre: '',
    direccion: '',
    ciudad: '',
    telefono: '',
    codigo: '',
    activo: true // Estado por defecto OBLIGATORIO: Activo
  };

  // Errores de validación en formulario
  erroresForm: { [key: string]: string } = {};

  constructor(
    private sedesService: SedesService,
    public authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarSedes();
  }

  cargarSedes(): void {
    this.cargando = true;
    this.sedesService.listarSedes().subscribe({
      next: (data) => {
        this.sedes = data || [];
        this.aplicarFiltros();
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar sedes:', err);
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  aplicarFiltros(): void {
    const texto = (this.filtroTexto || '').toLowerCase().trim();

    this.sedesFiltradas = this.sedes.filter((s) => {
      // Filtro por estado
      if (this.filtroEstado === 'activos' && !s.activo) return false;
      if (this.filtroEstado === 'inactivos' && s.activo) return false;

      // Filtro por texto
      if (!texto) return true;
      const nom = (s.nombre || '').toLowerCase();
      const dir = (s.direccion || '').toLowerCase();
      const ciu = (s.ciudad || '').toLowerCase();
      const tel = (s.telefono || '').toLowerCase();
      const cod = (s.codigo || '').toLowerCase();

      return nom.includes(texto) || dir.includes(texto) || ciu.includes(texto) || tel.includes(texto) || cod.includes(texto);
    });
  }

  setFiltroEstado(estado: 'todos' | 'activos' | 'inactivos'): void {
    this.filtroEstado = estado;
    this.menuFiltroAbierto = false;
    this.aplicarFiltros();
  }

  toggleMenuFiltro(): void {
    this.menuFiltroAbierto = !this.menuFiltroAbierto;
  }

  // --- Métricas Resumen ---
  get totalSedes(): number {
    return this.sedes.length;
  }

  get sedesActivas(): number {
    return this.sedes.filter((s) => s.activo).length;
  }

  get sedesInactivas(): number {
    return this.sedes.filter((s) => !s.activo).length;
  }

  get totalCiudades(): number {
    const ciudades = new Set(this.sedes.map((s) => (s.ciudad || '').trim().toLowerCase()).filter(Boolean));
    return ciudades.size;
  }

  // --- Modal Crear Sede ---
  abrirModalCrear(): void {
    this.nuevaSede = {
      nombre: '',
      direccion: '',
      ciudad: '',
      telefono: '',
      codigo: '',
      activo: true // Por defecto: Activo
    };
    this.erroresForm = {};
    this.guardando = false;
    this.modalCrearAbierto = true;
  }

  cerrarModalCrear(): void {
    this.modalCrearAbierto = false;
    this.erroresForm = {};
    this.guardando = false;
  }

  validarFormulario(): boolean {
    this.erroresForm = {};
    let valido = true;

    const nombre = (this.nuevaSede.nombre || '').trim();
    const direccion = (this.nuevaSede.direccion || '').trim();
    const ciudad = (this.nuevaSede.ciudad || '').trim();
    const telefono = (this.nuevaSede.telefono || '').trim();

    if (!nombre) {
      this.erroresForm['nombre'] = 'El nombre de la sede es obligatorio.';
      valido = false;
    } else if (this.sedesService.validarNombreDuplicado(nombre)) {
      this.erroresForm['nombre'] = `Ya existe una sede registrada con el nombre "${nombre}".`;
      valido = false;
    }

    if (!direccion) {
      this.erroresForm['direccion'] = 'La dirección es obligatoria.';
      valido = false;
    }

    if (!ciudad) {
      this.erroresForm['ciudad'] = 'La ciudad o municipio es obligatorio.';
      valido = false;
    }

    if (!telefono) {
      this.erroresForm['telefono'] = 'El teléfono de contacto es obligatorio.';
      valido = false;
    }

    return valido;
  }

  guardarSede(): void {
    if (!this.validarFormulario()) {
      Swal.fire({
        title: 'Campos Incompletos',
        text: 'Por favor completa todos los campos obligatorios y asegúrate de no repetir el nombre de una sede.',
        icon: 'warning',
        confirmButtonColor: '#4141A5',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    this.guardando = true;

    const payload: Omit<Sede, 'id_sede'> = {
      nombre: this.nuevaSede.nombre.trim(),
      direccion: this.nuevaSede.direccion.trim(),
      ciudad: this.nuevaSede.ciudad.trim(),
      telefono: this.nuevaSede.telefono.trim(),
      codigo: this.nuevaSede.codigo ? this.nuevaSede.codigo.trim().toUpperCase() : undefined,
      activo: true
    };

    this.sedesService.crearSede(payload).subscribe({
      next: (sedeCreada) => {
        this.guardando = false;
        this.cerrarModalCrear();

        Swal.fire({
          title: '¡Sede Creada Exitosamente!',
          html: `
            <div class="text-left text-sm space-y-2">
              <p>La sede <b>${sedeCreada.nombre}</b> ha sido registrada con estado <span class="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Activo</span>.</p>
              <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                <p><b>Código:</b> ${sedeCreada.codigo || 'N/A'}</p>
                <p><b>Ciudad:</b> ${sedeCreada.ciudad}</p>
                <p><b>Dirección:</b> ${sedeCreada.direccion}</p>
              </div>
            </div>
          `,
          icon: 'success',
          confirmButtonColor: '#4141A5',
          confirmButtonText: 'Aceptar',
          timer: 2600
        });

        this.cargarSedes();
      },
      error: (err) => {
        this.guardando = false;
        const msj = err?.message || 'No se pudo registrar la sede.';
        Swal.fire({
          title: 'Error al Crear Sede',
          text: msj,
          icon: 'error',
          confirmButtonColor: '#d33',
          confirmButtonText: 'Cerrar'
        });
      }
    });
  }

  // --- Funcionalidad Activar / Inactivar Sede con Advertencia de Impacto ---
  toggleEstadoSede(sede: Sede): void {
    if (this.sedesEnTransicion.has(sede.id_sede)) {
      return; // Prevenir clics repetidos mientras se procesa la petición HTTP
    }

    if (sede.activo) {
      // INACTIVACIÓN: Alerta de confirmación advirtiendo el impacto en los usuarios asociados
      Swal.fire({
        title: `¿Inactivar la sede "${sede.nombre}"?`,
        html: `
          <div class="text-left text-sm space-y-3 font-sans">
            <div class="p-3.5 bg-amber-50 border-l-4 border-[#F1C63C] rounded-r-2xl">
              <p class="font-extrabold text-[#170B3D] flex items-center gap-1.5">
                <span>⚠️ Advertencia de impacto a usuarios:</span>
              </p>
              <p class="text-xs text-amber-900 mt-1 font-medium leading-relaxed">
                Al inactivar esta sede, los <b>${sede.total_usuarios || 0} usuarios y veterinarios</b> vinculados a esta ubicación no podrán registrar nuevas atenciones, salidas de maletines ni movimientos clínicos hasta que la sede sea nuevamente reactivada.
              </p>
            </div>
            <p class="text-xs text-slate-500">
              ¿Confirmas que deseas suspender las operaciones de esta sede?
            </p>
          </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, Inactivar Sede',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#64748b',
        reverseButtons: true,
        customClass: {
          popup: 'rounded-3xl shadow-2xl border border-slate-200',
          confirmButton: 'rounded-xl px-5 py-2.5 font-bold',
          cancelButton: 'rounded-xl px-5 py-2.5 font-bold'
        }
      }).then((result) => {
        if (result.isConfirmed) {
          this.ejecutarCambioEstado(sede, false);
        }
      });
    } else {
      // ACTIVACIÓN: Confirmar y reactivar operaciones
      Swal.fire({
        title: `¿Activar la sede "${sede.nombre}"?`,
        text: 'La sede volverá a estar disponible para asignaciones de personal, historias clínicas y operaciones de inventario.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, Activar Sede',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#4141A5',
        cancelButtonColor: '#64748b',
        reverseButtons: true,
        customClass: {
          popup: 'rounded-3xl shadow-2xl border border-slate-200',
          confirmButton: 'rounded-xl px-5 py-2.5 font-bold',
          cancelButton: 'rounded-xl px-5 py-2.5 font-bold'
        }
      }).then((result) => {
        if (result.isConfirmed) {
          this.ejecutarCambioEstado(sede, true);
        }
      });
    }
  }

  private ejecutarCambioEstado(sede: Sede, nuevoEstado: boolean): void {
    this.sedesEnTransicion.add(sede.id_sede);
    this.cdr.detectChanges();

    this.sedesService.cambiarEstadoSede(sede.id_sede, nuevoEstado).subscribe({
      next: (actualizada) => {
        sede.activo = nuevoEstado;
        sede.is_active = nuevoEstado;
        this.sedesEnTransicion.delete(sede.id_sede);
        this.aplicarFiltros();
        this.cdr.detectChanges();

        const Toast = Swal.mixin({
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true
        });

        Toast.fire({
          icon: nuevoEstado ? 'success' : 'info',
          title: `Sede "${sede.nombre}" ${nuevoEstado ? 'activada' : 'inactivada'} correctamente.`
        });
      },
      error: (err) => {
        this.sedesEnTransicion.delete(sede.id_sede);
        this.cdr.detectChanges();

        const msj = err?.error?.detail || err?.error?.message || err?.message || 'No se pudo actualizar el estado de la sede en el servidor.';
        Swal.fire({
          title: 'Error al cambiar estado',
          text: msj,
          icon: 'error',
          confirmButtonColor: '#d33',
          confirmButtonText: 'Cerrar'
        });
      }
    });
  }
}
