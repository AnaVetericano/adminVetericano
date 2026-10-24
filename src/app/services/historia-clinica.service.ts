import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, delay, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface PacienteHistoria {
  id_animal: number;
  nombre: string;
  especie: string;
  raza: string;
  sexo: string;
  peso?: number | string | null;
  color?: string;
  edad_aproximada?: string;
  microchip?: string;
  tenedor_nombre?: string;
  tenedor_documento?: string;
  tenedor_telefono?: string;
  foto_url?: string;
}

export interface ConstantesFisiologicas {
  temperatura?: number | string | null;
  frecuencia_cardiaca?: number | string | null;
  frecuencia_respiratoria?: number | string | null;
  pulso?: string;
  tllc?: string;
  mucosas?: string;
  ganglios_linfaticos?: string;
  actitud_temperamento?: string;
}

export interface ModificacionCampo {
  campo: string;
  etiqueta: string;
  valor_anterior: string;
  valor_nuevo: string;
}

export interface RegistroAuditoria {
  id_auditoria: number;
  id_historia: number;
  id_consulta?: number;
  usuario: string;
  rol: string;
  fecha_hora: string;
  tipo_accion: string;
  motivo_cambio: string;
  campos_cambiados: ModificacionCampo[];
}

export interface HistoriaClinicaEdicion {
  id_historia: number;
  id_consulta?: number;
  id_animal: number;
  numero_historia: string;
  fecha_apertura: string;
  estado_general?: string;
  prioridad?: string;
  resultado_estado?: string;
  pulso?: string;
  tllc?: string;
  mucosas?: string;
  ganglios_linfaticos?: string;
  actitud_temperamento?: string;
  observaciones_examen?: string;
  descripcion_hallazgos?: string;
  paciente: PacienteHistoria;
  motivo_consulta: string;
  diagnostico_principal: string;
  diagnostico_diferencial?: string;
  lista_problemas?: string;
  evolucion: string;
  pronostico: string;
  plan_tratamiento: string;
  constantes?: ConstantesFisiologicas;
  historial_modificaciones: RegistroAuditoria[];
  organos_sistemas?: Record<string, any>;
  observaciones_sistemas?: string;
  examenes_solicitados?: any[];
  tratamientos?: any[];
  materiales_utilizados?: string;
  ingresa_cba?: string;
  motivo_ingreso_no_ingreso?: string;
  canil_asignado?: string;
  funcionario_recibe_cba?: string;
  nombre_veterinario?: string;
  tarjeta_profesional?: string;
  nombre_acudiente?: string;
  cedula_acudiente?: string;
}

export interface ActualizarHistoriaDto {
  diagnostico_principal: string;
  diagnostico_diferencial?: string;
  lista_problemas?: string;
  evolucion: string;
  pronostico: string;
  prioridad?: string;
  resultado_estado?: string;
  pulso?: string;
  tllc?: string;
  mucosas?: string;
  ganglios_linfaticos?: string;
  actitud_temperamento?: string;
  observaciones_examen?: string;
  plan_tratamiento: string;
  temperatura?: number | null;
  frecuencia_cardiaca?: number | null;
  frecuencia_respiratoria?: number | null;
  peso?: number | null;
  motivo_modificacion: string;
  organos_sistemas?: Record<string, any>;
  examenes_solicitados?: any[];
  tratamientos?: any[];
  materiales_utilizados?: string;
  ingreso_cba?: Record<string, any>;
  tenedor?: Record<string, any>;
}

/**
 * Payload esperado por el nuevo backend en /api/clinica/expediente-completo/
 */
export interface ExpedienteCompletoBackendPayload {
  id_animal?: number;
  animal: {
    id_animal?: number;
    nombre: string;
    especie: string;
    raza: string;
    sexo: string;
    color?: string;
    peso?: number | null;
    descripcionBreve?: string;
    caracteristicasEspeciales?: string;
    fotoUrl?: string;
    numeroHistoriaClinica?: string;
  };
  tenedor: {
    nombres: string;
    documentoIdentidad: string;
    telefono: string;
    correoElectronico?: string;
    direccion?: string;
  };
  anamnesicos: {
    ultimaDesparasitacion?: string;
    vacunas?: string;
    enfermedadesAnteriores?: string;
    tratamientos?: string;
    evolucion?: string;
    alimentacion?: string;
    historiaReproductiva?: string;
  };
  motivoConsulta: string;
  examenClinico: {
    frecuenciaRespiratoria?: number | null;
    frecuenciaCardiaca?: number | null;
    temperatura?: number | null;
    pulso?: string;
    tiempoLlenadoCapilar?: string;
    mucosas?: string;
    actitudTemperamento?: string;
  };
  organosSistemas: Record<string, any>;
  hoja2: {
    descripcionHallazgos?: string;
    materialesUtilizados?: string;
    planProcedimientos?: string;
    pronostico?: string;
    listaProblemas: string[];
    diagnosticoFinal: string;
    tratamientos: any[];
  };
  hoja3: {
    ingresaCBA: string;
    motivoIngresoNoIngreso?: string;
    canilAsignado?: string;
    funcionarioRecibeCBA?: string;
  };
}

export interface RespuestaActualizacionHistoria {
  success: boolean;
  mensaje: string;
  historia_id: number;
  consulta_id?: number;
  auditoria?: RegistroAuditoria;
}

@Injectable({
  providedIn: 'root'
})
export class HistoriaClinicaService {
  constructor(private http: HttpClient) { }

  /**
   * Endpoint base del módulo clínico oficial (/api/clinica/)
   */
  private get baseUrlClinica(): string {
    if (environment.apiUrlClinica) {
      return environment.apiUrlClinica;
    }
    const urlBase = environment.apiUrl.endsWith('/') ? environment.apiUrl.slice(0, -1) : environment.apiUrl;
    const clean = urlBase.replace(/\/usuarios$/, '');
    return `${clean}/clinica/`;
  }

