import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export type UserRole = 'Administrador' | 'Veterinario' | 'Jurídico' | 'Peticionario' | string;

export interface UserSession {
  email: string;
  nombre?: string;
  apellido?: string;
  identificacion?: string;
  id_rol?: number;
  rol: UserRole;
  [key: string]: any;
}

export interface RegistroUsuario {
  email: string;
  identificacion?: string;
  password: string;
  nombre: string;
  apellido: string;
}

export interface InactivarUsuario {
  activo: boolean;
}

export interface RespuestaRegistro {
  mensaje?: string;
  usuario?: any;
  token?: string;
}

export interface CredencialesLogin {
  email: string;
  password: string;
}

export interface RespuestaLogin {
  tokens?: {
    access: string;
    refresh: string;
  };
  email?: string;
  identificacion?: string;
  nombre?: string;
  apellido?: string;
  id_rol?: number;
  rol?: string;
  nombre_rol?: string;
  usuario?: any;
  [key: string]: any;
}

export interface ConfirmarPasswordPayload {
  email: string;
  codigo: string;
  nueva_password: string;
}

export interface Especie {
  id_especie?: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
}

export interface CrearEspecie {
  nombre: string;
  descripcion: string;
  activo: boolean;
}

export interface ActualizarEspecie {
  nombre: string;
  descripcion: string;
  activo: boolean;
}

export interface CambiarEstadoEspecie {
  activo: boolean;
}

export interface RespuestaEspecie {
  id_especie: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
}

export interface Patologia {
  id_patologia?: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
}

export interface CrearPatologia {
  nombre: string;
  descripcion: string;
  activo: boolean;
}

export interface ActualizarPatologia {
  nombre: string;
  descripcion: string;
  activo: boolean;
}

export interface RespuestaPatologia {
  id_patologia: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
}

export interface ProcedimientoCatalogo {
  id_procedimiento_catalogo?: number;
  id_examen?: number;
  id_consulta?: any;
  nombre_tipo?: string;
  tipo?: string;
  descripcion?: string;
  observaciones?: string;
  estado?: string;
  solicitado?: boolean;
}

export interface UsersActives {
  activo: boolean;
  id_rol: number;
}

export interface EventoVoluntariado {
  id?: number;
  titulo: string;
  descripcion: string;
  imagen: string;
  fecha: string;
}

export interface PostulacionVoluntariado {
  id?: number;
  evento: number | null;
  correo: string;
  identificacion: string;
  nombre_completo: string;
  edad: number;
  telefono: string;
  fecha_postulacion?: string;
}

export interface CrearMedicamento {
  nombre: string;
  descripcion?: string;
  activo: boolean;
}

export interface ActualizarMedicamento {
  nombre: string;
  descripcion?: string;
  activo: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private apiUrlespecies = environment.apiUrlespecies;
  private apiUrlMedicamentos = environment.apiUrlMedicamentos;

  // Estado reactivo con Angular Signals
  private currentUserSignal = signal<UserSession | null>(this.obtenerSesionInicial());

  // Señales públicas de solo lectura
  public currentUser = this.currentUserSignal.asReadonly();
  public isAuthenticated = computed(() => !!this.currentUserSignal() || !!localStorage.getItem('token'));
  public userRole = computed(() => this.currentUserSignal()?.rol ?? this.obtenerRolDesdeToken());
  public isAdmin = computed(() => {
    const rol = (this.userRole() || '').toLowerCase();
    return !rol || rol.includes('admin');
  });
  public isVeterinario = computed(() => {
    const rol = (this.userRole() || '').toLowerCase();
    return rol.includes('vet');
  });

  constructor(private http: HttpClient) {}

  /**
   * Extrae el payload en base64 de un token JWT
   */
  private extraerPayloadToken(token: string | null): any {
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }

  /**
   * Obtiene el rol directamente decodificando el token JWT si no está en la señal
   */
  private obtenerRolDesdeToken(): UserRole {
    const token = localStorage.getItem('token');
    if (!token) return 'Administrador';
    const payload = this.extraerPayloadToken(token);
    if (!payload) return 'Administrador';
    const rolRaw = payload.rol ?? payload.nombre_rol ?? payload.role ?? payload.id_rol ?? (payload.is_superuser ? 1 : 2);
    return this.normalizarRol(rolRaw);
  }

