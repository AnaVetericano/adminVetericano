import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RegistroUsuario {
  username: string;
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  telefono: string;
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
  // Ajusta esta URL según tu endpoint real de Django para el registro
  private apiUrl = 'https://backendvetericano.onrender.com/api/usuarios';

  constructor(private http: HttpClient) {}

  registrar(usuario: RegistroUsuario): Observable<RespuestaRegistro> {
    return this.http.post<RespuestaRegistro>(
      `${this.apiUrl}/registro/`,
      usuario
    );
  }
}