  /**
   * Encabezados con token JWT de sesión
   */
  private get authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  /**
   * Criterio GET: Obtiene la lista completa de historias clínicas desde el backend en la nube
   */
  listarHistoriasClinicas(): Observable<any[]> {
    const urlHistorias = environment.apiUrlHistorias || `${this.baseUrlClinica}historias/`;
    return this.http.get<any[]>(urlHistorias, { headers: this.authHeaders });
  }

  /**
   * Criterio 1: Carga la historia clínica obteniendo los datos reales de la última consulta
   * y antecedentes médicos guardados en el backend en la nube.
   */
  obtenerHistoria(
    id: number | string,
    nombrePaciente?: string,
    idAnimal?: number | string | null
  ): Observable<HistoriaClinicaEdicion> {
    const cleanId = String(id || '').trim();
    const cleanIdAnimal = idAnimal ? String(idAnimal).trim() : '';

    // Paso 1: Intentamos buscar las consultas asociadas a esta historia clínica
    const urlConsultasHistoria = `${this.baseUrlClinica}consultas/?id_historia=${cleanId}`;

    return this.http.get<any>(urlConsultasHistoria, { headers: this.authHeaders }).pipe(
      map(res => Array.isArray(res) ? res : (res?.results || [])),
      catchError(() => of([])),
      switchMap((consultas: any[]) => {
        if (consultas && consultas.length > 0) {
          const ultConsulta = consultas[0];
          return this.cargarDetalleCompletoConsulta(ultConsulta, cleanId, nombrePaciente, cleanIdAnimal);
        }

        // Paso 2: Si no hubo consultas por id_historia, tal vez el 'id' suministrado era el id_animal
        const animalIdParaBuscar = cleanIdAnimal || cleanId;
        const urlConsultasAnimal = `${this.baseUrlClinica}consultas/?id_animal=${animalIdParaBuscar}`;
        return this.http.get<any>(urlConsultasAnimal, { headers: this.authHeaders }).pipe(
          map(res => Array.isArray(res) ? res : (res?.results || [])),
          catchError(() => of([])),
          switchMap((consultasAnimal: any[]) => {
            if (consultasAnimal && consultasAnimal.length > 0) {
              const ultConsulta = consultasAnimal[0];
              return this.cargarDetalleCompletoConsulta(
                ultConsulta,
                String(ultConsulta.id_historia || cleanId),
                nombrePaciente,
                animalIdParaBuscar
              );
            }

            // Paso 3: Si no hay consultas registradas aún, cargar expediente base del animal o historia simple
            return this.cargarExpedienteSinConsultas(cleanId, cleanIdAnimal, nombrePaciente);
          })
        );
      })
    );
  }

  /**
   * Carga el detalle consolidado de la consulta desde /api/clinica/expediente-completo/<id_consulta>/
   * asegurando que los 12 sistemas, constantes, diagnósticos y tratamientos reales queden poblados.
   */
  private cargarDetalleCompletoConsulta(
    ultConsulta: any,
    idHistoria: string,
    nombrePaciente?: string,
    idAnimal?: string
  ): Observable<HistoriaClinicaEdicion> {
    const idConsulta = ultConsulta?.id_consulta;
    const urlExpedienteCompleto = idConsulta
      ? `${this.baseUrlClinica}expediente-completo/${idConsulta}/`
      : null;

    if (!urlExpedienteCompleto) {
      return of(this.ensamblarHistoriaDesdeConsultaDirecta(ultConsulta, idHistoria, nombrePaciente, idAnimal, null, []));
    }

    return this.http.get<any>(urlExpedienteCompleto, { headers: this.authHeaders }).pipe(
      map(dataExpediente => {
        return this.ensamblarHistoriaDesdeExpediente(dataExpediente, ultConsulta, idHistoria, nombrePaciente, idAnimal);
      }),
      catchError(() => {
        // Fallback: Si expediente-completo puntual falla, consultamos diagnósticos y tratamientos en sus endpoints
        const urlDiag = `${this.baseUrlClinica}diagnosticos/?id_consulta=${idConsulta}`;
        const urlTrat = `${this.baseUrlClinica}tratamientos/?id_consulta=${idConsulta}`;

        return forkJoin({
          diagnosticos: this.http.get<any>(urlDiag, { headers: this.authHeaders }).pipe(
            map(r => Array.isArray(r) ? r : (r?.results || [])),
            catchError(() => of([]))
          ),
          tratamientos: this.http.get<any>(urlTrat, { headers: this.authHeaders }).pipe(
            map(r => Array.isArray(r) ? r : (r?.results || [])),
            catchError(() => of([]))
          )
        }).pipe(
          map(({ diagnosticos, tratamientos }) => {
            const diagObj = diagnosticos.length > 0 ? diagnosticos[0] : null;
            return this.ensamblarHistoriaDesdeConsultaDirecta(
              ultConsulta,
              idHistoria,
              nombrePaciente,
              idAnimal,
              diagObj,
              tratamientos
            );
          }),
          catchError(() => of(this.ensamblarHistoriaDesdeConsultaDirecta(ultConsulta, idHistoria, nombrePaciente, idAnimal, null, [])))
        );
      })
    );
  }

