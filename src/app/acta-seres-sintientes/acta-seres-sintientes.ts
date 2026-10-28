import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { ComprasService } from '../services/compras.service';
import { PatologiaService, Patologia } from '../services/patologia.service';
import { ExamenesClinicosService, ExamenClinico } from '../services/examenes-clinicos.service';
import { HistoriaClinicaService } from '../services/historia-clinica.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { finalize, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { environment } from '../../environments/environment';


@Component({
  selector: 'app-acta-seres-sintientes',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, CommonModule],
  templateUrl: './acta-seres-sintientes.html',
  styleUrl: './acta-seres-sintientes.css',
})
export class ActaSeresSintientes implements OnInit {
  private readonly apiDiagnosticoPatologiaUrl = `${environment.apiUrlClinica}diagnostico-patologias/`;
  private readonly apiHistoriasUrl = environment.apiUrlHistorias || `${environment.apiUrlClinica}historias/`;

  // Formulario Reactivo de los 4 apartados de la Consulta
  formConsulta!: FormGroup;

  // =========================================================================
  // 1. CONSULTA (Espera y Datos del Paciente)
  // =========================================================================
  get motivo_consulta(): string { return this.motivoConsulta; }
  set motivo_consulta(v: string) { this.motivoConsulta = v ?? ''; }
  anamnesis = '';
  get actitud_temperamento(): string { return this.signosVitales.actitudTemperamento; }
  set actitud_temperamento(v: string) { this.signosVitales.actitudTemperamento = v ?? ''; }
  get resultado_estado(): string { return this.resultadoEstado; }
  set resultado_estado(v: string) { this.resultadoEstado = v || 'Estable'; }

  // =========================================================================
  // 2. EXÁMENES (Pruebas y Sistemas Orgánicos)
  // =========================================================================
  get frecuencia_respiratoria(): number | string | null { return this.signosVitales.frecuenciaRespiratoria; }
  set frecuencia_respiratoria(v: number | string | null) { this.signosVitales.frecuenciaRespiratoria = v; }
  get frecuencia_cardiaca(): number | string | null { return this.signosVitales.frecuenciaCardiaca; }
  set frecuencia_cardiaca(v: number | string | null) { this.signosVitales.frecuenciaCardiaca = v; }
  get temperatura(): number | string | null { return this.signosVitales.temperatura; }
  set temperatura(v: number | string | null) { this.signosVitales.temperatura = v; }
  get pulso(): string { return this.signosVitales.pulso; }
  set pulso(v: string) { this.signosVitales.pulso = v ?? ''; }
  get tllc(): string { return this.signosVitales.tiempoLlenadoCapilar; }
  set tllc(v: string) { this.signosVitales.tiempoLlenadoCapilar = v ?? ''; }
  get ganglios_linfaticos(): string { return this.signosVitales.gangliosLinfaticos; }
  set ganglios_linfaticos(v: string) { this.signosVitales.gangliosLinfaticos = v ?? ''; }
  get mucosas(): string { return this.signosVitales.mucosas; }
  set mucosas(v: string) { this.signosVitales.mucosas = v ?? ''; }
  get hallazgos_examen(): string { return this.descripcionHallazgos; }
  set hallazgos_examen(v: string) { this.descripcionHallazgos = v ?? ''; }
  get evaluacion_sistemas(): { [key: string]: string } { return this.sistemas; }
  set evaluacion_sistemas(v: { [key: string]: string }) {
    if (v && typeof v === 'object') {
      this.sistemas = { ...this.crearSistemasPorDefecto(), ...v };
    }
  }
  get observaciones_examen(): string { return this.observacionesExamen; }
  set observaciones_examen(v: string) { this.observacionesExamen = v ?? ''; }
  get examenes_complementarios(): any[] { return this.examenesSolicitados; }
  set examenes_complementarios(v: any[]) { this.examenesSolicitados = Array.isArray(v) ? v : []; }

  // =========================================================================
  // 3. DIAGNÓSTICO (Patología y Plan de Acción)
  // =========================================================================
  get plan_procedimientos(): string { return this.planProcedimientos; }
  set plan_procedimientos(v: string) { this.planProcedimientos = v ?? ''; }

  // =========================================================================
  // 4. TRATAMIENTOS (Fármacos, Insumos y Firmas)
  // =========================================================================
  get materiales_utilizados(): string { return this.materialesUtilizados; }
  set materiales_utilizados(v: string) { this.materialesUtilizados = v ?? ''; }
  get ingresa_cba(): boolean { return this.ingresaCBA === 'SI'; }
  set ingresa_cba(v: boolean) { this.ingresaCBA = v ? 'SI' : 'NO'; }
  get motivo_ingreso_cba(): string { return this.motivoIngresoNoIngreso; }
  set motivo_ingreso_cba(v: string) { this.motivoIngresoNoIngreso = v ?? ''; }
  get canil_asignado(): string { return this.canilAsignado; }
  set canil_asignado(v: string) { this.canilAsignado = v ?? ''; }
  get funcionario_recibe_cba(): string { return this.funcionarioRecibeCBA; }
  set funcionario_recibe_cba(v: string) { this.funcionarioRecibeCBA = v ?? ''; }

  // Campos de diagnóstico y tratamiento
  descripcionHallazgos = '';
  diagnosticoFinal = '';
  materialesUtilizados = '';
  planProcedimientos = '';
  pronostico = 'Favorable';

  // Catálogo de Patologías (Criterios 1, 2 y 3)
  patologias: Patologia[] = [];
  patologiasFiltradas: Patologia[] = [];
  cargandoPatologias: boolean = false;
  busquedaPatologia: string = '';
  idPatologiaSeleccionada: number | null = null;
  patologiaSeleccionada: Patologia | null = null;

  problemasClinicos: string[] = ['', '', '', '', '', '', ''];
  diagnosticosDiferenciales: string[] = ['', '', '', '', '', '', ''];

  // Datos de ingreso al CBA
  ingresaCBA = 'NO';
  motivoIngresoNoIngreso = '';
  canilAsignado = '';
  funcionarioRecibeCBA = '';
  mostrarNuevosCasos = true;

  // Campos auditados de Consulta y Examen Clínico (Backend)
  prioridad = 'Normal';
  resultadoEstado = 'Estable';
  observacionesExamen = '';
  observacionesSistemas = '';

  opcionesPronostico: string[] = ['Favorable', 'Reservado', 'Desfavorable', 'Crítico'];
  opcionesPrioridad: string[] = ['Normal', 'Control', 'Urgencia', 'Emergencia'];
  opcionesResultadoEstado: string[] = ['Estable', 'En Observación', 'Delicado', 'Crítico', 'Recuperado'];
  opcionesMucosas: string[] = ['Rosadas / Normales', 'Pálidas', 'Cianóticas', 'Ictéricas', 'Congestivas'];
  opcionesGanglios: string[] = ['Normales', 'Aumentados', 'Reactivos', 'Dolorosos'];
  opcionesActitud: string[] = ['Alerta / Responsivo', 'Deprimido / Decaído', 'Dócil / Tranquilo', 'Agresivo / Alerta', 'Estuporoso / Comatoso'];
  opcionesEstadoExamen: string[] = ['solicitado', 'en_proceso', 'completado'];


  // =========================================================================
  // MODELOS DEL FORMULARIO → PAYLOAD DE POST /api/clinica/historias/
  // =========================================================================

  // Motivo de consulta (obligatorio para la consulta médica, máx. 255 caracteres) y peso
  motivoConsulta = '';
  pesoPaciente: number | string | null = null;

  // Tenedor / responsable del animal
  tenedor = {
    documentoIdentidad: '',
    nombres: '',
    telefono: '',
    correoElectronico: '',
    direccion: ''
  };

  // Anamnesis (antecedentes de la historia clínica)
  anamnesicos = {
    estadoGeneral: 'Estable',
    ultimaDesparasitacion: '',
    productoDesparasitacion: '',
    vacunas: '',
    enfermedadesAnteriores: '',
    tratamientos: '',
    evolucion: '',
    alimentacion: '',
    historiaReproductiva: '',
    ultimoCelo: '',
    fechaUltimoParto: ''
  };

  // Examen clínico: signos vitales y hallazgos generales
  signosVitales: {
    frecuenciaRespiratoria: number | string | null;
    frecuenciaCardiaca: number | string | null;
    temperatura: number | string | null;
    pulso: string;
    tiempoLlenadoCapilar: string;
    gangliosLinfaticos: string;
    mucosas: string;
    actitudTemperamento: string;
  } = {
      frecuenciaRespiratoria: null,
      frecuenciaCardiaca: null,
      temperatura: null,
      pulso: '',
      tiempoLlenadoCapilar: '',
      gangliosLinfaticos: '',
      mucosas: '',
      actitudTemperamento: ''
    };

  guardandoExpediente = false;

  // El nombre y el documento del tutor viven dentro de `tenedor`
  get nombreAcudiente(): string { return this.tenedor.nombres; }
  set nombreAcudiente(valor: string) { this.tenedor.nombres = valor ?? ''; }
  get cedulaAcudiente(): string { return this.tenedor.documentoIdentidad; }
  set cedulaAcudiente(valor: string) { this.tenedor.documentoIdentidad = valor ?? ''; }

  /** Texto recortado; undefined si queda vacío. */
  private textoOpcional(valor: any): string | undefined {
    const texto = String(valor ?? '').trim();
    return texto ? texto : undefined;
  }

  /** Fecha en formato ISO YYYY-MM-DD o null (Django DateField rechaza cadenas vacías). */
  private fechaOpcional(valor: any): string | null {
    const texto = String(valor ?? '').trim();
    return texto ? texto : null;
  }

  /** Número opcional; acepta coma decimal. undefined si está vacío o no es numérico. */
  private numeroOpcional(valor: any, entero = false): number | undefined {
    if (valor === null || valor === undefined || String(valor).trim() === '') return undefined;
    const n = Number(String(valor).replace(',', '.'));
    if (!isFinite(n)) return undefined;
    return entero ? Math.round(n) : n;
  }

  /** ID real del animal (entero positivo), sin confundirlo con id_seguimiento. */
  private resolverIdAnimal(item: any): number | undefined {
    const candidato =
      item?.id_animal ??
      item?.id_animal_id ??
      item?.animal?.id_animal ??
      item?.animal?.id ??
      item?.animales?.[0]?.id_animal ??
      item?.animales?.[0]?.id ??
      item?.paciente?.id_animal ??
      item?.paciente?.id ??
      item?.id_paciente ??
      item?.paciente_id;
    const n = Number(candidato);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  }

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

