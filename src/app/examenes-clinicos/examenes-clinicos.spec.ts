import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ExamenesClinicos } from './examenes-clinicos';
import { ExamenesClinicosService, CATALOGO_CANONICO_EXAMENES } from '../services/examenes-clinicos.service';
import { AuthService } from '../services/auth';

describe('ExamenesClinicos', () => {
  let component: ExamenesClinicos;
  let fixture: ComponentFixture<ExamenesClinicos>;
  let authService: AuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExamenesClinicos],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    })
    .compileComponents();

    authService = TestBed.inject(AuthService);
    fixture = TestBed.createComponent(ExamenesClinicos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('mantiene catálogo canónico de 20 exámenes alineado con el backend', () => {
    expect(CATALOGO_CANONICO_EXAMENES.length).toBe(20);
    const nombres = CATALOGO_CANONICO_EXAMENES.map(e => e.nombre);
    expect(nombres).toContain('Cuadro Hemático');
    expect(nombres).toContain('Parcial de Orina');
    expect(nombres).toContain('Test Parvovirus');
    expect(nombres).toContain('Test de Distemper (Moquillo)');
  });

  it('importarExamenesMasivo envía POST a /examenes-clinicos/examenes/carga-masiva/', () => {
    const svc = TestBed.inject(ExamenesClinicosService);
    const httpMock = TestBed.inject(HttpTestingController);
    let respuesta: any;

    svc.importarExamenesMasivo([{ nombre: 'Cuadro Hemático', estado: 'activo' }]).subscribe(r => {
      respuesta = r;
    });

    const req = httpMock.expectOne(r => r.method === 'POST' && r.url.includes('/examenes-clinicos/examenes/carga-masiva/'));
    req.flush({ creados_count: 1, actualizados_count: 0, errores: [] });
    expect(respuesta.creados_count).toBe(1);
  });

  it('oculta acciones de escritura para Veterinario y las muestra para Administrador', () => {
    fixture.destroy();

    const spyAdmin = vi.spyOn(authService, 'isAdmin').mockReturnValue(false);
    const fixVet = TestBed.createComponent(ExamenesClinicos);
    fixVet.detectChanges();
    const textoVet = (fixVet.nativeElement as HTMLElement).textContent || '';
    expect(textoVet).not.toContain('Importar Excel');
    expect(textoVet).not.toContain('Crear Registro');
    fixVet.destroy();

    spyAdmin.mockReturnValue(true);
    const fixAdmin = TestBed.createComponent(ExamenesClinicos);
    fixAdmin.detectChanges();
    const textoAdmin = (fixAdmin.nativeElement as HTMLElement).textContent || '';
    expect(textoAdmin).toContain('Importar Excel');
    expect(textoAdmin).toContain('Crear Registro');
    fixAdmin.destroy();
  });
});
