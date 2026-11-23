import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PaginadorComponent, PaginarPipe, paginaValida } from './paginador';

@Component({
  imports: [PaginadorComponent, PaginarPipe],
  template: `
    <ul>
      @for (n of items | paginar: pagina : tamano; track n) {
        <li>{{ n }}</li>
      }
    </ul>
    <app-paginador [total]="items.length" [(pagina)]="pagina" [(tamano)]="tamano" (cambio)="cambios.push($event)" />
  `,
})
class AnfitrionComponent {
  items: number[] = Array.from({ length: 84 }, (_, i) => i + 1);
  pagina = 1;
  tamano = 20;
  cambios: { pagina: number; tamano: number }[] = [];
}

function montar(items?: number[]) {
  const fixture = TestBed.createComponent(AnfitrionComponent);
  if (items) fixture.componentInstance.items = items;
  fixture.detectChanges();
  const el: HTMLElement = fixture.nativeElement;
  return {
    fixture,
    el,
    host: fixture.componentInstance,
    filas: () => Array.from(el.querySelectorAll('li')).map((li) => Number(li.textContent)),
    texto: () => (el.querySelector('app-paginador')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    boton: (etiqueta: string) => el.querySelector<HTMLButtonElement>(`button[aria-label="${etiqueta}"]`),
    refrescar: () => {
      fixture.componentRef.changeDetectorRef.markForCheck();
      fixture.detectChanges();
    },
  };
}

describe('paginaValida', () => {
  it('acota la página al rango disponible', () => {
    expect(paginaValida(84, 0, 20)).toBe(1);
    expect(paginaValida(84, 9, 20)).toBe(5);
    expect(paginaValida(0, 3, 20)).toBe(1);
  });
});

describe('PaginarPipe', () => {
  const pipe = new PaginarPipe();
  it('devuelve solo la página pedida sin mutar el arreglo', () => {
    const lista = Array.from({ length: 45 }, (_, i) => i);
    expect(pipe.transform(lista, 3, 20)).toEqual([40, 41, 42, 43, 44]);
    expect(lista.length).toBe(45);
  });
  it('usa la última página si la pedida ya no existe', () => {
    expect(pipe.transform([1, 2, 3], 4, 2)).toEqual([3]);
  });
  it('tolera listas vacías o nulas', () => {
    expect(pipe.transform(null, 1, 20)).toEqual([]);
    expect(pipe.transform([], 1, 20)).toEqual([]);
  });
});

describe('PaginadorComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [AnfitrionComponent] }));

  it('muestra 20 por defecto y el rango sobre el total', () => {
    const t = montar();
    expect(t.filas()).toHaveLength(20);
    expect(t.texto()).toContain('Mostrando 1–20 de 84');
  });

  it('navega con siguiente/anterior y por número, con elipsis', () => {
    const t = montar();
    t.boton('Página siguiente')!.click();
    t.refrescar();
    expect(t.host.pagina).toBe(2);
    expect(t.filas()[0]).toBe(21);
    t.boton('Página 5')!.click();
    t.refrescar();
    expect(t.texto()).toContain('Mostrando 81–84 de 84');
    expect(t.boton('Página siguiente')!.disabled).toBe(true);
    expect(t.host.cambios).toEqual([{ pagina: 2, tamano: 20 }, { pagina: 5, tamano: 20 }]);
  });

  it('al cambiar el tamaño vuelve a la página 1 y emite un solo cambio', () => {
    const t = montar();
    t.host.pagina = 3;
    t.refrescar();
    const select = t.el.querySelector('select')!;
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    t.refrescar();
    expect(t.host.tamano).toBe(50);
    expect(t.host.pagina).toBe(1);
    expect(t.filas()).toHaveLength(50);
    expect(t.host.cambios).toEqual([{ pagina: 1, tamano: 50 }]);
  });

  it('con muchas páginas muestra elipsis', () => {
    const t = montar(Array.from({ length: 300 }, (_, i) => i));
    t.host.pagina = 8;
    t.refrescar();
    const numeros = Array.from(t.el.querySelectorAll('button[aria-label^="Página "]'))
      .map((b) => b.getAttribute('aria-label'))
      .filter((l) => /\d$/.test(l!));
    expect(numeros).toEqual(['Página 1', 'Página 7', 'Página 8', 'Página 9', 'Página 15']);
    expect(t.texto()).toContain('…');
  });

  it('con una sola página solo indica el rango y sin registros no se muestra', () => {
    const t = montar([1, 2, 3]);
    expect(t.texto()).toBe('Mostrando 1–3 de 3');
    expect(t.el.querySelector('nav')).toBeNull();
    t.host.items = [];
    t.refrescar();
    expect(t.texto()).toBe('');
  });
});
