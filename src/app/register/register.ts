import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  register = {
    email: '',
    password: '',
    nombre: '',
    apellido: '',
  };

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  registrarse() {
    if (!this.register.email || !this.register.password || !this.register.nombre || !this.register.apellido) {
      alert('Por favor completa todos los campos principales');
      return;
    }

    // Enviamos el objeto 'this.register' completo que cumple exacto con la interfaz 'RegistroUsuario'
    this.authService.registrar(this.register).subscribe({
      next: (respuesta) => {
        console.log('Administrador registrado:', respuesta);
        alert('Administrador registrado correctamente');
        this.router.navigate(['/iniciodesesionadministrador']);
      },
      error: (err) => {
        console.error('Error en el registro:', err);
        const errData = err.error;
        // DRF devuelve {campo: ["mensaje"]} en errores de validación
        const primerCampo = errData && Object.keys(errData)[0];
        const mensajeReal = errData?.mensaje
          || (primerCampo && Array.isArray(errData[primerCampo]) ? errData[primerCampo][0] : null)
          || 'Ocurrió un error al registrarse';
        alert(mensajeReal);
      }
    });
  }

  iniciarSesion() {
    this.router.navigate(['/iniciodesesionadministrador']);
  }
}

// perra 