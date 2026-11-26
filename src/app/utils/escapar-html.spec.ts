import { describe, expect, it } from 'vitest';
import { escaparHtml } from './escapar-html';

/** Inserta el HTML resultante en un contenedor real del DOM (jsdom), como hace SweetAlert2. */
function renderizar(html: string): HTMLDivElement {
  const contenedor = document.createElement('div');
  contenedor.innerHTML = html;
  return contenedor;
}

describe('escaparHtml', () => {
  const maliciosos = [
    '<b>negrita</b>',
    '<script>window.__xss = 1</script>',
    '<img src=x onerror="window.__xss = 1">',
    '<svg onload=alert(1)>',
    '"><iframe src="javascript:alert(1)"></iframe>',
    "' onmouseover='alert(1)",
  ];

  for (const texto of maliciosos) {
    it(`muestra como texto y no crea elementos: ${texto}`, () => {
      const contenedor = renderizar(`Se asignará a <b>${escaparHtml(texto)}</b>`);
      const negrita = contenedor.querySelector('b')!;
      // El único elemento es la <b> de la plantilla; el contenido del usuario es un nodo de texto.
      expect(negrita.children.length).toBe(0);
      expect(negrita.textContent).toBe(texto);
      expect(contenedor.querySelector('script, img, svg, iframe, [onerror], [onload], [onmouseover]')).toBeNull();
      expect((window as any).__xss).toBeUndefined();
    });
  }

  it('escapa los caracteres especiales de HTML', () => {
    expect(escaparHtml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;');
  });

  it('conserva nombres legítimos con tildes, ñ y Unicode', () => {
    const nombre = 'José Ñúñez Ålvarez 李小龍 Zoë 🐾';
    expect(escaparHtml(nombre)).toBe(nombre);
    expect(renderizar(escaparHtml(nombre)).textContent).toBe(nombre);
  });

  it('acepta valores no textuales sin fallar', () => {
    expect(escaparHtml(null)).toBe('');
    expect(escaparHtml(undefined)).toBe('');
    expect(escaparHtml(42)).toBe('42');
  });
});
