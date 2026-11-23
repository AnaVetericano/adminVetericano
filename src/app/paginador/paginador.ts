import { ChangeDetectionStrategy, Component, Pipe, PipeTransform, computed, input, model, output } from '@angular/core';

/** Tamaño de página por defecto de todas las listas del panel. */
export const TAMANO_PAGINA_PREDETERMINADO = 20;

/** Página válida (1..total de páginas) para un total y tamaño dados. */
export function paginaValida(total: number, pagina: number, tamano: number): number {
  const paginas = Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, tamano)));
  return Math.min(Math.max(1, Math.floor(pagina) || 1), paginas);
}

/**
 * Recorta en cliente la página visible de una lista que ya está completa en memoria.
 * Uso: `@for (x of lista | paginar: pagina : tamanoPagina; track ...)`.
 * No modifica el arreglo original, así KPIs, conteos y exportaciones siguen usando la lista completa.
 */
@Pipe({ name: 'paginar' })
export class PaginarPipe implements PipeTransform {
  transform<T>(items: readonly T[] | null | undefined, pagina: number, tamano: number): T[] {
    if (!items?.length) return [];
    const tam = Math.max(1, tamano);
    const inicio = (paginaValida(items.length, pagina, tam) - 1) * tam;
    return items.slice(inicio, inicio + tam);
  }
}

/**
 * Controles de paginación reutilizables (cliente o servidor).
 * - Cliente: `<app-paginador [total]="lista.length" [(pagina)]="pagina" [(tamano)]="tamanoPagina" />`
 *   y en el bucle `lista | paginar: pagina : tamanoPagina`.
 * - Servidor: `[total]="count" [(pagina)]="pagina" [(tamano)]="tamanoPagina" (cambio)="cargar()"`;
 *   `cambio` se emite una sola vez por acción, ya con `pagina` y `tamano` actualizados.
 * No se muestra si no hay registros; con una sola página solo indica el rango.
 */
@Component({
  selector: 'app-paginador',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (total() > 0) {
      <div
        class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-xs text-slate-600"
        [class]="variante() === 'tabla'
          ? 'bg-slate-50 border-t border-slate-200'
          : 'bg-white rounded-xl border border-slate-200 shadow-xs'">
        <p class="font-medium" aria-live="polite">
          Mostrando <span class="font-bold text-[#170B3D]">{{ desde() }}–{{ hasta() }}</span>
          de <span class="font-bold text-[#170B3D]">{{ total() }}</span>
        </p>

        @if (conControles()) {
          <div class="flex flex-wrap items-center gap-3">
            <label class="flex items-center gap-1.5 font-medium text-slate-500">
              Por página
              <select
                class="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 cursor-pointer focus:outline-none focus:border-[#4141A5] focus:ring-2 focus:ring-[#4141A5]/20"
                aria-label="Registros por página"
                [value]="tamano()"
                (change)="cambiarTamano($any($event.target).value)">
                @for (op of opciones(); track op) {
                  <option [value]="op" [selected]="op === tamano()">{{ op }}</option>
                }
              </select>
            </label>

            @if (totalPaginas() > 1) {
              <nav class="segmentado no-levitate inline-flex items-center gap-0.5 p-1 bg-slate-100 rounded-lg border border-slate-200" aria-label="Paginación">
                <button type="button"
                  class="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-600 hover:bg-white hover:text-[#4141A5] disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
                  aria-label="Página anterior"
                  [disabled]="paginaActual() <= 1"
                  (click)="irA(paginaActual() - 1)">
                  <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12.5 15l-5-5 5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>

                @for (p of paginas(); track $index) {
                  @if (p === null) {
                    <span class="hidden sm:inline-flex h-7 w-6 items-center justify-center text-slate-400 select-none" aria-hidden="true">…</span>
                  } @else {
                    <button type="button"
                      class="hidden sm:inline-flex items-center justify-center h-7 min-w-7 px-2 rounded-md text-xs font-bold tabular-nums cursor-pointer transition-colors"
                      [class]="p === paginaActual() ? 'bg-[#4141A5] text-white shadow-xs' : 'text-slate-700 hover:bg-white hover:text-[#4141A5]'"
                      [attr.aria-current]="p === paginaActual() ? 'page' : null"
                      [attr.aria-label]="'Página ' + p"
                      (click)="irA(p)">{{ p }}</button>
                  }
                }
                <span class="sm:hidden px-2 font-bold tabular-nums text-[#170B3D]">{{ paginaActual() }} / {{ totalPaginas() }}</span>

                <button type="button"
                  class="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-600 hover:bg-white hover:text-[#4141A5] disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
                  aria-label="Página siguiente"
                  [disabled]="paginaActual() >= totalPaginas()"
                  (click)="irA(paginaActual() + 1)">
                  <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7.5 5l5 5-5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
              </nav>
            }
          </div>
        }
      </div>
    }
  `,
})
export class PaginadorComponent {
  /** Total de registros (de la lista filtrada en cliente o el `count` del servidor). */
  readonly total = input.required<number>();
  readonly pagina = model(1);
  readonly tamano = model(TAMANO_PAGINA_PREDETERMINADO);
  readonly opciones = input<readonly number[]>([10, 20, 50]);
  /** `tabla`: franja inferior de una tabla. `suelto`: tarjeta propia (grids de tarjetas). */
  readonly variante = input<'tabla' | 'suelto'>('tabla');
  /** Una emisión por acción del usuario (página o tamaño), con los valores ya aplicados. */
  readonly cambio = output<{ pagina: number; tamano: number }>();

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / Math.max(1, this.tamano()))));
  readonly paginaActual = computed(() => paginaValida(this.total(), this.pagina(), this.tamano()));
  readonly desde = computed(() => (this.paginaActual() - 1) * this.tamano() + 1);
  readonly hasta = computed(() => Math.min(this.total(), this.paginaActual() * this.tamano()));
  /** Con pocos registros (cabe todo en el menor tamaño) solo se muestra el rango. */
  readonly conControles = computed(() => this.total() > Math.min(...this.opciones()));

  /** Números visibles: primera, última y vecinas de la actual; `null` = elipsis. */
  readonly paginas = computed<(number | null)[]>(() => {
    const total = this.totalPaginas();
    const actual = this.paginaActual();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const inicio = Math.max(2, Math.min(actual - 1, total - 4));
    const fin = Math.min(total - 1, Math.max(actual + 1, 5));
    const resultado: (number | null)[] = [1];
    if (inicio > 2) resultado.push(null);
    for (let p = inicio; p <= fin; p++) resultado.push(p);
    if (fin < total - 1) resultado.push(null);
    resultado.push(total);
    return resultado;
  });

  irA(pagina: number): void {
    const destino = paginaValida(this.total(), pagina, this.tamano());
    if (destino === this.pagina()) return;
    this.pagina.set(destino);
    this.cambio.emit({ pagina: destino, tamano: this.tamano() });
  }

  cambiarTamano(valor: string | number): void {
    const tamano = Number(valor);
    if (!Number.isFinite(tamano) || tamano <= 0 || tamano === this.tamano()) return;
    this.tamano.set(tamano);
    if (this.pagina() !== 1) this.pagina.set(1);
    this.cambio.emit({ pagina: 1, tamano });
  }
}
