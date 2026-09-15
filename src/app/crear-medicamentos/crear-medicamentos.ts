import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../services/auth';

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

  editandoId: number | null = null; // Controla si estamos editando o creando

  medicamento = {
    nombre: '',
    descripcion: '',
    cantidad_ml: null as number | null,
    tipo: '',
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
      m.nombre?.toLowerCase().includes(termino) ||
      m.descripcion?.toLowerCase().includes(termino) ||
      m.tipo?.toLowerCase().includes(termino)
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
    this.medicamento = { nombre: '', descripcion: '', cantidad_ml: null, tipo: '', activo: true };
    this.modalAbierto = true;
  }

  abrirModalEditar(m: any): void {
    this.editandoId = m.id || m.id_medicamento || null;
    this.medicamento = {
      nombre: m.nombre || '',
      descripcion: m.descripcion || '',
      cantidad_ml: m.cantidad_ml ?? null,
      tipo: m.tipo || '',
      activo: m.activo !== undefined ? m.activo : true
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

    if (this.medicamento.cantidad_ml === null || this.medicamento.cantidad_ml === undefined) {
      Swal.fire({
        title: 'Campo obligatorio',
        text: 'Debes ingresar la cantidad en ml.',
        icon: 'warning',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    const payload = {
      nombre: this.medicamento.nombre.trim(),
      descripcion: this.medicamento.descripcion ? this.medicamento.descripcion.trim() : '',
      cantidad_ml: Number(this.medicamento.cantidad_ml),
      tipo: this.medicamento.tipo.trim(),
      activo: this.medicamento.activo
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
          this.medicamento = { nombre: '', descripcion: '', cantidad_ml: null, tipo: '', activo: true };
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
      confirmButtonColor: nuevoEstado ? '#16a34a' : '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: `Sí, ${accion}`,
      cancelButtonText: 'Cancelar'
    }).then((resultado) => {
      if (!resultado.isConfirmed) return;

      this.authService.cambiarEstadoMedicamento(idReal, nuevoEstado).subscribe({
        next: () => {
          m.activo = nuevoEstado;
          this.cdr.detectChanges();
          Swal.fire({
            title: `Medicamento ${nuevoEstado ? 'activado' : 'inactivado'} correctamente`,
            icon: 'success',
            timer: 1800,
            showConfirmButton: false
          });
          this.obtenerMedicamentos();
        },
        error: (err: any) => {
          console.error(`Error al ${accion}:`, err);
          const msj = err?.error?.detail || `No se pudo ${accion} el medicamento.`;
          Swal.fire({ title: 'Error', text: msj, icon: 'error' });
        }
      });
    });
  }
}