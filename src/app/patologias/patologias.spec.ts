import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { Patologias } from './patologias';
import { AuthService } from '../services/auth';

describe('Patologias', () => {
  let component: Patologias;
  let fixture: ComponentFixture<Patologias>;
  let authService: AuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Patologias],
      providers: [provideHttpClient(), provideRouter([])]
    })
    .compileComponents();

    authService = TestBed.inject(AuthService);
    fixture = TestBed.createComponent(Patologias);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('filtra patologías por nombre, descripción y tipo_de_enfermedad', () => {
    component.patologiasOriginales = [
      { id_patologia: 1, nombre: 'Parvovirosis Canina (CPV-2)', descripcion: 'Viral grave', tipo_de_enfermedad: 'Infecciosa', activo: true },
      { id_patologia: 2, nombre: 'Dermatitis Atópica', descripcion: 'Prurito crónico', tipo_de_enfermedad: 'Dermatológica', activo: true }
    ];

    component.filtroBusqueda = 'infecciosa';
    component.filtrarPatologias();
    expect(component.patologias.length).toBe(1);
    expect(component.patologias[0].nombre).toContain('Parvovirosis');

    component.filtroBusqueda = '';
    component.filtrarPorTipo('Dermatológica');
    expect(component.patologias.length).toBe(1);
    expect(component.patologias[0].id_patologia).toBe(2);
  });

  it('oculta acciones de escritura para Veterinario y las muestra para Administrador', () => {
    fixture.destroy();

    const spyAdmin = vi.spyOn(authService, 'isAdmin').mockReturnValue(false);
    const fixVet = TestBed.createComponent(Patologias);
    fixVet.detectChanges();
    const textoVet = (fixVet.nativeElement as HTMLElement).textContent || '';
    expect(textoVet).not.toContain('Crear Patología');
    expect(textoVet).not.toContain('Importar Excel');
    fixVet.destroy();

    spyAdmin.mockReturnValue(true);
    const fixAdmin = TestBed.createComponent(Patologias);
    fixAdmin.detectChanges();
    const textoAdmin = (fixAdmin.nativeElement as HTMLElement).textContent || '';
    expect(textoAdmin).toContain('Crear Patología');
    expect(textoAdmin).toContain('Importar Excel');
    fixAdmin.destroy();
  });
});
