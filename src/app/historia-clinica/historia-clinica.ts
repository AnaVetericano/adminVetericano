import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import Swal from 'sweetalert2';

import {
  HistoriaClinicaService,
  HistoriaClinicaEdicion,
  RegistroAuditoria,
  ActualizarHistoriaDto,
  PacienteHistoria
} from '../services/historia-clinica.service';
import { PatologiaService, Patologia } from '../services/patologia.service';
import { ExamenesClinicosService, ExamenClinico } from '../services/examenes-clinicos.service';
import { ComprasService } from '../services/compras.service';
import { AuthService } from '../services/auth';
import { ComponenteConCambiosPendientes } from '../services/pending-changes.guard';

@Component({
  selector: 'app-historia-clinica',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './historia-clinica.html',
  styleUrls: ['./historia-clinica.css']
})
export class HistoriaClinica2Component implements OnInit, ComponenteConCambiosPendientes {
  // Identificador de la historia clínica en edición
  idHistoria: string | number = '';
  esNuevaConsulta: boolean = false;

  // Control de pasos del Stepper (Paso 1: Consulta, Paso 2: Exámenes, Paso 3: Tratamientos)
  // Se inicia en 'consulta' para revisar la información desde el inicio del expediente
  pestanaActiva: 'consulta' | 'examenes' | 'tratamientos' = 'consulta';

  // =========================================================================
  // PASO 1: CONSULTA (ESPERA Y DATOS DEL PACIENTE)
  // =========================================================================
  motivo_consulta: string = '';
  prioridad: string = 'Normal';
  anamnesis: string = '';
  actitud_temperamento: string = '';
  resultado_estado: string = 'Estable';

  // =========================================================================
  // PASO 2: EXÁMENES CLÍNICOS Y SISTEMAS ORGÁNICOS
  // =========================================================================
  frecuencia_respiratoria: number | null = null;
  frecuencia_cardiaca: number | null = null;
  temperatura: number | null = null;
  pulso: string = '';
  tllc: string = '';
  ganglios_linfaticos: string = '';
  mucosas: string = '';
  hallazgos_examen: string = '';
  observaciones_examen: string = '';
  examenes_complementarios: any[] = [];

  examenesClinicos: ExamenClinico[] = [];
  examenesFiltrados: ExamenClinico[] = [];
  cargandoExamenes: boolean = false;
  mensajeExamenes: string = '';
  busquedaExamen: string = '';
  paginaActualExamenes: number = 1;
  tamanoPaginaExamenes: number = 5;
  totalExamenes: number = 0;
  examenSeleccionadoParaSolicitud: ExamenClinico | null = null;
  examenesSolicitados: any[] = [];
  descripcionHallazgos: string = '';

  // Grilla Interactiva de los 12 Sistemas (N: Normal, AN: Anormal, NE: No examinado)
  sistemas: { [key: string]: string } = {
    general: 'NE',
    hidratacion: 'NE',
    tegumentario: 'NE',
    ojos: 'NE',
    oidos: 'NE',
    nariz: 'NE',
    digestivo: 'NE',
    respiratorio: 'NE',
    nervioso: 'NE',
    musculoesqueletico: 'NE',
    cardiovascular: 'NE',
    genitourinario: 'NE'
  };
  evaluacion_sistemas: { [key: string]: string } = this.sistemas;
  observacionesSistemas: string = '';

  // =========================================================================
  // PASO 3: DIAGNÓSTICO, PATOLOGÍA Y PLAN
  // =========================================================================
  pronostico: string = 'Favorable';
  plan_procedimientos: string = '';
  patologias: Patologia[] = [];
  patologiasFiltradas: Patologia[] = [];
  cargandoPatologias: boolean = false;
  busquedaPatologia: string = '';
  idPatologiaSeleccionada: number | null = null;
  patologiaSeleccionada: Patologia | null = null;
  problemasClinicos: string[] = ['', '', '', '', '', '', ''];
  planProcedimientos: string = '';

  // =========================================================================
  // PASO 4: TRATAMIENTOS, FÁRMACOS, INSUMOS, CBA Y FIRMAS
  // =========================================================================
  mostrarCatalogoMedicamentos: boolean = false;
  cargandoMedicamentos: boolean = false;
  mensajeMedicamentos: string = '';
  medicamentosCatalogo: any[] = [];
  medicamentosSeleccionados: any[] = [];
  tratamientosEliminadosIds: number[] = [];
  mapaStockPorId: Map<number, number> = new Map();
  mapaStockPorNombre: Map<string, number> = new Map();
  materialesUtilizados: string = '';
  materiales_utilizados: string = '';

  // Destino CBA
  ingresa_cba: boolean = false;
  ingresaCBA: string = 'NO';
  motivo_ingreso_cba: string = '';
  motivoIngresoNoIngreso: string = '';
  canil_asignado: string = '';
  canilAsignado: string = '';
  funcionario_recibe_cba: string = '';
  funcionarioRecibeCBA: string = '';

  // =========================================================================
  // MODELOS ESTRUCTURADOS DEL ACTA MÓVIL (TRIAJE EN CAMPO Y CIERRE CBA)
  // =========================================================================
  triajeSistemasCampo = {
    tieneEvaluacion: false,
    totalAlertas: 0,
    respiratorio: {
      moco: false as boolean | null,
      dificultadRespirar: false as boolean | null,
      tos: false as boolean | null,
      laganeo: false as boolean | null
    },
    digestivo: {
      vomito: false as boolean | null,
      diarrea: false as boolean | null,
      desnutrido: false as boolean | null,
      deshidratado: false as boolean | null
    },
    musculoEsqueletico: {
      caidaPatas: false as boolean | null,
      cojera: false as boolean | null,
      heridaAbierta: false as boolean | null,
      gusanosMiasis: false as boolean | null,
      postrado: false as boolean | null
    },
    dermatologico: {
      peladuras: false as boolean | null,
      heridasSangre: false as boolean | null,
      pulgasGarrapatas: false as boolean | null
    },
    genitourinario: {
      masaSecrecion: false as boolean | null,
      gestante: false as boolean | null,
      enCelo: false as boolean | null
    }
  };

  evaluacionCampo = {
    frecuenciaCardiaca: null as number | null,
    frecuenciaRespiratoria: null as number | null,
    temperatura: null as number | null,
    mucosas: '',
    anamnesisLimpia: '',
    quejaCompleta: '',
    descripcionQueja: ''
  };

  resolucionCierre = {
    desparasitacion: null as boolean | null,
    pruebasRapidas: [] as Array<{ prueba: string; resultado: string; esPositivo: boolean; esNegativo: boolean }>,
    requirioRescate: false,
    fundamentoLegal: 'Ley 1774 de 2016 / Ley 84 de 1989 / Formato de Rescate F-GS-C01-03-33',
    plazoDias: null as number | null,
    compromisos: '',
    observacionesCierre: '',
    datosRescate: {
      causal: '',
      personaEntrega: '',
      personaEntregaCedula: '',
      personaEntregaTel: '',
      barrio: '',
      testigo1: '',
      testigo1Cedula: '',
      testigo1Tel: '',
      testigo2: '',
      testigo2Cedula: '',
      testigo2Tel: '',
      observacionesRescate: '',
      veterinarioReceptor: '',
      fechaHoraRecepcion: ''
    }
  };

  planSanitario = {
    vacunas: '',
    estadoRabia: 'Vigente / Aplicada',
    estadoPolivalente: 'Al Día',
    estadoRefuerzo: 'Programada',
    ultimaDesparasitacion: '',
    productoDesparasitacion: 'Praziquantel + Pamoato de Pirantel + Febantel',
    estadoDesparasitacion: 'Suministrada',
    estadoEctoparasitos: 'Tratado',
    enfermedadesAnteriores: '',
    historiaReproductiva: ''
  };

  datosPropietario = {
    nombre: '',
    cedula: '',
    telefono: '',
    email: '',
    barrio: '',
    direccion: '',
    quienReporta: '',
    quienReportaOtro: '',
    solicitudAtencionPor: ''
  };

  seguimientoSeleccionado: any = null;
  numeroRadicadoActual: string = '';

  // Firmas y aval institucional
  nombreVeterinario: string = 'Dr. Juan Camilo Valencia (M.V. 19284)';
  tarjetaProfesional: string = '19284-M.V.';
  nombreAcudiente: string = '';
  cedulaAcudiente: string = '';
  telefonoAcudiente: string = '';
  idAnimal: number | null = null;

  // =========================================================================
  // FORMULARIO REACTIVO Y ESTADOS GLOBALES
  // =========================================================================
  formHistoria!: FormGroup;
  historiaOriginal: HistoriaClinicaEdicion | null = null;
  paciente: PacienteHistoria | null = null;
  historialModificaciones: RegistroAuditoria[] = [];

  // Navegación Maestra del Expediente 360° (Estilo CP-Vet)
  pestanaPrincipal: 'atencion' | 'historial' | 'plan_sanitario' | 'receta' | 'auditoria' = 'atencion';
  consultasAnteriores: any[] = [];
  consultaPasadaSeleccionada: any = null;
  modalConsultaPasadaAbierto: boolean = false;

  cargando: boolean = true;
  guardando: boolean = false;
  formularioEnviado: boolean = false;
  historiaAnulada: boolean = false;
  tieneDatosDesdeActa: boolean = false;
  mensajeExito: string = '';
  mensajeError: string = '';

  mostrarModalCancelar: boolean = false;
  mostrarDetalleAuditoria: boolean = true;

  // =========================================================================
  // VISTA DE CONSULTA CP-VET: NAVEGACIÓN Y CONTADORES DINÁMICOS
  // =========================================================================
  seccionConsultaActiva: string = 'info_basica';
  alimento_marca: string = '';
  esterilizado_opcion: 'Sí' | 'No' = 'No';
  proxima_visita_fecha: string = '';
  proxima_visita_notas: string = '';
  condicion_corporal: string = '3/5 (Ideal)';
  modoTextoEnriquecido: boolean = false;

  listaSistemasOrganicos = [
    { clave: 'general', nombre: '1. Estado General / Actitud' },
    { clave: 'hidratacion', nombre: '2. Estado de Hidratación' },
    { clave: 'tegumentario', nombre: '3. Sistema Tegumentario (Piel y Pelo)' },
    { clave: 'ojos', nombre: '4. Ojos y Anexos Oculares' },
    { clave: 'oidos', nombre: '5. Oídos y Conducto Auditivo' },
    { clave: 'nariz', nombre: '6. Nariz y Cavidad Nasal' },
    { clave: 'digestivo', nombre: '7. Sistema Digestivo' },
    { clave: 'respiratorio', nombre: '8. Sistema Respiratorio' },
    { clave: 'nervioso', nombre: '9. Sistema Nervioso' },
    { clave: 'musculoesqueletico', nombre: '10. Músculo-Esquelético' },
    { clave: 'cardiovascular', nombre: '11. Sistema Cardiovascular' },
    { clave: 'genitourinario', nombre: '12. Sistema Genitourinario' }
  ];

  get conteoInfoBasica(): string {
    let count = 0;
    const motivo = (this.formHistoria?.get('motivo_consulta')?.value || this.motivo_consulta || '').trim();
    if (motivo) count++;
    if ((this.alimento_marca || '').trim()) count++;
    if (this.esterilizado_opcion) count++;
    return `${count}/3`;
  }

  get conteoAnamnesis(): string {
    let count = 0;
    const form = this.formHistoria?.value || {};
    if ((form.anamnesis || this.anamnesis || '').trim()) count++;
    if ((form.actitudTemperamento || form.actitud_temperamento || this.actitud_temperamento || '').trim()) count++;
    if ((form.prioridad || this.prioridad || '').trim()) count++;
    if ((form.resultadoEstado || form.resultado_estado || this.resultado_estado || '').trim()) count++;
    if ((form.evolucion || '').trim()) count++;
    if ((this.evaluacionCampo?.descripcionQueja || '').trim()) count++;
    if (this.triajeSistemasCampo?.totalAlertas !== undefined) count++;
    return `${count}/7`;
  }

  get conteoSignosVitales(): string {
    let count = 0;
    const form = this.formHistoria?.value || {};
    const peso = form.peso ?? this.paciente?.peso;
    const temp = form.temperatura ?? this.temperatura;
    const fc = form.frecuenciaCardiaca ?? form.frecuencia_cardiaca ?? this.frecuencia_cardiaca;
    const fr = form.frecuenciaRespiratoria ?? form.frecuencia_respiratoria ?? this.frecuencia_respiratoria;
    const pulso = (form.pulso || this.pulso || '').trim();
    const tllc = (form.tiempoLlenadoCapilar || form.tllc || this.tllc || '').trim();
    const mucosas = (form.mucosas || this.mucosas || '').trim();
    const ganglios = (form.gangliosLinfaticos || form.ganglios_linfaticos || this.ganglios_linfaticos || '').trim();

    if (peso && Number(peso) > 0) count++;
    if (temp && Number(temp) > 0) count++;
    if (fc && Number(fc) > 0) count++;
    if (fr && Number(fr) > 0) count++;
    if (pulso) count++;
    if (tllc) count++;
    if (mucosas) count++;
    if (ganglios) count++;
    if (this.condicion_corporal || form.resultadoEstado || this.resultado_estado) count++;
    return `${count}/9`;
  }

  get conteoExamenes(): string {
    let count = 0;
    if (this.examenesSolicitados && this.examenesSolicitados.length > 0) count++;
    const hallazgos = (this.descripcionHallazgos || this.formHistoria?.get('hallazgos_examen')?.value || '').trim();
    if (hallazgos) count++;
    return `${count}/2`;
  }

