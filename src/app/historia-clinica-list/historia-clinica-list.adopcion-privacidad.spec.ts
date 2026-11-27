import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Swal from 'sweetalert2';

import { HistoriaClinicaItem, HistoriaClinicaListComponent } from './historia-clinica-list';
import { AuthService } from '../services/auth';

/**
 * Adopciones (A-01): el formulario "Enviar a adopción" y la edición de la ficha no deben convertir las
 * observaciones clínicas en la descripción pública de Adopciones, ni sobrescribir las notas clínicas.
 */
describe('HistoriaClinicaList · descripción de adopción solo con información pública', () => {
  const NOTA_CLINICA = 'NOTA CLINICA PRIVADA: fractura tratada con antibiótico';
  const SENAS = 'cicatriz quirúrgica en abdomen';

  let component: HistoriaClinicaListComponent;
  let httpMock: HttpTestingController;
  let authSvc: AuthService;
  let swalSpy: ReturnType<typeof vi.spyOn>;

  const historia = (overrides: Partial<HistoriaClinicaItem> = {}): HistoriaClinicaItem => ({
    id_historia: 10, id_animal: 25, id_consulta: 40, numero_historia: 'HC-10',
    fecha_apertura: '2026-11-18T10:00:00Z', estado_general: 'En observación', ingresa_cba: true,
    disponible_adopcion: false, animal_nombre: 'Luna', animal_especie: 'Canino', animal_raza: 'Mestizo',
    animal_foto: '', ...overrides,
  });

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HistoriaClinicaListComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    authSvc = TestBed.inject(AuthService);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.spyOn(authSvc, 'isAdmin').mockReturnValue(true);
    // El usuario acepta el texto que el formulario le propone.
    swalSpy = vi.spyOn(Swal, 'fire').mockImplementation(
      ((opciones: any) => Promise.resolve({ isConfirmed: true, value: opciones?.inputValue })) as any,
    );
    const fixture = TestBed.createComponent(HistoriaClinicaListComponent);
    component = fixture.componentInstance;
    vi.spyOn(component, 'cargarHistorias').mockImplementation(() => { component.cargando = false; });
    fixture.detectChanges();
    (component as any).mapaAnimales.set(25, { id_animal: 25, observaciones: NOTA_CLINICA, caracteristicas: SENAS });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('"Enviar a adopción" no precarga observaciones ni señas, y no publica ni sobrescribe notas clínicas', async () => {
    const h = historia();
    component.historias = [h];
    component.enviarAAdopcion(h);
    await Promise.resolve();

    const textoPropuesto = (swalSpy.mock.calls[0][0] as any).inputValue as string;
    expect(textoPropuesto).not.toContain(NOTA_CLINICA);
    expect(textoPropuesto).not.toContain(SENAS);
    expect(textoPropuesto).toContain('Luna');

    httpMock.expectOne(r => r.method === 'PATCH' && r.url.includes('/historias/10/')).flush({});
    httpMock.expectOne(r => r.method === 'GET' && r.url.includes('consultas/?id_historia=10')).flush([]);
    const patchAnimal = httpMock.expectOne(r => r.method === 'PATCH' && r.url.includes('/animales/animales/25/'));
    expect(patchAnimal.request.body).not.toHaveProperty('observaciones');
    expect(JSON.stringify(patchAnimal.request.body)).not.toContain(NOTA_CLINICA);
    patchAnimal.flush({});
    const putAdopcion = httpMock.expectOne(r => r.method === 'PUT' && r.url.includes('/api/adopciones/25/'));
    expect(putAdopcion.request.body.descripcion).toBe(textoPropuesto);
    expect(JSON.stringify(putAdopcion.request.body)).not.toContain(NOTA_CLINICA);
    putAdopcion.flush({});
    httpMock.expectOne(r => r.method === 'GET' && r.url.includes('/animales/estados/')).flush([]);
    httpMock.expectOne(r => r.method === 'POST' && r.url.includes('/animales/estados/')).flush({ id_estado_animal: 1 });
    await vi.waitFor(() => expect(h.disponible_adopcion).toBe(true));
    // La caché que usa "Editar ficha" conserva las notas clínicas: una edición posterior no las pisa.
    const cache = (component as any).mapaAnimales.get(25);
    expect(cache.observaciones).toBe(NOTA_CLINICA);
    expect(cache.caracteristicas).toBe(textoPropuesto);
  });

  function editarFicha(datos: Partial<Record<string, any>>) {
    component.animalEnEdicion = {
      ...component.animalEnEdicion,
      id_animal: 25, id_historia: 10, nombre: 'Luna', especie: 'Canino', raza: 'Mestizo', sexo: 'Hembra',
      color: 'Café', peso: null, esterilizado: false, foto_url: '', estado_general: 'Estable',
      ingresa_cba: false, observaciones: NOTA_CLINICA, caracteristicas: '', disponible_adopcion: true,
      ...datos,
    } as any;
    component.guardarEdicionAnimal();
    const put = httpMock.expectOne(r => r.method === 'PUT' && r.url.includes('/api/adopciones/25/'));
    const patch = httpMock.expectOne(r => r.method === 'PATCH' && r.url.includes('/animales/animales/25/'));
    return { put, patch };
  }

  it('editar la ficha (Administrador) no convierte las observaciones en la descripción pública', () => {
    const { put, patch } = editarFicha({});
    expect(put.request.body.descripcion).not.toContain(NOTA_CLINICA);
    expect(put.request.body.estado).toBe('Disponible');
    expect(patch.request.body.caracteristicas).not.toContain(NOTA_CLINICA);
    // Las notas clínicas se conservan tal cual en su propio campo.
    expect(patch.request.body.observaciones).toBe(NOTA_CLINICA);
    put.flush({});
    patch.flush({});
  });

  it('editar la ficha conserva la descripción pública existente (caracteristicas)', () => {
    const { put, patch } = editarFicha({ caracteristicas: 'Juguetona y sociable' });
    expect(put.request.body.descripcion).toBe('Juguetona y sociable');
    expect(patch.request.body.caracteristicas).toBe('Juguetona y sociable');
    put.flush({});
    patch.flush({});
  });

  it('editar un animal no adoptable no publica notas clínicas ni rellena las observaciones', () => {
    const { put, patch } = editarFicha({ disponible_adopcion: false, observaciones: '' });
    expect(put.request.body.estado).toBe('No Disponible');
    expect(put.request.body.descripcion).not.toContain(NOTA_CLINICA);
    expect(patch.request.body.observaciones).toBe('');
    put.flush({});
    patch.flush({});
  });
});
