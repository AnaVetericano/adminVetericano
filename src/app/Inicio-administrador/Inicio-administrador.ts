import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet, RouterLinkActive, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../services/auth';
import { VeterinaryInventoryService } from '../services/veterinary-inventory.service';

@Component({
  selector: 'app-inicio-administrador',
  standalone: true,
  imports: [RouterOutlet, RouterLinkActive, RouterLink, CommonModule],
  templateUrl: './Inicio-administrador.html',
  styleUrl: './Inicio-administrador.css'
})
export class InicioAdministradorComponent implements OnInit {
  private router = inject(Router);
  public authService = inject(AuthService);
  public inventoryService = inject(VeterinaryInventoryService);

  // Control para abrir y cerrar el menú en móviles
  menuAbierto: boolean = true;

  // Control para el menú desplegable del perfil en la esquina superior derecha
  menuPerfilAbierto: boolean = false;

  // Control para el menú desplegable de alertas de medicamentos
  menuAlertasAbierto: boolean = false;
  medicamentosAlertas: any[] = [];

  // Datos para mostrar en el perfil del sidebar
  adminUser = {
    avatarUrl: 'images/logoVet.svg'
  };
  logoVetWhite = {
    avatarUrl: 'images/logoVetWhite.svg'
  };

  ngOnInit(): void {
    if (this.authService.isVeterinario() || this.authService.isAdmin()) {
      this.inventoryService.alertasMaletin$.subscribe(alertas => {
        this.medicamentosAlertas = alertas || [];
      });
      if (this.medicamentosAlertas.length === 0) {
        this.cargarAlertasIniciales();
      }
    }
  }

  cargarAlertasIniciales(): void {
    this.inventoryService.obtenerMiKit().subscribe({
      next: (resp) => {
        const items = resp.items || [];
        this.inventoryService.obtenerAlertasKit().subscribe({
          next: (alertas) => {
            const setAgotados = new Set((alertas?.agotados || []).map(a => a.id_medicamento));
            const setCriticos = new Set((alertas?.criticos || []).map(a => a.id_medicamento));
            const setBajos = new Set((alertas?.bajos || []).map(a => a.id_medicamento));
            const setVencidos = new Set((alertas?.vencidos || []).map(a => a.id_medicamento));
            const setProximos = new Set((alertas?.proximos_a_vencer || []).map(a => a.id_medicamento));

            const list = items
              .map(it => {
                const saldo = it.saldo_disponible || 0;
                let nivel = 'OPTIMO';
                if (saldo === 0 || setAgotados.has(it.id_medicamento)) nivel = 'AGOTADO';
                else if (setCriticos.has(it.id_medicamento) || saldo <= 5) nivel = 'CRITICO';
                else if (setBajos.has(it.id_medicamento) || saldo <= 10) nivel = 'BAJO';

                return {
                  id_medicamento: it.id_medicamento,
                  nombre: it.nombre,
                  saldo_disponible: saldo,
                  nivelStock: nivel,
                  tieneVencidos: setVencidos.has(it.id_medicamento) || (it.saldo_vencido || 0) > 0,
                  proximoAVencer: setProximos.has(it.id_medicamento)
                };
              })
              .filter(m => m.nivelStock !== 'OPTIMO' || m.tieneVencidos || m.proximoAVencer);

            this.inventoryService.setAlertasMaletin(list);
          },
          error: () => {}
        });
      },
      error: () => {}
    });
  }

  get totalMedicamentosAlertas(): number {
    return this.medicamentosAlertas.length;
  }

  toggleMenuAlertas(): void {
    this.menuAlertasAbierto = !this.menuAlertasAbierto;
    if (this.menuAlertasAbierto) {
      this.menuPerfilAbierto = false;
    }
  }

  cerrarMenuAlertas(): void {
    this.menuAlertasAbierto = false;
  }

  toggleMenuPerfil(): void {
    this.menuPerfilAbierto = !this.menuPerfilAbierto;
    if (this.menuPerfilAbierto) {
      this.menuAlertasAbierto = false;
    }
  }

  cerrarMenuPerfil(): void {
    this.menuPerfilAbierto = false;
  }

  irAMaletinConMedicamento(m?: any): void {
    this.cerrarMenuAlertas();
    this.router.navigate(['/inicio-admin/dashboard-veterinario'], {
      queryParams: {
        tab: 'maletin',
        buscar: m ? m.nombre : undefined
      }
    });
  }

  onLogout(): void {
    this.cerrarMenuPerfil();
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
        this.authService.logout();
        this.router.navigate(['/']);
      }
    });
  }
}

