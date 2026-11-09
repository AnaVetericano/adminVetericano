import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, inject } from '@angular/core';
import { Chart } from 'chart.js/auto';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth';
import {
  VeterinaryInventoryService,
  KitAlertasResponse,
  KitResponseItem,
  KitItemLote,
  SolicitudKitPayload
} from '../services/veterinary-inventory.service';

export interface PeticionItem {
  id_peticion: number;
  numero_radicado?: string;
  tipo?: string;
  estado?: string;
  descripcion?: string;
  prioridad?: string;
  fecha?: string;
  fecha_asignacion?: string;
  asignado_a_nombre?: string;
  asignado_a_apellido?: string;
  ubicacion_direccion?: string;
  ubicacion_latitud?: number;
  ubicacion_longitud?: number;
  foto?: string;
  fotos?: string[];
  total_fotos?: number;
  [key: string]: any;
}

export interface MedicamentoMaletinUI {
  id_medicamento: number;
  nombre: string;
  descripcion?: string;
  tipo?: string;
  presentacion?: string;
  via_administracion?: string;
  saldo_disponible: number;
  saldo_vencido: number;
  lotes: KitItemLote[];
  nivelStock: 'OPTIMO' | 'BAJO' | 'CRITICO' | 'AGOTADO';
  tieneVencidos: boolean;
  proximoAVencer: boolean;
}

@Component({
  selector: 'app-dashboard-veterinario',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard-veterinario.html',
  styleUrl: './dashboard-veterinario.css'
})
export class DashboardVeterinarioComponent implements OnInit, OnDestroy {
  @ViewChild('chartPeticiones') chartPeticionesRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartTipos') chartTiposRef!: ElementRef<HTMLCanvasElement>;

  private chartPeticiones?: Chart;
  private chartTipos?: Chart;
  distribucionEstados: { [key: string]: number } = {};
  distribucionTipos: { [key: string]: number } = {};
  public authService = inject(AuthService);
  public inventoryService = inject(VeterinaryInventoryService);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Pestaña activa principal: 'peticiones' | 'maletin' | 'solicitudes'
  pestanaActiva: 'peticiones' | 'maletin' | 'solicitudes' = 'peticiones';

  // Datos del Veterinario
  veterinarioNombre = '';
  veterinarioId = 0;
  saludoHorario = '';

  // Estados de Carga
  cargandoPeticiones = false;
  cargandoMaletin = false;
  cargandoSolicitudes = false;
  errorPeticiones = '';
  errorMaletin = '';

  // --------------------------------------------------------------------------
  // ÁREA A: PETICIONES ASIGNADAS
  // --------------------------------------------------------------------------
  peticiones: PeticionItem[] = [];
  peticionesFiltradas: PeticionItem[] = [];
  filtroEstadoPeticion: 'TODAS' | 'URGENTES' | 'PENDIENTES' | 'PROCESO' | 'ATENDIDAS' = 'TODAS';
  busquedaPeticion = '';

  // Métricas de Peticiones
  totalAsignadas = 0;
  totalPendientes = 0;
  totalEnProceso = 0;
  totalAtendidas = 0;
  totalUrgentes = 0;

  // Modal Detalle de Petición
  modalDetalleAbierto = false;
  peticionSeleccionada: PeticionItem | null = null;
  cargandoDetalle = false;

  // Modal Cambiar Estado
  modalEstadoAbierto = false;
  nuevoEstadoSeleccionado = '';
  observacionCambioEstado = '';
  guardandoEstado = false;
  estadosPosibles: string[] = [
    'En revisión',
    'Asignada',
    'En proceso',
    'En tratamiento',
    'En observación',
    'Atendida',
    'Finalizada',
    'Alta médica'
  ];

