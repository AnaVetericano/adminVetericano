import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import {
  VeterinaryInventoryService,
  VeterinaryKitItem,
  ConsumoValidationResult,
  KitAlertasResponse,
  SolicitudKitPayload
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
  backendAlertas: KitAlertasResponse | null = null;

  // Filtros
  textoFiltro = '';
  filtroEstado = 'todos'; // todos | bajo | disponible | agotado

  // Información del veterinario y rol
  veterinarioNombre = '';
  veterinarioId = 0;
  esAdmin = false;
  veterinariosDisponibles: any[] = [];
  veterinarioSeleccionadoId: number = 0;

  // Modal de Solicitud de Reposición a Farmacia CBA
  modalNuevaSolicitudAbierto = false;
  medicamentoSolicitudId: number | null = null;
  cantidadSolicitud: number = 10;
  justificacionSolicitud = 'Reposición de existencias para cuota operativa de maletín de campo CBA.';
  guardandoSolicitud = false;
  catalogoMedicamentos: any[] = [];

  // Modal de Prescripción / Consumo
  modalConsumoAbierto = false;
  itemSeleccionadoParaConsumo: VeterinaryKitItem | null = null;
  cantidadConsumo: number = 1;
  observacionesConsumo = '';
  pacienteConsumo = '';

  // Modal de Ajuste / Retiro de Stock del Kit
  modalAjusteAbierto = false;
  itemSeleccionadoParaAjuste: VeterinaryKitItem | null = null;
  tipoOperacionAjuste: 'RETIRO' | 'ASIGNAR' = 'RETIRO';
  cantidadAjuste: number = 1;
  motivoAjuste: string = 'Devolución de stock a bodega general CBA';
  guardandoAjuste = false;

  // Resultado de validación en tiempo real
  validacionConsumo: ConsumoValidationResult | null = null;
  guardandoConsumo = false;

  // Centro de Alertas en Barra Superior (Campanita)
  panelAlertasAbierto = false;

  togglePanelAlertas(): void {
    this.panelAlertasAbierto = !this.panelAlertasAbierto;
  }

  cerrarPanelAlertas(): void {
    this.panelAlertasAbierto = false;
  }

  ngOnInit(): void {
    const sesion: any = this.authService.currentUser();
    const rol = String(sesion?.rol ?? sesion?.['nombre_rol'] ?? '').toLowerCase();
    this.esAdmin = rol.includes('admin') || Number(sesion?.id_rol) === 1;

    this.veterinarioId = this.inventoryService.getVeterinarioLogueadoId();
    this.veterinarioNombre = this.inventoryService.getVeterinarioLogueadoNombre();
    this.veterinarioSeleccionadoId = this.veterinarioId;

    // Limpiar claves locales residuales de pruebas anteriores, manteniendo aislado el id 41
    this.inventoryService.limpiarDatosResidualesVeterinarios();

    if (this.esAdmin) {
      this.inventoryService.obtenerVeterinarios().subscribe({
        next: (vets) => {
          this.veterinariosDisponibles = vets;
          if (vets.length > 0) {
            // Seleccionar el veterinario previamente guardado o el primero del equipo CBA
            const guardado = sessionStorage.getItem('veterinario_seleccionado_supervision') || localStorage.getItem('veterinario_seleccionado_supervision');
            const vetGuardado = vets.find(v => Number(v.id_usuario) === Number(guardado));
            if (vetGuardado) {
              this.veterinarioSeleccionadoId = Number(vetGuardado.id_usuario);
              this.veterinarioNombre = vetGuardado.nombre;
            } else if (!vets.some(v => Number(v.id_usuario) === Number(this.veterinarioSeleccionadoId))) {
              this.veterinarioSeleccionadoId = Number(vets[0].id_usuario);
              this.veterinarioNombre = vets[0].nombre;
            } else {
              const current = vets.find(v => Number(v.id_usuario) === Number(this.veterinarioSeleccionadoId));
              if (current) this.veterinarioNombre = current.nombre;
            }
            try {
              sessionStorage.setItem('veterinario_seleccionado_supervision', String(this.veterinarioSeleccionadoId));
              localStorage.setItem('veterinario_seleccionado_supervision', String(this.veterinarioSeleccionadoId));
            } catch {}
          }
          this.cargarDatos();
    this.cargarCatalogoGeneral();
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
    try {
      sessionStorage.setItem('veterinario_seleccionado_supervision', String(this.veterinarioSeleccionadoId));
      localStorage.setItem('veterinario_seleccionado_supervision', String(this.veterinarioSeleccionadoId));
    } catch {}
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando = true;
    this.error = '';
    this.backendAlertas = null;

    const idVet = this.esAdmin && this.veterinarioSeleccionadoId
      ? Number(this.veterinarioSeleccionadoId)
      : this.veterinarioId;

    this.inventoryService.cargarInventarioVeterinario(idVet).subscribe({
      next: (items) => {
        this.itemsKit = items;
        this.aplicarFiltro();
        this.cargando = false;
        this.cdr.detectChanges();

        // Consultar alertas oficiales del backend (agotados, criticos, bajos, vencidos, proximos_a_vencer)
        this.inventoryService.obtenerAlertasKit(idVet).subscribe({
          next: (alertas) => {
            this.backendAlertas = alertas;
            this.cdr.detectChanges();
          },
          error: () => {
            this.backendAlertas = null;
          }
        });

        // Si hay items con stock bajo, verificar y alertar si es necesario
        this.verificarAlertasStockBajoAutomaticas();
      },
      error: (err) => {
        console.error('Error al cargar inventario veterinario:', err);
        this.error = 'No se pudo conectar con el inventario de campo. Revisa tu conexión.';
        this.cargando = false;
        this.backendAlertas = null;
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

  get totalEntregadas(): number {
    return this.itemsKit.reduce((sum, item) => sum + (Number(item.cantidadEntregada) || 0), 0);
  }

  get totalConsumidas(): number {
    return this.itemsKit.reduce((sum, item) => sum + (Number(item.cantidadConsumida) || 0), 0);
  }

  get totalSaldoDisponible(): number {
    // TOTAL_DISPONIBLE = TOTAL_ENTREGADO - TOTAL_CONSUMIDO
    // Garantiza que las tarjetas KPI y la suma individual coincidan al 100% matemáticamente
    return Math.max(0, this.totalEntregadas - this.totalConsumidas);
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
        <div class="text-left text-sm space-y-3 font-sans">
          <div class="p-3 bg-[#FFF4E5] border-l-4 border-[#FCD9A6] rounded-r-xl">
            <p class="font-bold text-[#9A5B13]">
              Recuerda que te quedan ${item.saldoDisponible} unidades de este producto. Es hora de solicitar reaprovisionamiento al inventario general.
            </p>
          </div>
          <div class="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <p><b>Producto:</b> ${item.nombre}</p>
            <p><b>Presentación:</b> ${item.presentacion || 'Unidad de campo'}</p>
            <p><b>Saldo Actual:</b> <span class="font-extrabold text-[#9A5B13] bg-[#FFF4E5] border border-[#FCD9A6] px-2 py-0.5 rounded-md">${item.saldoDisponible} uds</span></p>
            <p><b>Kit / Lote:</b> ${item.lote || 'Kit de Campo'}</p>
          </div>
        </div>
      `,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#4141A5',
      background: '#ffffff',
      customClass: {
        popup: 'rounded-3xl shadow-2xl border border-slate-200'
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

  // --- Modal de Ajuste / Retiro directo de Kit ---
  abrirModalAjuste(item: VeterinaryKitItem): void {
    this.itemSeleccionadoParaAjuste = item;
    this.tipoOperacionAjuste = 'RETIRO';
    this.cantidadAjuste = 1;
    this.motivoAjuste = 'Devolución de stock a bodega general CBA';
    this.modalAjusteAbierto = true;
  }

  cerrarModalAjuste(): void {
    this.modalAjusteAbierto = false;
    this.itemSeleccionadoParaAjuste = null;
    this.guardandoAjuste = false;
  }

  calcularSaldoAjuste(): number {
    if (!this.itemSeleccionadoParaAjuste) return 0;
    const cant = Number(this.cantidadAjuste) || 0;
    if (this.tipoOperacionAjuste === 'RETIRO') {
      return Math.max(0, this.itemSeleccionadoParaAjuste.saldoDisponible - cant);
    } else {
      return this.itemSeleccionadoParaAjuste.saldoDisponible + cant;
    }
  }

  confirmarAjuste(): void {
    if (!this.itemSeleccionadoParaAjuste) return;
    const item = this.itemSeleccionadoParaAjuste;
    const cant = Number(this.cantidadAjuste);

    if (cant <= 0) {
      Swal.fire({ icon: 'warning', title: 'Cantidad inválida', text: 'La cantidad debe ser mayor a 0.', confirmButtonColor: '#4141A5' });
      return;
    }

    if (this.tipoOperacionAjuste === 'RETIRO' && cant > item.saldoDisponible) {
      Swal.fire({
        icon: 'error',
        title: 'Cantidad superior al saldo',
        text: `No puedes retirar ${cant} unidades porque solo tienes ${item.saldoDisponible} unidades disponibles en tu maletín.`,
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    const idVet = this.esAdmin && this.veterinarioSeleccionadoId ? Number(this.veterinarioSeleccionadoId) : this.veterinarioId;

    this.guardandoAjuste = true;
    this.inventoryService.ajustarStockKit(idVet, item.id_medicamento, cant, this.tipoOperacionAjuste, this.motivoAjuste).subscribe({
      next: () => {
        this.guardandoAjuste = false;
        
        // Actualización reactiva inmediata en memoria
        if (this.tipoOperacionAjuste === 'RETIRO') {
          item.cantidadEntregada = Math.max(0, (Number(item.cantidadEntregada) || 0) - cant);
          item.saldoDisponible = Math.max(0, item.cantidadEntregada - (Number(item.cantidadConsumida) || 0));
        } else {
          item.cantidadEntregada = (Number(item.cantidadEntregada) || 0) + cant;
          item.saldoDisponible = item.cantidadEntregada - (Number(item.cantidadConsumida) || 0);
        }
        item.umbralBajo = item.saldoDisponible <= 10;
        this.aplicarFiltro();
        this.cdr.detectChanges();

        this.cerrarModalAjuste();
        this.cargarDatos();

        const accionTxt = this.tipoOperacionAjuste === 'RETIRO'
          ? `Se retiraron ${cant} unidad(es) de ${item.nombre}. Nuevo saldo: ${item.saldoDisponible} uds.`
          : `Se agregaron ${cant} unidad(es) de ${item.nombre}. Nuevo saldo: ${item.saldoDisponible} uds.`;

        Swal.fire({
          icon: 'success',
          title: '¡Ajuste Realizado con Éxito!',
          text: accionTxt,
          confirmButtonColor: '#4141A5'
        });
      },
      error: (err) => {
        this.guardandoAjuste = false;
        Swal.fire({
          icon: 'error',
          title: 'Error al ajustar',
          text: err?.error?.detail || err?.message || 'No se pudo completar el ajuste.',
          confirmButtonColor: '#4141A5'
        });
      }
    });
  }

  cargarCatalogoGeneral(): void {
    this.authService.listarMedicamentos().subscribe({
      next: (res: any) => {
        const datos = Array.isArray(res) ? res : (res?.results || res?.data || []);
        this.catalogoMedicamentos = datos;
      },
      error: () => {}
    });
  }

  abrirModalNuevaSolicitud(idMedPredeterminado?: number): void {
    this.medicamentoSolicitudId = idMedPredeterminado || (this.itemsKit.length > 0 ? this.itemsKit[0].id_medicamento : null);
    this.cantidadSolicitud = 10;
    this.justificacionSolicitud = 'Reposición de existencias para cuota operativa de maletín de campo CBA.';
    this.modalNuevaSolicitudAbierto = true;
  }

  cerrarModalNuevaSolicitud(): void {
    this.modalNuevaSolicitudAbierto = false;
  }

  radicarSolicitudReposicion(): void {
    if (!this.medicamentoSolicitudId || this.cantidadSolicitud <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Datos Incompletos',
        text: 'Por favor selecciona un medicamento y una cantidad mayor a cero.',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    this.guardandoSolicitud = true;

    const payload: SolicitudKitPayload = {
      tipo: 'REPOSICION',
      justificacion: this.justificacionSolicitud.trim() || 'Reposición de medicamentos para kit veterinario',
      items: [
        {
          id_medicamento: Number(this.medicamentoSolicitudId),
          cantidad_solicitada: Number(this.cantidadSolicitud)
        }
      ]
    };

    this.inventoryService.crearSolicitudKit(payload).subscribe({
      next: (resp) => {
        this.guardandoSolicitud = false;
        this.modalNuevaSolicitudAbierto = false;
        Swal.fire({
          icon: 'success',
          title: '¡Solicitud Radicada!',
          text: `La solicitud ante Farmacia CBA ha sido radicada exitosamente bajo el código #${resp?.id_solicitud || ''}.`,
          confirmButtonColor: '#4141A5'
        });
        this.cargarDatos();
      },
      error: (err) => {
        this.guardandoSolicitud = false;
        const msg = err.error?.detail || err.error?.error || err.error?.mensaje || 'Error al radicar la solicitud de reposición.';
        Swal.fire({
          icon: 'error',
          title: 'Error al Radicar',
          text: msg,
          confirmButtonColor: '#4141A5'
        });
      }
    });
  }

}
