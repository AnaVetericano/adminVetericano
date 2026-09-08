import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, inject, ViewChild } from '@angular/core';
import { Router, RouterOutlet, RouterLinkActive, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { Chart} from 'chart.js/auto';



@Component({
  selector: 'app-inicio-administrador',
  standalone: true,
  imports: [RouterOutlet, RouterLinkActive, RouterLink, CommonModule],
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
  Swal.fire({
    title: '¿Cerrar sesión?',
    text: '¿Estás seguro de que deseas cerrar sesión?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, cerrar sesión',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#4141A5',
    cancelButtonColor: '#ffffff',
    customClass: {
      cancelButton: '!text-black !border !border-gray-400'
    }
  }).then((result) => {

    if (result.isConfirmed) {
      console.log('Cerrando sesión de usuario');

      this.router.navigate(['/']);
    }

  });
}

}