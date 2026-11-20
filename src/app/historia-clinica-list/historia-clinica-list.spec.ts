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

  it('enviarAAdopcion() registra el estado oficial "Disponible para Adopción" y actualiza el estado tras éxito (rol Admin)', async () => {
    vi.spyOn(authSvc, 'isAdmin').mockReturnValue(true);
    const registrarSpy = vi.spyOn(historiaSvc, 'registrarEstadoAnimal').mockReturnValue(of({ id_estado: 1 }));
    const historia = crearHistoriaHospitalizada();
    component.historias = [historia];

    component.enviarAAdopcion(historia);
    await Promise.resolve();

    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/historias/10/')).flush({});
    httpMock.expectOne(req => req.method === 'GET' && req.url.includes('consultas/?id_historia=10')).flush([]);
    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/animales/animales/25/')).flush({});
    httpMock.expectOne(req => req.method === 'PUT' && req.url.includes('/api/adopciones/25/')).flush({});

    await vi.waitFor(() => expect(registrarSpy).toHaveBeenCalledTimes(1));

    expect(registrarSpy).toHaveBeenCalledWith(
      25,
      'Disponible para Adopción',
      'Alta médica de hospitalización CBA — Lista para adopción'
    );
    expect(historia.ingresa_cba).toBe(false);
    expect(historia.estado_general).toBe('Estable');
    expect(historia.disponible_adopcion).toBe(true);
    expect(swalSpy).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'success',
      showCancelButton: true,
      confirmButtonText: 'Ir a Adopciones'
    }));
  });

  it('enviarAAdopcion() conserva permisos para rol no-admin (no llama PUT /api/adopciones ni ofrece botón Ir a Adopciones)', async () => {
    vi.spyOn(authSvc, 'isAdmin').mockReturnValue(false);
    const registrarSpy = vi.spyOn(historiaSvc, 'registrarEstadoAnimal').mockReturnValue(of({ id_estado: 2 }));
    const historia = crearHistoriaHospitalizada();
    component.historias = [historia];

    component.enviarAAdopcion(historia);
    await Promise.resolve();

    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/historias/10/')).flush({});
    httpMock.expectOne(req => req.method === 'GET' && req.url.includes('consultas/?id_historia=10')).flush([]);
    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/animales/animales/25/')).flush({});
    httpMock.expectNone(req => req.url.includes('/api/adopciones/'));

    await vi.waitFor(() => expect(registrarSpy).toHaveBeenCalledTimes(1));
    expect(swalSpy).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'success',
      showCancelButton: false,
      confirmButtonText: 'Ver en Historias Normales'
    }));
  });

  it('enviarAAdopcion() maneja error en registrarEstadoAnimal() sin mostrar éxito ni marcar disponible_adopcion', async () => {
    vi.spyOn(authSvc, 'isAdmin').mockReturnValue(false);
    vi.spyOn(historiaSvc, 'registrarEstadoAnimal').mockReturnValue(
      throwError(() => ({ status: 500, error: { detail: 'Error registrando estado oficial' } }))
    );
    const historia = crearHistoriaHospitalizada();
    component.historias = [historia];

    component.enviarAAdopcion(historia);
    await Promise.resolve();

    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/historias/10/')).flush({});
    httpMock.expectOne(req => req.method === 'GET' && req.url.includes('consultas/?id_historia=10')).flush([]);
    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/animales/animales/25/')).flush({});

    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(2));

    expect(historia.ingresa_cba).toBe(true);
    expect(historia.disponible_adopcion).toBe(false);
    const alertaError = swalSpy.mock.calls[1][0] as any;
    expect(alertaError.icon).toBe('error');
    expect(alertaError.text).toContain('Error registrando estado oficial');
  });

  it('enviarAAdopcion() evita registros duplicados ante invocaciones simultáneas o repetidas', async () => {
    vi.spyOn(authSvc, 'isAdmin').mockReturnValue(false);
    const estadoSubject = new Subject<any>();
    const registrarSpy = vi.spyOn(historiaSvc, 'registrarEstadoAnimal').mockReturnValue(estadoSubject.asObservable());
    const historia = crearHistoriaHospitalizada();
    component.historias = [historia];

    component.enviarAAdopcion(historia);
    await Promise.resolve();

    // Segunda invocación mientras la primera está en curso
    component.enviarAAdopcion(historia);
    await Promise.resolve();

    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/historias/10/')).flush({});
    httpMock.expectOne(req => req.method === 'GET' && req.url.includes('consultas/?id_historia=10')).flush([]);
    httpMock.expectOne(req => req.method === 'PATCH' && req.url.includes('/animales/animales/25/')).flush({});

    expect(registrarSpy).toHaveBeenCalledTimes(1);

    estadoSubject.next({ id_estado: 3 });
    estadoSubject.complete();

    await vi.waitFor(() => expect(historia.disponible_adopcion).toBe(true));

    // Tercera invocación cuando el animal ya quedó disponible para adopción
    component.enviarAAdopcion(historia);
    await Promise.resolve();
    expect(registrarSpy).toHaveBeenCalledTimes(1);
  });
});
