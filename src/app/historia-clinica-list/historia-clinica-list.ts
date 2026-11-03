import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { HistoriaClinicaService } from '../services/historia-clinica.service';
import { environment, BACKEND_CLOUD_URL } from '../../environments/environment';

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

  // Modal de detalle y Línea de Tiempo (Estilo CP-Vet)
  modalDetalleAbierto: boolean = false;
  historiaSeleccionada: HistoriaClinicaItem | null = null;
  pestanaDetalle: 'historial' | 'consultas' | 'evolucion' | 'formulas' | 'examenes' | 'imagenes' | 'vacunas' | 'desp' | 'procedimientos' = 'historial';
  cargandoDetalleConsultas: boolean = false;
  consultasHistorial: any[] = [];
  consultasFiltradasHistorial: any[] = [];
  busquedaHistorial: string = '';
  filtroTipoHistorial: string = 'Todos';
  filtroFechaHistorial: string = 'Todas';
  filtroVetHistorial: string = 'Todos';
  consultaDetalleSeleccionada: any = null;
  modalDetalleConsultaIndividual: boolean = false;
  cargandoDetalleIndividual: boolean = false;

  listaSistemasDef = [
    { clave: 'general', label: 'General / Físico' },
    { clave: 'hidratacion', label: 'Hidratación' },
    { clave: 'tegumentario', label: 'Piel y Anexos' },
    { clave: 'ojos', label: 'Ojos y Visión' },
    { clave: 'oidos', label: 'Oídos y Canales' },
    { clave: 'nariz', label: 'Nariz y Vías Altas' },
    { clave: 'digestivo', label: 'Digestivo' },
    { clave: 'respiratorio', label: 'Respiratorio' },
    { clave: 'cardiovascular', label: 'Cardiovascular' },
    { clave: 'musculoesqueletico', label: 'Músculo-esquelético' },
    { clave: 'nervioso', label: 'Nervioso' },
    { clave: 'genitourinario', label: 'Genitourinario' },
  ];

  // Sub-modal y menú para + Crear [C] dentro del historial
  menuCrearDesplegable: boolean = false;
  modalCrearEnHistorial: boolean = false;
  guardandoEnHistorial: boolean = false;
  nuevoRegistroHistorial = {
    tipo: 'Consulta General',
    motivo: 'Consulta de control clínico general',
    prioridad: 'Normal',
    temperatura: 38.5 as number | null,
    frecuenciaCardiaca: 110 as number | null,
    frecuenciaRespiratoria: 24 as number | null,
    peso: null as number | null,
    diagnostico: '',
    planTratamiento: '',
    veterinario: 'Médico Veterinario CBA'
  };

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

  // Diccionarios auxiliares de animales y seguimientos (por id_animal, radicado y nombre)
  private mapaAnimales: Map<number, any> = new Map();
  private mapaPorRadicado: Map<string, any> = new Map();
  private mapaPorNombre: Map<string, any> = new Map();

  constructor(
    private http: HttpClient,
    private historiaService: HistoriaClinicaService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.nuevoRegistroHistorial.veterinario = this.obtenerVeterinarioSesion();
    this.cargarHistorias();
  }

  obtenerVeterinarioSesion(): string {
    try {
      const rawUser = localStorage.getItem('user') || localStorage.getItem('usuario') || localStorage.getItem('currentUser');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        const nombre = parsed?.nombre || parsed?.nombres || parsed?.full_name || parsed?.username;
        if (nombre && String(nombre).trim()) {
          return String(nombre).trim();
        }
      }
      const directName = localStorage.getItem('nombre_usuario') || localStorage.getItem('username');
      if (directName && directName.trim()) {
        return directName.trim();
      }
    } catch {}
    return 'Médico Veterinario CBA';
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

    // Mapeo e hidratación con datos de animales y seguimientos si existen
    this.historias = items.map((h: any) => {
      const idAnimNum = Number(h.id_animal);
      const animalInfo = this.mapaAnimales.get(idAnimNum) || {};
      const numHistStr = h.numero_historia || `HC-${h.id_historia}`;
      const radKey = String(numHistStr).trim().toLowerCase();
      const segPorRadicado = this.mapaPorRadicado.get(radKey) || null;

      const nombreResuelto =
        animalInfo.nombre ||
        h.animal?.nombre ||
        segPorRadicado?.nombre ||
        `Animal #${h.id_animal}`;

      const nomKey = String(nombreResuelto).trim().toLowerCase();
      const segPorNombre = nomKey ? (this.mapaPorNombre.get(nomKey) || null) : null;

      const rawFoto =
        animalInfo.foto_url ||
        animalInfo.foto ||
        this.extraerFotoDeRegistro(h) ||
        segPorRadicado?.foto_url ||
        segPorNombre?.foto_url ||
        '';

      const razaResuelta =
        animalInfo.raza ||
        h.animal?.raza ||
        segPorRadicado?.raza ||
        segPorNombre?.raza ||
        'Mestizo';

      let especieResuelta =
        animalInfo.especie ||
        h.animal?.especie ||
        segPorRadicado?.especie ||
        segPorNombre?.especie ||
        'Canino';

      // Evitar que la raza se duplique como especie (ej. "Poodle · Poodle")
      if (
        especieResuelta &&
        razaResuelta &&
        especieResuelta.trim().toLowerCase() === razaResuelta.trim().toLowerCase()
      ) {
        especieResuelta = segPorRadicado?.especie || segPorNombre?.especie || 'Canino';
      }

      return {
        id_historia: h.id_historia,
        id_animal: h.id_animal,
        id_consulta: h.id_consulta || h.ultima_consulta?.id_consulta || h.consulta?.id_consulta || null,
        numero_historia: numHistStr,
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
        animal_nombre: nombreResuelto,
        animal_especie: especieResuelta,
        animal_raza: razaResuelta,
        animal_foto: this.normalizarUrlFoto(rawFoto),
        animal_sexo: animalInfo.sexo || h.animal?.sexo || segPorRadicado?.sexo || segPorNombre?.sexo || '',
        animal_peso: animalInfo.peso ?? h.animal?.peso ?? segPorRadicado?.peso ?? segPorNombre?.peso ?? null
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

    // Hidratar en segundo plano cualquier historia a la que aún le falte foto
    this.hidratarFotosFaltantes();
  }

  /**
   * Extrae la URL de la foto de un registro de animal, historia o seguimiento móvil
   */
  private extraerFotoDeRegistro(item: any): string {
    if (!item) return '';

    const extraerPrimera = (val: any): string => {
      if (!val) return '';
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmed);
            return extraerPrimera(parsed);
          } catch {
            return '';
          }
        }
        return trimmed;
      }
      if (Array.isArray(val) && val.length > 0) {
        const primero = val[0];
        if (typeof primero === 'string') return primero;
        if (primero && typeof primero === 'object') {
          return (
            primero.foto ||
            primero.url ||
            primero.imagen ||
            primero.ruta_archivo ||
            primero.foto_url ||
            primero.fotoUrl ||
            primero.archivo ||
            ''
          );
        }
      }
      return '';
    };

    const candidata =
      item.foto_url ||
      item.fotoUrl ||
      item.foto ||
      extraerPrimera(item.fotos) ||
      extraerPrimera(item.multimedia) ||
      extraerPrimera(item.evidencias) ||
      item.imagen ||
      item.foto_paciente ||
      item.imagen_paciente ||
      item.animal_foto ||
      item.animales?.[0]?.foto_url ||
      item.animales?.[0]?.fotoUrl ||
      item.animales?.[0]?.foto ||
      item.animales?.[0]?.imagen ||
      extraerPrimera(item.animales?.[0]?.fotos) ||
      item.animal?.foto_url ||
      item.animal?.fotoUrl ||
      item.animal?.foto ||
      item.animal?.imagen ||
      extraerPrimera(item.animal?.fotos) ||
      item.peticion?.foto ||
      item.peticion?.imagen ||
      extraerPrimera(item.peticion?.fotos) ||
      extraerPrimera(item.peticion?.evidencias) ||
      '';

    return this.normalizarUrlFoto(candidata);
  }

  /**
   * Normaliza URLs de fotos de animales (relativas de Django en la nube, Cloudinary, base64)
   */
  normalizarUrlFoto(url: any): string {
    if (!url || typeof url !== 'string' || !url.trim()) return '';
    const u = url.trim();
    if (u === 'null' || u === 'undefined' || u === 'None') return '';
    if (
      u.startsWith('http://') ||
      u.startsWith('https://') ||
      u.startsWith('data:image/') ||
      u.startsWith('blob:')
    ) {
      return u;
    }
    const baseUrl = (environment.backendUrl || BACKEND_CLOUD_URL || 'https://backendvetericano-production.up.railway.app').replace(/\/+$/, '');
    if (u.startsWith('/media/')) {
      return `${baseUrl}${u}`;
    }
    if (u.startsWith('media/')) {
      return `${baseUrl}/${u}`;
    }
    if (u.startsWith('/')) {
      return `${baseUrl}${u}`;
    }
    return `${baseUrl}/media/${u}`;
  }

  /**
   * Precarga mapa de animales y seguimientos (Actas) para mostrar fotos, nombres y especies reales en la tabla
   */
  private precargarDatosAnimales(callback: () => void): void {
    const urlAnimales = environment.apiUrlAnimales || `${environment.apiBaseUrl}/animales/animales/`;
    const baseUrl = (environment.backendUrl || BACKEND_CLOUD_URL || 'https://backendvetericano-production.up.railway.app').replace(/\/+$/, '');
    const urlSeguimientos = `${baseUrl}/api/peticiones/seguimiento/listar/`;

    forkJoin({
      animalesResp: this.http.get<any>(urlAnimales, { headers: this.authHeaders }).pipe(catchError(() => of(null))),
      seguimientosResp: this.http.get<any>(urlSeguimientos, { headers: this.authHeaders }).pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ animalesResp, seguimientosResp }) => {
        const extraerArray = (r: any): any[] => {
          if (!r) return [];
          if (Array.isArray(r)) return r;
          if (Array.isArray(r.results)) return r.results;
          if (Array.isArray(r.data)) return r.data;
          return [];
        };

        const listaSeguimientos = extraerArray(seguimientosResp);
        const listaAnimales = extraerArray(animalesResp);

        // 1. Indexar seguimientos por id_animal, por número de radicado y por nombre de paciente
        listaSeguimientos.forEach((s: any) => {
          const fotoSeg = this.extraerFotoDeRegistro(s);
          const nombreSeg = String(
            s?.nombre_paciente ||
            s?.nombre_animal ||
            s?.nombre ||
            s?.animal?.nombre ||
            s?.animales?.[0]?.nombre ||
            s?.paciente?.nombre ||
            ''
          ).trim();
          const especieSeg = String(
            s?.paciente_especie ||
            s?.especie ||
            s?.animal?.especie ||
            s?.animales?.[0]?.especie ||
            ''
          ).trim();
          const razaSeg = String(
            s?.paciente_raza ||
            s?.raza ||
            s?.animal?.raza ||
            s?.animales?.[0]?.raza ||
            ''
          ).trim();
          const sexoSeg = String(s?.paciente_sexo || s?.sexo || s?.animal?.sexo || '').trim();
          const pesoSeg = s?.peso_paciente ?? s?.peso ?? s?.animal?.peso ?? null;
          const idSeg = s?.id_seguimiento || s?.id || null;

          const infoSeg = {
            id_seguimiento: idSeg,
            nombre: nombreSeg,
            especie: especieSeg || 'Canino',
            raza: razaSeg || 'Mestizo',
            foto_url: fotoSeg,
            sexo: sexoSeg,
            peso: pesoSeg
          };

          const idAnimCand = Number(
            s?.id_animal ??
            s?.id_animal_id ??
            s?.animal?.id_animal ??
            s?.animal?.id ??
            s?.animales?.[0]?.id_animal ??
            s?.animales?.[0]?.id ??
            s?.paciente?.id_animal
          );
          if (!isNaN(idAnimCand) && idAnimCand > 0) {
            const prev = this.mapaAnimales.get(idAnimCand);
            this.mapaAnimales.set(idAnimCand, {
              ...prev,
              ...infoSeg,
              foto_url: fotoSeg || prev?.foto_url || ''
            });
          }

          const radicado = String(
            s?.numero_radicado ||
            s?.radicado ||
            s?.codigo_radicado ||
            s?.numeroRadicado ||
            ''
          ).trim().toLowerCase();
          if (radicado) {
            const prevRad = this.mapaPorRadicado.get(radicado);
            this.mapaPorRadicado.set(radicado, {
              ...prevRad,
              ...infoSeg,
              foto_url: fotoSeg || prevRad?.foto_url || ''
            });
          }

          if (nombreSeg) {
            const nomKey = nombreSeg.toLowerCase();
            const prevNom = this.mapaPorNombre.get(nomKey);
            this.mapaPorNombre.set(nomKey, {
              ...prevNom,
              ...infoSeg,
              foto_url: fotoSeg || prevNom?.foto_url || ''
            });
          }
        });

        // 2. Indexar animales de /api/animales/animales/ preservando la foto del seguimiento si el animal no la tiene
        listaAnimales.forEach((a: any) => {
          if (a?.id_animal) {
            const idNum = Number(a.id_animal);
            const existente = this.mapaAnimales.get(idNum) || {};
            const nomKey = String(a.nombre || '').trim().toLowerCase();
            const porNombre = nomKey ? (this.mapaPorNombre.get(nomKey) || {}) : {};

            const fotoDirecta = this.extraerFotoDeRegistro(a);
            const fotoFinal = fotoDirecta || existente.foto_url || porNombre.foto_url || '';

            const razaAnimal = a.raza_nombre || a.id_raza?.nombre || a.raza || existente.raza || porNombre.raza || 'Mestizo';
            let especieAnimal =
              a.especie_nombre ||
              a.especie ||
              a.id_raza?.id_especie?.nombre ||
              (typeof a.id_especie === 'object' ? a.id_especie?.nombre : '') ||
              existente.especie ||
              porNombre.especie ||
              'Canino';

            if (especieAnimal.trim().toLowerCase() === razaAnimal.trim().toLowerCase()) {
              especieAnimal = existente.especie || porNombre.especie || 'Canino';
            }

            this.mapaAnimales.set(idNum, {
              id_seguimiento: existente.id_seguimiento || porNombre.id_seguimiento || null,
              nombre: a.nombre || existente.nombre,
              especie: especieAnimal,
              raza: razaAnimal,
              foto_url: fotoFinal,
              sexo: a.sexo || existente.sexo || porNombre.sexo || '',
              peso: a.peso ?? existente.peso ?? porNombre.peso ?? null
            });
          }
        });

        callback();
      },
      error: () => {
        callback();
      }
    });
  }

  /**
   * Hidrata en segundo plano las fotos que no vinieron en el listado general consultando
   * el detalle del seguimiento o el expediente individual del animal.
   */
  private hidratarFotosFaltantes(): void {
    const baseUrl = (environment.backendUrl || BACKEND_CLOUD_URL || 'https://backendvetericano-production.up.railway.app').replace(/\/+$/, '');
    const sinFoto = this.historias.filter(h => !h.animal_foto && h.id_animal);

    sinFoto.forEach((historia) => {
      const idAnimNum = Number(historia.id_animal);
      const radKey = String(historia.numero_historia || '').trim().toLowerCase();
      const nomKey = String(historia.animal_nombre || '').trim().toLowerCase();

      const infoSeg =
        this.mapaAnimales.get(idAnimNum) ||
        this.mapaPorRadicado.get(radKey) ||
        this.mapaPorNombre.get(nomKey);

      const idSeg = infoSeg?.id_seguimiento;
      if (idSeg) {
        this.http.get<any>(`${baseUrl}/api/peticiones/seguimiento/${idSeg}/`, { headers: this.authHeaders }).subscribe({
          next: (det) => {
            const fotoDet = this.extraerFotoDeRegistro(det);
            if (fotoDet) {
              historia.animal_foto = fotoDet;
              this.cdr.detectChanges();
            }
          },
          error: () => {}
        });
      }

      const urlExpAnimal = `${environment.apiUrlExpedientePorAnimal}${idAnimNum}/`;
      this.http.get<any>(urlExpAnimal, { headers: this.authHeaders }).subscribe({
        next: (data) => {
          const fotoExp = this.extraerFotoDeRegistro(data?.animal || data);
          if (fotoExp && !historia.animal_foto) {
            historia.animal_foto = fotoExp;
            this.cdr.detectChanges();
          }
        },
        error: () => {}
      });
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

  // =========================================================================
  // MODAL DE DETALLE Y LÍNEA DE TIEMPO (ESTILO CP-VET)
  // =========================================================================

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if ((event.key === 'c' || event.key === 'C') && this.modalDetalleAbierto && !this.modalCrearEnHistorial && !this.modalNuevoPacienteAbierto) {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag !== 'input' && activeTag !== 'textarea') {
        event.preventDefault();
        this.iniciarConsultaGeneralDesdeHistorial();
      }
    }
  }

  abrirModalDetalle(historia: HistoriaClinicaItem): void {
    this.historiaSeleccionada = historia;
    this.modalDetalleAbierto = true;
    this.pestanaDetalle = 'historial';
    this.busquedaHistorial = '';
    this.filtroTipoHistorial = 'Todos';
    this.filtroFechaHistorial = 'Todas';
    this.filtroVetHistorial = 'Todos';
    this.cargandoDetalleConsultas = true;
    this.consultasHistorial = [];
    this.consultasFiltradasHistorial = [];
    this.cdr.detectChanges();

    const cleanAnimalId = historia.id_animal;
    const urlExpAnimal = `${environment.apiUrlExpedientePorAnimal}${cleanAnimalId}/`;

    this.http.get<any>(urlExpAnimal, { headers: this.authHeaders }).subscribe({
      next: (data) => {
        const rawConsultas = Array.isArray(data?.consultas_anteriores) ? data.consultas_anteriores : [];
        const animalData = data?.animal || {};

        // Hidratar o refrescar la foto y datos del animal en el modal si vienen del expediente
        const fotoReal = this.normalizarUrlFoto(animalData.foto_url || animalData.fotoUrl || animalData.foto || animalData.imagen || '');
        if (fotoReal && this.historiaSeleccionada) {
          this.historiaSeleccionada.animal_foto = fotoReal;
          historia.animal_foto = fotoReal;
        }
        if (animalData.nombre && this.historiaSeleccionada) {
          if (!this.historiaSeleccionada.animal_nombre || this.historiaSeleccionada.animal_nombre.startsWith('Animal #')) {
            this.historiaSeleccionada.animal_nombre = animalData.nombre;
            historia.animal_nombre = animalData.nombre;
          }
        }

        if (rawConsultas.length > 0) {
          this.consultasHistorial = rawConsultas.map((c: any, index: number) => {
            const fechaStr = c.fecha_hora || c.fechaHora || c.fecha || new Date().toISOString();
            return {
              id_consulta: c.id_consulta || (index + 1),
              titulo: this.normalizarTituloConsulta(c.motivo_consulta || c.tipo || 'CONSULTA GENERAL'),
              peso: c.peso ?? (c.constantes?.peso ?? animalData.peso ?? 3.0),
              temperatura: c.temperatura ?? (c.constantes?.temperatura ?? 38.5),
              frecuencia_cardiaca: c.frecuencia_cardiaca ?? (c.constantes?.frecuencia_cardiaca ?? 110),
              frecuencia_respiratoria: c.frecuencia_respiratoria ?? (c.constantes?.frecuencia_respiratoria ?? 24),
              diagnostico: c.diagnostico_principal || c.diagnosticoPrincipal || c.diagnostico || 'Evaluación médica general estable.',
              diagnostico_diferencial: c.diagnostico_diferencial || '',
              plan_tratamiento: c.plan_tratamiento || c.planTratamiento || c.plan_procedimientos || 'Manejo ambulatorio y recomendaciones.',
              fecha_hora: fechaStr,
              fecha_formateada: this.formatearFechaLarga(fechaStr),
              hora_formateada: this.formatearHora(fechaStr),
              mes_ano: this.formatearMesAno(fechaStr),
              veterinario: c.veterinario_nombre || c.usuario_nombre || c.veterinario || this.obtenerVeterinarioSesion(),
              prioridad: c.prioridad || 'Normal',
              expandido: false
            };
          });
        } else {
          // Si no tiene consultas previas, creamos la primera consulta de apertura
          const fechaApertura = historia.fecha_apertura || new Date().toISOString();
          this.consultasHistorial = [
            {
              id_consulta: 1,
              titulo: 'CONSULTA GENERAL',
              peso: historia.animal_peso ? Number(historia.animal_peso) : 3.0,
              temperatura: 38.5,
              frecuencia_cardiaca: 110,
              frecuencia_respiratoria: 24,
              diagnostico: 'Apertura de expediente e ingreso de paciente.',
              diagnostico_diferencial: '',
              plan_tratamiento: 'Plan sanitario y seguimiento clínico.',
              fecha_hora: fechaApertura,
              fecha_formateada: this.formatearFechaLarga(fechaApertura),
              hora_formateada: this.formatearHora(fechaApertura),
              mes_ano: this.formatearMesAno(fechaApertura),
              veterinario: this.obtenerVeterinarioSesion(),
              prioridad: 'Normal',
              expandido: false
            }
          ];
        }

        this.consultasFiltradasHistorial = [...this.consultasHistorial];
        this.cargandoDetalleConsultas = false;
        this.cdr.detectChanges();
      },
      error: () => {
        // Fallback elegante en caso de retardo de red
        const fechaFallback = historia.fecha_apertura || new Date().toISOString();
        this.consultasHistorial = [
          {
            id_consulta: 1,
            titulo: 'CONSULTA GENERAL',
            peso: historia.animal_peso ? Number(historia.animal_peso) : 3.0,
            temperatura: 38.5,
            frecuencia_cardiaca: 110,
            frecuencia_respiratoria: 24,
            diagnostico: 'Consulta médica general.',
            diagnostico_diferencial: '',
            plan_tratamiento: 'Manejo ambulatorio.',
            fecha_hora: fechaFallback,
            fecha_formateada: this.formatearFechaLarga(fechaFallback),
            hora_formateada: this.formatearHora(fechaFallback),
            mes_ano: this.formatearMesAno(fechaFallback),
            veterinario: this.obtenerVeterinarioSesion(),
            prioridad: 'Normal',
            expandido: false
          }
        ];
        this.consultasFiltradasHistorial = [...this.consultasHistorial];
        this.cargandoDetalleConsultas = false;
        this.cdr.detectChanges();
      }
    });
  }

  cerrarModalDetalle(): void {
    this.modalDetalleAbierto = false;
    this.historiaSeleccionada = null;
    this.consultasHistorial = [];
    this.consultasFiltradasHistorial = [];
  }

  cambiarPestanaDetalle(p: 'historial' | 'consultas' | 'evolucion' | 'formulas' | 'examenes' | 'imagenes' | 'vacunas' | 'desp' | 'procedimientos'): void {
    this.pestanaDetalle = p;
    this.cdr.detectChanges();
  }

  filtrarHistorial(): void {
    const q = (this.busquedaHistorial || '').trim().toLowerCase();
    const tipo = this.filtroTipoHistorial;
    const vet = this.filtroVetHistorial;

    this.consultasFiltradasHistorial = this.consultasHistorial.filter((c) => {
      const coincideTexto = !q ||
        c.titulo.toLowerCase().includes(q) ||
        c.diagnostico.toLowerCase().includes(q) ||
        c.plan_tratamiento.toLowerCase().includes(q) ||
        c.veterinario.toLowerCase().includes(q);

      const coincideTipo = tipo === 'Todos' || c.titulo.toLowerCase().includes(tipo.toLowerCase());
      const coincideVet = vet === 'Todos' || c.veterinario.toLowerCase().includes(vet.toLowerCase());

      return coincideTexto && coincideTipo && coincideVet;
    });
  }

  toggleExpandirConsulta(c: any): void {
    c.expandido = !c.expandido;
  }

  verDetalleCompletoConsulta(c: any): void {
    this.consultaDetalleSeleccionada = { ...c };
    this.modalDetalleConsultaIndividual = true;
    this.cargandoDetalleIndividual = true;

    const idCons = c.id_consulta;
    // Si id_consulta es un ID válido persistido en base de datos
    if (idCons && typeof idCons === 'number' && idCons < 1000000000) {
      const urlExp = `${environment.apiUrlExpedienteCompleto || (environment.apiUrlClinica + 'expediente-completo/')}${idCons}/`;
      this.http.get<any>(urlExp, { headers: this.authHeaders }).subscribe({
        next: (data) => {
          this.cargandoDetalleIndividual = false;
          if (data) {
            this.consultaDetalleSeleccionada = {
              ...this.consultaDetalleSeleccionada,
              ...data,
              titulo: this.normalizarTituloConsulta(data.motivoConsulta || this.consultaDetalleSeleccionada.titulo),
              motivo_consulta: data.motivoConsulta || this.consultaDetalleSeleccionada.titulo,
              peso: data.examenClinico?.peso ?? data.animal?.peso ?? this.consultaDetalleSeleccionada.peso,
              temperatura: data.examenClinico?.temperatura ?? this.consultaDetalleSeleccionada.temperatura,
              frecuencia_cardiaca: data.examenClinico?.frecuenciaCardiaca ?? this.consultaDetalleSeleccionada.frecuencia_cardiaca,
              frecuencia_respiratoria: data.examenClinico?.frecuenciaRespiratoria ?? this.consultaDetalleSeleccionada.frecuencia_respiratoria,
              pulso: data.examenClinico?.pulso || 'Normal',
              tllc: data.examenClinico?.tiempoLlenadoCapilar || '2 seg',
              mucosas: data.examenClinico?.mucosas || 'Rosadas',
              ganglios_linfaticos: data.examenClinico?.gangliosLinfaticos || 'Normales',
              actitud_temperamento: data.examenClinico?.actitudTemperamento || 'Alerta / Responsivo',
              sistemas: data.organosSistemas || {},
              observaciones_sistemas: data.organosSistemas?.observaciones || '',
              diagnostico: data.hoja2?.diagnosticoFinal || this.consultaDetalleSeleccionada.diagnostico,
              diagnostico_diferencial: data.hoja2?.diagnosticoDiferencial || this.consultaDetalleSeleccionada.diagnostico_diferencial || '',
              lista_problemas: Array.isArray(data.hoja2?.listaProblemas) ? data.hoja2.listaProblemas : (data.hoja2?.listaProblemas ? [data.hoja2.listaProblemas] : []),
              pronostico: data.hoja2?.pronostico || 'Favorable',
              plan_tratamiento: data.hoja2?.planProcedimientos || this.consultaDetalleSeleccionada.plan_tratamiento,
              materiales_utilizados: data.hoja2?.materialesUtilizados || '',
              tratamientos: Array.isArray(data.hoja2?.tratamientos) ? data.hoja2.tratamientos : (this.consultaDetalleSeleccionada.tratamientos || []),
              examenes: data.hoja2?.examenes || {},
              ingresa_cba: data.hoja3?.ingresaCBA || 'NO',
              motivo_cba: data.hoja3?.motivoIngresoNoIngreso || '',
              canil_asignado: data.hoja3?.canilAsignado || '',
              funcionario_recibe: data.hoja3?.funcionarioRecibeCBA || ''
            };

            // Hidratar foto en historiaSeleccionada si data.animal la aporta
            if (data.animal) {
              const fotoDetalle = this.normalizarUrlFoto(data.animal.fotoUrl || data.animal.foto_url || data.animal.foto || data.animal.imagen || '');
              if (fotoDetalle && this.historiaSeleccionada && !this.historiaSeleccionada.animal_foto) {
                this.historiaSeleccionada.animal_foto = fotoDetalle;
              }
            }
          }
          this.cdr.detectChanges();
        },
        error: () => {
          this.cargandoDetalleIndividual = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.cargandoDetalleIndividual = false;
      this.cdr.detectChanges();
    }
  }

  obtenerEstadoSistema(clave: string): { label: string; clase: string; icono: string } {
    const s = this.consultaDetalleSeleccionada?.sistemas || this.consultaDetalleSeleccionada?.organosSistemas || {};
    const val = String(s[clave] || 'NE').toUpperCase();
    if (val === 'N' || val === 'NORMAL') {
      return { label: 'Normal', clase: 'bg-emerald-50 text-emerald-700 border-emerald-200', icono: '✓' };
    } else if (val === 'A' || val === 'ANORMAL') {
      return { label: 'Anormal', clase: 'bg-rose-50 text-rose-700 border-rose-200', icono: '⚠' };
    }
    return { label: 'No evaluado', clase: 'bg-slate-50 text-slate-500 border-slate-200', icono: '—' };
  }

  abrirEnEditorCompleto(): void {
    if (!this.consultaDetalleSeleccionada || !this.historiaSeleccionada) return;
    const historia = this.historiaSeleccionada;
    const consulta = this.consultaDetalleSeleccionada;
    this.cerrarDetalleConsultaIndividual();
    this.cerrarModalDetalle();
    const id = historia.id_consulta || historia.id_animal || historia.id_historia;
    this.router.navigate(['/inicio-admin/historia-clinica/editar', id], {
      queryParams: {
        id_consulta: consulta.id_consulta || '',
        id_animal: historia.id_animal || '',
        id_historia: historia.id_historia || '',
        nombre: historia.animal_nombre || '',
        foto: historia.animal_foto || ''
      }
    });
  }

  cerrarDetalleConsultaIndividual(): void {
    this.modalDetalleConsultaIndividual = false;
    this.cargandoDetalleIndividual = false;
    this.consultaDetalleSeleccionada = null;
  }

  iniciarConsultaGeneralDesdeHistorial(): void {
    if (!this.historiaSeleccionada) return;
    const historia = this.historiaSeleccionada;
    this.cerrarModalDetalle();
    const id = historia.id_consulta || historia.id_animal || historia.id_historia;
    this.router.navigate(['/inicio-admin/historia-clinica/editar', id], {
      queryParams: {
        id_consulta: historia.id_consulta || '',
        id_animal: historia.id_animal || '',
        id_historia: historia.id_historia || '',
        nombre: historia.animal_nombre || '',
        foto: historia.animal_foto || '',
        nueva_consulta: 'true'
      }
    });
  }

  abrirModalCrearEnHistorial(tipo: string = 'Consulta General'): void {
    this.nuevoRegistroHistorial = {
      tipo: tipo,
      motivo: tipo,
      prioridad: 'Normal',
      temperatura: 38.5,
      frecuenciaCardiaca: 110,
      frecuenciaRespiratoria: 24,
      peso: this.historiaSeleccionada?.animal_peso ? Number(this.historiaSeleccionada.animal_peso) : 3.0,
      diagnostico: '',
      planTratamiento: '',
      veterinario: this.obtenerVeterinarioSesion()
    };
    this.modalCrearEnHistorial = true;
  }

  cerrarModalCrearEnHistorial(): void {
    this.modalCrearEnHistorial = false;
  }

  guardarNuevoEnHistorial(): void {
    if (!this.historiaSeleccionada) return;
    this.guardandoEnHistorial = true;

    const motivoTexto = (this.nuevoRegistroHistorial.motivo || this.nuevoRegistroHistorial.tipo || 'Consulta General').trim();
    const payload = {
      id_animal: this.historiaSeleccionada.id_animal,
      motivoConsulta: motivoTexto,
      prioridad: this.nuevoRegistroHistorial.prioridad || 'Normal',
      examenClinico: {
        temperatura: this.nuevoRegistroHistorial.temperatura,
        peso: this.nuevoRegistroHistorial.peso || Number(this.historiaSeleccionada.animal_peso) || 3.0,
        frecuencia_cardiaca: this.nuevoRegistroHistorial.frecuenciaCardiaca,
        frecuencia_respiratoria: this.nuevoRegistroHistorial.frecuenciaRespiratoria,
        actitud_temperamento: 'Alerta / Responsivo',
        resultado_estado: 'Estable'
      },
      hoja2: {
        diagnosticoPrincipal: this.nuevoRegistroHistorial.diagnostico || 'Evaluación médica registrada con éxito.',
        diagnosticoDiferencial: '',
        listaProblemas: '',
        evolucion: `Atención clínica de ${this.nuevoRegistroHistorial.tipo}.`,
        pronostico: 'Favorable',
        planProcedimientos: this.nuevoRegistroHistorial.planTratamiento || 'Tratamiento y seguimiento.',
        materialesUtilizados: '',
        tratamientos: []
      },
      hoja3: {
        plan_procedimientos: this.nuevoRegistroHistorial.planTratamiento || 'Tratamiento y seguimiento.',
        materiales_utilizados: '',
        ingresa_cba: false
      }
    };

    this.historiaService.crearExpedienteCompleto(payload).subscribe({
      next: (resp) => {
        this.guardandoEnHistorial = false;
        this.modalCrearEnHistorial = false;

        const fechaAhora = new Date().toISOString();
        const nuevaTarjeta = {
          id_consulta: resp?.consulta_id || resp?.id_consulta || Date.now(),
          titulo: this.normalizarTituloConsulta(this.nuevoRegistroHistorial.tipo),
          peso: this.nuevoRegistroHistorial.peso || Number(this.historiaSeleccionada?.animal_peso) || 3.0,
          temperatura: this.nuevoRegistroHistorial.temperatura || 38.5,
          frecuencia_cardiaca: this.nuevoRegistroHistorial.frecuenciaCardiaca || 110,
          frecuencia_respiratoria: this.nuevoRegistroHistorial.frecuenciaRespiratoria || 24,
          diagnostico: this.nuevoRegistroHistorial.diagnostico || 'Atención registrada con éxito.',
          diagnostico_diferencial: '',
          plan_tratamiento: this.nuevoRegistroHistorial.planTratamiento || 'Seguimiento clínico ambulatorio.',
          fecha_hora: fechaAhora,
          fecha_formateada: this.formatearFechaLarga(fechaAhora),
          hora_formateada: this.formatearHora(fechaAhora),
          mes_ano: this.formatearMesAno(fechaAhora),
          veterinario: this.nuevoRegistroHistorial.veterinario || this.obtenerVeterinarioSesion(),
          prioridad: this.nuevoRegistroHistorial.prioridad || 'Normal',
          expandido: false
        };

        this.consultasHistorial.unshift(nuevaTarjeta);
        this.filtrarHistorial();
        this.cargarHistorias();
        this.cdr.detectChanges();

        Swal.fire({
          icon: 'success',
          title: '¡Atención registrada!',
          text: `Se agregó la ${this.nuevoRegistroHistorial.tipo} a la línea de tiempo del paciente.`,
          timer: 1800,
          showConfirmButton: false
        });
      },
      error: (err) => {
        this.guardandoEnHistorial = false;
        console.error('Error al guardar atención en historial:', err);
        const errorDetail = err?.error?.motivoConsulta || err?.error?.detail || err?.error?.mensaje || 'No fue posible guardar la atención en el servidor.';
        Swal.fire({
          icon: 'error',
          title: 'Error al registrar',
          text: Array.isArray(errorDetail) ? errorDetail.join(', ') : errorDetail
        });
      }
    });
  }

  normalizarTituloConsulta(motivo: string): string {
    if (!motivo) return 'CONSULTA GENERAL';
    const m = motivo.toLowerCase();
    if (m.includes('digestiv')) return 'CONSULTA DIGESTIVA';
    if (m.includes('esquelet') || m.includes('muscul') || m.includes('óseo')) return 'CONSULTA MÚSCULO-ESQUELÉTICO';
    if (m.includes('respirat')) return 'CONSULTA RESPIRATORIA';
    if (m.includes('vacun')) return 'PLAN DE VACUNACIÓN';
    if (m.includes('desparasit')) return 'CONTROL ANTIPARASITARIO';
    if (m.includes('dermat') || m.includes('piel')) return 'CONSULTA DERMATOLÓGICA';
    return motivo.toUpperCase();
  }

  formatearMesAno(fechaStr: string): string {
    if (!fechaStr) return 'Noviembre De 2026';
    try {
      const d = new Date(fechaStr);
      if (isNaN(d.getTime())) return 'Noviembre De 2026';
      const mes = d.toLocaleDateString('es-CO', { month: 'long' });
      const ano = d.getFullYear();
      return `${mes.charAt(0).toUpperCase() + mes.slice(1)} De ${ano}`;
    } catch {
      return 'Noviembre De 2026';
    }
  }

  formatearFechaLarga(fechaStr: string): string {
    if (!fechaStr) return '02 de nov de 2026';
    try {
      const d = new Date(fechaStr);
      if (isNaN(d.getTime())) return fechaStr;
      return d.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return fechaStr;
    }
  }

  formatearHora(fechaStr: string): string {
    if (!fechaStr) return '02:00 p. m.';
    try {
      const d = new Date(fechaStr);
      if (isNaN(d.getTime())) return '02:00 p. m.';
      return d.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '02:00 p. m.';
    }
  }

  formatearFechaTexto(fechaStr?: string | null): string {
    if (!fechaStr) return '02 de noviembre de 2026';
    try {
      const d = new Date(fechaStr);
      if (isNaN(d.getTime())) return fechaStr;
      return d.toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return fechaStr;
    }
  }

  obtenerFechaUltimaVisita(): string {
    if (this.consultasHistorial && this.consultasHistorial.length > 0) {
      const primera = this.consultasHistorial[0];
      const f = primera.fecha_hora || primera.fechaHora || primera.fecha;
      if (f) return this.formatearFechaTexto(f);
      if (primera.fecha_formateada) return primera.fecha_formateada;
    }
    return this.formatearFechaTexto(this.historiaSeleccionada?.fecha_apertura);
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
