import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RegistroUsuario {
  nombre: string;
  apellido:string;
  email: string;
  password: string;
  confirmarPassword: string;
}

export interface RespuestaRegistro {
  mensaje?: string;
  usuario?: any;
  token?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  

  private apiUrl = 'http://127.0.0.1:8000/api';

  constructor(private http: HttpClient) {}

  registrar(usuario: RegistroUsuario): Observable<RespuestaRegistro> {

    return this.http.post<RespuestaRegistro>(
      `${this.apiUrl}/registro/`,
      usuario
    );
  }
}