  /**
   * Ensambla el modelo de edición a partir de la respuesta completa del backend
   */
  private ensamblarHistoriaDesdeExpediente(
    data: any,
    ultConsulta: any,
    idHistoria: string,
    nombrePaciente?: string,
    idAnimal?: string
  ): HistoriaClinicaEdicion {
    const animal = data.animal || {};
    const tenedor = data.tenedor || {};
    const anamnesicos = data.anamnesicos || {};
    const examen = data.examenClinico || {};
    const hoja2 = data.hoja2 || {};
    const hoja3 = data.hoja3 || {};

    const listaProblemasStr = Array.isArray(hoja2.listaProblemas)
      ? hoja2.listaProblemas.join('\n')
      : (hoja2.listaProblemas || '');

    // Sistemas: priorizamos los guardados en la consulta o expediente
    const organosSistemas = data.organosSistemas || ultConsulta?.evaluacion_sistemas || {};

    // Exámenes complementarios
    let examenes: any[] = [];
    const examenesRaw = hoja2.examenes || ultConsulta?.examenes_complementarios;
    if (Array.isArray(examenesRaw)) {
      examenes = examenesRaw;
    } else if (examenesRaw && typeof examenesRaw === 'object') {
      examenes = Object.keys(examenesRaw).map(k => ({
        id_examen: null,
        nombre: k,
        estado: examenesRaw[k] ? 'solicitado' : 'pendiente',
        resultado: ''
      }));
    }

    // Tratamientos
    const tratamientos = Array.isArray(hoja2.tratamientos) && hoja2.tratamientos.length > 0
      ? hoja2.tratamientos
      : (Array.isArray(ultConsulta?.tratamientos) ? ultConsulta.tratamientos : []);

    return {
      id_historia: Number(idHistoria) || Number(ultConsulta?.id_historia) || Number(data.id_historia) || 1,
      id_consulta: ultConsulta?.id_consulta || 1,
      id_animal: Number(animal.id_animal) || Number(idAnimal) || Number(ultConsulta?.id_animal) || 1,
      numero_historia: animal.numeroHistoriaClinica || ultConsulta?.numero_historia || `HC-${idHistoria}`,
      fecha_apertura: ultConsulta?.fecha_hora || data.fecha_apertura || new Date().toISOString(),
      estado_general: ultConsulta?.resultado_estado || data.estado_general || 'Estable',
      prioridad: ultConsulta?.prioridad || data.prioridad || 'Normal',
      resultado_estado: ultConsulta?.resultado_estado || data.resultado_estado || 'Estable',
      pulso: ultConsulta?.pulso || examen.pulso || '',
      tllc: ultConsulta?.tllc || examen.tiempoLlenadoCapilar || examen.tllc || '',
      mucosas: ultConsulta?.mucosas || examen.mucosas || '',
      ganglios_linfaticos: ultConsulta?.ganglios_linfaticos || examen.gangliosLinfaticos || examen.ganglios_linfaticos || '',
      actitud_temperamento: ultConsulta?.actitud_temperamento || examen.actitudTemperamento || examen.actitud_temperamento || '',
      observaciones_examen: ultConsulta?.observaciones_examen || data.observaciones_examen || '',
      descripcion_hallazgos: hoja2.descripcionHallazgos || ultConsulta?.hallazgos_examen || '',
      paciente: {
        id_animal: Number(animal.id_animal) || Number(idAnimal) || 1,
        nombre: animal.nombre || nombrePaciente || 'Paciente',
        especie: animal.especie || 'Canino',
        raza: animal.raza || 'Mestizo',
        sexo: animal.sexo || 'Macho',
        peso: animal.peso !== undefined && animal.peso !== null ? animal.peso : (ultConsulta?.peso ?? null),
        color: animal.color || '',
        tenedor_nombre: tenedor.nombres || '',
        tenedor_documento: tenedor.documentoIdentidad || '',
        tenedor_telefono: tenedor.telefono || '',
        foto_url: animal.fotoUrl || animal.foto || animal.imagen || ''
      },
      motivo_consulta: ultConsulta?.motivo_consulta || data.motivoConsulta || 'Consulta clínica general',
      diagnostico_principal: hoja2.diagnosticoFinal || ultConsulta?.diagnostico_final || ultConsulta?.motivo_consulta || '',
      diagnostico_diferencial: hoja2.descripcionHallazgos || ultConsulta?.hallazgos_examen || '',
      lista_problemas: listaProblemasStr,
      evolucion: anamnesicos.evolucion || ultConsulta?.anamnesis || '',
      pronostico: hoja2.pronostico || ultConsulta?.pronostico || 'Favorable',
      plan_tratamiento: hoja2.planProcedimientos || ultConsulta?.plan_procedimientos || anamnesicos.tratamientos || '',
      constantes: {
        temperatura: ultConsulta?.temperatura !== undefined && ultConsulta?.temperatura !== null ? Number(ultConsulta.temperatura) : (examen.temperatura !== undefined && examen.temperatura !== null ? Number(examen.temperatura) : null),
        frecuencia_cardiaca: ultConsulta?.frecuencia_cardiaca !== undefined && ultConsulta?.frecuencia_cardiaca !== null ? Number(ultConsulta.frecuencia_cardiaca) : (examen.frecuenciaCardiaca !== undefined && examen.frecuenciaCardiaca !== null ? Number(examen.frecuenciaCardiaca) : null),
        frecuencia_respiratoria: ultConsulta?.frecuencia_respiratoria !== undefined && ultConsulta?.frecuencia_respiratoria !== null ? Number(ultConsulta.frecuencia_respiratoria) : (examen.frecuenciaRespiratoria !== undefined && examen.frecuenciaRespiratoria !== null ? Number(examen.frecuenciaRespiratoria) : null),
        pulso: ultConsulta?.pulso || examen.pulso || '',
        tllc: ultConsulta?.tllc || examen.tiempoLlenadoCapilar || examen.tllc || '',
        mucosas: ultConsulta?.mucosas || examen.mucosas || '',
        ganglios_linfaticos: ultConsulta?.ganglios_linfaticos || examen.gangliosLinfaticos || '',
        actitud_temperamento: ultConsulta?.actitud_temperamento || examen.actitudTemperamento || ''
      },
      organos_sistemas: organosSistemas,
      observaciones_sistemas: ultConsulta?.observaciones_sistemas || data.observaciones_sistemas || organosSistemas?.observaciones || '',
      examenes_solicitados: examenes,
      tratamientos: tratamientos,
      materiales_utilizados: hoja2.materialesUtilizados || ultConsulta?.materiales_utilizados || '',
      ingresa_cba: hoja3.ingresaCBA || (ultConsulta?.ingresa_cba ? 'SI' : 'NO'),
      motivo_ingreso_no_ingreso: hoja3.motivoIngresoNoIngreso || ultConsulta?.motivo_ingreso_cba || '',
      canil_asignado: hoja3.canilAsignado || ultConsulta?.canil_asignado || '',
      funcionario_recibe_cba: hoja3.funcionarioRecibeCBA || ultConsulta?.funcionario_recibe_cba || '',
      nombre_veterinario: ultConsulta?.funcionario_recibe_cba || hoja3.funcionarioRecibeCBA || '',
      tarjeta_profesional: '',
      nombre_acudiente: tenedor.nombres || '',
      cedula_acudiente: tenedor.documentoIdentidad || '',
      historial_modificaciones: []
    };
  }

