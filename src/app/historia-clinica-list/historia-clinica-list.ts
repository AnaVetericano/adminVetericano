import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { HistoriaClinicaService } from '../services/historia-clinica.service';
import { environment } from '../../environments/environment';

export interface HistoriaClinicaItem {
  id_historia: number;
  id_animal: number;
  numero_historia: string;
  fecha_apertura: string;
  estado_general: string;
  fecha_ultima_desparasitacion?: string | null;
  producto_desparasitacion?: string;
  vacunas?: string;
  enfermedades_anteriores?: string;
  tratamientos_anteriores?: string;
  evolucion_previa?: string;
  alimentacion?: string;
  estado_reproductivo?: string;
  fecha_ultimo_celo?: string | null;
  fecha_ultimo_parto?: string | null;
  // Campos enriquecidos para la UI
  animal_nombre?: string;
  animal_especie?: string;
  animal_raza?: string;
  animal_foto?: string;
  animal_sexo?: string;
  animal_peso?: number | string | null;
}

@Component({
  selector: 'app-historia-clinica-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historia-clinica-list.html',
  styleUrl: './historia-clinica-list.css'
})
export class HistoriaClinicaListComponent implements OnInit {
  // Lista de historias obtenidas desde el backend
  historias: HistoriaClinicaItem[] = [];
  historiasFiltradas: HistoriaClinicaItem[] = [];

  // Estados de carga e interfaz
  cargando: boolean = true;
  errorCarga: string = '';
  recargando: boolean = false;

  // Filtros y búsqueda
  filtroBusqueda: string = '';
  filtroEstado: string = 'Todos';
  menuFiltroAbierto: boolean = false;
  vistaModo: 'tabla' | 'tarjetas' = 'tabla';

  // Modal de detalle
  modalDetalleAbierto: boolean = false;
  historiaSeleccionada: HistoriaClinicaItem | null = null;

  // Diccionario auxiliar de animales por id_animal
  private mapaAnimales: Map<number, any> = new Map();

  constructor(
    private http: HttpClient,
    private historiaService: HistoriaClinicaService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarHistorias();
  }

