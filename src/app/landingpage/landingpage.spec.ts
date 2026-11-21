import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { Landingpage } from './landingpage';

describe('Landingpage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Landingpage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the landing component', () => {
    const fixture = TestBed.createComponent(Landingpage);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render main hero title and all corporate sections', () => {
    const fixture = TestBed.createComponent(Landingpage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('h1')?.textContent?.trim()).toBe('VETERICANO');
    expect(el.querySelector('#problema')).not.toBeNull();
    expect(el.querySelector('#solucion')).not.toBeNull();
    expect(el.querySelector('#descargar-app')).not.toBeNull();
    expect(el.querySelector('#impacto')).not.toBeNull();
  });

  it('should navigate to /login when goToLogin is called', () => {
    const fixture = TestBed.createComponent(Landingpage);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.goToLogin();

    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });

  it('should switch hero carousel slides on selectSlide and nextSlide', () => {
    const fixture = TestBed.createComponent(Landingpage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const slideButtons = el.querySelectorAll('[aria-label^="Mostrar imagen"]');
    expect(slideButtons.length).toBe(2);
    expect(slideButtons[0]?.getAttribute('aria-pressed')).toBe('true');

    fixture.componentInstance.nextSlide();
    fixture.detectChanges();
    expect(slideButtons[1]?.getAttribute('aria-pressed')).toBe('true');

    fixture.componentInstance.selectSlide(0);
    fixture.detectChanges();
    expect(slideButtons[0]?.getAttribute('aria-pressed')).toBe('true');
  });

  it('should switch solution tabs between mobile and web modules', () => {
    const fixture = TestBed.createComponent(Landingpage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('#panel-mobile')).not.toBeNull();
    expect(el.querySelector('#panel-web')).toBeNull();

    const webTab = el.querySelector<HTMLButtonElement>('#tab-web');
    webTab?.click();
    fixture.detectChanges();

    expect(el.querySelector('#panel-mobile')).toBeNull();
    expect(el.querySelector('#panel-web')).not.toBeNull();
    expect(webTab?.getAttribute('aria-selected')).toBe('true');
  });
});
