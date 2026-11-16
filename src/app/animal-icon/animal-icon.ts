import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Ícono de línea animado (solo presentación, sin lógica).
 *
 * Uso:
 *   <app-animal-icon tipo="perro" />                       estado vacío (movimiento suave continuo)
 *   <app-animal-icon tipo="gato" />                        búsqueda sin resultados
 *   <app-animal-icon tipo="conejo" />                      inventario / maletín vacío u óptimo
 *   <app-animal-icon tipo="huellas" />                     carga de listas y páginas
 *   <app-animal-icon tipo="perro" modo="una-vez" [tamano]="44" />   encabezado de dashboard
 *
 * Respeta "movimiento reducido" del sistema: en ese caso queda quieto.
 */
export type TipoAnimalIcon = 'perro' | 'gato' | 'conejo' | 'huellas';
export type ModoAnimalIcon = 'continuo' | 'una-vez';

@Component({
  selector: 'app-animal-icon',
  templateUrl: './animal-icon.html',
  styleUrl: './animal-icon.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.una-vez]': "modo() === 'una-vez'",
    '[style.--ai-size.px]': 'tamano()',
  },
})
export class AnimalIconComponent {
  readonly tipo = input<TipoAnimalIcon>('perro');
  readonly modo = input<ModoAnimalIcon>('continuo');
  /** Tamaño en px del ícono (las huellas usan el doble de ancho). */
  readonly tamano = input<number>(72);
  /** Texto accesible solo para las huellas de carga. */
  readonly etiqueta = input<string>('Cargando');

  /** Rastro en zigzag de las cuatro huellas (x y dentro del viewBox 150x56). */
  protected readonly posicionesHuellas = ['4 26', '42 6', '80 26', '118 6'];
}
