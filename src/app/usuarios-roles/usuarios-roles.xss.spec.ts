import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import Swal from 'sweetalert2';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { UsuariosRoles } from './usuarios-roles';

/**
 * XSS almacenado (auditoría C-02): el nombre y el apellido los escribe cualquier ciudadano al
 * registrarse. El diálogo real de SweetAlert2 de "cambiar rol" debe mostrarlos como texto.
 *
 * La comprobación que importa es la ESTRUCTURA del DOM (ningún elemento ni atributo creado a
 * partir del dato y texto literal). La marca window.__xss es solo complementaria: jsdom no
 * ejecuta scripts insertados ni carga imágenes, así que por sí sola no probaría nada.
 */
describe('UsuariosRoles — nombres de ciudadanos como texto (XSS)', () => {
  let component: UsuariosRoles;
  const matchMediaOriginal = window.matchMedia;

  beforeEach(async () => {
    // jsdom no implementa matchMedia y SweetAlert2 lo usa al dibujar el icono del diálogo.
    window.matchMedia = ((consulta: string) => ({
      matches: false, media: consulta, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as any;
    await TestBed.configureTestingModule({
      imports: [UsuariosRoles],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    component = TestBed.createComponent(UsuariosRoles).componentInstance;
    delete (window as any).__xss;
  });

  afterEach(() => {
    Swal.close();
    window.matchMedia = matchMediaOriginal;
    delete (window as any).__xss;
  });

  function abrirDialogoCambioRol(nombre: string, apellido: string, nombreRol = 'Veterinario'): HTMLElement {
    const usuario = { id_usuario: 99, nombre, apellido, id_rol: 4, nombre_rol: 'Peticionario' };
    component.seleccionarNuevoRol(usuario, { id_rol: 3, nombre_rol: nombreRol });
    const contenido = document.querySelector('.swal2-html-container') as HTMLElement;
    expect(contenido).not.toBeNull();
    return contenido;
  }

  const casos: Array<[string, string, string]> = [
    ['etiqueta HTML', '<b>Negrita</b>', '<i>Cursiva</i>'],
    ['script', '<script>window.__xss = 1</script>', 'Pérez'],
    ['atributo onerror', '<img src=x onerror="window.__xss = 1">', 'Gómez'],
    ['svg onload', '<svg onload="window.__xss = 1">', '<a href="javascript:window.__xss=1">x</a>'],
    ['caracteres especiales', `Ana & "Lu" 'Ma' <3`, 'O\'Brien > 2'],
  ];

  for (const [caso, nombre, apellido] of casos) {
    it(`muestra el nombre como texto literal: ${caso}`, () => {
      const contenido = abrirDialogoCambioRol(nombre, apellido);
      const negritas = contenido.querySelectorAll('b');
      // Solo existen las dos <b> de la plantilla, sin elementos creados desde el nombre.
      expect(negritas.length).toBe(2);
      expect(negritas[0].children.length).toBe(0);
      expect(negritas[0].textContent).toBe(`${nombre} ${apellido}`);
      expect(contenido.querySelector('script, img, svg, a, i, iframe, [onerror], [onload]')).toBeNull();
      expect((window as any).__xss).toBeUndefined();
    });
  }

  it('el nombre del rol también se trata como texto', () => {
    const contenido = abrirDialogoCambioRol('Ana', 'Ruiz', '<img src=x onerror="window.__xss = 1">');
    expect(contenido.querySelector('img')).toBeNull();
    expect(contenido.querySelectorAll('b')[1].textContent).toBe('<img src=x onerror="window.__xss = 1">');
  });

  it('la lista de errores del backend al crear usuario se muestra como texto', () => {
    const http = TestBed.inject(HttpTestingController);
    component.usuario = { nombre: 'x', email: 'x@x.com' } as any;
    component.crearUsuario();
    const peticion = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/usuarios/usuarios/'));
    peticion.flush(
      { '<img src=x onerror="window.__xss=1">': ['<svg onload="window.__xss=1">'], nombre: ['<b>negrita</b>'] },
      { status: 400, statusText: 'Bad Request' },
    );
    const contenido = document.querySelector('.swal2-html-container') as HTMLElement;
    expect(contenido).not.toBeNull();
    expect(contenido.querySelector('img, svg, b, [onerror], [onload]')).toBeNull();
    expect(contenido.textContent).toContain('<svg onload="window.__xss=1">');
    expect(contenido.textContent).toContain('<b>negrita</b>');
    // Se conserva el formato de la lista (dl/dt/dd) de la plantilla.
    expect(contenido.querySelectorAll('dt').length).toBe(2);
  });

  it('conserva nombres legítimos con tildes y Unicode y el diseño del diálogo', () => {
    const contenido = abrirDialogoCambioRol('José Ñúñez', 'Ålvarez 李 Zoë');
    expect(contenido.textContent).toBe('Se asignará a José Ñúñez Ålvarez 李 Zoë el rol Veterinario.');
    expect(document.querySelector('.swal2-title')?.textContent).toBe('Confirmar cambio de rol');
    expect(document.querySelector('.swal2-confirm')?.textContent).toBe('Cambiar rol');
  });
});