  // --------------------------------------------------------------------------
  // ÁREA B: MEDICAMENTOS Y MALETÍN VETERINARIO (CAMPANITA DE NOTIFICACIONES)
  // --------------------------------------------------------------------------
  panelAlertasAbierto = false;
  medicamentosMaletin: MedicamentoMaletinUI[] = [];
  medicamentosFiltrados: MedicamentoMaletinUI[] = [];
  alertasKit: KitAlertasResponse | null = null;
  filtroStockMaletin: 'TODOS' | 'ALERTAS' | 'BAJO' | 'AGOTADOS' | 'OPTIMOS' = 'TODOS';
  busquedaMedicamento = '';

  // Métricas del Maletín
  totalMedicamentosMaletin = 0;
  totalUnidadesDisponibles = 0;
  totalCriticosStock = 0;
  totalAgotados = 0;
  totalVencidos = 0;
  totalProximosVencer = 0;

  get medicamentosConAlerta(): MedicamentoMaletinUI[] {
    return this.medicamentosMaletin.filter(m =>
      m.nivelStock === 'AGOTADO' ||
      m.nivelStock === 'CRITICO' ||
      m.nivelStock === 'BAJO' ||
      m.tieneVencidos ||
      m.proximoAVencer
    );
  }

  get totalMedicamentosConAlerta(): number {
    return this.medicamentosConAlerta.length;
  }

  togglePanelAlertas(): void {
    this.panelAlertasAbierto = !this.panelAlertasAbierto;
  }

  cerrarPanelAlertas(): void {
    this.panelAlertasAbierto = false;
  }

  verMedicamentoEnMaletin(m: MedicamentoMaletinUI): void {
    this.panelAlertasAbierto = false;
    this.pestanaActiva = 'maletin';
    this.busquedaMedicamento = m.nombre;
    this.filtroStockMaletin = 'TODOS';
    this.filtrarMaletin();
  }

  solicitarReposicionDesdeAlerta(m: MedicamentoMaletinUI): void {
    this.panelAlertasAbierto = false;
    this.abrirModalNuevaSolicitud(m.id_medicamento);
  }

  obtenerDescripcionAlerta(m: MedicamentoMaletinUI): string {
    if (m.nivelStock === 'AGOTADO') {
      return 'Este medicamento no tiene unidades disponibles en tu maletín. Puedes solicitar su reposición a farmacia.';
    }
    if (m.tieneVencidos) {
      return 'Presenta lotes con fecha de vencimiento cumplida. Requiere gestión de reposición y retiro.';
    }
    if (m.proximoAVencer) {
      return 'Presenta lotes próximos a vencer dentro del rango preventivo de 30 días.';
    }
    return 'Las existencias de este medicamento están por debajo del nivel establecido. Se recomienda solicitar reposición.';
  }

  // Catálogo completo de fármacos para selector de solicitudes
  catalogoMedicamentos: any[] = [];

  // --------------------------------------------------------------------------
  // ÁREA C: SOLICITUDES DE REPOSICIÓN ANTE FARMACIA CBA
  // --------------------------------------------------------------------------
  solicitudesKit: any[] = [];
  solicitudesFiltradas: any[] = [];
  filtroEstadoSolicitud: 'TODAS' | 'PENDIENTES' | 'APROBADAS' | 'ENTREGADAS' = 'TODAS';

  // Modal de Solicitudes a Farmacia CBA (Ventana Flotante)
  modalSolicitudesAbierto = false;

  abrirModalSolicitudes(): void {
    this.modalSolicitudesAbierto = true;
    if (this.solicitudesKit.length === 0) {
      this.cargarSolicitudes();
    }
  }

  cerrarModalSolicitudes(): void {
    this.modalSolicitudesAbierto = false;
  }

  // Modal Nueva Solicitud
  modalNuevaSolicitudAbierto = false;
  medicamentoSolicitudId: number | null = null;
  cantidadSolicitud: number = 5;
  justificacionSolicitud: string = 'Reposición de existencias para cuota operativa de maletín de campo CBA.';
  guardandoSolicitud = false;

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  
  trackByPeticionId(index: number, item: PeticionItem): any {
    return item.id_peticion || index;
  }

