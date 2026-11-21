import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, vi } from 'vitest';
import Swal from 'sweetalert2';
import { InicioDeSesionAdministradorComponent } from './inicio-de-sesion-administrador';

describe('InicioDeSesionAdministradorComponent', () => {
  let component: InicioDeSesionAdministradorComponent;
  let fixture: ComponentFixture<InicioDeSesionAdministradorComponent>;
  let httpMock: HttpTestingController;
  let swalSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InicioDeSesionAdministradorComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(InicioDeSesionAdministradorComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    swalSpy = vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true } as any);
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('muestra error de conexión cuando el servidor no responde (status 0)', async () => {
    component.usuario = { email: 'admin@test.local', password: 'Password123!' };
    component.login();

    const req = httpMock.expectOne((r) => r.url.includes('/login/'));
    req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalled());
    const arg = swalSpy.mock.calls[0][0] as any;
    expect(arg.title).toBe('Error de conexión');
  });

  it('muestra error del servidor ante HTTP 500', async () => {
    component.usuario = { email: 'admin@test.local', password: 'Password123!' };
    component.login();

    const req = httpMock.expectOne((r) => r.url.includes('/login/'));
    req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalled());
    const arg = swalSpy.mock.calls[0][0] as any;
    expect(arg.title).toBe('Error del servidor');
  });

  it('muestra credenciales inválidas ante HTTP 400 con detalle del backend', async () => {
    component.usuario = { email: 'admin@test.local', password: 'Wrong' };
    component.login();

    const req = httpMock.expectOne((r) => r.url.includes('/login/'));
    req.flush({ detail: 'Correo o contraseña incorrectos.' }, { status: 400, statusText: 'Bad Request' });

    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalled());
    const arg = swalSpy.mock.calls[0][0] as any;
    expect(arg.title).toBe('Credenciales inválidas');
    expect(arg.text).toBe('Correo o contraseña incorrectos.');
  });
});