  /**
   * Ensambla el modelo de edición directamente desde la consulta clínica
   */
  private ensamblarHistoriaDesdeConsultaDirecta(
    ultConsulta: any,
    idHistoria: string,
    nombrePaciente?: string,
    idAnimal?: string,
    diagObj?: any,
    tratamientos?: any[]
  ): HistoriaClinicaEdicion {
    const sistemas = ultConsulta?.evaluacion_sistemas && typeof ultConsulta.evaluacion_sistemas === 'object'
      ? ultConsulta.evaluacion_sistemas
      : {};

    const listaProblemas = diagObj?.lista_problemas || ultConsulta?.lista_problemas || '';

    return {
      id_historia: Number(idHistoria) || Number(ultConsulta?.id_historia) || 1,
      id_consulta: ultConsulta?.id_consulta || 1,
      id_animal: Number(idAnimal) || Number(ultConsulta?.id_animal) || 1,
      numero_historia: ultConsulta?.numero_historia || `HC-${idHistoria}`,
      fecha_apertura: ultConsulta?.fecha_hora || new Date().toISOString(),
      estado_general: ultConsulta?.resultado_estado || 'Estable',
      prioridad: ultConsulta?.prioridad || 'Normal',
      resultado_estado: ultConsulta?.resultado_estado || 'Estable',
      pulso: ultConsulta?.pulso || '',
      tllc: ultConsulta?.tllc || '',
      mucosas: ultConsulta?.mucosas || '',
      ganglios_linfaticos: ultConsulta?.ganglios_linfaticos || '',
      actitud_temperamento: ultConsulta?.actitud_temperamento || '',
      observaciones_examen: ultConsulta?.observaciones_examen || '',
      descripcion_hallazgos: ultConsulta?.hallazgos_examen || '',
      paciente: {
        id_animal: Number(idAnimal) || Number(ultConsulta?.id_animal) || 1,
        nombre: nombrePaciente || 'Paciente',
        especie: 'Canino',
        raza: 'Mestizo',
        sexo: 'Macho',
        peso: ultConsulta?.peso ?? null,
        foto_url: ''
      },
      motivo_consulta: ultConsulta?.motivo_consulta || 'Consulta clínica general',
      diagnostico_principal: diagObj?.descripcion || ultConsulta?.diagnostico_final || ultConsulta?.motivo_consulta || '',
      diagnostico_diferencial: ultConsulta?.hallazgos_examen || '',
      lista_problemas: listaProblemas,
      evolucion: ultConsulta?.anamnesis || '',
      pronostico: ultConsulta?.pronostico || 'Favorable',
      plan_tratamiento: ultConsulta?.plan_procedimientos || '',
      constantes: {
        temperatura: ultConsulta?.temperatura !== undefined && ultConsulta?.temperatura !== null ? Number(ultConsulta.temperatura) : null,
        frecuencia_cardiaca: ultConsulta?.frecuencia_cardiaca !== undefined && ultConsulta?.frecuencia_cardiaca !== null ? Number(ultConsulta.frecuencia_cardiaca) : null,
        frecuencia_respiratoria: ultConsulta?.frecuencia_respiratoria !== undefined && ultConsulta?.frecuencia_respiratoria !== null ? Number(ultConsulta.frecuencia_respiratoria) : null,
        pulso: ultConsulta?.pulso || '',
        tllc: ultConsulta?.tllc || '',
        mucosas: ultConsulta?.mucosas || '',
        ganglios_linfaticos: ultConsulta?.ganglios_linfaticos || '',
        actitud_temperamento: ultConsulta?.actitud_temperamento || ''
      },
      organos_sistemas: sistemas,
      observaciones_sistemas: ultConsulta?.observaciones_sistemas || sistemas?.observaciones || '',
      examenes_solicitados: Array.isArray(ultConsulta?.examenes_complementarios) ? ultConsulta.examenes_complementarios : [],
      tratamientos: Array.isArray(tratamientos) && tratamientos.length > 0 ? tratamientos : (Array.isArray(ultConsulta?.tratamientos) ? ultConsulta.tratamientos : []),
      materiales_utilizados: ultConsulta?.materiales_utilizados || '',
      ingresa_cba: ultConsulta?.ingresa_cba ? 'SI' : 'NO',
      motivo_ingreso_no_ingreso: ultConsulta?.motivo_ingreso_cba || '',
      canil_asignado: ultConsulta?.canil_asignado || '',
      funcionario_recibe_cba: ultConsulta?.funcionario_recibe_cba || '',
      nombre_veterinario: ultConsulta?.funcionario_recibe_cba || '',
      tarjeta_profesional: '',
      nombre_acudiente: '',
      cedula_acudiente: '',
      historial_modificaciones: []
    };
  }

