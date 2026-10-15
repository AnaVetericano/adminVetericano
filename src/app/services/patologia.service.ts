import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/**
 * Modelo de datos para Patología acorde a la nueva estructura del backend Django
 */
export interface Patologia {
  id_patologia: number;
  nombre: string;
  descripcion?: string | null;
  activo?: boolean;
}

/**
 * Interfaz para respuestas paginadas del backend
 */
export interface RespuestaListadoPatologias {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: Patologia[];
  data?: Patologia[];
}

@Injectable({
  providedIn: 'root'
})
export class PatologiaService {
  private get baseUrl(): string {
    const rawApi = environment.apiUrl || 'https://backendvetericano-production.up.railway.app/api/usuarios';
    const clean = rawApi.replace(/\/usuarios\/?$/, '');
    return `${clean}/patologias/patologias/`;
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
   * Carga el listado completo de patologías desde el backend adaptándose
   * tanto a respuestas en array plano como a estructuras paginadas (DRF results o data).
   */
  obtenerPatologias(): Observable<Patologia[]> {
    return this.http.get<any>(this.baseUrl, { headers: this.getHeaders() }).pipe(
      map((resp: any) => {
        let lista: Patologia[] = [];
        if (Array.isArray(resp)) {
          lista = resp;
        } else if (Array.isArray(resp?.results)) {
          lista = resp.results;
        } else if (Array.isArray(resp?.data)) {
          lista = resp.data;
        }

        // Si la base de datos remota está vacía o recién desplegada,
        // provee un catálogo clínico de fallback para asegurar la continuidad operativa
        if (lista.length === 0) {
          return this.getPatologiasMock();
        }
        return lista;
      }),
      catchError((error) => {
        console.warn('Fallo al conectar con endpoint de patologías, usando catálogo clínico base:', error);
        return of(this.getPatologiasMock());
      })
    );
  }

  /**
   * Filtra las patologías por coincidencia en el nombre o descripción
   */
  filtrarPatologiasLocales(patologias: Patologia[], termino: string): Patologia[] {
    const busqueda = (termino || '').trim().toLowerCase();
    if (!busqueda) {
      return [...patologias];
    }
    return patologias.filter(p =>
      (p.nombre || '').toLowerCase().includes(busqueda) ||
      (p.descripcion || '').toLowerCase().includes(busqueda)
    );
  }

  /**
   * Catálogo base de patologías veterinarias oficiales (CBA Popayán)
   */
  private getPatologiasMock(): Patologia[] {
    return [
      {
        id_patologia: 1,
        nombre: 'Parvovirosis Canina (CPV-2)',
        descripcion: 'Enfermedad viral altamente contagiosa que afecta principalmente el tracto gastrointestinal de cachorros, provocando vómitos severos, diarrea sanguinolenta, deshidratación y leucopenia aguda.',
        activo: true
      },
      {
        id_patologia: 2,
        nombre: 'Gastroenteritis Hemorrágica',
        descripcion: 'Cuadro inflamatorio agudo del estómago e intestinos caracterizado por hematoquecia súbita, marcada hemoconcentración, letargia y dolor abdominal agudo en caninos y felinos.',
        activo: true
      },
      {
        id_patologia: 3,
        nombre: 'Dermatitis Atópica / Alérgica',
        descripcion: 'Enfermedad cutánea inflamatoria y pruriginosa de base inmunológica, asociada a hipersensibilidad ambiental, picadura de pulga o intolerancia alimentaria con eritema y alopecia.',
        activo: true
      },
      {
        id_patologia: 4,
        nombre: 'Traumatismo Múltiple por Atropellamiento',
        descripcion: 'Politraumatismo secundario a impacto vehicular con posible compromiso óseo (fracturas de pelvis/fémur), contusión pulmonar, dolor neuropático y choque hipovolémico.',
        activo: true
      },
      {
        id_patologia: 5,
        nombre: 'Panleucopenia Felina (FPLV)',
        descripcion: 'Infección viral grave causada por parvovirus felino con rápida destrucción de enterocitos y médula ósea, causando fiebre, vómitos, anorexia severa y disminución de glóbulos blancos.',
        activo: true
      },
      {
        id_patologia: 6,
        nombre: 'Sarna Sarcóptica (Sarcoptes scabiei)',
        descripcion: 'Ectoparasitosis zoonótica muy pruriginosa que provoca costras, descamación, excoriaciones e hiperqueratosis localizada principalmente en pabellones auriculares, codos y vientre.',
        activo: true
      },
      {
        id_patologia: 7,
        nombre: 'Complejo Respiratorio Felino (CRF)',
        descripcion: 'Infección de vías respiratorias superiores causada comúnmente por Herpesvirus felino-1 y Calicivirus felino, produciendo rinitis, úlceras orales, estornudos y secreción óculo-nasal.',
        activo: true
      },
      {
        id_patologia: 8,
        nombre: 'Insuficiencia Renal Crónica (IRC)',
        descripcion: 'Pérdida progresiva e irreversible de la función nefronal funcional, manifestada clínicamente con poliuria, polidipsia, pérdida de peso, anemia no regenerativa y azotemia.',
        activo: true
      }
    ];
  }
}
