import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { RealtimeEventosService, debouncePorTipo } from '../services/realtime-eventos.service';
import {
  VeterinaryInventoryService,
  VeterinaryKitItem,
  ConsumoValidationResult,
  KitAlertasResponse,
  SolicitudKitPayload
} from '../services/veterinary-inventory.service';
import { AuthService } from '../services/auth';
import { AnimalIconComponent } from '../animal-icon/animal-icon';
import { PageTitleComponent } from '../page-title/page-title';
import { PaginadorComponent, PaginarPipe, TAMANO_PAGINA_PREDETERMINADO } from '../paginador/paginador';

@Component({
  selector: 'app-veterinary-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AnimalIconComponent, PageTitleComponent, PaginadorComponent, PaginarPipe],
  templateUrl: './veterinary-inventory.component.html',
  styleUrl: './veterinary-inventory.component.css'
})
export class VeterinaryInventoryComponent implements OnInit {
  private inventoryService = inject(VeterinaryInventoryService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    inject(RealtimeEventosService)
      .on(['kit.*', 'inventario.movimiento_bodega', 'catalogo.medicamentos_actualizado'])
      .pipe(debouncePorTipo(1000), takeUntilDestroyed())
      .subscribe((ev) => (ev.event_type.startsWith('catalogo.') ? this.cargarCatalogoGeneral() : this.cargarDatos()));
  }

  // Estados de carga y datos
  cargando = true;
  error = '';
  itemsKit: VeterinaryKitItem[] = [];
  itemsFiltrados: VeterinaryKitItem[] = [];
  backendAlertas: KitAlertasResponse | null = null;

