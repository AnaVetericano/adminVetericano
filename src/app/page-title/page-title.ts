import { Component, Injectable, OnDestroy, effect, input, signal } from '@angular/core';
import { TipoAnimalIcon } from '../animal-icon/animal-icon';

/** Encabezado que la página actual muestra en la barra superior del panel. */
export interface EncabezadoPagina {
  titulo: string;
  subtitulo?: string | null;
  /** Etiqueta corta junto al título (p. ej. "Supervisión Legal"). */
  etiqueta?: string | null;
  /** Segunda etiqueta neutra (p. ej. el paciente en la Historia Clínica). */
  detalle?: string | null;
  /** Imagen pequeña junto al título (p. ej. el escudo en la Historia Clínica). */
  imagen?: string | null;
  /** Ícono animado que saluda una vez junto al título (dashboards). */
  animal?: TipoAnimalIcon | null;
}

/** Estado compartido (solo presentación) entre la página activa y la barra superior. */
@Injectable({ providedIn: 'root' })
export class EncabezadoPaginaService {
  private readonly _actual = signal<EncabezadoPagina | null>(null);
  private propietario: object | null = null;

  readonly actual = this._actual.asReadonly();

  publicar(propietario: object, encabezado: EncabezadoPagina): void {
    this.propietario = propietario;
    this._actual.set(encabezado);
  }

  /** Solo limpia si quien sale es la página que publicó el encabezado vigente. */
  limpiar(propietario: object): void {
    if (this.propietario === propietario) {
      this.propietario = null;
      this._actual.set(null);
    }
  }
}

/**
 * Declara el título de la página para mostrarlo en la barra superior.
 * No pinta nada en su lugar; usa las mismas expresiones que tenía el título.
 *
 *   <app-page-title titulo="Proveedores" subtitulo="Gestión de proveedores registrados" />
 *   <app-page-title [titulo]="esVeterinario ? 'Mis peticiones' : 'Peticiones'" etiqueta="Supervisión" />
 */
@Component({
  selector: 'app-page-title',
  template: '',
  host: { style: 'display: none' },
})
export class PageTitleComponent implements OnDestroy {
  readonly titulo = input.required<string>();
  readonly subtitulo = input<string | null | undefined>(null);
  readonly etiqueta = input<string | null | undefined>(null);
  readonly detalle = input<string | null | undefined>(null);
  readonly imagen = input<string | null | undefined>(null);
  readonly animal = input<TipoAnimalIcon | null | undefined>(null);

  private readonly token = {};

  constructor(private readonly encabezado: EncabezadoPaginaService) {
    effect(() => {
      this.encabezado.publicar(this.token, {
        titulo: this.titulo(),
        subtitulo: this.subtitulo(),
        etiqueta: this.etiqueta(),
        detalle: this.detalle(),
        imagen: this.imagen(),
        animal: this.animal(),
      });
    });
  }

  ngOnDestroy(): void {
    this.encabezado.limpiar(this.token);
  }
}
