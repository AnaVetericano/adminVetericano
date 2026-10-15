import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';

import {
  HistoriaClinicaService,
  HistoriaClinicaEdicion,
  RegistroAuditoria,
  ActualizarHistoriaDto,
  PacienteHistoria
} from '../services/historia-clinica.service';
import { PatologiaService, Patologia } from '../services/patologia.service';
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

  // Catálogo de Patologías (Criterios 1, 2 y 3)
  patologias: Patologia[] = [];
  patologiasFiltradas: Patologia[] = [];
  cargandoPatologias: boolean = false;
  busquedaPatologia: string = '';
  idPatologiaSeleccionada: number | null = null;
  patologiaSeleccionada: Patologia | null = null;

  // Formulario reactivo
  formHistoria!: FormGroup;

  // Estados de datos del paciente y auditoría
  historiaOriginal: HistoriaClinicaEdicion | null = null;
  paciente: PacienteHistoria | null = null;
  historialModificaciones: RegistroAuditoria[] = [];

  // Estados de carga e interfaz
  cargando: boolean = true;
  guardando: boolean = false;
  formularioEnviado: boolean = false;
  mensajeExito: string = '';
  mensajeError: string = '';

  // Control del modal de confirmación de cancelación
  mostrarModalCancelar: boolean = false;
  
  // Pestaña o acordeón visual para auditoría
  mostrarDetalleAuditoria: boolean = true;

  // Logo institucional de Popayán
  popalog = {
    logopop: 'images/Escudo_Popayan.svg'
  };

  // Opciones de pronóstico clínico
  opcionesPronostico: string[] = ['Favorable', 'Reservado', 'Desfavorable', 'Crítico'];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private historiaService: HistoriaClinicaService,
    private patologiaService: PatologiaService,
    private cdr: ChangeDetectorRef
  ) {
    this.inicializarFormulario();
  }

  ngOnInit(): void {
    this.cargarPatologias();
    // Detecta el ID desde los parámetros de ruta (/historia-clinica/editar/:id) o queryParams (?id=...)
    this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      const idQuery = this.route.snapshot.queryParamMap.get('id');
      const nombreQuery = this.route.snapshot.queryParamMap.get('nombre') || '';
      const fotoQuery = this.route.snapshot.queryParamMap.get('foto') || '';

      if (idParam) {
        this.idHistoria = idParam;
      } else if (idQuery) {
        this.idHistoria = idQuery;
      }

      this.cargarHistoria(nombreQuery, fotoQuery);
    });
  }

  /**
   * Normaliza URLs relativas de Django (/media/...) hacia la API de producción
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

  /**
   * Genera las iniciales del nombre del animal para su avatar único
   */
  obtenerIniciales(item: any): string {
    const nombre = (item?.nombre || item?.nombre_paciente || 'P').trim();
    if (!nombre) return 'P';
    const partes = nombre.split(' ').filter(Boolean);
    if (partes.length >= 2) {
      return (partes[0].charAt(0) + partes[1].charAt(0)).toUpperCase();
    }
    return nombre.substring(0, 2).toUpperCase();
  }

  /**
   * Controlador de respaldo ante error de carga de imagen
   */
  imagenNoDisponible(event: Event): void {
    const imagen = event.target as HTMLImageElement;
    imagen.style.display = 'none';
  }

  /**
   * Inicializa el formulario reactivo con sus validaciones estrictas
   */
  private inicializarFormulario(): void {
    this.formHistoria = this.fb.group({
      // Diagnóstico Principal (Requerido: debe describir con claridad el cuadro clínico)
      diagnosticoPrincipal: ['', [Validators.required, Validators.minLength(5)]],

      // Diagnóstico diferencial (Opcional, pero recomendado en clínica)
      diagnosticoDiferencial: [''],

      // Lista de problemas clínicos detectados
      listaProblemas: [''],

      // Evolución del paciente (Requerido: objetivo principal de la historia de usuario)
      evolucion: ['', [Validators.required, Validators.minLength(10)]],

      // Pronóstico veterinario actual (Requerido)
      pronostico: ['Favorable', [Validators.required]],

      // Plan de tratamiento y procedimientos (Requerido)
      planTratamiento: ['', [Validators.required, Validators.minLength(5)]],

      // Constantes fisiológicas actualizadas durante la evolución
      temperatura: [null, [Validators.min(32), Validators.max(43)]],
      frecuenciaCardiaca: [null, [Validators.min(20), Validators.max(280)]],
      frecuenciaRespiratoria: [null, [Validators.min(8), Validators.max(160)]],
      peso: [null, [Validators.min(0.2), Validators.max(120)]],

      // Motivo de la modificación (Requerido por trazabilidad y auditoría de salud animal)
      motivoModificacion: ['', [Validators.required, Validators.minLength(5)]]
    });
  }

  /**
   * Criterio 1: Carga los datos previos de la historia clínica en el formulario
   */
  cargarHistoria(nombrePaciente?: string, fotoPaciente?: string): void {
    this.cargando = true;
    this.mensajeError = '';

    const nombre = nombrePaciente || this.route.snapshot.queryParamMap.get('nombre') || '';
    const foto = fotoPaciente || this.route.snapshot.queryParamMap.get('foto') || '';

    this.historiaService.obtenerHistoria(this.idHistoria, nombre).subscribe({
      next: (data: HistoriaClinicaEdicion) => {
        this.historiaOriginal = data;
        this.paciente = data.paciente;
        this.historialModificaciones = data.historial_modificaciones || [];

        // Si el paciente retornado no tiene nombre específico pero venía en queryParams, asignarlo
        if (this.paciente && (!this.paciente.nombre || this.paciente.nombre === 'Paciente') && nombre) {
          this.paciente.nombre = nombre;
        }

        // ASIGNACIÓN EXACTA DE LA FOTO DEL PACIENTE:
        // Prioridad 1: Si vino una foto específica desde la tarjeta seleccionada, esa es la foto exacta a mostrar
        if (this.paciente) {
          if (foto && foto.trim() !== '') {
            this.paciente.foto_url = this.normalizarUrlFoto(foto);
          } else if (data.paciente?.foto_url && data.paciente.foto_url.trim() !== '') {
            this.paciente.foto_url = this.normalizarUrlFoto(data.paciente.foto_url);
          } else {
            this.paciente.foto_url = '';
          }
        }

        // Poblamos el formulario reactivo con los datos previos
        this.formHistoria.patchValue({
          diagnosticoPrincipal: data.diagnostico_principal || '',
          diagnosticoDiferencial: data.diagnostico_diferencial || '',
          listaProblemas: data.lista_problemas || '',
          evolucion: data.evolucion || '',
          pronostico: data.pronostico || 'Favorable',
          planTratamiento: data.plan_tratamiento || '',
          temperatura: data.constantes?.temperatura ?? null,
          frecuenciaCardiaca: data.constantes?.frecuencia_cardiaca ?? null,
          frecuenciaRespiratoria: data.constantes?.frecuencia_respiratoria ?? null,
          peso: data.paciente?.peso ?? null,
          motivoModificacion: '' // Se inicia vacío para exigir la justificación de la nueva edición
        });

        // El formulario cargado debe estar en estado prístino (sin cambios aún)
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

  /**
   * Criterio 1 y 2: Guarda la edición si el formulario es válido
   */
  guardarEdicion(): void {
    this.formularioEnviado = true;
    this.mensajeError = '';
    this.mensajeExito = '';

    // Criterio 2: Validación ante intento de guardar con campos obligatorios vacíos
    if (this.formHistoria.invalid) {
      this.formHistoria.markAllAsTouched();
      this.mensajeError = 'Por favor complete todos los campos obligatorios resaltados en rojo.';

      Swal.fire({
        title: 'Formulario Incompleto',
        text: 'Debe ingresar la información requerida (diagnóstico, evolución, tratamiento, pronóstico y justificación del cambio) antes de guardar.',
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

    const dto: ActualizarHistoriaDto = {
      diagnostico_principal: formVal.diagnosticoPrincipal,
      diagnostico_diferencial: formVal.diagnosticoDiferencial,
      lista_problemas: formVal.listaProblemas,
      evolucion: formVal.evolucion,
      pronostico: formVal.pronostico,
      plan_tratamiento: formVal.planTratamiento,
      temperatura: formVal.temperatura ? Number(formVal.temperatura) : null,
      frecuencia_cardiaca: formVal.frecuenciaCardiaca ? Number(formVal.frecuenciaCardiaca) : null,
      frecuencia_respiratoria: formVal.frecuenciaRespiratoria ? Number(formVal.frecuenciaRespiratoria) : null,
      peso: formVal.peso ? Number(formVal.peso) : null,
      motivo_modificacion: formVal.motivoModificacion
    };

    // Llamado al servicio adaptado a la nueva estructura del backend (/api/clinica/expediente-completo/)
    this.historiaService.actualizarHistoria(this.idHistoria, dto, this.historiaOriginal!).subscribe({
      next: (resp) => {
        this.guardando = false;
        this.formularioEnviado = false;
        this.mensajeExito = resp.mensaje || 'Historia clínica actualizada con éxito.';

        // Criterio 3: Si la respuesta incluye el registro de auditoría, se añade de inmediato a la lista
        if (resp.auditoria) {
          this.historialModificaciones = [resp.auditoria, ...this.historialModificaciones];
        }

        // Actualizamos los datos del registro en la memoria del componente
        if (this.historiaOriginal) {
          this.historiaOriginal.diagnostico_principal = dto.diagnostico_principal;
          this.historiaOriginal.diagnostico_diferencial = dto.diagnostico_diferencial;
          this.historiaOriginal.lista_problemas = dto.lista_problemas;
          this.historiaOriginal.evolucion = dto.evolucion;
          this.historiaOriginal.pronostico = dto.pronostico;
          this.historiaOriginal.plan_tratamiento = dto.plan_tratamiento;
          if (dto.peso) {
            this.historiaOriginal.paciente.peso = dto.peso;
            if (this.paciente) this.paciente.peso = dto.peso;
          }
        }

        // Reseteamos el estado dirty del formulario pues los cambios ya están persistidos
        this.formHistoria.markAsPristine();
        this.formHistoria.get('motivoModificacion')?.reset('');

        // Notificación de éxito con SweetAlert2
        Swal.fire({
          title: '¡Actualización Exitosa!',
          text: 'La evolución médica y el diagnóstico han sido actualizados. La modificación quedó registrada en el historial de auditoría.',
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
      error: () => {
        this.guardando = false;
        this.mensajeError = 'Ocurrió un error al guardar las modificaciones. Intente nuevamente.';
        Swal.fire({
          title: 'Error de Guardado',
          text: 'No se pudo comunicar con el servidor para persistir los cambios.',
          icon: 'error',
          confirmButtonColor: '#4141a5'
        });
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Criterio 4: Lógica de cancelación.
   * Si hay cambios en el formulario (dirty) muestra el diálogo de confirmación.
   * Si no hay cambios, regresa inmediatamente al detalle o módulo clínico.
   */
  cancelarEdicion(): void {
    if (this.formHistoria.dirty) {
      // Abre el modal de confirmación con el diseño de la aplicación
      this.mostrarModalCancelar = true;
    } else {
      // Regresa directamente sin preguntar
      this.volverAlDetalle();
    }
  }

  /**
   * Criterio 4: Confirma descarte de cambios y regresa
   */
  confirmarDescarte(): void {
    this.mostrarModalCancelar = false;
    this.formHistoria.reset();
    this.formHistoria.markAsPristine();
    this.volverAlDetalle();
  }

  /**
   * Cierra el diálogo modal sin perder los cambios
   */
  cerrarModalCancelar(): void {
    this.mostrarModalCancelar = false;
  }

  /**
   * Navega de vuelta a la vista de historias clínicas o detalle
   */
  volverAlDetalle(): void {
    this.router.navigate(['/inicio-admin/acta-seres-sintientes']);
  }

  /**
   * Implementación de la interfaz ComponenteConCambiosPendientes (Guard)
   */
  tieneCambiosPendientes(): boolean {
    if (this.formHistoria.dirty) {
      this.mostrarModalCancelar = true;
      return false; // Detiene la navegación automática hasta que el usuario confirme
    }
    return true;
  }

  /**
   * Helpers para validación en la plantilla HTML
   */
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

  /**
   * Criterio 1: Carga el listado de patologías llamando al servicio al inicializar
   */
  cargarPatologias(): void {
    this.cargandoPatologias = true;
    this.patologiaService.obtenerPatologias().subscribe({
      next: (data: Patologia[]) => {
        this.patologias = data;
        this.patologiasFiltradas = [...data];
        this.cargandoPatologias = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error al cargar catálogo de patologías:', err);
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
   * Limpia el buscador y restaura el listado completo
   */
  limpiarBusquedaPatologia(): void {
    this.busquedaPatologia = '';
    this.filtrarPatologias();
  }

  /**
   * Criterio 1: Al seleccionar una patología, actualiza el estado, muestra la descripción y sugiere el diagnóstico
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
      this.formHistoria.patchValue({
        diagnosticoPrincipal: this.patologiaSeleccionada.nombre
      });
      this.formHistoria.get('diagnosticoPrincipal')?.markAsDirty();
    }
  }

  /**
   * Restaura el formulario a los valores originales de la historia
   */
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
        this.formHistoria.patchValue({
          diagnosticoPrincipal: this.historiaOriginal?.diagnostico_principal || '',
          diagnosticoDiferencial: this.historiaOriginal?.diagnostico_diferencial || '',
          listaProblemas: this.historiaOriginal?.lista_problemas || '',
          evolucion: this.historiaOriginal?.evolucion || '',
          pronostico: this.historiaOriginal?.pronostico || 'Favorable',
          planTratamiento: this.historiaOriginal?.plan_tratamiento || '',
          temperatura: this.historiaOriginal?.constantes?.temperatura ?? null,
          frecuenciaCardiaca: this.historiaOriginal?.constantes?.frecuencia_cardiaca ?? null,
          frecuenciaRespiratoria: this.historiaOriginal?.constantes?.frecuencia_respiratoria ?? null,
          peso: this.historiaOriginal?.paciente?.peso ?? null,
          motivoModificacion: ''
        });
        this.formHistoria.markAsPristine();
        this.formHistoria.markAsUntouched();
        this.formularioEnviado = false;
        this.cdr.detectChanges();
      }
    });
  }
}

// Exportamos también alias para mantener compatibilidad con cualquier referencia de nomenclatura
export { HistoriaClinica2Component as EditarHistoriaClinicaComponent };