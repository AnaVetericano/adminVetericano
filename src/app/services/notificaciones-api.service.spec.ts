import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { NotificacionesApiService } from './notificaciones-api.service';

describe('NotificacionesApiService', () => {
  let service: NotificacionesApiService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl.replace(/\/+$/, '')}/notificaciones`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(NotificacionesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('debe consultar GET /api/notificaciones/ con filtros y tope de limit=200', () => {
    service
      .listar({ solo_no_leidas: true, modulo: 'peticiones', limit: 350, offset: 10 })
      .subscribe((resp) => {
        expect(resp.no_leidas).toBe(1);
        expect(resp.resultados.length).toBe(1);
      });

    const req = httpMock.expectOne(
      (r) =>
        r.method === 'GET' &&
        r.url === `${baseUrl}/` &&
        r.params.get('solo_no_leidas') === 'true' &&
        r.params.get('modulo') === 'peticiones' &&
        r.params.get('limit') === '200' &&
        r.params.get('offset') === '10'
    );

    req.flush({
      total: 1,
      no_leidas: 1,
      resultados: [
        {
          clave: 'pet-893',
          origen: 'peticiones',
          id_notificacion: 893,
          event_type: 'peticion.asignada',
          modulo: 'peticiones',
          tipo: 'ASIGNACION',
          titulo: 'Petición asignada: RAD-2026-0215',
          mensaje: 'Nueva asignación',
          prioridad: 'Urgente',
          leida: false,
          fecha_creacion: '2026-11-17T10:00:00',
          fecha_lectura: null,
          referencia: { id_peticion: 215, numero_radicado: 'RAD-2026-0215' }
        }
      ]
    });
  });

  it('debe consultar GET /api/notificaciones/contador/', () => {
    service.contador().subscribe((resp) => {
      expect(resp.no_leidas).toBe(3);
      expect(resp.por_modulo['peticiones']).toBe(2);
    });

    const req = httpMock.expectOne(`${baseUrl}/contador/`);
    expect(req.request.method).toBe('GET');
    req.flush({ no_leidas: 3, por_modulo: { peticiones: 2, inventario: 1 } });
  });

  it('debe enviar PATCH /api/notificaciones/<clave>/leer/', () => {
    service.marcarLeida('pet-893').subscribe((item) => {
      expect(item.leida).toBe(true);
    });

    const req = httpMock.expectOne(`${baseUrl}/pet-893/leer/`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({});
    req.flush({
      clave: 'pet-893',
      origen: 'peticiones',
      id_notificacion: 893,
      event_type: 'peticion.asignada',
      modulo: 'peticiones',
      tipo: 'ASIGNACION',
      titulo: 'Petición asignada',
      mensaje: 'Detalle',
      prioridad: 'Urgente',
      leida: true,
      fecha_creacion: '2026-11-17T10:00:00',
      fecha_lectura: '2026-11-17T10:05:00',
      referencia: { id_peticion: 215 }
    });
  });

  it('debe enviar PATCH /api/notificaciones/leer-todas/ con módulo opcional', () => {
    service.marcarTodasLeidas('inventario').subscribe((resp) => {
      expect(resp.actualizadas).toBe(4);
    });

    const req = httpMock.expectOne(
      (r) => r.method === 'PATCH' && r.url === `${baseUrl}/leer-todas/` && r.params.get('modulo') === 'inventario'
    );
    expect(req.request.body).toEqual({});
    req.flush({ actualizadas: 4 });
  });
});
