import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-inicio-de-sesion-administrador', 
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './inicio-de-sesion-administrador.html', 
  styleUrl: './inicio-de-sesion-administrador.css'     
})
export class InicioDeSesionAdministradorComponent { 
  
  usuario = {
    username: '',
    password: ''
  };

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  login() {
    // Validación
    if (this.usuario.username === '' || this.usuario.password === '') {
      alert('Por favor, ingresa tu usuario y contraseña.');
      return; 
    }

    console.log('Credenciales enviadas:', this.usuario);

    // Petición a tu API
    this.http.post('https://backendvetericano.onrender.com/api/usuarios/login/', this.usuario).subscribe({
      next: (res: any) => {
        console.log(res);
        this.router.navigate(['/inicio-admin']);
      },
      error: (err) => {
        console.error('Error:', err);
        alert(err.error?.mensaje || 'Credenciales incorrectas, intenta de nuevo.');
      }
    });
  }
}