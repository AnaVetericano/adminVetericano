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

  // Control de pasos del Stepper (Paso 1: Consulta, Paso 2: Exámenes, Paso 3: Diagnóstico, Paso 4: Tratamientos)
  // Se inicia en 'examenes' para retomar directamente desde el Paso 2 en adelante según requerimiento
  pestanaActiva: 'consulta' | 'examenes' | 'diagnostico' | 'tratamientos' = 'examenes';

  // =========================================================================
  // PASO 2: EXÁMENES CLÍNICOS Y SISTEMAS ORGÁNICOS
  // =========================================================================
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
  observacionesSistemas: string = '';

  // =========================================================================
  // PASO 3: DIAGNÓSTICO, PATOLOGÍA Y PLAN
  // =========================================================================
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
  mapaStockPorId: Map<number, number> = new Map();
  mapaStockPorNombre: Map<string, number> = new Map();
  materialesUtilizados: string = '';

  // Destino CBA
  ingresaCBA: string = 'NO';
  motivoIngresoNoIngreso: string = '';
  canilAsignado: string = '';
  funcionarioRecibeCBA: string = '';

  // Firmas y aval institucional
  nombreVeterinario: string = '';
  tarjetaProfesional: string = '';
  nombreAcudiente: string = '';
  cedulaAcudiente: string = '';

  // =========================================================================
  // FORMULARIO REACTIVO Y ESTADOS GLOBALES
  // =========================================================================
  formHistoria!: FormGroup;
  historiaOriginal: HistoriaClinicaEdicion | null = null;
  paciente: PacienteHistoria | null = null;
  historialModificaciones: RegistroAuditoria[] = [];

  cargando: boolean = true;
  guardando: boolean = false;
  formularioEnviado: boolean = false;
  historiaAnulada: boolean = false;
  mensajeExito: string = '';
  mensajeError: string = '';

  mostrarModalCancelar: boolean = false;
  mostrarDetalleAuditoria: boolean = true;

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

    this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      const idQuery = this.route.snapshot.queryParamMap.get('id');
      const idHistoriaQuery = this.route.snapshot.queryParamMap.get('id_historia');
      const idAnimalQuery = this.route.snapshot.queryParamMap.get('id_animal');
      const nombreQuery = this.route.snapshot.queryParamMap.get('nombre') || '';
      const fotoQuery = this.route.snapshot.queryParamMap.get('foto') || '';

      this.idHistoria = idParam || idHistoriaQuery || idQuery || '';

      this.cargarHistoria(nombreQuery, fotoQuery, idAnimalQuery);
    });
  }

  /**
   * Navegación fluida entre pestañas (stepper) sin perder información digitada
   */
  cambiarPestana(pestana: 'consulta' | 'examenes' | 'diagnostico' | 'tratamientos'): void {
    this.pestanaActiva = pestana;

    if (pestana === 'examenes' && this.examenesClinicos.length === 0) {
      this.cargarExamenesClinicos();
    }
    if (pestana === 'tratamientos' && this.medicamentosCatalogo.length === 0) {
      this.cargarMedicamentos();
    }

    this.cdr.detectChanges();
  }

  /**
   * Normaliza URLs relativas de Django hacia la API de producción
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
      diagnosticoPrincipal: ['', [Validators.required, Validators.minLength(5)]],
      diagnosticoDiferencial: [''],
      listaProblemas: [''],
      evolucion: ['', [Validators.required, Validators.minLength(10)]],
      pronostico: ['Favorable', [Validators.required]],
      prioridad: ['Normal'],
      resultadoEstado: ['Estable'],
      pulso: [''],
      tiempoLlenadoCapilar: [''],
      mucosas: [''],
      gangliosLinfaticos: [''],
      actitudTemperamento: [''],
      observacionesExamen: [''],
      planTratamiento: ['', [Validators.required, Validators.minLength(5)]],
      temperatura: [null, [Validators.min(32), Validators.max(43)]],
      frecuenciaCardiaca: [null, [Validators.min(20), Validators.max(280)]],
      frecuenciaRespiratoria: [null, [Validators.min(8), Validators.max(160)]],
      peso: [null, [Validators.min(0.2), Validators.max(120)]],
      motivoModificacion: ['', [Validators.required, Validators.minLength(5)]]
    });
  }

  /**
   * Carga los datos previos de la historia clínica en el formulario y en los modelos de cada paso
   */
  cargarHistoria(nombrePaciente?: string, fotoPaciente?: string, idAnimalParam?: string | number | null): void {
    this.cargando = true;
    this.mensajeError = '';

    const nombre = nombrePaciente || this.route.snapshot.queryParamMap.get('nombre') || '';
    const foto = fotoPaciente || this.route.snapshot.queryParamMap.get('foto') || '';
    const idAnimal = idAnimalParam || this.route.snapshot.queryParamMap.get('id_animal') || '';

    this.historiaService.obtenerHistoria(this.idHistoria, nombre, idAnimal).subscribe({
      next: (data: HistoriaClinicaEdicion) => {
        this.historiaOriginal = data;
        this.paciente = data.paciente;
        this.historialModificaciones = data.historial_modificaciones || [];

        if (this.paciente && (!this.paciente.nombre || this.paciente.nombre === 'Paciente') && nombre) {
          this.paciente.nombre = nombre;
        }

        if (this.paciente) {
          if (foto && foto.trim() !== '') {
            this.paciente.foto_url = this.normalizarUrlFoto(foto);
          } else if (data.paciente?.foto_url && data.paciente.foto_url.trim() !== '') {
            this.paciente.foto_url = this.normalizarUrlFoto(data.paciente.foto_url);
          } else {
            this.paciente.foto_url = '';
          }
        }

        // 1. Población del formulario reactivo principal (Diagnóstico, Evolución, Constantes)
        this.formHistoria.patchValue({
          diagnosticoPrincipal: data.diagnostico_principal || '',
          diagnosticoDiferencial: data.diagnostico_diferencial || (data as any).descripcion_hallazgos || (data as any).hallazgos_examen || '',
          listaProblemas: data.lista_problemas || '',
          evolucion: data.evolucion || '',
          pronostico: data.pronostico || 'Favorable',
          prioridad: data.prioridad || 'Normal',
          resultadoEstado: data.resultado_estado || 'Estable',
          pulso: data.constantes?.pulso || data.pulso || '',
          tiempoLlenadoCapilar: data.constantes?.tllc || data.tllc || '',
          mucosas: data.constantes?.mucosas || data.mucosas || '',
          gangliosLinfaticos: data.constantes?.ganglios_linfaticos || data.ganglios_linfaticos || '',
          actitudTemperamento: data.constantes?.actitud_temperamento || data.actitud_temperamento || '',
          observacionesExamen: data.observaciones_examen || '',
          planTratamiento: data.plan_tratamiento || '',
          temperatura: data.constantes?.temperatura ?? null,
          frecuenciaCardiaca: data.constantes?.frecuencia_cardiaca ?? null,
          frecuenciaRespiratoria: data.constantes?.frecuencia_respiratoria ?? null,
          peso: data.paciente?.peso ?? null,
          motivoModificacion: ''
        });

        // 2. Población Paso 2: Exámenes y 12 Sistemas Orgánicos
        if (data.organos_sistemas && typeof data.organos_sistemas === 'object') {
          this.sistemas = { ...this.sistemas, ...data.organos_sistemas };
        }
        this.observacionesSistemas = data.observaciones_sistemas || data.organos_sistemas?.['observaciones'] || '';
        this.descripcionHallazgos = (data as any).descripcion_hallazgos || (data as any).hallazgos_examen || data.diagnostico_diferencial || '';
        this.examenesSolicitados = Array.isArray(data.examenes_solicitados)
          ? data.examenes_solicitados.map((ex: any) => ({
              id_examen: ex.id_examen || ex.id,
              nombre: ex.nombre || ex.nombre_examen || 'Examen Clínico',
              tipo: ex.tipo || 'General',
              descripcion: ex.descripcion || '',
              estado: ex.estado || 'solicitado',
              resultado: ex.resultado || '',
              ruta_archivo_resultado: ex.ruta_archivo_resultado || ''
            }))
          : [];

        // 3. Población Paso 3: Diagnóstico y Lista de Problemas
        this.planProcedimientos = data.plan_tratamiento || '';
        if (data.lista_problemas) {
          const lineas = data.lista_problemas
            .split(/[\n;]/)
            .map(l => l.replace(/^\d+[\.\-]\s*/, '').trim())
            .filter(Boolean);
          lineas.slice(0, 7).forEach((p, idx) => {
            this.problemasClinicos[idx] = p;
          });
        }

        // 4. Población Paso 4: Tratamientos, Insumos, CBA y Firmas
        if (Array.isArray(data.tratamientos) && data.tratamientos.length > 0) {
          this.medicamentosSeleccionados = data.tratamientos.map((t: any) => ({
            id: t.id_medicamento || t.id,
            nombre: t.nombre || t.productoBase || t.producto_base || t.nombre_medicamento || 'Medicamento',
            principio_activo: t.principio_activo || '',
            concentracion: t.concentracion || '',
            presentacion: t.presentacion || '',
            dosis: t.dosis || t.dosisBasica || t.dosis_basica || '',
            via: t.via || t.via_administracion || '',
            frecuencia: t.frecuencia || t.frecuenciaDuracion || t.frecuencia_duracion || '',
            descripcion: t.descripcion || t.posologia || '',
            responsable_admin: t.responsable_admin || '',
            reaccion_comentarios: t.reaccion_comentarios || '',
            stockDisponible: t.stockDisponible ?? 10,
            cantidadAAdministrar: t.cantidadAAdministrar ?? 1,
            administrado: !!t.administrado || !!t.suministrado_clinica,
            cantidadEfectivaAdministrada: t.cantidad_administrada || t.cantidadEfectivaAdministrada || 0,
            administrando: false
          }));
        }

        this.materialesUtilizados = data.materiales_utilizados || '';
        this.ingresaCBA = String(data.ingresa_cba || 'NO').toUpperCase() === 'SI' || (data.ingresa_cba as any) === true ? 'SI' : 'NO';
        this.motivoIngresoNoIngreso = data.motivo_ingreso_no_ingreso || (data as any).motivo_ingreso_cba || '';
        this.canilAsignado = data.canil_asignado || '';
        this.funcionarioRecibeCBA = data.funcionario_recibe_cba || '';

        const sesionActual = this.authService.currentUser();
        this.nombreVeterinario = data.nombre_veterinario || (sesionActual ? `${sesionActual.nombre} ${sesionActual.apellido}`.trim() : 'Médico Veterinario Oficial CBA');
        this.tarjetaProfesional = data.tarjeta_profesional || sesionActual?.tarjeta_profesional || 'COMVEZCOL-CBA-001';
        this.nombreAcudiente = data.nombre_acudiente || data.paciente?.tenedor_nombre || '';
        this.cedulaAcudiente = data.cedula_acudiente || data.paciente?.tenedor_documento || '';

        // Bloqueo estricto si está anulada (Jira HE06-HU013 Escenario 3.0)
        const estadoGen = String(data.estado_general || '').trim().toLowerCase();
        if (estadoGen === 'anulado') {
          this.historiaAnulada = true;
          this.formHistoria.disable();
          Swal.fire({
            title: 'Historia Anulada',
            text: 'Esta historia clínica se encuentra anulada en el sistema y no admite modificaciones (Jira HE06-HU013).',
            icon: 'warning',
            confirmButtonColor: '#4141a5',
            confirmButtonText: 'Entendido',
            customClass: {
              popup: 'rounded-2xl font-[\'Nunito\',sans-serif]',
              confirmButton: 'rounded-xl px-5 py-2.5 font-bold'
            }
          });
        } else {
          this.historiaAnulada = false;
          this.formHistoria.enable();
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
          this.medicamentosSeleccionados.splice(indice, 1);
          this.formHistoria.markAsDirty();
          this.cdr.detectChanges();
        }
      });
      return;
    }

    this.medicamentosSeleccionados.splice(indice, 1);
    this.formHistoria.markAsDirty();
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

    // Sincronizar campos de texto si se editaron fuera del ReactiveForm
    if (this.planProcedimientos && !this.formHistoria.get('planTratamiento')?.value) {
      this.formHistoria.patchValue({ planTratamiento: this.planProcedimientos });
    }

    if (this.formHistoria.invalid) {
      this.formHistoria.markAllAsTouched();
      this.mensajeError = 'Por favor complete todos los campos obligatorios resaltados en rojo (diagnóstico, evolución, tratamiento, pronóstico y justificación).';

      Swal.fire({
        title: 'Formulario Incompleto',
        text: 'Debe ingresar la información requerida (diagnóstico principal, evolución, plan de tratamiento, pronóstico y justificación del cambio) antes de guardar.',
        icon: 'warning',
        confirmButtonColor: '#4141a5',
        confirmButtonText: 'Revisar campos',
        customClass: {
          popup: 'rounded-2xl font-[\'Nunito\',sans-serif]',
          confirmButton: 'rounded-xl px-5 py-2.5 font-bold'
        }
      });
      return;
    }

    this.guardando = true;
    const formVal = this.formHistoria.value;

    // Procesar lista de problemas formateada
    const problemasDesdeArray = this.problemasClinicos.filter(p => p && p.trim().length > 0);
    const listaProblemasFinal = problemasDesdeArray.length > 0
      ? problemasDesdeArray.map((p, i) => `${i + 1}. ${p.trim()}`).join('\n')
      : (formVal.listaProblemas || '');

    const dto: ActualizarHistoriaDto = {
      diagnostico_principal: formVal.diagnosticoPrincipal,
      diagnostico_diferencial: formVal.diagnosticoDiferencial || this.descripcionHallazgos,
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
        observaciones: this.observacionesSistemas
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
        reaccion_comentarios: m.reaccion_comentarios || ''
      })),
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
      }
    };

    this.historiaService.actualizarHistoria(this.idHistoria, dto, this.historiaOriginal!).subscribe({
      next: (resp) => {
        this.guardando = false;
        this.formularioEnviado = false;
        this.mensajeExito = resp.mensaje || 'Historia clínica actualizada con éxito.';

        if (resp.auditoria) {
          this.historialModificaciones = [resp.auditoria, ...this.historialModificaciones];
        }

        if (this.historiaOriginal) {
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

        Swal.fire({
          title: '¡Actualización Exitosa!',
          text: 'Se han guardado todos los cambios en exámenes, sistemas, diagnósticos, evolución, tratamientos y firmas. La modificación quedó registrada en auditoría.',
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