import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';
import {
  CodigoErrorTriaje,
  DecisionTriajePayload,
  DecisionTriajeResponse,
  ErrorTriajeApi,
  EstadoConsultaTriaje,
  ReintentoTriajeResponse,
  TriajePeticionDetalle
} from '../models/triaje.model';

@Injectable({
  providedIn: 'root'
})
export class TriajeIaService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private readonly baseTriajeUrl = `${environment.apiBaseUrl.replace(/\/+$/, '')}/triaje-ia`;
  private readonly basePeticionesUrl = environment.apiUrlPeticiones.replace(/\/+$/, '');

  /**
   * Exclusivo para Administrador (id_rol = 1) y Jurídico (id_rol = 2).
   * Bloquea Veterinario (3), Peticionario (4) y Super Administrador (5).
   */
  puedeConsultarTriaje(): boolean {
    if (!this.authService.isAuthenticated()) {
      return false;
    }
    if (this.authService.isSuperAdmin() || this.authService.isVeterinario()) {
      return false;
    }
    const sesion = this.authService.currentUser();
    const idRol = Number(sesion?.id_rol);
    if (!Number.isNaN(idRol) && idRol > 0) {
      return idRol === 1 || idRol === 2;
    }
    const rolTexto = String(this.authService.userRole() || '').toLowerCase();
    if (rolTexto.includes('peticionario')) {
      return false;
    }
    return this.authService.isAdmin() || this.authService.isJuridico();
  }

  /**
   * GET /api/triaje-ia/peticiones/<id_peticion>/
   * Retorna `existe_triaje: false` de forma controlada cuando la denuncia aún no tiene registro de triaje (404).
   */
  obtenerTriajePeticion(idPeticion: number): Observable<EstadoConsultaTriaje> {
    const errorAcceso = this.validarAcceso();
    if (errorAcceso) {
      return throwError(() => errorAcceso);
    }
    if (!Number.isInteger(idPeticion) || idPeticion <= 0) {
      return throwError(() => ({
        status: 400,
        codigo: 'VALIDATION_ERROR' as const,
        mensaje: 'Identificador de petición inválido para consultar el triaje.'
      }));
    }

    const url = `${this.baseTriajeUrl}/peticiones/${idPeticion}/`;
    return this.http.get<TriajePeticionDetalle>(url).pipe(
      map((resp) => {
        if (!resp || typeof resp !== 'object' || Array.isArray(resp) || !('id_triaje' in resp)) {
          return {
            existe_triaje: false,
            automatizacion_activa: false,
            triaje: null
          };
        }
        return {
          existe_triaje: true,
          automatizacion_activa: Boolean(resp.automatizacion_activa),
          triaje: this.normalizarTriaje(resp)
        };
      }),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 404) {
          const body = err.error && typeof err.error === 'object' ? err.error : {};
          return of({
            existe_triaje: false,
            automatizacion_activa: Boolean(body.automatizacion_activa),
            triaje: null
          });
        }
        return throwError(() => this.normalizarErrorHttp(err));
      })
    );
  }

  /**
   * POST /api/triaje-ia/peticiones/<id_peticion>/reintentar/
   */
  reintentarTriajePeticion(idPeticion: number, forzar: boolean = false): Observable<ReintentoTriajeResponse> {
    const errorAcceso = this.validarAcceso();
    if (errorAcceso) {
      return throwError(() => errorAcceso);
    }

    const url = `${this.baseTriajeUrl}/peticiones/${idPeticion}/reintentar/`;
    return this.http.post<ReintentoTriajeResponse>(url, { forzar }).pipe(
      catchError((err: HttpErrorResponse) => throwError(() => this.normalizarErrorHttp(err)))
    );
  }

  /**
   * POST /api/triaje-ia/peticiones/<id_peticion>/decision/
   */
  registrarDecisionTriaje(
    idPeticion: number,
    payload: DecisionTriajePayload
  ): Observable<DecisionTriajeResponse> {
    const errorAcceso = this.validarAcceso();
    if (errorAcceso) {
      return throwError(() => errorAcceso);
    }

    const url = `${this.baseTriajeUrl}/peticiones/${idPeticion}/decision/`;
    return this.http.post<DecisionTriajeResponse>(url, payload).pipe(
      map((resp) => ({
        mensaje: resp?.mensaje || 'Decisión registrada correctamente.',
        triaje: this.normalizarTriaje(resp.triaje)
      })),
      catchError((err: HttpErrorResponse) => throwError(() => this.normalizarErrorHttp(err)))
    );
  }

  /**
   * Acepta la recomendación de veterinario en UNA sola solicitud atómica e idempotente.
   * El backend (`POST /api/triaje-ia/peticiones/<id>/decision/`) ejecuta dentro de la
   * misma transacción el flujo autorizado `AsignarPeticionView` y la auditoría humana,
   * evitando estados parciales, reasignaciones dobles o notificaciones duplicadas.
   */
  aceptarYAsignarVeterinarioRecomendado(
    idPeticion: number,
    _idVeterinario: number,
    observacion: string = ''
  ): Observable<DecisionTriajeResponse> {
    const motivoLimpio =
      observacion.trim() || 'Asignación aceptada desde recomendación de Triaje Inteligente.';
    return this.registrarDecisionTriaje(idPeticion, {
      tipo_recomendacion: 'VETERINARIO',
      decision: 'ACEPTADA',
      observacion: motivoLimpio
    });
  }

  private normalizarTriaje(raw: TriajePeticionDetalle): TriajePeticionDetalle {
    return {
      ...raw,
      signos_detectados: Array.isArray(raw.signos_detectados) ? raw.signos_detectados : [],
      signos_reportados: Array.isArray(raw.signos_reportados) ? raw.signos_reportados : [],
      signos_fotografia: Array.isArray(raw.signos_fotografia) ? raw.signos_fotografia : [],
      contradiccion_foto_descripcion: Boolean(raw.contradiccion_foto_descripcion),
      advertencias_contradiccion: Array.isArray(raw.advertencias_contradiccion)
        ? raw.advertencias_contradiccion
        : [],
      posibles_duplicados: Array.isArray(raw.posibles_duplicados) ? raw.posibles_duplicados : [],
      posibles_duplicados_detalle: Array.isArray(raw.posibles_duplicados_detalle)
        ? raw.posibles_duplicados_detalle
        : Array.isArray(raw.posibles_duplicados)
          ? raw.posibles_duplicados
          : [],
      carga_veterinarios_snapshot: Array.isArray(raw.carga_veterinarios_snapshot)
        ? raw.carga_veterinarios_snapshot
        : [],
      historial_decisiones: Array.isArray(raw.historial_decisiones) ? raw.historial_decisiones : [],
      decision_prioridad: raw.decision_prioridad || 'PENDIENTE',
      decision_veterinario: raw.decision_veterinario || 'PENDIENTE'
    };
  }

  private validarAcceso(): ErrorTriajeApi | null {
    if (!this.authService.isAuthenticated()) {
      return {
        status: 401,
        codigo: 'UNAUTHORIZED',
        mensaje: 'Tu sesión expiró o no estás autenticado para consultar el triaje inteligente.'
      };
    }
    if (!this.puedeConsultarTriaje()) {
      return {
        status: 403,
        codigo: 'FORBIDDEN',
        mensaje: 'Solo los roles Administrador y Jurídico tienen acceso al triaje inteligente.'
      };
    }
    return null;
  }

  private normalizarErrorHttp(err: unknown): ErrorTriajeApi {
    if (err && typeof err === 'object' && 'codigo' in err && 'mensaje' in err) {
      return err as ErrorTriajeApi;
    }
    const httpErr = err as HttpErrorResponse;
    const status = Number(httpErr?.status ?? 0);
    const body = httpErr?.error && typeof httpErr.error === 'object' ? httpErr.error : null;
    const mensajeServidor = String(
      body?.error || body?.detail || body?.mensaje || ''
    ).trim();

    const mapa: Record<number, { codigo: CodigoErrorTriaje; mensaje: string }> = {
      400: { codigo: 'VALIDATION_ERROR', mensaje: 'Los datos enviados para el triaje no son válidos.' },
      401: { codigo: 'UNAUTHORIZED', mensaje: 'Tu sesión expiró. Inicia sesión nuevamente.' },
      403: {
        codigo: 'FORBIDDEN',
        mensaje: 'No tienes permiso por rol o sede para consultar o gestionar este triaje.'
      },
      404: { codigo: 'NOT_FOUND', mensaje: 'La petición o registro de triaje no fue encontrado.' },
      409: {
        codigo: 'CONFLICT',
        mensaje: 'La petición no admite esta acción por su estado actual o conflicto.'
      },
      0: {
        codigo: 'NETWORK_ERROR',
        mensaje: 'No se pudo conectar con el servidor de Vetericano. Verifica tu conexión.'
      }
    };

    const fallback = mapa[status] ?? {
      codigo: 'UNKNOWN' as const,
      mensaje: 'No fue posible completar la operación de triaje inteligente.'
    };

    return {
      status,
      codigo: fallback.codigo,
      mensaje: mensajeServidor || fallback.mensaje
    };
  }
}
