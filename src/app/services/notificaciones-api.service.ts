import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ContadorNotificacionesResponse,
  FiltrosNotificaciones,
  ListadoNotificacionesResponse,
  MarcarTodasLeidasResponse,
  NotificacionItem
} from '../models/notificaciones';

/**
 * Cliente REST para los endpoints centrales de notificaciones (§6 del contrato v1).
 * Excluye los endpoints de dispositivos FCM (exclusivos de Android).
 */
@Injectable({
  providedIn: 'root'
})
export class NotificacionesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${(environment.apiBaseUrl || `${environment.backendUrl}/api`).replace(/\/+$/, '')}/notificaciones`;

  listar(filtros?: FiltrosNotificaciones): Observable<ListadoNotificacionesResponse> {
    let params = new HttpParams();

    if (filtros?.solo_no_leidas !== undefined) {
      params = params.set('solo_no_leidas', String(filtros.solo_no_leidas));
    }
    if (filtros?.modulo) {
      params = params.set('modulo', filtros.modulo);
    }
    if (filtros?.limit !== undefined) {
      const limit = Math.min(Math.max(1, Math.trunc(filtros.limit)), 200);
      params = params.set('limit', String(limit));
    }
    if (filtros?.offset !== undefined) {
      const offset = Math.max(0, Math.trunc(filtros.offset));
      params = params.set('offset', String(offset));
    }

    return this.http.get<ListadoNotificacionesResponse>(`${this.baseUrl}/`, { params });
  }

  contador(): Observable<ContadorNotificacionesResponse> {
    return this.http.get<ContadorNotificacionesResponse>(`${this.baseUrl}/contador/`);
  }

  marcarLeida(clave: string): Observable<NotificacionItem> {
    return this.http.patch<NotificacionItem>(
      `${this.baseUrl}/${encodeURIComponent(clave)}/leer/`,
      {}
    );
  }

  marcarTodasLeidas(modulo?: string | null): Observable<MarcarTodasLeidasResponse> {
    let params = new HttpParams();
    if (modulo) {
      params = params.set('modulo', modulo);
    }
    return this.http.patch<MarcarTodasLeidasResponse>(
      `${this.baseUrl}/leer-todas/`,
      {},
      { params }
    );
  }
}