  trackByMedicamentoId(index: number, item: MedicamentoMaletinUI): any {
    return item.id_medicamento || index;
  }

  ngOnInit(): void {
    this.establecerDatosVeterinario();
    this.cargarDashboardCompleto();
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'maletin') {
        this.pestanaActiva = 'maletin';
        if (params['buscar']) {
          this.busquedaMedicamento = params['buscar'];
          this.filtroStockMaletin = 'TODOS';
          this.filtrarMaletin();
        }
      }
    });
  }

  establecerDatosVeterinario(): void {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) {
      this.saludoHorario = 'Buenos días';
    } else if (hora >= 12 && hora < 19) {
      this.saludoHorario = 'Buenas tardes';
    } else {
      this.saludoHorario = 'Buenas noches';
    }

    const sesion: any = this.authService.currentUser();
    const nombre = sesion?.nombre || sesion?.first_name || '';
    const apellido = sesion?.apellido || sesion?.last_name || '';
    this.veterinarioNombre = `${nombre} ${apellido}`.trim() || 'Médico Veterinario';
    this.veterinarioId = this.inventoryService.getVeterinarioLogueadoId();
  }

  cambiarPestana(pestana: 'peticiones' | 'maletin' | 'solicitudes'): void {
    if (pestana === 'solicitudes') {
      this.abrirModalSolicitudes();
      return;
    }
    this.pestanaActiva = pestana;
    if (pestana === 'peticiones') {
      setTimeout(() => {
        if (!this.chartPeticiones) {
          this.construirGraficas();
        } else {
          this.chartPeticiones.resize();
          this.chartTipos?.resize();
        }
      }, 40);
    } else if (pestana === 'maletin' && this.medicamentosMaletin.length === 0) {
      this.cargarDatosMaletin();
    }
  }

  
  ngOnDestroy(): void {
    this.destruirGraficas();
  }

  destruirGraficas(): void {
    if (this.chartPeticiones) {
      this.chartPeticiones.destroy();
      this.chartPeticiones = undefined;
    }
    if (this.chartTipos) {
      this.chartTipos.destroy();
      this.chartTipos = undefined;
    }
  }

  construirGraficas(): void {
    this.destruirGraficas();
    this.crearGraficaPeticiones();
    this.crearGraficaTipos();
  }

  crearGraficaPeticiones(): void {
    if (!this.chartPeticionesRef?.nativeElement) return;
    const ctx = this.chartPeticionesRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const estadosKeys = Object.keys(this.distribucionEstados);
    const labels = estadosKeys.length > 0 ? estadosKeys : ['Pendientes', 'En Proceso', 'Atendidas'];
    const data = estadosKeys.length > 0
      ? Object.values(this.distribucionEstados)
      : [this.totalPendientes, this.totalEnProceso, this.totalAtendidas];

    // Mapeo semántico de colores con acentos de la paleta oficial
    const backgroundColors = labels.map(lbl => {
      const lower = lbl.toLowerCase();
      if (lower.includes('urgent') || lower.includes('crit')) return '#D92D20'; // Acento Crítico
      if (lower.includes('pend') || lower.includes('atender')) return '#DC6803'; // Acento Preventivo
      if (lower.includes('proceso') || lower.includes('tratam')) return '#2E90FA'; // Acento Informativo
      if (lower.includes('atendid') || lower.includes('finaliz') || lower.includes('alta') || lower.includes('resuelt')) return '#12B76A'; // Acento Exitoso
      return '#667085'; // Acento Neutro
    });

    this.chartPeticiones = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: backgroundColors,
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              font: { family: 'Nunito', size: 12, weight: 'bold' },
              color: '#475569'
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const total = context.dataset.data.reduce((a: any, b: any) => Number(a) + Number(b), 0);
                const valor = Number(context.raw || 0);
                const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
                return ` ${context.label}: ${valor} casos (${pct}%)`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });
  }

  crearGraficaTipos(): void {
    if (!this.chartTiposRef?.nativeElement) return;
    const ctx = this.chartTiposRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const tiposKeys = Object.keys(this.distribucionTipos);
    const labels = tiposKeys.length > 0 ? tiposKeys : ['Urgencias', 'Atención Estándar'];
    const data = tiposKeys.length > 0
      ? Object.values(this.distribucionTipos)
      : [this.totalUrgentes, Math.max(0, this.totalAsignadas - this.totalUrgentes)];

    const standardPalette = ['#4141A5', '#170B3D', '#2E90FA', '#667085', '#344054'];
    let stdIndex = 0;
    const backgroundColorsTipos = labels.map(lbl => {
      const lower = lbl.toLowerCase();
      if (lower.includes('urgent') || lower.includes('crític') || lower.includes('critic')) {
        return '#D92D20'; // Acento Crítico correspondiente a Urgencias
      }
      const color = standardPalette[stdIndex % standardPalette.length];
      stdIndex++;
      return color;
    });

    this.chartTipos = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: backgroundColorsTipos,
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              font: { family: 'Nunito', size: 12, weight: 'bold' },
              color: '#475569'
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const total = context.dataset.data.reduce((a: any, b: any) => Number(a) + Number(b), 0);
                const valor = Number(context.raw || 0);
                const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
                return ` ${context.label}: ${valor} casos (${pct}%)`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });
  }

  cargarDashboardCompleto(): void {
    this.cargarPeticiones();
    this.cargarDatosMaletin();
    this.cargarSolicitudes();
    this.cargarCatalogoGeneral();
  }

  // ==========================================================================
  // LÓGICA DE PETICIONES ASIGNADAS
  // ==========================================================================

  cargarPeticiones(): void {
    this.cargandoPeticiones = true;
    this.errorPeticiones = '';
    const url = `${environment.apiBaseUrl}/peticiones/listar/`;

    this.http.get<any>(url, { headers: this.getAuthHeaders() }).subscribe({
      next: (res) => {
        const datos = Array.isArray(res) ? res : (res?.results || res?.data || []);
        this.peticiones = datos;
        this.calcularMetricasPeticiones();
        this.filtrarPeticiones();
        this.cargandoPeticiones = false;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.construirGraficas();
        }, 120);
      },
      error: (err) => {
        this.cargandoPeticiones = false;
        this.errorPeticiones = 'No se pudieron consultar las peticiones asignadas.';
        this.cdr.detectChanges();
      }
    });
  }

  calcularMetricasPeticiones(): void {
    this.totalAsignadas = this.peticiones.length;

    this.totalPendientes = this.peticiones.filter(p => {
      const st = (p.estado || '').toLowerCase();
      return st.includes('asignad') || st.includes('revis') || st.includes('evalua') || st.includes('pendiente') || st.includes('borrador');
    }).length;

    this.totalEnProceso = this.peticiones.filter(p => {
      const st = (p.estado || '').toLowerCase();
      return (st.includes('proceso') || st.includes('tratam') || st.includes('observaci') || st.includes('curso') || st.includes('seguimiento')) && !st.includes('atendid') && !st.includes('finaliz');
    }).length;

    this.totalAtendidas = this.peticiones.filter(p => {
      const st = (p.estado || '').toLowerCase();
      return st.includes('atendid') || st.includes('finaliz') || st.includes('alta') || st.includes('resuelt') || st.includes('cerrad');
    }).length;

    this.totalUrgentes = this.peticiones.filter(p => this.esUrgente(p)).length;

    // Distribución para gráficas redondas en tonos azules
    this.distribucionEstados = {};
    this.distribucionTipos = {};
    for (const p of this.peticiones) {
      const st = (p.estado || 'Asignada').trim();
      this.distribucionEstados[st] = (this.distribucionEstados[st] || 0) + 1;
      const tp = (p.tipo || 'General').trim();
      this.distribucionTipos[tp] = (this.distribucionTipos[tp] || 0) + 1;
    }
  }

  filtrarPeticiones(): void {
    let lista = [...this.peticiones];

    // Filtro por Estado
    if (this.filtroEstadoPeticion === 'URGENTES') {
      lista = lista.filter(p => this.esUrgente(p));
    } else if (this.filtroEstadoPeticion === 'PENDIENTES') {
      lista = lista.filter(p => {
        const st = (p.estado || '').toLowerCase();
        return st.includes('asignad') || st.includes('revis') || st.includes('evalua') || st.includes('pendiente') || st.includes('borrador');
      });
    } else if (this.filtroEstadoPeticion === 'PROCESO') {
      lista = lista.filter(p => {
        const st = (p.estado || '').toLowerCase();
        return (st.includes('proceso') || st.includes('tratam') || st.includes('observaci') || st.includes('curso')) && !st.includes('atendid') && !st.includes('finaliz');
      });
    } else if (this.filtroEstadoPeticion === 'ATENDIDAS') {
      lista = lista.filter(p => {
        const st = (p.estado || '').toLowerCase();
        return st.includes('atendid') || st.includes('finaliz') || st.includes('alta') || st.includes('resuelt');
      });
    }

    // Buscador
    const q = this.busquedaPeticion.trim().toLowerCase();
    if (q) {
      lista = lista.filter(p =>
        (p.numero_radicado || '').toLowerCase().includes(q) ||
        (p.descripcion || '').toLowerCase().includes(q) ||
        (p.tipo || '').toLowerCase().includes(q) ||
        (p.ubicacion_direccion || '').toLowerCase().includes(q) ||
        (p.estado || '').toLowerCase().includes(q)
      );
    }

    // Ordenar: urgentes primero, luego más recientes
    lista.sort((a, b) => {
      const aUrg = this.esUrgente(a) ? 1 : 0;
      const bUrg = this.esUrgente(b) ? 1 : 0;
      if (aUrg !== bUrg) return bUrg - aUrg;
      return (b.id_peticion || 0) - (a.id_peticion || 0);
    });

    this.peticionesFiltradas = lista;
  }

  setFiltroPeticion(filtro: 'TODAS' | 'URGENTES' | 'PENDIENTES' | 'PROCESO' | 'ATENDIDAS'): void {
    this.filtroEstadoPeticion = filtro;
    this.filtrarPeticiones();
  }

  esUrgente(p: PeticionItem): boolean {
    const pr = (p.prioridad || '').toLowerCase();
    const st = (p.estado || '').toLowerCase();
    return pr.includes('urgent') || pr.includes('alta') || pr.includes('critica') || pr.includes('emergencia') || st.includes('urgent');
  }

  obtenerClaseBadgeEstado(estado?: string): string {
    const st = (estado || '').toLowerCase();
    if (st.includes('finaliz') || st.includes('atendid') || st.includes('alta') || st.includes('resuelt')) {
      return 'badge-status-success';
    }
    if (st.includes('proceso') || st.includes('tratam') || st.includes('curso')) {
      return 'badge-status-info';
    }
    if (st.includes('observaci') || st.includes('evalua')) {
      return 'badge-status-info';
    }
    if (st.includes('asignad') || st.includes('revis') || st.includes('pendiente')) {
      return 'badge-status-warning';
    }
    return 'badge-status-neutral';
  }

  obtenerClaseBadgePrioridad(prioridad?: string): string {
    const pr = (prioridad || '').toLowerCase();
    if (pr.includes('urgent') || pr.includes('alta') || pr.includes('critica') || pr.includes('emergencia')) {
      return 'badge-status-critical font-black animate-pulse';
    }
    if (pr.includes('media')) {
      return 'badge-status-warning';
    }
    return 'badge-status-neutral';
  }

  abrirDetallePeticion(p: PeticionItem): void {
    this.peticionSeleccionada = p;
    this.modalDetalleAbierto = true;
    this.cargandoDetalle = true;

    // Consultar detalle completo por si trae coordenadas, historial o evidencias adicionales
    const url = `${environment.apiBaseUrl}/peticiones/${p.id_peticion}/`;
    this.http.get<any>(url, { headers: this.getAuthHeaders() }).subscribe({
      next: (detalle) => {
        this.peticionSeleccionada = { ...p, ...detalle };
        this.cargandoDetalle = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoDetalle = false;
        this.cdr.detectChanges();
      }
    });
  }

  cerrarModalDetalle(): void {
    this.modalDetalleAbierto = false;
    this.peticionSeleccionada = null;
  }

  abrirModalCambiarEstado(p: PeticionItem): void {
    this.peticionSeleccionada = p;
    this.nuevoEstadoSeleccionado = p.estado || 'En proceso';
    this.observacionCambioEstado = '';
    this.modalEstadoAbierto = true;
  }

  cerrarModalCambiarEstado(): void {
    this.modalEstadoAbierto = false;
  }

  guardarCambioEstado(): void {
    if (!this.peticionSeleccionada || !this.nuevoEstadoSeleccionado) return;
    this.guardandoEstado = true;

    const url = `${environment.apiBaseUrl}/peticiones/${this.peticionSeleccionada.id_peticion}/estado/`;
    const payload = {
      estado: this.nuevoEstadoSeleccionado,
      observacion: this.observacionCambioEstado || `Actualización de estado operativo a ${this.nuevoEstadoSeleccionado}`
    };

    this.http.patch(url, payload, { headers: this.getAuthHeaders() }).subscribe({
      next: () => {
        this.guardandoEstado = false;
        this.modalEstadoAbierto = false;
        if (this.peticionSeleccionada) {
          this.peticionSeleccionada.estado = this.nuevoEstadoSeleccionado;
        }
        Swal.fire({
          icon: 'success',
          title: 'Estado Actualizado',
          text: `La petición #${this.peticionSeleccionada?.id_peticion} ahora está en '${this.nuevoEstadoSeleccionado}'.`,
          confirmButtonColor: '#4141A5'
        });
        this.cargarPeticiones();
      },
      error: (err) => {
        this.guardandoEstado = false;
        const msg = err.error?.detail || err.error?.error || 'No se pudo actualizar el estado de la petición.';
        Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#4141A5' });
      }
    });
  }

  irAHistoriaClinica(p: PeticionItem): void {
    this.cerrarModalDetalle();
    this.router.navigate(['/inicio-admin/acta-seres-sintientes'], {
      queryParams: {
        peticion_id: p.id_peticion,
        radicado: p.numero_radicado || `PET-${p.id_peticion}`
      }
    });
  }

  // ==========================================================================
  // LÓGICA DE MALETÍN Y MEDICAMENTOS
  // ==========================================================================

  cargarDatosMaletin(): void {
    this.cargandoMaletin = true;
    this.errorMaletin = '';

    // Cargar mi kit asignado
    this.inventoryService.obtenerMiKit().subscribe({
      next: (resp) => {
        const items = resp.items || [];
        this.totalUnidadesDisponibles = resp.total_unidades || 0;

        // Cargar alertas oficiales del backend
        this.inventoryService.obtenerAlertasKit().subscribe({
          next: (alertas) => {
            this.alertasKit = alertas;
            this.procesarItemsMaletin(items, alertas);
            this.cargandoMaletin = false;
            this.cdr.detectChanges();
          },
          error: () => {
            this.procesarItemsMaletin(items, null);
            this.cargandoMaletin = false;
            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        this.cargandoMaletin = false;
        this.errorMaletin = 'No se pudo cargar el inventario del maletín.';
        this.cdr.detectChanges();
      }
    });
  }

  procesarItemsMaletin(items: KitResponseItem[], alertas: KitAlertasResponse | null): void {
    const setAgotados = new Set((alertas?.agotados || []).map(a => a.id_medicamento));
    const setCriticos = new Set((alertas?.criticos || []).map(a => a.id_medicamento));
    const setBajos = new Set((alertas?.bajos || []).map(a => a.id_medicamento));
    const setVencidos = new Set((alertas?.vencidos || []).map(a => a.id_medicamento));
    const setProximos = new Set((alertas?.proximos_a_vencer || []).map(a => a.id_medicamento));

    this.medicamentosMaletin = items.map(it => {
      const saldo = it.saldo_disponible || 0;
      let nivel: 'OPTIMO' | 'BAJO' | 'CRITICO' | 'AGOTADO' = 'OPTIMO';

      if (saldo === 0 || setAgotados.has(it.id_medicamento)) {
        nivel = 'AGOTADO';
      } else if (setCriticos.has(it.id_medicamento) || saldo <= 5) {
        nivel = 'CRITICO';
      } else if (setBajos.has(it.id_medicamento) || saldo <= 10) {
        nivel = 'BAJO';
      }

      // Buscar detalles en catálogo si están disponibles
      const infoCat = this.catalogoMedicamentos.find(c => Number(c.id_medicamento || c.id) === it.id_medicamento);

      return {
        id_medicamento: it.id_medicamento,
        nombre: it.nombre,
        descripcion: infoCat?.descripcion || '',
        tipo: infoCat?.tipo || 'Medicamento',
        presentacion: infoCat?.presentacion || infoCat?.via || '',
        via_administracion: infoCat?.via_administracion || infoCat?.via || 'Vía médica',
        saldo_disponible: saldo,
        saldo_vencido: it.saldo_vencido || 0,
        lotes: it.lotes || [],
        nivelStock: nivel,
        tieneVencidos: setVencidos.has(it.id_medicamento) || (it.saldo_vencido || 0) > 0,
        proximoAVencer: setProximos.has(it.id_medicamento)
      };
    });

    this.totalMedicamentosMaletin = this.medicamentosMaletin.length;
    this.totalAgotados = this.medicamentosMaletin.filter(m => m.nivelStock === 'AGOTADO').length;
    this.totalCriticosStock = this.medicamentosMaletin.filter(m => m.nivelStock === 'CRITICO' || m.nivelStock === 'BAJO').length;
    this.totalVencidos = alertas?.vencidos?.length || this.medicamentosMaletin.filter(m => m.tieneVencidos).length;
    this.totalProximosVencer = alertas?.proximos_a_vencer?.length || this.medicamentosMaletin.filter(m => m.proximoAVencer).length;

    this.filtrarMaletin();
    this.inventoryService.setAlertasMaletin(this.medicamentosConAlerta);
  }

  filtrarMaletin(): void {
    let lista = [...this.medicamentosMaletin];

    // Filtro por Nivel de Stock
    if (this.filtroStockMaletin === 'ALERTAS') {
      lista = lista.filter(m => m.nivelStock !== 'OPTIMO' || m.tieneVencidos || m.proximoAVencer);
    } else if (this.filtroStockMaletin === 'BAJO') {
      lista = lista.filter(m => m.nivelStock === 'BAJO' || m.nivelStock === 'CRITICO');
    } else if (this.filtroStockMaletin === 'AGOTADOS') {
      lista = lista.filter(m => m.nivelStock === 'AGOTADO');
    } else if (this.filtroStockMaletin === 'OPTIMOS') {
      lista = lista.filter(m => m.nivelStock === 'OPTIMO');
    }

    // Buscador
    const q = this.busquedaMedicamento.trim().toLowerCase();
    if (q) {
      lista = lista.filter(m =>
        m.nombre.toLowerCase().includes(q) ||
        (m.tipo || '').toLowerCase().includes(q) ||
        (m.presentacion || '').toLowerCase().includes(q)
      );
    }

    // Ordenar: Agotados y críticos primero
    lista.sort((a, b) => {
      const rank = (m: MedicamentoMaletinUI) => {
        if (m.nivelStock === 'AGOTADO') return 1;
        if (m.nivelStock === 'CRITICO') return 2;
        if (m.nivelStock === 'BAJO') return 3;
        return 4;
      };
      return rank(a) - rank(b);
    });

    this.medicamentosFiltrados = lista;
  }

  setFiltroStock(filtro: 'TODOS' | 'ALERTAS' | 'BAJO' | 'AGOTADOS' | 'OPTIMOS'): void {
    this.filtroStockMaletin = filtro;
    this.filtrarMaletin();
  }

  // ==========================================================================
  // LÓGICA DE SOLICITUDES DE REPOSICIÓN
  // ==========================================================================

  cargarSolicitudes(): void {
    this.cargandoSolicitudes = true;
    this.inventoryService.obtenerSolicitudesKit().subscribe({
      next: (resp) => {
        const lista = Array.isArray(resp) ? resp : (resp?.results || resp?.data || []);
        this.solicitudesKit = lista;
        this.filtrarSolicitudes();
        this.cargandoSolicitudes = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoSolicitudes = false;
        this.cdr.detectChanges();
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

  filtrarSolicitudes(): void {
    let lista = [...this.solicitudesKit];

    if (this.filtroEstadoSolicitud === 'PENDIENTES') {
      lista = lista.filter(s => (s.estado || '').toUpperCase() === 'PENDIENTE');
    } else if (this.filtroEstadoSolicitud === 'APROBADAS') {
      lista = lista.filter(s => (s.estado || '').toUpperCase() === 'APROBADA');
    } else if (this.filtroEstadoSolicitud === 'ENTREGADAS') {
      lista = lista.filter(s => (s.estado || '').toUpperCase() === 'ENTREGADA');
    }

    lista.sort((a, b) => (b.id_solicitud || 0) - (a.id_solicitud || 0));
    this.solicitudesFiltradas = lista;
  }

  setFiltroSolicitud(filtro: 'TODAS' | 'PENDIENTES' | 'APROBADAS' | 'ENTREGADAS'): void {
    this.filtroEstadoSolicitud = filtro;
    this.filtrarSolicitudes();
  }

  abrirModalNuevaSolicitud(idMedPredeterminado?: number): void {
    this.medicamentoSolicitudId = idMedPredeterminado || (this.medicamentosMaletin.length > 0 ? this.medicamentosMaletin[0].id_medicamento : null);
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
        this.cargarSolicitudes();
        this.cargarDatosMaletin();
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

  cancelarSolicitud(s: any): void {
    const id = s.id_solicitud;
    Swal.fire({
      title: '¿Cancelar Solicitud?',
      text: `¿Deseas cancelar la solicitud #${id}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'Volver',
      confirmButtonColor: '#D92D20',
      cancelButtonColor: '#667085'
    }).then(res => {
      if (res.isConfirmed) {
        this.inventoryService.cancelarSolicitudKit(id).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Solicitud Cancelada',
              text: `La solicitud #${id} ha sido cancelada.`,
              confirmButtonColor: '#4141A5'
            });
            this.cargarSolicitudes();
          },
          error: (err) => {
            const msg = err.error?.detail || err.error?.error || 'No se pudo cancelar la solicitud.';
            Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#4141A5' });
          }
        });
      }
    });
  }

  obtenerClaseBadgeSolicitud(estado?: string): string {
    const st = (estado || '').toUpperCase();
    if (st.includes('ENTREG') || st.includes('APROB')) {
      return 'badge-status-success';
    }
    if (st.includes('PEND')) {
      return 'badge-status-warning';
    }
    if (st.includes('RECHAZ') || st.includes('CANCEL')) {
      return 'badge-status-critical';
    }
    return 'badge-status-neutral';
  }
}