  /**
   * Encabezados HTTP con token Bearer
   */
  private get authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return token
      ? new HttpHeaders({
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        })
      : new HttpHeaders({ 'Content-Type': 'application/json' });
  }

  /**
   * Petición HTTP GET al backend para obtener todas las historias clínicas
   * Utiliza el backend desplegado en la nube
   */
  cargarHistorias(): void {
    this.cargando = true;
    this.errorCarga = '';
    this.cdr.detectChanges();

    const urlHistorias = environment.apiUrlHistorias || `${environment.apiUrlClinica}historias/`;

    // Primero precargamos mapa de animales si es posible, luego las historias
    this.precargarDatosAnimales(() => {
      this.http.get<any>(urlHistorias, { headers: this.authHeaders }).subscribe({
        next: (respuesta) => {
          this.procesarRespuestaHistorias(respuesta);
        },
        error: (errFinal) => {
          console.error('Error cargando historias clínicas:', errFinal);
          this.errorCarga = 'No fue posible obtener las historias clínicas desde el servidor en la nube. Verifica tu conexión.';
          this.cargando = false;
          this.recargando = false;
          this.cdr.detectChanges();
        }
      });
    });
  }

  /**
   * Procesa la respuesta del GET (acepta array directo o formato paginado de DRF)
   */
  private procesarRespuestaHistorias(respuesta: any): void {
    let items: any[] = [];
    if (Array.isArray(respuesta)) {
      items = respuesta;
    } else if (Array.isArray(respuesta?.results)) {
      items = respuesta.results;
    } else if (Array.isArray(respuesta?.data)) {
      items = respuesta.data;
    }

    // Mapeo e hidratación con datos de animales si existen
    this.historias = items.map((h: any) => {
      const animalInfo = this.mapaAnimales.get(Number(h.id_animal)) || {};
      return {
        id_historia: h.id_historia,
        id_animal: h.id_animal,
        numero_historia: h.numero_historia || `HC-${h.id_historia}`,
        fecha_apertura: h.fecha_apertura,
        estado_general: h.estado_general || 'Estable',
        fecha_ultima_desparasitacion: h.fecha_ultima_desparasitacion || null,
        producto_desparasitacion: h.producto_desparasitacion || '',
        vacunas: h.vacunas || '',
        enfermedades_anteriores: h.enfermedades_anteriores || '',
        tratamientos_anteriores: h.tratamientos_anteriores || '',
        evolucion_previa: h.evolucion_previa || '',
        alimentacion: h.alimentacion || '',
        estado_reproductivo: h.estado_reproductivo || '',
        fecha_ultimo_celo: h.fecha_ultimo_celo || null,
        fecha_ultimo_parto: h.fecha_ultimo_parto || null,
        // Animal vinculado
        animal_nombre: animalInfo.nombre || h.animal?.nombre || `Animal #${h.id_animal}`,
        animal_especie: animalInfo.especie || h.animal?.especie || 'Desconocida',
        animal_raza: animalInfo.raza || h.animal?.raza || 'Mestizo',
        animal_foto: animalInfo.foto_url || animalInfo.foto || h.animal?.fotoUrl || '',
        animal_sexo: animalInfo.sexo || h.animal?.sexo || '',
        animal_peso: animalInfo.peso ?? h.animal?.peso ?? null
      };
    });

    // Ordenar de más reciente a más antigua
    this.historias.sort((a, b) => {
      const fechaA = new Date(a.fecha_apertura || 0).getTime();
      const fechaB = new Date(b.fecha_apertura || 0).getTime();
      return fechaB - fechaA;
    });

    this.aplicarFiltros();
    this.cargando = false;
    this.recargando = false;
    this.cdr.detectChanges();
  }

  /**
   * Precarga mapa de animales para mostrar nombres y especies reales en la tabla
   */
  private precargarDatosAnimales(callback: () => void): void {
    const urlAnimales = environment.apiUrlAnimales || `${environment.apiBaseUrl}/animales/animales/`;
    this.http.get<any>(urlAnimales, { headers: this.authHeaders }).subscribe({
      next: (resp) => {
        const lista = Array.isArray(resp) ? resp : (resp?.results || []);
        lista.forEach((a: any) => {
          if (a?.id_animal) {
            this.mapaAnimales.set(Number(a.id_animal), {
              nombre: a.nombre,
              especie: a.raza_nombre ? a.raza_nombre : (a.id_raza?.id_especie?.nombre || 'Animal'),
              raza: a.raza_nombre || a.id_raza?.nombre || 'Mestizo',
              foto_url: a.foto_url,
              sexo: a.sexo,
              peso: a.peso
            });
          }
        });
        callback();
      },
      error: () => {
        // Continuar de todos modos si el endpoint de animales no responde
        callback();
      }
    });
  }

  /**
   * Aplica filtros de texto y de estado general
   */
  aplicarFiltros(): void {
    const q = (this.filtroBusqueda || '').trim().toLowerCase();

    this.historiasFiltradas = this.historias.filter((h) => {
      // Coincidencia con estado general
      const coincideEstado =
        this.filtroEstado === 'Todos' ||
        h.estado_general?.toLowerCase() === this.filtroEstado.toLowerCase();

      if (!coincideEstado) return false;

      // Coincidencia con texto de búsqueda
      if (!q) return true;

      const numHist = String(h.numero_historia || '').toLowerCase();
      const idAnimal = String(h.id_animal || '').toLowerCase();
      const nombre = String(h.animal_nombre || '').toLowerCase();
      const especie = String(h.animal_especie || '').toLowerCase();
      const estado = String(h.estado_general || '').toLowerCase();
      const vacunas = String(h.vacunas || '').toLowerCase();
      const producto = String(h.producto_desparasitacion || '').toLowerCase();

      return (
        numHist.includes(q) ||
        idAnimal.includes(q) ||
        nombre.includes(q) ||
        especie.includes(q) ||
        estado.includes(q) ||
        vacunas.includes(q) ||
        producto.includes(q)
      );
    });
  }

  filtrarPorEstado(estado: string): void {
    this.filtroEstado = estado;
    this.menuFiltroAbierto = false;
    this.aplicarFiltros();
  }

  toggleMenuFiltro(): void {
    this.menuFiltroAbierto = !this.menuFiltroAbierto;
  }

  limpiarBusqueda(): void {
    this.filtroBusqueda = '';
    this.aplicarFiltros();
  }

  recargarLista(): void {
    this.recargando = true;
    this.cargarHistorias();
  }

  // Modal de detalle
  abrirModalDetalle(historia: HistoriaClinicaItem): void {
    this.historiaSeleccionada = historia;
    this.modalDetalleAbierto = true;
  }

  cerrarModalDetalle(): void {
    this.modalDetalleAbierto = false;
    this.historiaSeleccionada = null;
  }

  // Navegación
  irAEditar(historia: HistoriaClinicaItem): void {
    const id = historia.id_historia || historia.id_animal;
    this.router.navigate(['/inicio-admin/historia-clinica/editar', id], {
      queryParams: {
        id_animal: historia.id_animal || '',
        id_historia: historia.id_historia || '',
        nombre: historia.animal_nombre || '',
        foto: historia.animal_foto || ''
      }
    });
  }

  irANuevaConsulta(): void {
    this.router.navigate(['/inicio-admin/acta-seres-sintientes']);
  }

  // Estilos de badge para estado general
  obtenerClaseEstado(estado?: string): string {
    const e = (estado || '').toLowerCase().trim();
    if (e.includes('estable')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (e.includes('crítico') || e.includes('critico') || e.includes('grave')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (e.includes('observación') || e.includes('observacion') || e.includes('reservado')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }

  formatearFecha(fechaStr?: string | null): string {
    if (!fechaStr) return 'No registrada';
    try {
      const d = new Date(fechaStr);
      if (isNaN(d.getTime())) return fechaStr;
      return d.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
      });
    } catch {
      return fechaStr;
    }
  }

  formatearFechaHora(fechaStr?: string | null): string {
    if (!fechaStr) return 'No registrada';
    try {
      const d = new Date(fechaStr);
      if (isNaN(d.getTime())) return fechaStr;
      return d.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return fechaStr;
    }
  }
}
