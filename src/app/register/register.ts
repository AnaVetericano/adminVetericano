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

  nombre: string = '';
  apellido:string='';
  email: string = '';
  password: string = '';
  telefono: string='';
  confirmarPassword: string = '';

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  registrarse() {

    if (!this.nombre || !this.email || !this.password || !this.confirmarPassword) {
      alert('Por favor completa todos los campos');
      return;
    }

    if (this.password !== this.confirmarPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }

    const datos = {
      nombre: this.nombre,
      email: this.email,
      password: this.password
    };

    this.authService.registrar(datos).subscribe({
      next: (respuesta) => {
        console.log('Administrador registrado:', respuesta);
        alert('Administrador registrado correctamente');
        this.router.navigate(['/inicio-sesion']);
      },

    });
  }

  iniciarSesion() {
    this.router.navigate(['/iniciodesesionadministrador']);
  }
}