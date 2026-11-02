import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import Swal from 'sweetalert2';
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
  id_consulta?: number;
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

  // Modal Rápido de Nuevo Paciente + Tutor (Estilo CP-Vet)
  modalNuevoPacienteAbierto: boolean = false;
  guardandoNuevoPaciente: boolean = false;
  nuevoPaciente = {
    // Tutor
    tutorDocumento: '',
    tutorNombre: '',
    tutorTelefono: '',
    tutorDireccion: '',
    tutorCorreo: '',
    // Mascota
    nombre: '',
    especie: 'Canino',
    raza: 'Mestizo',
    sexo: 'Macho',
    peso: null as number | null,
    color: '',
    microchip: '',
    estadoReproductivo: 'Entero',
    fotoUrl: '',
    // Consulta Inicial
    motivoConsulta: 'Apertura de expediente y consulta médica general',
    estadoGeneral: 'Estable'
  };

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
        id_consulta: h.id_consulta || h.ultima_consulta?.id_consulta || h.consulta?.id_consulta || null,
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
    try {
      sessionStorage.removeItem('acta_edicion_temporal');
      sessionStorage.removeItem('historia_edicion_temporal');
    } catch (e) {}

    // Si tiene id_consulta se usa; si no, preferimos id_animal para que el expediente cargue directamente dicho animal
    const id = historia.id_consulta || historia.id_animal || historia.id_historia;
    this.router.navigate(['/inicio-admin/historia-clinica/editar', id], {
      queryParams: {
        id_consulta: historia.id_consulta || '',
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

  // Métodos del Modal Nuevo Paciente (CP-Vet fast onboarding)
  abrirModalNuevoPaciente(): void {
    this.nuevoPaciente = {
      tutorDocumento: '',
      tutorNombre: '',
      tutorTelefono: '',
      tutorDireccion: '',
      tutorCorreo: '',
      nombre: '',
      especie: 'Canino',
      raza: 'Mestizo',
      sexo: 'Macho',
      peso: null,
      color: '',
      microchip: '',
      estadoReproductivo: 'Entero',
      fotoUrl: '',
      motivoConsulta: 'Apertura de expediente y consulta médica general',
      estadoGeneral: 'Estable'
    };
    this.modalNuevoPacienteAbierto = true;
  }

  cerrarModalNuevoPaciente(): void {
    this.modalNuevoPacienteAbierto = false;
    this.guardandoNuevoPaciente = false;
  }

  guardarNuevoPaciente(): void {
    if (!this.nuevoPaciente.nombre.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Nombre requerido',
        text: 'Por favor ingresa el nombre de la mascota o paciente.',
        confirmButtonColor: '#4141a5'
      });
      return;
    }

    if (!this.nuevoPaciente.tutorNombre.trim() || !this.nuevoPaciente.tutorDocumento.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Datos del tutor requeridos',
        text: 'Ingresa al menos el nombre y documento de identidad del tutor o acudiente.',
        confirmButtonColor: '#4141a5'
      });
      return;
    }

    this.guardandoNuevoPaciente = true;

    const payload = {
      animal: {
        nombre: this.nuevoPaciente.nombre.trim(),
        especie: this.nuevoPaciente.especie,
        raza: this.nuevoPaciente.raza.trim() || 'Mestizo',
        sexo: this.nuevoPaciente.sexo,
        peso: this.nuevoPaciente.peso ? Number(this.nuevoPaciente.peso) : null,
        color: this.nuevoPaciente.color || '',
        microchip: this.nuevoPaciente.microchip || null,
        estado_reproductivo: this.nuevoPaciente.estadoReproductivo,
        fotoUrl: this.nuevoPaciente.fotoUrl || null
      },
      tenedor: {
        documento: this.nuevoPaciente.tutorDocumento.trim(),
        documento_identidad: this.nuevoPaciente.tutorDocumento.trim(),
        nombre: this.nuevoPaciente.tutorNombre.trim(),
        nombre_completo: this.nuevoPaciente.tutorNombre.trim(),
        telefono: this.nuevoPaciente.tutorTelefono.trim(),
        direccion: this.nuevoPaciente.tutorDireccion.trim(),
        correo: this.nuevoPaciente.tutorCorreo.trim(),
        parentesco: 'Tenedor / Propietario'
      },
      anamnesicos: {
        estadoReproductivo: this.nuevoPaciente.estadoReproductivo
      },
      motivoConsulta: this.nuevoPaciente.motivoConsulta.trim() || 'Apertura de expediente clínico',
      examenClinico: {
        condicionCorporal: this.nuevoPaciente.estadoGeneral
      },
      hoja2: {
        diagnosticoPresuntivo: 'Consulta médica general inicial',
        pronostico: 'Favorable'
      },
      hoja3: {
        ingresaCBA: 'NO'
      }
    };

    this.historiaService.crearExpedienteCompleto(payload).subscribe({
      next: (resp) => {
        this.guardandoNuevoPaciente = false;
        this.cerrarModalNuevoPaciente();
        this.cargarHistorias();

        const idTarget = resp?.id_consulta || resp?.id_animal || resp?.animal_id || resp?.historia_id;
        const idAnimal = resp?.id_animal || resp?.animal_id || '';
        const idHistoria = resp?.id_historia || resp?.historia_id || '';
        const idConsulta = resp?.id_consulta || resp?.consulta_id || '';

        Swal.fire({
          icon: 'success',
          title: '¡Paciente registrado!',
          text: `El expediente de ${this.nuevoPaciente.nombre} fue creado con éxito en la base de datos.`,
          confirmButtonColor: '#4141a5',
          showCancelButton: true,
          confirmButtonText: 'Abrir Historia Clínica',
          cancelButtonText: 'Seguir en el listado'
        }).then((res) => {
          if (res.isConfirmed && idTarget) {
            this.router.navigate(['/inicio-admin/historia-clinica/editar', idTarget], {
              queryParams: {
                id_animal: idAnimal,
                id_consulta: idConsulta,
                id_historia: idHistoria,
                nombre: this.nuevoPaciente.nombre,
                foto: this.nuevoPaciente.fotoUrl || ''
              }
            });
          }
        });
      },
      error: (err) => {
        this.guardandoNuevoPaciente = false;
        console.error('Error al registrar paciente:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error al registrar',
          text: err?.error?.detail || err?.message || 'No fue posible registrar el paciente. Verifique su conexión al servidor.',
          confirmButtonColor: '#4141a5'
        });
      }
    });
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
