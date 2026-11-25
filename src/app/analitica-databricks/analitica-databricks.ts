import {
  Component,
  OnInit,
  inject,
  ElementRef,
  ViewChild,
  ChangeDetectorRef,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PageTitleComponent } from '../page-title/page-title';

@Component({
  selector: 'app-analitica-databricks',
  standalone: true,
  imports: [CommonModule, FormsModule, PageTitleComponent],
  templateUrl: './analitica-databricks.html',
  styleUrl: './analitica-databricks.css'
})
export class AnaliticaDatabricksComponent implements OnInit {
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('contenedorDashboard') contenedorDashboard?: ElementRef<HTMLDivElement>;
  @ViewChild('iframeDatabricks') iframeDatabricks?: ElementRef<HTMLIFrameElement>;

  /**
   * ============================================================================
   * CONFIGURACIÓN DE URL DE DATABRICKS AI/BI DASHBOARD
   * ============================================================================
   * Pegue aquí la URL de inserción definitiva generada desde Databricks AI/BI:
   * 
   * 1. Abra su Dashboard en Databricks Workspace (AI/BI Dashboards o Lakeview).
   * 2. Haga clic en 'Share' (Compartir) > 'Embed dashboard' (Insertar tablero) 
   *    o utilice el enlace de publicación con permisos configurados.
   * 3. Copie la URL segura generada.
   *    Ejemplo: 'https://<databricks-instance>/embed/dashboardsv3/<dashboard-id>?o=<org-id>'
   *
   * Nota: También es compatible con cualquier URL segura HTTPS de tableros BI.
   * Deje la variable en blanco ('') para ver el asistente interactivo de configuración.
   */
  databricksUrl: string = '';

  /** URL sanitizada de forma segura para usar en el atributo [src] del <iframe> */
  safeDatabricksUrl: SafeResourceUrl | null = null;

  /** Estado de carga visual del iframe */
  cargando: boolean = false;

  /** Indicador de pantalla completa (API nativa o fallback CSS) */
  esPantallaCompleta: boolean = false;

  /** Mensaje de validación en caso de que la URL no cumpla los requisitos de seguridad */
  errorValidacion: string = '';

  /** Campo auxiliar en la vista para previsualizar URLs temporalmente */
  urlPrueba: string = '';

  /** Registro de la última recarga del dashboard */
  ultimaActualizacion: Date = new Date();

  ngOnInit(): void {
    this.inicializarDashboard();
  }

  /**
   * Valida que la URL sea segura (HTTPS) y la sanitiza mediante DomSanitizer.
   */
  inicializarDashboard(): void {
    this.errorValidacion = '';
    const urlLimpia = this.databricksUrl.trim();

    if (!urlLimpia) {
      this.safeDatabricksUrl = null;
      this.cargando = false;
      this.cdr.markForCheck();
      return;
    }

    // Validación básica: requiere protocolo seguro HTTPS
    if (!urlLimpia.toLowerCase().startsWith('https://')) {
      this.errorValidacion = 'Por motivos de seguridad, la URL de Databricks debe comenzar con https://';
      this.safeDatabricksUrl = null;
      this.cargando = false;
      this.cdr.markForCheck();
      return;
    }

    this.cargando = true;
    this.safeDatabricksUrl = this.sanitizer.bypassSecurityTrustResourceUrl(urlLimpia);
    this.ultimaActualizacion = new Date();
    this.cdr.markForCheck();
  }

  /**
   * Disparado cuando el <iframe> finaliza la carga del dashboard.
   */
  onIframeLoaded(): void {
    this.cargando = false;
    this.cdr.markForCheck();
  }

  /**
   * Recarga el iframe de Databricks sin recargar la aplicación completa de Angular.
   */
  actualizarVista(): void {
    if (!this.safeDatabricksUrl) return;

    this.cargando = true;
    this.ultimaActualizacion = new Date();

    if (this.iframeDatabricks && this.iframeDatabricks.nativeElement) {
      const iframe = this.iframeDatabricks.nativeElement;
      const srcOriginal = iframe.src;
      iframe.src = '';
      setTimeout(() => {
        iframe.src = srcOriginal;
      }, 60);
    } else {
      this.inicializarDashboard();
    }
  }

  /**
   * Alterna el modo de pantalla completa utilizando la API nativa de Fullscreen
   * con fallback reactivo a clases CSS si el navegador restringe la API.
   */
  togglePantallaCompleta(): void {
    const contenedor = this.contenedorDashboard?.nativeElement;

    if (!document.fullscreenElement && contenedor) {
      if (contenedor.requestFullscreen) {
        contenedor.requestFullscreen().catch(() => {
          this.esPantallaCompleta = !this.esPantallaCompleta;
        });
      } else {
        this.esPantallaCompleta = !this.esPantallaCompleta;
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {
          this.esPantallaCompleta = false;
        });
      } else {
        this.esPantallaCompleta = false;
      }
    }
  }

  /**
   * Sincroniza el estado cuando el usuario sale de pantalla completa mediante la tecla ESC.
   */
  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.esPantallaCompleta = !!document.fullscreenElement;
    this.cdr.markForCheck();
  }

  /**
   * Permite probar un enlace ingresado en la interfaz sin tocar el código fuente.
   */
  probarEnlace(): void {
    const enlace = this.urlPrueba.trim();
    if (enlace) {
      this.databricksUrl = enlace;
      this.inicializarDashboard();
    }
  }
}
