import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import {
  AlertaDuplicadoDetalle,
  PeticionAlertaDetalle,
  ResolverAlertaDuplicadoResponse
} from '../../models/duplicados.model';
import { AlertasDuplicadosService } from '../../services/alertas-duplicados.service';
import { AuthService } from '../../services/auth';
import { AlertaDuplicadoComparacionComponent } from './alerta-duplicado-comparacion';

interface RolMock {
  autenticado: boolean;
  id_rol: number;
  rol: string;
}

function crearAuthServiceMock(inicial: RolMock) {
  const estado = signal<RolMock>(inicial);
  return {
    estado,
    isAuthenticated: () => estado().autenticado,
    currentUser: () =>
      estado().autenticado
        ? { id_usuario: 7, id_rol: estado().id_rol, rol: estado().rol, nombre: 'Ana', apellido: 'López' }
        : null,
    userRole: () => estado().rol,
    isSuperAdmin: () => estado().autenticado && estado().id_rol === 5,
    isAdmin: () => estado().autenticado && estado().id_rol === 1,
    isJuridico: () => estado().autenticado && estado().id_rol === 2,
    isVeterinario: () => estado().autenticado && estado().id_rol === 3
  };
}

function crearPeticionDetalleMock(
  id: number,
  overrides: Partial<PeticionAlertaDetalle> = {}
): PeticionAlertaDetalle {
  return {
    id_peticion: id,
    numero_radicado: `RAD-2026-000${id}`,
    codigo: `RAD-2026-000${id}`,
    tipo: { id_tipo: 1, nombre: 'Maltrato animal' },
    estado: { id_estado: 2, nombre: 'Asignada', descripcion: null, orden: 2 },
    ubicacion: {
      id_ubicacion: 500 + id,
      direccion: `Calle ${id} # 10-20`,
      latitud: 4.60971,
      longitud: -74.08175
    },
    descripcion: `Reporte detallado del caso #${id} en vía pública.`,
    prioridad: 'Alta',
    fecha: '2026-11-14T10:30:00Z',
    foto: `https://cdn.vetericano.test/evidencia-${id}.jpg`,
    fotos: [`https://cdn.vetericano.test/evidencia-${id}.jpg`],
    total_fotos: 1,
    asignacion: {
      asignada: true,
      asignado_a: {
        id_usuario: 12,
        nombre: 'Carlos',
        apellido: 'Pérez',
        nombre_completo: 'Carlos Pérez',
        email: 'carlos.vet@vetericano.test',
        matricula_profesional: 'MP-4589'
      },
      asignado_por: null,
      fecha_asignacion: '2026-11-14T11:00:00Z'
    },
    evidencias: [
      {
        id_evidencia: 1,
        ruta_archivo: `https://cdn.vetericano.test/evidencia-${id}.jpg`,
        descripcion: 'Foto principal del reporte'
      }
    ],
    es_peticion_origen: false,
    es_peticion_principal: false,
    ...overrides
  };
}

function crearAlertaDetalleMock(
  overrides: Partial<AlertaDuplicadoDetalle> = {}
): AlertaDuplicadoDetalle {
  const menor =
    overrides.peticion_menor !== undefined
      ? overrides.peticion_menor
      : crearPeticionDetalleMock(101);
  const mayor =
    overrides.peticion_mayor !== undefined
      ? overrides.peticion_mayor
      : crearPeticionDetalleMock(102, {
          es_peticion_origen: true
        });

  return {
    id_alerta: 42,
    estado_revision: 'PENDIENTE',
    peticion_menor_id: 101,
    peticion_mayor_id: 102,
    peticion_origen_id: 102,
    peticion_principal_id: null,
    similitud_texto: 0.8542,
    coincidencia_texto: true,
    distancia_metros: 45.28,
    coincidencia_gps: true,
    distancia_hamming: null,
    similitud_imagen: null,
    coincidencia_imagen: false,
    score_combinado: 0.785,
    criterios_coincidencia: ['texto', 'gps'],
    origen_deteccion: 'REGISTRO_PETICION',
    observacion_revision: null,
    revisado_por: null,
    fecha_revision: null,
    fecha_creacion: '2026-11-14T10:35:00Z',
    fecha_actualizacion: '2026-11-14T10:35:00Z',
    peticion_menor: menor,
    peticion_mayor: mayor,
    comparacion: {
      peticion_menor_id: 101,
      peticion_mayor_id: 102,
      mismo_tipo: true,
      mismo_estado: false,
      ambas_asignadas: true,
      mismo_veterinario_asignado: true,
      diferencia_tiempo_horas: 2.5,
      metricas: {
        similitud_texto: 0.8542,
        coincidencia_texto: true,
        distancia_metros: 45.28,
        coincidencia_gps: true,
        distancia_hamming: null,
        similitud_imagen: null,
        coincidencia_imagen: false,
        score_combinado: 0.785,
        criterios_coincidencia: ['texto', 'gps']
      }
    },
    ...overrides
  };
}

