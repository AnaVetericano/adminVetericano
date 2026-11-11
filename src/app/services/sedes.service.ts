import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, tap } from 'rxjs/operators';
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
  // Endpoint real del backend Django REST Framework (/api/sedes/)
  private readonly apiUrl = (environment as any).apiUrlSedes || 'http://127.0.0.1:8000/api/sedes/';

  // Caché en memoria de la última respuesta real del backend para validación síncrona de duplicados en UI
  private sedesCache: Sede[] = [];

  constructor(private http: HttpClient) {}

  /**
   * Normaliza un objeto de sede del backend para garantizar compatibilidad con id/id_sede e is_active/activo
   */
  public normalizarSede(item: any): Sede {
    const id = Number(item.id_sede ?? item.id ?? item.pk ?? 0);
    const activo = item.activo !== undefined
      ? Boolean(item.activo)
      : (item.is_active !== undefined
        ? Boolean(item.is_active)
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
      fecha_creacion: item.fecha_creacion || item.created_at || ''
    };
  }

  /**
   * GET /api/sedes/
   * Consulta el listado real de sedes desde la base de datos del backend.
   * Soporta filtro opcional ?activo=true|false.
   */
  listarSedes(activo?: boolean): Observable<Sede[]> {
    let params = new HttpParams();
    if (activo !== undefined) {
      params = params.set('activo', String(activo));
    }

    return this.http.get<any>(this.apiUrl, { params }).pipe(
      map((res) => {
        const rawList = Array.isArray(res) ? res : (res?.results || res?.data || []);
        return rawList.map((item: any) => this.normalizarSede(item));
      }),
      tap((normalizadas) => {
        if (activo === undefined) {
          this.sedesCache = [...normalizadas];
        }
      })
    );
  }

  /**
   * GET /api/sedes/{id}/
   * Obtiene el detalle de una sede por ID desde el backend real.
   */
  obtenerSede(idSede: number): Observable<Sede> {
    const url = `${this.apiUrl}${idSede}/`;
    return this.http.get<any>(url).pipe(
      map((res) => this.normalizarSede(res))
    );
  }

  /**
   * PATCH /api/sedes/{id}/
   * Actualiza exclusivamente el estado de activación ({ activo: boolean }) en el backend real.
   */
  cambiarEstadoSede(idSede: number, nuevoEstado: boolean): Observable<Sede> {
    const payload = {
      activo: nuevoEstado
    };

    const url = `${this.apiUrl}${idSede}/`;

    return this.http.patch<any>(url, payload).pipe(
      map((res) => {
        const sedeActualizada = this.normalizarSede(res);
        const index = this.sedesCache.findIndex((s) => s.id_sede === idSede || s.id === idSede);
        if (index !== -1) {
          this.sedesCache[index] = sedeActualizada;
        }
        return sedeActualizada;
      })
    );
  }

  /**
   * Valida si ya existe una sede con el mismo nombre en la lista cargada desde el backend
   */
  validarNombreDuplicado(nombre: string, idExcluir?: number): boolean {
    const normalizar = (str: string) =>
      (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    const nombreNorm = normalizar(nombre);
    if (!nombreNorm) return false;

    return this.sedesCache.some((s) => {
      if (idExcluir && (s.id_sede === idExcluir || s.id === idExcluir)) return false;
      return normalizar(s.nombre) === nombreNorm;
    });
  }

  /**
   * POST /api/sedes/
   * Registra una nueva sede persistente en el backend con estado activo por defecto.
   */
  crearSede(nuevaSede: Omit<Sede, 'id_sede'>): Observable<Sede> {
    if (this.validarNombreDuplicado(nuevaSede.nombre)) {
      return throwError(() => new Error(`Ya existe una sede registrada con el nombre "${nuevaSede.nombre}".`));
    }

    const sedePayload: Record<string, any> = {
      nombre: (nuevaSede.nombre || '').trim(),
      direccion: (nuevaSede.direccion || '').trim(),
      ciudad: (nuevaSede.ciudad || '').trim(),
      telefono: (nuevaSede.telefono || '').trim(),
      activo: nuevaSede.activo !== undefined ? Boolean(nuevaSede.activo) : true
    };

    if (nuevaSede.codigo && nuevaSede.codigo.trim()) {
      sedePayload['codigo'] = nuevaSede.codigo.trim().toUpperCase();
    }

    return this.http.post<any>(this.apiUrl, sedePayload).pipe(
      map((res) => {
        const sedeCreada = this.normalizarSede(res);
        this.sedesCache = [sedeCreada, ...this.sedesCache];
        return sedeCreada;
      })
    );
  }

  /**
   * PATCH /api/sedes/{id}/
   * Actualiza el estado de una sede existente en el backend real.
   */
  actualizarSede(idSede: number, datos: Partial<Sede>): Observable<Sede> {
    const url = `${this.apiUrl}${idSede}/`;
    const payload: Record<string, any> = {};
    if (datos.activo !== undefined) {
      payload['activo'] = Boolean(datos.activo);
    } else if (datos.is_active !== undefined) {
      payload['activo'] = Boolean(datos.is_active);
    }

    return this.http.patch<any>(url, payload).pipe(
      map((res) => {
        const sedeActualizada = this.normalizarSede(res);
        const index = this.sedesCache.findIndex((s) => s.id_sede === idSede || s.id === idSede);
        if (index !== -1) {
          this.sedesCache[index] = sedeActualizada;
        }
        return sedeActualizada;
      })
    );
  }
}
