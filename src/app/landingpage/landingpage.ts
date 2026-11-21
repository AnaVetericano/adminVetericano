import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

interface HeroSlide {
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly imageClass: string;
}

interface ProblemItem {
  readonly number: string;
  readonly title: string;
  readonly description: string;
  readonly icon: 'shield-check' | 'activity' | 'clipboard-check' | 'clock';
}

export type SolutionTab = 'mobile' | 'web';

interface SolutionFeatureCard {
  readonly tag: string;
  readonly title: string;
  readonly description: string;
  readonly icon:
    | 'map-pin'
    | 'pulse'
    | 'fingerprint'
    | 'file-medical'
    | 'capsule'
    | 'calendar-alert'
    | 'analytics';
}

interface ImpactItem {
  readonly category: string;
  readonly metric: string;
  readonly title: string;
  readonly description: string;
  readonly icon: 'cpu' | 'trending-up' | 'leaf';
}

@Component({
  selector: 'app-landingpage',
  standalone: true,
  imports: [],
  templateUrl: './landingpage.html',
  styleUrl: './landingpage.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Landingpage {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  private autoSlideTimer: number | null = null;
  private readonly autoSlideDelayMs = 3800;

  protected readonly apkDownloadUrl = '/downloads/vetericano-cba.apk';

  protected readonly heroSlides: readonly HeroSlide[] = [
    {
      src: '/images/hero-horse.jpg',
      alt: 'Escultura metálica de caballo del Centro de Bienestar Animal',
      width: 768,
      height: 1024,
      imageClass: 'hero-slide-mask origin-center scale-[1.12] object-[42%_36%]',
    },
    {
      src: '/images/hero-team.jpg',
      alt: 'Equipo del proyecto VETERICANO junto a la escultura metálica del Centro de Bienestar Animal',
      width: 966,
      height: 1024,
      imageClass:
        'hero-slide-team-mask origin-center scale-100 object-[14%_52%] lg:translate-x-[14%] lg:object-[50%_52%] xl:translate-x-[15%]',
    },
  ];

  protected readonly activeSlide = signal(0);
  protected readonly activeSolutionTab = signal<SolutionTab>('mobile');

  protected readonly problems: readonly ProblemItem[] = [
    {
      number: '01',
      title: 'Cero pérdida de información',
      description:
        'Elimina la duplicidad y el extravío de registros médicos y denuncias ciudadanas.',
      icon: 'shield-check',
    },
    {
      number: '02',
      title: 'Seguimiento en tiempo real',
      description:
        'Trazabilidad completa desde el reporte del caso hasta la recuperación del animal.',
      icon: 'activity',
    },
    {
      number: '03',
      title: 'Control médico estricto',
      description:
        'Historias clínicas digitales y control farmacológico preciso.',
      icon: 'clipboard-check',
    },
    {
      number: '04',
      title: 'Respuesta oportuna',
      description:
        'Agiliza los procesos administrativos y médicos para proteger la vida animal.',
      icon: 'clock',
    },
  ];

  protected readonly mobileFeatures: readonly SolutionFeatureCard[] = [
    {
      tag: '01 · Evidencia y GPS',
      title: 'Reporte georreferenciado',
      description:
        'Reporte de peticiones con evidencia fotográfica y georreferenciación exacta.',
      icon: 'map-pin',
    },
    {
      tag: '02 · Trazabilidad',
      title: 'Evolución en tiempo real',
      description:
        'Seguimiento y evolución en tiempo real de los casos reportados.',
      icon: 'pulse',
    },
    {
      tag: '03 · Seguridad',
      title: 'Acceso biométrico',
      description:
        'Acceso seguro mediante autenticación biométrica (reconocimiento facial y dactilar).',
      icon: 'fingerprint',
    },
  ];

  protected readonly webFeatures: readonly SolutionFeatureCard[] = [
    {
      tag: '01 · Expediente Digital',
      title: 'Historias clínicas veterinarias',
      description:
        'Registro y gestión integral de historias clínicas veterinarias.',
      icon: 'file-medical',
    },
    {
      tag: '02 · Farmacia',
      title: 'Formulación y farmacia',
      description:
        'Integración de formulación médica y control farmacológico.',
      icon: 'capsule',
    },
    {
      tag: '03 · Operación',
      title: 'Agendamiento y alertas',
      description:
        'Agendamiento de casos, asignación de responsables y notificaciones de casos no atendidos.',
      icon: 'calendar-alert',
    },
    {
      tag: '04 · Analítica',
      title: 'Asistente Power BI',
      description:
        'Asistente virtual con analítica de datos (estilo Power BI) para la toma de decisiones.',
      icon: 'analytics',
    },
  ];

  protected readonly impacts: readonly ImpactItem[] = [
    {
      category: '01 · Innovación operativa',
      metric: '100% Digital',
      title: 'Impacto Tecnológico',
      description:
        'Digitalización completa de procesos manuales y eficiencia en el diligenciamiento clínico.',
      icon: 'cpu',
    },
    {
      category: '02 · Gestión institucional',
      metric: 'Eficiencia CBA',
      title: 'Impacto Socioeconómico',
      description:
        'Optimización de recursos del CBA, reducción de costos operativos y mayor productividad veterinaria.',
      icon: 'trending-up',
    },
    {
      category: '03 · Sostenibilidad',
      metric: 'Cero Papel',
      title: 'Impacto Ambiental',
      description:
        'Reducción significativa en el consumo de papel mediante historias clínicas y fórmulas 100% digitales.',
      icon: 'leaf',
    },
  ];

  constructor() {
    afterNextRender(() => {
      this.startAutoSlide();
      this.setupScrollReveal();
      this.setupScrollspy();
      this.setupScrollProgressFallback();
    });

    this.destroyRef.onDestroy(() => {
      this.stopAutoSlide();
    });
  }

  selectSlide(index: number): void {
    if (index >= 0 && index < this.heroSlides.length) {
      this.activeSlide.set(index);
      this.startAutoSlide();
    }
  }

  nextSlide(): void {
    this.activeSlide.update((current) => (current + 1) % this.heroSlides.length);
  }

  selectSolutionTab(tab: SolutionTab): void {
    this.activeSolutionTab.set(tab);
  }

  scrollToSection(sectionId: string, event?: Event): void {
    event?.preventDefault();
    this.closeMobileMenu();

    const target = this.document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  goToLogin(): void {
    this.closeMobileMenu();
    void this.router.navigate(['/login']);
  }

  downloadApk(): void {
    const link = this.document.createElement('a');
    link.href = this.apkDownloadUrl;
    link.download = 'VETERICANO-CBA.apk';
    link.rel = 'noopener';
    this.document.body.appendChild(link);
    link.click();
    link.remove();
  }

  private startAutoSlide(): void {
    const win = this.document.defaultView;
    if (!win || this.heroSlides.length <= 1) {
      return;
    }

    this.stopAutoSlide();
    this.autoSlideTimer = win.setInterval(() => {
      this.nextSlide();
    }, this.autoSlideDelayMs);
  }

  private stopAutoSlide(): void {
    const win = this.document.defaultView;
    if (win && this.autoSlideTimer !== null) {
      win.clearInterval(this.autoSlideTimer);
      this.autoSlideTimer = null;
    }
  }

  private setupScrollReveal(): void {
    const win = this.document.defaultView;
    const root = this.hostRef.nativeElement;
    const revealNodes = Array.from(
      root.querySelectorAll<HTMLElement>('[data-reveal]')
    );

    if (!win || typeof win.IntersectionObserver !== 'function') {
      return;
    }

    const prefersReducedMotion =
      typeof win.matchMedia === 'function' &&
      win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      return;
    }

    for (const el of revealNodes) {
      const rect = el.getBoundingClientRect();
      if (rect.top > win.innerHeight * 0.94) {
        el.classList.add('reveal-pending');
      }
    }

    const observer = new win.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            target.classList.remove('reveal-pending');
            target.classList.add('reveal-visible');
            observer.unobserve(target);
          }
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    for (const el of revealNodes) {
      if (el.classList.contains('reveal-pending')) {
        observer.observe(el);
      }
    }

    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  private setupScrollspy(): void {
    const win = this.document.defaultView;
    const root = this.hostRef.nativeElement;
    if (!win) {
      return;
    }

    const navLinks = Array.from(
      root.querySelectorAll<HTMLAnchorElement>('.nav-scrollspy a[href^="#"]')
    );
    if (navLinks.length === 0) {
      return;
    }

    const supportsScrollTargetGroup =
      typeof win.CSS?.supports === 'function' &&
      win.CSS.supports('scroll-target-group: auto');

    if (supportsScrollTargetGroup) {
      const syncAriaCurrent = () => {
        const currentLink = root.querySelector<HTMLAnchorElement>(
          '.nav-scrollspy a:target-current'
        );
        for (const link of navLinks) {
          link.setAttribute('aria-current', link === currentLink ? 'true' : 'false');
        }
      };

      syncAriaCurrent();
      this.document.addEventListener('scrollend', syncAriaCurrent, { passive: true });
      this.destroyRef.onDestroy(() => {
        this.document.removeEventListener('scrollend', syncAriaCurrent);
      });
      return;
    }

    if (typeof win.IntersectionObserver !== 'function') {
      return;
    }

    const trackedIds = ['problema', 'solucion', 'impacto'];
    const sections = trackedIds
      .map((id) => this.document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    const observer = new win.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            for (const link of navLinks) {
              const isActive = link.getAttribute('href') === `#${id}`;
              link.classList.toggle('target-current', isActive);
              link.setAttribute('aria-current', isActive ? 'true' : 'false');
            }
          }
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );

    for (const section of sections) {
      observer.observe(section);
    }

    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  private setupScrollProgressFallback(): void {
    const win = this.document.defaultView;
    if (!win) {
      return;
    }

    const supportsScrollTimeline =
      typeof win.CSS?.supports === 'function' &&
      win.CSS.supports('animation-timeline', 'scroll()');
    if (supportsScrollTimeline) {
      return;
    }

    const prefersReducedMotion =
      typeof win.matchMedia === 'function' &&
      win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      return;
    }

    const progressEl = this.document.getElementById('scroll-progress-bar');
    if (!progressEl) {
      return;
    }

    const updateProgress = () => {
      const scrollable =
        this.document.documentElement.scrollHeight - win.innerHeight;
      const ratio = scrollable > 0 ? Math.min(1, Math.max(0, win.scrollY / scrollable)) : 0;
      progressEl.style.transform = `scaleX(${ratio})`;
    };

    updateProgress();
    win.addEventListener('scroll', updateProgress, { passive: true });
    this.destroyRef.onDestroy(() => {
      win.removeEventListener('scroll', updateProgress);
    });
  }

  private closeMobileMenu(): void {
    const menu = this.document.getElementById('mobile-nav-menu') as
      | (HTMLElement & { hidePopover?: () => void })
      | null;
    if (menu?.matches(':popover-open') && typeof menu.hidePopover === 'function') {
      menu.hidePopover();
    }
  }
}
