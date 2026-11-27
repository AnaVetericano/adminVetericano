import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Adopciones } from './adopciones';

/**
 * Adopciones (A-01): versiones anteriores guardaban en localStorage descripciones tomadas de las
 * observaciones clínicas. El panel debe mostrar (y reenviar al editar) la descripción del backend.
 */
describe('Adopciones · la descripción del backend prevalece sobre la caché local', () => {
  const NOTA_CLINICA = 'NOTA CLINICA PRIVADA: fractura tratada con antibiótico';

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('vetericano_adopciones_sync_map', JSON.stringify({
      '25': { nombre: 'Luna', descripcion: NOTA_CLINICA, disponible_adopcion: true, estado: 'Disponible' },
    }));
    await TestBed.configureTestingModule({
      imports: [Adopciones],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('una entrada antigua con notas clínicas en localStorage no se muestra ni se reutiliza', () => {
    const componente = TestBed.createComponent(Adopciones).componentInstance;
    const http = TestBed.inject(HttpTestingController);
    componente.loadPets();
    for (const peticion of http.match(r => r.method === 'GET' && r.url.includes('/adopciones/'))) {
      peticion.flush([{ id: 25, nombre: 'Luna', raza: 'Mestizo', descripcion: 'Juguetona y sociable',
        imagen: '', estado: 'Disponible', fecha: '2026-11-20' }]);
    }
    const luna = componente.pets.find(p => Number(p.id) === 25);
    expect(luna).toBeTruthy();
    expect(luna!.descripcion).toBe('Juguetona y sociable');
    expect(JSON.stringify(componente.pets)).not.toContain(NOTA_CLINICA);
  });
});
