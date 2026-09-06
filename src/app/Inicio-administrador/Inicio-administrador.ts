import { Component, inject } from '@angular/core';
import { Router, RouterOutlet, RouterLinkActive, RouterLink } from '@angular/router';

@Component({
  selector: 'app-inicio-administrador',
  standalone: true,
  imports: [RouterOutlet, RouterLinkActive, RouterLink],
  templateUrl: './Inicio-administrador.html',
  styleUrl: './Inicio-administrador.css'
})
export class InicioAdministradorComponent {
  private router = inject(Router);

  // Control para abrir y cerrar el menú en móviles
  menuAbierto: boolean = true;

  // Datos para mostrar en el perfil del sidebar
  adminUser = {
    name: 'Julian M.',
    role: 'ADMINISTRADOR',
    avatarUrl: 'images/administradorperfil.svg'
  };

  onLogout(): void {
    console.log('Cerrando sesión de usuario');
    this.router.navigate(['iniciodesesionadministrador']);
  }
}