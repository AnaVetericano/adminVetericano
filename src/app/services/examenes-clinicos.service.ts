import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/**
 * Modelo de datos de Examen Clínico / Procedimiento
 */
export interface ExamenClinico {
  id_examen: number;
  id_procedimiento_catalogo?: number;
  nombre: string;
  descripcion: string;
  nombre_tipo?: string;
  nombre_tipo_examen?: string;
  descripcion_hallazgos?: string;
  ruta_archivo_resultado?: string;
  resultado?: string;
  tipo?: string;
  estado?: string;
  solicitado?: boolean;
}

/**
 * Metadata de paginación devuelta por el backend Django REST Framework
 */
export interface MetadataPaginacion {
  count: number;
  total_pages?: number;
  page?: number;
  page_size?: number;
  next?: string | null;
  previous?: string | null;
}

/**
 * Estructura de respuesta paginada del catálogo
 */
export interface RespuestaPaginadaExamenes {
  count: number;
  total_pages?: number;
  page?: number;
  page_size?: number;
  next?: string | null;
  previous?: string | null;
  results: ExamenClinico[];
}

export const CATALOGO_CANONICO_EXAMENES: Array<{
  nombre: string;
  tipo: string;
  descripcion: string;
  es_test: boolean;
}> = [
  // 14 Exámenes Clínicos oficiales (alineados con knowledge_base.py / Supabase)
  { nombre: 'Cuadro Hemático', tipo: 'Laboratorio Hematológico', descripcion: 'Hemograma completo automatizado, serie roja, blanca y recuento plaquetario.', es_test: false },
  { nombre: 'Química Sanguínea', tipo: 'Química Sanguínea', descripcion: 'Perfil hepático, renal, electrolitos y glucosa sérica.', es_test: false },
  { nombre: 'Parcial de Orina', tipo: 'Urianálisis', descripcion: 'Análisis físico, químico y microscópico del sedimento urinario.', es_test: false },
  { nombre: 'Coprológico', tipo: 'Parasitología', descripcion: 'Diagnóstico parasitológico por flotación y frotis fecal directo.', es_test: false },
  { nombre: 'Coproscópico', tipo: 'Parasitología', descripcion: 'Estudio microscópico y funcional detallado de muestras fecales.', es_test: false },
  { nombre: 'Frotis (raspado piel)', tipo: 'Dermatología', descripcion: 'Raspado cutáneo profundo y superficial para ácaros, bacterias y hongos.', es_test: false },
  { nombre: 'Cultivos', tipo: 'Microbiología', descripcion: 'Aislamiento e identificación de microorganismos en muestras clínicas.', es_test: false },
  { nombre: 'Antibiograma', tipo: 'Microbiología', descripcion: 'Prueba de sensibilidad bacteriana frente a distintos antibióticos.', es_test: false },
  { nombre: 'Biopsia', tipo: 'Citopatología', descripcion: 'Toma y análisis histopatológico de tejido para diagnóstico.', es_test: false },
  { nombre: 'Rayos X', tipo: 'Imagenología', descripcion: 'Radiografía digital ortogonal (tórax, abdomen, columna o miembros).', es_test: false },
  { nombre: 'Ecografía', tipo: 'Imagenología Ultrasonográfica', descripcion: 'Ultrasonografía abdominal completa o ecofast para fluidos y órganos.', es_test: false },
  { nombre: 'ECG', tipo: 'Cardiología', descripcion: 'Electrocardiograma de 6 derivaciones para ritmo y actividad cardíaca.', es_test: false },
  { nombre: 'EEG', tipo: 'Neurología', descripcion: 'Registro eléctrico cerebral para evaluar trastornos neurológicos.', es_test: false },
  { nombre: 'Endoscopia', tipo: 'Endoscopia', descripcion: 'Exploración visual directa endoscópica digestiva o respiratoria.', es_test: false },
  // 6 Tests Rápidos oficiales
  { nombre: 'Test Parvovirus', tipo: 'Inmunodiagnóstico Rápido', descripcion: 'Inmunocromatografía rápida para detección de antígeno de Parvovirus (CPV).', es_test: true },
  { nombre: 'Test de Distemper (Moquillo)', tipo: 'Inmunodiagnóstico Rápido', descripcion: 'Detección rápida de antígeno del Virus del Distemper Canino (CDV).', es_test: true },
  { nombre: 'Test de Leucemia (Felinos)', tipo: 'Inmunodiagnóstico Felino', descripcion: 'Ensayo rápido para antígeno p27 del Virus de Leucemia Felina (FeLV).', es_test: true },
  { nombre: 'Test de Sida (Felinos)', tipo: 'Inmunodiagnóstico Felino', descripcion: 'Ensayo rápido para anticuerpos del Virus de Inmunodeficiencia Felina (FIV).', es_test: true },
  { nombre: 'Test Coronavirus', tipo: 'Inmunodiagnóstico Rápido', descripcion: 'Detección rápida cualitativa de Coronavirus entérico / FCoV.', es_test: true },
  { nombre: 'Test Rápido Inmunocromatográfico Parvovirus / Moquillo', tipo: 'Inmunodiagnóstico Rápido', descripcion: 'Detección cualitativa rápida combinada de antígeno de Parvovirus Canino (CPV) y Distemper Canino (CDV).', es_test: true }
];