  private inicializarFormularioConsulta(): void {
    this.formConsulta = this.fb.group({
      // 1. Consulta (Espera y Datos del Paciente)
      motivo_consulta: [''],
      prioridad: ['Normal'],
      anamnesis: [''],
      actitud_temperamento: [''],
      resultado_estado: ['Estable'],

      // 2. Exámenes (Pruebas y Sistemas Orgánicos)
      frecuencia_respiratoria: [null],
      frecuencia_cardiaca: [null],
      temperatura: [null],
      pulso: [''],
      tllc: [''],
      ganglios_linfaticos: [''],
      mucosas: [''],
      hallazgos_examen: [''],
      evaluacion_sistemas: [{}],
      observaciones_examen: [''],
      examenes_complementarios: [[]],

      // 3. Diagnóstico (Patología y Plan de Acción)
      pronostico: ['Favorable'],
      plan_procedimientos: [''],

      // 4. Tratamientos (Fármacos, Insumos y Firmas)
      materiales_utilizados: [''],
      ingresa_cba: [false],
      motivo_ingreso_cba: [''],
      canil_asignado: [''],
      funcionario_recibe_cba: ['']
    });
  }

  /**
   * Consume el GET de Consulta (por id_historia, id_consulta, id_animal o nombre del paciente)
   * y mapea todos los campos en los 4 apartados de la vista y en el Reactive Form.
   */
  cargarDatosConsulta(
    idHistoriaOIdConsulta?: number | string | null,
    idAnimal?: number | string | null,
    nombrePaciente?: string | null
  ): void {
    const nombreEfectivo = nombrePaciente || this.obtenerNombrePaciente(this.seguimientoSeleccionado) || '';
    this.historiaClinicaService
      .obtenerConsultaPorHistoriaOId(idHistoriaOIdConsulta, idAnimal, nombreEfectivo)
      .subscribe({
        next: (consulta: any) => {
          if (!consulta) return;
          this.mapearConsultaEnCuatroPasos(consulta);
        },
        error: (err) => {
          console.warn('No se pudo cargar consulta previa para este paciente:', err);
        }
      });
  }

