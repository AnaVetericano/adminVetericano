import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RegistroUsuario {
  email: string;
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

export interface ProcedimientoCatalogo {
  id_procedimiento_catalogo?: number;
  nombre_tipo: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl; 
  private apiUrlespecies = environment.apiUrlespecies;

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

  // Métodos para Exámenes Clínicos (Catálogo)
  private getCleanUrl(): string {
    const urlBase = this.apiUrl.endsWith('/') ? this.apiUrl.slice(0, -1) : this.apiUrl;
    return urlBase.replace(/\/usuarios$/, '');
  }

  getCatalogo(): Observable<ProcedimientoCatalogo[]> {
    return this.http.get<ProcedimientoCatalogo[]>(`${this.getCleanUrl()}/examenes-clinicos/catalogo/`);
  }

  crearCatalogo(catalogo: ProcedimientoCatalogo): Observable<ProcedimientoCatalogo> {
    return this.http.post<ProcedimientoCatalogo>(`${this.getCleanUrl()}/examenes-clinicos/catalogo/`, catalogo);
  }
  
  eliminarCatalogo(id: number): Observable<any> {
    return this.http.delete<any>(`${this.getCleanUrl()}/examenes-clinicos/catalogo/${id}/`);
  }

  // Métodos para Especies
  private get baseUrlEspecies(): string {
    const base = (this.apiUrlespecies || '').replace(/\/+$/, '');
    if (base.endsWith('/especies/especies')) {
      return `${base}/`;
    }
    if (base.endsWith('/especies')) {
      return `${base}/especies/`;
    }
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
}