describe('AlertaDuplicadoComparacionComponent (Etapa 2)', () => {
  let fixture: ComponentFixture<AlertaDuplicadoComparacionComponent>;
  let component: AlertaDuplicadoComparacionComponent;
  let httpMock: HttpTestingController;
  let authMock: ReturnType<typeof crearAuthServiceMock>;
  const baseUrl = environment.apiUrlPeticiones.replace(/\/+$/, '');

  beforeEach(async () => {
    authMock = crearAuthServiceMock({
      autenticado: true,
      id_rol: 2,
      rol: 'Jurídico'
    });

    await TestBed.configureTestingModule({
      imports: [AlertaDuplicadoComparacionComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authMock },
        AlertasDuplicadosService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AlertaDuplicadoComparacionComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function cargarAlertaEnComponente(alerta: AlertaDuplicadoDetalle): void {
    fixture.componentRef.setInput('idAlerta', alerta.id_alerta);
    fixture.detectChanges();

    const req = httpMock.expectOne(`${baseUrl}/duplicados/alertas/${alerta.id_alerta}/`);
    expect(req.request.method).toBe('GET');
    req.flush(alerta);
    fixture.detectChanges();
  }

  it('debe cargar el detalle, renderizar peticiones lado a lado, métricas y datos faltantes como No disponible', () => {
    const alerta = crearAlertaDetalleMock({
      peticion_mayor: crearPeticionDetalleMock(102, {
        numero_radicado: null,
        codigo: null,
        tipo: null,
        estado: null,
        prioridad: null,
        descripcion: null,
        ubicacion: { id_ubicacion: 602, direccion: null, latitud: null, longitud: null },
        fecha: null,
        foto: null,
        fotos: [],
        total_fotos: 0,
        evidencias: [],
        asignacion: {
          asignada: false,
          asignado_a: null,
          asignado_por: null,
          fecha_asignacion: null
        }
      })
    });

    cargarAlertaEnComponente(alerta);

    const root: HTMLElement = fixture.nativeElement;
    const textoSimilitud = root.querySelector('[data-testid="metrica-similitud-texto"]')?.textContent?.trim();
    const textoDistancia = root.querySelector('[data-testid="metrica-distancia-gps"]')?.textContent?.trim();
    const textoImagen = root.querySelector('[data-testid="metrica-similitud-imagen"]')?.textContent?.trim();

    expect(textoSimilitud).toBe('85.4%');
    expect(textoDistancia).toBe('45.3 m');
    expect(textoImagen).toBe('No disponible');

    const tarjetaMenor = root.querySelector('[data-testid="tarjeta-peticion-menor"]')?.textContent || '';
    const tarjetaMayor = root.querySelector('[data-testid="tarjeta-peticion-mayor"]')?.textContent || '';

    expect(tarjetaMenor).toContain('RAD-2026-000101');
    expect(tarjetaMenor).toContain('Maltrato animal');
    expect(tarjetaMenor).toContain('Carlos Pérez');
    expect(tarjetaMenor).toContain('4.609710, -74.081750');

    expect(tarjetaMayor).toContain('No disponible');
    expect(tarjetaMayor).toContain('Esta petición no tiene fotografías ni videos adjuntos');
  });

  it('debe distinguir fotografías y videos sin interpretarlos erróneamente y deduplicar URLs', () => {
    const urlFoto = 'https://res.cloudinary.com/vetericano/image/upload/v1/foto1.jpg';
    const urlVideo = 'https://res.cloudinary.com/vetericano/video/upload/v1/video1.mp4';

    const alerta = crearAlertaDetalleMock({
      peticion_menor: crearPeticionDetalleMock(101, {
        foto: urlFoto,
        fotos: [urlFoto, urlVideo],
        total_fotos: 2,
        evidencias: [
          { id_evidencia: 1, ruta_archivo: urlFoto, descripcion: 'Foto en el lugar' },
          { id_evidencia: 2, ruta_archivo: urlVideo, descripcion: 'Video del animal' }
        ]
      })
    });

    cargarAlertaEnComponente(alerta);

    const colMenor = component.columnasComparacion[0];
    expect(colMenor.multimedia.length).toBe(2);
    expect(colMenor.totalFotos).toBe(1);
    expect(colMenor.totalVideos).toBe(1);

    const tarjetaMenor: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="tarjeta-peticion-menor"]'
    );
    const imgs = tarjetaMenor.querySelectorAll('img');
    const videos = tarjetaMenor.querySelectorAll('video');

    expect(imgs.length).toBe(1);
    expect(videos.length).toBe(1);
    expect(imgs[0].getAttribute('src')).toBe(urlFoto);
    expect(videos[0].getAttribute('src')).toBe(urlVideo);

    // Al hacer clic en el botón del video se abre el visor usando <video> y no <img>
    const btnVideo = videos[0].closest('button') as HTMLButtonElement;
    expect(btnVideo).toBeTruthy();
    btnVideo.click();
    fixture.detectChanges();

    expect(component.mediaActiva?.tipo).toBe('video');
    expect(fixture.nativeElement.querySelector('video[controls]')).toBeTruthy();

    component.cerrarVisorMedia();
    fixture.detectChanges();
    expect(component.mediaActiva).toBeNull();
  });

  it('debe validar petición principal al confirmar, evitar doble envío y pasar a solo lectura tras éxito', () => {
    const emitidosResuelta: ResolverAlertaDuplicadoResponse[] = [];
    component.alertaResuelta.subscribe((r) => emitidosResuelta.push(r));

    const alertaPendiente = crearAlertaDetalleMock();
    cargarAlertaEnComponente(alertaPendiente);

    // 1. Seleccionar CONFIRMADO sin petición principal e intentar enviar -> error local, sin HTTP POST
    const btnConfirmado: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="btn-opcion-confirmado"]'
    );
    btnConfirmado.click();
    fixture.detectChanges();

    const btnEnviar: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="btn-enviar-resolucion"]'
    );
    btnEnviar.click();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="mensaje-error-resolucion"]')?.textContent
    ).toContain('petición principal');
    httpMock.expectNone(`${baseUrl}/duplicados/alertas/42/resolver/`);

    // 2. Elegir petición principal y escribir observación
    const btnPrincipalMenor: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="radio-principal-menor"]'
    );
    btnPrincipalMenor.click();
    component.observacion = '  Mismo caso reportado por vecinos distintos.  ';
    fixture.detectChanges();

    // Enviar e intentar segundo clic inmediato -> solo 1 POST
    btnEnviar.click();
    component.confirmarResolucion();
    fixture.detectChanges();

    expect(component.resolviendo).toBe(true);
    const reqPost = httpMock.expectOne(`${baseUrl}/duplicados/alertas/42/resolver/`);
    expect(reqPost.request.method).toBe('POST');
    expect(reqPost.request.body).toEqual({
      estado_revision: 'CONFIRMADO',
      peticion_principal: 101,
      observacion: 'Mismo caso reportado por vecinos distintos.'
    });

    const alertaConfirmada = crearAlertaDetalleMock({
      estado_revision: 'CONFIRMADO',
      peticion_principal_id: 101,
      observacion_revision: 'Mismo caso reportado por vecinos distintos.',
      fecha_revision: '2026-11-14T12:00:00Z',
      revisado_por: {
        id_usuario: 7,
        nombre: 'Ana',
        apellido: 'López',
        nombre_completo: 'Ana López',
        email: 'juridico@vetericano.test'
      },
      peticion_menor: crearPeticionDetalleMock(101, { es_peticion_principal: true })
    });

    reqPost.flush({
      mensaje: 'Alerta de duplicado confirmada correctamente.',
      cambiada: true,
      estado_anterior: 'PENDIENTE',
      estado_nuevo: 'CONFIRMADO',
      alerta: alertaConfirmada
    });
    fixture.detectChanges();

    expect(component.resolviendo).toBe(false);
    expect(component.esSoloLectura).toBe(true);
    expect(emitidosResuelta.length).toBe(1);
    expect(emitidosResuelta[0].estado_nuevo).toBe('CONFIRMADO');
    expect(fixture.nativeElement.querySelector('[data-testid="panel-solo-lectura"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="panel-edicion-resolucion"]')).toBeNull();
  });

  it('debe resolver como DESCARTADO sin enviar peticion_principal incluso tras haber marcado una antes', () => {
    const emitidosResuelta: ResolverAlertaDuplicadoResponse[] = [];
    component.alertaResuelta.subscribe((r) => emitidosResuelta.push(r));

    cargarAlertaEnComponente(crearAlertaDetalleMock());

    // Primero selecciona CONFIRMADO + principal, luego cambia a DESCARTADO
    component.seleccionarDecision('CONFIRMADO');
    component.seleccionarPeticionPrincipal(102);
    expect(component.peticionPrincipalSeleccionada).toBe(102);

    const btnDescartado: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="btn-opcion-descartado"]'
    );
    btnDescartado.click();
    component.observacion = 'Son animales de distinto pelaje y zona.';
    fixture.detectChanges();

    expect(component.peticionPrincipalSeleccionada).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="selector-peticion-principal"]')
    ).toBeNull();

    const btnEnviar: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="btn-enviar-resolucion"]'
    );
    btnEnviar.click();

    const reqPost = httpMock.expectOne(`${baseUrl}/duplicados/alertas/42/resolver/`);
    expect(reqPost.request.method).toBe('POST');
    expect(reqPost.request.body).toEqual({
      estado_revision: 'DESCARTADO',
      observacion: 'Son animales de distinto pelaje y zona.'
    });
    expect('peticion_principal' in reqPost.request.body).toBe(false);

    const alertaDescartada = crearAlertaDetalleMock({
      estado_revision: 'DESCARTADO',
      peticion_principal_id: null,
      observacion_revision: 'Son animales de distinto pelaje y zona.',
      fecha_revision: '2026-11-14T12:10:00Z'
    });

    reqPost.flush({
      mensaje: 'Alerta de duplicado descartada correctamente.',
      cambiada: true,
      estado_anterior: 'PENDIENTE',
      estado_nuevo: 'DESCARTADO',
      alerta: alertaDescartada
    });
    fixture.detectChanges();

    expect(emitidosResuelta.length).toBe(1);
    expect(emitidosResuelta[0].estado_nuevo).toBe('DESCARTADO');
    expect(component.esSoloLectura).toBe(true);
  });

  it('debe manejar HTTP 409 recargando el detalle y mostrando que otra persona ya resolvió la alerta', () => {
    const emitidosResuelta: ResolverAlertaDuplicadoResponse[] = [];
    component.alertaResuelta.subscribe((r) => emitidosResuelta.push(r));

    cargarAlertaEnComponente(crearAlertaDetalleMock());

    component.seleccionarDecision('CONFIRMADO');
    component.seleccionarPeticionPrincipal(101);
    component.observacion = 'Intento simultáneo';
    component.confirmarResolucion();

    // Respuesta 409 desde el servidor
    const reqPost = httpMock.expectOne(`${baseUrl}/duplicados/alertas/42/resolver/`);
    reqPost.flush(
      { error: 'La alerta #42 ya fue resuelta previamente en estado DESCARTADO.' },
      { status: 409, statusText: 'Conflict' }
    );

    // Debe dispararse automáticamente un GET para recargar el estado actualizado
    const reqRecarga = httpMock.expectOne(`${baseUrl}/duplicados/alertas/42/`);
    expect(reqRecarga.request.method).toBe('GET');

    const alertaResueltaPorOtro = crearAlertaDetalleMock({
      estado_revision: 'DESCARTADO',
      peticion_principal_id: null,
      observacion_revision: 'Descartada por otro revisor jurídico.',
      fecha_revision: '2026-11-14T11:55:00Z',
      revisado_por: {
        id_usuario: 99,
        nombre: 'Sofía',
        apellido: 'Rojas',
        nombre_completo: 'Sofía Rojas',
        email: 'sofia.admin@vetericano.test'
      }
    });
    reqRecarga.flush(alertaResueltaPorOtro);
    fixture.detectChanges();

    const banner409: HTMLElement | null = fixture.nativeElement.querySelector(
      '[data-testid="banner-conflicto-409"]'
    );
    expect(banner409).toBeTruthy();
    expect(banner409?.textContent).toContain('Otra persona ya resolvió esta alerta');
    expect(component.esSoloLectura).toBe(true);
    expect(component.detalle?.estado_revision).toBe('DESCARTADO');
    expect(fixture.nativeElement.querySelector('[data-testid="panel-solo-lectura"]')?.textContent).toContain(
      'Sofía Rojas'
    );
    expect(emitidosResuelta.length).toBe(0);
  });

  it('debe mostrar alertas ya resueltas en modo solo lectura desde la carga inicial', () => {
    const alertaConfirmada = crearAlertaDetalleMock({
      estado_revision: 'CONFIRMADO',
      peticion_principal_id: 102,
      observacion_revision: 'Duplicidad verificada en inspección previa.',
      fecha_revision: '2026-11-13T16:40:00Z',
      revisado_por: {
        id_usuario: 1,
        nombre: 'Laura',
        apellido: 'Méndez',
        nombre_completo: 'Laura Méndez',
        email: 'admin@vetericano.test'
      },
      peticion_mayor: crearPeticionDetalleMock(102, { es_peticion_principal: true })
    });

    cargarAlertaEnComponente(alertaConfirmada);

    expect(component.esSoloLectura).toBe(true);
    expect(component.puedeEditarResolucion).toBe(false);

    const panelSoloLectura: HTMLElement | null = fixture.nativeElement.querySelector(
      '[data-testid="panel-solo-lectura"]'
    );
    expect(panelSoloLectura).toBeTruthy();
    expect(panelSoloLectura?.textContent).toContain('Duplicado confirmado');
    expect(panelSoloLectura?.textContent).toContain('Laura Méndez');
    expect(panelSoloLectura?.textContent).toContain('RAD-2026-000102 (#102)');
    expect(panelSoloLectura?.textContent).toContain('Duplicidad verificada en inspección previa.');
    expect(fixture.nativeElement.querySelector('[data-testid="panel-edicion-resolucion"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="btn-enviar-resolucion"]')).toBeNull();
  });

  it('debe bloquear acceso a roles no autorizados (3, 4, 5 y sin sesión) y emitir evento cerrar', () => {
    let cierres = 0;
    component.cerrar.subscribe(() => cierres++);

    const rolesNoPermitidos: RolMock[] = [
      { autenticado: false, id_rol: 0, rol: '' },
      { autenticado: true, id_rol: 3, rol: 'Veterinario' },
      { autenticado: true, id_rol: 4, rol: 'Peticionario' },
      { autenticado: true, id_rol: 5, rol: 'Super Administrador' }
    ];

    for (const rol of rolesNoPermitidos) {
      authMock.estado.set(rol);
      fixture.componentRef.setInput('idAlerta', 42);
      component.recargarDetalle();
      fixture.detectChanges();

      expect(component.sinPermiso).toBe(true);
      expect(
        fixture.nativeElement.querySelector('[data-testid="estado-sin-permiso"]')
      ).toBeTruthy();
    }

    httpMock.expectNone(() => true);

    const btnCerrar: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="btn-cerrar-comparador"]'
    );
    btnCerrar.click();
    expect(cierres).toBe(1);
  });
});