  // Filtros
  textoFiltro = '';
  filtroEstado = 'todos'; // todos | bajo | disponible | agotado
  pagina = 1;
  tamanoPagina = TAMANO_PAGINA_PREDETERMINADO;

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
        error: () => {
          this.cargarDatos();
          this.cargarCatalogoGeneral();
        }
      });
    } else {
      this.cargarDatos();
      this.cargarCatalogoGeneral();
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
    this.pagina = 1;
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
        this.aplicarFiltro(false);
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

  aplicarFiltro(reiniciarPagina: boolean = true): void {
    if (reiniciarPagina) this.pagina = 1;
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
      title: 'Alerta de stock bajo',
      html: `
        <p>${item.saldoDisponible === 1 ? 'Queda' : 'Quedan'} ${item.saldoDisponible} ${item.saldoDisponible === 1 ? 'unidad' : 'unidades'} de este producto. Solicite reaprovisionamiento al inventario general.</p>
        <dl class="qa-datos">
          <dt>Producto</dt>
          <dd>${item.nombre}</dd>
          <dt>Presentación</dt>
          <dd>${item.presentacion || 'Unidad de campo'}</dd>
          <dt>Saldo actual</dt>
          <dd><span class="qa-tono">${item.saldoDisponible} ${item.saldoDisponible === 1 ? 'unidad' : 'unidades'}</span></dd>
          <dt>Kit / Lote</dt>
          <dd>${item.lote || 'Kit de Campo'}</dd>
        </dl>
      `,
      confirmButtonText: 'Aceptar'
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
        `No cuenta con suficiente stock en su inventario de campo (Disponibles: ${this.itemSeleccionadoParaConsumo.saldoDisponible}, Solicitados: ${this.cantidadConsumo}). Ajuste la cantidad o utilice una alternativa de medicamento disponible.`;
      
      Swal.fire({
        icon: 'error',
        title: 'Acción bloqueada',
        text: mensaje,
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    const item = this.itemSeleccionadoParaConsumo;
    const cant = Number(this.cantidadConsumo);

    Swal.fire({
      title: 'Confirmar formulación o consumo',
      html: `
        <dl class="qa-datos">
          <dt>Medicamento</dt>
          <dd>${item.nombre}</dd>
          <dt>Consumo a registrar</dt>
          <dd>${cant} ${cant === 1 ? 'unidad' : 'unidades'}</dd>
          <dt>Saldo actual en maletín</dt>
          <dd>${item.saldoDisponible} ${item.saldoDisponible === 1 ? 'unidad' : 'unidades'}</dd>
          <dt>Nuevo saldo</dt>
          <dd>${item.saldoDisponible - cant} ${(item.saldoDisponible - cant) === 1 ? 'unidad' : 'unidades'}</dd>
        </dl>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Registrar consumo',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (!res.isConfirmed) return;

      this.guardandoConsumo = true;
      this.inventoryService.registrarConsumo(item.id_medicamento, cant, this.observacionesConsumo).subscribe({
        next: (resultado) => {
          this.guardandoConsumo = false;
          if (resultado.estado === 'CONFIRMADO') {
            this.cargarDatos();
            this.cerrarModalConsumo();

            Swal.fire({
              icon: 'success',
              title: 'Consumo registrado',
              text: `Se ${cant === 1 ? 'descontó' : 'descontaron'} ${cant} ${cant === 1 ? 'unidad' : 'unidades'} de ${item.nombre} del inventario de campo.`,
              confirmButtonText: 'Aceptar'
            });
          } else if (resultado.estado === 'PENDIENTE') {
            // Registro local conservado, pero sin confirmación del servidor: nunca se muestra como éxito
            this.cargarDatos();
            this.cerrarModalConsumo();

            Swal.fire({
              icon: 'warning',
              title: 'Consumo pendiente de sincronizar',
              text: resultado.mensaje,
              confirmButtonText: 'Aceptar'
            });
          } else {
            Swal.fire({
              icon: 'error',
              title: 'No fue posible registrar el consumo',
              text: resultado.mensaje || 'Verifique los datos e intente nuevamente.',
              confirmButtonText: 'Aceptar'
            });
          }
        },
        error: (err) => {
          this.guardandoConsumo = false;
          console.error(err);
          Swal.fire({
            icon: 'error',
            title: 'Error de comunicación',
            text: 'Verifique la conexión e intente nuevamente.',
            confirmButtonText: 'Aceptar'
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
      Swal.fire({ icon: 'warning', title: 'Cantidad inválida', text: 'La cantidad debe ser mayor a 0.', confirmButtonText: 'Aceptar' });
      return;
    }

    if (this.tipoOperacionAjuste === 'RETIRO' && cant > item.saldoDisponible) {
      Swal.fire({
        icon: 'error',
        title: 'Cantidad superior al saldo',
        text: `No es posible retirar ${cant} ${cant === 1 ? 'unidad' : 'unidades'} porque solo hay ${item.saldoDisponible} ${item.saldoDisponible === 1 ? 'unidad disponible' : 'unidades disponibles'} en el maletín.`,
        confirmButtonText: 'Aceptar'
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
        this.aplicarFiltro(false);
        this.cdr.detectChanges();

        this.cerrarModalAjuste();
        this.cargarDatos();

        const accionTxt = this.tipoOperacionAjuste === 'RETIRO'
          ? `Se ${cant === 1 ? 'retiró' : 'retiraron'} ${cant} ${cant === 1 ? 'unidad' : 'unidades'} de ${item.nombre}. Nuevo saldo: ${item.saldoDisponible} ${item.saldoDisponible === 1 ? 'unidad' : 'unidades'}.`
          : `Se ${cant === 1 ? 'agregó' : 'agregaron'} ${cant} ${cant === 1 ? 'unidad' : 'unidades'} de ${item.nombre}. Nuevo saldo: ${item.saldoDisponible} ${item.saldoDisponible === 1 ? 'unidad' : 'unidades'}.`;

        Swal.fire({
          icon: 'success',
          title: 'Ajuste registrado',
          text: accionTxt,
          confirmButtonText: 'Aceptar'
        });
      },
      error: (err) => {
        this.guardandoAjuste = false;
        Swal.fire({
          icon: 'error',
          title: 'No fue posible completar el ajuste',
          text: err?.error?.detail || err?.message || 'Verifique los datos e intente nuevamente.',
          confirmButtonText: 'Aceptar'
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
        title: 'Campos obligatorios incompletos',
        text: 'Seleccione un medicamento y una cantidad mayor a cero.',
        confirmButtonText: 'Aceptar'
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
          title: 'Solicitud radicada',
          text: `La solicitud ante Farmacia CBA fue radicada bajo el código #${resp?.id_solicitud || ''}.`,
          confirmButtonText: 'Aceptar'
        });
        this.cargarDatos();
      },
      error: (err) => {
        this.guardandoSolicitud = false;
        const msg = err.error?.detail || err.error?.error || err.error?.mensaje || 'No fue posible radicar la solicitud de reposición.';
        Swal.fire({
          icon: 'error',
          title: 'No fue posible radicar la solicitud',
          text: msg,
          confirmButtonText: 'Aceptar'
        });
      }
    });
  }

}