  /**
   * Normaliza cualquier formato de rol (números, strings en mayúscula/minúscula)
   */
  public normalizarRol(rolRaw: any): UserRole {
    if (rolRaw === undefined || rolRaw === null || rolRaw === '') {
      return 'Administrador';
    }

    const str = String(rolRaw).toLowerCase().trim();
    if (str.includes('vet')) return 'Veterinario';
    if (str.includes('jur')) return 'Jurídico';
    if (str.includes('petic')) return 'Peticionario';
    if (str.includes('admin')) return 'Administrador';

    const idNum = Number(rolRaw);
    if (!isNaN(idNum)) {
      if (idNum === 1) return 'Administrador';
      if (idNum === 2 || idNum === 3) return 'Veterinario';
      if (idNum === 4) return 'Peticionario';
    }

    return 'Administrador';
  }

  /**
   * Obtiene la sesión guardada previamente en localStorage o la reconstruye desde el JWT
   */
  private obtenerSesionInicial(): UserSession | null {
    const token = localStorage.getItem('token');
    if (!token) return null;

    const sesionStr = localStorage.getItem('user_session');
    if (sesionStr) {
      try {
        const sesion = JSON.parse(sesionStr) as UserSession;
        if (sesion && sesion.rol) {
          sesion.rol = this.normalizarRol(sesion.rol);
          return sesion;
        }
      } catch {}
    }

    // Si hay token pero no user_session, recuperar desde el token
    const payload = this.extraerPayloadToken(token);
    const rolFinal = this.obtenerRolDesdeToken();
    const sesion: UserSession = {
      email: payload?.email || payload?.username || 'usuario@vetericano.com',
      nombre: payload?.nombre || payload?.first_name || '',
      apellido: payload?.apellido || payload?.last_name || '',
      identificacion: payload?.identificacion || '',
      id_rol: payload?.id_rol ? Number(payload.id_rol) : (rolFinal === 'Veterinario' ? 2 : 1),
      rol: rolFinal
    };
    try {
      localStorage.setItem('user_session', JSON.stringify(sesion));
    } catch {}
    return sesion;
  }

  /**
   * Verifica si el usuario actual tiene alguno de los roles permitidos (insensible a mayúsculas)
   */
  hasRole(allowedRoles: UserRole[]): boolean {
    const rolActual = (this.userRole() || '').toLowerCase().trim();
    if (!rolActual) return true; // Si no está especificado, permitir por defecto
    return allowedRoles.some((r) => {
      const rLower = String(r).toLowerCase().trim();
      return rLower === rolActual || rolActual.includes(rLower) || rLower.includes(rolActual);
    });
  }