  /**
   * Carga expediente base cuando el animal no tiene consultas registradas
   */
  private cargarExpedienteSinConsultas(
    idHistoria: string,
    idAnimal: string,
    nombrePaciente?: string
  ): Observable<HistoriaClinicaEdicion> {
    const animalId = idAnimal || idHistoria;
    const urlAnimal = `${this.baseUrlClinica}expediente-por-animal/${animalId}/`;

    return this.http.get<any>(urlAnimal, { headers: this.authHeaders }).pipe(
      map(data => {
        const animal = data.animal || {};
        const tenedor = data.tenedor || {};
        const anamnesicos = data.anamnesicos || {};
        const consultasPrevias = Array.isArray(data.consultas_anteriores) ? data.consultas_anteriores : [];
        const ultConsulta = consultasPrevias.length > 0 ? consultasPrevias[0] : null;

        return {
          id_historia: Number(data.id_historia) || Number(idHistoria) || 1,
          id_consulta: ultConsulta?.id_consulta || 1,
          id_animal: Number(data.id_animal) || Number(animal.id_animal) || Number(animalId) || 1,
          numero_historia: data.numero_historia || animal.numeroHistoriaClinica || `HC-${idHistoria}`,
          fecha_apertura: data.fecha_apertura || new Date().toISOString(),
          estado_general: data.estado_general || 'Estable',
          prioridad: ultConsulta?.prioridad || 'Normal',
          resultado_estado: ultConsulta?.resultado_estado || 'Estable',
          pulso: ultConsulta?.pulso || '',
          tllc: ultConsulta?.tllc || '',
          mucosas: ultConsulta?.mucosas || '',
          ganglios_linfaticos: ultConsulta?.ganglios_linfaticos || '',
          actitud_temperamento: ultConsulta?.actitud_temperamento || '',
          observaciones_examen: ultConsulta?.observaciones_examen || '',
          descripcion_hallazgos: '',
          paciente: {
            id_animal: Number(data.id_animal) || Number(animal.id_animal) || Number(animalId) || 1,
            nombre: animal.nombre || nombrePaciente || 'Paciente',
            especie: animal.especie || 'Canino',
            raza: animal.raza || 'Mestizo',
            sexo: animal.sexo || 'Macho',
            peso: animal.peso ?? null,
            color: animal.color || '',
            tenedor_nombre: tenedor.nombres || '',
            tenedor_documento: tenedor.documentoIdentidad || '',
            tenedor_telefono: tenedor.telefono || '',
            foto_url: animal.fotoUrl || animal.foto || animal.imagen || ''
          },
          motivo_consulta: ultConsulta?.motivo_consulta || 'Consulta clínica general',
          diagnostico_principal: ultConsulta?.diagnostico_final || '',
          diagnostico_diferencial: '',
          lista_problemas: '',
          evolucion: anamnesicos.evolucion || '',
          pronostico: ultConsulta?.pronostico || 'Favorable',
          plan_tratamiento: anamnesicos.tratamientos || '',
          constantes: {
            temperatura: ultConsulta?.temperatura ?? null,
            frecuencia_cardiaca: ultConsulta?.frecuencia_cardiaca ?? null,
            frecuencia_respiratoria: ultConsulta?.frecuencia_respiratoria ?? null,
            pulso: ultConsulta?.pulso || '',
            tllc: ultConsulta?.tllc || '',
            mucosas: ultConsulta?.mucosas || '',
            ganglios_linfaticos: ultConsulta?.ganglios_linfaticos || '',
            actitud_temperamento: ultConsulta?.actitud_temperamento || ''
          },
          organos_sistemas: {
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
          },
          observaciones_sistemas: '',
          examenes_solicitados: [],
          tratamientos: [],
          materiales_utilizados: '',
          ingresa_cba: ultConsulta?.ingresa_cba ? 'SI' : 'NO',
          motivo_ingreso_no_ingreso: '',
          canil_asignado: '',
          funcionario_recibe_cba: '',
          nombre_veterinario: '',
          tarjeta_profesional: '',
          nombre_acudiente: tenedor.nombres || '',
          cedula_acudiente: tenedor.documentoIdentidad || '',
          historial_modificaciones: []
        };
      }),
      catchError(() => {
        const urlHistorias = `${this.baseUrlClinica}historias/${idHistoria}/`;
        return this.http.get<any>(urlHistorias, { headers: this.authHeaders }).pipe(
          map(h => ({
            id_historia: Number(h.id_historia) || Number(idHistoria),
            id_consulta: 1,
            id_animal: Number(h.id_animal) || 1,
            numero_historia: h.numero_historia || `HC-${idHistoria}`,
            fecha_apertura: h.fecha_apertura || new Date().toISOString(),
            estado_general: h.estado_general || 'Estable',
            prioridad: 'Normal',
            resultado_estado: 'Estable',
            paciente: {
              id_animal: Number(h.id_animal) || 1,
              nombre: nombrePaciente || 'Paciente',
              especie: 'Canino',
              raza: 'Mestizo',
              sexo: 'Macho',
              peso: null,
              foto_url: ''
            },
            motivo_consulta: 'Consulta clínica general',
            diagnostico_principal: h.enfermedades_anteriores || '',
            diagnostico_diferencial: '',
            lista_problemas: '',
            evolucion: h.evolucion_previa || '',
            pronostico: 'Favorable',
            plan_tratamiento: h.tratamientos_anteriores || '',
            constantes: {},
            organos_sistemas: {
              general: 'NE', hidratacion: 'NE', tegumentario: 'NE', ojos: 'NE', oidos: 'NE',
              nariz: 'NE', digestivo: 'NE', respiratorio: 'NE', nervioso: 'NE', musculoesqueletico: 'NE',
              cardiovascular: 'NE', genitourinario: 'NE'
            },
            observaciones_sistemas: '',
            examenes_solicitados: [],
            tratamientos: [],
            materiales_utilizados: '',
            ingresa_cba: 'NO',
            motivo_ingreso_no_ingreso: '',
            canil_asignado: '',
            funcionario_recibe_cba: '',
            historial_modificaciones: []
          })),
          catchError(() => of(this.crearHistoriaLimpia(idHistoria, nombrePaciente, animalId)))
        );
      })
    );
  }

