import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InventarioJuridicoComponent } from './inventario-juridico';

const MALICIOSO = '<img src=x onerror="window.__xss = 1">';

describe('InventarioJuridico — reporte PDF del veterinario sin HTML ejecutable (XSS)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('document.write recibe nombre, correo y productos escapados', async () => {
    await TestBed.configureTestingModule({
      imports: [InventarioJuridicoComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    const component = TestBed.createComponent(InventarioJuridicoComponent).componentInstance;

    let escrito = '';
    const ventanaFalsa = {
      document: { write: (html: string) => (escrito += html), close: () => {} },
      focus: () => {}, print: () => {}, close: () => {},
    };
    vi.spyOn(window, 'open').mockReturnValue(ventanaFalsa as any);
    vi.useFakeTimers();

    component.veterinarioSeleccionado = { nombre: MALICIOSO, email: '"><script>window.__xss=1</script>' };
    component.idVeterinarioSeleccionado = 7;
    component.itemsVeterinarioFiltrados = [
      { id_medicamento: 1, nombre: '<svg onload="window.__xss=1">', presentacion: '<b>caja</b>',
        tipo: '<i onmouseover="window.__xss=1">x</i>', cantidadEntregada: 2, cantidadConsumida: 1 } as any,
    ];

    component.exportarVeterinarioPDF();
    vi.useRealTimers();

    expect(escrito.length).toBeGreaterThan(0);
    const doc = new DOMParser().parseFromString(escrito, 'text/html');
    // La plantilla del reporte no usa <b> ni <i>: cualquiera vendría del dato.
    expect(doc.querySelector('img, script, svg, b, i, [onerror], [onload], [onmouseover]')).toBeNull();
    for (const literal of [MALICIOSO, '<svg onload="window.__xss=1">', '<b>caja</b>', '<i onmouseover="window.__xss=1">x</i>',
      '"><script>window.__xss=1</script>']) {
      expect(doc.body.textContent).toContain(literal);
    }
  });

  it('el reporte PDF general también inserta los datos del catálogo como texto', async () => {
    await TestBed.configureTestingModule({
      imports: [InventarioJuridicoComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    const component = TestBed.createComponent(InventarioJuridicoComponent).componentInstance;
    let escrito = '';
    vi.spyOn(window, 'open').mockReturnValue({
      document: { write: (html: string) => (escrito += html), close: () => {} },
      focus: () => {}, print: () => {}, close: () => {},
    } as any);
    vi.useFakeTimers();
    component.filas = [{
      idInv: 3, nombre: MALICIOSO, descripcion: '<b>d</b>', stock: 1, cantidadEntrada: 1, vencimiento: '2027-01-01',
      estado: 'disponible', estadoDb: '<svg onload=1>', proveedor: '<i>p</i>', facturaTexto: '<script>x</script>',
    }];
    component.exportarGeneralPDF();
    vi.useRealTimers();

    const doc = new DOMParser().parseFromString(escrito, 'text/html');
    expect(doc.querySelector('img, script, svg, b, i, [onerror], [onload]')).toBeNull();
    for (const literal of [MALICIOSO, '<b>d</b>', '<svg onload=1>', '<i>p</i>', '<script>x</script>']) {
      expect(doc.body.textContent).toContain(literal);
    }
  });
});