@Injectable({
  providedIn: 'root'
})
export class ExamenesClinicosService {
  private get baseUrl(): string {
    const rawApi = environment.apiUrl || 'https://backendvetericano-production.up.railway.app/api/usuarios';
    const clean = rawApi.replace(/\/usuarios\/?$/, '');
    return `${clean}/examenes-clinicos/examenes/`;
  }

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  /**
   * Criterio 1: Carga los exámenes clínicos adaptándose a la metadata de paginación del backend
   */
  obtenerExamenes(page: number = 1, pageSize: number = 8, busqueda: string = ''): Observable<RespuestaPaginadaExamenes> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString())
      .set('solo_catalogo', 'true');

    if (busqueda && busqueda.trim()) {
      params = params.set('search', busqueda.trim());
    }

    return this.http.get<any>(this.baseUrl, { headers: this.getHeaders(), params }).pipe(
      map((resp: any) => {
        return this.normalizarRespuesta(resp, page, pageSize, busqueda);
      }),
      catchError((error) => {
        console.warn('Conexión con endpoint de exámenes clínicos no disponible, usando catálogo clínico base:', error);
        return of(this.getMockExamenesPaginados(page, pageSize, busqueda));
      })
    );
  }

  /**
   * Obtiene la totalidad de los exámenes clínicos del catálogo para filtrado local en cliente
   */
  obtenerTodos(): Observable<ExamenClinico[]> {
    const params = new HttpParams().set('solo_catalogo', 'true');
    return this.http.get<any>(this.baseUrl, { headers: this.getHeaders(), params }).pipe(
      map((resp: any) => {
        const paginada = this.normalizarRespuesta(resp, 1, 200);
        return paginada.results;
      }),
      catchError(() => of(this.getMockExamenes()))
    );
  }

  private readonly storageKeyTipos = 'vetericano_examenes_tipos_map';

  /**
   * Guarda localmente y sincroniza el tipo de examen para respaldo inmediato en el cliente
   */
  guardarTipoLocal(id: number | null | undefined, nombre: string | null | undefined, tipo: string): void {
    if (typeof localStorage === 'undefined' || !tipo) return;
    try {
      const raw = localStorage.getItem(this.storageKeyTipos);
      const mapa: Record<string, string> = raw ? JSON.parse(raw) : {};
      const tipoLimpio = tipo.trim();
      if (id) {
        mapa[`id:${id}`] = tipoLimpio;
      }
      if (nombre && nombre.trim()) {
        mapa[`nombre:${nombre.trim().toLowerCase()}`] = tipoLimpio;
      }
      localStorage.setItem(this.storageKeyTipos, JSON.stringify(mapa));
    } catch {
      // Ignorar errores de almacenamiento local
    }
  }

  private obtenerTipoLocal(id: number | null | undefined, nombre: string | null | undefined): string | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(this.storageKeyTipos);
      if (!raw) return null;
      const mapa: Record<string, string> = JSON.parse(raw);
      if (id && mapa[`id:${id}`]) {
        return mapa[`id:${id}`];
      }
      if (nombre && nombre.trim()) {
        const keyNombre = `nombre:${nombre.trim().toLowerCase()}`;
        if (mapa[keyNombre]) {
          return mapa[keyNombre];
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  private esTipoValidoDesdeCampoAuxiliar(valor: any): boolean {
    if (!valor || typeof valor !== 'string') return false;
    const limpio = valor.trim();
    if (!limpio || limpio.length > 80) return false;
    if (limpio.includes('/') || limpio.includes('\\') || /^https?:/i.test(limpio)) return false;
    return true;
  }

  /**
   * Crea un nuevo examen clínico en el catálogo del backend
   */
  crearExamen(payload: Partial<ExamenClinico>): Observable<any> {
    const tipoLimpio = (payload.tipo || 'Prueba Diagnóstica').trim();
    const nombreLimpio = (payload.nombre || payload.nombre_tipo || payload.nombre_tipo_examen || '').trim();
    const body = {
      ...payload,
      tipo: tipoLimpio,
      ruta_archivo_resultado: tipoLimpio
    };
    this.guardarTipoLocal(null, nombreLimpio, tipoLimpio);
    return this.http.post<any>(this.baseUrl, body, { headers: this.getHeaders() }).pipe(
      tap((res: any) => {
        const nuevoId = res?.id_examen || res?.id_procedimiento_catalogo || res?.id;
        this.guardarTipoLocal(nuevoId, nombreLimpio, tipoLimpio);
      })
    );
  }

  /**
   * Actualiza un examen clínico existente en el catálogo del backend
   */
  actualizarExamen(id: number, payload: Partial<ExamenClinico>): Observable<any> {
    const tipoLimpio = (payload.tipo || 'Prueba Diagnóstica').trim();
    const nombreLimpio = (payload.nombre || payload.nombre_tipo || payload.nombre_tipo_examen || '').trim();
    const body = {
      ...payload,
      tipo: tipoLimpio,
      ruta_archivo_resultado: tipoLimpio
    };
    this.guardarTipoLocal(id, nombreLimpio, tipoLimpio);
    return this.http.patch<any>(`${this.baseUrl}${id}/`, body, { headers: this.getHeaders() }).pipe(
      tap(() => {
        this.guardarTipoLocal(id, nombreLimpio, tipoLimpio);
      })
    );
  }

  /**
   * Cambia el estado (activo / inactivo) de un examen clínico
   */
  cambiarEstadoExamen(id: number, estado: 'activo' | 'inactivo', itemActual?: Partial<ExamenClinico>): Observable<any> {
    const tipoConservar = (
      itemActual?.tipo ||
      this.obtenerTipoLocal(id, itemActual?.nombre || itemActual?.nombre_tipo) ||
      'Prueba Diagnóstica'
    ).trim();
    const payload = {
      ...(itemActual || {}),
      id_examen: id,
      id_procedimiento_catalogo: id,
      tipo: tipoConservar,
      ruta_archivo_resultado: tipoConservar,
      estado
    };
    return this.http.patch<any>(`${this.baseUrl}${id}/`, payload, { headers: this.getHeaders() });
  }

  /**
   * Carga masiva de exámenes clínicos al backend
   */
  importarExamenesMasivo(examenes: Partial<ExamenClinico>[]): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}carga-masiva/`, examenes, { headers: this.getHeaders() });
  }

  /**
   * Normaliza la respuesta según la estructura recibida del backend (results paginados o array plano)
   */
  private normalizarRespuesta(resp: any, page: number, pageSize: number, busqueda: string = ''): RespuestaPaginadaExamenes {
    let rawList: any[] = [];
    let count = 0;
    let totalPages = 1;

    if (Array.isArray(resp)) {
      rawList = resp;
      count = resp.length;
      totalPages = Math.ceil(count / pageSize) || 1;
    } else if (resp && typeof resp === 'object') {
      if (Array.isArray(resp.results)) {
        rawList = resp.results;
        count = typeof resp.count === 'number' ? resp.count : rawList.length;
        totalPages = typeof resp.total_pages === 'number'
          ? resp.total_pages
          : (Math.ceil(count / pageSize) || 1);
      } else if (Array.isArray(resp.data)) {
        rawList = resp.data;
        count = typeof resp.total === 'number' ? resp.total : rawList.length;
        totalPages = typeof resp.total_pages === 'number'
          ? resp.total_pages
          : (Math.ceil(count / pageSize) || 1);
      }
    }

    // Si el backend no tiene registros guardados, asegura el catálogo base
    if (rawList.length === 0 && count === 0 && !busqueda) {
      return this.getMockExamenesPaginados(page, pageSize, busqueda);
    }

    const itemsNormalizados: ExamenClinico[] = rawList.map((item: any, idx: number) => {
      const id = item.id_examen || item.id_procedimiento_catalogo || item.id || (idx + 1);
      const nombre = item.nombre || item.nombre_tipo || item.nombre_tipo_examen || 'Examen Clínico';
      const descripcion = item.descripcion || item.descripcion_hallazgos || 'Sin descripción clínica registrada en el sistema.';

      const tipoAuxiliar = this.esTipoValidoDesdeCampoAuxiliar(item.ruta_archivo_resultado)
        ? String(item.ruta_archivo_resultado).trim()
        : null;
      const tipoDirecto = (item.tipo && String(item.tipo).trim()) || tipoAuxiliar;
      const tipoLocal = this.obtenerTipoLocal(id, nombre);
      const tipoResuelto = tipoDirecto || tipoLocal || 'Prueba Diagnóstica';

      if (tipoDirecto) {
        this.guardarTipoLocal(id, nombre, tipoDirecto);
      }

      return {
        id_examen: id,
        id_procedimiento_catalogo: id,
        nombre,
        nombre_tipo: nombre,
        nombre_tipo_examen: nombre,
        descripcion,
        descripcion_hallazgos: descripcion,
        ruta_archivo_resultado: tipoResuelto,
        tipo: tipoResuelto,
        estado: item.estado ? String(item.estado).toLowerCase().trim() : 'activo',
        solicitado: item.solicitado ?? true
      };
    });

    let resultadosFinales = itemsNormalizados;
    if (Array.isArray(resp)) {
      const term = (busqueda || '').trim().toLowerCase();
      if (term) {
        resultadosFinales = itemsNormalizados.filter((e) =>
          (e.nombre || '').toLowerCase().includes(term) ||
          (e.descripcion || '').toLowerCase().includes(term) ||
          (e.tipo || '').toLowerCase().includes(term)
        );
      }
      count = resultadosFinales.length;
      totalPages = Math.ceil(count / pageSize) || 1;
      const start = Math.max(0, (page - 1) * pageSize);
      resultadosFinales = resultadosFinales.slice(start, start + pageSize);
    }

    return {
      count,
      total_pages: totalPages,
      page,
      page_size: pageSize,
      next: resp?.next || null,
      previous: resp?.previous || null,
      results: resultadosFinales
    };
  }

  /**
   * Catálogo maestro de exámenes clínicos oficiales (alineado con Supabase / knowledge_base)
   */
  private getMockExamenes(): ExamenClinico[] {
    return CATALOGO_CANONICO_EXAMENES.map((item, index) => ({
      id_examen: index + 1,
      nombre: item.nombre,
      nombre_tipo: item.nombre,
      nombre_tipo_examen: item.nombre,
      descripcion: item.descripcion,
      tipo: item.tipo,
      estado: 'activo'
    }));
  }

  private getMockExamenesPaginados(page: number, pageSize: number, busqueda: string = ''): RespuestaPaginadaExamenes {
    let mock = this.getMockExamenes();
    if (busqueda && busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      mock = mock.filter(m =>
        m.nombre.toLowerCase().includes(q) ||
        m.descripcion.toLowerCase().includes(q)
      );
    }
    const count = mock.length;
    const totalPages = Math.ceil(count / pageSize) || 1;
    const start = (page - 1) * pageSize;
    const results = mock.slice(start, start + pageSize);

    return {
      count,
      total_pages: totalPages,
      page,
      page_size: pageSize,
      next: page < totalPages ? `?page=${page + 1}` : null,
      previous: page > 1 ? `?page=${page - 1}` : null,
      results
    };
  }
}