  /**
   * Extrae y mapea en las 4 pestañas toda la información clínica que fue diligenciada en la App Móvil
   * dentro del registro de Seguimiento (GET /api/peticiones/seguimiento/listar/ y GET /api/peticiones/seguimiento/:id/).
   */
  private extraerYMapeoDesdeSeguimientoMovil(seguimiento: any): void {
    if (!seguimiento) return;

    const quejaRaw = String(seguimiento?.anamnesis_descripcion_queja || '').trim();
    const observacionRaw = String(seguimiento?.observacion || seguimiento?.observaciones || '').trim();
    const tratamientoRaw = String(seguimiento?.tratamiento_realizado || '').trim();
    const compromisosRaw = String(seguimiento?.compromisos || '').trim();
    const pruebasRaw = String(seguimiento?.pruebas_complementarias || '').trim();
    const resultadoPruebasRaw = String(seguimiento?.resultado_pruebas || '').trim();

    // 1. Separar texto base de anamnesis de los bloques estructurados que arma la app móvil
    let anamnesisLimpia = quejaRaw
      .replace(/\[Examen clínico:[^\]]*\]/gi, '')
      .replace(/\[Exámenes clínicos[^\]]*\]/gi, '')
      .split('=======================================================')[0]
      .trim();

    if (anamnesisLimpia) {
      this.anamnesis = anamnesisLimpia;
      this.anamnesicos.evolucion = anamnesisLimpia;
    }
    this.motivo_consulta = observacionRaw || anamnesisLimpia || this.motivoConsulta || '';

    // 2. Extraer constantes fisiológicas embebidas desde la móvil: [Examen clínico: FC: 110 lpm. FR: 26 rpm. Mucosas: ...]
    const matchFc = quejaRaw.match(/FC:\s*(\d+(?:[.,]\d+)?)/i);
    if (matchFc) {
      const fcVal = Number(matchFc[1].replace(',', '.'));
      if (fcVal > 0) this.frecuencia_cardiaca = fcVal;
    }
    const matchFr = quejaRaw.match(/FR:\s*(\d+(?:[.,]\d+)?)/i);
    if (matchFr) {
      const frVal = Number(matchFr[1].replace(',', '.'));
      if (frVal > 0) this.frecuencia_respiratoria = frVal;
    }
    const matchTemp = quejaRaw.match(/Temp(?:eratura)?:\s*(\d+(?:[.,]\d+)?)/i);
    if (matchTemp) {
      const tVal = Number(matchTemp[1].replace(',', '.'));
      if (tVal > 0) this.temperatura = tVal;
    }
    const matchMucosas = quejaRaw.match(/Mucosas:\s*([^.\]\n]+)/i);
    if (matchMucosas && matchMucosas[1]?.trim()) {
      const mucMovil = matchMucosas[1].trim();
      const coincidenciaMucosa = this.opcionesMucosas.find(
        m => m.toLowerCase().includes(mucMovil.toLowerCase()) || mucMovil.toLowerCase().includes(m.split('/')[0].trim().toLowerCase())
      );
      this.mucosas = coincidenciaMucosa || mucMovil;
    }

    // 3. Extraer Exámenes Complementarios desde pruebas_complementarias / resultado_pruebas o desde [Exámenes clínicos (...): ...]
    const examenesExtraidos: any[] = [];
    if (pruebasRaw) {
      const nombresPruebas = pruebasRaw.split('|').map(s => s.trim()).filter(Boolean);
      const paresResultados = resultadoPruebasRaw.split('|').map(s => s.trim()).filter(Boolean);
      nombresPruebas.forEach((nombreP, idx) => {
        const par = paresResultados[idx] || '';
        const resLimpio = par.includes(':') ? par.split(':').slice(1).join(':').trim() : par;
        examenesExtraidos.push({
          id_examen: null,
          nombre: nombreP,
          tipo: 'Prueba Diagnóstica',
          descripcion: '',
          estado: resLimpio && resLimpio.toLowerCase() !== 'pendiente' ? 'completado' : 'solicitado',
          resultado: resLimpio || 'Pendiente',
          ruta_archivo_resultado: ''
        });
      });
    } else {
      const matchExBloque = quejaRaw.match(/\[Exámenes clínicos\s*\(\d+\):\s*([^\]]+)\]/i);
      if (matchExBloque && matchExBloque[1]) {
        const items = matchExBloque[1].split(';').map(s => s.trim()).filter(Boolean);
        items.forEach(item => {
          const m = item.match(/^(.+?)\s*\(([^)]*)\)$/);
          const nombreEx = m ? m[1].trim() : item;
          const resEx = m ? m[2].trim() : 'Solicitado';
          examenesExtraidos.push({
            id_examen: null,
            nombre: nombreEx,
            tipo: 'Prueba Diagnóstica',
            descripcion: '',
            estado: resEx.toLowerCase() !== 'pendiente' ? 'completado' : 'solicitado',
            resultado: resEx,
            ruta_archivo_resultado: ''
          });
        });
      }
    }
    if (examenesExtraidos.length > 0) {
      this.examenes_complementarios = examenesExtraidos;
    }
    if (resultadoPruebasRaw && !this.hallazgos_examen) {
      this.hallazgos_examen = resultadoPruebasRaw;
    }

    // 4. Extraer Evaluación de Sistemas y Datos de Rescate / Ingreso al CBA si vienen en el Anexo de la móvil
    if (quejaRaw.includes('ANEXO: ACTA DE RESCATE Y TRASLADO AL CBA')) {
      this.ingresa_cba = true;
      const matchCausal = quejaRaw.match(/•\s*Causal de rescate:\s*([^\n\r]+)/i);
      if (matchCausal && matchCausal[1]?.trim()) {
        this.motivo_ingreso_cba = matchCausal[1].trim();
      }
      const matchVetReceptor = quejaRaw.match(/•\s*Veterinario receptor:\s*([^\n\r]+)/i);
      if (matchVetReceptor && matchVetReceptor[1]?.trim()) {
        this.funcionario_recibe_cba = matchVetReceptor[1].trim();
      }
      const matchObsRescate = quejaRaw.match(/---\s*OBSERVACIONES DEL RESCATE\s*---\s*([\s\S]*?)(?:---\s*RECEPCIÓN EN CLÍNICA|$)/i);
      if (matchObsRescate && matchObsRescate[1]?.trim()) {
        this.observaciones_examen = matchObsRescate[1].trim();
        this.observacionesSistemas = matchObsRescate[1].trim();
      }

      // Evaluar los sistemas reportados por la app móvil (SÍ = Anormal 'AN', NO = Normal 'N')
      const tieneSi = (regex: RegExp) => regex.test(quejaRaw);
      const nuevosSistemas = { ...this.crearSistemasPorDefecto() };
      nuevosSistemas['respiratorio'] =
        tieneSi(/Presenta moco:\s*S[ÍI]/i) ||
        tieneSi(/dificulta respirar:\s*S[ÍI]/i) ||
        tieneSi(/Tos:\s*S[ÍI]/i)
          ? 'AN'
          : 'N';
      nuevosSistemas['ojos'] = tieneSi(/Lagaña o lagrimeo:\s*S[ÍI]/i) ? 'AN' : 'N';
      nuevosSistemas['nariz'] = tieneSi(/Presenta moco:\s*S[ÍI]/i) ? 'AN' : 'N';
      nuevosSistemas['digestivo'] =
        tieneSi(/Presenta vómito:\s*S[ÍI]/i) || tieneSi(/Presenta diarrea:\s*S[ÍI]/i)
          ? 'AN'
          : 'N';
      nuevosSistemas['hidratacion'] = tieneSi(/Deshidratado:\s*S[ÍI]/i) ? 'AN' : 'N';
      nuevosSistemas['general'] = tieneSi(/Flaco o desnutrido:\s*S[ÍI]/i) || tieneSi(/Postrado:\s*S[ÍI]/i) ? 'AN' : 'N';
      nuevosSistemas['musculoesqueletico'] =
        tieneSi(/Caída de las patas:\s*S[ÍI]/i) ||
        tieneSi(/Cojo:\s*S[ÍI]/i) ||
        tieneSi(/herida abierta:\s*S[ÍI]/i) ||
        tieneSi(/Postrado:\s*S[ÍI]/i)
          ? 'AN'
          : 'N';
      nuevosSistemas['tegumentario'] =
        tieneSi(/Presenta peladuras:\s*S[ÍI]/i) ||
        tieneSi(/Heridas con sangre:\s*S[ÍI]/i) ||
        tieneSi(/Pulgas o garrapatas:\s*S[ÍI]/i) ||
        tieneSi(/moscos o gusanos:\s*S[ÍI]/i)
          ? 'AN'
          : 'N';
      nuevosSistemas['genitourinario'] =
        tieneSi(/masa o secreción:\s*S[ÍI]/i) ||
        tieneSi(/gestante:\s*S[ÍI]/i) ||
        tieneSi(/en celo:\s*S[ÍI]/i)
          ? 'AN'
          : 'N';
      this.evaluacion_sistemas = nuevosSistemas;
    }

    // 5. Mapear Diagnóstico, Plan de Procedimientos y Tratamientos desde la móvil
    if (tratamientoRaw) {
      this.plan_procedimientos = tratamientoRaw;
      if (!this.materiales_utilizados) {
        this.materiales_utilizados = tratamientoRaw;
      }
    }
    if (compromisosRaw && !this.observaciones_examen) {
      this.observaciones_examen = compromisosRaw;
    }
    if (observacionRaw && !this.diagnosticoFinal) {
      this.diagnosticoFinal = observacionRaw;
    }

    // 6. Extraer Tarjeta Profesional y firmas desde funcionarios del seguimiento móvil
    const funcPrincipal = Array.isArray(seguimiento?.funcionarios) && seguimiento.funcionarios.length > 0
      ? seguimiento.funcionarios[0]
      : (Array.isArray(seguimiento?.funcionarios_detalle) && seguimiento.funcionarios_detalle.length > 0
          ? seguimiento.funcionarios_detalle[0]
          : null);
    if (funcPrincipal) {
      if (funcPrincipal.nombre && !this.nombreVeterinario) {
        this.nombreVeterinario = funcPrincipal.nombre;
      }
      const mp = funcPrincipal.tarjeta_profesional || funcPrincipal.matricula_profesional;
      if (mp) {
        this.tarjetaProfesional = String(mp);
      } else if (funcPrincipal.cargo) {
        const matchMp = String(funcPrincipal.cargo).match(/M\.?P\.?\s*([A-Za-z0-9\-]+)/i);
        if (matchMp && matchMp[1]) {
          this.tarjetaProfesional = matchMp[1];
        }
      }
    } else if (seguimiento?.funcionario_cargo || seguimiento?.notificador_cargo) {
      const cargoStr = String(seguimiento.funcionario_cargo || seguimiento.notificador_cargo);
      const matchMp = cargoStr.match(/M\.?P\.?\s*([A-Za-z0-9\-]+)/i);
      if (matchMp && matchMp[1]) {
        this.tarjetaProfesional = matchMp[1];
      }
    }

    // Sincronizar con el Reactive Form
    this.sincronizarFormConsulta();
    this.cdr.detectChanges();
  }

  private sincronizarFormConsulta(): void {
    if (!this.formConsulta) return;
    this.formConsulta.patchValue({
      motivo_consulta: this.motivo_consulta,
      prioridad: this.prioridad,
      anamnesis: this.anamnesis,
      actitud_temperamento: this.actitud_temperamento,
      resultado_estado: this.resultado_estado,
      frecuencia_respiratoria: this.frecuencia_respiratoria,
      frecuencia_cardiaca: this.frecuencia_cardiaca,
      temperatura: this.temperatura,
      pulso: this.pulso,
      tllc: this.tllc,
      ganglios_linfaticos: this.ganglios_linfaticos,
      mucosas: this.mucosas,
      hallazgos_examen: this.hallazgos_examen,
      evaluacion_sistemas: this.evaluacion_sistemas,
      observaciones_examen: this.observaciones_examen,
      examenes_complementarios: this.examenes_complementarios,
      pronostico: this.pronostico,
      plan_procedimientos: this.plan_procedimientos,
      materiales_utilizados: this.materiales_utilizados,
      ingresa_cba: this.ingresa_cba,
      motivo_ingreso_cba: this.motivo_ingreso_cba,
      canil_asignado: this.canil_asignado,
      funcionario_recibe_cba: this.funcionario_recibe_cba
    });
  }

  /**
   * Mapea la respuesta del modelo Consulta a las propiedades y al Reactive Form de los 4 pasos
   */
  private mapearConsultaEnCuatroPasos(consulta: any): void {
    if (!consulta) return;

    // 1. PASO 1: Consulta (Espera y Datos del Paciente)
    if (consulta.motivo_consulta) {
      this.motivo_consulta = consulta.motivo_consulta;
    }
    if (consulta.prioridad) {
      this.prioridad = consulta.prioridad;
    }
    const anamnesisConsulta = consulta.anamnesis || consulta.evolucion || '';
    if (anamnesisConsulta) {
      this.anamnesis = anamnesisConsulta;
      this.anamnesicos.evolucion = anamnesisConsulta;
    }
    const actitudConsulta = consulta.actitud_temperamento || consulta.constantes?.actitud_temperamento || '';
    if (actitudConsulta) {
      this.actitud_temperamento = actitudConsulta;
    }
    const estadoConsulta = consulta.resultado_estado || consulta.estado_general || '';
    if (estadoConsulta) {
      this.resultado_estado = estadoConsulta;
      this.anamnesicos.estadoGeneral = estadoConsulta;
    }

    // 2. PASO 2: Exámenes (Pruebas y Sistemas Orgánicos)
    const frRaw = consulta.frecuencia_respiratoria ?? consulta.constantes?.frecuencia_respiratoria;
    if (frRaw !== null && frRaw !== undefined && Number(frRaw) > 0) {
      this.frecuencia_respiratoria = Number(frRaw);
    }
    const fcRaw = consulta.frecuencia_cardiaca ?? consulta.constantes?.frecuencia_cardiaca;
    if (fcRaw !== null && fcRaw !== undefined && Number(fcRaw) > 0) {
      this.frecuencia_cardiaca = Number(fcRaw);
    }
    const tempRaw = consulta.temperatura ?? consulta.constantes?.temperatura;
    if (tempRaw !== null && tempRaw !== undefined && Number(tempRaw) > 0) {
      this.temperatura = Number(tempRaw);
    }
    if (consulta.pulso || consulta.constantes?.pulso) {
      this.pulso = consulta.pulso || consulta.constantes?.pulso;
    }
    if (consulta.tllc || consulta.constantes?.tllc) {
      this.tllc = consulta.tllc || consulta.constantes?.tllc;
    }
    if (consulta.ganglios_linfaticos || consulta.constantes?.ganglios_linfaticos) {
      this.ganglios_linfaticos = consulta.ganglios_linfaticos || consulta.constantes?.ganglios_linfaticos;
    }
    if (consulta.mucosas || consulta.constantes?.mucosas) {
      this.mucosas = consulta.mucosas || consulta.constantes?.mucosas;
    }
    if (consulta.hallazgos_examen || consulta.descripcion_hallazgos) {
      this.hallazgos_examen = consulta.hallazgos_examen || consulta.descripcion_hallazgos;
    }

    const sistemasJson = this.parsearJsonSeguro<Record<string, any>>(
      consulta.evaluacion_sistemas || consulta.organos_sistemas,
      {}
    );
    if (sistemasJson && typeof sistemasJson === 'object' && Object.keys(sistemasJson).length > 0) {
      const fusionados = { ...this.evaluacion_sistemas };
      Object.keys(sistemasJson).forEach(k => {
        if (!k.startsWith('_') && k !== 'observaciones' && sistemasJson[k]) {
          fusionados[k] = sistemasJson[k];
        }
      });
      this.evaluacion_sistemas = fusionados;

      if (sistemasJson['_veterinario_responsable'] && !this.nombreVeterinario) {
        this.nombreVeterinario = sistemasJson['_veterinario_responsable'];
      }
      if (sistemasJson['_tarjeta_profesional']) {
        this.tarjetaProfesional = sistemasJson['_tarjeta_profesional'];
      }
      if (sistemasJson['_acudiente_nombre'] && !this.nombreAcudiente) {
        this.nombreAcudiente = sistemasJson['_acudiente_nombre'];
      }
      if (sistemasJson['_acudiente_cedula'] && !this.cedulaAcudiente) {
        this.cedulaAcudiente = sistemasJson['_acudiente_cedula'];
      }
    }

    const obsEx =
      consulta.observaciones_examen ||
      consulta.observaciones_sistemas ||
      sistemasJson?.['observaciones'] ||
      '';
    if (obsEx) {
      this.observaciones_examen = obsEx;
      this.observacionesSistemas = consulta.observaciones_sistemas || sistemasJson?.['observaciones'] || obsEx;
    }

    const examenesRaw = this.parsearJsonSeguro<any>(
      consulta.examenes_complementarios || consulta.examenes_solicitados,
      []
    );
    const listaExamenes = Array.isArray(examenesRaw)
      ? examenesRaw
      : Object.keys(examenesRaw || {}).map(k => ({
          id_examen: null,
          nombre: k,
          estado: examenesRaw[k] ? 'solicitado' : 'pendiente',
          resultado: ''
        }));

    if (listaExamenes.length > 0) {
      this.examenes_complementarios = listaExamenes.map((ex: any) => ({
        id_examen: ex.id_examen ?? ex.id ?? null,
        nombre: ex.nombre || ex.nombre_examen || 'Examen clínico',
        tipo: ex.tipo || 'General',
        descripcion: ex.descripcion || '',
        estado: ex.estado || 'solicitado',
        resultado: ex.resultado || '',
        ruta_archivo_resultado: ex.ruta_archivo_resultado || ''
      }));
    }

    // 3. PASO 3: Diagnóstico (Patología y Plan de Acción)
    if (consulta.pronostico) {
      this.pronostico = consulta.pronostico;
    }
    if (consulta.plan_procedimientos || consulta.plan_tratamiento) {
      this.plan_procedimientos = consulta.plan_procedimientos || consulta.plan_tratamiento;
    }
    if (consulta.diagnostico_principal || consulta.diagnostico_final) {
      this.diagnosticoFinal = consulta.diagnostico_principal || consulta.diagnostico_final;
    }
    if (consulta.lista_problemas) {
      const lineas = String(consulta.lista_problemas)
        .split(/[\n;]/)
        .map((l: string) => l.replace(/^\d+[\.\-]\s*/, '').trim())
        .filter(Boolean);
      lineas.slice(0, 7).forEach((p: string, idx: number) => {
        this.problemasClinicos[idx] = p;
      });
    }

    // 4. PASO 4: Tratamientos (Fármacos, Insumos y Firmas)
    if (consulta.materiales_utilizados) {
      this.materiales_utilizados = consulta.materiales_utilizados;
    }
    if (consulta.ingresa_cba !== undefined && consulta.ingresa_cba !== null) {
      const ingresaBool =
        consulta.ingresa_cba === true ||
        String(consulta.ingresa_cba || '').toUpperCase() === 'SI' ||
        String(consulta.ingresa_cba || '').toLowerCase() === 'true';
      this.ingresa_cba = ingresaBool;
    }
    if (consulta.motivo_ingreso_cba || consulta.motivo_ingreso_no_ingreso) {
      this.motivo_ingreso_cba = consulta.motivo_ingreso_cba || consulta.motivo_ingreso_no_ingreso;
    }
    if (consulta.canil_asignado) {
      this.canil_asignado = consulta.canil_asignado;
    }
    if (consulta.funcionario_recibe_cba) {
      this.funcionario_recibe_cba = consulta.funcionario_recibe_cba;
    }

    if (Array.isArray(consulta.tratamientos) && consulta.tratamientos.length > 0) {
      this.medicamentosSeleccionados = consulta.tratamientos.map((t: any) => ({
        id: t.id_medicamento ?? t.id ?? null,
        nombre: t.nombre || t.producto_base || t.productoBase || t.producto || 'Medicamento',
        principio_activo: t.principio_activo || '',
        concentracion: t.concentracion || '',
        presentacion: t.presentacion || '',
        dosis: t.dosis || t.dosis_basica || t.dosisBasica || '',
        via: t.via || t.via_administracion || '',
        frecuencia: t.frecuencia || t.frecuencia_duracion || t.frecuenciaDuracion || '',
        duracion_dias: t.duracion_dias ?? null,
        descripcion: t.descripcion || t.posologia || '',
        responsable_admin: t.responsable_admin || '',
        reaccion_comentarios: t.reaccion_comentarios || '',
        stockDisponible: t.stockDisponible ?? 10,
        cantidadAAdministrar: t.cantidadAAdministrar ?? 1,
        administrado: !!t.administrado,
        cantidadEfectivaAdministrada: t.cantidadEfectivaAdministrada ?? 0,
        administrando: false
      }));
    }

    // Parchear el Reactive Form con todos los campos de los 4 apartados
    this.sincronizarFormConsulta();
    this.cdr.detectChanges();
  }

  private asegurarHistoriaClinica(idAnimal: number, callbackExito?: () => void): void {
    const token = localStorage.getItem('token');
    const headers = token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
    const nombrePaciente = this.obtenerNombrePaciente(this.seguimientoSeleccionado);

    this.http.get<any>(`${this.apiHistoriasUrl}?id_animal=${idAnimal}`, { headers }).subscribe({
      next: (res) => {
        const lista = Array.isArray(res) ? res : (res?.results || []);
        // Coincidencia estricta por id_animal (nunca usar lista[0] de otro animal)
        const histCoincidente = lista.find(
          (h: any) => Number(h?.id_animal) === Number(idAnimal)
        );

        if (histCoincidente && histCoincidente.id_historia) {
          const hist = histCoincidente;
          if (hist.numero_historia) {
            this.numeroRadicadoActual = hist.numero_historia;
          }
          this.anamnesicos.ultimaDesparasitacion = hist.fecha_ultima_desparasitacion || this.anamnesicos.ultimaDesparasitacion;
          this.anamnesicos.productoDesparasitacion = hist.producto_desparasitacion || this.anamnesicos.productoDesparasitacion;
          this.anamnesicos.vacunas = hist.vacunas || this.anamnesicos.vacunas;
          this.anamnesicos.enfermedadesAnteriores = hist.enfermedades_anteriores || this.anamnesicos.enfermedadesAnteriores;
          this.anamnesicos.tratamientos = hist.tratamientos_anteriores || this.anamnesicos.tratamientos;
          if (hist.evolucion_previa && !this.anamnesis) {
            this.anamnesicos.evolucion = hist.evolucion_previa;
            this.anamnesis = hist.evolucion_previa;
          }
          this.anamnesicos.alimentacion = hist.alimentacion || this.anamnesicos.alimentacion;
          this.anamnesicos.historiaReproductiva = hist.estado_reproductivo || this.anamnesicos.historiaReproductiva;
          this.anamnesicos.ultimoCelo = hist.fecha_ultimo_celo || this.anamnesicos.ultimoCelo;
          this.anamnesicos.fechaUltimoParto = hist.fecha_ultimo_parto || this.anamnesicos.fechaUltimoParto;

          this.cargarDatosConsulta(hist.id_historia, idAnimal, nombrePaciente);
          this.cdr.detectChanges();
          if (callbackExito) callbackExito();
        } else {
          const idHistOCons = this.seguimientoSeleccionado?.id_consulta || this.seguimientoSeleccionado?.id_historia || null;
          this.cargarDatosConsulta(idHistOCons, idAnimal, nombrePaciente);
          if (callbackExito) callbackExito();
        }
      },
      error: () => {
        const idHistOCons = this.seguimientoSeleccionado?.id_consulta || this.seguimientoSeleccionado?.id_historia || null;
        this.cargarDatosConsulta(idHistOCons, idAnimal, nombrePaciente);
        if (callbackExito) callbackExito();
      }
    });
  }

  private escaparHtml(texto: string): string {
    return texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Convierte el cuerpo de un error 400 de DRF (anidado) en líneas legibles. */
  private formatearErroresBackend(err: any): string[] {
    const cuerpo = err?.error;
    if (!cuerpo) return [];
    if (typeof cuerpo === 'string') {
      return [cuerpo.length > 300 ? cuerpo.slice(0, 300) + '…' : cuerpo];
    }
    const lineas: string[] = [];
    const recorrer = (valor: any, ruta: string): void => {
      if (valor === null || valor === undefined) return;
      if (Array.isArray(valor)) {
        valor.forEach((v, i) => {
          if (v !== null && typeof v === 'object') recorrer(v, `${ruta} #${i + 1}`);
          else lineas.push(ruta ? `${ruta}: ${v}` : String(v));
        });
      } else if (typeof valor === 'object') {
        Object.keys(valor).forEach(k => recorrer(valor[k], ruta ? `${ruta} › ${k}` : k));
      } else {
        lineas.push(ruta ? `${ruta}: ${valor}` : String(valor));
      }
    };
    recorrer(cuerpo, '');
    return lineas;
  }

  private mostrarErrorServidor(error: any, tituloFallback: string): void {
    let titulo = tituloFallback;
    let mensajeHtml = 'Ocurrió un problema en la comunicación con el servidor.';

    if (error.status === 400) {
      const detalle = this.formatearErroresBackend(error);
      titulo = 'El servidor rechazó algunos datos';
      mensajeHtml = detalle.length
        ? detalle.map(linea => this.escaparHtml(linea)).join('<br>')
        : 'Verifica los campos obligatorios del formulario.';
    } else if (error.status === 401 || error.status === 403) {
      mensajeHtml = 'Tu sesión ha expirado o no tiene permisos. Por favor, inicia sesión nuevamente.';
    } else if (error.status === 0) {
      const servidor = environment.backendUrl || 'el servidor en la nube';
      mensajeHtml = `No se pudo conectar con el servidor en <b>${this.escaparHtml(servidor)}</b>.<br>Verifica la conexión a internet o el estado del backend desplegado.`;
    } else if (error.status >= 500) {
      mensajeHtml = 'El servidor en la nube reportó un error interno (500). Revisa los registros del backend.';
    }

    Swal.fire({
      icon: 'error',
      title: titulo,
      html: `<div style="text-align:left;font-size:13px">${mensajeHtml}</div>`,
      confirmButtonColor: '#4141A5'
    });
  }

  /** Limpia todo el formulario clínico. */
  private reiniciarFormularioClinico(): void {
    this.motivoConsulta = '';
    this.pesoPaciente = null;
    this.tenedor = { documentoIdentidad: '', nombres: '', telefono: '', correoElectronico: '', direccion: '' };
    this.anamnesicos = {
      estadoGeneral: 'Estable',
      ultimaDesparasitacion: '', productoDesparasitacion: '', vacunas: '', enfermedadesAnteriores: '',
      tratamientos: '', evolucion: '', alimentacion: '', historiaReproductiva: '', ultimoCelo: '', fechaUltimoParto: ''
    };
    this.signosVitales = {
      frecuenciaRespiratoria: null, frecuenciaCardiaca: null, temperatura: null, pulso: '',
      tiempoLlenadoCapilar: '', gangliosLinfaticos: '', mucosas: '', actitudTemperamento: ''
    };
    this.ingresaCBA = 'NO';
    this.motivoIngresoNoIngreso = '';
    this.canilAsignado = '';
    this.funcionarioRecibeCBA = '';
    this.descripcionHallazgos = '';
    this.diagnosticoFinal = '';
    this.materialesUtilizados = '';
    this.planProcedimientos = '';
    this.pronostico = 'Favorable';
    this.problemasClinicos = ['', '', '', '', '', '', ''];
    this.diagnosticosDiferenciales = ['', '', '', '', '', '', ''];
    this.idPatologiaSeleccionada = null;
    this.patologiaSeleccionada = null;
    this.prioridad = 'Normal';
    this.resultadoEstado = 'Estable';
    this.observacionesExamen = '';
    this.observacionesSistemas = '';
    this.medicamentosSeleccionados = [];
    this.examenesSolicitados = [];
    this.reiniciarSistemas('NE');
  }

  /**
   * Función principal del POST HTTP hacia el backend (/api/clinica/historias/)
   * Envía el payload exacto esperado por HistoriaClinicaSerializer.
   */
  guardarHistoriaClinica(): void {
    if (this.guardandoExpediente) return;

    const animal = this.seguimientoSeleccionado;
    if (!animal) {
      Swal.fire('Selecciona un animal', 'Primero selecciona un animal de la lista de turnos.', 'warning');
      return;
    }

    const idAnimal = this.resolverIdAnimal(animal);
    if (!idAnimal) {
      Swal.fire(
        'Falta el ID del animal',
        'No se encontró el identificador del animal en el registro. Asegúrate de que el animal esté registrado en la base de datos.',
        'warning'
      );
      return;
    }

    // Validación estricta de stock en inventario de campo antes de permitir guardar
    const medExcedido = this.medicamentosSeleccionados.find((m: any) =>
      !m.administrado && (Number(m.cantidadAAdministrar) || 0) > (Number(m.stockDisponible) || 0)
    );

    if (medExcedido) {
      const disp = Number(medExcedido.stockDisponible) || 0;
      const sol = Number(medExcedido.cantidadAAdministrar) || 0;
      Swal.fire({
        icon: 'error',
        title: 'Stock insuficiente en inventario de campo',
        text: `No cuentas con suficiente stock en tu inventario de campo (Disponibles: ${disp}, Solicitados: ${sol}). Por favor, ajusta la cantidad o utiliza una alternativa disponible.`,
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    const nombreAnimal = String(this.obtenerNombrePaciente(animal) || 'Paciente').trim();
    const numHistoria = this.numeroRadicadoActual?.trim() || `HC-${idAnimal}`;

    // =========================================================================
    // PAYLOAD EXACTO PARA: POST /api/clinica/historias/ (Backend en la nube)
    // Campos del modelo HistoriaClinica / HistoriaClinicaSerializer
    // =========================================================================
    const payloadHistoria: any = {
      id_animal: idAnimal,
      numero_historia: numHistoria,
      estado_general: this.anamnesicos.estadoGeneral?.trim() || 'Estable',
      fecha_ultima_desparasitacion: this.fechaOpcional(this.anamnesicos.ultimaDesparasitacion),
      producto_desparasitacion: this.textoOpcional(this.anamnesicos.productoDesparasitacion) || '',
      vacunas: this.textoOpcional(this.anamnesicos.vacunas) || '',
      enfermedades_anteriores: this.textoOpcional(this.anamnesicos.enfermedadesAnteriores) || '',
      tratamientos_anteriores: this.textoOpcional(this.anamnesicos.tratamientos) || '',
      evolucion_previa: this.textoOpcional(this.anamnesicos.evolucion) || '',
      alimentacion: this.textoOpcional(this.anamnesicos.alimentacion) || '',
      estado_reproductivo: this.textoOpcional(this.anamnesicos.historiaReproductiva) || '',
      fecha_ultimo_celo: this.fechaOpcional(this.anamnesicos.ultimoCelo),
      fecha_ultimo_parto: this.fechaOpcional(this.anamnesicos.fechaUltimoParto)
    };

    console.log('Payload exacto para POST historia clínica:', payloadHistoria);

    Swal.fire({
      title: '¿Guardar historia clínica?',
      html: `Se registrará la historia clínica del paciente <b>${this.escaparHtml(nombreAnimal)}</b> (${this.escaparHtml(numHistoria)}).`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4141A5'
    }).then((resultado) => {
      if (!resultado.isConfirmed) return;

      const token = localStorage.getItem('token');
      const headers = token
        ? new HttpHeaders({
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        })
        : new HttpHeaders({ 'Content-Type': 'application/json' });

      const urlHistorias = environment.apiUrlHistorias || `${environment.apiUrlClinica}historias/`;

      this.guardandoExpediente = true;
      this.cdr.detectChanges();

      // Búsqueda previa de GET /api/clinica/historias/?id_animal= antes de crear una historia para evitar el error 400 Bad Request por restricción UNIQUE de OneToOneField
      this.http.get<any>(`${urlHistorias}?id_animal=${idAnimal}`, { headers }).subscribe({
        next: (listaResp) => {
          const lista = Array.isArray(listaResp) ? listaResp : (listaResp?.results || []);
          const historiaExistente = lista.find((h: any) => Number(h?.id_animal) === Number(idAnimal));
          if (historiaExistente?.id_historia) {
            console.log('Historia existente detectada previa para el animal, actualizando datos con PATCH:', historiaExistente.id_historia);
            this.http.patch<any>(`${urlHistorias}${historiaExistente.id_historia}/`, payloadHistoria, { headers }).subscribe({
              next: (respPatch) => {
                console.log('Historia clínica actualizada correctamente:', respPatch);
                this.procesarConsultaAsociada(historiaExistente.id_historia, respPatch, headers, true);
              },
              error: (errPatch) => {
                this.guardandoExpediente = false;
                this.cdr.detectChanges();
                this.mostrarErrorServidor(errPatch, 'Error al actualizar historia clínica existente');
              }
            });
          } else {
            // No existe historia previa: crear con POST
            this.http.post<any>(urlHistorias, payloadHistoria, { headers }).subscribe({
              next: (respHistoria) => {
                console.log('Historia clínica creada con éxito en el backend:', respHistoria);
                const idHistoriaGenerada = respHistoria?.id_historia;
                this.procesarConsultaAsociada(idHistoriaGenerada, respHistoria, headers);
              },
              error: (errorPost) => {
                this.guardandoExpediente = false;
                this.cdr.detectChanges();
                this.mostrarErrorServidor(errorPost, 'No fue posible guardar la historia clínica.');
              }
            });
          }
        },
        error: () => {
          // Fallback en caso de error en GET
          this.http.post<any>(urlHistorias, payloadHistoria, { headers }).subscribe({
            next: (respHistoria) => {
              const idHistoriaGenerada = respHistoria?.id_historia;
              this.procesarConsultaAsociada(idHistoriaGenerada, respHistoria, headers);
            },
            error: (errorPost) => {
              this.guardandoExpediente = false;
              this.cdr.detectChanges();
              this.mostrarErrorServidor(errorPost, 'No fue posible guardar la historia clínica.');
            }
          });
        }
      });
    });
  }

  /**
   * Complementa el flujo guardando la consulta clínica, signos vitales, evaluación física y CBA
   * una vez que se tiene la historia clínica confirmada (id_historia).
   */
  private procesarConsultaAsociada(idHistoria: number, respHistoria: any, headers: HttpHeaders, esActualizacion = false): void {
    const motivo = this.motivoConsulta?.trim() || 'Consulta clínica general / Valoración CBA';

    const urlConsultas = environment.apiUrlConsultas || `${environment.apiUrlClinica}consultas/`;
    const temperatura = this.numeroOpcional(this.signosVitales.temperatura);

    const payloadConsulta: any = {
      id_historia: idHistoria,
      motivo_consulta: motivo,
      prioridad: this.prioridad || 'Normal',
      resultado_estado: this.resultadoEstado || 'Estable',
      frecuencia_respiratoria: this.numeroOpcional(this.signosVitales.frecuenciaRespiratoria, true) ?? null,
      frecuencia_cardiaca: this.numeroOpcional(this.signosVitales.frecuenciaCardiaca, true) ?? null,
      temperatura: temperatura !== undefined ? Math.round(temperatura * 10) / 10 : null,
      pulso: this.textoOpcional(this.signosVitales.pulso) || '',
      tllc: this.textoOpcional(this.signosVitales.tiempoLlenadoCapilar) || '',
      ganglios_linfaticos: this.textoOpcional(this.signosVitales.gangliosLinfaticos) || '',
      mucosas: this.textoOpcional(this.signosVitales.mucosas) || '',
      actitud_temperamento: this.textoOpcional(this.signosVitales.actitudTemperamento) || '',
      evaluacion_sistemas: {
        ...this.sistemas,
        _veterinario_responsable: this.nombreVeterinario?.trim() || '',
        _tarjeta_profesional: this.tarjetaProfesional?.trim() || '',
        _acudiente_nombre: this.nombreAcudiente?.trim() || '',
        _acudiente_cedula: this.cedulaAcudiente?.trim() || ''
      },
      hallazgos_examen: this.textoOpcional(this.descripcionHallazgos) || '',
      observaciones_examen: this.textoOpcional(this.observacionesExamen) || '',
      observaciones_sistemas: this.textoOpcional(this.observacionesSistemas) || '',
      materiales_utilizados: this.textoOpcional(this.materialesUtilizados) || '',
      plan_procedimientos: this.textoOpcional(this.planProcedimientos) || '',
      pronostico: this.pronostico || 'Favorable',
      examenes_complementarios: this.examenesSolicitados.map(e => ({
        id_examen: e.id_examen || e.id || null,
        nombre: e.nombre || e.nombre_examen || 'Examen clínico',
        estado: e.estado || 'solicitado',
        resultado: e.resultado || '',
        ruta_archivo_resultado: e.ruta_archivo_resultado || ''
      })),
      ingresa_cba: this.ingresaCBA === 'SI',
      motivo_ingreso_cba: this.textoOpcional(this.motivoIngresoNoIngreso) || '',
      canil_asignado: this.ingresaCBA === 'SI' ? (this.textoOpcional(this.canilAsignado) || '') : '',
      funcionario_recibe_cba: this.ingresaCBA === 'SI' ? (this.textoOpcional(this.funcionarioRecibeCBA) || '') : ''
    };

    this.http.post<any>(urlConsultas, payloadConsulta, { headers }).pipe(
      finalize(() => {
        this.guardandoExpediente = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (respConsulta) => {
        console.log('Consulta registrada con éxito:', respConsulta);
        const idConsultaGenerada = respConsulta?.id_consulta;

        // 1. Registrar Diagnóstico oficial asociado a la consulta
        if (idConsultaGenerada && (this.diagnosticoFinal || this.problemasClinicos.some(p => p && p.trim()))) {
          const problemasStr = this.problemasClinicos.filter(p => p && p.trim()).join('; ');
          const payloadDiag = {
            id_consulta: idConsultaGenerada,
            descripcion: this.diagnosticoFinal || 'Consulta médica general',
            tipo_diagnostico: 'Final',
            lista_problemas: problemasStr
          };
          this.http.post<any>(`${environment.apiUrlClinica}diagnosticos/`, payloadDiag, { headers }).subscribe({
            next: (respDiag) => {
              if (this.idPatologiaSeleccionada && respDiag?.id_diagnostico) {
                this.http.post<any>(this.apiDiagnosticoPatologiaUrl, {
                  id_diagnostico: respDiag.id_diagnostico,
                  id_patologia: this.idPatologiaSeleccionada,
                  hallazgos_pruebas: this.descripcionHallazgos || ''
                }, { headers }).subscribe({ error: () => {} });
              }
            },
            error: () => {}
          });
        }

        // 2. Registrar Tratamientos asociados a la consulta con responsable_admin y reaccion_comentarios
        if (idConsultaGenerada && Array.isArray(this.medicamentosSeleccionados) && this.medicamentosSeleccionados.length > 0) {
          this.medicamentosSeleccionados.forEach((m: any) => {
            const detallesExtra = [
              m.descripcion?.trim(),
              m.responsable_admin?.trim() ? `Resp: ${m.responsable_admin.trim()}` : '',
              m.reaccion_comentarios?.trim() ? `Reacción/Obs: ${m.reaccion_comentarios.trim()}` : ''
            ].filter(Boolean).join(' | ').slice(0, 255);

            const payloadTrat = {
              id_consulta: idConsultaGenerada,
              producto_base: (m.nombre || m.productoBase || 'Medicamento').slice(0, 150),
              dosis_basica: (m.dosis?.trim() || m.dosisBasica?.trim() || 'Según valoración').slice(0, 100),
              presentacion: (m.presentacion?.trim() || 'No especificada').slice(0, 100),
              via_administracion: (m.via?.trim() || 'No especificada').slice(0, 100),
              frecuencia_duracion: ([m.frecuencia?.trim() || m.frecuenciaDuracion?.trim(), m.duracion_dias ? `${m.duracion_dias} días` : ''].filter(Boolean).join(' · ') || 'Según evolución').slice(0, 100),
              descripcion: detallesExtra || 'Aplicación en consulta',
              materiales_utilizados: this.materialesUtilizados?.trim() || ''
            };
            this.http.post<any>(`${environment.apiUrlClinica}tratamientos/`, payloadTrat, { headers }).subscribe({ error: () => {} });
          });
        }

        // 3. Actualizar peso del paciente si se especificó
        const idAnimalActual = this.resolverIdAnimal(this.seguimientoSeleccionado);
        if (idAnimalActual) {
          this.animalesConHistoriaIds.add(Number(idAnimalActual));
          if (this.pesoPaciente) {
            const pesoVal = Number(this.pesoPaciente);
            if (!isNaN(pesoVal) && pesoVal > 0) {
              this.http.patch<any>(`${environment.apiUrlAnimales}${idAnimalActual}/`, { peso: pesoVal }, { headers }).subscribe({ error: () => {} });
            }
          }
        }

        if (this.seguimientoSeleccionado) {
          this.seguimientoSeleccionado.atendido = true;
          this.seguimientoSeleccionado.peticion_estado = 'Atendida';
        }
        this.aplicarFiltros();

        Swal.fire({
          title: '¡Historia clínica y consulta guardadas!',
          icon: 'success',
          html:
            `Historia clínica: <b>${this.escaparHtml(String(respHistoria?.numero_historia || idHistoria))}</b><br>` +
            `Consulta N°: <b>${this.escaparHtml(String(respConsulta?.id_consulta || 'registrada'))}</b><br>` +
            `<span class="text-xs text-emerald-600 font-semibold">✓ Guardado exitoso con sistemas, diagnósticos y tratamientos</span>`,
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#4141A5'
        });

        // 4. Limpieza total y retorno de sistemas al estado normal
        this.reiniciarFormularioClinico();
        this.reiniciarSistemas('NE');
        this.deseleccionarPaciente();
      },
      error: (errConsulta) => {
        console.warn('Historia clínica guardada, detalle de consulta:', errConsulta);
        const idAnimalActual = this.resolverIdAnimal(this.seguimientoSeleccionado);
        if (idAnimalActual) {
          this.animalesConHistoriaIds.add(Number(idAnimalActual));
        }
        if (this.seguimientoSeleccionado) {
          this.seguimientoSeleccionado.atendido = true;
          this.seguimientoSeleccionado.peticion_estado = 'Atendida';
        }
        this.aplicarFiltros();

        Swal.fire({
          title: '¡Historia clínica registrada!',
          icon: 'success',
          html:
            `Historia clínica N°: <b>${this.escaparHtml(String(respHistoria?.numero_historia || idHistoria))}</b> guardada en el backend en la nube.<br>` +
            `<span class="text-xs text-amber-600">Atención: La consulta clínica no pudo adjuntarse (${errConsulta?.status || 'ver consola'}).</span>`,
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#4141A5'
        });
        this.reiniciarFormularioClinico();
        this.reiniciarSistemas('NE');
        this.deseleccionarPaciente();
      }
    });
  }

  /** Alias para mantener compatibilidad con cualquier llamada existente en el template */
  guardarExpedienteCompleto(): void {
    this.guardarHistoriaClinica();
  }



  popalog = {
    logopop: 'images/Escudo_Popayan.svg'
  };

  pestanaActiva: 'consulta' | 'examenes' | 'diagnostico' | 'tratamientos' = 'consulta';

  // Seguimientos recibidos del backend
  seguimientos: any[] = [];
  seguimientosFiltrados: any[] = [];
  seguimientoSeleccionado: any = null;
  cargando = false;
  error = '';
  textoBusqueda = '';
  filtroEspecie = 'Todos';

  // Filtro visual de historia clínica: solo 'pendientes' y 'atendidos' (completados)
  filtroEstadoAtencion: 'pendientes' | 'atendidos' = 'pendientes';
  // Conjunto de IDs de animales que ya cuentan con historia clínica en la base de datos
  animalesConHistoriaIds: Set<number> = new Set<number>();

  // Datos que se muestran en el aval profesional
  numeroRadicadoActual = '';
  nombreVeterinario = '';

  // Catálogo de medicamentos
  mostrarCatalogoMedicamentos = false;
  cargandoMedicamentos = false;
  mensajeMedicamentos = '';
  medicamentosCatalogo: any[] = [];
  medicamentosSeleccionados: any[] = [];
  mapaStockPorId: Map<number, number> = new Map();
  mapaStockPorNombre: Map<string, number> = new Map();

  // Catálogo oficial de exámenes clínicos (Criterios 1, 2, 3 y 4)
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

  // Evaluación física
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

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private authService: AuthService,
    private comprasService: ComprasService,
    private historiaClinicaService: HistoriaClinicaService,
    private cdr: ChangeDetectorRef,
    private http: HttpClient,
    private router: Router,
    private patologiaService: PatologiaService,
    private examenesClinicosService: ExamenesClinicosService
  ) {
    this.inicializarFormularioConsulta();
  }

  /**
   * Resuelve el ID único del animal/paciente correspondiente a un registro de seguimiento
   */
  obtenerIdAnimal(item: any): number | string {
    if (!item) return '';
    return (
      item.id_animal ??
      item.id_animal_id ??
      item.animal?.id_animal ??
      item.animal?.id ??
      item.animales?.[0]?.id_animal ??
      item.animales?.[0]?.id ??
      item.paciente?.id_animal ??
      item.paciente?.id ??
      item.id_historia ??
      item.id_consulta ??
      item.id_seguimiento ??
      item.id ??
      ''
    );
  }

  /**
   * Obtiene el nombre del animal para enriquecer la navegación y búsqueda
   */
  obtenerNombrePaciente(item: any): string {
    if (!item) return '';
    return (
      item.nombre_paciente ||
      item.nombre_animal ||
      item.nombre ||
      item.animal?.nombre ||
      item.animales?.[0]?.nombre ||
      item.paciente?.nombre ||
      ''
    );
  }

  /**
   * Identificador único seguro para el ciclo *ngFor
   */
  trackBySeguimiento = (index: number, item: any): any => {
    if (!item) return index;
    return (
      item.id_animal ??
      item.id_animal_id ??
      item.animal?.id_animal ??
      item.animales?.[0]?.id_animal ??
      item.id_seguimiento ??
      item.id ??
      index
    );
  };

  /**
   * Redirige a la vista de edición de historia clínica garantizando el ID y nombre del paciente específico
   */
  irAEditarHistoria(seguimiento: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (!seguimiento) return;

    const id = this.obtenerIdAnimal(seguimiento);
    const nombre = this.obtenerNombrePaciente(seguimiento);
    const foto = this.obtenerFotoPaciente(seguimiento);

    this.router.navigate(['/inicio-admin/historia-clinica/editar', id], {
      queryParams: {
        ...(nombre ? { nombre } : {}),
        ...(foto ? { foto } : {})
      }
    });
  }

  ngOnInit(): void {
    this.cargarSeguimientos();
    this.reiniciarSistemas('NE');
    this.cargarPatologias();
    this.cargarExamenesClinicos();

    // Ejecutar el GET de Consulta al iniciar solo si existen parámetros de ruta/query
    const idParam =
      this.route.snapshot.paramMap.get('id') ||
      this.route.snapshot.queryParamMap.get('id_consulta') ||
      this.route.snapshot.queryParamMap.get('id_historia') ||
      this.route.snapshot.queryParamMap.get('id') ||
      '';
    const idAnimalParam = this.route.snapshot.queryParamMap.get('id_animal') || '';
    if (idParam || idAnimalParam) {
      this.cargarDatosConsulta(idParam, idAnimalParam);
    }
  }

  // =========================================================================
  // GESTIÓN DEL CATÁLOGO DE PATOLOGÍAS (Criterios 1, 2 y 3)
  // =========================================================================

  /**
   * Criterio 1: Carga el listado de patologías llamando al servicio al iniciar
   */
  cargarPatologias(): void {
    this.cargandoPatologias = true;
    this.patologiaService.obtenerPatologias().subscribe({
      next: (lista: Patologia[]) => {
        this.patologias = lista;
        this.patologiasFiltradas = [...lista];
        this.cargandoPatologias = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error al cargar patologías:', err);
        this.cargandoPatologias = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Criterio 2: Búsqueda por nombre de patología en tiempo real
   */
  filtrarPatologias(): void {
    this.patologiasFiltradas = this.patologiaService.filtrarPatologiasLocales(
      this.patologias,
      this.busquedaPatologia
    );
  }

  /**
   * Limpia el input de búsqueda y restaura la lista de patologías
   */
  limpiarBusquedaPatologia(): void {
    this.busquedaPatologia = '';
    this.filtrarPatologias();
  }

  /**
   * Criterio 1: Al seleccionar una patología, actualiza el estado y renderiza su descripción
   */
  onSeleccionarPatologia(id: number | null): void {
    this.idPatologiaSeleccionada = id;
    if (!id) {
      this.patologiaSeleccionada = null;
      return;
    }

    const encontrada = this.patologias.find(p => p.id_patologia === id);
    this.patologiaSeleccionada = encontrada || null;

    if (this.patologiaSeleccionada) {
      // Sugerir el nombre de la patología en el diagnóstico final si está vacío
      if (!this.diagnosticoFinal || this.diagnosticoFinal.trim() === '') {
        this.diagnosticoFinal = this.patologiaSeleccionada.nombre;
      }
    }
  }

  alternarNuevosCasos(): void {
    this.mostrarNuevosCasos = !this.mostrarNuevosCasos;
  }

  cambiarPestana(pestana: 'consulta' | 'examenes' | 'diagnostico' | 'tratamientos'): void {
    this.pestanaActiva = pestana;
    if (pestana === 'examenes' && this.examenesClinicos.length === 0) {
      this.cargarExamenesClinicos();
    }
  }

  /**
   * Normaliza URLs relativas provenientes de Django (/media/...) hacia la API de producción
   */
  normalizarUrlFoto(url: any): string {
    if (!url || typeof url !== 'string' || !url.trim()) return '';
    const u = url.trim();
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

  /**
   * Resuelve la foto específica de cada animal analizando todas las fuentes de datos posibles
   */
  obtenerFotoPaciente(paciente: any): string {
    if (!paciente) {
      return '';
    }

    const candidata =
      paciente.foto ||
      (Array.isArray(paciente.fotos) && paciente.fotos.length > 0 ? paciente.fotos[0] : null) ||
      (Array.isArray(paciente.multimedia) && paciente.multimedia.length > 0 ? paciente.multimedia[0]?.url : null) ||
      paciente.imagen ||
      paciente.foto_paciente ||
      paciente.imagen_paciente ||
      paciente.foto_url ||
      paciente.fotoUrl ||
      paciente.animales?.[0]?.foto ||
      paciente.animales?.[0]?.imagen ||
      paciente.animales?.[0]?.foto_url ||
      paciente.animal?.foto ||
      paciente.animal?.fotoUrl ||
      paciente.animal?.foto_url ||
      (Array.isArray(paciente.evidencias) && paciente.evidencias.length > 0 ? paciente.evidencias[0]?.ruta_archivo : null) ||
      null;

    if (!candidata) return '';
    return this.normalizarUrlFoto(candidata);
  }

  /**
   * Genera un color único y consistente para cada animal cuando no dispone de foto
   */
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
      item?.nombre_paciente ||
      item?.nombre_animal ||
      item?.nombre ||
      item?.id_animal ||
      item?.id ||
      'P'
    );
    let hash = 0;
    for (let i = 0; i < clave.length; i++) {
      hash = clave.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % paleta.length;
    return paleta[index];
  }

  /**
   * Genera las iniciales del nombre del animal para su avatar único
   */
  obtenerIniciales(item: any): string {
    const nombre = (item?.nombre_paciente || item?.nombre_animal || item?.nombre || 'P').trim();
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

  cargarSeguimientos(): void {
    this.cargando = true;
    this.error = '';

    // Precargar historias clínicas existentes para determinar qué animales ya tienen historia finalizada
    this.precargarHistoriasClinicasExistentes();

    this.authService.listarSeguimientos().subscribe({
      next: (respuesta: any) => {
        if (Array.isArray(respuesta)) {
          this.seguimientos = respuesta;
        } else if (Array.isArray(respuesta?.results)) {
          this.seguimientos = respuesta.results;
        } else if (Array.isArray(respuesta?.data)) {
          this.seguimientos = respuesta.data;
        } else {
          this.seguimientos = [];
        }

        this.aplicarFiltros();
        this.cargando = false;
        this.cdr.detectChanges();
        console.log('Seguimientos cargados:', this.seguimientos);
      },
      error: (error: any) => {
        console.error('Error cargando seguimientos:', error);
        this.error = 'No se pudieron cargar los seguimientos.';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Consulta las historias clínicas existentes para registrar los IDs de animales con historia finalizada
   */
  private precargarHistoriasClinicasExistentes(): void {
    const token = localStorage.getItem('token');
    const headers = token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();

    this.http.get<any>(this.apiHistoriasUrl, { headers }).subscribe({
      next: (resp) => {
        const lista = Array.isArray(resp) ? resp : (resp?.results || resp?.data || []);
        lista.forEach((h: any) => {
          const id = Number(h?.id_animal ?? h?.animal?.id_animal ?? h?.animal?.id);
          if (id && !isNaN(id)) {
            this.animalesConHistoriaIds.add(id);
          }
        });
        this.aplicarFiltros();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn('No se pudieron precargar las historias clínicas existentes:', err);
      }
    });
  }

  /**
   * Determina si un animal ya tiene su historia clínica finalizada / completada ('listo' o completado)
   */
  esAnimalAtendido(item: any): boolean {
    if (!item) return false;

    // 1. Verificación directa por ID del animal en historias clínicas guardadas
    const idAnimal = this.resolverIdAnimal(item);
    if (idAnimal && this.animalesConHistoriaIds.has(Number(idAnimal))) {
      return true;
    }

    // 2. Flags booleanas explícitas de estado
    if (
      item.atendido === true ||
      item.completado === true ||
      item.listo === true ||
      item.tiene_historia === true ||
      item.finalizado === true
    ) {
      return true;
    }
    if (item.atendido === false || item.completado === false) {
      return false;
    }

    // 3. IDs de expediente clínico o consulta vinculados
    if (item.id_historia || item.id_consulta || item.historia || item.historia_clinica) {
      return true;
    }

    // 4. Verificación por estados textuales de petición o atención
    const estadosToCheck = [
      item.peticion_estado,
      item.estado,
      item.estado_atencion,
      item.estado_peticion,
      item.status,
      item.estado_clinico
    ];

    for (const estado of estadosToCheck) {
      if (estado && typeof estado === 'string') {
        const e = estado.trim().toLowerCase();
        if (
          e.includes('atendid') ||
          e.includes('completad') ||
          e.includes('listo') ||
          e.includes('lista') ||
          e.includes('finaliz') ||
          e.includes('resuelt') ||
          e.includes('alta')
        ) {
          return true;
        }
      }
    }

    return false;
  }

  filtrarPorEspecie(especie: string): void {
    this.filtroEspecie = especie;
    this.aplicarFiltros();
  }

  buscarSeguimientos(): void {
    this.aplicarFiltros();
  }

  cambiarFiltroEstadoAtencion(estado: 'pendientes' | 'atendidos'): void {
    this.filtroEstadoAtencion = estado;
    this.aplicarFiltros();
  }

  get totalPendientes(): number {
    return this.seguimientos.filter(s => !this.esAnimalAtendido(s)).length;
  }

  get totalAtendidos(): number {
    return this.seguimientos.filter(s => this.esAnimalAtendido(s)).length;
  }

  aplicarFiltros(): void {
    const texto = (this.textoBusqueda || '').trim().toLowerCase();

    this.seguimientosFiltrados = this.seguimientos.filter((seguimiento: any) => {
      // 1. Filtro por estado de atención (Pendientes vs Completados)
      const atendido = this.esAnimalAtendido(seguimiento);
      const coincideEstadoAtencion = this.filtroEstadoAtencion === 'atendidos' ? atendido : !atendido;

      if (!coincideEstadoAtencion) {
        return false;
      }

      // 2. Filtro por especie
      const especie = String(
        seguimiento?.paciente_especie ||
        seguimiento?.especie ||
        seguimiento?.animales?.[0]?.especie ||
        ''
      ).trim().toLowerCase();

      const coincideEspecie =
        this.filtroEspecie === 'Todos' ||
        !this.filtroEspecie ||
        especie === this.filtroEspecie.trim().toLowerCase();

      if (!coincideEspecie) {
        return false;
      }

      // 3. Filtro por texto de búsqueda
      if (!texto) {
        return true;
      }

      const campos = [
        seguimiento?.nombre_paciente,
        seguimiento?.nombre_animal,
        seguimiento?.nombre,
        seguimiento?.animales?.[0]?.nombre,
        seguimiento?.paciente_especie,
        seguimiento?.especie,
        seguimiento?.paciente_raza,
        seguimiento?.raza,
        seguimiento?.microchip,
        seguimiento?.numero_radicado
      ];

      return campos.some((campo: any) =>
        String(campo || '').toLowerCase().includes(texto)
      );
    });
  }

  seleccionarSeguimiento(seguimiento: any): void {
    // 1. Limpiar por completo el estado del paciente anterior antes de cargar el nuevo
    this.reiniciarFormularioClinico();

    // 2. Guardar el animal seleccionado
    this.seguimientoSeleccionado = seguimiento;

    // 3. TENEDOR / RESPONSABLE (precarga editable)
    this.tenedor = {
      nombres: String(
        seguimiento?.propietario_nombre ??
        seguimiento?.notificador_nombre ??
        seguimiento?.nombre_acudiente ??
        seguimiento?.nombre_tutor ??
        seguimiento?.tenedor?.nombres ??
        ''
      ),
      documentoIdentidad: String(
        seguimiento?.propietario_cedula ??
        seguimiento?.notificador_identificacion ??
        seguimiento?.cedula_acudiente ??
        seguimiento?.documento_identidad ??
        seguimiento?.tenedor?.documentoIdentidad ??
        ''
      ),
      telefono: String(
        seguimiento?.propietario_telefono ??
        seguimiento?.notificador_telefono ??
        seguimiento?.tenedor?.telefono ??
        ''
      ),
      correoElectronico: String(
        seguimiento?.propietario_email ??
        seguimiento?.notificador_correo ??
        seguimiento?.tenedor?.correoElectronico ??
        ''
      ),
      direccion: String(
        seguimiento?.propietario_direccion ??
        seguimiento?.notificador_direccion ??
        seguimiento?.tenedor?.direccion ??
        ''
      )
    };

    // 4. PESO Y NÚMERO DE RADICADO
    this.pesoPaciente = seguimiento?.peso_paciente ?? null;
    this.numeroRadicadoActual = String(
      seguimiento?.numero_radicado ??
      seguimiento?.radicado ??
      seguimiento?.codigo_radicado ??
      seguimiento?.numeroRadicado ??
      seguimiento?.numero ??
      seguimiento?.codigo ??
      ''
    );

    // 5. DATOS DEL VETERINARIO
    const veterinario =
      seguimiento?.veterinario ??
      seguimiento?.usuario_veterinario ??
      seguimiento?.profesional ??
      seguimiento?.asignacion?.veterinario ??
      seguimiento?.peticion?.veterinario ??
      null;

    const nombreAnidado = veterinario
      ? [
        veterinario.nombre_completo,
        veterinario.nombre,
        veterinario.nombres,
        veterinario.first_name,
        veterinario.apellido,
        veterinario.apellidos,
        veterinario.last_name
      ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
      : '';

    this.nombreVeterinario = String(
      seguimiento?.nombre_veterinario ??
      seguimiento?.nombre_completo_veterinario ??
      seguimiento?.veterinario_nombre ??
      seguimiento?.profesional_nombre ??
      seguimiento?.nombre_profesional ??
      seguimiento?.medico_veterinario ??
      veterinario?.nombre_completo ??
      nombreAnidado ??
      ''
    );

    // 6. Extraer y mapear toda la información diligenciada desde la app móvil en el seguimiento
    this.extraerYMapeoDesdeSeguimientoMovil(seguimiento);

    const nombrePaciente = this.obtenerNombrePaciente(seguimiento);
    const idAnimalInicial = this.resolverIdAnimal(seguimiento);

    // 7. Hacer GET del detalle completo del seguimiento (/api/peticiones/seguimiento/{id}/)
    // para traer pruebas_complementarias, resultado_pruebas, id_animal y funcionarios_detalle
    if (seguimiento?.id_seguimiento) {
      this.authService.obtenerSeguimientoPorId(Number(seguimiento.id_seguimiento)).subscribe({
        next: (detalle: any) => {
          if (!detalle || this.seguimientoSeleccionado?.id_seguimiento !== seguimiento.id_seguimiento) {
            return;
          }
          this.seguimientoSeleccionado = { ...this.seguimientoSeleccionado, ...detalle };
          this.extraerYMapeoDesdeSeguimientoMovil(this.seguimientoSeleccionado);

          const idAnimalDetalle = this.resolverIdAnimal(this.seguimientoSeleccionado);
          if (idAnimalDetalle && !idAnimalInicial) {
            this.asegurarHistoriaClinica(idAnimalDetalle);
          }
          this.cdr.detectChanges();
        },
        error: () => {}
      });
    }

    // 8. Ejecutar el GET de Historia Clínica y Consulta (con Diagnósticos y Tratamientos asociados)
    if (idAnimalInicial) {
      this.asegurarHistoriaClinica(idAnimalInicial);
    } else {
      this.cargarDatosConsulta(
        seguimiento?.id_consulta || seguimiento?.id_historia || '',
        '',
        nombrePaciente
      );
    }

    this.cdr.detectChanges();

    // Desplazamiento automático suave hacia la información del paciente (UX)
    setTimeout(() => {
      const seccionFicha = document.getElementById('seccion-ficha-paciente');
      if (seccionFicha) {
        seccionFicha.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  }

  /**
   * Cierra la historia clínica del paciente actual y vuelve a mostrar
   * la cuadrícula de tarjetas de pacientes en espera
   */
  deseleccionarPaciente(): void {
    this.reiniciarFormularioClinico();
    this.seguimientoSeleccionado = null;
    this.numeroRadicadoActual = '';
    this.nombreVeterinario = '';
    this.cdr.detectChanges();

    // Scroll suave al inicio de la lista de turnos
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  }

  // Catálogo de medicamentos
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
      catalogo: this.authService.getMedicamentosCatalogo().pipe(
        map((respuesta: any) => {
          if (Array.isArray(respuesta)) return respuesta;
          if (Array.isArray(respuesta?.results)) return respuesta.results;
          if (Array.isArray(respuesta?.data)) return respuesta.data;
          return [];
        }),
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
      error: (error: any) => {
        console.error('Error al cargar el catálogo de medicamentos y stock:', error);
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

        // Actualizar también los no administrados en la lista seleccionada
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

  tarjetaProfesional: string = '';

  agregarMedicamento(medicamento: any): void {
    const nombre = String(
      medicamento?.nombre ||
      medicamento?.nombre_medicamento ||
      medicamento?.medicamento ||
      medicamento?.nombre_producto ||
      ''
    );

    const id = medicamento?.id_medicamento ??
      medicamento?.id ??
      medicamento?.id_medicamento_catalogo ??
      null;

    const yaExiste = this.medicamentosSeleccionados.some((item: any) =>
      (id !== null && item.id === id) ||
      (id === null && item.nombre === nombre)
    );

    if (yaExiste) {
      Swal.fire({
        icon: 'info',
        title: 'Medicamento ya agregado',
        text: 'Este medicamento ya está en la historia clínica.',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    const nombreKey = String(nombre).trim().toLowerCase();
    const stock = medicamento?.stockDisponible !== undefined
      ? medicamento.stockDisponible
      : ((id !== null && this.mapaStockPorId.has(Number(id)))
        ? (this.mapaStockPorId.get(Number(id)) ?? 0)
        : (this.mapaStockPorNombre.get(nombreKey) ?? 0));

    // REGLA OBLIGATORIA: Agregar a tratamientos NO descuenta stock.
    // Solo vincula el medicamento y deja listo el formulario de administración.
    this.medicamentosSeleccionados.push({
      id,
      nombre: nombre || 'Medicamento sin nombre',
      principio_activo: medicamento?.principio_activo || '',
      concentracion: medicamento?.concentracion || '',
      presentacion: medicamento?.presentacion || '',
      dosis: '',
      via: '',
      frecuencia: '',
      duracion_dias: null,
      descripcion: '',
      responsable_admin: '',
      reaccion_comentarios: '',
      stockDisponible: stock,
      cantidadAAdministrar: 1,
      administrado: false,
      cantidadEfectivaAdministrada: 0,
      administrando: false
    });

    Swal.fire({
      icon: 'success',
      title: 'Medicamento agregado a prescripción',
      text: `${nombre || 'El medicamento'} se agregó a la lista. Para descontarlo de inventario, confirma su administración real en la tarjeta.`,
      timer: 1800,
      showConfirmButton: false
    });
  }

  registrarAdministracion(med: any, indice: number): void {
    if (med.administrado) {
      Swal.fire({
        icon: 'info',
        title: 'Ya administrado',
        text: `Este medicamento ya fue administrado (${med.cantidadEfectivaAdministrada} uds) y descontado de inventario.`,
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    const cantidad = Number(med.cantidadAAdministrar);
    if (isNaN(cantidad) || cantidad <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Cantidad inválida',
        text: 'Ingresa una cantidad numérica mayor a 0 para registrar la administración.',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    const stockActual = Number(med.stockDisponible) || 0;
    if (stockActual <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Sin existencias en inventario',
        text: `No hay unidades disponibles en inventario para el medicamento "${med.nombre}".`,
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    if (cantidad > stockActual) {
      Swal.fire({
        icon: 'error',
        title: 'Stock insuficiente en inventario de campo',
        text: `No cuentas con suficiente stock en tu inventario de campo (Disponibles: ${stockActual}, Solicitados: ${cantidad}). Por favor, ajusta la cantidad o utiliza una alternativa de medicamento disponible.`,
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    const nombreMed = med.nombre || 'el medicamento';

    Swal.fire({
      title: '¿Confirmar administración y descuento?',
      html: `Se registrará la administración física de <b>${cantidad} uds</b> de <b>${nombreMed}</b> al paciente.<br><br><span class="text-xs text-slate-500">Esta acción descontará las unidades directamente de los lotes activos en el inventario de la clínica.</span>`,
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
          this.cdr.detectChanges();

          Swal.fire({
            icon: 'success',
            title: '¡Administración registrada con éxito!',
            html: `Se descontaron <b>${cantidad} uds</b> de inventario.<br>Stock restante en CBA: <b>${resp.restante} uds</b>.`,
            confirmButtonColor: '#4141A5'
          });
        },
        error: (err) => {
          med.administrando = false;
          this.cdr.detectChanges();
          console.error('Error al descontar stock:', err);
          const msg = err?.message || 'No fue posible registrar la administración en inventario.';
          Swal.fire({
            icon: 'error',
            title: 'Error al descontar inventario',
            text: msg,
            confirmButtonColor: '#4141A5'
          });
        }
      });
    });
  }

  eliminarMedicamento(indice: number): void {
    const med = this.medicamentosSeleccionados[indice];
    if (med && med.administrado) {
      Swal.fire({
        icon: 'warning',
        title: '¿Quitar de la lista?',
        html: `Atención: Ya se registró la administración y se descontaron <b>${med.cantidadEfectivaAdministrada} uds</b> de <b>${med.nombre}</b> en el inventario físico.<br><br>¿Deseas quitar este tratamiento del formulario?`,
        showCancelButton: true,
        confirmButtonText: 'Sí, quitar',
        cancelButtonText: 'Conservar',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#4141A5'
      }).then((res) => {
        if (res.isConfirmed) {
          this.medicamentosSeleccionados.splice(indice, 1);
          this.cdr.detectChanges();
        }
      });
      return;
    }
    this.medicamentosSeleccionados.splice(indice, 1);
  }

  // --- Módulo Inventario Veterinario: Alertas Stock Bajo (<= 10 uds) y Alternativas ---

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
          <p class="text-xs text-slate-500">Producto en maletín: <b>${nombre}</b></p>
        </div>
      `,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#4141A5'
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
    this.medicamentosSeleccionados[indice] = {
      id: nuevoMed.id_medicamento ?? nuevoMed.id,
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
  // EVALUACIÓN FÍSICA DE ÓRGANOS Y SISTEMAS (N, AN, NE)
  // =========================================================================

  crearSistemasPorDefecto(): { [key: string]: string } {
    return {
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
  }

  reiniciarSistemas(valor: string = 'NE'): void {
    this.sistemas = {
      general: valor,
      hidratacion: valor,
      tegumentario: valor,
      ojos: valor,
      oidos: valor,
      nariz: valor,
      digestivo: valor,
      respiratorio: valor,
      nervioso: valor,
      musculoesqueletico: valor,
      cardiovascular: valor,
      genitourinario: valor
    };
    this.observacionesSistemas = '';
    try {
      localStorage.removeItem('vetericano_sistemas');
    } catch (e) { }
    this.cdr.detectChanges();
  }

  marcarTodosNormal(): void {
    this.reiniciarSistemas('N');
    Swal.fire({
      icon: 'success',
      title: 'Sistemas actualizados',
      text: 'Todos los órganos y sistemas se marcaron como Normales (N).',
      timer: 1200,
      showConfirmButton: false
    });
  }

  marcarTodosNoExaminado(): void {
    this.reiniciarSistemas('NE');
    Swal.fire({
      icon: 'info',
      title: 'Evaluación restablecida',
      text: 'Todos los órganos y sistemas volvieron a su estado inicial (NE).',
      timer: 1200,
      showConfirmButton: false
    });
  }

  // Evaluación física: guardar y recuperar en este navegador
  guardarSistemas(): void {
    try {
      localStorage.setItem('vetericano_sistemas', JSON.stringify(this.sistemas));
      Swal.fire({
        icon: 'success',
        title: '¡Cambios guardados!',
        text: 'La evaluación física se guardó correctamente.',
        confirmButtonColor: '#4141A5'
      });
    } catch (error) {
      console.error('Error al guardar la evaluación:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error al guardar',
        text: 'No fue posible guardar la evaluación.'
      });
    }
  }

  cargarSistemasGuardados(): void {
    try {
      const datosGuardados = localStorage.getItem('vetericano_sistemas');
      if (datosGuardados) {
        const sistemasGuardados = JSON.parse(datosGuardados);
        this.sistemas = { ...this.sistemas, ...sistemasGuardados };
      }
    } catch (error) {
      console.error('Error al recuperar la evaluación:', error);
    }
  }

  // =========================================================================
  // GESTIÓN DEL CATÁLOGO DE EXÁMENES CLÍNICOS (Criterios 1, 2, 3 y 4)
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

  /**
   * Criterio 1: Carga los exámenes clínicos adaptándose a la metadata de respuesta del backend
   */
  cargarExamenesClinicos(): void {
    this.cargandoExamenes = true;
    this.mensajeExamenes = '';

    this.examenesClinicosService.obtenerTodos().subscribe({
      next: (lista: ExamenClinico[]) => {
        this.examenesClinicos = lista;
        this.examenesFiltrados = [...lista];
        this.totalExamenes = lista.length;
        this.cargandoExamenes = false;
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error('Error al cargar exámenes clínicos:', error);
        this.mensajeExamenes = 'No se pudieron cargar los exámenes clínicos.';
        this.cargandoExamenes = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Criterio 2: Búsqueda por nombre en tiempo real
   */
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

  /**
   * Limpia la barra de búsqueda y restaura el listado de exámenes
   */
  limpiarBusquedaExamen(): void {
    this.busquedaExamen = '';
    this.filtrarExamenes();
  }

  /**
   * Paginación interactiva
   */
  cambiarPaginaExamenes(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginasExamenes) {
      this.paginaActualExamenes = pagina;
    }
  }

  /**
   * Agrega el examen seleccionado a la orden diagnóstica del paciente
   */
  solicitarExamenSeleccionado(): void {
    if (!this.examenSeleccionadoParaSolicitud) {
      return;
    }
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
        text: 'Este examen ya se encuentra en la lista de solicitados.',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    this.examenesSolicitados.push({
      ...examen,
      id_examen: idExamen,
      nombre: nombreExamen,
      estado: examen?.estado || 'solicitado',
      resultado: examen?.resultado || '',
      ruta_archivo_resultado: examen?.ruta_archivo_resultado || ''
    });

    Swal.fire({
      icon: 'success',
      title: 'Examen agregado',
      text: `${nombreExamen} se agregó a los exámenes solicitados.`,
      timer: 1400,
      showConfirmButton: false
    });
  }
  eliminarExamen(indice: number): void {
    const examen = this.examenesSolicitados[indice];
    if (!examen) {
      return;
    }

    Swal.fire({
      icon: 'warning',
      title: '¿Deseas eliminar este examen?',
      text: `Se quitará "${examen.nombre}" de los exámenes solicitados.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#4141A5',
      reverseButtons: true
    }).then((resultado) => {
      if (resultado.isConfirmed) {
        this.examenesSolicitados.splice(indice, 1);
        Swal.fire({
          icon: 'success',
          title: 'Examen eliminado',
          text: 'El examen se quitó de la lista.',
          timer: 1300,
          showConfirmButton: false
        });
      }
    });
  }

}