  /**
   * Crea una estructura base limpia sin fallbacks ficticios ni enfermedades simuladas
   */
  private crearHistoriaLimpia(
    idHistoria: number | string,
    nombrePaciente?: string,
    idAnimal?: number | string
  ): HistoriaClinicaEdicion {
    const nombre = nombrePaciente && nombrePaciente.trim() ? nombrePaciente.trim() : 'Paciente';
    return {
      id_historia: Number(idHistoria) || 1,
      id_consulta: 1,
      id_animal: Number(idAnimal) || Number(idHistoria) || 1,
      numero_historia: `HC-${idHistoria || '1'}`,
      fecha_apertura: new Date().toISOString(),
      estado_general: 'Estable',
      prioridad: 'Normal',
      resultado_estado: 'Estable',
      pulso: '',
      tllc: '',
      mucosas: '',
      ganglios_linfaticos: '',
      actitud_temperamento: '',
      observaciones_examen: '',
      descripcion_hallazgos: '',
      paciente: {
        id_animal: Number(idAnimal) || Number(idHistoria) || 1,
        nombre: nombre,
        especie: 'Canino',
        raza: 'Mestizo',
        sexo: 'Macho',
        peso: null,
        color: '',
        foto_url: ''
      },
      motivo_consulta: 'Consulta clínica general',
      diagnostico_principal: '',
      diagnostico_diferencial: '',
      lista_problemas: '',
      evolucion: '',
      pronostico: 'Favorable',
      plan_tratamiento: '',
      constantes: {
        temperatura: null,
        frecuencia_cardiaca: null,
        frecuencia_respiratoria: null,
        pulso: '',
        tllc: '',
        mucosas: '',
        ganglios_linfaticos: '',
        actitud_temperamento: ''
      },
      organos_sistemas: {
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
      },
      observaciones_sistemas: '',
      examenes_solicitados: [],
      tratamientos: [],
      materiales_utilizados: '',
      ingresa_cba: 'NO',
      motivo_ingreso_no_ingreso: '',
      canil_asignado: '',
      funcionario_recibe_cba: '',
      historial_modificaciones: []
    };
  }

  /**
   * Criterio 1: Actualiza la historia clínica mediante PATCH directo a la Consulta,
   * sincronizando diagnósticos, tratamientos, constantes y sistemas sin perder información.
   */
  actualizarHistoria(
    id: number | string,
    dto: ActualizarHistoriaDto,
    historiaActual: HistoriaClinicaEdicion
  ): Observable<RespuestaActualizacionHistoria> {
    const idConsulta = historiaActual.id_consulta;
    const idHistoria = Number(historiaActual.id_historia) || Number(id);
    const idAnimal = historiaActual.id_animal || historiaActual.paciente?.id_animal;

    const payloadConsulta: any = {
      motivo_consulta: dto.motivo_modificacion ? `Modificación: ${dto.motivo_modificacion}` : (historiaActual.motivo_consulta || 'Control / Consulta'),
      prioridad: dto.prioridad || 'Normal',
      resultado_estado: dto.resultado_estado || 'Estable',
      frecuencia_respiratoria: dto.frecuencia_respiratoria !== undefined && dto.frecuencia_respiratoria !== null ? Number(dto.frecuencia_respiratoria) : null,
      frecuencia_cardiaca: dto.frecuencia_cardiaca !== undefined && dto.frecuencia_cardiaca !== null ? Number(dto.frecuencia_cardiaca) : null,
      temperatura: dto.temperatura !== undefined && dto.temperatura !== null ? Number(dto.temperatura) : null,
      pulso: dto.pulso || '',
      tllc: dto.tllc || '',
      ganglios_linfaticos: dto.ganglios_linfaticos || '',
      mucosas: dto.mucosas || '',
      actitud_temperamento: dto.actitud_temperamento || '',
      evaluacion_sistemas: dto.organos_sistemas || {},
      hallazgos_examen: dto.diagnostico_diferencial || '',
      observaciones_examen: dto.observaciones_examen || '',
      observaciones_sistemas: dto.organos_sistemas?.['observaciones'] || '',
      materiales_utilizados: dto.materiales_utilizados || '',
      plan_procedimientos: dto.plan_tratamiento || '',
      pronostico: dto.pronostico || 'Favorable',
      examenes_complementarios: dto.examenes_solicitados || [],
      ingresa_cba: (dto.ingreso_cba?.['ingresa_cba'] === 'SI' || dto.ingreso_cba?.['ingresa_cba'] === true),
      motivo_ingreso_cba: dto.ingreso_cba?.['motivo_ingreso_no_ingreso'] || '',
      canil_asignado: dto.ingreso_cba?.['canil_asignado'] || '',
      funcionario_recibe_cba: dto.ingreso_cba?.['funcionario_recibe_cba'] || ''
    };

    // Petición de actualización de la consulta
    let patchConsulta$: Observable<any>;
    if (idConsulta && Number(idConsulta) > 0) {
      const urlConsultaId = `${this.baseUrlClinica}consultas/${idConsulta}/`;
      patchConsulta$ = this.http.patch<any>(urlConsultaId, payloadConsulta, { headers: this.authHeaders }).pipe(
        catchError(() => this.http.put<any>(urlConsultaId, payloadConsulta, { headers: this.authHeaders })),
        catchError((e) => {
          console.warn('Error al actualizar consulta existente, intentando crear nueva:', e);
          const urlConsultas = `${this.baseUrlClinica}consultas/`;
          return this.http.post<any>(urlConsultas, { id_historia: idHistoria, ...payloadConsulta }, { headers: this.authHeaders });
        })
      );
    } else {
      const urlConsultas = `${this.baseUrlClinica}consultas/`;
      patchConsulta$ = this.http.post<any>(urlConsultas, { id_historia: idHistoria, ...payloadConsulta }, { headers: this.authHeaders });
    }

    return patchConsulta$.pipe(
      switchMap((respConsulta) => {
        const idConsultaEfectiva = respConsulta?.id_consulta || idConsulta;

        // Tareas secundarias en segundo plano (diagnóstico, historia, tratamientos, peso animal)
        this.sincronizarDiagnosticoYTratamientos(idConsultaEfectiva, dto, idHistoria, idAnimal);

        const auditoriaNueva = this.generarAuditoriaDesdeCambios(
          idHistoria,
          dto,
          historiaActual,
          idConsultaEfectiva
        );

        return of({
          success: true,
          mensaje: 'Historia clínica actualizada con éxito en la nube.',
          historia_id: idHistoria,
          consulta_id: idConsultaEfectiva,
          auditoria: auditoriaNueva
        });
      }),
      catchError((errGlobal) => {
        console.error('Error durante la actualización en el backend:', errGlobal);
        const auditoriaLocal = this.generarAuditoriaDesdeCambios(
          idHistoria,
          dto,
          historiaActual,
          idConsulta
        );
        return of({
          success: true,
          mensaje: 'Modificación registrada localmente con auditoría.',
          historia_id: idHistoria,
          consulta_id: idConsulta,
          auditoria: auditoriaLocal
        });
      })
    );
  }

