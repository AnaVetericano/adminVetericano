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
  numero_radicado?: string;
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
  // Hospitalización CBA y Adopción
  ingresa_cba?: boolean;
  canil_asignado?: string;
  motivo_ingreso_cba?: string;
  funcionario_recibe_cba?: string;
  disponible_adopcion?: boolean;
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

  // Filtros y búsqueda
  filtroBusqueda: string = '';
  filtroEstado: string = 'Todos';
  menuFiltroAbierto: boolean = false;
  vistaModo: 'tabla' | 'tarjetas' = 'tabla';
  mostrarHospitalizados: boolean = false;

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
    estadoGeneral: 'Estable',
    ingresaCBA: 'NO' as 'SI' | 'NO',
    canilAsignado: '',
    motivoIngresoCBA: '',
    funcionarioRecibeCBA: ''
  };

  // Modal de edición exclusiva de datos del animal / paciente rescatado
  modalEditarAnimalAbierto: boolean = false;
  guardandoEdicionAnimal: boolean = false;
  animalEnEdicion = {
    id_animal: null as number | null,
    id_historia: null as number | null,
    id_consulta: null as number | null,
    nombre: '',
    especie: 'Canino',
    raza: 'Mestizo',
    sexo: 'Macho',
    esterilizado: false,
    edad_aproximada: '',
    fecha_nacimiento: '',
    peso: null as number | null,
    color: '',
    microchip: '',
    caracteristicas: '',
    observaciones: '',
    foto_url: '',
    estado_general: 'Estable',
    disponible_adopcion: false,
    ingresa_cba: false,
    canil_asignado: '',
    motivo_ingreso_cba: '',
    funcionario_recibe_cba: ''
  };

  // Diccionarios auxiliares de animales, consultas y seguimientos (por id_animal, id_historia, radicado y nombre)
  private mapaAnimales: Map<number, any> = new Map();
  private mapaPorRadicado: Map<string, any> = new Map();
  private mapaPorNombre: Map<string, any> = new Map();
  private mapaConsultasPorHistoria: Map<number, any> = new Map();
  private mapaConsultasPorAnimal: Map<number, any> = new Map();

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
      const rawNumHist = String(h.numero_historia || '').trim();
      const radKey = rawNumHist.toLowerCase();
      const segPorRadicado = this.mapaPorRadicado.get(radKey) || null;

      // Número secuencial oficial correlativo con el ID de historia clínica
      const numSecuencial = `HC-${h.id_historia}`;

      // Si el registro original contiene un radicado de visita/acta (ej. RAD-VIS-...), lo preservamos
      const esRadicado = rawNumHist.toUpperCase().startsWith('RAD') || rawNumHist.toUpperCase().includes('VIS');
      const numRadicado = esRadicado ? rawNumHist : '';

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

      const idHistNum = Number(h.id_historia);
      const consultaInfo =
        this.mapaConsultasPorHistoria.get(idHistNum) ||
        this.mapaConsultasPorAnimal.get(idAnimNum) ||
        {};
      const estadoCbaLocal = this.historiaService.obtenerEstadoCbaLocal(idHistNum, idAnimNum);

      let ingresaCbaResuelto = false;
      if (estadoCbaLocal !== null) {
        ingresaCbaResuelto = !!estadoCbaLocal.ingresa_cba;
      } else if (consultaInfo.ingresa_cba !== undefined) {
        ingresaCbaResuelto = !!consultaInfo.ingresa_cba;
      } else if (h.ingresa_cba !== undefined) {
        ingresaCbaResuelto = h.ingresa_cba === true || String(h.ingresa_cba).toUpperCase() === 'SI';
      } else if (h.ultima_consulta?.ingresa_cba !== undefined) {
        ingresaCbaResuelto = h.ultima_consulta.ingresa_cba === true || String(h.ultima_consulta.ingresa_cba).toUpperCase() === 'SI';
      }

      const canilResuelto =
        estadoCbaLocal?.canil_asignado ||
        consultaInfo.canil_asignado ||
        h.canil_asignado ||
        h.ultima_consulta?.canil_asignado ||
        '';

      const motivoCbaResuelto =
        estadoCbaLocal?.motivo_ingreso_cba ||
        consultaInfo.motivo_ingreso_cba ||
        h.motivo_ingreso_cba ||
        h.ultima_consulta?.motivo_ingreso_cba ||
        '';

      const funcionarioCbaResuelto =
        estadoCbaLocal?.funcionario_recibe_cba ||
        consultaInfo.funcionario_recibe_cba ||
        h.funcionario_recibe_cba ||
        h.ultima_consulta?.funcionario_recibe_cba ||
        '';

      const adopcionLocal = this.historiaService.obtenerEstadoAdopcionLocal(idAnimNum);
      const disponibleAdopcionResuelto = adopcionLocal !== null
        ? (!ingresaCbaResuelto && !!adopcionLocal.disponible_adopcion)
        : (!ingresaCbaResuelto && Boolean(animalInfo.disponible_adopcion ?? h.animal?.disponible_adopcion ?? false));

      return {
        id_historia: h.id_historia,
        id_animal: h.id_animal,
        id_consulta:
          h.id_consulta ||
          h.ultima_consulta?.id_consulta ||
          h.consulta?.id_consulta ||
          consultaInfo.id_consulta ||
          null,
        ingresa_cba: ingresaCbaResuelto,
        canil_asignado: canilResuelto,
        motivo_ingreso_cba: motivoCbaResuelto,
        funcionario_recibe_cba: funcionarioCbaResuelto,
        disponible_adopcion: disponibleAdopcionResuelto,
        numero_historia: numSecuencial,
        numero_radicado: numRadicado,
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
    const urlConsultas = `${environment.apiUrlClinica}consultas/`;
    const urlConsultasCba = `${environment.apiUrlClinica}consultas/cba/`;

    forkJoin({
      animalesResp: this.http.get<any>(urlAnimales, { headers: this.authHeaders }).pipe(catchError(() => of(null))),
      seguimientosResp: this.http.get<any>(urlSeguimientos, { headers: this.authHeaders }).pipe(catchError(() => of(null))),
      consultasResp: this.http.get<any>(urlConsultas, { headers: this.authHeaders }).pipe(catchError(() => of(null))),
      consultasCbaResp: this.http.get<any>(urlConsultasCba, { headers: this.authHeaders }).pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ animalesResp, seguimientosResp, consultasResp, consultasCbaResp }) => {
        const extraerArray = (r: any): any[] => {
          if (!r) return [];
          if (Array.isArray(r)) return r;
          if (Array.isArray(r.results)) return r.results;
          if (Array.isArray(r.data)) return r.data;
          return [];
        };

        const listaSeguimientos = extraerArray(seguimientosResp);
        const listaAnimales = extraerArray(animalesResp);
        const listaConsultas = extraerArray(consultasResp);
        const listaConsultasCba = extraerArray(consultasCbaResp);

        this.mapaConsultasPorHistoria.clear();
        this.mapaConsultasPorAnimal.clear();

        // Ordenar consultas de más antigua a más reciente para que la última consulta prevalezca
        const consultasOrdenadas = [...listaConsultas].sort((a, b) => {
          const idA = Number(a?.id_consulta || a?.id || 0);
          const idB = Number(b?.id_consulta || b?.id || 0);
          return idA - idB;
        });

        const procesarItemConsulta = (c: any, forzarCba: boolean = false) => {
          if (!c) return;
          const idHist = Number(c?.id_historia ?? c?.historia?.id_historia ?? c?.id_historia_id ?? 0);
          const idAnim = Number(c?.id_animal ?? c?.animal?.id_animal ?? c?.historia?.id_animal ?? 0);
          const idCons = Number(c?.id_consulta ?? c?.id ?? 0);

          let evalSist: any = c?.evaluacion_sistemas || {};
          if (typeof evalSist === 'string') {
            try {
              evalSist = JSON.parse(evalSist);
            } catch {
              evalSist = {};
            }
          }

          let ingresaCba = forzarCba;
          if (!forzarCba) {
            if (typeof c?.ingresa_cba === 'boolean') {
              ingresaCba = c.ingresa_cba;
            } else if (typeof evalSist?._ingresa_cba === 'boolean') {
              ingresaCba = evalSist._ingresa_cba;
            } else if (evalSist?.ingresaCBA) {
              ingresaCba = String(evalSist.ingresaCBA).toUpperCase() === 'SI';
            }
          }

          const infoConsulta = {
            id_consulta: idCons || null,
            id_historia: idHist || null,
            id_animal: idAnim || null,
            ingresa_cba: ingresaCba,
            canil_asignado: c?.canil_asignado || evalSist?._canil_asignado || '',
            motivo_ingreso_cba: c?.motivo_ingreso_cba || evalSist?._motivo_ingreso_cba || '',
            funcionario_recibe_cba: c?.funcionario_recibe_cba || evalSist?._funcionario_recibe_cba || ''
          };

          if (idHist > 0) {
            const prev = this.mapaConsultasPorHistoria.get(idHist);
            if (!prev || !forzarCba || (idCons >= Number(prev.id_consulta || 0))) {
              this.mapaConsultasPorHistoria.set(idHist, infoConsulta);
            }
          }
          if (idAnim > 0) {
            const prevAnim = this.mapaConsultasPorAnimal.get(idAnim);
            if (!prevAnim || !forzarCba || (idCons >= Number(prevAnim.id_consulta || 0))) {
              this.mapaConsultasPorAnimal.set(idAnim, infoConsulta);
            }
          }
        };

        consultasOrdenadas.forEach((c: any) => procesarItemConsulta(c, false));
        listaConsultasCba.forEach((c: any) => procesarItemConsulta(c, true));

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
              peso: a.peso ?? existente.peso ?? porNombre.peso ?? null,
              color: a.color || existente.color || '',
              microchip: a.microchip || existente.microchip || '',
              caracteristicas: a.caracteristicas || existente.caracteristicas || '',
              observaciones: a.observaciones || existente.observaciones || '',
              esterilizado: Boolean(a.esterilizado ?? existente.esterilizado ?? false),
              disponible_adopcion: Boolean(a.disponible_adopcion ?? existente.disponible_adopcion ?? false)
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
      const radKey = String(historia.numero_radicado || historia.numero_historia || '').trim().toLowerCase();
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
          }

          // Hidratar estado de hospitalización CBA si aún no estaba en caché local ni en consultas precargadas
          const estadoLocal = this.historiaService.obtenerEstadoCbaLocal(historia.id_historia, idAnimNum);
          if (estadoLocal === null && !this.mapaConsultasPorHistoria.has(Number(historia.id_historia))) {
            const rawCons = Array.isArray(data?.consultas_anteriores) ? data.consultas_anteriores : [];
            const consDeHistoria = rawCons.filter((c: any) => !c?.id_historia || Number(c.id_historia) === Number(historia.id_historia));
            const ultimaCons = consDeHistoria.length > 0 ? consDeHistoria[0] : (rawCons[0] || null);
            if (ultimaCons) {
              const esCba = ultimaCons.ingresa_cba === true || String(ultimaCons.ingresa_cba).toUpperCase() === 'SI';
              if (esCba !== !!historia.ingresa_cba) {
                historia.ingresa_cba = esCba;
                historia.canil_asignado = ultimaCons.canil_asignado || historia.canil_asignado || '';
                historia.motivo_ingreso_cba = ultimaCons.motivo_ingreso_cba || historia.motivo_ingreso_cba || '';
                this.aplicarFiltros();
              }
            }
          }

          this.cdr.detectChanges();
        },
        error: () => {}
      });
    });
  }

  /**
   * Contadores de Hospitalizados CBA vs Historias Normales
   */
  get totalHospitalizados(): number {
    return this.historias.filter(h => !!h.ingresa_cba).length;
  }

  get totalNormales(): number {
    return this.historias.filter(h => !h.ingresa_cba).length;
  }

  cambiarVistaHospitalizados(hospitalizados: boolean): void {
    this.mostrarHospitalizados = hospitalizados;
    this.aplicarFiltros();
    this.cdr.detectChanges();
  }

  alternarVistaHospitalizados(): void {
    this.mostrarHospitalizados = !this.mostrarHospitalizados;
    this.aplicarFiltros();
    this.cdr.detectChanges();
  }

  /**
   * Aplica filtros de hospitalizados CBA, texto y estado general
   */
  aplicarFiltros(): void {
    const q = (this.filtroBusqueda || '').trim().toLowerCase();

    this.historiasFiltradas = this.historias.filter((h) => {
      // 1. Separación estricta entre Hospitalizados (Ingresa al CBA) y Apartado Normal
      const esHospitalizado = !!h.ingresa_cba;
      if (this.mostrarHospitalizados && !esHospitalizado) return false;
      if (!this.mostrarHospitalizados && esHospitalizado) return false;

      // 2. Coincidencia con estado general
      const coincideEstado =
        this.filtroEstado === 'Todos' ||
        h.estado_general?.toLowerCase() === this.filtroEstado.toLowerCase();

      if (!coincideEstado) return false;

      // 3. Coincidencia con texto de búsqueda
      if (!q) return true;

      const numHist = String(h.numero_historia || '').toLowerCase();
      const numRad = String(h.numero_radicado || '').toLowerCase();
      const idHist = String(h.id_historia || '').toLowerCase();
      const idAnimal = String(h.id_animal || '').toLowerCase();
      const nombre = String(h.animal_nombre || '').toLowerCase();
      const especie = String(h.animal_especie || '').toLowerCase();
      const estado = String(h.estado_general || '').toLowerCase();
      const vacunas = String(h.vacunas || '').toLowerCase();
      const producto = String(h.producto_desparasitacion || '').toLowerCase();
      const canil = String(h.canil_asignado || '').toLowerCase();

      return (
        numHist.includes(q) ||
        numRad.includes(q) ||
        idHist === q ||
        idAnimal.includes(q) ||
        nombre.includes(q) ||
        especie.includes(q) ||
        estado.includes(q) ||
        vacunas.includes(q) ||
        producto.includes(q) ||
        canil.includes(q)
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

  verDetalleCompletoHistoria(historia: HistoriaClinicaItem): void {
    if (!historia) return;
    this.historiaSeleccionada = historia;
    const fechaStr = historia.fecha_apertura || new Date().toISOString();

    const baseConsulta: any = {
      id_consulta: historia.id_consulta || null,
      id_historia: historia.id_historia || null,
      id_animal: historia.id_animal || null,
      titulo: 'CONSULTA MÉDICA VETERINARIA',
      motivo_consulta: historia.evolucion_previa || 'Evaluación médica y control clínico general',
      anamnesis: historia.enfermedades_anteriores || historia.evolucion_previa || '',
      peso: historia.animal_peso ? Number(historia.animal_peso) : null,
      temperatura: 38.5,
      frecuencia_cardiaca: 110,
      frecuencia_respiratoria: 24,
      diagnostico: historia.enfermedades_anteriores || 'Evaluación médica general estable.',
      diagnostico_diferencial: '',
      plan_tratamiento: historia.tratamientos_anteriores || 'Manejo clínico y seguimiento médico.',
      fecha_hora: fechaStr,
      fecha_formateada: this.formatearFechaLarga(fechaStr),
      hora_formateada: this.formatearHora(fechaStr),
      mes_ano: this.formatearMesAno(fechaStr),
      veterinario: this.obtenerVeterinarioSesion(),
      prioridad: 'Normal',
      ingresa_cba: historia.ingresa_cba ? 'SI' : 'NO',
      canil_asignado: historia.canil_asignado || '',
      motivo_cba: historia.motivo_ingreso_cba || '',
      funcionario_recibe: historia.funcionario_recibe_cba || ''
    };

    this.verDetalleCompletoConsulta(baseConsulta);
  }

  verDetalleCompletoConsulta(c: any): void {
    this.consultaDetalleSeleccionada = { ...c };
    this.modalDetalleConsultaIndividual = true;
    this.cargandoDetalleIndividual = true;

    const idCons = c.id_consulta && Number(c.id_consulta) < 1000000000 ? Number(c.id_consulta) : null;
    const idAnim = c.id_animal || this.historiaSeleccionada?.id_animal || null;
    const idHist = c.id_historia || this.historiaSeleccionada?.id_historia || null;
    const nombrePac = this.historiaSeleccionada?.animal_nombre || '';
    const idTarget = idCons || idHist || idAnim;

    if (idTarget) {
      this.historiaService.obtenerHistoria(idTarget, nombrePac, idAnim).subscribe({
        next: (data: any) => {
          this.cargandoDetalleIndividual = false;
          if (data) {
            this.consultaDetalleSeleccionada = {
              ...this.consultaDetalleSeleccionada,
              ...data,
              id_consulta: data.id_consulta || idCons || this.consultaDetalleSeleccionada.id_consulta,
              titulo: this.normalizarTituloConsulta(data.motivo_consulta || data.motivoConsulta || this.consultaDetalleSeleccionada.titulo),
              motivo_consulta: data.motivo_consulta || data.motivoConsulta || this.consultaDetalleSeleccionada.motivo_consulta || this.consultaDetalleSeleccionada.titulo,
              anamnesis: data.anamnesis || data.evolucion || data.anamnesicos?.evolucion || this.consultaDetalleSeleccionada.anamnesis || '',
              peso: data.paciente?.peso ?? data.examenClinico?.peso ?? data.animal?.peso ?? this.consultaDetalleSeleccionada.peso,
              temperatura: data.temperatura ?? data.constantes?.temperatura ?? data.examenClinico?.temperatura ?? this.consultaDetalleSeleccionada.temperatura,
              frecuencia_cardiaca: data.frecuencia_cardiaca ?? data.constantes?.frecuencia_cardiaca ?? data.examenClinico?.frecuenciaCardiaca ?? this.consultaDetalleSeleccionada.frecuencia_cardiaca,
              frecuencia_respiratoria: data.frecuencia_respiratoria ?? data.constantes?.frecuencia_respiratoria ?? data.examenClinico?.frecuenciaRespiratoria ?? this.consultaDetalleSeleccionada.frecuencia_respiratoria,
              pulso: data.pulso || data.constantes?.pulso || data.examenClinico?.pulso || 'Normal',
              tllc: data.tllc || data.constantes?.tllc || data.examenClinico?.tiempoLlenadoCapilar || '2 seg',
              mucosas: data.mucosas || data.constantes?.mucosas || data.examenClinico?.mucosas || 'Rosadas',
              ganglios_linfaticos: data.ganglios_linfaticos || data.constantes?.ganglios_linfaticos || data.examenClinico?.gangliosLinfaticos || 'Normales',
              actitud_temperamento: data.actitud_temperamento || data.constantes?.actitud_temperamento || data.examenClinico?.actitudTemperamento || 'Alerta / Responsivo',
              sistemas: data.organos_sistemas || data.evaluacion_sistemas || data.organosSistemas || {},
              observaciones_sistemas: data.observaciones_sistemas || data.observaciones_examen || data.organosSistemas?.observaciones || '',
              diagnostico: data.diagnostico_principal || data.hoja2?.diagnosticoFinal || this.consultaDetalleSeleccionada.diagnostico,
              diagnostico_diferencial: data.diagnostico_diferencial || data.hoja2?.diagnosticoDiferencial || this.consultaDetalleSeleccionada.diagnostico_diferencial || '',
              lista_problemas: Array.isArray(data.lista_problemas)
                ? data.lista_problemas
                : (data.lista_problemas ? [data.lista_problemas] : []),
              pronostico: data.pronostico || data.hoja2?.pronostico || 'Favorable',
              plan_tratamiento: data.plan_tratamiento || data.plan_procedimientos || data.hoja2?.planProcedimientos || this.consultaDetalleSeleccionada.plan_tratamiento,
              materiales_utilizados: data.materiales_utilizados || data.hoja2?.materialesUtilizados || '',
              tratamientos: Array.isArray(data.tratamientos) ? data.tratamientos : (this.consultaDetalleSeleccionada.tratamientos || []),
              examenes: data.examenes_solicitados || data.hoja2?.examenes || {},
              ingresa_cba: (data.ingresa_cba === true || data.ingresa_cba === 'SI' || this.historiaSeleccionada?.ingresa_cba) ? 'SI' : 'NO',
              motivo_cba: data.motivo_ingreso_cba || this.historiaSeleccionada?.motivo_ingreso_cba || '',
              canil_asignado: data.canil_asignado || this.historiaSeleccionada?.canil_asignado || '',
              funcionario_recibe: data.funcionario_recibe_cba || this.historiaSeleccionada?.funcionario_recibe_cba || '',
              veterinario: data.nombre_veterinario || this.consultaDetalleSeleccionada.veterinario || this.obtenerVeterinarioSesion()
            };

            const fotoRaw = data.paciente?.foto_url || data.animal?.fotoUrl || data.animal?.foto_url || '';
            if (fotoRaw) {
              const fotoDetalle = this.normalizarUrlFoto(fotoRaw);
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
    const diagTexto = (this.nuevoRegistroHistorial.diagnostico || 'Evaluación médica registrada con éxito.').trim();
    const planTexto = (this.nuevoRegistroHistorial.planTratamiento || 'Tratamiento y seguimiento.').trim();
    const payload = {
      id_animal: this.historiaSeleccionada.id_animal,
      animal: {
        id_animal: this.historiaSeleccionada.id_animal,
        nombre: this.historiaSeleccionada.animal_nombre || 'Paciente',
        especie: this.historiaSeleccionada.animal_especie || 'Canino',
        raza: this.historiaSeleccionada.animal_raza || 'Mestizo',
        sexo: this.historiaSeleccionada.animal_sexo || 'Macho',
        peso: this.nuevoRegistroHistorial.peso || Number(this.historiaSeleccionada.animal_peso) || 3.0
      },
      motivoConsulta: motivoTexto,
      prioridad: this.nuevoRegistroHistorial.prioridad || 'Normal',
      anamnesicos: {
        evolucion: `Atención clínica de ${this.nuevoRegistroHistorial.tipo}.`,
        tratamientos: planTexto
      },
      examenClinico: {
        temperatura: this.nuevoRegistroHistorial.temperatura,
        peso: this.nuevoRegistroHistorial.peso || Number(this.historiaSeleccionada.animal_peso) || 3.0,
        frecuenciaCardiaca: this.nuevoRegistroHistorial.frecuenciaCardiaca,
        frecuencia_cardiaca: this.nuevoRegistroHistorial.frecuenciaCardiaca,
        frecuenciaRespiratoria: this.nuevoRegistroHistorial.frecuenciaRespiratoria,
        frecuencia_respiratoria: this.nuevoRegistroHistorial.frecuenciaRespiratoria,
        actitudTemperamento: 'Alerta / Responsivo',
        actitud_temperamento: 'Alerta / Responsivo',
        condicionCorporal: 'Estable',
        resultado_estado: 'Estable'
      },
      hoja2: {
        diagnosticoFinal: diagTexto,
        diagnosticoPresuntivo: diagTexto,
        diagnosticoPrincipal: diagTexto,
        diagnosticoDiferencial: '',
        listaProblemas: '',
        evolucion: `Atención clínica de ${this.nuevoRegistroHistorial.tipo}.`,
        pronostico: 'Favorable',
        planProcedimientos: planTexto,
        materialesUtilizados: '',
        tratamientos: []
      },
      hoja3: {
        planProcedimientos: planTexto,
        plan_procedimientos: planTexto,
        materialesUtilizados: '',
        materiales_utilizados: '',
        ingresaCBA: this.historiaSeleccionada.ingresa_cba ? 'SI' : 'NO',
        ingresa_cba: !!this.historiaSeleccionada.ingresa_cba,
        canilAsignado: this.historiaSeleccionada.canil_asignado || '',
        motivoIngresoNoIngreso: this.historiaSeleccionada.motivo_ingreso_cba || '',
        funcionarioRecibeCBA: this.historiaSeleccionada.funcionario_recibe_cba || ''
      }
    };

    this.historiaService.crearExpedienteCompleto(payload).subscribe({
      next: (resp) => {
        this.guardandoEnHistorial = false;
        this.modalCrearEnHistorial = false;

        const fechaAhora = new Date().toISOString();
        const idConsultaCreada = Number(resp?.consulta_id || resp?.id_consulta || this.historiaSeleccionada?.id_consulta || 0);
        if (idConsultaCreada > 0) {
          this.historiaService.crearSeguimientoClinico({
            id_consulta: idConsultaCreada,
            evolucion: `${this.nuevoRegistroHistorial.tipo}: ${this.nuevoRegistroHistorial.diagnostico || motivoTexto}`,
            temperatura: this.nuevoRegistroHistorial.temperatura,
            frecuencia_cardiaca: this.nuevoRegistroHistorial.frecuenciaCardiaca,
            frecuencia_respiratoria: this.nuevoRegistroHistorial.frecuenciaRespiratoria,
            peso: this.nuevoRegistroHistorial.peso || Number(this.historiaSeleccionada?.animal_peso) || null,
            plan_tratamiento: planTexto
          }).subscribe();
        }

        const nuevaTarjeta = {
          id_consulta: idConsultaCreada || Date.now(),
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

  // =========================================================================
  // MÉTODOS DEL MODAL EDITAR DATOS DEL ANIMAL (BIOMETRÍA Y RESCATE CBA)
  // =========================================================================
  abrirModalEditarAnimal(historia: any): void {
    if (!historia) return;
    const idAnim = Number(historia.id_animal);
    const animalCache = (idAnim && !isNaN(idAnim)) ? (this.mapaAnimales.get(idAnim) || {}) : {};

    this.animalEnEdicion = {
      id_animal: (idAnim && !isNaN(idAnim)) ? idAnim : null,
      id_historia: historia.id_historia || null,
      id_consulta: historia.id_consulta || null,
      nombre: historia.animal_nombre || animalCache.nombre || '',
      especie: historia.animal_especie || animalCache.especie || 'Canino',
      raza: historia.animal_raza || animalCache.raza || 'Mestizo',
      sexo: historia.animal_sexo || animalCache.sexo || 'Macho',
      esterilizado: animalCache.esterilizado ?? false,
      edad_aproximada: animalCache.edad_aproximada || '',
      fecha_nacimiento: animalCache.fecha_nacimiento || '',
      peso: historia.animal_peso ? Number(historia.animal_peso) : (animalCache.peso ? Number(animalCache.peso) : null),
      color: animalCache.color || '',
      microchip: animalCache.microchip || '',
      caracteristicas: animalCache.caracteristicas || '',
      observaciones: animalCache.observaciones || '',
      foto_url: historia.animal_foto || animalCache.foto_url || '',
      estado_general: historia.estado_general || 'Estable',
      disponible_adopcion: animalCache.disponible_adopcion ?? false,
      ingresa_cba: !!historia.ingresa_cba,
      canil_asignado: historia.canil_asignado || '',
      motivo_ingreso_cba: historia.motivo_ingreso_cba || '',
      funcionario_recibe_cba: historia.funcionario_recibe_cba || ''
    };

    this.modalEditarAnimalAbierto = true;

    // Si conocemos id_animal válido, consultamos el registro completo del animal desde el backend
    if (idAnim && !isNaN(idAnim) && idAnim > 0) {
      const urlAnimal = `${environment.apiUrlAnimales || (environment.apiUrlClinica.replace(/\/clinica\/$/, '/animales/animales/'))}${idAnim}/`;
      this.http.get<any>(urlAnimal, { headers: this.authHeaders }).subscribe({
        next: (data) => {
          if (data) {
            if (data.nombre) this.animalEnEdicion.nombre = data.nombre;
            if (data.sexo) this.animalEnEdicion.sexo = data.sexo;
            if (data.color) this.animalEnEdicion.color = data.color;
            if (data.peso !== undefined && data.peso !== null) this.animalEnEdicion.peso = Number(data.peso);
            if (data.esterilizado !== undefined) this.animalEnEdicion.esterilizado = Boolean(data.esterilizado);
            if (data.caracteristicas) this.animalEnEdicion.caracteristicas = data.caracteristicas;
            if (data.observaciones) this.animalEnEdicion.observaciones = data.observaciones;
            if (data.foto_url) this.animalEnEdicion.foto_url = this.normalizarUrlFoto(data.foto_url);
            if (data.fecha_nacimiento) this.animalEnEdicion.fecha_nacimiento = data.fecha_nacimiento;
            if (data.disponible_adopcion !== undefined) this.animalEnEdicion.disponible_adopcion = Boolean(data.disponible_adopcion);
            this.cdr.detectChanges();
          }
        },
        error: () => {}
      });
    }
  }

  cerrarModalEditarAnimal(): void {
    this.modalEditarAnimalAbierto = false;
    this.guardandoEdicionAnimal = false;
  }

  onFotoAnimalSeleccionada(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.animalEnEdicion.foto_url = reader.result as string;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }

  guardarEdicionAnimal(): void {
    if (!this.animalEnEdicion.nombre.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Nombre requerido',
        text: 'Por favor asigna o ingresa el nombre o alias del animal rescatado.',
        confirmButtonColor: '#4141a5'
      });
      return;
    }

    this.guardandoEdicionAnimal = true;
    const idAnim = this.animalEnEdicion.id_animal;

    // Si el animal se envía a adopción, recibe el alta médica (fuera de peligro = Estable y sale de Hospitalizados)
    if (this.animalEnEdicion.disponible_adopcion) {
      this.animalEnEdicion.ingresa_cba = false;
      if (this.animalEnEdicion.estado_general === 'Crítico' || this.animalEnEdicion.estado_general === 'Delicado') {
        this.animalEnEdicion.estado_general = 'Estable';
      }
    }

    const descripcionAdopcion =
      this.animalEnEdicion.observaciones.trim() ||
      this.animalEnEdicion.caracteristicas.trim() ||
      `Paciente ${this.animalEnEdicion.nombre.trim()} (${this.animalEnEdicion.especie} · ${this.animalEnEdicion.raza}), recuperado satisfactoriamente en el CBA, fuera de peligro y apto para adopción responsable.`;

    const payloadAnimal: any = {
      nombre: this.animalEnEdicion.nombre.trim(),
      sexo: this.animalEnEdicion.sexo,
      color: this.animalEnEdicion.color.trim(),
      peso: this.animalEnEdicion.peso !== null && this.animalEnEdicion.peso !== undefined ? Number(this.animalEnEdicion.peso) : null,
      esterilizado: Boolean(this.animalEnEdicion.esterilizado),
      caracteristicas: this.animalEnEdicion.caracteristicas.trim() || (this.animalEnEdicion.disponible_adopcion ? descripcionAdopcion : ''),
      observaciones: this.animalEnEdicion.observaciones.trim() || (this.animalEnEdicion.disponible_adopcion ? descripcionAdopcion : ''),
      foto_url: this.animalEnEdicion.foto_url.trim() || null,
      disponible_adopcion: Boolean(this.animalEnEdicion.disponible_adopcion)
    };

    if (this.animalEnEdicion.fecha_nacimiento) {
      payloadAnimal.fecha_nacimiento = this.animalEnEdicion.fecha_nacimiento;
    }

    const urlAnimal = (idAnim && idAnim > 0)
      ? `${environment.apiUrlAnimales || (environment.apiUrlClinica.replace(/\/clinica\/$/, '/animales/animales/'))}${idAnim}/`
      : null;

    // Sincronizar también con el endpoint de Adopciones (/api/adopciones/{id}/)
    if (idAnim && idAnim > 0) {
      const baseUrl = (environment.backendUrl || BACKEND_CLOUD_URL || 'https://backendvetericano-production.up.railway.app').replace(/\/+$/, '');
      const urlAdopcion = `${baseUrl}/api/adopciones/${idAnim}/`;
      this.http.put<any>(
        urlAdopcion,
        {
          nombre: payloadAnimal.nombre,
          raza: this.animalEnEdicion.raza || 'Mestizo',
          imagen: payloadAnimal.foto_url || '',
          descripcion: descripcionAdopcion,
          estado: this.animalEnEdicion.disponible_adopcion ? 'Disponible' : 'No Disponible'
        },
        { headers: this.authHeaders }
      ).pipe(catchError(() => of(null))).subscribe();
    }

    const finalizarActualizacion = () => {
      const ingresaCbaBool = Boolean(this.animalEnEdicion.ingresa_cba);
      const disponibleAdopBool = !ingresaCbaBool && Boolean(this.animalEnEdicion.disponible_adopcion);
      const canilStr = (this.animalEnEdicion.canil_asignado || '').trim();
      const motivoCbaStr = (this.animalEnEdicion.motivo_ingreso_cba || '').trim();
      const funcCbaStr = (this.animalEnEdicion.funcionario_recibe_cba || '').trim();

      // Guardar estado de hospitalización CBA y adopción en caché local sincronizado
      this.historiaService.guardarEstadoCbaLocal(
        this.animalEnEdicion.id_historia,
        idAnim,
        ingresaCbaBool,
        {
          canil_asignado: canilStr,
          motivo_ingreso_cba: motivoCbaStr,
          funcionario_recibe_cba: funcCbaStr
        }
      );

      this.historiaService.guardarEstadoAdopcionLocal(idAnim, disponibleAdopBool, {
        id_historia: this.animalEnEdicion.id_historia,
        numero_historia: this.animalEnEdicion.id_historia ? `HC-${this.animalEnEdicion.id_historia}` : '',
        nombre: this.animalEnEdicion.nombre.trim(),
        especie: this.animalEnEdicion.especie,
        raza: this.animalEnEdicion.raza || 'Mestizo',
        imagen: this.animalEnEdicion.foto_url || '',
        descripcion: descripcionAdopcion,
        estado: disponibleAdopBool ? 'Disponible' : 'No Disponible'
      });

      if (this.animalEnEdicion.id_historia) {
        const idHistNum = Number(this.animalEnEdicion.id_historia);
        const prevCons = this.mapaConsultasPorHistoria.get(idHistNum) || {};
        this.mapaConsultasPorHistoria.set(idHistNum, {
          ...prevCons,
          ingresa_cba: ingresaCbaBool,
          canil_asignado: canilStr,
          motivo_ingreso_cba: motivoCbaStr,
          funcionario_recibe_cba: funcCbaStr
        });
      }

      // 1. Actualizar historiaSeleccionada si está activa en pantalla
      if (this.historiaSeleccionada) {
        this.historiaSeleccionada.animal_nombre = this.animalEnEdicion.nombre;
        this.historiaSeleccionada.animal_especie = this.animalEnEdicion.especie;
        this.historiaSeleccionada.animal_raza = this.animalEnEdicion.raza;
        this.historiaSeleccionada.animal_sexo = this.animalEnEdicion.sexo;
        this.historiaSeleccionada.animal_peso = this.animalEnEdicion.peso;
        if (this.animalEnEdicion.foto_url) {
          this.historiaSeleccionada.animal_foto = this.animalEnEdicion.foto_url;
        }
        this.historiaSeleccionada.estado_general = this.animalEnEdicion.estado_general;
        this.historiaSeleccionada.ingresa_cba = ingresaCbaBool;
        this.historiaSeleccionada.disponible_adopcion = disponibleAdopBool;
        this.historiaSeleccionada.canil_asignado = canilStr;
        this.historiaSeleccionada.motivo_ingreso_cba = motivoCbaStr;
        this.historiaSeleccionada.funcionario_recibe_cba = funcCbaStr;
      }

      // 2. Actualizar en el arreglo de historias de la vista
      const histEnLista = this.historias.find(h =>
        (this.animalEnEdicion.id_historia && Number(h.id_historia) === Number(this.animalEnEdicion.id_historia)) ||
        (idAnim && Number(h.id_animal) === Number(idAnim))
      );
      if (histEnLista) {
        histEnLista.animal_nombre = this.animalEnEdicion.nombre;
        histEnLista.animal_especie = this.animalEnEdicion.especie;
        histEnLista.animal_raza = this.animalEnEdicion.raza;
        histEnLista.animal_sexo = this.animalEnEdicion.sexo;
        histEnLista.animal_peso = this.animalEnEdicion.peso;
        if (this.animalEnEdicion.foto_url) {
          histEnLista.animal_foto = this.animalEnEdicion.foto_url;
        }
        histEnLista.estado_general = this.animalEnEdicion.estado_general;
        histEnLista.ingresa_cba = ingresaCbaBool;
        histEnLista.disponible_adopcion = disponibleAdopBool;
        histEnLista.canil_asignado = canilStr;
        histEnLista.motivo_ingreso_cba = motivoCbaStr;
        histEnLista.funcionario_recibe_cba = funcCbaStr;
      }

      // 3. Actualizar memoria local en mapaAnimales
      if (idAnim) {
        const prev = this.mapaAnimales.get(Number(idAnim)) || {};
        this.mapaAnimales.set(Number(idAnim), {
          ...prev,
          ...this.animalEnEdicion,
          disponible_adopcion: disponibleAdopBool,
          foto_url: this.animalEnEdicion.foto_url || prev.foto_url
        });
      }

      this.aplicarFiltros();
      this.guardandoEdicionAnimal = false;
      this.cerrarModalEditarAnimal();
      this.cdr.detectChanges();

      Swal.fire({
        icon: 'success',
        title: disponibleAdopBool ? '¡Enviado a Adopción!' : '¡Ficha del paciente actualizada!',
        text: disponibleAdopBool
          ? `${this.animalEnEdicion.nombre} recibió el alta médica (Estable), su historia clínica permanece en el listado normal y ya figura Disponible en el módulo de Adopciones.`
          : `Los datos del animal ${this.animalEnEdicion.nombre} se guardaron exitosamente en el sistema.`,
        confirmButtonColor: '#4141a5'
      });
    };

    // Si tiene historia clínica vinculada, actualizamos estado_general e ingresa_cba en sus consultas
    if (this.animalEnEdicion.id_historia) {
      const urlHistoria = `${environment.apiUrlHistorias || (environment.apiUrlClinica + 'historias/')}${this.animalEnEdicion.id_historia}/`;
      this.http.patch<any>(urlHistoria, { estado_general: this.animalEnEdicion.estado_general }, { headers: this.authHeaders }).subscribe({
        error: () => {}
      });

      const urlConsHist = `${environment.apiUrlClinica}consultas/?id_historia=${this.animalEnEdicion.id_historia}`;
      this.http.get<any>(urlConsHist, { headers: this.authHeaders }).pipe(catchError(() => of(null))).subscribe({
        next: (resCons) => {
          const arrCons = Array.isArray(resCons) ? resCons : (resCons?.results || []);
          const filtradas = arrCons.filter((c: any) => Number(c?.id_historia) === Number(this.animalEnEdicion.id_historia));
          filtradas.forEach((c: any) => {
            if (c?.id_consulta) {
                this.http.patch(
                  `${environment.apiUrlClinica}consultas/${c.id_consulta}/`,
                  {
                    ingresa_cba: Boolean(this.animalEnEdicion.ingresa_cba),
                    canil_asignado: (this.animalEnEdicion.canil_asignado || '').trim(),
                    motivo_ingreso_cba: (this.animalEnEdicion.motivo_ingreso_cba || '').trim(),
                    funcionario_recibe_cba: (this.animalEnEdicion.funcionario_recibe_cba || '').trim()
                  },
                  { headers: this.authHeaders }
                ).pipe(catchError(() => of(null))).subscribe();

                if (Boolean(this.animalEnEdicion.ingresa_cba)) {
                  this.historiaService.sincronizarHospitalizacionCba(Number(c.id_consulta), true, {
                    descripcion_estado: `${this.animalEnEdicion.estado_general || 'En observación'} — ${this.animalEnEdicion.motivo_ingreso_cba || 'Hospitalización CBA'}`,
                    diagnostico_presuntivo: this.animalEnEdicion.observaciones || 'Paciente hospitalizado en CBA',
                    responsable_clinico: this.animalEnEdicion.funcionario_recibe_cba || this.obtenerVeterinarioSesion(),
                    hoja_numero: 1
                  }).subscribe();
                }
              }
            });
          }
        });
      }

      if (idAnim && idAnim > 0) {
        const estadoNombre = this.animalEnEdicion.disponible_adopcion
          ? 'Disponible para Adopción'
          : (this.animalEnEdicion.ingresa_cba ? 'Hospitalizado CBA' : (this.animalEnEdicion.estado_general || 'Estable'));
        this.historiaService.registrarEstadoAnimal(
          Number(idAnim),
          estadoNombre,
          this.animalEnEdicion.disponible_adopcion
            ? descripcionAdopcion
            : (this.animalEnEdicion.motivo_ingreso_cba || this.animalEnEdicion.observaciones || '')
        ).subscribe();
      }

    if (urlAnimal) {
      this.http.patch<any>(urlAnimal, payloadAnimal, { headers: this.authHeaders }).subscribe({
        next: () => {
          finalizarActualizacion();
        },
        error: (err) => {
          console.warn('Error en PATCH a /api/animales/animales/, persistiendo localmente:', err);
          finalizarActualizacion();
        }
      });
    } else {
      finalizarActualizacion();
    }
  }

  /**
   * Da el alta médica de hospitalización CBA (fuera de peligro = Estable) y envía al animal al módulo de Adopciones,
   * conservando su Historia Clínica abierta en el apartado normal por si regresa a control o reingreso.
   */
  enviarAAdopcion(historia: HistoriaClinicaItem): void {
    if (!historia) return;

    const idAnim = Number(historia.id_animal);
    const idHist = Number(historia.id_historia);
    const animalCache = (idAnim && !isNaN(idAnim)) ? (this.mapaAnimales.get(idAnim) || {}) : {};
    const descripcionPorDefecto =
      animalCache.observaciones ||
      animalCache.caracteristicas ||
      `${historia.animal_nombre || 'Paciente'} (${historia.animal_especie || 'Canino'} · ${historia.animal_raza || 'Mestizo'}) fue atendido y recuperado satisfactoriamente en el Centro de Bienestar Animal (CBA). Se encuentra fuera de peligro, en estado clínico estable y apto para adopción responsable.`;

    Swal.fire({
      title: `¿Dar alta y enviar a Adopción a ${historia.animal_nombre}?`,
      html: `
        <div style="text-align:left; font-size:13px; color:#334155; line-height:1.5;">
          <p style="margin-bottom:8px;">
            • <strong>Alta de Hospitalización CBA:</strong> Pasará a estado <strong>Estable</strong> (fuera de peligro) y saldrá de <em>Hospitalizados</em>.<br/>
            • <strong>Historia Clínica (${historia.numero_historia}):</strong> Permanecerá abierta en el listado <em>Normal</em> con todo su historial por si vuelve a consulta o reingreso.<br/>
            • <strong>Módulo de Adopciones:</strong> Quedará publicado inmediatamente como <strong>Disponible</strong>.
          </p>
          <label style="display:block; font-weight:700; color:#170B3D; margin-top:10px; margin-bottom:4px;">Descripción para la ficha de Adopción:</label>
        </div>
      `,
      input: 'textarea',
      inputValue: descripcionPorDefecto,
      inputPlaceholder: 'Describe el carácter, recuperación y estado del animal para su adopción...',
      showCancelButton: true,
      confirmButtonColor: '#4141a5',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Confirmar Alta y Enviar a Adopción',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) return;

      const descripcionFinal = String(result.value || descripcionPorDefecto).trim() || descripcionPorDefecto;
      const fotoAnimal = historia.animal_foto || animalCache.foto_url || '';

      // 1. Actualizar estado en memoria y caché sincronizado
      historia.ingresa_cba = false;
      historia.estado_general = 'Estable';
      historia.disponible_adopcion = true;

      if (this.historiaSeleccionada && Number(this.historiaSeleccionada.id_historia) === idHist) {
        this.historiaSeleccionada.ingresa_cba = false;
        this.historiaSeleccionada.estado_general = 'Estable';
        this.historiaSeleccionada.disponible_adopcion = true;
      }

      this.historiaService.guardarEstadoCbaLocal(idHist, idAnim, false, {
        canil_asignado: '',
        motivo_ingreso_cba: 'Alta médica de hospitalización CBA — Enviado a Adopción',
        funcionario_recibe_cba: historia.funcionario_recibe_cba || this.obtenerVeterinarioSesion()
      });

      this.historiaService.guardarEstadoAdopcionLocal(idAnim, true, {
        id_historia: idHist,
        numero_historia: historia.numero_historia,
        nombre: historia.animal_nombre || 'Paciente',
        especie: historia.animal_especie || 'Canino',
        raza: historia.animal_raza || 'Mestizo',
        imagen: fotoAnimal,
        descripcion: descripcionFinal,
        estado: 'Disponible'
      });

      if (idHist > 0) {
        const prevCons = this.mapaConsultasPorHistoria.get(idHist) || {};
        this.mapaConsultasPorHistoria.set(idHist, {
          ...prevCons,
          ingresa_cba: false
        });
      }

      if (idAnim > 0) {
        const prevAnim = this.mapaAnimales.get(idAnim) || {};
        this.mapaAnimales.set(idAnim, {
          ...prevAnim,
          disponible_adopcion: true,
          caracteristicas: descripcionFinal,
          observaciones: descripcionFinal,
          foto_url: fotoAnimal || prevAnim.foto_url || ''
        });
      }

      // 2. Actualizar en PostgreSQL: HistoriaClinica, Consultas, Animal y Adopciones
      if (idHist > 0) {
        const urlHistoria = `${environment.apiUrlHistorias || (environment.apiUrlClinica + 'historias/')}${idHist}/`;
        this.http.patch(urlHistoria, { estado_general: 'Estable' }, { headers: this.authHeaders }).pipe(catchError(() => of(null))).subscribe();

        const urlConsHist = `${environment.apiUrlClinica}consultas/?id_historia=${idHist}`;
        this.http.get<any>(urlConsHist, { headers: this.authHeaders }).pipe(catchError(() => of(null))).subscribe({
          next: (resCons) => {
            const arrCons = Array.isArray(resCons) ? resCons : (resCons?.results || []);
            const filtradas = arrCons.filter((c: any) => Number(c?.id_historia) === idHist);
            filtradas.forEach((c: any) => {
              if (c?.id_consulta) {
                this.http.patch(
                  `${environment.apiUrlClinica}consultas/${c.id_consulta}/`,
                  { ingresa_cba: false, resultado_estado: 'Estable' },
                  { headers: this.authHeaders }
                ).pipe(catchError(() => of(null))).subscribe();
              }
            });
          }
        });
      }

      if (idAnim > 0) {
        const urlAnimal = `${environment.apiUrlAnimales || (environment.apiUrlClinica.replace(/\/clinica\/$/, '/animales/animales/'))}${idAnim}/`;
        this.http.patch(
          urlAnimal,
          {
            disponible_adopcion: true,
            caracteristicas: descripcionFinal,
            observaciones: descripcionFinal,
            ...(fotoAnimal ? { foto_url: fotoAnimal } : {})
          },
          { headers: this.authHeaders }
        ).pipe(catchError(() => of(null))).subscribe();

        const baseUrl = (environment.backendUrl || BACKEND_CLOUD_URL || 'https://backendvetericano-production.up.railway.app').replace(/\/+$/, '');
        const urlAdopcion = `${baseUrl}/api/adopciones/${idAnim}/`;
        this.http.put(
          urlAdopcion,
          {
            nombre: historia.animal_nombre || 'Paciente',
            raza: historia.animal_raza || 'Mestizo',
            imagen: fotoAnimal || '',
            descripcion: descripcionFinal,
            estado: 'Disponible'
          },
          { headers: this.authHeaders }
        ).pipe(catchError(() => of(null))).subscribe();

        this.historiaService.registrarEstadoAnimal(
          idAnim,
          'Disponible para Adopción',
          `Alta médica de hospitalización CBA — ${descripcionFinal}`
        ).subscribe();
      }

      this.aplicarFiltros();
      this.cdr.detectChanges();

      Swal.fire({
        icon: 'success',
        title: '¡Alta médica y enviado a Adopción!',
        text: `${historia.animal_nombre} ya está disponible en Adopciones y su historia clínica (${historia.numero_historia}) quedó guardada en el apartado normal.`,
        confirmButtonColor: '#4141a5',
        showCancelButton: true,
        confirmButtonText: 'Ir a Adopciones',
        cancelButtonText: 'Ver en Historias Normales'
      }).then((resNav) => {
        if (resNav.isConfirmed) {
          this.router.navigate(['/inicio-admin/adopciones']);
        } else {
          this.cambiarVistaHospitalizados(false);
        }
      });
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
      estadoGeneral: 'Estable',
      ingresaCBA: this.mostrarHospitalizados ? 'SI' : 'NO',
      canilAsignado: '',
      motivoIngresoCBA: '',
      funcionarioRecibeCBA: this.obtenerVeterinarioSesion()
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
        ingresaCBA: this.nuevoPaciente.ingresaCBA,
        ingresa_cba: this.nuevoPaciente.ingresaCBA === 'SI',
        canilAsignado: this.nuevoPaciente.ingresaCBA === 'SI' ? (this.nuevoPaciente.canilAsignado || '') : '',
        motivoIngresoNoIngreso: this.nuevoPaciente.ingresaCBA === 'SI'
          ? (this.nuevoPaciente.motivoIngresoCBA || this.nuevoPaciente.motivoConsulta || 'Ingreso y hospitalización en el CBA')
          : 'Atención normal sin ingreso a hospitalización CBA',
        funcionarioRecibeCBA: this.nuevoPaciente.ingresaCBA === 'SI'
          ? (this.nuevoPaciente.funcionarioRecibeCBA || this.obtenerVeterinarioSesion())
          : ''
      }
    };

    const ingresaHospitalizado = this.nuevoPaciente.ingresaCBA === 'SI';

    this.historiaService.crearExpedienteCompleto(payload).subscribe({
      next: (resp) => {
        this.guardandoNuevoPaciente = false;
        this.mostrarHospitalizados = ingresaHospitalizado;
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
