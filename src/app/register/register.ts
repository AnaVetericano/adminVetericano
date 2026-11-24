import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth';
import Swal from 'sweetalert2';

import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  mostrarPassword: boolean = false;
  cargandoRegistro: boolean = false;

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

  volverAlInicio(): void {
    this.router.navigate(['/']);
  }

  registrarse() {
    if (this.cargandoRegistro) {
      return;
    }

    if (!this.register.email || !this.register.identificacion || !this.register.password || !this.register.nombre || !this.register.apellido) {
      Swal.fire({
        title: 'Campos obligatorios incompletos',
        text: 'Complete todos los campos obligatorios para continuar.',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    this.cargandoRegistro = true;

    // Enviamos el objeto 'this.register' completo que cumple exacto con la interfaz 'RegistroUsuario'

this.authService.registrar(this.register).subscribe({
  next: (respuesta) => {
    this.cargandoRegistro = false;

    console.log(' Registrado:', respuesta);

    Swal.fire({
      title: 'Registro guardado',
      text: 'Administrador registrado correctamente.',
      icon: 'success',
      confirmButtonText: 'Aceptar'
    }).then(() => {

      this.router.navigate(['/iniciodesesionadministrador']);

    });

  },

  error: (err) => {
    this.cargandoRegistro = false;

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
      title: 'No fue posible completar el registro',
      text: mensajeReal,
      icon: 'error',
      confirmButtonText: 'Aceptar'
    });

  }
});


  }

  iniciarSesion() {
    this.router.navigate(['/iniciodesesionadministrador']);
  }
}