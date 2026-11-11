import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface AdministradorUsuario {
  id_usuario: number;
  email: string;
  identificacion: string | null;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  matricula_profesional?: string | null;
  foto_perfil?: string | null;
  foto?: string | null;
  id_rol: number;
  nombre_rol: string;
  id_sede: number | null;
  nombre_sede: string | null;
  activo: boolean;
}

export interface CrearAdministradorPayload {
  email: string;
  nombre: string;
  apellido?: string | null;
  identificacion?: string | null;
  telefono?: string | null;
  password?: string;
  id_sede?: number | null;
  activo?: boolean;
}

export interface ActualizarAdministradorPayload {
  email?: string;
  nombre?: string;
  apellido?: string | null;
  identificacion?: string | null;
  telefono?: string | null;
  password?: string;
  id_sede?: number | null;
  activo?: boolean;
}

export interface FiltroAdministradores {
  activo?: boolean;
  id_sede?: number | null;
  search?: string;
}

export interface FiltroReportesSuperAdmin {
  fecha?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  estado?: string;
  id_estado?: number | string;
  veterinario?: number | string;
  asignado_a?: number | string;
}

export interface EstadoEstadisticaItem {
  id_estado: number | null;
  estado: string;
  total: number;
}

export interface TipoEstadisticaItem {
  id_tipo: number | null;
  tipo: string;
  total: number;
}

export interface VeterinarioRendimiento {
  id_veterinario: number;
  nombre: string;
  apellido: string;
  nombre_completo: string;
  email: string;
  total_asignadas: number;
  casos_atendidos: number;
  pendientes_atencion: number;
  porcentaje_atencion: number;
}

export interface EstadisticasSuperAdmin {
  total_peticiones: number;
  casos_atendidos: number;
  pendientes: number;
  en_proceso: number;
  finalizadas: number;
  urgentes: number;
  sin_asignar: number;
  con_veterinario_asignado: number;
  porcentaje_atencion: number;
  total_seguimientos_visita: number;
  resumen_peticiones: {
    total_peticiones: number;
    casos_atendidos: number;
    pendientes: number;
    en_proceso: number;
    finalizadas: number;
    urgentes: number;
    sin_asignar: number;
    con_veterinario_asignado: number;
    porcentaje_atencion: number;
  };
  por_estado: EstadoEstadisticaItem[];
  distribucion_estados: Record<string, number>;
  por_tipo: TipoEstadisticaItem[];
  por_prioridad: Record<string, number>;
  por_veterinario: VeterinarioRendimiento[];
  usuarios: {
    total_usuarios: number;
    activos: number;
    inactivos: number;
    por_rol: {
      administrador: number;
      juridico: number;
      veterinario: number;
      peticionario: number;
      super_administrador: number;
    };
  };
  sedes: {
    total_sedes: number;
    activas: number;
    inactivas: number;
  };
  filtros_aplicados: {
    fecha: string | null;
    fecha_desde: string | null;
    fecha_hasta: string | null;
    estado: string | null;
    veterinario: string | null;
  };
}