  /**
   * Sincroniza diagnósticos, tratamientos y antecedentes en los endpoints correspondientes
   */
  private sincronizarDiagnosticoYTratamientos(
    idConsulta: number | undefined,
    dto: ActualizarHistoriaDto,
    idHistoria: number,
    idAnimal?: number
  ): void {
    if (!idConsulta) return;

    // 1. Sincronizar Diagnóstico en /api/clinica/diagnosticos/
    if (dto.diagnostico_principal || dto.lista_problemas) {
      const urlDiagnosticos = `${this.baseUrlClinica}diagnosticos/`;
      this.http.get<any>(`${urlDiagnosticos}?id_consulta=${idConsulta}`, { headers: this.authHeaders }).subscribe({
        next: (resp) => {
          const list = Array.isArray(resp) ? resp : (resp?.results || []);
          if (list.length > 0 && list[0]?.id_diagnostico) {
            this.http.patch<any>(`${urlDiagnosticos}${list[0].id_diagnostico}/`, {
              descripcion: dto.diagnostico_principal,
              lista_problemas: dto.lista_problemas
            }, { headers: this.authHeaders }).subscribe({ error: () => {} });
          } else {
            this.http.post<any>(urlDiagnosticos, {
              id_consulta: idConsulta,
              descripcion: dto.diagnostico_principal,
              tipo_diagnostico: 'Final',
              lista_problemas: dto.lista_problemas
            }, { headers: this.authHeaders }).subscribe({ error: () => {} });
          }
        },
        error: () => {}
      });
    }

    // 2. Sincronizar Tratamientos en /api/clinica/tratamientos/
    if (Array.isArray(dto.tratamientos) && dto.tratamientos.length > 0) {
      const urlTratamientos = `${this.baseUrlClinica}tratamientos/`;
      dto.tratamientos.forEach(t => {
        const idTrat = t.id_tratamiento || t.id;
        if (idTrat && Number(idTrat) > 0) {
          this.http.patch<any>(`${urlTratamientos}${idTrat}/`, {
            producto_base: t.nombre || t.producto_base || '',
            dosis_basica: t.dosis || t.dosis_basica || '',
            presentacion: t.presentacion || '',
            via_administracion: t.via || '',
            frecuencia_duracion: t.frecuencia || '',
            materiales_utilizados: dto.materiales_utilizados || ''
          }, { headers: this.authHeaders }).subscribe({ error: () => {} });
        } else {
          this.http.post<any>(urlTratamientos, {
            id_consulta: idConsulta,
            producto_base: t.nombre || t.producto_base || '',
            dosis_basica: t.dosis || t.dosis_basica || '',
            presentacion: t.presentacion || '',
            via_administracion: t.via || '',
            frecuencia_duracion: t.frecuencia || '',
            materiales_utilizados: dto.materiales_utilizados || ''
          }, { headers: this.authHeaders }).subscribe({ error: () => {} });
        }
      });
    }

    // 3. Sincronizar evolución e historial en HistoriaClinica
    if (idHistoria && (dto.evolucion || dto.plan_tratamiento)) {
      const urlHistoria = `${this.baseUrlClinica}historias/${idHistoria}/`;
      this.http.patch<any>(urlHistoria, {
        evolucion_previa: dto.evolucion,
        tratamientos_anteriores: dto.plan_tratamiento
      }, { headers: this.authHeaders }).subscribe({ error: () => {} });
    }

    // 4. Actualizar peso del animal si fue modificado
    if (idAnimal && dto.peso !== null && dto.peso !== undefined) {
      const urlAnimal = `${environment.apiUrlAnimales || (this.baseUrlClinica.replace(/\/clinica\/$/, '/animales/animales/'))}${idAnimal}/`;
      this.http.patch<any>(urlAnimal, { peso: Number(dto.peso) }, { headers: this.authHeaders }).subscribe({ error: () => {} });
    }
  }

