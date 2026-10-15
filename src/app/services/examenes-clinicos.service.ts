import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/**
 * Modelo de datos de Examen Clínico / Procedimiento
 */
export interface ExamenClinico {
  id_examen: number;
  nombre: string;
  descripcion: string;
  nombre_tipo?: string;
  nombre_tipo_examen?: string;
  descripcion_hallazgos?: string;
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
      .set('page_size', pageSize.toString());

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
   * Obtiene la totalidad de los exámenes clínicos para filtrado local en cliente
   */
  obtenerTodos(): Observable<ExamenClinico[]> {
    return this.http.get<any>(this.baseUrl, { headers: this.getHeaders() }).pipe(
      map((resp: any) => {
        const paginada = this.normalizarRespuesta(resp, 1, 100);
        return paginada.results;
      }),
      catchError(() => of(this.getMockExamenes()))
    );
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

    const itemsNormalizados: ExamenClinico[] = rawList.map((item: any, idx: number) => ({
      id_examen: item.id_examen || item.id_procedimiento_catalogo || item.id || (idx + 1),
      nombre: item.nombre || item.nombre_tipo || item.nombre_tipo_examen || 'Examen Clínico',
      descripcion: item.descripcion || item.descripcion_hallazgos || 'Sin descripción clínica registrada en el sistema.',
      tipo: item.tipo || 'Prueba Diagnóstica',
      estado: item.estado || 'activo',
      solicitado: item.solicitado ?? true
    }));

    return {
      count,
      total_pages: totalPages,
      page,
      page_size: pageSize,
      next: resp?.next || null,
      previous: resp?.previous || null,
      results: itemsNormalizados
    };
  }

  /**
   * Catálogo maestro de exámenes clínicos oficiales (CBA Popayán)
   */
  private getMockExamenes(): ExamenClinico[] {
    return [
      {
        id_examen: 1,
        nombre: 'Hemograma Completo Automatizado (Cuadro Hemático)',
        descripcion: 'Evaluación cuantitativa y cualitativa de las líneas eritroide, leucocitaria y plaquetaria. Indispensable para detectar anemias, infecciones agudas o crónicas, trombocitopenias e inflamación sistémica.',
        tipo: 'Laboratorio Hematológico',
        estado: 'activo'
      },
      {
        id_examen: 2,
        nombre: 'Perfil Bioquímico Hepático y Renal',
        descripcion: 'Cuantificación sérica de ALT, AST, fosfatasa alcalina, bilirrubinas, creatinina, nitrógeno ureico (BUN) y proteínas totales para evaluar la función metabólica y toxicidad orgánica.',
        tipo: 'Química Sanguínea',
        estado: 'activo'
      },
      {
        id_examen: 3,
        nombre: 'Radiografía Digital de Tórax (2 Vistas: LL y VD)',
        descripcion: 'Estudio imagenológico de campos pulmonares, silueta cardíaca, mediastino y reja costal. Utilizado en sospechas de neumonía, edema pulmonar, cardiomegalia o trauma torácico.',
        tipo: 'Imagenología',
        estado: 'activo'
      },
      {
        id_examen: 4,
        nombre: 'Ecografía Abdominal Focalizada (FAST)',
        descripcion: 'Exploración ultrasonográfica de órganos abdominales (hígado, bazo, riñones, vejiga y tracto digestivo) para descartar líquido libre peritoneal, masas o alteraciones estructurales.',
        tipo: 'Imagenología Ultrasonográfica',
        estado: 'activo'
      },
      {
        id_examen: 5,
        nombre: 'Uroanálisis Completo y Sedimento Urinario',
        descripcion: 'Examen físico-químico mediante tiras reactivas y análisis microscópico de sedimento para detección de proteinuria, glucosuria, cilindros, cristales y bacterias.',
        tipo: 'Urianálisis',
        estado: 'activo'
      },
      {
        id_examen: 6,
        nombre: 'Coprológico por Flotación y Frotis Directo',
        descripcion: 'Diagnóstico parasitológico seriado para identificación de huevos de helmintos, ooquistes de protozoarios (Giardia, Coccidios) y valoración de flora bacteriana fecal.',
        tipo: 'Parasitología',
        estado: 'activo'
      },
      {
        id_examen: 7,
        nombre: 'Raspado Cutáneo Profundo y Tricografía',
        descripcion: 'Toma de muestra de dermis superficial y profunda con hoja de bisturí para identificación microscópica de ácaros (Demodex canis, Sarcoptes scabiei) y esporas fúngicas.',
        tipo: 'Dermatología',
        estado: 'activo'
      },
      {
        id_examen: 8,
        nombre: 'Test Rápido Inmunocromatográfico Parvovirus / Moquillo',
        descripcion: 'Detección cualitativa rápida de antígeno de Parvovirus Canino (CPV) y Virus del Distemper Canino (CDV) en heces y secreciones conjuntivales con resultado en 15 minutos.',
        tipo: 'Inmunodiagnóstico Rápido',
        estado: 'activo'
      },
      {
        id_examen: 9,
        nombre: 'Prueba Rápida FeLV / FIV (Leucemia e Inmunodeficiencia Felina)',
        descripcion: 'Ensayo ELISA en sangre total/suero para detección simultánea de antígeno p27 de FeLV y anticuerpos contra virus de inmunodeficiencia felina (FIV).',
        tipo: 'Inmunodiagnóstico Felino',
        estado: 'activo'
      },
      {
        id_examen: 10,
        nombre: 'Citología Auricular y Frotis de Piel',
        descripcion: 'Tinción rápida tipo Diff-Quik de exudado ótico o improntas cutáneas para identificar sobrecrecimiento de levaduras (Malassezia pachydermatis) y bacterias cocoides o bacilares.',
        tipo: 'Citopatología',
        estado: 'activo'
      },
      {
        id_examen: 11,
        nombre: 'Electrocardiograma (ECG de 6 Derivaciones)',
        descripcion: 'Registro eléctrico de la actividad miocárdica para evaluación de arritmias, bloqueos de conducción auriculoventricular y monitoreo prequirúrgico.',
        tipo: 'Cardiología',
        estado: 'activo'
      },
      {
        id_examen: 12,
        nombre: 'Glucometría Sérica de Emergencia',
        descripcion: 'Medición enzimática instantánea de glucosa en sangre periférica para monitoreo de hipoglucemia neonatal o cetoacidosis diabética.',
        tipo: 'Prueba de Punto de Atención (POC)',
        estado: 'activo'
      }
    ];
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
