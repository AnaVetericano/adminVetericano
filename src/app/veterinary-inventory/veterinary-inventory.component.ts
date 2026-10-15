import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import {
  VeterinaryInventoryService,
  VeterinaryKitItem,
  ConsumoValidationResult
} from '../services/veterinary-inventory.service';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-veterinary-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './veterinary-inventory.component.html',
  styleUrl: './veterinary-inventory.component.css'
})
export class VeterinaryInventoryComponent implements OnInit {
  private inventoryService = inject(VeterinaryInventoryService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  // Estados de carga y datos
  cargando = true;
  error = '';
  itemsKit: VeterinaryKitItem[] = [];
  itemsFiltrados: VeterinaryKitItem[] = [];

  // Filtros
  textoFiltro = '';
  filtroEstado = 'todos'; // todos | bajo | disponible | agotado

  // Información del veterinario y rol
  veterinarioNombre = '';
  veterinarioId = 0;
  esAdmin = false;
  veterinariosDisponibles: any[] = [];
  veterinarioSeleccionadoId: number = 0;

  // Modal / Formulario de Prescripción y Consumo
  modalConsumoAbierto = false;
  itemSeleccionadoParaConsumo: VeterinaryKitItem | null = null;
  cantidadConsumo: number = 1;
  observacionesConsumo = '';
  pacienteConsumo = '';

  // Resultado de validación en tiempo real
  validacionConsumo: ConsumoValidationResult | null = null;
  guardandoConsumo = false;

  ngOnInit(): void {
    const sesion = this.authService.currentUser();
    const rol = String(sesion?.rol ?? sesion?.['nombre_rol'] ?? '').toLowerCase();
    this.esAdmin = rol.includes('admin') || Number(sesion?.id_rol) === 1;

    this.veterinarioId = this.inventoryService.getVeterinarioLogueadoId();
    this.veterinarioNombre = this.inventoryService.getVeterinarioLogueadoNombre();
    this.veterinarioSeleccionadoId = this.veterinarioId;

    if (this.esAdmin) {
      this.inventoryService.obtenerVeterinarios().subscribe({
        next: (vets) => {
          this.veterinariosDisponibles = vets;
          if (vets.length > 0) {
            // Si el seleccionado no está en la lista de veterinarios, seleccionar el primero
            if (!vets.some(v => Number(v.id_usuario) === Number(this.veterinarioSeleccionadoId))) {
              this.veterinarioSeleccionadoId = vets[0].id_usuario;
              this.veterinarioNombre = vets[0].nombre;
            } else {
              const current = vets.find(v => Number(v.id_usuario) === Number(this.veterinarioSeleccionadoId));
              if (current) this.veterinarioNombre = current.nombre;
            }
          }
          this.cargarDatos();
        },
        error: () => this.cargarDatos()
      });
    } else {
      this.cargarDatos();
    }
  }

  cambiarVeterinario(): void {
    const vet = this.veterinariosDisponibles.find(v => Number(v.id_usuario) === Number(this.veterinarioSeleccionadoId));
    if (vet) {
      this.veterinarioNombre = vet.nombre;
    }
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando = true;
    this.error = '';

    const idVet = this.esAdmin && this.veterinarioSeleccionadoId
      ? Number(this.veterinarioSeleccionadoId)
      : this.veterinarioId;

    this.inventoryService.cargarInventarioVeterinario(idVet).subscribe({
      next: (items) => {
        this.itemsKit = items;
        this.aplicarFiltro();
        this.cargando = false;
        this.cdr.detectChanges();

        // Si hay items con stock bajo, verificar y alertar si es necesario
        this.verificarAlertasStockBajoAutomaticas();
      },
      error: (err) => {
        console.error('Error al cargar inventario veterinario:', err);
        this.error = 'No se pudo conectar con el inventario de campo. Revisa tu conexión.';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  aplicarFiltro(): void {
    const q = this.textoFiltro.toLowerCase().trim();

    this.itemsFiltrados = this.itemsKit.filter((item) => {
      // Filtro de estado
      if (this.filtroEstado === 'bajo' && (!item.umbralBajo || item.saldoDisponible <= 0)) return false;
      if (this.filtroEstado === 'agotado' && item.saldoDisponible > 0) return false;
      if (this.filtroEstado === 'disponible' && item.saldoDisponible <= 10) return false;

      // Filtro de texto
      if (!q) return true;
      return (
        item.nombre.toLowerCase().includes(q) ||
        (item.tipo && item.tipo.toLowerCase().includes(q)) ||
        (item.descripcion && item.descripcion.toLowerCase().includes(q)) ||
        (item.presentacion && item.presentacion.toLowerCase().includes(q)) ||
        (item.lote && item.lote.toLowerCase().includes(q))
      );
    });
  }

  limpiarFiltro(): void {
    this.textoFiltro = '';
    this.filtroEstado = 'todos';
    this.aplicarFiltro();
  }

  // --- Métricas calculadas ---
  get totalProductos(): number {
    return this.itemsKit.length;
  }

  get totalSaldoDisponible(): number {
    return this.itemsKit.reduce((sum, item) => sum + item.saldoDisponible, 0);
  }

  get totalEntregadas(): number {
    return this.itemsKit.reduce((sum, item) => sum + item.cantidadEntregada, 0);
  }

  get totalConsumidas(): number {
    return this.itemsKit.reduce((sum, item) => sum + item.cantidadConsumida, 0);
  }

  get productosConStockBajo(): VeterinaryKitItem[] {
    return this.itemsKit.filter(i => i.saldoDisponible > 0 && i.saldoDisponible <= 10);
  }

  get productosAgotados(): VeterinaryKitItem[] {
    return this.itemsKit.filter(i => i.saldoDisponible <= 0);
  }

  /**
   * Dispara una alerta visual con SweetAlert2 para un producto con stock bajo (<= 10)
   * con el texto exacto exigido:
   * "Recuerda que te quedan [X] unidades de este producto. Es hora de solicitar reaprovisionamiento al inventario general."
   */
  mostrarAlertaStockBajoSweetAlert(item: VeterinaryKitItem): void {
    Swal.fire({
      icon: 'warning',
      title: '¡Alerta de Stock Bajo!',
      html: `
        <div class="text-left text-sm space-y-3">
          <div class="p-3 bg-amber-50 border-l-4 border-[#F1C63C] rounded-r-xl">
            <p class="font-bold text-amber-950">
              Recuerda que te quedan ${item.saldoDisponible} unidades de este producto. Es hora de solicitar reaprovisionamiento al inventario general.
            </p>
          </div>
          <div class="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <p><b>Producto:</b> ${item.nombre}</p>
            <p><b>Presentación:</b> ${item.presentacion || 'Unidad de campo'}</p>
            <p><b>Saldo Actual:</b> <span class="font-extrabold text-amber-700">${item.saldoDisponible} uds</span></p>
            <p><b>Kit / Lote:</b> ${item.lote || 'Kit de Campo'}</p>
          </div>
        </div>
      `,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#4141A5',
      background: '#ffffff',
      customClass: {
        popup: 'rounded-3xl shadow-2xl border border-amber-200'
      }
    });
  }

  private verificarAlertasStockBajoAutomaticas(): void {
    const conStockBajo = this.productosConStockBajo;
    // Si hay stock crítico y no se ha mostrado en esta sesión
    const yaAlertado = sessionStorage.getItem(`alerta_stock_mostrada_${this.veterinarioId}`);
    if (conStockBajo.length > 0 && !yaAlertado) {
      sessionStorage.setItem(`alerta_stock_mostrada_${this.veterinarioId}`, 'true');
      const primerItem = conStockBajo[0];
      setTimeout(() => {
        this.mostrarAlertaStockBajoSweetAlert(primerItem);
      }, 800);
    }
  }

  // --- Modal de Prescripción / Consumo ---
  abrirModalConsumo(item: VeterinaryKitItem): void {
    this.itemSeleccionadoParaConsumo = item;
    this.cantidadConsumo = 1;
    this.observacionesConsumo = '';
    this.pacienteConsumo = '';
    this.validarCantidadConsumo();
    this.modalConsumoAbierto = true;

    // Si tiene stock bajo, advertir de inmediato
    if (item.saldoDisponible <= 10 && item.saldoDisponible > 0) {
      // La validación ya incluye el mensaje exacto
    }
  }

  cerrarModalConsumo(): void {
    this.modalConsumoAbierto = false;
    this.itemSeleccionadoParaConsumo = null;
    this.validacionConsumo = null;
    this.guardandoConsumo = false;
  }

  validarCantidadConsumo(): void {
    if (!this.itemSeleccionadoParaConsumo) return;
    this.validacionConsumo = this.inventoryService.validarConsumo(
      this.itemSeleccionadoParaConsumo.id_medicamento,
      this.cantidadConsumo
    );
  }

  seleccionarAlternativa(alternativa: VeterinaryKitItem): void {
    this.itemSeleccionadoParaConsumo = alternativa;
    this.cantidadConsumo = 1;
    this.validarCantidadConsumo();
  }

  confirmarConsumo(): void {
    if (!this.itemSeleccionadoParaConsumo) return;

    this.validarCantidadConsumo();
    if (!this.validacionConsumo || !this.validacionConsumo.valido) {
      const mensaje = this.validacionConsumo?.mensajeError ||
        `No cuentas con suficiente stock en tu inventario de campo (Disponibles: ${this.itemSeleccionadoParaConsumo.saldoDisponible}, Solicitados: ${this.cantidadConsumo}). Por favor, ajusta la cantidad o utiliza una alternativa de medicamento disponible.`;
      
      Swal.fire({
        icon: 'error',
        title: 'Acción bloqueada',
        text: mensaje,
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    const item = this.itemSeleccionadoParaConsumo;
    const cant = Number(this.cantidadConsumo);

    Swal.fire({
      title: '¿Confirmar formulación / consumo?',
      html: `
        <div class="text-left text-sm space-y-2">
          <p>Se registrará el consumo de <b>${cant} unidades</b> de:</p>
          <p class="font-extrabold text-[#170B3D] text-base">${item.nombre}</p>
          <p class="text-xs text-slate-500">Saldo actual en maletín: <b>${item.saldoDisponible} uds</b> &rarr; Nuevo saldo: <b>${item.saldoDisponible - cant} uds</b></p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar y descontar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4141A5',
      cancelButtonColor: '#64748b',
      customClass: {
        popup: 'rounded-3xl'
      }
    }).then((res) => {
      if (!res.isConfirmed) return;

      this.guardandoConsumo = true;
      this.inventoryService.registrarConsumo(item.id_medicamento, cant, this.observacionesConsumo).subscribe({
        next: (exito) => {
          this.guardandoConsumo = false;
          if (exito) {
            this.cargarDatos();
            this.cerrarModalConsumo();

            Swal.fire({
              icon: 'success',
              title: '¡Consumo Registrado!',
              text: `Se descontaron ${cant} unidad(es) de ${item.nombre} de tu inventario de campo.`,
              confirmButtonColor: '#4141A5'
            });
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Error al registrar',
              text: 'No se pudo completar el registro del consumo.',
              confirmButtonColor: '#4141A5'
            });
          }
        },
        error: (err) => {
          this.guardandoConsumo = false;
          console.error(err);
          Swal.fire({
            icon: 'error',
            title: 'Error de comunicación',
            text: 'Ocurrió un error al actualizar el inventario.',
            confirmButtonColor: '#4141A5'
          });
        }
      });
    });
  }
}

