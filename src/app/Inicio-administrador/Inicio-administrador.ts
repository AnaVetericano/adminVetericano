import { Component, inject } from '@angular/core';
import { Router, RouterOutlet,  RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-inicio-administrador',
  standalone: true,
  imports: [RouterOutlet, RouterLinkActive],
  templateUrl: './Inicio-administrador.html',
  styleUrl: './Inicio-administrador.css'
})
export class InicioAdministradorComponent {
  private router = inject(Router);

  // Datos para mostrar en el perfil del sidebar
  adminUser = {
    name: 'Jubelit Zapata',
    role: 'Admin',
    avatarUrl: 'assets/admin-avatar.jpg'
  };

  onLogout(): void {
    console.log('Cerrando sesión de usuario');
    this.router.navigate(['/inicio-de-sesion-administrador']);
  }
}