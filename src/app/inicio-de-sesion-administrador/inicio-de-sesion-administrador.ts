import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

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
    private http: HttpClient,
    private router: Router
  ) {}

  login() {
    // Validación corregida a 'email'
    if (this.usuario.email === '' || this.usuario.password === '') {
      alert('Por favor, ingresa tu correo y contraseña.');
      return; 
    }

    console.log('Credenciales enviadas:', this.usuario);

    // Petición a tu API
    this.http.post('https://backendvetericano.onrender.com/api/usuarios/login/', this.usuario).subscribe({
      next: (res: any) => {
        this.router.navigate(['/inicio-admin']);
      },
      error: (err: any) => {
        alert(err.error?.mensaje || 'Credenciales incorrectas, intenta de nuevo.');
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

    this.http.post('http://127.0.0.1:8000/api/users/recuperar-password/', { email: this.emailRecuperacion }).subscribe({
      next: (res: any) => {
        this.mensajeExito = res.mensaje || '¡Código enviado exitosamente a tu correo!';
        this.cargandoPaso1 = false;
      },
      error: (err) => {
        this.mensajeError = err.error?.error || 'No se pudo enviar el correo.';
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

    this.http.post('http://127.0.0.1:8000/api/users/confirmar-password/', payload).subscribe({
      next: (res: any) => {
        this.mensajeExito = res.mensaje || '¡Contraseña actualizada con éxito!';
        this.cargandoPaso2 = false;
        
        setTimeout(() => {
          this.mostrarRecuperacion = false;
          this.mensajeExito = '';
        }, 2000);
      },
      error: (err: any) => {
        this.mensajeError = err.error?.error || 'Código incorrecto o expirado.';
        this.cargandoPaso2 = false;
      }
    });
  }
}