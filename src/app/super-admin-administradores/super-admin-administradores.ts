import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import {
  SuperAdminService,
  AdministradorUsuario,
  CrearAdministradorPayload,
  ActualizarAdministradorPayload
} from '../services/super-admin.service';
import { SedesService, Sede } from '../services/sedes.service';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-super-admin-administradores',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './super-admin-administradores.html',
  styleUrl: './super-admin-administradores.css'
})
export class SuperAdminAdministradoresComponent implements OnInit {
  administradores: AdministradorUsuario[] = [];
  administradoresFiltrados: AdministradorUsuario[] = [];
  sedes: Sede[] = [];

  cargando = false;
  guardando = false;
  usuariosEnTransicion = new Set<number>();

  // Filtros
  filtroTexto = '';
  filtroEstado: 'todos' | 'activos' | 'inactivos' = 'todos';
  filtroSedeId: string = 'todas';

  // Modal Crear / Editar
  modalAbierto = false;
  modoEdicion = false;
  idAdministradorEditando: number | null = null;

  formulario: {
    nombre: string;
    apellido: string;
    identificacion: string;
    email: string;
    telefono: string;
    id_sede: number | null;
    password: string;
    activo: boolean;
  } = this.obtenerFormularioInicial();

  erroresFormulario: Record<string, string> = {};
  errorBackendGeneral = '';

  constructor(
    private superAdminService: SuperAdminService,
    private sedesService: SedesService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarSedes();
    this.cargarAdministradores();
  }

  private obtenerFormularioInicial() {
    return {
      nombre: '',
      apellido: '',
      identificacion: '',
      email: '',
      telefono: '',
      id_sede: null as number | null,
      password: '',
      activo: true
    };
  }

