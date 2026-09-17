import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

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
  id_rol?: number;
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

  constructor(private http: HttpClient) {}

  registrar(usuario: RegistroUsuario): Observable<RespuestaRegistro> {
    return this.http.post<RespuestaRegistro>(`${this.apiUrl}/register/`, usuario);
  }

  login(credenciales: CredencialesLogin): Observable<RespuestaLogin> {
    return this.http.post<RespuestaLogin>(`${this.apiUrl}/login/`, credenciales);
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

  listarEventosVoluntariado() {
    return this.http.get<EventoVoluntariado[]>(`${this.baseUrlVoluntariado}/eventos/`);
  }

  listarPostulacionesVoluntariado() {
    return this.http.get<PostulacionVoluntariado[]>(`${this.baseUrlVoluntariado}/postulaciones/`);
  }

  crearPostulacionVoluntariado(postulacion: PostulacionVoluntariado) {
    return this.http.post(`${this.baseUrlVoluntariado}/postulaciones/`, postulacion);
  }

  actualizarPostulacionVoluntariado(id: number, postulacion: PostulacionVoluntariado) {
    return this.http.put(`${this.baseUrlVoluntariado}/postulaciones/${id}/`, postulacion);
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
}