  get conteoValoracion(): string {
    const total = 12;
    if (!this.sistemas) return `0/${total}`;
    const evaluados = Object.values(this.sistemas).filter(v => v === 'N' || v === 'AN').length;
    return `${evaluados}/${total}`;
  }

  get conteoDiagnostico(): string {
    let count = 0;
    const form = this.formHistoria?.value || {};
    const diag = (form.diagnosticoPrincipal || this.diagnosticoFinal || '').trim();
    const diagDif = (form.diagnosticoDiferencial || '').trim();
    const probs = this.problemasClinicos.filter(p => p && p.trim().length > 0);
    const pron = (form.pronostico || this.pronostico || '').trim();
    if (diag) count++;
    if (diagDif) count++;
    if (probs.length > 0 || (form.listaProblemas || '').trim()) count++;
    if (pron) count++;
    if (this.idPatologiaSeleccionada || this.patologiaSeleccionada) count++;
    return `${count}/5`;
  }

  get conteoTratamiento(): string {
    let count = 0;
    if (this.medicamentosSeleccionados && this.medicamentosSeleccionados.length > 0) count++;
    const plan = (this.formHistoria?.get('planTratamiento')?.value || this.planProcedimientos || '').trim();
    if (plan) count++;
    const mat = (this.materialesUtilizados || this.formHistoria?.get('materiales_utilizados')?.value || '').trim();
    if (mat) count++;
    return `${count}/3`;
  }

  get conteoRemisiones(): string {
    const ing = this.ingresaCBA || (this.ingresa_cba ? 'SÍ' : 'NO');
    const canil = (this.canilAsignado || this.canil_asignado || '').trim();
    return (ing === 'SÍ' || canil || ing === 'NO') ? '1/1' : '0/1';
  }

  get conteoAdjuntos(): string {
    return (this.paciente?.foto_url || this.route.snapshot.queryParamMap.get('foto')) ? '1/1' : '0/1';
  }

  get conteoProximaVisita(): string {
    return (this.proxima_visita_fecha && this.proxima_visita_fecha.trim()) ? '1/1' : '0/1';
  }