  cargarSedes(): void {
    this.sedesService.listarSedes().subscribe({
      next: (lista) => {
        this.sedes = lista || [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar sedes para selector de administradores:', err);
      }
    });
  }

  cargarAdministradores(): void {
    this.cargando = true;
    this.superAdminService.listarAdministradores().subscribe({
      next: (lista) => {
        this.administradores = lista || [];
        this.aplicarFiltros();
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al listar administradores:', err);
        this.cargando = false;
        this.cdr.detectChanges();
        Swal.fire({
          icon: 'error',
          title: 'Error de conexión',
          text:
            err?.error?.detail ||
            'No fue posible obtener el listado de administradores desde el servidor.',
          confirmButtonColor: '#4141A5'
        });
      }
    });
  }

  get totalAdministradores(): number {
    return this.administradores.length;
  }

  get totalActivos(): number {
    return this.administradores.filter((a) => a.activo).length;
  }

  get totalInactivos(): number {
    return this.administradores.filter((a) => !a.activo).length;
  }

  get totalConSede(): number {
    return this.administradores.filter((a) => a.id_sede !== null && a.id_sede !== undefined).length;
  }

  get sedesActivas(): Sede[] {
    return this.sedes.filter((s) => s.activo);
  }

  aplicarFiltros(): void {
    const busqueda = (this.filtroTexto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    this.administradoresFiltrados = this.administradores.filter((admin) => {
      if (this.filtroEstado === 'activos' && !admin.activo) return false;
      if (this.filtroEstado === 'inactivos' && admin.activo) return false;

      if (this.filtroSedeId !== 'todas') {
        if (this.filtroSedeId === 'sin_sede') {
          if (admin.id_sede !== null && admin.id_sede !== undefined) return false;
        } else {
          if (Number(admin.id_sede) !== Number(this.filtroSedeId)) return false;
        }
      }

      if (!busqueda) return true;

      const campos = [
        admin.nombre,
        admin.apellido,
        `${admin.nombre || ''} ${admin.apellido || ''}`,
        admin.email,
        admin.identificacion,
        admin.telefono,
        admin.nombre_sede
      ]
        .map((c) =>
          (c || '')
            .toString()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
        )
        .join(' ');

      return campos.includes(busqueda);
    });
  }

  limpiarFiltros(): void {
    this.filtroTexto = '';
    this.filtroEstado = 'todos';
    this.filtroSedeId = 'todas';
    this.aplicarFiltros();
  }

  abrirModalCrear(): void {
    this.modoEdicion = false;
    this.idAdministradorEditando = null;
    this.formulario = this.obtenerFormularioInicial();
    this.erroresFormulario = {};
    this.errorBackendGeneral = '';
    this.modalAbierto = true;
  }

  abrirModalEditar(admin: AdministradorUsuario): void {
    this.modoEdicion = true;
    this.idAdministradorEditando = admin.id_usuario;
    this.formulario = {
      nombre: admin.nombre || '',
      apellido: admin.apellido || '',
      identificacion: admin.identificacion || '',
      email: admin.email || '',
      telefono: admin.telefono || '',
      id_sede: admin.id_sede ?? null,
      password: '',
      activo: admin.activo
    };
    this.erroresFormulario = {};
    this.errorBackendGeneral = '';
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    if (this.guardando) return;
    this.modalAbierto = false;
    this.erroresFormulario = {};
    this.errorBackendGeneral = '';
  }

  validarFormulario(): boolean {
    const errores: Record<string, string> = {};
    const nombre = (this.formulario.nombre || '').trim();
    const email = (this.formulario.email || '').trim();

    if (!nombre || nombre.length < 2) {
      errores['nombre'] = 'El nombre es obligatorio (mínimo 2 caracteres).';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      errores['email'] = 'El correo electrónico institucional es obligatorio.';
    } else if (!emailRegex.test(email)) {
      errores['email'] = 'Ingresa un formato de correo electrónico válido.';
    }

    if (this.formulario.password && this.formulario.password.trim().length > 0 && this.formulario.password.trim().length < 6) {
      errores['password'] = 'La contraseña debe tener al menos 6 caracteres.';
    }

    if (this.formulario.id_sede !== null && this.formulario.id_sede !== undefined) {
      const sedeSeleccionada = this.sedes.find(
        (s) => Number(s.id_sede) === Number(this.formulario.id_sede)
      );
      if (!sedeSeleccionada || !sedeSeleccionada.activo) {
        errores['id_sede'] = 'Solo se permite asociar administradores a sedes activas.';
      }
    }

    this.erroresFormulario = errores;
    return Object.keys(errores).length === 0;
  }

  guardarAdministrador(): void {
    this.errorBackendGeneral = '';
    if (!this.validarFormulario()) return;

    this.guardando = true;

    if (!this.modoEdicion) {
      const payload: CrearAdministradorPayload = {
        nombre: this.formulario.nombre.trim(),
        apellido: this.formulario.apellido.trim() || null,
        identificacion: this.formulario.identificacion.trim() || null,
        email: this.formulario.email.trim().toLowerCase(),
        telefono: this.formulario.telefono.trim() || null,
        id_sede: this.formulario.id_sede !== null ? Number(this.formulario.id_sede) : null,
        activo: this.formulario.activo
      };
      if (this.formulario.password && this.formulario.password.trim()) {
        payload.password = this.formulario.password.trim();
      }

      this.superAdminService.crearAdministrador(payload).subscribe({
        next: (creado) => {
          this.guardando = false;
          this.modalAbierto = false;
          this.cargarAdministradores();
          this.cargarSedes();
          Swal.fire({
            icon: 'success',
            title: 'Administrador registrado',
            text: `La cuenta de ${creado.nombre} ${creado.apellido || ''} ha sido creada con rol Administrador.`,
            confirmButtonColor: '#4141A5'
          });
        },
        error: (err) => {
          this.guardando = false;
          this.procesarErrorBackend(err);
          this.cdr.detectChanges();
        }
      });
    } else if (this.idAdministradorEditando !== null) {
      const payload: ActualizarAdministradorPayload = {
        nombre: this.formulario.nombre.trim(),
        apellido: this.formulario.apellido.trim() || null,
        identificacion: this.formulario.identificacion.trim() || null,
        email: this.formulario.email.trim().toLowerCase(),
        telefono: this.formulario.telefono.trim() || null,
        id_sede: this.formulario.id_sede !== null ? Number(this.formulario.id_sede) : null,
        activo: this.formulario.activo
      };
      if (this.formulario.password && this.formulario.password.trim()) {
        payload.password = this.formulario.password.trim();
      }

      this.superAdminService
        .actualizarAdministrador(this.idAdministradorEditando, payload)
        .subscribe({
          next: (actualizado) => {
            this.guardando = false;
            this.modalAbierto = false;
            this.cargarAdministradores();
            this.cargarSedes();
            Swal.fire({
              icon: 'success',
              title: 'Administrador actualizado',
              text: `Los datos de ${actualizado.nombre} ${actualizado.apellido || ''} fueron actualizados.`,
              confirmButtonColor: '#4141A5'
            });
          },
          error: (err) => {
            this.guardando = false;
            this.procesarErrorBackend(err);
            this.cdr.detectChanges();
          }
        });
    }
  }

  toggleEstadoAdministrador(admin: AdministradorUsuario): void {
    if (this.usuariosEnTransicion.has(admin.id_usuario)) return;

    const nuevoEstado = !admin.activo;
    const usuarioSesion = this.authService.currentUser();

    // Regla 1: Protección Anti Auto-Bloqueo
    if (!nuevoEstado && usuarioSesion?.id_usuario && Number(usuarioSesion.id_usuario) === Number(admin.id_usuario)) {
      Swal.fire({
        icon: 'error',
        title: 'Auto-bloqueo prevenido',
        text: 'Por seguridad del sistema, no puedes desactivar tu propia cuenta mientras tu sesión esté activa.',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    // Regla 2: Protección de Quórum Mínimo (último Administrador activo)
    if (!nuevoEstado && admin.activo && this.totalActivos <= 1) {
      Swal.fire({
        icon: 'error',
        title: 'Quórum mínimo de Administradores',
        text: 'Operación denegada: Este usuario es el único Administrador activo del sistema. No se permite desactivar al último Administrador activo.',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    const accionTexto = nuevoEstado ? 'activar' : 'desactivar';

    Swal.fire({
      title: `¿Deseas ${accionTexto} a este Administrador?`,
      html: `El usuario <b>${admin.nombre} ${admin.apellido || ''}</b> (${admin.email}) pasará a estado <b>${nuevoEstado ? 'ACTIVO' : 'INACTIVO'}</b>.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: nuevoEstado ? '#10B981' : '#E11D48',
      cancelButtonColor: '#64748B',
      confirmButtonText: nuevoEstado ? 'Sí, activar' : 'Sí, desactivar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.usuariosEnTransicion.add(admin.id_usuario);
      this.cdr.detectChanges();

      this.superAdminService
        .cambiarEstadoAdministrador(admin.id_usuario, nuevoEstado)
        .subscribe({
          next: (actualizado) => {
            this.usuariosEnTransicion.delete(admin.id_usuario);
            const idx = this.administradores.findIndex(
              (a) => a.id_usuario === admin.id_usuario
            );
            if (idx !== -1) {
              this.administradores[idx] = actualizado;
            }
            this.aplicarFiltros();
            this.cdr.detectChanges();

            Swal.fire({
              icon: 'success',
              title: nuevoEstado ? 'Administrador Activado' : 'Administrador Inactivado',
              text: `El estado de ${actualizado.nombre} ${actualizado.apellido || ''} se actualizó en el servidor.`,
              timer: 2000,
              showConfirmButton: false
            });
          },
          error: (err) => {
            this.usuariosEnTransicion.delete(admin.id_usuario);
            this.cdr.detectChanges();
            const msg = this.extraerMensajeError(err);
            Swal.fire({
              icon: 'error',
              title: 'Operación rechazada por seguridad',
              text: msg,
              confirmButtonColor: '#4141A5'
            });
          }
        });
    });
  }

  private procesarErrorBackend(err: any): void {
    const body = err?.error;
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const nuevosErrores: Record<string, string> = {};
      for (const [key, val] of Object.entries(body)) {
        const texto = Array.isArray(val) ? val.join(' ') : String(val);
        if (['nombre', 'apellido', 'identificacion', 'email', 'telefono', 'id_sede', 'password'].includes(key)) {
          nuevosErrores[key] = texto;
        } else {
          this.errorBackendGeneral = texto;
        }
      }
      this.erroresFormulario = { ...this.erroresFormulario, ...nuevosErrores };
      if (!this.errorBackendGeneral && Object.keys(nuevosErrores).length === 0) {
        this.errorBackendGeneral = this.extraerMensajeError(err);
      }
    } else {
      this.errorBackendGeneral = this.extraerMensajeError(err);
    }
  }

  private extraerMensajeError(err: any): string {
    const status = err?.status;
    if (status === 401) {
      return 'Tu sesión ha expirado o no estás autenticado (HTTP 401). Por favor inicia sesión nuevamente.';
    }
    if (status === 403) {
      return err?.error?.detail || 'No cuentas con permisos de Super Administrador para realizar esta acción (HTTP 403).';
    }
    if (status === 404) {
      return err?.error?.detail || 'El administrador o recurso solicitado no existe en el servidor (HTTP 404).';
    }
    if (status >= 500) {
      return 'Error interno del servidor (HTTP 500). Por favor intenta de nuevo más tarde.';
    }
    const body = err?.error;
    if (!body) return 'Ocurrió un error al comunicarse con el servidor.';
    if (typeof body === 'string') return body;
    if (body.detail) return String(body.detail);
    if (body.error) return String(body.error);
    if (body.activo) {
      return Array.isArray(body.activo) ? body.activo.join(' ') : String(body.activo);
    }
    const primerValor = Object.values(body)[0];
    if (Array.isArray(primerValor)) return primerValor.join(' ');
    if (typeof primerValor === 'string') return primerValor;
    return 'No se pudo completar la operación solicitada.';
  }
}

