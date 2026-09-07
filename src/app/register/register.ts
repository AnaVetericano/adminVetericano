import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth';
import Swal from 'sweetalert2';

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
    identificacion:'',
    password: '',
    nombre: '',
    apellido: '',
  };

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  registrarse() {
    if (!this.register.email || !this.register.identificacion || !this.register.password || !this.register.nombre || !this.register.apellido) {
      Swal.fire({
  title: 'Campos incompletos',
  text: 'Por favor completa todos los campos principales.',
  icon: 'warning',
  confirmButtonText: 'Entendido',
  confirmButtonColor: '#1B1947',
  background: '#ffffff',
  color: '#1B1947',
  customClass: {
    popup: 'rounded-3xl',
    title: 'font-bold',
    confirmButton: 'rounded-xl px-6 py-3 font-semibold'
  }
});
      return;
    }

    // Enviamos el objeto 'this.register' completo que cumple exacto con la interfaz 'RegistroUsuario'

this.authService.registrar(this.register).subscribe({
  next: (respuesta) => {

    console.log(' Registrado:', respuesta);

    Swal.fire({
      title: '¡Registro exitoso! ',
      text: 'Administrador registrado correctamente.',
      icon: 'success',
      confirmButtonText: 'Continuar',
      confirmButtonColor: '#1B1947',
      background: '#ffffff',
      color: '#1B1947',
      customClass: {
        popup: 'rounded-3xl',
        title: 'font-bold',
        confirmButton: 'rounded-xl px-6 py-3 font-semibold'
      }
    }).then(() => {

      this.router.navigate(['/iniciodesesionadministrador']);

    });

  },

  error: (err) => {

    console.error('Error en el registro:', err);

    const errData = err.error;

    // DRF devuelve {campo: ["mensaje"]} en errores de validación
    const primerCampo = errData && Object.keys(errData)[0];

    const mensajeReal =
      errData?.mensaje
      || errData?.detail
      || (
        primerCampo && Array.isArray(errData[primerCampo])
          ? errData[primerCampo][0]
          : null
      )
      || 'Ocurrió un error al registrarse';

    Swal.fire({
      title: '¡Ups! 😕',
      text: mensajeReal,
      icon: 'error',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#1B1947',
      background: '#ffffff',
      color: '#1B1947',
      customClass: {
        popup: 'rounded-3xl',
        title: 'font-bold',
        confirmButton: 'rounded-xl px-6 py-3 font-semibold'
      }
    });

  }
});


  }

  iniciarSesion() {
    this.router.navigate(['/iniciodesesionadministrador']);
  }
}

// perra 