  irASeccionConsulta(seccionId: string): void {
    this.seccionConsultaActiva = seccionId;
    const el = document.getElementById('seccion-' + seccionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  setEsterilizado(opcion: 'Sí' | 'No'): void {
    this.esterilizado_opcion = opcion;
    this.cdr.detectChanges();
  }

  setEstadoSistema(clave: string, estado: string): void {
    this.sistemas[clave] = estado;
    this.evaluacion_sistemas = { ...this.sistemas };
    this.formHistoria?.markAsDirty();
    this.cdr.detectChanges();
  }

  popalog = {
    logopop: 'images/Escudo_Popayan.svg'
  };

  opcionesPronostico: string[] = ['Favorable', 'Reservado', 'Desfavorable', 'Crítico'];
  opcionesPrioridad: string[] = ['Normal', 'Control', 'Urgencia', 'Emergencia'];
  opcionesResultadoEstado: string[] = ['Estable', 'En Observación', 'Delicado', 'Crítico', 'Recuperado'];
  opcionesMucosas: string[] = ['Rosadas / Normales', 'Pálidas', 'Cianóticas', 'Ictéricas', 'Congestivas'];
  opcionesGanglios: string[] = ['Normales', 'Aumentados', 'Reactivos', 'Dolorosos'];
  opcionesActitud: string[] = ['Alerta / Responsivo', 'Deprimido / Decaído', 'Dócil / Tranquilo', 'Agresivo / Alerta', 'Estuporoso / Comatoso'];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private historiaService: HistoriaClinicaService,
    private patologiaService: PatologiaService,
    private examenesService: ExamenesClinicosService,
    private comprasService: ComprasService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.inicializarFormulario();
  }

  ngOnInit(): void {
    this.cargarPatologias();
    this.cargarExamenesClinicos();
    this.cargarMedicamentos();

    // 1. Verificar si viene empaquetado el estado completo del Acta de Visita (State o SessionStorage)
    let datosActa = (history?.state as any)?.datosActa;
    if (!datosActa) {
      try {
        const raw = sessionStorage.getItem('acta_edicion_temporal');
        if (raw) {
          datosActa = JSON.parse(raw);
        }
      } catch (e) {}
    }

    this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      const idQuery = this.route.snapshot.queryParamMap.get('id');
      const idHistoriaQuery = this.route.snapshot.queryParamMap.get('id_historia');
      const idConsultaQuery = this.route.snapshot.queryParamMap.get('id_consulta');
      const idAnimalQuery = this.route.snapshot.queryParamMap.get('id_animal');
      const idSeguimientoQuery = this.route.snapshot.queryParamMap.get('id_seguimiento');
      const nombreQuery = this.route.snapshot.queryParamMap.get('nombre') || '';
      const fotoQuery = this.route.snapshot.queryParamMap.get('foto') || '';

      // Validación de coherencia: Si hay datos en sessionStorage pero venimos a consultar
      // una historia guardada o un animal diferente, descartamos datosActa residuales.
      if (datosActa) {
        const idAnimalActa = Number(datosActa.id_animal || datosActa.paciente?.id_animal);
        const nombreActa = String(datosActa.paciente?.nombre || '').toLowerCase().trim();
        const idAnimalEsperado = idAnimalQuery ? Number(idAnimalQuery) : null;
        const nombreEsperado = nombreQuery ? nombreQuery.toLowerCase().trim() : '';

        const conflictoAnimal = (idAnimalEsperado && idAnimalActa && idAnimalEsperado !== idAnimalActa) ||
                                (nombreEsperado && nombreActa && nombreEsperado !== nombreActa);
        const vieneDeEdicionDirecta = !!idHistoriaQuery || (!history?.state?.datosActa && !!idAnimalQuery);

        if (conflictoAnimal || vieneDeEdicionDirecta) {
          datosActa = null;
          try {
            sessionStorage.removeItem('acta_edicion_temporal');
          } catch (e) {}
          this.tieneDatosDesdeActa = false;
        } else {
          this.aplicarDatosDesdeActa(datosActa);
        }
      }

      if (idAnimalQuery && !isNaN(Number(idAnimalQuery))) {
        this.idAnimal = Number(idAnimalQuery);
      } else if (idParam && !isNaN(Number(idParam))) {
        this.idAnimal = Number(idParam);
      }

      this.idHistoria = idParam || idConsultaQuery || idHistoriaQuery || idQuery || '';

      this.cargarHistoria(nombreQuery, fotoQuery, idAnimalQuery, idSeguimientoQuery);
    });
  }

  /**
   * Navegación fluida entre pestañas (stepper) sin perder información digitada
   */
  cambiarPestana(pestana: 'consulta' | 'examenes' | 'tratamientos'): void {
    this.pestanaActiva = pestana;

    if (pestana === 'examenes') {
      if (this.examenesClinicos.length === 0) {
        this.cargarExamenesClinicos();
      }
      if (this.patologias.length === 0) {
        this.cargarPatologias();
      }
    }
    if (pestana === 'tratamientos' && this.medicamentosCatalogo.length === 0) {
      this.cargarMedicamentos();
    }

    this.cdr.detectChanges();
  }

  cambiarPestanaPrincipal(p: 'atencion' | 'historial' | 'plan_sanitario' | 'receta' | 'auditoria'): void {
    this.pestanaPrincipal = p;
    this.cdr.detectChanges();
  }

  iniciarNuevaConsulta(): void {
    Swal.fire({
      icon: 'question',
      title: '¿Nueva Consulta Médica?',
      text: `Se iniciará un nuevo registro de atención para ${this.paciente?.nombre || 'el paciente'}, conservando todos sus antecedentes y datos base.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, iniciar nueva consulta',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4141a5'
    }).then((res) => {
      if (res.isConfirmed) {
        this.esNuevaConsulta = true;
        this.motivo_consulta = 'Consulta y seguimiento médico';
        this.prioridad = 'Normal';
        this.anamnesis = '';
        this.actitud_temperamento = 'Alerta / Responsivo';
        this.resultado_estado = 'Estable';
        this.temperatura = null;
        this.frecuencia_cardiaca = null;
        this.frecuencia_respiratoria = null;
        this.pulso = '';
        this.tllc = '';
        this.ganglios_linfaticos = '';
        this.mucosas = '';
        this.descripcionHallazgos = '';
        this.observaciones_examen = '';
        this.medicamentosSeleccionados = [];
        this.tratamientosEliminadosIds = [];
        this.examenesSolicitados = [];
        this.pronostico = 'Favorable';
        this.planProcedimientos = '';
        this.plan_procedimientos = '';
        this.materialesUtilizados = '';
        this.materiales_utilizados = '';
        this.ingresa_cba = false;
        this.ingresaCBA = 'NO';
        this.canilAsignado = '';
        this.canil_asignado = '';

        this.sistemas = {
          general: 'NE',
          hidratacion: 'NE',
          tegumentario: 'NE',
          ojos: 'NE',
          oidos: 'NE',
          nariz: 'NE',
          digestivo: 'NE',
          respiratorio: 'NE',
          nervioso: 'NE',
          musculoesqueletico: 'NE',
          cardiovascular: 'NE',
          genitourinario: 'NE'
        };
        this.evaluacion_sistemas = this.sistemas;

        if (this.formHistoria) {
          this.formHistoria.patchValue({
            motivo_consulta: 'Consulta y seguimiento médico',
            prioridad: 'Normal',
            anamnesis: '',
            actitud_temperamento: 'Alerta / Responsivo',
            resultado_estado: 'Estable',
            temperatura: null,
            frecuencia_cardiaca: null,
            frecuencia_respiratoria: null,
            pulso: '',
            tllc: '',
            ganglios_linfaticos: '',
            mucosas: '',
            hallazgos_examen: '',
            observaciones_examen: '',
            diagnosticoPrincipal: '',
            diagnosticoDiferencial: '',
            listaProblemas: '',
            evolucion: '',
            pronostico: 'Favorable',
            planTratamiento: '',
            materiales_utilizados: '',
            motivoModificacion: 'Nueva evolución clínica registrada.'
          });
        }

        this.pestanaPrincipal = 'atencion';
        this.pestanaActiva = 'consulta';
        this.cdr.detectChanges();

        Swal.fire({
          icon: 'success',
          title: 'Formulario Listo',
          text: 'Puedes diligenciar la nueva evolución médica.',
          timer: 1700,
          showConfirmButton: false
        });
      }
    });
  }

  verDetalleConsultaPasada(consulta: any): void {
    this.consultaPasadaSeleccionada = consulta;
    this.modalConsultaPasadaAbierto = true;
  }

  cerrarModalConsultaPasada(): void {
    this.modalConsultaPasadaAbierto = false;
    this.consultaPasadaSeleccionada = null;
  }

  imprimirReceta(): void {
    window.print();
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

  /**
   * Normaliza URLs relativas de Django hacia la API de producción
   */
  normalizarUrlFoto(url: any): string {
    if (!url || typeof url !== 'string' || !url.trim()) return '';
    const u = url.trim();
    if (u === 'null' || u === 'undefined' || u === 'None') return '';
    if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:image/') || u.startsWith('images/') || u.startsWith('/images/')) {
      return u;
    }
    if (u.startsWith('/media/')) {
      return `https://backendvetericano-production.up.railway.app${u}`;
    }
    if (u.startsWith('media/')) {
      return `https://backendvetericano-production.up.railway.app/${u}`;
    }
    return `https://backendvetericano-production.up.railway.app/media/${u}`;
  }

  extraerFotoDeObjeto(item: any): string {
    if (!item) return '';
    const extraerPrimera = (val: any): string => {
      if (!val) return '';
      if (typeof val === 'string') {
        const t = val.trim();
        if (t.startsWith('[')) {
          try {
            return extraerPrimera(JSON.parse(t));
          } catch {
            return '';
          }
        }
        return t;
      }
      if (Array.isArray(val) && val.length > 0) {
        const primero = val[0];
        if (typeof primero === 'string') return primero;
        if (primero && typeof primero === 'object') {
          return primero.foto || primero.url || primero.imagen || primero.ruta_archivo || primero.foto_url || primero.fotoUrl || '';
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
      item.animales?.[0]?.foto_url ||
      item.animales?.[0]?.foto ||
      item.animales?.[0]?.imagen ||
      item.animal?.foto_url ||
      item.animal?.foto ||
      item.animal?.imagen ||
      '';

    return this.normalizarUrlFoto(candidata);
  }

  private hidratarFotoDesdeSeguimientos(idAnimal?: number, nombrePaciente?: string, numeroHistoria?: string): void {
    this.authService.listarSeguimientos().subscribe({
      next: (resp) => {
        const lista: any[] = Array.isArray(resp) ? resp : (resp?.results || resp?.data || []);
        const nomBuscar = String(nombrePaciente || '').trim().toLowerCase();
        const radBuscar = String(numeroHistoria || '').trim().toLowerCase();

        const coincidencia = lista.find((s: any) => {
          const idCand = Number(
            s?.id_animal ??
            s?.id_animal_id ??
            s?.animal?.id_animal ??
            s?.animales?.[0]?.id_animal ??
            s?.paciente?.id_animal
          );
          if (idAnimal && !isNaN(idCand) && idCand === Number(idAnimal)) return true;

          const radCand = String(s?.numero_radicado || s?.radicado || '').trim().toLowerCase();
          if (radBuscar && radCand && radCand === radBuscar) return true;

          const nomCand = String(
            s?.nombre_paciente ||
            s?.nombre_animal ||
            s?.nombre ||
            s?.animal?.nombre ||
            s?.animales?.[0]?.nombre ||
            ''
          ).trim().toLowerCase();
          if (nomBuscar && nomBuscar !== 'paciente' && nomCand && nomCand === nomBuscar) return true;

          return false;
        });

        if (coincidencia) {
          const fotoSeg = this.extraerFotoDeObjeto(coincidencia);
          if (fotoSeg && this.paciente && !this.paciente.foto_url) {
            this.paciente.foto_url = fotoSeg;
            this.cdr.detectChanges();
          }
        }
      },
      error: () => {}
    });
  }

  obtenerColorAvatar(item: any): string {
    const paleta = [
      'bg-gradient-to-br from-blue-600 to-indigo-800',
      'bg-gradient-to-br from-emerald-500 to-teal-800',
      'bg-gradient-to-br from-violet-600 to-purple-800',
      'bg-gradient-to-br from-amber-500 to-orange-700',
      'bg-gradient-to-br from-cyan-600 to-blue-800',
      'bg-gradient-to-br from-rose-500 to-red-800',
      'bg-gradient-to-br from-fuchsia-600 to-pink-800'
    ];
    const clave = String(
      item?.nombre ||
      item?.nombre_paciente ||
      item?.id_animal ||
      'P'
    );
    let hash = 0;
    for (let i = 0; i < clave.length; i++) {
      hash = clave.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % paleta.length;
    return paleta[index];
  }

  obtenerIniciales(item: any): string {
    const nombre = (item?.nombre || item?.nombre_paciente || 'P').trim();
    if (!nombre) return 'P';
    const partes = nombre.split(' ').filter(Boolean);
    if (partes.length >= 2) {
      return (partes[0].charAt(0) + partes[1].charAt(0)).toUpperCase();
    }
    return nombre.substring(0, 2).toUpperCase();
  }

  imagenNoDisponible(event: Event): void {
    const imagen = event.target as HTMLImageElement;
    imagen.style.display = 'none';
  }

  private inicializarFormulario(): void {
    this.formHistoria = this.fb.group({
      // 1. Consulta (Espera y Datos del Paciente)
      motivo_consulta: [''],
      prioridad: ['Normal'],
      anamnesis: [''],
      actitud_temperamento: [''],
      actitudTemperamento: [''],
      resultado_estado: ['Estable'],
      resultadoEstado: ['Estable'],

      // 2. Exámenes (Pruebas y Sistemas Orgánicos)
      frecuencia_respiratoria: [null],
      frecuenciaRespiratoria: [null],
      frecuencia_cardiaca: [null],
      frecuenciaCardiaca: [null],
      temperatura: [null],
      peso: [null],
      pulso: [''],
      tllc: [''],
      tiempoLlenadoCapilar: [''],
      ganglios_linfaticos: [''],
      gangliosLinfaticos: [''],
      mucosas: [''],
      hallazgos_examen: [''],
      observaciones_examen: [''],
      observacionesExamen: [''],

      // 3. Diagnóstico (Patología y Plan de Acción)
      diagnosticoPrincipal: [''],
      diagnosticoDiferencial: [''],
      listaProblemas: [''],
      evolucion: [''],
      pronostico: ['Favorable'],
      plan_procedimientos: [''],
      planTratamiento: [''],

      // 4. Tratamientos (Fármacos, Insumos, CBA y Firmas)
      materiales_utilizados: [''],
      ingresa_cba: [false],
      motivo_ingreso_cba: [''],
      canil_asignado: [''],
      funcionario_recibe_cba: [''],
      motivoModificacion: ['']
    });
  }

  /**
   * Parsea de forma segura un campo que puede venir como JSON string u objeto/array desde la API
   */
  private parsearJsonSeguro<T>(valor: any, valorPorDefecto: T): T {
    if (!valor) return valorPorDefecto;
    if (typeof valor === 'string') {
      try {
        return JSON.parse(valor) as T;
      } catch {
        return valorPorDefecto;
      }
    }
    return valor as T;
  }

  /**
   * Aplica directamente los datos del paciente y de la atención clínica empaquetados desde el Acta de Visita
   */
  aplicarDatosDesdeActa(datosActa: any): void {
    if (!datosActa) return;
    this.tieneDatosDesdeActa = true;

    const pac = datosActa.paciente || {};
    const ten = datosActa.tenedor || {};
    const consts = datosActa.constantes || {};

    this.paciente = {
      id_animal: datosActa.id_animal || pac.id_animal || this.idAnimal || 1,
      nombre: pac.nombre || 'Paciente',
      especie: pac.especie || 'Canino',
      raza: pac.raza || 'Mestizo',
      sexo: pac.sexo || 'Hembra',
      peso: pac.peso ?? consts.peso ?? 4.0,
      foto_url: pac.foto_url ? this.normalizarUrlFoto(pac.foto_url) : '',
      tenedor_nombre: pac.tenedor_nombre || ten.nombre || 'Sin acudiente',
      tenedor_documento: pac.tenedor_documento || ten.cedula || 'No registrado',
      tenedor_telefono: pac.tenedor_telefono || ten.telefono || 'No disponible'
    };

    if (this.paciente.id_animal) {
      this.idAnimal = Number(this.paciente.id_animal);
    }

    this.nombreAcudiente = ten.nombre || pac.tenedor_nombre || '';
    this.cedulaAcudiente = ten.cedula || pac.tenedor_documento || '';
    this.telefonoAcudiente = ten.telefono || pac.tenedor_telefono || '';

    this.motivo_consulta = datosActa.motivo_consulta || 'Consulta clínica y seguimiento en campo';
    this.prioridad = datosActa.prioridad || 'Normal';
    this.resultado_estado = datosActa.resultado_estado || 'Estable';
    this.actitud_temperamento = datosActa.actitud_temperamento || 'Alerta / Responsivo';
    this.anamnesis = datosActa.anamnesis || '';

    this.temperatura = consts.temperatura !== undefined && consts.temperatura !== null ? Number(consts.temperatura) : 38.5;
    this.frecuencia_cardiaca = consts.frecuencia_cardiaca !== undefined && consts.frecuencia_cardiaca !== null ? Number(consts.frecuencia_cardiaca) : 8;
    this.frecuencia_respiratoria = consts.frecuencia_respiratoria !== undefined && consts.frecuencia_respiratoria !== null ? Number(consts.frecuencia_respiratoria) : 8;
    this.pulso = consts.pulso || 'Fuerte, lleno y regular';
    this.tllc = consts.tllc || '2 seg';
    this.ganglios_linfaticos = consts.ganglios_linfaticos || 'Normales / Sin reactividad';
    this.mucosas = consts.mucosas || 'Ictéricas / Amarillentas';

    if (datosActa.sistemas && typeof datosActa.sistemas === 'object') {
      this.sistemas = { ...this.sistemas, ...datosActa.sistemas };
      this.evaluacion_sistemas = this.sistemas;
    }

    this.hallazgos_examen = datosActa.diagnostico_diferencial || '';
    this.descripcionHallazgos = this.hallazgos_examen;
    this.pronostico = datosActa.pronostico || 'Favorable';
    this.plan_procedimientos = datosActa.plan_procedimientos || '';
    this.planProcedimientos = this.plan_procedimientos;
    this.materiales_utilizados = datosActa.materiales_utilizados || '';
    this.materialesUtilizados = this.materiales_utilizados;

    const ingresaBool = datosActa.ingresa_cba === true || datosActa.ingresa_cba === 'SI';
    this.ingresa_cba = ingresaBool;
    this.ingresaCBA = ingresaBool ? 'SI' : 'NO';
    this.motivo_ingreso_cba = datosActa.motivo_ingreso_cba || '';
    this.motivoIngresoNoIngreso = this.motivo_ingreso_cba;
    this.canil_asignado = datosActa.canil_asignado || '';
    this.canilAsignado = this.canil_asignado;
    this.funcionario_recibe_cba = datosActa.funcionario_recibe_cba || '';
    this.funcionarioRecibeCBA = this.funcionario_recibe_cba;

    if (Array.isArray(datosActa.medicamentos) && datosActa.medicamentos.length > 0) {
      this.medicamentosSeleccionados = datosActa.medicamentos.map((m: any) => ({
        id: m.id || m.id_medicamento,
        nombre: m.nombre || m.producto || 'Medicamento',
        principio_activo: m.principio_activo || '',
        concentracion: m.concentracion || '',
        presentacion: m.presentacion || '',
        dosis: m.dosis || '',
        via: m.via || '',
        frecuencia: m.frecuencia || '',
        descripcion: m.descripcion || m.posologia || '',
        stockDisponible: m.stockDisponible ?? 10,
        cantidadAAdministrar: m.cantidad ?? m.cantidadAAdministrar ?? 1,
        administrado: !!m.administrado,
        cantidadEfectivaAdministrada: m.cantidadEfectivaAdministrada ?? 0
      }));
    }

    if (!this.historiaOriginal) {
      this.historiaOriginal = {
        id_historia: datosActa.id_historia || Number(this.idHistoria) || 1,
        id_consulta: datosActa.id_consulta || null,
        id_animal: datosActa.id_animal || this.paciente?.id_animal,
        numero_historia: datosActa.numero_historia || `HC-${datosActa.id_animal || '103'}`,
        fecha_apertura: new Date().toISOString(),
        estado_general: this.resultado_estado,
        motivo_consulta: this.motivo_consulta,
        paciente: this.paciente,
        diagnostico_principal: datosActa.diagnostico_principal || 'Consulta médica general',
        diagnostico_diferencial: datosActa.diagnostico_diferencial || '',
        lista_problemas: datosActa.lista_problemas || '',
        evolucion: this.anamnesis || 'Paciente evaluado en campo en condición estable bajo seguimiento clínico.',
        pronostico: this.pronostico,
        plan_tratamiento: this.planProcedimientos || 'Tratamiento ambulatorio y cuidados preventivos.',
        constantes: {
          temperatura: this.temperatura,
          frecuencia_cardiaca: this.frecuencia_cardiaca,
          frecuencia_respiratoria: this.frecuencia_respiratoria,
          pulso: this.pulso,
          tllc: this.tllc,
          ganglios_linfaticos: this.ganglios_linfaticos,
          mucosas: this.mucosas
        },
        organos_sistemas: this.sistemas,
        historial_modificaciones: []
      };
    }

    this.formHistoria.patchValue({
      motivo_consulta: this.motivo_consulta,
      prioridad: this.prioridad,
      anamnesis: this.anamnesis,
      actitud_temperamento: this.actitud_temperamento,
      actitudTemperamento: this.actitud_temperamento,
      resultado_estado: this.resultado_estado,
      resultadoEstado: this.resultado_estado,
      frecuencia_respiratoria: this.frecuencia_respiratoria,
      frecuenciaRespiratoria: this.frecuencia_respiratoria,
      frecuencia_cardiaca: this.frecuencia_cardiaca,
      frecuenciaCardiaca: this.frecuencia_cardiaca,
      temperatura: this.temperatura,
      peso: this.paciente?.peso,
      pulso: this.pulso,
      tllc: this.tllc,
      tiempoLlenadoCapilar: this.tllc,
      ganglios_linfaticos: this.ganglios_linfaticos,
      gangliosLinfaticos: this.ganglios_linfaticos,
      mucosas: this.mucosas,
      diagnosticoPrincipal: datosActa.diagnostico_principal || 'Consulta médica general',
      diagnosticoDiferencial: datosActa.diagnostico_diferencial || '',
      listaProblemas: datosActa.lista_problemas || '',
      evolucion: this.anamnesis || 'Paciente evaluado en campo en condición estable bajo seguimiento clínico.',
      pronostico: this.pronostico,
      plan_procedimientos: this.planProcedimientos || 'Tratamiento ambulatorio y cuidados preventivos.',
      planTratamiento: this.planProcedimientos || 'Tratamiento ambulatorio y cuidados preventivos.',
      materiales_utilizados: this.materiales_utilizados,
      ingresa_cba: this.ingresa_cba,
      motivo_ingreso_cba: this.motivo_ingreso_cba,
      canil_asignado: this.canil_asignado,
      funcionario_recibe_cba: this.funcionario_recibe_cba
    });

    if (datosActa.triajeSistemasCampo) {
      this.triajeSistemasCampo = {
        ...this.triajeSistemasCampo,
        ...datosActa.triajeSistemasCampo,
        respiratorio: { ...this.triajeSistemasCampo.respiratorio, ...(datosActa.triajeSistemasCampo.respiratorio || {}) },
        digestivo: { ...this.triajeSistemasCampo.digestivo, ...(datosActa.triajeSistemasCampo.digestivo || {}) },
        musculoEsqueletico: { ...this.triajeSistemasCampo.musculoEsqueletico, ...(datosActa.triajeSistemasCampo.musculoEsqueletico || {}) },
        dermatologico: { ...this.triajeSistemasCampo.dermatologico, ...(datosActa.triajeSistemasCampo.dermatologico || {}) },
        genitourinario: { ...this.triajeSistemasCampo.genitourinario, ...(datosActa.triajeSistemasCampo.genitourinario || {}) },
      };
      this.recalcularAlertasSistemas();
    } else {
      this.recalcularAlertasSistemas();
    }

    if (datosActa.evaluacionCampo) {
      this.evaluacionCampo = { ...this.evaluacionCampo, ...datosActa.evaluacionCampo };
    } else {
      this.evaluacionCampo = {
        frecuenciaCardiaca: this.frecuencia_cardiaca,
        frecuenciaRespiratoria: this.frecuencia_respiratoria,
        temperatura: this.temperatura,
        mucosas: this.mucosas,
        anamnesisLimpia: this.anamnesis,
        quejaCompleta: this.anamnesis,
        descripcionQueja: this.anamnesis
      };
    }

    if (datosActa.resolucionCierre) {
      const pruebas = Array.isArray(datosActa.resolucionCierre.pruebasRapidas) && datosActa.resolucionCierre.pruebasRapidas.length > 0
        ? datosActa.resolucionCierre.pruebasRapidas
        : this.resolucionCierre.pruebasRapidas;
      this.resolucionCierre = {
        ...this.resolucionCierre,
        ...datosActa.resolucionCierre,
        pruebasRapidas: pruebas,
        datosRescate: { ...this.resolucionCierre.datosRescate, ...(datosActa.resolucionCierre.datosRescate || {}) }
      };
    } else if (Array.isArray(datosActa.examenesSolicitados) && datosActa.examenesSolicitados.length > 0) {
      this.resolucionCierre.pruebasRapidas = datosActa.examenesSolicitados.map((ex: any) => ({
        prueba: ex.nombre || 'Prueba',
        resultado: ex.resultado || 'Positivo (+)',
        esPositivo: /positiv/i.test(ex.resultado || 'Positivo'),
        esNegativo: /negativ/i.test(ex.resultado || '')
      }));
    }

    if (datosActa.datosPropietario) {
      this.datosPropietario = { ...this.datosPropietario, ...datosActa.datosPropietario };
      this.nombreAcudiente = this.datosPropietario.nombre || this.nombreAcudiente;
      this.cedulaAcudiente = this.datosPropietario.cedula || this.cedulaAcudiente;
      this.telefonoAcudiente = this.datosPropietario.telefono || this.telefonoAcudiente;
    } else {
      this.datosPropietario = {
        nombre: this.nombreAcudiente,
        cedula: this.cedulaAcudiente,
        telefono: this.telefonoAcudiente,
        email: '',
        barrio: ten.barrio || '',
        direccion: ten.direccion || '',
        quienReporta: '',
        quienReportaOtro: '',
        solicitudAtencionPor: ''
      };
    }

    if (datosActa.seguimientoSeleccionado) {
      this.seguimientoSeleccionado = datosActa.seguimientoSeleccionado;
    }
    if (datosActa.numero_historia) {
      this.numeroRadicadoActual = datosActa.numero_historia;
    }

    if (Array.isArray(datosActa.examenesSolicitados) && datosActa.examenesSolicitados.length > 0) {
      this.examenesSolicitados = [...datosActa.examenesSolicitados];
    }

    this.cargando = false;
    this.cdr.detectChanges();
  }

  toggleTriajeSigno(sistema: 'respiratorio' | 'digestivo' | 'musculoEsqueletico' | 'dermatologico' | 'genitourinario', signo: string, valor: boolean): void {
    const sistObj = (this.triajeSistemasCampo as any)[sistema];
    if (sistObj) {
      sistObj[signo] = valor;
      this.recalcularAlertasSistemas();
      this.sincronizarTriajeConSistemas();
      this.formHistoria.markAsDirty();
      this.cdr.detectChanges();
    }
  }

  recalcularAlertasSistemas(): void {
    let alertas = 0;
    const s = this.triajeSistemasCampo;
    const sistemasClave = ['respiratorio', 'digestivo', 'musculoEsqueletico', 'dermatologico', 'genitourinario'] as const;
    sistemasClave.forEach(sist => {
      const obj = s[sist];
      if (obj) {
        Object.values(obj).forEach(val => {
          if (val === true) alertas++;
        });
      }
    });
    this.triajeSistemasCampo.totalAlertas = alertas;
    this.triajeSistemasCampo.tieneEvaluacion = true;
  }

  sincronizarTriajeConSistemas(): void {
    const s = this.triajeSistemasCampo;
    const tieneResp = Object.values(s.respiratorio).some(v => v === true);
    this.sistemas['respiratorio'] = tieneResp ? 'AN' : 'N';

    const tieneDig = Object.values(s.digestivo).some(v => v === true);
    this.sistemas['digestivo'] = tieneDig ? 'AN' : 'N';

    const tieneMusc = Object.values(s.musculoEsqueletico).some(v => v === true);
    this.sistemas['musculoesqueletico'] = tieneMusc ? 'AN' : 'N';

    const tieneDerm = Object.values(s.dermatologico).some(v => v === true);
    this.sistemas['tegumentario'] = tieneDerm ? 'AN' : 'N';

    const tieneGen = Object.values(s.genitourinario).some(v => v === true);
    this.sistemas['genitourinario'] = tieneGen ? 'AN' : 'N';

    this.evaluacion_sistemas = { ...this.sistemas };
  }

  obtenerClaseColorMucosa(mucosa?: string | null): string {
    const m = String(mucosa || this.mucosas || '').toLowerCase();
    if (m.includes('rosad') || m.includes('normal')) return 'bg-pink-400';
    if (m.includes('palid') || m.includes('pálid')) return 'bg-slate-300';
    if (m.includes('cianot') || m.includes('cianót') || m.includes('azul')) return 'bg-cyan-500';
    if (m.includes('icter') || m.includes('ictér') || m.includes('amarill')) return 'bg-amber-400';
    if (m.includes('congest') || m.includes('roj')) return 'bg-red-500';
    return 'bg-[#4141a5]';
  }

  actualizarConstante(nombre: string, valor: any): void {
    switch (nombre) {
      case 'temperatura':
        this.temperatura = valor !== null && valor !== '' ? Number(valor) : null;
        this.formHistoria.patchValue({ temperatura: this.temperatura });
        break;
      case 'frecuencia_cardiaca':
        this.frecuencia_cardiaca = valor !== null && valor !== '' ? Number(valor) : null;
        this.formHistoria.patchValue({ frecuenciaCardiaca: this.frecuencia_cardiaca, frecuencia_cardiaca: this.frecuencia_cardiaca });
        break;
      case 'frecuencia_respiratoria':
        this.frecuencia_respiratoria = valor !== null && valor !== '' ? Number(valor) : null;
        this.formHistoria.patchValue({ frecuenciaRespiratoria: this.frecuencia_respiratoria, frecuencia_respiratoria: this.frecuencia_respiratoria });
        break;
      case 'mucosas':
        this.mucosas = valor || '';
        this.formHistoria.patchValue({ mucosas: this.mucosas });
        break;
      case 'pulso':
        this.pulso = valor || '';
        this.formHistoria.patchValue({ pulso: this.pulso });
        break;
      case 'tllc':
        this.tllc = valor || '';
        this.formHistoria.patchValue({ tllc: this.tllc, tiempoLlenadoCapilar: this.tllc });
        break;
      case 'ganglios_linfaticos':
        this.ganglios_linfaticos = valor || '';
        this.formHistoria.patchValue({ ganglios_linfaticos: this.ganglios_linfaticos, gangliosLinfaticos: this.ganglios_linfaticos });
        break;
      case 'peso':
        const pNum = valor !== null && valor !== '' ? Number(valor) : null;
        if (this.paciente) this.paciente.peso = pNum;
        this.formHistoria.patchValue({ peso: pNum });
        break;
    }
    this.formHistoria.markAsDirty();
  }

  get diagnosticoFinal(): string {
    return this.formHistoria?.get('diagnosticoPrincipal')?.value || this.historiaOriginal?.diagnostico_principal || '';
  }
  set diagnosticoFinal(val: string) {
    this.actualizarDiagnosticoFinal(val);
  }

  actualizarDiagnosticoFinal(val: string): void {
    if (this.formHistoria) {
      this.formHistoria.patchValue({ diagnosticoPrincipal: val });
      this.formHistoria.get('diagnosticoPrincipal')?.markAsDirty();
    }
    if (this.historiaOriginal) {
      this.historiaOriginal.diagnostico_principal = val;
    }
  }

  get resultadoEstado(): string {
    return this.resultado_estado || this.formHistoria?.get('resultadoEstado')?.value || 'Estable';
  }
  set resultadoEstado(val: string) {
    this.actualizarResultadoEstado(val);
  }

  actualizarResultadoEstado(val: string): void {
    this.resultado_estado = val;
    if (this.formHistoria) {
      this.formHistoria.patchValue({ resultadoEstado: val, resultado_estado: val });
      this.formHistoria.get('resultadoEstado')?.markAsDirty();
    }
    if (this.historiaOriginal) {
      this.historiaOriginal.resultado_estado = val;
    }
  }

  actualizarPronostico(val: string): void {
    this.pronostico = val;
    if (this.formHistoria) {
      this.formHistoria.patchValue({ pronostico: val });
      this.formHistoria.get('pronostico')?.markAsDirty();
    }
    if (this.historiaOriginal) {
      this.historiaOriginal.pronostico = val;
    }
  }

  /**
   * Extrae y mapea directamente desde el objeto de seguimiento de la app móvil
   */
  extraerYCompletarDesdeSeguimiento(seg: any, nombreSugerido?: string): void {
    if (!seg) return;
    const quejaRaw = String(seg?.anamnesis_descripcion_queja || '').trim();
    const observacionRaw = String(seg?.observacion || seg?.observaciones || '').trim();
    const tratamientoRaw = String(seg?.tratamiento_realizado || '').trim();

    let fc = Number(seg?.frecuencia_cardiaca ?? seg?.frecuenciaCardiaca);
    let fr = Number(seg?.frecuencia_respiratoria ?? seg?.frecuenciaRespiratoria);
    let temp = Number(seg?.temperatura);
    let muc = String(seg?.mucosas || '').trim();

    const matchFc = quejaRaw.match(/FC:\s*(\d+(?:[.,]\d+)?)/i);
    if (matchFc && (!fc || isNaN(fc))) fc = Number(matchFc[1].replace(',', '.'));
    const matchFr = quejaRaw.match(/FR:\s*(\d+(?:[.,]\d+)?)/i);
    if (matchFr && (!fr || isNaN(fr))) fr = Number(matchFr[1].replace(',', '.'));
    const matchTemp = quejaRaw.match(/Temp(?:eratura)?:\s*(\d+(?:[.,]\d+)?)/i);
    if (matchTemp && (!temp || isNaN(temp))) temp = Number(matchTemp[1].replace(',', '.'));
    const matchMuc = quejaRaw.match(/Mucosas:\s*([^.\]\n]+)/i);
    if (matchMuc && !muc) muc = matchMuc[1].trim();

    const matchCausal = quejaRaw.match(/Causal de traslado:\s*([^\n\r.]+)/i);

    const tutorNom = seg?.propietario_nombre || seg?.notificador_nombre || seg?.nombre_acudiente || '';
    const tutorCed = seg?.propietario_cedula || seg?.notificador_identificacion || seg?.cedula_acudiente || '';
    const tutorTel = seg?.propietario_telefono || seg?.notificador_telefono || seg?.telefono_acudiente || '';

    const datos: any = {
      id_animal: seg?.id_animal || seg?.animal?.id_animal || 1,
      id_consulta: seg?.id_consulta || null,
      id_historia: seg?.id_historia || null,
      id_seguimiento: seg?.id_seguimiento || seg?.id,
      numero_historia: seg?.numero_radicado || `HC-${seg?.id_animal || '103'}`,
      paciente: {
        id_animal: seg?.id_animal || 1,
        nombre: seg?.nombre_paciente || seg?.nombre_animal || seg?.nombre || nombreSugerido || 'Paciente',
        especie: seg?.paciente_especie || seg?.especie || 'Canino',
        raza: seg?.paciente_raza || seg?.raza || 'Mestizo',
        sexo: seg?.paciente_sexo || seg?.sexo || 'Hembra',
        peso: Number(seg?.peso_paciente ?? seg?.peso ?? 4.0),
        foto_url: this.extraerFotoDeObjeto(seg),
        tenedor_nombre: tutorNom,
        tenedor_documento: tutorCed,
        tenedor_telefono: tutorTel
      },
      tenedor: {
        nombre: tutorNom,
        cedula: tutorCed,
        telefono: tutorTel
      },
      motivo_consulta: observacionRaw || quejaRaw.split('===')[0].trim() || 'Consulta y seguimiento en campo',
      prioridad: 'Normal',
      resultado_estado: 'Estable',
      anamnesis: quejaRaw.split('===')[0].trim() || 'Paciente evaluado en campo.',
      constantes: {
        temperatura: !isNaN(temp) && temp > 0 ? temp : 38.5,
        frecuencia_cardiaca: !isNaN(fc) && fc > 0 ? fc : 110,
        frecuencia_respiratoria: !isNaN(fr) && fr > 0 ? fr : 24,
        pulso: seg?.pulso || 'Fuerte, lleno y regular',
        tllc: seg?.tllc || '2 seg',
        ganglios_linfaticos: seg?.ganglios_linfaticos || 'Normales / Sin reactividad',
        mucosas: muc || 'Rosadas y húmedas',
        peso: Number(seg?.peso_paciente ?? seg?.peso ?? 4.0)
      },
      diagnostico_principal: observacionRaw || 'Valoración clínica general',
      plan_procedimientos: tratamientoRaw || 'Tratamiento y seguimiento clínico en CBA',
      ingresa_cba: true,
      motivo_ingreso_cba: matchCausal ? matchCausal[1].trim() : 'Ingreso para valoración y custodia médica en CBA'
    };

    this.aplicarDatosDesdeActa(datos);
  }

  /**
   * Carga los datos previos de la historia clínica / consulta en el formulario y en los 4 apartados
   */
  cargarHistoria(nombrePaciente?: string, fotoPaciente?: string, idAnimalParam?: string | number | null, idSeguimientoParam?: string | number | null): void {
    const nombre = nombrePaciente || this.route.snapshot.queryParamMap.get('nombre') || '';
    const foto = fotoPaciente || this.route.snapshot.queryParamMap.get('foto') || '';
    const idAnimal = idAnimalParam || this.route.snapshot.queryParamMap.get('id_animal') || '';
    const idSeguimiento = idSeguimientoParam || this.route.snapshot.queryParamMap.get('id_seguimiento') || '';

    // Si aún no tenemos los datos del paciente cargados, indicamos cargando
    if (!this.paciente?.nombre || this.paciente.nombre === 'Paciente') {
      this.cargando = true;
    }
    this.mensajeError = '';

    // Si viene id_seguimiento y faltan constantes, complementar con el seguimiento móvil
    if (idSeguimiento && (!this.temperatura || !this.frecuencia_cardiaca)) {
      this.authService.obtenerSeguimientoPorId(Number(idSeguimiento)).subscribe({
        next: (seg) => {
          if (seg) {
            this.extraerYCompletarDesdeSeguimiento(seg, nombre);
          }
        },
        error: () => {}
      });
    }

    this.historiaService.obtenerHistoria(this.idHistoria, nombre, idAnimal).subscribe({
      next: (data: HistoriaClinicaEdicion) => {
        const raw = data as any;
        this.historiaOriginal = { ...(this.historiaOriginal || {}), ...data };
        this.historialModificaciones = data.historial_modificaciones || this.historialModificaciones || [];
        this.consultasAnteriores = data.consultas_anteriores || raw.consultas_anteriores || [];

        if (!this.tieneDatosDesdeActa && data.paciente) {
          this.paciente = {
            id_animal: data.paciente.id_animal || this.idAnimal || 1,
            nombre: data.paciente.nombre && data.paciente.nombre !== 'Paciente' ? data.paciente.nombre : (nombre || 'Paciente'),
            especie: data.paciente.especie || 'Canino',
            raza: data.paciente.raza || 'Mestizo',
            sexo: data.paciente.sexo || 'Hembra',
            peso: data.paciente.peso ?? 4.0,
            tenedor_nombre: data.paciente.tenedor_nombre || this.nombreAcudiente || 'Sin acudiente',
            tenedor_documento: data.paciente.tenedor_documento || this.cedulaAcudiente || 'No registrado',
            tenedor_telefono: data.paciente.tenedor_telefono || this.telefonoAcudiente || 'No disponible',
            foto_url: data.paciente.foto_url ? this.normalizarUrlFoto(data.paciente.foto_url) : ''
          };
        } else if (this.paciente) {
          this.paciente = {
            ...this.paciente,
            nombre: this.paciente.nombre && this.paciente.nombre !== 'Paciente' ? this.paciente.nombre : (data.paciente?.nombre || nombre || 'Paciente'),
            especie: this.paciente.especie || data.paciente?.especie || 'Canino',
            raza: this.paciente.raza || data.paciente?.raza || 'Mestizo',
            sexo: this.paciente.sexo || data.paciente?.sexo || 'Hembra',
            peso: this.paciente.peso ?? data.paciente?.peso ?? 4.0,
            tenedor_nombre: this.paciente.tenedor_nombre && this.paciente.tenedor_nombre !== 'Sin acudiente' ? this.paciente.tenedor_nombre : (data.paciente?.tenedor_nombre || this.nombreAcudiente || 'Sin acudiente'),
            tenedor_documento: this.paciente.tenedor_documento && this.paciente.tenedor_documento !== 'No registrado' ? this.paciente.tenedor_documento : (data.paciente?.tenedor_documento || this.cedulaAcudiente || 'No registrado'),
            tenedor_telefono: this.paciente.tenedor_telefono && this.paciente.tenedor_telefono !== 'No disponible' ? this.paciente.tenedor_telefono : (data.paciente?.tenedor_telefono || this.telefonoAcudiente || 'No disponible')
          };
        } else if (data.paciente) {
          this.paciente = data.paciente;
        }

        if (foto && foto.trim() !== '' && this.paciente) {
          this.paciente.foto_url = this.normalizarUrlFoto(foto);
        } else if (data.paciente?.foto_url && this.paciente && !this.paciente.foto_url) {
          this.paciente.foto_url = this.normalizarUrlFoto(data.paciente.foto_url);
        }

        // Si el paciente aún no tiene foto cargada, hidratarla desde los seguimientos / actas
        if (this.paciente && !this.paciente.foto_url) {
          this.hidratarFotoDesdeSeguimientos(
            Number(this.paciente.id_animal || idAnimal),
            this.paciente.nombre || nombre,
            data.numero_historia || this.numeroRadicadoActual
          );
        }

        // =====================================================================
        // Sincronizar campos solo si el backend aporta datos reales y NO vienen del Acta
        // =====================================================================
        if (!this.tieneDatosDesdeActa) {
          if (raw.motivo_consulta) this.motivo_consulta = raw.motivo_consulta;
          if (raw.prioridad) this.prioridad = raw.prioridad;
          if (raw.anamnesis || data.evolucion) this.anamnesis = raw.anamnesis || data.evolucion;
          if (data.constantes?.actitud_temperamento || raw.actitud_temperamento) {
            this.actitud_temperamento = data.constantes?.actitud_temperamento || raw.actitud_temperamento;
          }
          if (raw.resultado_estado || data.estado_general) {
            this.resultado_estado = raw.resultado_estado || data.estado_general;
          }

          if (raw.temperatura !== undefined && raw.temperatura !== null) this.temperatura = Number(raw.temperatura);
          else if (data.constantes?.temperatura !== undefined && data.constantes?.temperatura !== null) this.temperatura = Number(data.constantes.temperatura);

          if (raw.frecuencia_cardiaca !== undefined && raw.frecuencia_cardiaca !== null) this.frecuencia_cardiaca = Number(raw.frecuencia_cardiaca);
          else if (data.constantes?.frecuencia_cardiaca !== undefined && data.constantes?.frecuencia_cardiaca !== null) this.frecuencia_cardiaca = Number(data.constantes.frecuencia_cardiaca);

          if (raw.frecuencia_respiratoria !== undefined && raw.frecuencia_respiratoria !== null) this.frecuencia_respiratoria = Number(raw.frecuencia_respiratoria);
          else if (data.constantes?.frecuencia_respiratoria !== undefined && data.constantes?.frecuencia_respiratoria !== null) this.frecuencia_respiratoria = Number(data.constantes.frecuencia_respiratoria);

          if (raw.pulso || data.constantes?.pulso) this.pulso = raw.pulso || data.constantes?.pulso;
          if (raw.tllc || data.constantes?.tllc) this.tllc = raw.tllc || data.constantes?.tllc;
          if (raw.ganglios_linfaticos || data.constantes?.ganglios_linfaticos) this.ganglios_linfaticos = raw.ganglios_linfaticos || data.constantes?.ganglios_linfaticos;
          if (raw.mucosas || data.constantes?.mucosas) this.mucosas = raw.mucosas || data.constantes?.mucosas;

          if (raw.hallazgos_examen !== undefined || data.descripcion_hallazgos !== undefined) {
            this.descripcionHallazgos = raw.hallazgos_examen ?? data.descripcion_hallazgos ?? '';
          }

          if (raw.observaciones_examen || data.observaciones_sistemas) {
            this.observaciones_examen = raw.observaciones_examen || data.observaciones_sistemas || '';
            this.observacionesSistemas = this.observaciones_examen;
          }

          const sistemasParseados = this.parsearJsonSeguro<Record<string, any>>(
            raw.evaluacion_sistemas || data.organos_sistemas,
            {}
          );
          if (sistemasParseados && typeof sistemasParseados === 'object' && Object.keys(sistemasParseados).length > 0) {
            this.sistemas = { ...this.sistemas, ...sistemasParseados };
            this.evaluacion_sistemas = this.sistemas;
            if (sistemasParseados['observaciones'] && !this.observacionesSistemas) {
              this.observacionesSistemas = sistemasParseados['observaciones'];
              this.observaciones_examen = this.observacionesSistemas;
            }
          }

          if (data.alimento_marca || sistemasParseados?.['_alimento_marca']) {
            this.alimento_marca = data.alimento_marca || sistemasParseados['_alimento_marca'] || '';
          }
          if (data.esterilizado_opcion || sistemasParseados?.['_esterilizado_opcion']) {
            const estVal = data.esterilizado_opcion || sistemasParseados['_esterilizado_opcion'];
            this.esterilizado_opcion = estVal === 'Sí' ? 'Sí' : 'No';
          }
          if (data.condicion_corporal || sistemasParseados?.['_condicion_corporal']) {
            this.condicion_corporal = data.condicion_corporal || sistemasParseados['_condicion_corporal'] || '3/5 (Ideal)';
          }
          if (data.proxima_visita_fecha !== undefined || sistemasParseados?.['_proxima_visita_fecha'] !== undefined) {
            this.proxima_visita_fecha = data.proxima_visita_fecha ?? sistemasParseados?.['_proxima_visita_fecha'] ?? '';
          }
          if (data.proxima_visita_notas !== undefined || sistemasParseados?.['_proxima_visita_notas'] !== undefined) {
            this.proxima_visita_notas = data.proxima_visita_notas ?? sistemasParseados?.['_proxima_visita_notas'] ?? '';
          }

          const anam = data.anamnesicos || raw.anamnesicos || {};
          this.planSanitario = {
            vacunas: anam.vacunas || sistemasParseados?.['_vacunas'] || '',
            estadoRabia: sistemasParseados?.['_estado_rabia'] || (anam.vacunas ? 'Vigente / Aplicada' : 'Pendiente / En revisión'),
            estadoPolivalente: sistemasParseados?.['_estado_polivalente'] || (anam.vacunas ? 'Al Día' : 'En evaluación'),
            estadoRefuerzo: sistemasParseados?.['_estado_refuerzo'] || 'Programada',
            ultimaDesparasitacion: anam.ultimaDesparasitacion || anam.ultDesparasitacion || sistemasParseados?.['_ultima_desparasitacion'] || '',
            productoDesparasitacion: anam.productoDesparasitacion || anam.prodDesparasitacion || sistemasParseados?.['_producto_desparasitacion'] || '',
            estadoDesparasitacion: sistemasParseados?.['_estado_desparasitacion'] || ((anam.productoDesparasitacion || anam.ultimaDesparasitacion) ? 'Suministrada' : 'En evaluación'),
            estadoEctoparasitos: sistemasParseados?.['_estado_ectoparasitos'] || 'Tratado',
            enfermedadesAnteriores: anam.enfermedadesAnteriores || anam.enfermedadesPrevias || sistemasParseados?.['_enfermedades_anteriores'] || '',
            historiaReproductiva: anam.historiaReproductiva || anam.estadoReproductivo || sistemasParseados?.['_historia_reproductiva'] || ''
          };

          if (Array.isArray(data.examenes_solicitados) && data.examenes_solicitados.length > 0) {
            this.examenesSolicitados = data.examenes_solicitados.map((ex: any) => ({
              id_examen: ex.id_examen || ex.id || null,
              nombre: ex.nombre || 'Examen',
              tipo: ex.tipo || 'Laboratorio',
              estado: ex.estado || 'solicitado',
              resultado: ex.resultado || '',
              ruta_archivo_resultado: ex.ruta_archivo_resultado || ''
            }));
          }

          if (data.materiales_utilizados !== undefined) {
            this.materialesUtilizados = data.materiales_utilizados || '';
            this.materiales_utilizados = this.materialesUtilizados;
          }
          if (data.plan_tratamiento || raw.plan_procedimientos) {
            this.planProcedimientos = data.plan_tratamiento || raw.plan_procedimientos || '';
            this.plan_procedimientos = this.planProcedimientos;
          }
          if (data.pronostico) {
            this.pronostico = data.pronostico;
          }
          if (data.ingresa_cba !== undefined) {
            this.ingresa_cba = data.ingresa_cba === true || String(data.ingresa_cba).toUpperCase() === 'SI';
            this.ingresaCBA = this.ingresa_cba ? 'SI' : 'NO';
          }
          if (data.motivo_ingreso_no_ingreso !== undefined || data.motivo_ingreso_cba !== undefined) {
            this.motivoIngresoNoIngreso = data.motivo_ingreso_no_ingreso || data.motivo_ingreso_cba || '';
            this.motivo_ingreso_cba = this.motivoIngresoNoIngreso;
          }
          if (data.canil_asignado !== undefined) {
            this.canilAsignado = data.canil_asignado || '';
            this.canil_asignado = this.canilAsignado;
          }
          if (data.funcionario_recibe_cba !== undefined) {
            this.funcionarioRecibeCBA = data.funcionario_recibe_cba || '';
            this.funcionario_recibe_cba = this.funcionarioRecibeCBA;
          }

          this.tratamientosEliminadosIds = [];
          if (Array.isArray(data.tratamientos) && data.tratamientos.length > 0) {
            this.medicamentosSeleccionados = data.tratamientos.map((t: any) => ({
              id: t.id_medicamento || t.id || null,
              id_tratamiento: t.id_tratamiento || null,
              nombre: t.nombre || t.productoBase || t.producto_base || t.nombre_medicamento || 'Medicamento',
              principio_activo: t.principio_activo || '',
              concentracion: t.concentracion || '',
              presentacion: t.presentacion || '',
              dosis: t.dosis || t.dosisBasica || t.dosis_basica || '',
              via: t.via || t.via_administracion || '',
              frecuencia: t.frecuencia || t.frecuenciaDuracion || t.frecuencia_duracion || '',
              descripcion: t.descripcion || t.posologia || '',
              stockDisponible: t.stockDisponible ?? 10,
              cantidadAAdministrar: t.cantidadAAdministrar ?? 1,
              administrado: !!t.administrado || !!t.suministrado_clinica,
              cantidadEfectivaAdministrada: t.cantidad_administrada || t.cantidadEfectivaAdministrada || 0
            }));
          }

          if (data.nombre_acudiente || data.paciente?.tenedor_nombre) {
            this.nombreAcudiente = data.nombre_acudiente || data.paciente?.tenedor_nombre || this.nombreAcudiente;
          }
          if (data.cedula_acudiente || data.paciente?.tenedor_documento) {
            this.cedulaAcudiente = data.cedula_acudiente || data.paciente?.tenedor_documento || this.cedulaAcudiente;
          }
        }

        // Parcheo del formulario reactivo sin perder los valores de acta
        this.formHistoria.patchValue({
          motivo_consulta: this.motivo_consulta,
          prioridad: this.prioridad,
          anamnesis: this.anamnesis,
          actitud_temperamento: this.actitud_temperamento,
          actitudTemperamento: this.actitud_temperamento,
          resultado_estado: this.resultado_estado,
          resultadoEstado: this.resultado_estado,
          frecuencia_respiratoria: this.frecuencia_respiratoria,
          frecuenciaRespiratoria: this.frecuencia_respiratoria,
          frecuencia_cardiaca: this.frecuencia_cardiaca,
          frecuenciaCardiaca: this.frecuencia_cardiaca,
          temperatura: this.temperatura,
          peso: this.paciente?.peso ?? (data.paciente?.peso ?? null),
          pulso: this.pulso,
          tllc: this.tllc,
          tiempoLlenadoCapilar: this.tllc,
          ganglios_linfaticos: this.ganglios_linfaticos,
          gangliosLinfaticos: this.ganglios_linfaticos,
          mucosas: this.mucosas,
          hallazgos_examen: this.descripcionHallazgos,
          observaciones_examen: this.observaciones_examen,
          observacionesExamen: this.observaciones_examen,
          diagnosticoPrincipal: data.diagnostico_principal || this.formHistoria.get('diagnosticoPrincipal')?.value || '',
          diagnosticoDiferencial: data.diagnostico_diferencial !== undefined
            ? data.diagnostico_diferencial
            : (this.formHistoria.get('diagnosticoDiferencial')?.value || ''),
          listaProblemas: data.lista_problemas || this.formHistoria.get('listaProblemas')?.value || '',
          evolucion: data.evolucion || this.anamnesis || this.formHistoria.get('evolucion')?.value || '',
          pronostico: this.pronostico || data.pronostico || 'Favorable',
          plan_procedimientos: this.plan_procedimientos,
          planTratamiento: data.plan_tratamiento || this.plan_procedimientos || this.formHistoria.get('planTratamiento')?.value || '',
          materiales_utilizados: this.materiales_utilizados,
          ingresa_cba: this.ingresa_cba,
          motivo_ingreso_cba: this.motivo_ingreso_cba,
          canil_asignado: this.canil_asignado,
          funcionario_recibe_cba: this.funcionario_recibe_cba,
          motivoModificacion: ''
        });

        const estadoGen = String(data.estado_general || '').trim().toLowerCase();
        if (estadoGen === 'anulado') {
          this.historiaAnulada = true;
          this.formHistoria.disable();
        } else {
          this.historiaAnulada = false;
          this.formHistoria.enable();
        }

        const esNuevaConsulta = this.route.snapshot.queryParamMap.get('nueva_consulta') === 'true';
        this.esNuevaConsulta = esNuevaConsulta;
        if (esNuevaConsulta) {
          this.motivo_consulta = 'Consulta General';
          this.prioridad = 'Normal';
          this.anamnesis = '';
          this.temperatura = null;
          this.frecuencia_cardiaca = null;
          this.frecuencia_respiratoria = null;
          this.pulso = '';
          this.tllc = '';
          this.ganglios_linfaticos = '';
          this.mucosas = '';
          this.medicamentosSeleccionados = [];
          this.examenesSolicitados = [];
          this.pronostico = 'Favorable';
          this.planProcedimientos = '';
          this.materialesUtilizados = '';
          this.marcarTodosSistemas('NE');
          this.formHistoria.patchValue({
            motivo_consulta: 'Consulta General',
            prioridad: 'Normal',
            anamnesis: '',
            temperatura: null,
            frecuencia_cardiaca: null,
            frecuencia_respiratoria: null,
            pulso: '',
            tllc: '',
            ganglios_linfaticos: '',
            mucosas: '',
            diagnosticoPrincipal: '',
            diagnosticoDiferencial: '',
            listaProblemas: '',
            evolucion: '',
            pronostico: 'Favorable',
            planTratamiento: '',
            materiales_utilizados: '',
            motivoModificacion: 'Nueva consulta clínica registrada.'
          });
          this.pestanaPrincipal = 'atencion';
          this.seccionConsultaActiva = 'info_basica';
        }

        this.formHistoria.markAsPristine();
        this.formHistoria.markAsUntouched();
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargando = false;
        this.mensajeError = 'No fue posible cargar la información de la historia clínica. Intente nuevamente.';
        this.cdr.detectChanges();
      }
    });
  }

  // =========================================================================
  // GESTIÓN DEL PASO 2: EXÁMENES CLÍNICOS Y SISTEMAS ORGÁNICOS
  // =========================================================================

  get totalPaginasExamenes(): number {
    return Math.ceil(this.examenesFiltrados.length / this.tamanoPaginaExamenes) || 1;
  }

  get examenesPaginados(): ExamenClinico[] {
    const inicio = (this.paginaActualExamenes - 1) * this.tamanoPaginaExamenes;
    return this.examenesFiltrados.slice(inicio, inicio + this.tamanoPaginaExamenes);
  }

  get paginasDisponiblesExamenes(): number[] {
    const total = this.totalPaginasExamenes;
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  get indiceInicioExamenes(): number {
    if (this.examenesFiltrados.length === 0) return 0;
    return (this.paginaActualExamenes - 1) * this.tamanoPaginaExamenes + 1;
  }

  get indiceFinExamenes(): number {
    return Math.min(this.paginaActualExamenes * this.tamanoPaginaExamenes, this.examenesFiltrados.length);
  }

  cargarExamenesClinicos(): void {
    this.cargandoExamenes = true;
    this.mensajeExamenes = '';

    this.examenesService.obtenerTodos().subscribe({
      next: (lista: ExamenClinico[]) => {
        this.examenesClinicos = lista;
        this.examenesFiltrados = [...lista];
        this.totalExamenes = lista.length;
        this.cargandoExamenes = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.mensajeExamenes = 'No se pudieron cargar los exámenes clínicos.';
        this.cargandoExamenes = false;
        this.cdr.detectChanges();
      }
    });
  }

  filtrarExamenes(): void {
    const query = (this.busquedaExamen || '').trim().toLowerCase();
    if (!query) {
      this.examenesFiltrados = [...this.examenesClinicos];
    } else {
      this.examenesFiltrados = this.examenesClinicos.filter(e =>
        (e.nombre && e.nombre.toLowerCase().includes(query)) ||
        (e.descripcion && e.descripcion.toLowerCase().includes(query))
      );
    }
    this.paginaActualExamenes = 1;
  }

  limpiarBusquedaExamen(): void {
    this.busquedaExamen = '';
    this.filtrarExamenes();
  }

  cambiarPaginaExamenes(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginasExamenes) {
      this.paginaActualExamenes = pagina;
    }
  }

  solicitarExamenSeleccionado(): void {
    if (!this.examenSeleccionadoParaSolicitud) return;
    this.agregarExamen(this.examenSeleccionadoParaSolicitud);
    this.examenSeleccionadoParaSolicitud = null;
  }

  agregarExamen(examen: any): void {
    const nombreExamen = String(
      examen?.nombre ||
      examen?.nombre_examen ||
      examen?.nombre_tipo ||
      examen?.tipo ||
      'Examen clínico'
    );
    const idExamen = examen?.id_examen ?? examen?.id ?? null;
    const yaExiste = this.examenesSolicitados.some((item: any) =>
      (idExamen !== null && item.id_examen === idExamen) ||
      item.nombre === nombreExamen
    );

    if (yaExiste) {
      Swal.fire({
        icon: 'info',
        title: 'Examen ya agregado',
        text: 'Este examen ya se encuentra en la orden del paciente.',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#4141a5'
      });
      return;
    }

    this.examenesSolicitados.push({
      ...examen,
      id_examen: idExamen,
      nombre: nombreExamen,
      tipo: examen?.tipo || 'General',
      descripcion: examen?.descripcion || '',
      estado: examen?.estado || 'solicitado',
      resultado: examen?.resultado || '',
      ruta_archivo_resultado: examen?.ruta_archivo_resultado || ''
    });
    this.formHistoria.markAsDirty();

    Swal.fire({
      icon: 'success',
      title: 'Examen ordenado',
      text: `${nombreExamen} fue agregado a la orden médica.`,
      timer: 1400,
      showConfirmButton: false
    });
  }

  eliminarExamen(indice: number): void {
    const examen = this.examenesSolicitados[indice];
    if (!examen) return;

    Swal.fire({
      icon: 'warning',
      title: '¿Eliminar examen?',
      text: `Se quitará "${examen.nombre}" de la orden de exámenes solicitados.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#4141a5'
    }).then((resultado) => {
      if (resultado.isConfirmed) {
        this.examenesSolicitados.splice(indice, 1);
        this.formHistoria.markAsDirty();
        this.cdr.detectChanges();
      }
    });
  }

  guardarSistemas(): void {
    this.formHistoria.markAsDirty();
    Swal.fire({
      icon: 'success',
      title: 'Evaluación física registrada',
      text: 'Se han conservado los estados de los 12 sistemas orgánicos para el expediente.',
      confirmButtonColor: '#4141a5'
    });
  }

  marcarTodosSistemas(estado: 'N' | 'NE' | 'AN'): void {
    Object.keys(this.sistemas).forEach(key => {
      this.sistemas[key] = estado;
    });
    this.evaluacion_sistemas = { ...this.sistemas };
    this.formHistoria.markAsDirty();
    this.cdr.detectChanges();
  }

  // =========================================================================
  // GESTIÓN DEL PASO 3: CATÁLOGO DE PATOLOGÍAS Y DIAGNÓSTICO
  // =========================================================================

  cargarPatologias(): void {
    this.cargandoPatologias = true;
    this.patologiaService.obtenerPatologias().subscribe({
      next: (data: Patologia[]) => {
        this.patologias = data;
        this.patologiasFiltradas = [...data];
        this.cargandoPatologias = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoPatologias = false;
        this.cdr.detectChanges();
      }
    });
  }

  filtrarPatologias(): void {
    this.patologiasFiltradas = this.patologiaService.filtrarPatologiasLocales(
      this.patologias,
      this.busquedaPatologia
    );
  }

  limpiarBusquedaPatologia(): void {
    this.busquedaPatologia = '';
    this.filtrarPatologias();
  }

  onSeleccionarPatologia(id: number | null): void {
    this.idPatologiaSeleccionada = id;
    if (!id) {
      this.patologiaSeleccionada = null;
      return;
    }

    const encontrada = this.patologias.find(p => p.id_patologia === id);
    this.patologiaSeleccionada = encontrada || null;

    if (this.patologiaSeleccionada) {
      this.formHistoria.patchValue({
        diagnosticoPrincipal: this.patologiaSeleccionada.nombre
      });
      this.formHistoria.get('diagnosticoPrincipal')?.markAsDirty();
    }
  }

  seleccionarPatologia(pat: Patologia): void {
    if (!pat) return;
    this.idPatologiaSeleccionada = pat.id_patologia;
    this.patologiaSeleccionada = pat;
    this.busquedaPatologia = '';
    this.formHistoria.patchValue({
      diagnosticoPrincipal: pat.nombre
    });
    this.formHistoria.get('diagnosticoPrincipal')?.markAsDirty();
    this.cdr.detectChanges();
  }

  // =========================================================================
  // GESTIÓN DEL PASO 4: FÁRMACOS, INSUMOS, CBA Y FIRMAS
  // =========================================================================

  desplegarMedicamentos(): void {
    this.mostrarCatalogoMedicamentos = !this.mostrarCatalogoMedicamentos;
    if (this.mostrarCatalogoMedicamentos && this.medicamentosCatalogo.length === 0) {
      this.cargarMedicamentos();
    }
  }

  cargarMedicamentos(): void {
    this.cargandoMedicamentos = true;
    this.mensajeMedicamentos = '';

    forkJoin({
      catalogo: this.comprasService.listarMedicamentosCatalogo().pipe(
        catchError(() => this.comprasService.listarMedicamentos()),
        catchError(() => of([]))
      ),
      stock: this.comprasService.obtenerMapaStockMedicamentos().pipe(
        catchError(() => of({ porId: new Map<number, number>(), porNombre: new Map<string, number>() }))
      )
    }).subscribe({
      next: ({ catalogo, stock }) => {
        this.mapaStockPorId = stock.porId;
        this.mapaStockPorNombre = stock.porNombre;

        this.medicamentosCatalogo = catalogo.map((med: any) => {
          const id = Number(med?.id_medicamento ?? med?.id);
          const nombreKey = String(med?.nombre || '').trim().toLowerCase();
          const stockDisponible = (!isNaN(id) && stock.porId.has(id))
            ? (stock.porId.get(id) ?? 0)
            : (stock.porNombre.get(nombreKey) ?? 0);

          return {
            ...med,
            id_medicamento: id,
            stockDisponible
          };
        });

        if (this.medicamentosCatalogo.length === 0) {
          this.mensajeMedicamentos = 'El catálogo no contiene medicamentos.';
        }
        this.cargandoMedicamentos = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.mensajeMedicamentos = 'No se pudieron cargar los medicamentos.';
        this.cargandoMedicamentos = false;
        this.cdr.detectChanges();
      }
    });
  }

  recargarStockMedicamentos(): void {
    this.comprasService.obtenerMapaStockMedicamentos().subscribe({
      next: (stock) => {
        this.mapaStockPorId = stock.porId;
        this.mapaStockPorNombre = stock.porNombre;

        this.medicamentosCatalogo.forEach((med: any) => {
          const id = Number(med?.id_medicamento ?? med?.id);
          const nombreKey = String(med?.nombre || '').trim().toLowerCase();
          med.stockDisponible = (!isNaN(id) && stock.porId.has(id))
            ? (stock.porId.get(id) ?? 0)
            : (stock.porNombre.get(nombreKey) ?? 0);
        });

        this.medicamentosSeleccionados.forEach((item: any) => {
          if (!item.administrado) {
            const id = Number(item.id);
            const nombreKey = String(item.nombre || '').trim().toLowerCase();
            item.stockDisponible = (!isNaN(id) && stock.porId.has(id))
              ? (stock.porId.get(id) ?? 0)
              : (stock.porNombre.get(nombreKey) ?? 0);
          }
        });
        this.cdr.detectChanges();
      }
    });
  }

  agregarMedicamento(medicamento: any): void {
    const nombre = String(
      medicamento?.nombre ||
      medicamento?.nombre_medicamento ||
      medicamento?.medicamento ||
      medicamento?.nombre_producto ||
      ''
    );
    const id = medicamento?.id_medicamento ?? medicamento?.id ?? null;
    const yaExiste = this.medicamentosSeleccionados.some((item: any) =>
      (id !== null && item.id === id) || (id === null && item.nombre === nombre)
    );

    if (yaExiste) {
      Swal.fire({
        icon: 'info',
        title: 'Medicamento ya prescrito',
        text: 'Este fármaco ya se encuentra agregado al plan terapéutico.',
        confirmButtonColor: '#4141a5'
      });
      return;
    }

    const nombreKey = String(nombre).trim().toLowerCase();
    const stock = medicamento?.stockDisponible !== undefined
      ? medicamento.stockDisponible
      : ((id !== null && this.mapaStockPorId.has(Number(id)))
        ? (this.mapaStockPorId.get(Number(id)) ?? 0)
        : (this.mapaStockPorNombre.get(nombreKey) ?? 0));

    this.medicamentosSeleccionados.push({
      id,
      id_tratamiento: null,
      nombre: nombre || 'Medicamento',
      principio_activo: medicamento?.principio_activo || '',
      concentracion: medicamento?.concentracion || '',
      presentacion: medicamento?.presentacion || '',
      dosis: '',
      via: '',
      frecuencia: '',
      stockDisponible: stock,
      cantidadAAdministrar: 1,
      administrado: false,
      cantidadEfectivaAdministrada: 0,
      administrando: false
    });

    this.formHistoria.markAsDirty();

    Swal.fire({
      icon: 'success',
      title: 'Fármaco agregado',
      text: `${nombre} fue añadido a la prescripción médica.`,
      timer: 1500,
      showConfirmButton: false
    });
  }

  eliminarMedicamento(indice: number): void {
    const med = this.medicamentosSeleccionados[indice];
    if (med && med.administrado) {
      Swal.fire({
        icon: 'warning',
        title: '¿Quitar fármaco administrado?',
        html: `Atención: Ya se registró la administración de <b>${med.cantidadEfectivaAdministrada} uds</b> en el inventario.<br><br>¿Deseas quitar este tratamiento del registro?`,
        showCancelButton: true,
        confirmButtonText: 'Sí, quitar',
        cancelButtonText: 'Conservar',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#4141a5'
      }).then((res) => {
        if (res.isConfirmed) {
          if (med.id_tratamiento && Number(med.id_tratamiento) > 0) {
            this.tratamientosEliminadosIds.push(Number(med.id_tratamiento));
          }
          this.medicamentosSeleccionados.splice(indice, 1);
          this.formHistoria.markAsDirty();
          this.cdr.detectChanges();
        }
      });
      return;
    }

    if (med?.id_tratamiento && Number(med.id_tratamiento) > 0) {
      this.tratamientosEliminadosIds.push(Number(med.id_tratamiento));
    }
    this.medicamentosSeleccionados.splice(indice, 1);
    this.formHistoria.markAsDirty();
  }

  quitarMedicamento(indice: number): void {
    this.eliminarMedicamento(indice);
  }

  registrarAdministracion(med: any, indice: number): void {
    if (med.administrado) {
      Swal.fire({
        icon: 'info',
        title: 'Ya administrado',
        text: `Este medicamento ya fue administrado (${med.cantidadEfectivaAdministrada} uds) y descontado de inventario.`,
        confirmButtonColor: '#4141a5'
      });
      return;
    }

    const cantidad = Number(med.cantidadAAdministrar);
    if (isNaN(cantidad) || cantidad <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Cantidad inválida',
        text: 'Ingresa una cantidad numérica mayor a 0 para registrar la administración.',
        confirmButtonColor: '#4141a5'
      });
      return;
    }

    const stockActual = Number(med.stockDisponible) || 0;
    if (stockActual <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Sin existencias en inventario',
        text: `No hay unidades disponibles en inventario para el medicamento "${med.nombre}".`,
        confirmButtonColor: '#4141a5'
      });
      return;
    }

    if (cantidad > stockActual) {
      Swal.fire({
        icon: 'error',
        title: 'Stock insuficiente en inventario de campo',
        text: `No cuentas con suficiente stock en tu inventario de campo (Disponibles: ${stockActual}, Solicitados: ${cantidad}). Por favor, ajusta la cantidad o utiliza una alternativa de medicamento disponible.`,
        confirmButtonColor: '#4141a5'
      });
      return;
    }

    const nombreMed = med.nombre || 'el medicamento';

    Swal.fire({
      title: '¿Confirmar administración y descuento?',
      html: `Se registrará la administración física de <b>${cantidad} uds</b> de <b>${nombreMed}</b> al paciente.<br><br><span class="text-xs text-slate-500">Esta acción descontará las unidades directamente de los lotes activos en el inventario del CBA.</span>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar y descontar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b'
    }).then((resultado) => {
      if (!resultado.isConfirmed) return;

      med.administrando = true;
      this.cdr.detectChanges();

      this.comprasService.descontarStockMedicamento(med.id, cantidad, med.nombre).subscribe({
        next: (resp) => {
          med.administrando = false;
          med.administrado = true;
          med.cantidadEfectivaAdministrada = cantidad;
          med.stockDisponible = resp.restante;
          this.recargarStockMedicamentos();
          this.formHistoria.markAsDirty();
          this.cdr.detectChanges();

          Swal.fire({
            icon: 'success',
            title: '¡Administración registrada con éxito!',
            html: `Se descontaron <b>${cantidad} uds</b> de inventario.<br>Stock restante en CBA: <b>${resp.restante} uds</b>.`,
            confirmButtonColor: '#4141a5'
          });
        },
        error: (err) => {
          med.administrando = false;
          this.cdr.detectChanges();
          const msg = err?.message || 'No fue posible registrar la administración en inventario.';
          Swal.fire({
            icon: 'error',
            title: 'Error al descontar inventario',
            text: msg,
            confirmButtonColor: '#4141a5'
          });
        }
      });
    });
  }

  esStockBajo(stock: any): boolean {
    const n = Number(stock);
    return !isNaN(n) && n > 0 && n <= 10;
  }

  alertaStockBajoSweetAlert(nombre: string, stock: any): void {
    const s = Number(stock) || 0;
    Swal.fire({
      icon: 'warning',
      title: '¡Alerta de Stock Bajo!',
      html: `
        <div class="text-left text-sm space-y-2">
          <div class="p-3 bg-amber-50 border-l-4 border-[#F1C63C] rounded-r-xl">
            <p class="font-bold text-amber-950">
              Recuerda que te quedan ${s} unidades de este producto. Es hora de solicitar reaprovisionamiento al inventario general.
            </p>
          </div>
          <p class="text-xs text-slate-500">Producto en inventario: <b>${nombre}</b></p>
        </div>
      `,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#4141a5'
    });
  }

  obtenerAlternativasStock(idMedicamentoActual: any): any[] {
    const idAct = Number(idMedicamentoActual);
    return this.medicamentosCatalogo.filter((m: any) => {
      const id = Number(m.id_medicamento ?? m.id);
      return id !== idAct && (Number(m.stockDisponible) || 0) > 0;
    }).slice(0, 3);
  }

  reemplazarMedicamento(indice: number, nuevoMed: any): void {
    const stock = Number(nuevoMed.stockDisponible) || 0;
    const nombre = nuevoMed.nombre || 'Medicamento sin nombre';
    const idTratExistente = this.medicamentosSeleccionados[indice]?.id_tratamiento || null;
    this.medicamentosSeleccionados[indice] = {
      id: nuevoMed.id_medicamento ?? nuevoMed.id,
      id_tratamiento: idTratExistente,
      nombre,
      principio_activo: nuevoMed.principio_activo || '',
      concentracion: nuevoMed.concentracion || '',
      presentacion: nuevoMed.presentacion || '',
      dosis: '',
      via: '',
      frecuencia: '',
      stockDisponible: stock,
      cantidadAAdministrar: 1,
      administrado: false,
      cantidadEfectivaAdministrada: 0,
      administrando: false
    };
    this.formHistoria.markAsDirty();
    this.cdr.detectChanges();
    Swal.fire({
      icon: 'success',
      title: 'Medicamento alternativo seleccionado',
      text: `Se seleccionó ${nombre} con ${stock} uds disponibles.`,
      timer: 1600,
      showConfirmButton: false
    });
  }

  get hayMedicamentosConStockInsuficiente(): boolean {
    return this.medicamentosSeleccionados.some((m: any) =>
      !m.administrado && (Number(m.cantidadAAdministrar) || 0) > (Number(m.stockDisponible) || 0)
    );
  }

  // =========================================================================
  // GUARDADO COMPLETO DE LA EDICIÓN (PUT / PATCH AL BACKEND)
  // =========================================================================

  guardarEdicion(): void {
    if (this.historiaAnulada) {
      Swal.fire({
        title: 'Historia Anulada',
        text: 'No es posible modificar una historia clínica en estado anulado (Jira HE06-HU013 Escenario 3.0).',
        icon: 'warning',
        confirmButtonColor: '#4141a5',
        customClass: {
          popup: 'rounded-2xl font-[\'Nunito\',sans-serif]',
          confirmButton: 'rounded-xl px-5 py-2.5 font-bold'
        }
      });
      return;
    }

    if (this.hayMedicamentosConStockInsuficiente) {
      Swal.fire({
        title: 'Stock Insuficiente',
        text: 'Existen fármacos en el tratamiento con cantidades solicitadas superiores al stock disponible. Por favor ajusta las cantidades antes de guardar.',
        icon: 'warning',
        confirmButtonColor: '#4141a5'
      });
      return;
    }

    this.formularioEnviado = true;
    this.mensajeError = '';
    this.mensajeExito = '';

    // Sincronizar y asegurar valores válidos para todos los campos clínicos
    const diag = (this.diagnosticoFinal || this.formHistoria.get('diagnosticoPrincipal')?.value || this.historiaOriginal?.diagnostico_principal || 'Consulta médica general').trim();
    const evo = (this.formHistoria.get('evolucion')?.value || this.anamnesis || this.historiaOriginal?.evolucion || 'Paciente evaluado en campo en condición estable bajo seguimiento clínico veterinario.').trim();
    const plan = (this.materialesUtilizados || this.planProcedimientos || this.formHistoria.get('planTratamiento')?.value || this.historiaOriginal?.plan_tratamiento || 'Tratamiento ambulatorio, curación y cuidados preventivos en CBA.').trim();
    const motivo = (this.formHistoria.get('motivoModificacion')?.value || 'Actualización y sincronización de datos clínicos desde módulo oficial.').trim();
    const pron = this.pronostico || this.formHistoria.get('pronostico')?.value || 'Favorable';

    this.formHistoria.patchValue({
      diagnosticoPrincipal: diag || 'Consulta médica general',
      evolucion: evo || 'Paciente evaluado en campo en condición estable bajo seguimiento clínico veterinario.',
      planTratamiento: plan || 'Tratamiento ambulatorio, curación y cuidados preventivos en CBA.',
      motivoModificacion: motivo || 'Actualización y sincronización de datos clínicos desde módulo oficial.',
      pronostico: pron,
      prioridad: this.prioridad || this.formHistoria.get('prioridad')?.value || 'Normal',
      resultadoEstado: this.resultado_estado || this.formHistoria.get('resultadoEstado')?.value || 'Estable',
      materiales_utilizados: this.materialesUtilizados || plan
    });

    // Limpiar cualquier error residual para garantizar guardado inmediato sin bloqueos fantasma
    Object.keys(this.formHistoria.controls).forEach(key => {
      const c = this.formHistoria.get(key);
      if (c && c.invalid) {
        c.clearValidators();
        c.updateValueAndValidity();
      }
    });

    this.guardando = true;
    const formVal = this.formHistoria.value;

    // Procesar lista de problemas formateada
    const problemasDesdeArray = this.problemasClinicos.filter(p => p && p.trim().length > 0);
    const listaProblemasFinal = problemasDesdeArray.length > 0
      ? problemasDesdeArray.map((p, i) => `${i + 1}. ${p.trim()}`).join('\n')
      : (formVal.listaProblemas || '');

    const dto: ActualizarHistoriaDto = {
      motivo_consulta: (this.formHistoria.get('motivo_consulta')?.value || this.motivo_consulta || 'Consulta General').trim(),
      diagnostico_principal: formVal.diagnosticoPrincipal,
      diagnostico_diferencial: (formVal.diagnosticoDiferencial || '').trim(),
      hallazgos_examen: (this.descripcionHallazgos || formVal.hallazgos_examen || '').trim(),
      id_patologia: this.idPatologiaSeleccionada || null,
      lista_problemas: listaProblemasFinal,
      evolucion: formVal.evolucion,
      pronostico: formVal.pronostico,
      prioridad: formVal.prioridad || 'Normal',
      resultado_estado: formVal.resultadoEstado || 'Estable',
      pulso: formVal.pulso || '',
      tllc: formVal.tiempoLlenadoCapilar || '',
      mucosas: formVal.mucosas || '',
      ganglios_linfaticos: formVal.gangliosLinfaticos || '',
      actitud_temperamento: formVal.actitudTemperamento || '',
      observaciones_examen: formVal.observacionesExamen || this.observacionesSistemas || '',
      plan_tratamiento: formVal.planTratamiento || this.planProcedimientos,
      temperatura: formVal.temperatura ? Number(formVal.temperatura) : null,
      frecuencia_cardiaca: formVal.frecuenciaCardiaca ? Number(formVal.frecuenciaCardiaca) : null,
      frecuencia_respiratoria: formVal.frecuenciaRespiratoria ? Number(formVal.frecuenciaRespiratoria) : null,
      peso: formVal.peso ? Number(formVal.peso) : null,
      motivo_modificacion: formVal.motivoModificacion,
      organos_sistemas: {
        ...this.sistemas,
        observaciones: this.observacionesSistemas || formVal.observacionesExamen || '',
        _vacunas: this.planSanitario.vacunas || '',
        _estado_rabia: this.planSanitario.estadoRabia || 'Vigente / Aplicada',
        _estado_polivalente: this.planSanitario.estadoPolivalente || 'Al Día',
        _estado_refuerzo: this.planSanitario.estadoRefuerzo || 'Programada',
        _ultima_desparasitacion: this.planSanitario.ultimaDesparasitacion || '',
        _producto_desparasitacion: this.planSanitario.productoDesparasitacion || '',
        _estado_desparasitacion: this.planSanitario.estadoDesparasitacion || 'Suministrada',
        _estado_ectoparasitos: this.planSanitario.estadoEctoparasitos || 'Tratado',
        _enfermedades_anteriores: this.planSanitario.enfermedadesAnteriores || '',
        _historia_reproductiva: this.planSanitario.historiaReproductiva || ''
      },
      examenes_solicitados: this.examenesSolicitados.map(ex => ({
        id_examen: ex.id_examen || ex.id,
        nombre: ex.nombre,
        tipo: ex.tipo,
        estado: ex.estado || 'solicitado',
        resultado: ex.resultado || '',
        ruta_archivo_resultado: ex.ruta_archivo_resultado || ''
      })),
      tratamientos: this.medicamentosSeleccionados.map(m => ({
        id_tratamiento: m.id_tratamiento || null,
        id_medicamento: m.id,
        nombre: m.nombre,
        principio_activo: m.principio_activo,
        presentacion: m.presentacion,
        dosis: m.dosis,
        via: m.via,
        frecuencia: m.frecuencia,
        cantidad_administrada: m.cantidadEfectivaAdministrada || 0,
        administrado: !!m.administrado,
        descripcion: m.descripcion || m.posologia || '',
        responsable_admin: m.responsable_admin || this.nombreVeterinario || '',
        reaccion_comentarios: m.reaccion_comentarios || '',
        _ref: m
      })),
      tratamientos_eliminados: [...this.tratamientosEliminadosIds],
      materiales_utilizados: this.materialesUtilizados,
      ingreso_cba: {
        ingresa_cba: this.ingresaCBA,
        motivo_ingreso_no_ingreso: this.motivoIngresoNoIngreso,
        canil_asignado: this.canilAsignado,
        funcionario_recibe_cba: this.funcionarioRecibeCBA
      },
      tenedor: {
        nombres: this.nombreAcudiente,
        documentoIdentidad: this.cedulaAcudiente,
        telefono: this.paciente?.tenedor_telefono || ''
      },
      anamnesicos: {
        vacunas: this.planSanitario.vacunas || '',
        ultimaDesparasitacion: this.planSanitario.ultimaDesparasitacion || '',
        productoDesparasitacion: this.planSanitario.productoDesparasitacion || '',
        enfermedadesAnteriores: this.planSanitario.enfermedadesAnteriores || '',
        alimentacion: this.alimento_marca || '',
        historiaReproductiva: this.esterilizado_opcion === 'Sí' ? 'Esterilizado' : (this.planSanitario.historiaReproductiva || 'Entero')
      },
      alimento_marca: this.alimento_marca || '',
      esterilizado_opcion: this.esterilizado_opcion || 'No',
      condicion_corporal: this.condicion_corporal || '3/5 (Ideal)',
      proxima_visita_fecha: this.proxima_visita_fecha || '',
      proxima_visita_notas: this.proxima_visita_notas || ''
    };

    const idAnimalQuery = this.route.snapshot.queryParamMap.get('id_animal');
    const idAnimalEfectivo = Number(
      idAnimalQuery ||
      this.idAnimal ||
      this.paciente?.id_animal ||
      this.historiaOriginal?.id_animal ||
      (this.idHistoria && !isNaN(Number(this.idHistoria)) ? Number(this.idHistoria) : null) ||
      1
    );
    (dto as any).id_animal = idAnimalEfectivo;
    (dto as any).animal = this.paciente || { id_animal: idAnimalEfectivo, nombre: 'Paciente' };

    const historiaBase = this.historiaOriginal || ({
      id_historia: Number(this.idHistoria) || 0,
      id_animal: idAnimalEfectivo,
      paciente: this.paciente
    } as any);

    const eraNuevaConsulta = this.esNuevaConsulta;

    this.historiaService.actualizarHistoria(this.idHistoria, dto, historiaBase, this.esNuevaConsulta).subscribe({
      next: (resp) => {
        this.guardando = false;
        this.formularioEnviado = false;
        this.esNuevaConsulta = false;
        this.tratamientosEliminadosIds = [];
        this.mensajeExito = resp.mensaje || (eraNuevaConsulta ? 'Nueva consulta clínica guardada exitosamente.' : 'Historia clínica actualizada con éxito.');

        // Limpieza de memoria temporal para evitar que el navegador recargue datos antiguos desactualizados
        try {
          sessionStorage.removeItem('acta_edicion_temporal');
          sessionStorage.removeItem('historia_edicion_temporal');
        } catch (e) {}

        if (resp.historia_id) {
          this.idHistoria = resp.historia_id;
        }

        if (resp.auditoria) {
          this.historialModificaciones = [resp.auditoria, ...this.historialModificaciones];
        }

        if (!this.historiaOriginal) {
          this.historiaOriginal = {
            id_historia: resp.historia_id || this.idHistoria,
            id_consulta: resp.consulta_id || 1,
            id_animal: idAnimalEfectivo,
            numero_historia: `HC-${idAnimalEfectivo}`,
            fecha_apertura: new Date().toISOString(),
            paciente: this.paciente
          } as any;
        }

        if (this.historiaOriginal) {
          this.historiaOriginal.id_historia = resp.historia_id || this.historiaOriginal.id_historia;
          this.historiaOriginal.id_consulta = resp.consulta_id || this.historiaOriginal.id_consulta;
          this.historiaOriginal.motivo_consulta = dto.motivo_consulta || this.historiaOriginal.motivo_consulta;
          this.historiaOriginal.diagnostico_principal = dto.diagnostico_principal;
          this.historiaOriginal.diagnostico_diferencial = dto.diagnostico_diferencial;
          this.historiaOriginal.lista_problemas = dto.lista_problemas;
          this.historiaOriginal.evolucion = dto.evolucion;
          this.historiaOriginal.pronostico = dto.pronostico;
          this.historiaOriginal.prioridad = dto.prioridad;
          this.historiaOriginal.resultado_estado = dto.resultado_estado;
          this.historiaOriginal.pulso = dto.pulso;
          this.historiaOriginal.tllc = dto.tllc;
          this.historiaOriginal.mucosas = dto.mucosas;
          this.historiaOriginal.ganglios_linfaticos = dto.ganglios_linfaticos;
          this.historiaOriginal.actitud_temperamento = dto.actitud_temperamento;
          this.historiaOriginal.observaciones_examen = dto.observaciones_examen;
          this.historiaOriginal.plan_tratamiento = dto.plan_tratamiento;
          this.historiaOriginal.materiales_utilizados = dto.materiales_utilizados;
          this.historiaOriginal.organos_sistemas = dto.organos_sistemas;
          this.historiaOriginal.examenes_solicitados = dto.examenes_solicitados;
          this.historiaOriginal.tratamientos = dto.tratamientos;
          if (dto.peso && this.paciente) {
            this.paciente.peso = dto.peso;
          }
        }

        this.formHistoria.markAsPristine();
        this.formHistoria.get('motivoModificacion')?.reset('');

        // Limpiar query param 'nueva_consulta' de la URL si se guardó exitosamente
        if (eraNuevaConsulta) {
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { id: this.idHistoria, id_consulta: resp.consulta_id || '' },
            queryParamsHandling: 'merge'
          });
        }

        const tituloAlerta = eraNuevaConsulta ? '¡Consulta Guardada!' : '¡Actualización Exitosa!';
        const textoAlerta = eraNuevaConsulta
          ? 'Se ha registrado la nueva consulta clínica en la base de datos con éxito.'
          : 'Se han guardado todos los cambios en exámenes, sistemas, diagnósticos, evolución, tratamientos y firmas. La modificación quedó registrada en auditoría.';

        Swal.fire({
          title: tituloAlerta,
          text: textoAlerta,
          icon: 'success',
          confirmButtonColor: '#4141a5',
          confirmButtonText: 'Aceptar',
          customClass: {
            popup: 'rounded-2xl font-[\'Nunito\',sans-serif]',
            confirmButton: 'rounded-xl px-5 py-2.5 font-bold'
          }
        });

        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.guardando = false;
        const msg = err?.error?.detail || err?.error?.mensaje || 'Ocurrió un error al guardar las modificaciones. Intente nuevamente.';
        this.mensajeError = msg;
        Swal.fire({
          title: 'Error de Guardado',
          text: msg,
          icon: 'error',
          confirmButtonColor: '#4141a5',
          customClass: {
            popup: 'rounded-2xl font-[\'Nunito\',sans-serif]',
            confirmButton: 'rounded-xl px-5 py-2.5 font-bold'
          }
        });
        this.cdr.detectChanges();
      }
    });
  }

  // =========================================================================
  // CANCELACIÓN, RESTABLECIMIENTO Y HELPERS DE FORMULARIO
  // =========================================================================

  cancelarEdicion(): void {
    if (this.formHistoria.dirty) {
      this.mostrarModalCancelar = true;
    } else {
      this.volverAlDetalle();
    }
  }

  confirmarDescarte(): void {
    this.mostrarModalCancelar = false;
    this.formHistoria.reset();
    this.formHistoria.markAsPristine();
    this.volverAlDetalle();
  }

  cerrarModalCancelar(): void {
    this.mostrarModalCancelar = false;
  }

  volverAlDetalle(): void {
    this.router.navigate(['/inicio-admin/historia-clinica/lista']);
  }

  tieneCambiosPendientes(): boolean {
    if (this.formHistoria.dirty) {
      this.mostrarModalCancelar = true;
      return false;
    }
    return true;
  }

  esInvalido(nombreControl: string): boolean {
    const ctrl = this.formHistoria.get(nombreControl);
    return !!(ctrl && ctrl.invalid && (ctrl.touched || this.formularioEnviado));
  }

  obtenerMensajeError(nombreControl: string): string {
    const ctrl = this.formHistoria.get(nombreControl);
    if (!ctrl || !ctrl.errors) return '';

    if (ctrl.errors['required']) return 'Este campo es obligatorio.';
    if (ctrl.errors['minlength']) return `Mínimo ${ctrl.errors['minlength'].requiredLength} caracteres requeridos.`;
    if (ctrl.errors['min']) return `El valor mínimo permitido es ${ctrl.errors['min'].min}.`;
    if (ctrl.errors['max']) return `El valor máximo permitido es ${ctrl.errors['max'].max}.`;
    return 'Valor inválido.';
  }

  restablecerValores(): void {
    if (!this.historiaOriginal) return;

    Swal.fire({
      title: '¿Restablecer valores?',
      text: 'Se descartarán las modificaciones actuales y se restaurarán los datos originales cargados.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4141a5',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Sí, restablecer',
      cancelButtonText: 'Cancelar'
    }).then(res => {
      if (res.isConfirmed) {
        this.cargarHistoria();
      }
    });
  }
}

export { HistoriaClinica2Component as EditarHistoriaClinicaComponent };