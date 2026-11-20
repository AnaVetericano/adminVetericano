import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, vi } from 'vitest';
import Swal from 'sweetalert2';

import { HistoriaClinicaItem, HistoriaClinicaListComponent } from './historia-clinica-list';
import { HistoriaClinicaService } from '../services/historia-clinica.service';
import { AuthService } from '../services/auth';

describe('HistoriaClinicaListComponent · regresiones de listado y envío a adopción', () => {
  let fixture: ComponentFixture<HistoriaClinicaListComponent>;
  let component: HistoriaClinicaListComponent;
  let httpMock: HttpTestingController;
  let historiaSvc: HistoriaClinicaService;
  let authSvc: AuthService;
  let swalSpy: ReturnType<typeof vi.spyOn>;

  const crearHistoriaHospitalizada = (overrides: Partial<HistoriaClinicaItem> = {}): HistoriaClinicaItem => ({
    id_historia: 10,
    id_animal: 25,
    id_consulta: 40,
    numero_historia: 'HC-10',
    fecha_apertura: '2026-11-18T10:00:00Z',
    estado_general: 'En observación',
    ingresa_cba: true,
    disponible_adopcion: false,
    animal_nombre: 'Luna',
    animal_especie: 'Canino',
    animal_raza: 'Mestizo',
    animal_foto: '',
    ...overrides
  });

  const tieneAlertaExito = (): boolean =>
    swalSpy.mock.calls.some((call: any[]) => call[0]?.icon === 'success');

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HistoriaClinicaListComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    swalSpy = vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true, value: 'Lista para adopción' } as any);
    httpMock = TestBed.inject(HttpTestingController);
    historiaSvc = TestBed.inject(HistoriaClinicaService);
    authSvc = TestBed.inject(AuthService);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(HistoriaClinicaListComponent);
    component = fixture.componentInstance;
    vi.spyOn(component, 'cargarHistorias').mockImplementation(() => {
      component.cargando = false;
    });
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('muestra el encabezado estándar <app-page-title> y no duplica los botones de acción', () => {
    component.cargando = false;
    component.mostrarHospitalizados = true;
    component.historias = [crearHistoriaHospitalizada()];
    component.aplicarFiltros();
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('app-page-title')).toBeTruthy();

    const botones = Array.from(host.querySelectorAll('button')).map(b => (b.textContent || '').trim());
    expect(botones.filter(t => t === 'Hospitalizados').length).toBe(1);
    expect(botones.filter(t => t === 'Historias Normales').length).toBe(1);
    expect(botones.filter(t => t === 'Acta de Campo').length).toBe(1);
  });

  it('enviarAAdopcion() ejecuta el flujo secuencial completo y registra "Disponible para Adopción" (rol Admin)', async () => {
    vi.spyOn(authSvc, 'isAdmin').mockReturnValue(true);
    const historia = crearHistoriaHospitalizada();
    component.historias = [historia];

    component.enviarAAdopcion(historia);
    await Promise.resolve();

    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/historias/10/')).flush({});
    httpMock.expectOne(req => req.method === 'GET' && req.url.includes('consultas/?id_historia=10')).flush([{ id_consulta: 40, id_historia: 10 }]);
    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/consultas/40/')).flush({});
    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/animales/animales/25/')).flush({});
    httpMock.expectOne(req => req.method === 'PUT' && req.url.includes('/api/adopciones/25/')).flush({});
    httpMock.expectOne(req => req.method === 'GET' && req.url.includes('/animales/estados/')).flush([]);
    const reqEstado = httpMock.expectOne(req => req.method === 'POST' && req.url.includes('/animales/estados/'));
    expect(reqEstado.request.body).toEqual({
      id_animal: 25,
      nombre_estado: 'Disponible para Adopción',
      observacion: 'Alta médica de hospitalización CBA — Lista para adopción'
    });
    reqEstado.flush({ id_estado_animal: 1 });

    await vi.waitFor(() => expect(historia.disponible_adopcion).toBe(true));

    expect(historia.ingresa_cba).toBe(false);
    expect(historia.estado_general).toBe('Estable');
    expect(swalSpy).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'success',
      showCancelButton: true,
      confirmButtonText: 'Ir a Adopciones'
    }));
  });

  it('enviarAAdopcion() conserva permisos para rol no-admin (no llama PUT /api/adopciones ni ofrece botón Ir a Adopciones)', async () => {
    vi.spyOn(authSvc, 'isAdmin').mockReturnValue(false);
    const historia = crearHistoriaHospitalizada();
    component.historias = [historia];

    component.enviarAAdopcion(historia);
    await Promise.resolve();

    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/historias/10/')).flush({});
    httpMock.expectOne(req => req.method === 'GET' && req.url.includes('consultas/?id_historia=10')).flush([]);
    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/animales/animales/25/')).flush({});
    httpMock.expectNone(req => req.url.includes('/api/adopciones/'));
    httpMock.expectOne(req => req.method === 'GET' && req.url.includes('/animales/estados/')).flush([]);
    httpMock.expectOne(req => req.method === 'POST' && req.url.includes('/animales/estados/')).flush({ id_estado_animal: 2 });

    await vi.waitFor(() => expect(historia.disponible_adopcion).toBe(true));
    expect(swalSpy).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'success',
      showCancelButton: false,
      confirmButtonText: 'Ver en Historias Normales'
    }));
  });

  it('fallo en PATCH de historias clínicas: detiene el flujo sin continuar y no muestra éxito', async () => {
    vi.spyOn(authSvc, 'isAdmin').mockReturnValue(true);
    const historia = crearHistoriaHospitalizada();
    component.historias = [historia];

    component.enviarAAdopcion(historia);
    await Promise.resolve();

    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/historias/10/'))
      .flush({ detail: 'Error en historia' }, { status: 500, statusText: 'Server Error' });

    httpMock.expectNone(req => req.url.includes('/consultas/'));
    httpMock.expectNone(req => req.url.includes('/animales/animales/'));
    httpMock.expectNone(req => req.url.includes('/api/adopciones/'));
    httpMock.expectNone(req => req.url.includes('/animales/estados/'));

    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(2));
    expect(historia.ingresa_cba).toBe(true);
    expect(historia.disponible_adopcion).toBe(false);
    expect(tieneAlertaExito()).toBe(false);
    const alerta = swalSpy.mock.calls[1][0] as any;
    expect(alerta.icon).toBe('error');
    expect(alerta.text).toContain('actualización de la historia clínica');
  });

  it('fallo en PATCH de consultas: detiene el flujo antes de animal/adopciones/estados y no muestra éxito', async () => {
    vi.spyOn(authSvc, 'isAdmin').mockReturnValue(true);
    const historia = crearHistoriaHospitalizada();
    component.historias = [historia];

    component.enviarAAdopcion(historia);
    await Promise.resolve();

    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/historias/10/')).flush({});
    httpMock.expectOne(req => req.method === 'GET' && req.url.includes('consultas/?id_historia=10')).flush([{ id_consulta: 40, id_historia: 10 }]);
    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/consultas/40/'))
      .flush({ detail: 'Fallo al cerrar hospitalización' }, { status: 500, statusText: 'Server Error' });

    httpMock.expectNone(req => req.url.includes('/animales/animales/'));
    httpMock.expectNone(req => req.url.includes('/api/adopciones/'));
    httpMock.expectNone(req => req.url.includes('/animales/estados/'));

    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(2));
    expect(historia.ingresa_cba).toBe(true);
    expect(historia.disponible_adopcion).toBe(false);
    expect(tieneAlertaExito()).toBe(false);
    const alerta = swalSpy.mock.calls[1][0] as any;
    expect(alerta.icon).toBe('error');
    expect(alerta.text).toContain('actualización de las consultas hospitalarias');
  });

  it('fallo en PATCH de animales: detiene antes de adopciones/estados y no muestra éxito', async () => {
    vi.spyOn(authSvc, 'isAdmin').mockReturnValue(true);
    const historia = crearHistoriaHospitalizada();
    component.historias = [historia];

    component.enviarAAdopcion(historia);
    await Promise.resolve();

    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/historias/10/')).flush({});
    httpMock.expectOne(req => req.method === 'GET' && req.url.includes('consultas/?id_historia=10')).flush([]);
    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/animales/animales/25/'))
      .flush({ detail: 'Error actualizando animal' }, { status: 400, statusText: 'Bad Request' });

    httpMock.expectNone(req => req.url.includes('/api/adopciones/'));
    httpMock.expectNone(req => req.url.includes('/animales/estados/'));

    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(2));
    expect(historia.ingresa_cba).toBe(true);
    expect(historia.disponible_adopcion).toBe(false);
    expect(tieneAlertaExito()).toBe(false);
    const alerta = swalSpy.mock.calls[1][0] as any;
    expect(alerta.icon).toBe('error');
    expect(alerta.text).toContain('actualización de la ficha del animal');
  });

  it('fallo en PUT de adopciones para Administrador: no continúa a estados y no muestra éxito', async () => {
    vi.spyOn(authSvc, 'isAdmin').mockReturnValue(true);
    const historia = crearHistoriaHospitalizada();
    component.historias = [historia];

    component.enviarAAdopcion(historia);
    await Promise.resolve();

    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/historias/10/')).flush({});
    httpMock.expectOne(req => req.method === 'GET' && req.url.includes('consultas/?id_historia=10')).flush([]);
    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/animales/animales/25/')).flush({});
    httpMock.expectOne(req => req.method === 'PUT' && req.url.includes('/api/adopciones/25/'))
      .flush({ detail: 'Error en catálogo de adopciones' }, { status: 500, statusText: 'Server Error' });

    httpMock.expectNone(req => req.url.includes('/animales/estados/'));

    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(2));
    expect(historia.ingresa_cba).toBe(true);
    expect(historia.disponible_adopcion).toBe(false);
    expect(tieneAlertaExito()).toBe(false);
    const alerta = swalSpy.mock.calls[1][0] as any;
    expect(alerta.icon).toBe('error');
    expect(alerta.text).toContain('publicación en el módulo de Adopciones');
  });

  it('fallo en POST de estados: no marca disponible_adopcion ni muestra éxito', async () => {
    vi.spyOn(authSvc, 'isAdmin').mockReturnValue(false);
    const historia = crearHistoriaHospitalizada();
    component.historias = [historia];

    component.enviarAAdopcion(historia);
    await Promise.resolve();

    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/historias/10/')).flush({});
    httpMock.expectOne(req => req.method === 'GET' && req.url.includes('consultas/?id_historia=10')).flush([]);
    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/animales/animales/25/')).flush({});
    httpMock.expectOne(req => req.method === 'GET' && req.url.includes('/animales/estados/')).flush([]);
    httpMock.expectOne(req => req.method === 'POST' && req.url.includes('/animales/estados/'))
      .flush({ detail: 'Error registrando estado oficial' }, { status: 500, statusText: 'Server Error' });

    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(2));
    expect(historia.ingresa_cba).toBe(true);
    expect(historia.disponible_adopcion).toBe(false);
    expect(tieneAlertaExito()).toBe(false);
    const alerta = swalSpy.mock.calls[1][0] as any;
    expect(alerta.icon).toBe('error');
    expect(alerta.text).toContain('registro del estado oficial');
    expect(alerta.text).toContain('Error registrando estado oficial');
  });

  it('doble clic y doble confirmación: reserva antes del diálogo, bloquea duplicados y libera si cancela', async () => {
    vi.spyOn(authSvc, 'isAdmin').mockReturnValue(false);
    let resolverDialogo!: (val: any) => void;
    swalSpy.mockImplementationOnce(() => new Promise((resolve) => { resolverDialogo = resolve; }) as any);

    const historia = crearHistoriaHospitalizada();
    component.historias = [historia];

    // Primer clic abre el diálogo y reserva la operación
    component.enviarAAdopcion(historia);
    // Segundo clic inmediato mientras el diálogo sigue abierto: debe ser ignorado
    component.enviarAAdopcion(historia);
    expect(swalSpy).toHaveBeenCalledTimes(1);

    // Usuario cancela → debe liberar la reserva
    resolverDialogo({ isConfirmed: false });
    await Promise.resolve();
    httpMock.expectNone(() => true);

    // Ahora sí puede volver a abrir el diálogo y confirmar una sola vez
    const estadoSubject = new Subject<any>();
    const registrarSpy = vi.spyOn(historiaSvc, 'registrarEstadoAnimal').mockReturnValue(estadoSubject.asObservable());
    swalSpy.mockResolvedValueOnce({ isConfirmed: true, value: 'Confirmado' } as any);

    component.enviarAAdopcion(historia);
    await Promise.resolve();
    // Intento concurrente durante el envío
    component.enviarAAdopcion(historia);

    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/historias/10/')).flush({});
    httpMock.expectOne(req => req.method === 'GET' && req.url.includes('consultas/?id_historia=10')).flush([]);
    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/animales/animales/25/')).flush({});
    httpMock.expectOne(req => req.method === 'GET' && req.url.includes('/animales/estados/')).flush([]);

    expect(registrarSpy).toHaveBeenCalledTimes(1);

    estadoSubject.next({ id_estado_animal: 3 });
    estadoSubject.complete();
    await vi.waitFor(() => expect(historia.disponible_adopcion).toBe(true));

    // Reinvocación tras completarse: no repite
    component.enviarAAdopcion(historia);
    expect(registrarSpy).toHaveBeenCalledTimes(1);
  });

  it('reintento después de fallo parcial: conserva pasos exitosos sin repetirlos y omite POST de estado si ya existe en REST', async () => {
    vi.spyOn(authSvc, 'isAdmin').mockReturnValue(false);
    const historia = crearHistoriaHospitalizada();
    component.historias = [historia];

    // Intento 1: historia, consultas y animal tienen éxito, pero falla POST de estado
    component.enviarAAdopcion(historia);
    await Promise.resolve();

    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/historias/10/')).flush({});
    httpMock.expectOne(req => req.method === 'GET' && req.url.includes('consultas/?id_historia=10')).flush([]);
    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/animales/animales/25/')).flush({});
    httpMock.expectOne(req => req.method === 'GET' && req.url.includes('/animales/estados/')).flush([]);
    httpMock.expectOne(req => req.method === 'POST' && req.url.includes('/animales/estados/'))
      .flush({ detail: 'Timeout temporal' }, { status: 503, statusText: 'Service Unavailable' });

    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(2));
    expect(tieneAlertaExito()).toBe(false);

    // Intento 2: NO debe repetir PATCH historia, GET/PATCH consultas ni PATCH animal; solo verifica/completa estado
    component.enviarAAdopcion(historia);
    await Promise.resolve();

    httpMock.expectNone(req => req.url.includes('/historias/10/'));
    httpMock.expectNone(req => req.url.includes('/consultas/'));
    httpMock.expectNone(req => req.url.includes('/animales/animales/25/'));

    // Si en BD el estado oficial ya existía, tampoco repite POST /animales/estados/
    httpMock.expectOne(req => req.method === 'GET' && req.url.includes('/animales/estados/')).flush([
      { id_estado_animal: 9, id_animal: 25, nombre_estado: 'Disponible para Adopción', fecha_registro: '2026-11-20T00:00:00Z' }
    ]);
    httpMock.expectNone(req => req.method === 'POST' && req.url.includes('/animales/estados/'));

    await vi.waitFor(() => expect(historia.disponible_adopcion).toBe(true));
    expect(tieneAlertaExito()).toBe(true);
  });
});
