import { Component } from '@angular/core';
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
  
  cargandoPaso1: boolean = false;
  cargandoPaso2: boolean = false;
  
  mensajeExito: string = '';
  mensajeError: string = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  login() {
    // Validación corregida a 'email'
    if (this.usuario.email === '' || this.usuario.password === '') {
    Swal.fire({
      title: 'Ingrese su correo y contraseña por favor ',
      text: 'Por favor ingrese su correo y su contraseña validos.',
      icon: 'info',
      confirmButtonText: 'Continuar',
      confirmButtonColor: '#1B1947',
      background: '#ffffff',
      color: '#1B1947',
      customClass: {
        popup: 'rounded-3xl',
        title: 'font-bold',
        confirmButton: 'rounded-xl px-6 py-3 font-semibold'
      }
    })      
    }

    console.log('Credenciales enviadas:', this.usuario);

    // Petición a la API usando AuthService
    this.authService.login(this.usuario).subscribe({
      next: (res: any) => {
        // NOTA: Guardar token pospuesto hasta que el usuario lo indique
        this.router.navigate(['/inicio-admin']);
      },
      error: (err: any) => {
        const mensaje = err.error?.detail || err.error?.mensaje || err.error?.error || 'Credenciales incorrectas, intenta de nuevo.';
         Swal.fire({
      title: 'Su usuario o contraseña no son validos',
      text: mensaje,
      icon: 'error',
      confirmButtonText: 'Continuar',
      confirmButtonColor: '#1B1947',
      background: '#ffffff',
      color: '#1B1947',
      customClass: {
        popup: 'rounded-3xl',
        title: 'font-bold',
        confirmButton: 'rounded-xl px-6 py-3 font-semibold'
      }
    })  
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

    this.authService.solicitarRecuperacion(this.emailRecuperacion).subscribe({
      next: (res: any) => {
        this.mensajeExito = res.mensaje || res.detail || '¡Código enviado exitosamente a tu correo!';
        this.cargandoPaso1 = false;
      },
      error: (err: any) => {
        this.mensajeError = err.error?.error || err.error?.detail || err.error?.mensaje || 'No se pudo enviar el correo.';
        this.cargandoPaso1 = false;
      }
    });
  }

  confirmarRecuperacion() {
    if (!this.emailRecuperacion || !this.codigoIngresado || !this.nuevaPassword) {
      this.mensajeError = 'Todos los campos de recuperación son obligatorios.';
      return;
    }

    this.cargandoPaso2 = true;
    this.mensajeError = '';
    this.mensajeExito = '';

    const payload = {
      email: this.emailRecuperacion,
      codigo: this.codigoIngresado,
      nueva_password: this.nuevaPassword
    };

    this.authService.confirmarPassword(payload).subscribe({
      next: (res: any) => {
        this.mensajeExito = res.mensaje || res.detail || '¡Contraseña actualizada con éxito!';
        this.cargandoPaso2 = false;
        
        setTimeout(() => {
          this.mostrarRecuperacion = false;
          this.mensajeExito = '';
        }, 2000);
      },
      error: (err: any) => {
        this.mensajeError = err.error?.error || err.error?.detail || err.error?.mensaje || 'Código incorrecto o expirado.';
        this.cargandoPaso2 = false;
      }
    });
  }
}
