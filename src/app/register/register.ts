import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {

  nombre: string = '';
  email: string = '';
  password: string = '';
  confirmarPassword: string = '';

  constructor(private router: Router) {}

  registrarse() {

    if (!this.nombre || !this.email || !this.password || !this.confirmarPassword) {
      alert('Por favor completa todos los campos');
      return;
    }

    if (this.password !== this.confirmarPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }

    console.log('Datos del administrador:', {
      nombre: this.nombre,
      email: this.email,
      password: this.password
    });

    // Después aquí conectamos con tu API de Django
    alert('Administrador registrado correctamente');

    // Ir al inicio de sesión
    this.router.navigate(['/inicio-sesion']);
  }

  iniciarSesion() {
    this.router.navigate(['/iniciodesesionadministrador']);
  }
}