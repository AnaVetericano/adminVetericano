import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import Swal from 'sweetalert2';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SuperAdminAdministradoresComponent } from './super-admin-administradores';

const MALICIOSO = '<img src=x onerror="window.__xss = 1">';

describe('SuperAdminAdministradores — datos de usuario como texto (XSS)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('el diálogo de cambio de estado muestra nombre, apellido y correo como texto', async () => {
    await TestBed.configureTestingModule({
      imports: [SuperAdminAdministradoresComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    const component = TestBed.createComponent(SuperAdminAdministradoresComponent).componentInstance;
    const swalSpy = vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: false } as any);

    component.toggleEstadoAdministrador({
      id_usuario: 77, nombre: MALICIOSO, apellido: '<script>window.__xss=1</script>',
      email: '"><svg onload=alert(1)>@x.com', activo: false,
    } as any);

    const html = (swalSpy.mock.calls[0][0] as any).html as string;
    const contenedor = document.createElement('div');
    contenedor.innerHTML = html;
    expect(contenedor.querySelector('img, script, svg, [onerror], [onload]')).toBeNull();
    expect(contenedor.querySelectorAll('b')[0].textContent).toBe(`${MALICIOSO} <script>window.__xss=1</script>`);
    expect(contenedor.textContent).toContain('"><svg onload=alert(1)>@x.com');
  });
});
