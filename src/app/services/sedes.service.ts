import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Sede {
  id_sede: number;
  id?: number;
  nombre: string;
  direccion: string;
  ciudad: string;
  telefono: string;
  activo: boolean;
  is_active?: boolean;
  codigo?: string;
  total_usuarios?: number;
  fecha_creacion?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SedesService {
  private readonly STORAGE_KEY = 'vetericano_sedes_db';
  
  // Endpoint local primario especificado por el backend (Django / DRF)
  private readonly apiUrlLocal = (environment as any).apiUrlSedes || 'http://127.0.0.1:8000/api/sedes/';
  
  // Endpoint cloud de respaldo en Railway
  private readonly apiUrlCloud = `${environment.apiBaseUrl}/sedes/`;

  // URL activa inicial
  private apiUrl = this.apiUrlLocal;

  // Semilla de sedes oficiales para garantizar continuidad operativa
  private sedesIniciales: Sede[] = [
    {
      id_sede: 1,
      id: 1,
      codigo: 'CBA-MED-01',
      nombre: 'Sede Principal CBA Medellín',
      direccion: 'Carrera 50 # 12-40, Barrio San Fernando',
      ciudad: 'Medellín',
      telefono: '(604) 444-5555',
      activo: true,
      is_active: true,
      total_usuarios: 14,
      fecha_creacion: '2025-01-15T08:00:00Z'
    },
    {
      id_sede: 2,
      id: 2,
      codigo: 'REF-BEL-02',
      nombre: 'Sede Norte - Refugio Regional Bello',
      direccion: 'Calle 104 # 45-20, Zona Industrial',
      ciudad: 'Bello',
      telefono: '(604) 275-8899',
      activo: true,
      is_active: true,
      total_usuarios: 8,
      fecha_creacion: '2025-02-10T10:30:00Z'
    },
    {
      id_sede: 3,
      id: 3,
      codigo: 'CLI-RIO-03',
      nombre: 'Sede Oriente - Clínica Veterinaria Rionegro',
      direccion: 'Vía Aeropuerto Km 7, Sector Llanogrande',
      ciudad: 'Rionegro',
      telefono: '(604) 561-2300',
      activo: true,
      is_active: true,
      total_usuarios: 6,
      fecha_creacion: '2025-03-01T14:15:00Z'
    },
    {
      id_sede: 4,
      id: 4,
      codigo: 'CBA-ENV-04',
      nombre: 'Sede Sur - Centro de Bienestar Animal Envigado',
      direccion: 'Carrera 43A # 60 Sur-25, Sector Las Vegas',
      ciudad: 'Envigado',
      telefono: '(604) 339-4000',
      activo: false,
      is_active: false,
      total_usuarios: 3,
      fecha_creacion: '2025-03-20T09:00:00Z'
    }
  ];

  constructor(private http: HttpClient) {
    this.inicializarAlmacenamiento();
  }

  /**
   * Inicializa datos en localStorage si no existen
   */
  private inicializarAlmacenamiento(): void {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.sedesIniciales));
      }
    } catch (e) {
      console.warn('No se pudo acceder a localStorage para inicializar sedes:', e);
    }
  }

  /**
   * Normaliza un objeto de sede del backend para garantizar compatibilidad con id/id_sede e is_active/activo
   */
  public normalizarSede(item: any): Sede {
    const id = Number(item.id_sede ?? item.id ?? item.pk ?? 0);
    const activo = item.is_active !== undefined
      ? Boolean(item.is_active)
      : (item.activo !== undefined
        ? Boolean(item.activo)
        : (typeof item.estado === 'string' ? item.estado.toLowerCase().includes('activ') : true));

    return {
      id_sede: id,
      id: id,
      nombre: item.nombre || item.nombre_sede || `Sede #${id}`,
      direccion: item.direccion || '',
      ciudad: item.ciudad || item.municipio || '',
      telefono: item.telefono || item.celular || '',
      activo: activo,
      is_active: activo,
      codigo: item.codigo || item.codigo_sede || `SEDE-${String(id).padStart(2, '0')}`,
      total_usuarios: Number(item.total_usuarios ?? item.usuarios_count ?? 0),
      fecha_creacion: item.fecha_creacion || item.created_at || new Date().toISOString()
    };
  }

  /**
   * Obtiene la lista desde almacenamiento local de respaldo
   */
  private obtenerSedesLocales(): Sede[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => this.normalizarSede(item));
        }
      }
    } catch {}
    return [...this.sedesIniciales];
  }

  /**
   * Guarda la lista de sedes en almacenamiento local
   */
  private guardarSedesLocales(sedes: Sede[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sedes));
    } catch (e) {
      console.warn('Error al persistir sedes en localStorage:', e);
    }
  }

  /**
   * GET /api/sedes/
   * Consulta el listado completo de sedes
   * Realiza petición al endpoint local http://127.0.0.1:8000/api/sedes/, con fallback a Railway / localStorage
   */
  listarSedes(): Observable<Sede[]> {
    return this.http.get<any>(this.apiUrl).pipe(
      catchError((errLocal) => {
        // Si el backend local no está corriendo (status 0), intentar con el backend cloud en Railway
        if (errLocal.status === 0 && this.apiUrlCloud) {
          return this.http.get<any>(this.apiUrlCloud).pipe(
            catchError(() => of(null))
          );
        }
        return of(null);
      }),
      map((res) => {
        const rawList = Array.isArray(res) ? res : (res?.results || res?.data || []);
        if (rawList.length > 0) {
          const normalizadas = rawList.map((item: any) => this.normalizarSede(item));
          this.guardarSedesLocales(normalizadas);
          return normalizadas;
        }
        return this.obtenerSedesLocales();
      }),
      catchError(() => of(this.obtenerSedesLocales()))
    );
  }

  /**
   * PATCH / PUT http://127.0.0.1:8000/api/sedes/{id}/
   * Actualiza el estado de activación (Activo / Inactivo) consumiendo el endpoint backend
   * Envía tanto is_active como activo y estado para compatibilidad total con serializers de Django REST Framework
   */
  cambiarEstadoSede(idSede: number, nuevoEstado: boolean): Observable<Sede> {
    const payload = {
      is_active: nuevoEstado,
      activo: nuevoEstado,
      estado: nuevoEstado ? 'Activo' : 'Inactivo'
    };

    const urlLocal = `${this.apiUrlLocal}${idSede}/`;
    const urlCloud = `${this.apiUrlCloud}${idSede}/`;

    // Intentamos PATCH primero
    return this.http.patch<any>(urlLocal, payload).pipe(
      catchError((patchErr) => {
        // Si el servidor local responde 405 (Method Not Allowed), intentar con PUT
        if (patchErr.status === 405) {
          return this.http.put<any>(urlLocal, payload);
        }

        // Si el servidor local no está disponible (status 0), intentar con la nube en Railway
        if (patchErr.status === 0) {
          return this.http.patch<any>(urlCloud, payload).pipe(
            catchError((cloudErr) => {
              if (cloudErr.status === 405) {
                return this.http.put<any>(urlCloud, payload);
              }
              // Si ambos están offline (status 0), aplicar en local
              if (cloudErr.status === 0) {
                return of(null);
              }
              return throwError(() => cloudErr);
            })
          );
        }

        // Si es un error real del backend (400, 401, 403, 404, 500), propagarlo
        return throwError(() => patchErr);
      }),
      map((res) => {
        const sedes = this.obtenerSedesLocales();
        const index = sedes.findIndex((s) => s.id_sede === idSede || s.id === idSede);

        let sedeActualizada: Sede;
        if (res) {
          sedeActualizada = this.normalizarSede(res);
          // Aseguramos que el estado refleje el valor confirmado
          sedeActualizada.activo = nuevoEstado;
          sedeActualizada.is_active = nuevoEstado;
        } else if (index !== -1) {
          sedeActualizada = {
            ...sedes[index],
            activo: nuevoEstado,
            is_active: nuevoEstado
          };
        } else {
          sedeActualizada = {
            id_sede: idSede,
            id: idSede,
            nombre: `Sede #${idSede}`,
            direccion: '',
            ciudad: '',
            telefono: '',
            activo: nuevoEstado,
            is_active: nuevoEstado
          };
        }

        if (index !== -1) {
          sedes[index] = { ...sedes[index], ...sedeActualizada };
        } else {
          sedes.push(sedeActualizada);
        }

        this.guardarSedesLocales(sedes);
        return sedeActualizada;
      })
    );
  }

  /**
   * Valida si ya existe una sede con el mismo nombre o código (insensible a mayúsculas y acentos)
   */
  validarNombreDuplicado(nombre: string, idExcluir?: number): boolean {
    const normalizar = (str: string) =>
      (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    const nombreNorm = normalizar(nombre);
    if (!nombreNorm) return false;

    const sedes = this.obtenerSedesLocales();
    return sedes.some((s) => {
      if (idExcluir && (s.id_sede === idExcluir || s.id === idExcluir)) return false;
      return normalizar(s.nombre) === nombreNorm;
    });
  }

  /**
   * POST /api/sedes/
   * Registra una nueva sede en el sistema con estado inicial ACTIVO
   */
  crearSede(nuevaSede: Omit<Sede, 'id_sede'>): Observable<Sede> {
    if (this.validarNombreDuplicado(nuevaSede.nombre)) {
      return throwError(() => new Error(`Ya existe una sede registrada con el nombre "${nuevaSede.nombre}".`));
    }

    const sedes = this.obtenerSedesLocales();
    const nuevoId = sedes.length > 0 ? Math.max(...sedes.map((s) => s.id_sede || s.id || 0)) + 1 : 1;

    const inicialesCiudad = (nuevaSede.ciudad || 'CBA').slice(0, 3).toUpperCase();
    const codigoSede = nuevaSede.codigo || `SEDE-${inicialesCiudad}-${String(nuevoId).padStart(2, '0')}`;

    const sedePayload: any = {
      ...nuevaSede,
      codigo: codigoSede,
      activo: true,
      is_active: true,
      estado: 'Activo'
    };

    return this.http.post<any>(this.apiUrl, sedePayload).pipe(
      catchError((errLocal) => {
        if (errLocal.status === 0 && this.apiUrlCloud) {
          return this.http.post<any>(this.apiUrlCloud, sedePayload).pipe(
            catchError(() => of(null))
          );
        }
        if (errLocal.status === 0) {
          return of(null);
        }
        return throwError(() => errLocal);
      }),
      map((res) => {
        let sedeCreada: Sede;
        if (res) {
          sedeCreada = this.normalizarSede(res);
        } else {
          sedeCreada = {
            ...nuevaSede,
            id_sede: nuevoId,
            id: nuevoId,
            codigo: codigoSede,
            activo: true,
            is_active: true,
            total_usuarios: 0,
            fecha_creacion: new Date().toISOString()
          };
        }
        sedes.unshift(sedeCreada);
        this.guardarSedesLocales(sedes);
        return sedeCreada;
      })
    );
  }

  /**
   * PATCH / PUT /api/sedes/{id}/
   * Actualiza datos de una sede existente
   */
  actualizarSede(idSede: number, datos: Partial<Sede>): Observable<Sede> {
    if (datos.nombre && this.validarNombreDuplicado(datos.nombre, idSede)) {
      return throwError(() => new Error(`Ya existe otra sede registrada con el nombre "${datos.nombre}".`));
    }

    const sedes = this.obtenerSedesLocales();
    const index = sedes.findIndex((s) => s.id_sede === idSede || s.id === idSede);

    if (index === -1) {
      return throwError(() => new Error('La sede especificada no fue encontrada.'));
    }

    const urlLocal = `${this.apiUrlLocal}${idSede}/`;

    return this.http.patch<any>(urlLocal, datos).pipe(
      catchError((patchErr) => {
        if (patchErr.status === 405) {
          return this.http.put<any>(urlLocal, datos);
        }
        if (patchErr.status === 0) {
          return of(null);
        }
        return throwError(() => patchErr);
      }),
      map((res) => {
        const sedeActualizada = res ? this.normalizarSede(res) : { ...sedes[index], ...datos, id_sede: idSede };
        sedes[index] = sedeActualizada;
        this.guardarSedesLocales(sedes);
        return sedeActualizada;
      })
    );
  }
}