  /**
   * Limpia toda la sesión activa
   */
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_session');
    this.currentUserSignal.set(null);
  }

  registrar(usuario: RegistroUsuario): Observable<RespuestaRegistro> {
    return this.http.post<RespuestaRegistro>(`${this.apiUrl}/register/`, usuario);
  }

  login(credenciales: CredencialesLogin): Observable<RespuestaLogin> {
    return this.http.post<RespuestaLogin>(`${this.apiUrl}/login/`, credenciales).pipe(
      tap((res) => {
        const token = res.tokens?.access || res['access'] || res['token'];
        const refreshToken = res.tokens?.refresh || res['refresh'] || res['refresh_token'];

        if (token) {
          localStorage.setItem('token', token);
        }
        if (refreshToken) {
          localStorage.setItem('refresh_token', refreshToken);
        }

        const decoded = this.extraerPayloadToken(token);

        const idRolRaw =
          res.id_rol ??
          res['idRol'] ??
          res.usuario?.id_rol ??
          res['user']?.id_rol ??
          decoded?.id_rol;

        const rolTextoRaw =
          res.rol ??
          res.nombre_rol ??
          res['nombreRol'] ??
          res.usuario?.nombre_rol ??
          res.usuario?.rol ??
          res['user']?.rol ??
          decoded?.rol ??
          decoded?.nombre_rol ??
          decoded?.role ??
          (decoded?.is_superuser ? 'Administrador' : undefined);

        const rolFinal = this.normalizarRol(rolTextoRaw ?? idRolRaw);

        const sessionData: UserSession = {
          email: res.email || res.usuario?.email || res['user']?.email || decoded?.email || credenciales.email,
          nombre: res.nombre || res.usuario?.nombre || res['user']?.nombre || decoded?.nombre || '',
          apellido: res.apellido || res.usuario?.apellido || res['user']?.apellido || decoded?.apellido || '',
          identificacion: res.identificacion || res.usuario?.identificacion || decoded?.identificacion || '',
          id_rol: idRolRaw ? Number(idRolRaw) : (rolFinal === 'Veterinario' ? 2 : 1),
          rol: rolFinal
        };

        localStorage.setItem('user_session', JSON.stringify(sessionData));
        this.currentUserSignal.set(sessionData);
      })
    );
  }

  solicitarRecuperacion(email: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/recuperar-password/`, { email });
  }

  confirmarPassword(payload: ConfirmarPasswordPayload): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/confirmar-password/`, payload);
  }

  listarRoles(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/roles/`);
  }

  inactivarUsuario(id_usuario: number, activo: boolean = false): Observable<any> {
    const urlBase = this.apiUrl.endsWith('/') ? this.apiUrl.slice(0, -1) : this.apiUrl;
    return this.http.patch<any>(`${urlBase}/usuarios/${id_usuario}/`, { activo });
  }

  private getCleanUrl(): string {
    const urlBase = this.apiUrl.endsWith('/') ? this.apiUrl.slice(0, -1) : this.apiUrl;
    return urlBase.replace(/\/usuarios$/, '');
  }

  getCatalogo(): Observable<ProcedimientoCatalogo[]> {
    return this.http.get<ProcedimientoCatalogo[]>(`${this.getCleanUrl()}/examenes-clinicos/examenes/`);
  }

  crearCatalogo(catalogo: ProcedimientoCatalogo): Observable<ProcedimientoCatalogo> {
    return this.http.post<ProcedimientoCatalogo>(`${this.getCleanUrl()}/examenes-clinicos/examenes/`, catalogo);
  }

  actualizarCatalogo(id: number, catalogo: ProcedimientoCatalogo): Observable<ProcedimientoCatalogo> {
    return this.http.patch<ProcedimientoCatalogo>(`${this.getCleanUrl()}/examenes-clinicos/examenes/${id}/`, catalogo);
  }

  eliminarCatalogo(id: number): Observable<any> {
    return this.http.delete<any>(`${this.getCleanUrl()}/examenes-clinicos/examenes/${id}/`);
  }

  private get baseUrlEspecies(): string {
    const base = (this.apiUrlespecies || '').replace(/\/+$/, '');
    if (base.endsWith('/especies/especies')) return `${base}/`;
    if (base.endsWith('/especies')) return `${base}/especies/`;
    return `${base}/especies/especies/`;
  }

  listarEspecies(): Observable<any> {
    return this.http.get<any>(this.baseUrlEspecies);
  }

  crearEspecie(especie: CrearEspecie): Observable<RespuestaEspecie> {
    return this.http.post<RespuestaEspecie>(this.baseUrlEspecies, especie);
  }

  actualizarEspecie(id_especie: number, especie: ActualizarEspecie): Observable<RespuestaEspecie> {
    return this.http.put<RespuestaEspecie>(`${this.baseUrlEspecies}${id_especie}/`, especie);
  }

  cambiarEstadoEspecie(id_especie: number, activo: boolean): Observable<RespuestaEspecie> {
    return this.http.patch<RespuestaEspecie>(`${this.baseUrlEspecies}${id_especie}/`, { activo });
  }

  private get baseUrlPatologias(): string {
    return `${this.getCleanUrl()}/patologias/patologias/`;
  }

  listarPatologias(): Observable<Patologia[]> {
    return this.http.get<Patologia[]>(this.baseUrlPatologias);
  }

  crearPatologia(patologia: CrearPatologia): Observable<RespuestaPatologia> {
    return this.http.post<RespuestaPatologia>(this.baseUrlPatologias, patologia);
  }

  actualizarPatologia(id_patologia: number, patologia: ActualizarPatologia): Observable<RespuestaPatologia> {
    return this.http.put<RespuestaPatologia>(`${this.baseUrlPatologias}${id_patologia}/`, patologia);
  }

  cambiarEstadoPatologia(id_patologia: number, activo: boolean): Observable<RespuestaPatologia> {
    return this.http.patch<RespuestaPatologia>(`${this.baseUrlPatologias}${id_patologia}/`, { activo });
  }

  listUsersActive() {
    return this.http.get<any>(`${this.apiUrl}/usuarios`).pipe(
      map(usuarios => usuarios.map((u: any) => ({
        activo: u.activo,
        id_rol: u.id_rol
      })))
    );
  }

  private get baseUrlVoluntariado(): string {
    return `${this.getCleanUrl()}/voluntariado`;
  }

  listarEventosVoluntariado(): Observable<EventoVoluntariado[]> {
    return this.http.get<EventoVoluntariado[]>(
      `${this.baseUrlVoluntariado}/eventos/`
    );
  }

  crearEventoVoluntariado(eventoData: FormData): Observable<EventoVoluntariado> {
    return this.http.post<EventoVoluntariado>(
      `${this.baseUrlVoluntariado}/eventos/`,
      eventoData
    );
  }

  actualizarEventoVoluntariado(id: number, eventoData: FormData): Observable<EventoVoluntariado> {
    return this.http.patch<EventoVoluntariado>(
      `${this.baseUrlVoluntariado}/eventos/${id}/`,
      eventoData
    );
  }

  eliminarEventoVoluntariado(id: number): Observable<any> {
    return this.http.delete<any>(
      `${this.baseUrlVoluntariado}/eventos/${id}/`
    );
  }

  // AnaC
  listarPostulacionesVoluntariado(idEvento?: number): Observable<PostulacionVoluntariado[]> {
    if (idEvento) {
      return this.http.get<PostulacionVoluntariado[]>(`${this.baseUrlVoluntariado}/postulaciones/?evento=${idEvento}`);
    }
    return this.http.get<PostulacionVoluntariado[]>(`${this.baseUrlVoluntariado}/postulaciones/`);
  }
  // AnaC

  crearPostulacionVoluntariado(postulacion: PostulacionVoluntariado) {
    return this.http.post(`${this.baseUrlVoluntariado}/postulaciones/`, postulacion);
  }

  actualizarPostulacionVoluntariado(id: number, postulacion: PostulacionVoluntariado) {
    return this.http.put(`${this.baseUrlVoluntariado}/postulaciones/${id}/`, postulacion);
  }
  listarSeguimientos(): Observable<any> {

  const token = localStorage.getItem('token');

  const headers = {
    Authorization: `Bearer ${token}`
  };

  return this.http.get<any>(
    'https://backendvetericano-production.up.railway.app/api/peticiones/seguimiento/listar/',
    { headers }
  );
}

  eliminarPostulacionVoluntariado(id: number) {
    return this.http.delete(`${this.baseUrlVoluntariado}/postulaciones/${id}/`);
  }

  listarMedicamentos(): Observable<any> {
    return this.http.get<any>(this.apiUrlMedicamentos);
  }

  crearMedicamento(medicamento: CrearMedicamento): Observable<any> {
    return this.http.post<any>(this.apiUrlMedicamentos, medicamento);
  }

  actualizarMedicamento(id: any, medicamento: ActualizarMedicamento): Observable<any> {
    const idReal = typeof id === 'object' ? (id.id_medicamento || id.id) : id;
    return this.http.put<any>(`${this.apiUrlMedicamentos}${idReal}/`, medicamento);
  }

  cambiarEstadoMedicamento(id: any, activo: boolean): Observable<any> {
    const idReal = typeof id === 'object' ? (id.id_medicamento || id.id) : id;
    return this.http.patch<any>(`${this.apiUrlMedicamentos}${idReal}/`, { activo });
  }

  // AnaC 
  private apiUrlPeticiones = 'https://backendvetericano-production.up.railway.app/api/peticiones/listar/';

  obtenerPeticiones(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrlPeticiones);
  }
  // AnaC

  // Inventario y Compras
  listarCompras(): Observable<any> {
    return this.http.get<any>(`${this.getCleanUrl()}/inventario/compras/`);
  }

  crearCompra(payload: { id_proveedor: number }): Observable<any> {
    return this.http.post<any>(`${this.getCleanUrl()}/inventario/compras/`, payload);
  }

  eliminarCompra(id: number): Observable<any> {
    return this.http.delete<any>(`${this.getCleanUrl()}/inventario/compras/${id}/`);
  }

  listarDetallesCompra(): Observable<any> {
    return this.http.get<any>(`${this.getCleanUrl()}/inventario/detalles-compra/`);
  }

  crearDetalleCompra(payload: any): Observable<any> {
    return this.http.post<any>(`${this.getCleanUrl()}/inventario/detalles-compra/`, payload);
  }

  eliminarDetalleCompra(id: number): Observable<any> {
    return this.http.delete<any>(`${this.getCleanUrl()}/inventario/detalles-compra/${id}/`);
  }

  listarProveedoresInventario(): Observable<any> {
    return this.http.get<any>(`${this.getCleanUrl()}/inventario/proveedores/`);
  }
}