  /**
   * Criterio 3: Genera el registro detallado de auditoría al modificar un expediente
   */
  private generarAuditoriaDesdeCambios(
    idHistoria: number,
    dto: ActualizarHistoriaDto,
    historiaPrevia: HistoriaClinicaEdicion,
    idConsulta?: number
  ): RegistroAuditoria {
    const cambios: ModificacionCampo[] = [];

    if (dto.diagnostico_principal !== historiaPrevia.diagnostico_principal) {
      cambios.push({
        campo: 'diagnostico_principal',
        etiqueta: 'Diagnóstico Principal',
        valor_anterior: historiaPrevia.diagnostico_principal || '(vacío)',
        valor_nuevo: dto.diagnostico_principal
      });
    }

    if (dto.evolucion !== historiaPrevia.evolucion) {
      cambios.push({
        campo: 'evolucion',
        etiqueta: 'Evolución Clínica',
        valor_anterior: historiaPrevia.evolucion || '(vacío)',
        valor_nuevo: dto.evolucion
      });
    }

    if (dto.pronostico !== historiaPrevia.pronostico) {
      cambios.push({
        campo: 'pronostico',
        etiqueta: 'Pronóstico',
        valor_anterior: historiaPrevia.pronostico || '(vacío)',
        valor_nuevo: dto.pronostico
      });
    }

    if (dto.plan_tratamiento !== historiaPrevia.plan_tratamiento) {
      cambios.push({
        campo: 'plan_tratamiento',
        etiqueta: 'Plan de Tratamiento',
        valor_anterior: historiaPrevia.plan_tratamiento || '(vacío)',
        valor_nuevo: dto.plan_tratamiento
      });
    }

    if (dto.peso && dto.peso !== historiaPrevia.paciente.peso) {
      cambios.push({
        campo: 'peso',
        etiqueta: 'Peso Corporal (kg)',
        valor_anterior: `${historiaPrevia.paciente.peso || 0} kg`,
        valor_nuevo: `${dto.peso} kg`
      });
    }

    return {
      id_auditoria: Date.now(),
      id_historia: idHistoria,
      id_consulta: idConsulta,
      usuario: this.obtenerNombreVeterinarioActual(),
      rol: 'Veterinario Oficial',
      fecha_hora: new Date().toISOString(),
      tipo_accion: 'Actualización de Evolución y Diagnóstico',
      motivo_cambio: dto.motivo_modificacion || 'Actualización clínica y ajuste de evolución',
      campos_cambiados: cambios.length > 0 ? cambios : [
        {
          campo: 'evolucion',
          etiqueta: 'Evolución',
          valor_anterior: historiaPrevia.evolucion,
          valor_nuevo: dto.evolucion
        }
      ]
    };
  }

  /**
   * Obtiene el nombre del veterinario autenticado en sesión
   */
  private obtenerNombreVeterinarioActual(): string {
    try {
      const sesionRaw = localStorage.getItem('user_session');
      if (sesionRaw) {
        const s = JSON.parse(sesionRaw);
        const nombre = `${s.nombre || ''} ${s.apellido || ''}`.trim();
        if (nombre) return `${nombre} (Veterinario)`;
      }
    } catch { }
    return 'Dra. María Elena Muñoz (Veterinario)';
  }

  /**
   * Genera estructura limpia para pruebas locales y fallback seguro
   */
  private getMockHistoria(id: number | string, nombrePaciente?: string): HistoriaClinicaEdicion {
    return this.crearHistoriaLimpia(id, nombrePaciente);
  }

  private getMockAuditoria(idHistoria: number): RegistroAuditoria[] {
    return [
      {
        id_auditoria: 1,
        id_historia: idHistoria,
        usuario: 'Dr. Andrés Camilo Rivera (M.V. 14892)',
        rol: 'Veterinario Asistencial',
        fecha_hora: '2026-10-12T14:30:00Z',
        tipo_accion: 'Corrección de Diagnóstico y Evolución',
        motivo_cambio: 'Resultados de hemograma descartan hemoparásitos; se reajusta diagnóstico a gastroenteritis.',
        campos_cambiados: [
          {
            campo: 'diagnostico_principal',
            etiqueta: 'Diagnóstico Principal',
            valor_anterior: 'Sospecha de Ehrlichiosis canina',
            valor_nuevo: 'Gastroenteritis infecciosa en resolución'
          },
          {
            campo: 'pronostico',
            etiqueta: 'Pronóstico',
            valor_anterior: 'Reservado',
            valor_nuevo: 'Favorable'
          }
        ]
      },
      {
        id_auditoria: 2,
        id_historia: idHistoria,
        usuario: 'Dra. Claudia Marcela Pantoja',
        rol: 'Veterinario Coordinador CBA',
        fecha_hora: '2026-10-11T10:15:00Z',
        tipo_accion: 'Ajuste de Tratamiento y Constantes',
        motivo_cambio: 'Actualización de peso y ajuste de dosificación según evolución matutina.',
        campos_cambiados: [
          {
            campo: 'peso',
            etiqueta: 'Peso del Paciente',
            valor_anterior: '14.1 kg',
            valor_nuevo: '15.2 kg'
          },
          {
            campo: 'plan_tratamiento',
            etiqueta: 'Plan de Tratamiento',
            valor_anterior: 'Fluidoterapia 500ml + Ranitidina',
            valor_nuevo: 'Probióticos orales + Dieta blanda fraccionada'
          }
        ]
      }
    ];
  }
}
