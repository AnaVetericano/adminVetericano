import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface MetricasPeticiones {
  total: number;
  pendientes: number;
  enProceso: number;
  finalizadas: number;
  urgentes: number;
  distribucionEstados: { [estado: string]: number };
}

export interface CasoVeterinario {
  id_veterinario: number | string;
  nombre_completo: string;
  total_asignados: number;
  pendientes: number;
  en_proceso: number;
  finalizadas: number;
  porcentaje_completado: number;
}

export interface MetricasCBA {
  totalIngresadosCBA: number;
  enObservacion: number;
  enTratamiento: number;
  aptosAdopcion: number;
  adoptadosOtras: number;
  distribucionEstados: { [estado: string]: number };
  ultimosIngresos: any[];
}

export interface ResumenDashboardJuridico {
  peticiones: MetricasPeticiones;
  casosVeterinarios: CasoVeterinario[];
  cba: MetricasCBA;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardJuridicoService {
  private backendUrl = environment.backendUrl;

  private urlPeticiones = `${this.backendUrl}/api/peticiones/listar/`;
  private urlFuncionarios = `${this.backendUrl}/api/peticiones/seguimiento/funcionarios/`;
  private urlConsultas = `${this.backendUrl}/api/clinica/consultas/`;
  private urlAnimales = `${this.backendUrl}/api/animales/animales/`;
  private urlEstadosAnimal = `${this.backendUrl}/api/animales/estados/`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  /**
   * Obtiene y consolida todas las fuentes de datos para el Dashboard Jurídico.
   */
  obtenerDatosDashboard(): Observable<ResumenDashboardJuridico> {
    const headers = this.getHeaders();

    return forkJoin({
      peticiones: this.http.get<any[]>(this.urlPeticiones, { headers }).pipe(
        map((res: any) => (Array.isArray(res) ? res : res?.results || res?.data || [])),
        catchError(() => of([]))
      ),
      funcionarios: this.http.get<any[]>(this.urlFuncionarios, { headers }).pipe(
        map((res: any) => (Array.isArray(res) ? res : res?.results || res?.data || [])),
        catchError(() => of([]))
      ),
      consultas: this.http.get<any[]>(this.urlConsultas, { headers }).pipe(
        map((res: any) => (Array.isArray(res) ? res : res?.results || res?.data || [])),
        catchError(() => of([]))
      ),
      animales: this.http.get<any[]>(this.urlAnimales, { headers }).pipe(
        map((res: any) => (Array.isArray(res) ? res : res?.results || res?.data || [])),
        catchError(() => of([]))
      ),
      estadosAnimal: this.http.get<any[]>(this.urlEstadosAnimal, { headers }).pipe(
        map((res: any) => (Array.isArray(res) ? res : res?.results || res?.data || [])),
        catchError(() => of([]))
      )
    }).pipe(
      map(({ peticiones, funcionarios, consultas, animales, estadosAnimal }) => {
        const metPeticiones = this.procesarPeticiones(peticiones);
        const metCasosVet = this.procesarCasosPorVeterinario(peticiones, funcionarios);
        const metCBA = this.procesarCBA(consultas, animales, estadosAnimal);

        return {
          peticiones: metPeticiones,
          casosVeterinarios: metCasosVet,
          cba: metCBA
        };
      })
    );
  }

  /**
   * 1. Total de peticiones y desglose de estados
   */
  private procesarPeticiones(lista: any[]): MetricasPeticiones {
    const distribucion: { [estado: string]: number } = {};
    let pendientes = 0;
    let enProceso = 0;
    let finalizadas = 0;
    let urgentes = 0;

    lista.forEach((p) => {
      // Estado normalizado
      const estadoRaw = String(p.estado || p.id_estado?.nombre || 'Pendiente').trim();
      const estadoNorm = estadoRaw.charAt(0).toUpperCase() + estadoRaw.slice(1).toLowerCase();
      distribucion[estadoNorm] = (distribucion[estadoNorm] || 0) + 1;

      const eLow = estadoNorm.toLowerCase();
      if (eLow.includes('pendiente') || eLow.includes('revisión') || eLow.includes('asignada')) {
        pendientes++;
      } else if (eLow.includes('proceso') || eLow.includes('curso') || eLow.includes('tratamiento')) {
        enProceso++;
      } else if (eLow.includes('atendida') || eLow.includes('finaliz') || eLow.includes('cerrad') || eLow.includes('resuelta')) {
        finalizadas++;
      } else {
        pendientes++;
      }

      // Prioridad urgente
      const prio = String(p.prioridad || '').toLowerCase();
      const tipo = String(p.tipo || p.nombre_tipo || '').toLowerCase();
      if (prio.includes('alta') || prio.includes('urgente') || prio.includes('crit') || tipo.includes('herido')) {
        urgentes++;
      }
    });

    return {
      total: lista.length,
      pendientes,
      enProceso,
      finalizadas,
      urgentes,
      distribucionEstados: distribucion
    };
  }

  /**
   * 2. Casos asignados y sus estados por veterinario
   */
  private procesarCasosPorVeterinario(peticiones: any[], funcionarios: any[]): CasoVeterinario[] {
    // Filtrar veterinarios oficiales (rol 3)
    const vetsMap = new Map<string, CasoVeterinario>();

    funcionarios.forEach((f: any) => {
      const idRol = Number(f.id_rol ?? f.idRol ?? f.rol_id ?? 0);
      const rolNom = String(f.rol ?? f.nombre_rol ?? '').toLowerCase();
      if (idRol === 3 || rolNom.includes('veterinario')) {
        const id = String(f.id_usuario ?? f.id ?? f.identificacion ?? Math.random());
        const nombre = `${f.nombre || f.first_name || 'Dr(a).'} ${f.apellido || f.last_name || ''}`.trim();
        vetsMap.set(id, {
          id_veterinario: id,
          nombre_completo: nombre,
          total_asignados: 0,
          pendientes: 0,
          en_proceso: 0,
          finalizadas: 0,
          porcentaje_completado: 0
        });
      }
    });

    // Registrar peticiones en los veterinarios correspondientes
    peticiones.forEach((p) => {
      const nombreAsig = (p.asignado_a_nombre || p.veterinario_nombre || '').toString().trim();
      const apellidoAsig = (p.asignado_a_apellido || p.veterinario_apellido || '').toString().trim();
      const idAsig = String(p.asignado_a ?? p.id_veterinario ?? '').trim();

      let targetVet: CasoVeterinario | undefined;

      if (idAsig && vetsMap.has(idAsig)) {
        targetVet = vetsMap.get(idAsig);
      } else if (nombreAsig) {
        const full = `${nombreAsig} ${apellidoAsig}`.trim().toLowerCase();
        for (const vet of vetsMap.values()) {
          if (vet.nombre_completo.toLowerCase().includes(nombreAsig.toLowerCase())) {
            targetVet = vet;
            break;
          }
        }
        if (!targetVet) {
          // Crear entrada al vuelo si no estaba en funcionarios
          const nuevoId = idAsig || full;
          targetVet = {
            id_veterinario: nuevoId,
            nombre_completo: `${nombreAsig} ${apellidoAsig}`.trim(),
            total_asignados: 0,
            pendientes: 0,
            en_proceso: 0,
            finalizadas: 0,
            porcentaje_completado: 0
          };
          vetsMap.set(nuevoId, targetVet);
        }
      }

      if (targetVet) {
        targetVet.total_asignados++;
        const eLow = String(p.estado || '').toLowerCase();
        if (eLow.includes('pendiente') || eLow.includes('revis') || eLow.includes('asignad')) {
          targetVet.pendientes++;
        } else if (eLow.includes('proceso') || eLow.includes('curso') || eLow.includes('tratam')) {
          targetVet.en_proceso++;
        } else if (eLow.includes('atendid') || eLow.includes('finaliz') || eLow.includes('cerrad')) {
          targetVet.finalizadas++;
        } else {
          targetVet.pendientes++;
        }
      }
    });

    // Calcular porcentaje de resolución para cada uno
    const resultado = Array.from(vetsMap.values());
    resultado.forEach((v) => {
      v.porcentaje_completado = v.total_asignados > 0 ? Math.round((v.finalizadas / v.total_asignados) * 100) : 0;
    });

    // Ordenar de mayor a menor cantidad de casos asignados
    return resultado.sort((a, b) => b.total_asignados - a.total_asignados);
  }

  /**
   * 3. Total animales ingresados al CBA y sus diferentes estados
   */
  private procesarCBA(consultas: any[], animales: any[], estadosAnimal: any[]): MetricasCBA {
    // Filtrar consultas donde ingresa_cba sea verdadero
    const consultasCBA = consultas.filter((c: any) => {
      const v = c.ingresa_cba;
      return v === true || v === 1 || String(v).toLowerCase() === 'true' || String(v).toUpperCase() === 'SI';
    });

    const distribucion: { [estado: string]: number } = {};
    let enObservacion = 0;
    let enTratamiento = 0;
    let aptosAdopcion = 0;
    let adoptadosOtras = 0;

    // Si hay consultas registradas que ingresaron al CBA:
    if (consultasCBA.length > 0) {
      consultasCBA.forEach((c) => {
        const estadoRaw = String(c.resultado_estado || c.pronostico || 'En Observación').trim();
        const estadoNorm = estadoRaw.charAt(0).toUpperCase() + estadoRaw.slice(1).toLowerCase();
        distribucion[estadoNorm] = (distribucion[estadoNorm] || 0) + 1;

        const eLow = estadoNorm.toLowerCase();
        if (eLow.includes('observaci') || eLow.includes('evalua') || eLow.includes('reservado')) {
          enObservacion++;
        } else if (eLow.includes('tratam') || eLow.includes('hospit') || eLow.includes('grave')) {
          enTratamiento++;
        } else if (eLow.includes('favor') || eLow.includes('recuperad') || eLow.includes('adop')) {
          aptosAdopcion++;
        } else {
          enObservacion++;
        }
      });
    } else {
      // Si la BD de consultas aún no tiene registros de ingresos a CBA,
      // cruzamos con el catálogo de animales y estados
      animales.forEach((a: any) => {
        if (a.disponible_adopcion) {
          aptosAdopcion++;
          distribucion['Apto para Adopción'] = (distribucion['Apto para Adopción'] || 0) + 1;
        } else if (a.activo) {
          enObservacion++;
          distribucion['En Observación Clínica'] = (distribucion['En Observación Clínica'] || 0) + 1;
        } else {
          adoptadosOtras++;
          distribucion['Adoptado / Egresado'] = (distribucion['Adoptado / Egresado'] || 0) + 1;
        }
      });
    }

    // Últimos ingresos ordenados por fecha
    const ultimos = consultasCBA.slice(0, 6).map((c: any) => ({
      id_consulta: c.id_consulta,
      fecha_ingreso: c.fecha_hora || new Date().toISOString(),
      canil: c.canil_asignado || 'Canil General',
      funcionario: c.funcionario_recibe_cba || 'Personal de Turno CBA',
      motivo: c.motivo_ingreso_cba || c.motivo_consulta || 'Ingreso por atención prioritaria',
      estado: c.resultado_estado || c.pronostico || 'En Tratamiento'
    }));

    const totalCBA = consultasCBA.length > 0 ? consultasCBA.length : (enObservacion + enTratamiento + aptosAdopcion);

    return {
      totalIngresadosCBA: totalCBA,
      enObservacion,
      enTratamiento,
      aptosAdopcion,
      adoptadosOtras,
      distribucionEstados: distribucion,
      ultimosIngresos: ultimos
    };
  }
}
