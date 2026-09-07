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
export interface InactivarUsuario{
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




@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  registrar(usuario: RegistroUsuario): Observable<RespuestaRegistro> {
    return this.http.post<RespuestaRegistro>(
      `${this.apiUrl}/register/`,
      usuario
    );
  }

  login(credenciales: CredencialesLogin): Observable<RespuestaLogin> {
    return this.http.post<RespuestaLogin>(
      `${this.apiUrl}/login/`,
      credenciales
    );
  }

  solicitarRecuperacion(email: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/recuperar-password/`,
      { email }
    );
  }

  confirmarPassword(payload: ConfirmarPasswordPayload): Observable<any> {   
    return this.http.post<any>(
      `${this.apiUrl}/confirmar-password/`,
      payload
    );
  }

  listarRoles(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/roles/`);
  }


  inactivarUsuario(id_usuario: number, activo: boolean = false): Observable<any> {
    const urlBase = this.apiUrl.endsWith('/') ? this.apiUrl.slice(0, -1) : this.apiUrl;
    return this.http.patch<any>(
      `${urlBase}/usuarios/${id_usuario}/`,
      { activo }
    );
  }

}