export interface PeticionAtendidaReporte {
  id_peticion: number;
  numero_radicado?: string;
  radicado?: string;
  fecha?: string;
  fecha_creacion: string;
  tipo?: string;
  tipo_peticion?: number;
  nombre_tipo?: string;
  prioridad?: string;
  asunto?: string;
  descripcion?: string;
  ubicacion_direccion?: string;
  ubicacion?: string;
  ciudad?: string;
  id_estado?: number;
  nombre_estado?: string;
  estado?: string;
  id_usuario?: number;
  nombre_usuario?: string;
  apellido_usuario?: string;
  email_usuario?: string;
  telefono_usuario?: string;
  identificacion_usuario?: string;
  asignado_a?: number | null;
  asignado_a_nombre?: string | null;
  asignado_a_apellido?: string | null;
  nombre_veterinario?: string | null;
  fecha_asignacion?: string | null;
  foto?: string | null;
  fotos?: string[];
  total_fotos?: number;
  seguimientos_visita?: any[];
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class SuperAdminService {
  private readonly apiUrl =
    (environment as any).apiUrlSuperAdmin || `${environment.apiBaseUrl}/super-administrador/`;

  constructor(private http: HttpClient) {}

  /**
   * GET /api/super-administrador/administradores/
   * Lista usuarios con rol Administrador (id_rol = 1).
   * Soporta filtros opcionales: ?activo=true|false, ?id_sede=<id>, ?search=<texto>
   */
  listarAdministradores(filtros?: FiltroAdministradores): Observable<AdministradorUsuario[]> {
    let params = new HttpParams();
    if (filtros) {
      if (filtros.activo !== undefined) {
        params = params.set('activo', String(filtros.activo));
      }
      if (filtros.id_sede !== undefined && filtros.id_sede !== null) {
        params = params.set('id_sede', String(filtros.id_sede));
      }
      if (filtros.search && filtros.search.trim()) {
        params = params.set('search', filtros.search.trim());
      }
    }

    return this.http.get<any>(`${this.apiUrl}administradores/`, { params }).pipe(
      map((res) => {
        const raw = Array.isArray(res) ? res : (res?.results || res?.data || []);
        return raw.map((item: any) => this.normalizarAdministrador(item));
      })
    );
  }

  /**
   * GET /api/super-administrador/administradores/<id>/
   * Obtiene el detalle de un Administrador por su ID.
   */
  obtenerAdministrador(idUsuario: number): Observable<AdministradorUsuario> {
    return this.http.get<any>(`${this.apiUrl}administradores/${idUsuario}/`).pipe(
      map((res) => this.normalizarAdministrador(res))
    );
  }

  /**
   * POST /api/super-administrador/administradores/crear/
   * Crea un nuevo usuario con rol Administrador (id_rol = 1).
   */
  crearAdministrador(payload: CrearAdministradorPayload): Observable<AdministradorUsuario> {
    return this.http.post<any>(`${this.apiUrl}administradores/crear/`, payload).pipe(
      map((res) => this.normalizarAdministrador(res?.datos || res))
    );
  }

  /**
   * PATCH /api/super-administrador/administradores/<id>/
   * Actualiza los datos o sede de un Administrador existente.
   */
  actualizarAdministrador(
    idUsuario: number,
    payload: ActualizarAdministradorPayload
  ): Observable<AdministradorUsuario> {
    return this.http.patch<any>(`${this.apiUrl}administradores/${idUsuario}/`, payload).pipe(
      map((res) => this.normalizarAdministrador(res?.datos || res))
    );
  }

  /**
   * PATCH /api/super-administrador/administradores/<id>/
   * Activa o desactiva un Administrador respetando las reglas de quórum mínimo y anti auto-bloqueo del backend.
   */
  cambiarEstadoAdministrador(idUsuario: number, activo: boolean): Observable<AdministradorUsuario> {
    return this.http.patch<any>(`${this.apiUrl}administradores/${idUsuario}/`, { activo }).pipe(
      map((res) => this.normalizarAdministrador(res?.datos || res))
    );
  }

  /**
   * DELETE /api/super-administrador/administradores/<id>/?desactivar=true
   * Desactivación lógica de un Administrador en el backend.
   */
  desactivarAdministrador(idUsuario: number): Observable<any> {
    const params = new HttpParams().set('desactivar', 'true');
    return this.http.delete<any>(`${this.apiUrl}administradores/${idUsuario}/`, { params });
  }

  /**
   * GET /api/super-administrador/reportes/atendidas/
   * Obtiene el listado real de peticiones/casos atendidos con soporte de filtros.
   */
  obtenerReporteAtendidas(filtros?: FiltroReportesSuperAdmin): Observable<PeticionAtendidaReporte[]> {
    const params = this.construirParamsReportes(filtros);
    return this.http.get<any>(`${this.apiUrl}reportes/atendidas/`, { params }).pipe(
      map((res) => {
        const raw = Array.isArray(res) ? res : (res?.results || res?.data || []);
        return raw.map((item: any) => this.normalizarPeticionAtendida(item));
      })
    );
  }

  /**
   * GET /api/super-administrador/reportes/estadisticas/
   * Obtiene las métricas y estadísticas institucionales en tiempo real desde el backend.
   */
  obtenerEstadisticas(filtros?: FiltroReportesSuperAdmin): Observable<EstadisticasSuperAdmin> {
    const params = this.construirParamsReportes(filtros);
    return this.http.get<EstadisticasSuperAdmin>(`${this.apiUrl}reportes/estadisticas/`, { params });
  }

  private construirParamsReportes(filtros?: FiltroReportesSuperAdmin): HttpParams {
    let params = new HttpParams();
    if (!filtros) return params;

    if (filtros.fecha && filtros.fecha.trim()) {
      params = params.set('fecha', filtros.fecha.trim());
    }
    if (filtros.fecha_desde && filtros.fecha_desde.trim()) {
      params = params.set('fecha_desde', filtros.fecha_desde.trim());
    }
    if (filtros.fecha_hasta && filtros.fecha_hasta.trim()) {
      params = params.set('fecha_hasta', filtros.fecha_hasta.trim());
    }
    if (filtros.estado && filtros.estado.trim()) {
      params = params.set('estado', filtros.estado.trim());
    }
    if (filtros.id_estado !== undefined && filtros.id_estado !== null && String(filtros.id_estado).trim() !== '') {
      params = params.set('id_estado', String(filtros.id_estado).trim());
    }
    if (filtros.veterinario !== undefined && filtros.veterinario !== null && String(filtros.veterinario).trim() !== '') {
      params = params.set('veterinario', String(filtros.veterinario).trim());
    }
    if (filtros.asignado_a !== undefined && filtros.asignado_a !== null && String(filtros.asignado_a).trim() !== '') {
      params = params.set('asignado_a', String(filtros.asignado_a).trim());
    }
    return params;
  }

  private normalizarPeticionAtendida(item: any): PeticionAtendidaReporte {
    const vetNombreCompleto = `${item?.asignado_a_nombre || ''} ${item?.asignado_a_apellido || ''}`.trim();
    return {
      ...item,
      id_peticion: Number(item?.id_peticion ?? item?.id ?? 0),
      numero_radicado: item?.numero_radicado || item?.radicado || `#${item?.id_peticion ?? ''}`,
      radicado: item?.numero_radicado || item?.radicado || `#${item?.id_peticion ?? ''}`,
      fecha: item?.fecha || item?.fecha_creacion || '',
      fecha_creacion: item?.fecha || item?.fecha_creacion || '',
      tipo: item?.tipo || item?.nombre_tipo || 'General',
      nombre_tipo: item?.tipo || item?.nombre_tipo || 'General',
      estado: item?.estado || item?.nombre_estado || 'Atendida',
      nombre_estado: item?.estado || item?.nombre_estado || 'Atendida',
      prioridad: item?.prioridad || 'Normal',
      descripcion: item?.descripcion || item?.asunto || '',
      asunto: item?.asunto || item?.tipo || item?.descripcion || 'Caso de bienestar animal',
      ubicacion_direccion: item?.ubicacion_direccion || item?.ubicacion || '',
      ubicacion: item?.ubicacion_direccion || item?.ubicacion || '',
      nombre_veterinario: vetNombreCompleto || item?.nombre_veterinario || null
    };
  }

  private normalizarAdministrador(item: any): AdministradorUsuario {
    return {
      id_usuario: Number(item?.id_usuario ?? item?.id ?? 0),
      email: item?.email || '',
      identificacion: item?.identificacion ?? null,
      nombre: item?.nombre || '',
      apellido: item?.apellido ?? '',
      telefono: item?.telefono ?? '',
      matricula_profesional: item?.matricula_profesional ?? null,
      foto_perfil: item?.foto_perfil ?? null,
      foto: item?.foto ?? item?.foto_perfil ?? null,
      id_rol: Number(item?.id_rol ?? 1),
      nombre_rol: item?.nombre_rol || 'Administrador',
      id_sede: item?.id_sede !== undefined && item?.id_sede !== null ? Number(item.id_sede) : null,
      nombre_sede: item?.nombre_sede ?? null,
      activo: item?.activo !== undefined ? Boolean(item.activo) : true
    };
  }
}

