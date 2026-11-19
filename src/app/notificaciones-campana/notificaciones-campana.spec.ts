import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { EstadoConexionRealtime, NotificacionItem } from '../models/notificaciones';
import { NotificacionesRealtimeService } from '../services/notificaciones-realtime.service';
import { NotificacionesCampanaComponent } from './notificaciones-campana';

describe('NotificacionesCampanaComponent', () => {
  let component: NotificacionesCampanaComponent;
  let fixture: ComponentFixture<NotificacionesCampanaComponent>;
  let estadoSig: ReturnType<typeof signal<EstadoConexionRealtime>>;
  let notificacionesSig: ReturnType<typeof signal<NotificacionItem[]>>;
  let marcarLeidaSpy: ReturnType<typeof vi.fn<(clave: string) => void>>;
  let marcarTodasSpy: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(async () => {
    estadoSig = signal<EstadoConexionRealtime>('conectado');
    notificacionesSig = signal<NotificacionItem[]>([
      {
        clave: 'pet-10',
        origen: 'peticiones',
        id_notificacion: 10,
        event_type: 'peticion.asignada',
        modulo: 'peticiones',
        tipo: 'ASIGNACION',
        titulo: 'Petición asignada RAD-10',
        mensaje: 'Atender caso en zona norte',
        prioridad: 'Urgente',
        leida: false,
        fecha_creacion: new Date().toISOString(),
        fecha_lectura: null,
        referencia: { id_peticion: 10 }
      },
      {
        clave: 'sis-20',
        origen: 'sistema',
        id_notificacion: 20,
        event_type: 'kit.solicitud_resuelta',
        modulo: 'inventario',
        tipo: 'SOLICITUD_RESUELTA',
        titulo: 'Solicitud de kit aprobada',
        mensaje: 'Se asignaron insumos al maletín',
        prioridad: null,
        leida: false,
        fecha_creacion: new Date().toISOString(),
        fecha_lectura: null,
        referencia: { id_solicitud: 5 }
      }
    ]);

    marcarLeidaSpy = vi.fn((clave: string) => {
      notificacionesSig.update((lista) =>
        lista.map((n) => (n.clave === clave ? { ...n, leida: true } : n))
      );
    });
    marcarTodasSpy = vi.fn(() => {
      notificacionesSig.update((lista) => lista.map((n) => ({ ...n, leida: true })));
    });

    const realtimeMock = {
      estado: estadoSig.asReadonly(),
      notificaciones: notificacionesSig.asReadonly(),
      noLeidas: computed(() => notificacionesSig().filter((n) => !n.leida).length),
      marcarLeida: marcarLeidaSpy,
      marcarTodasLeidas: marcarTodasSpy
    };

    await TestBed.configureTestingModule({
      imports: [NotificacionesCampanaComponent],
      providers: [{ provide: NotificacionesRealtimeService, useValue: realtimeMock }]
    }).compileComponents();

    fixture = TestBed.createComponent(NotificacionesCampanaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('muestra el contador de no leídas y el indicador de estado de conexión', () => {
    const contador = fixture.debugElement.query(By.css('[data-testid="notificaciones-contador"]'));
    expect(contador.nativeElement.textContent.trim()).toBe('2');

    const punto = fixture.debugElement.query(By.css('[data-testid="notificaciones-estado-punto"]'));
    expect(punto.nativeElement.className).toContain('bg-[#067647]');

    estadoSig.set('degradado');
    fixture.detectChanges();
    expect(punto.nativeElement.className).toContain('bg-[#DC6803]');

    estadoSig.set('apagado');
    fixture.detectChanges();
    expect(punto.nativeElement.className).toContain('bg-slate-400');
  });

  it('abre el panel, muestra módulo/título/mensaje/tiempo relativo y permite marcar una o todas como leídas', () => {
    const btnCampana = fixture.debugElement.query(By.css('[data-testid="btn-notificaciones-campana"]'));
    btnCampana.nativeElement.click();
    fixture.detectChanges();

    const panel = fixture.debugElement.query(By.css('[data-testid="panel-notificaciones"]'));
    expect(panel).toBeTruthy();
    expect(panel.nativeElement.textContent).toContain('Petición asignada RAD-10');
    expect(panel.nativeElement.textContent).toContain('Peticiones');
    expect(panel.nativeElement.textContent).toContain('Inventario');

    const btnMarcarUna = fixture.debugElement.queryAll(By.css('[data-testid="btn-marcar-una-leida"]'))[0];
    btnMarcarUna.nativeElement.click();
    fixture.detectChanges();

    expect(marcarLeidaSpy).toHaveBeenCalledWith('pet-10');
    expect(
      fixture.debugElement.query(By.css('[data-testid="notificaciones-contador"]')).nativeElement.textContent.trim()
    ).toBe('1');

    const btnTodas = fixture.debugElement.query(By.css('[data-testid="btn-marcar-todas-leidas"]'));
    btnTodas.nativeElement.click();
    fixture.detectChanges();

    expect(marcarTodasSpy).toHaveBeenCalledTimes(1);
    expect(fixture.debugElement.query(By.css('[data-testid="notificaciones-contador"]'))).toBeNull();
  });
});
