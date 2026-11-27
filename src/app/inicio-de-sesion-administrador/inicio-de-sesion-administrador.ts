import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-inicio-de-sesion-administrador', 
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './inicio-de-sesion-administrador.html', 
  styleUrl: './inicio-de-sesion-administrador.css'    
})
export class InicioDeSesionAdministradorComponent { 

  usuario = {
    email: '',
    password: ''
  };

  // Variables independientes para el flujo de recuperación
  mostrarRecuperacion: boolean = false;
  emailRecuperacion: string = '';
  codigoIngresado: string = '';
  nuevaPassword: string = '';

  // Control de visibilidad de contraseñas
  mostrarPasswordLogin: boolean = false;
  mostrarNuevaPassword: boolean = false;
  
  cargandoLogin: boolean = false;
  cargandoPaso1: boolean = false;
  cargandoPaso2: boolean = false;
  
  mensajeExito: string = '';
  mensajeError: string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  volverAlInicio(): void {
    this.router.navigate(['/']);
  }

  login() {
    if (this.cargandoLogin) {
      return;
    }

    // Validación corregida a 'email'
    if (this.usuario.email === '' || this.usuario.password === '') {
      Swal.fire({
        title: 'Campos obligatorios incompletos',
        text: 'Ingrese su correo electrónico y contraseña para continuar.',
        icon: 'info',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    this.cargandoLogin = true;

    // Limpiar tokens y sesión anterior antes de intentar loguearse
    this.authService.logout();

    // Petición a la API usando AuthService
    this.authService.login(this.usuario).subscribe({
      next: () => {
        this.cargandoLogin = false;
        // Redirección inteligente según el rol del usuario autenticado
        if (this.authService.isSuperAdmin()) {
          this.router.navigate(['/inicio-admin/super-dashboard']);
        } else if (this.authService.isJuridico()) {
          this.router.navigate(['/inicio-admin/dashboard-juridico']);
        } else if (this.authService.isVeterinario()) {
          this.router.navigate(['/inicio-admin/dashboard-veterinario']);
        } else if (this.authService.isAdmin()) {
          this.router.navigate(['/inicio-admin/graficas']);
        } else {
          this.authService.logout();
          Swal.fire({
            title: 'Acceso no permitido',
            text: 'Esta cuenta no cuenta con permisos para ingresar al panel administrativo web.',
            icon: 'warning',
            confirmButtonText: 'Aceptar'
          });
        }
      },
      error: (err: any) => {
        this.cargandoLogin = false;
        this.authService.logout();
        const status = Number(err?.status);
        const mensajeRaw =
          (typeof err?.error === 'object' && err?.error !== null
            ? (err.error.detail || err.error.mensaje || err.error.error || err.error.non_field_errors?.[0])
            : '') || '';

        if (status === 0) {
          Swal.fire({
            title: 'Error de conexión',
            text: 'No se pudo conectar con el servidor backend. Verifique que esté encendido y revise su red.',
            icon: 'error',
            confirmButtonText: 'Aceptar'
          });
          return;
        }

        if (status >= 500) {
          Swal.fire({
            title: 'Error del servidor',
            text: mensajeRaw || `Ocurrió un error interno en el servidor (HTTP ${status}). Intente nuevamente en unos momentos.`,
            icon: 'error',
            confirmButtonText: 'Aceptar'
          });
          return;
        }

        if (status === 404) {
          Swal.fire({
            title: 'Servicio no disponible',
            text: mensajeRaw || 'No se encontró el servicio de autenticación en el servidor (HTTP 404).',
            icon: 'error',
            confirmButtonText: 'Aceptar'
          });
          return;
        }

        if (status === 429) {
          Swal.fire({
            title: 'Cuenta bloqueada temporalmente',
            text: mensajeRaw || 'Has superado el límite de intentos fallidos. Intenta nuevamente en 15 minutos o restablece tu contraseña.',
            icon: 'warning',
            confirmButtonText: 'Aceptar'
          });
          return;
        }

        Swal.fire({
          title: 'Credenciales inválidas',
          text: mensajeRaw || 'Credenciales incorrectas. Verifique sus datos e intente nuevamente.',
          icon: 'error',
          confirmButtonText: 'Aceptar'
        });
      }
    });
  }

  // --- Métodos para Recuperación de Contraseña ---
 
  solicitarRecuperacion() {
    if (!this.emailRecuperacion) {
      this.mensajeError = 'Por favor ingresa un correo electrónico.';
      return;
    }

    this.cargandoPaso1 = true;
    this.mensajeError = '';
    this.mensajeExito = '';
    this.cdr.detectChanges();

    this.authService.solicitarRecuperacion(this.emailRecuperacion).subscribe({
      next: (res: any) => {
        this.mensajeExito = res.mensaje || res.detail || '¡Código enviado exitosamente a tu correo!';
        this.cargandoPaso1 = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        const st = Number(err?.status);
        if (st === 0) {
          this.mensajeError = 'No se pudo conectar con el servidor. Verifique su conexión o que el backend esté activo.';
        } else if (st >= 500) {
          this.mensajeError = `Error interno del servidor (HTTP ${st}). Intente nuevamente en unos momentos.`;
        } else {
          this.mensajeError = err.error?.error || err.error?.detail || err.error?.mensaje || 'No se pudo enviar el correo.';
        }
        this.cargandoPaso1 = false;
        this.cdr.detectChanges();
      }
    });
  }

  confirmarRecuperacion() {
    if (!this.emailRecuperacion || !this.codigoIngresado || !this.nuevaPassword) {
      this.mensajeError = 'Todos los campos de recuperación son obligatorios.';
      this.cdr.detectChanges();
      return;
    }

    if (this.nuevaPassword.length < 8) {
      this.mensajeError = 'La nueva contraseña debe tener al menos 8 caracteres.';
      this.cdr.detectChanges();
      return;
    }

    if (this.nuevaPassword === this.nuevaPassword.toLowerCase()) {
      this.mensajeError = 'La nueva contraseña debe incluir al menos una letra mayúscula.';
      this.cdr.detectChanges();
      return;
    }

    this.cargandoPaso2 = true;
    this.mensajeError = '';
    this.mensajeExito = '';
    this.cdr.detectChanges();

    const payload = {
      email: this.emailRecuperacion,
      codigo: this.codigoIngresado,
      nueva_password: this.nuevaPassword
    };

    this.authService.confirmarPassword(payload).subscribe({
      next: (res: any) => {
        this.mensajeExito = res?.mensaje || res?.detail || '¡Contraseña actualizada con éxito!';
        this.cargandoPaso2 = false;
        this.cdr.detectChanges();
        
        setTimeout(() => {
          this.mostrarRecuperacion = false;
          this.mensajeExito = '';
          this.cdr.detectChanges();
        }, 2000);
      },
      error: (err: any) => {
        const st = Number(err?.status);
        if (st === 0) {
          this.mensajeError = 'No se pudo conectar con el servidor. Verifique su conexión o que el backend esté activo.';
        } else if (st >= 500) {
          this.mensajeError = `Error interno del servidor (HTTP ${st}). Intente nuevamente en unos momentos.`;
        } else {
          this.mensajeError = err.error?.error || err.error?.detail || err.error?.mensaje || 'Código incorrecto o expirado.';
        }
        this.cargandoPaso2 = false;
        this.cdr.detectChanges();
      }
    });
  }
}
