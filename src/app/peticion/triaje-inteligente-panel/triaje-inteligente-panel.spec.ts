import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { TriajePeticionDetalle } from '../../models/triaje.model';
import { AuthService } from '../../services/auth';
import { TriajeInteligentePanelComponent } from './triaje-inteligente-panel';

function crearAuthMock(idRol: number, rol: string, autenticado = true) {
  const estado = signal({ autenticado, id_rol: idRol, rol });
  return {
    estado,
    isAuthenticated: () => estado().autenticado,
    currentUser: () =>
      estado().autenticado
        ? { id_usuario: 15, email: 'juridico@vetericano.test', id_rol: estado().id_rol, rol: estado().rol }
        : null,
    userRole: () => estado().rol,
    isSuperAdmin: () => estado().autenticado && estado().id_rol === 5,
    isAdmin: () => estado().autenticado && estado().id_rol === 1,
    isJuridico: () => estado().autenticado && estado().id_rol === 2,
    isVeterinario: () => estado().autenticado && estado().id_rol === 3
  };
}

function crearTriajeMock(overrides: Partial<TriajePeticionDetalle> = {}): TriajePeticionDetalle {
  return {
    id_triaje: 77,
    id_peticion: 501,
    numero_radicado: 'PET-2026-00501',
    clave_idempotencia: 'triaje-pet-501',
    automatizacion_activa: true,
    tiene_fotografias: true,
    puede_reintentar: false,
    estado_envio: 'ENVIADO',
    estado_analisis: 'COMPLETADO',
    intentos_envio: 1,
    max_intentos: 3,
    lease_expira_en: null,
    ultimo_intento_en: '2026-11-27T01:00:00Z',
    proximo_reintento_en: null,
    ultimo_codigo_http: 200,
    ultimo_error_envio: '',
    enviado_en: '2026-11-27T01:00:00Z',
    completado_en: '2026-11-27T01:00:12Z',
    n8n_execution_id: 'exec-501',
    version_resultado: 1,
    prioridad_original: 'Media',
    prioridad_actual_peticion: 'Media',
    estado_peticion: 'En revisión',
    prioridad_sugerida: 'URGENTE',
    nivel_confianza: 0.88,
    justificacion: 'El reporte describe atropellamiento con hemorragia activa.',
    resumen_texto: 'Ciudadano reporta canino atropellado con sangrado.',
    resumen_vision: 'Canino en vía pública con herida visible en extremidad.',
    signos_detectados: ['Sangrado activo', 'Trauma en extremidad'],
    signos_reportados: ['Sangrado activo', 'Atropellamiento'],
    signos_fotografia: ['Herida visible en extremidad posterior'],
    contradiccion_foto_descripcion: false,
    advertencias_contradiccion: [],
    posibles_duplicados: [],
    posibles_duplicados_detalle: [
      {
        id_peticion: 499,
        numero_radicado: 'PET-2026-00499',
        score_combinado: 0.86,
        similitud_texto: 0.78,
        distancia_metros: 35,
        porcentaje_similitud_visual: 91.4,
        metodo_imagen: 'dinov2_small',
        criterios_coincidencia: ['texto', 'gps', 'imagen'],
        estado: 'En revisión',
        id_alerta: 88,
        estado_revision: 'PENDIENTE'
      }
    ],
    total_duplicados_detectados: 1,
    asignado_a_id_peticion: null,
    veterinario_recomendado_id: 31,
    veterinario_recomendado_nombre: 'Laura Gómez',
    veterinario_recomendado_sede_id: 1,
    veterinario_recomendado_sede: 'Sede Principal',
    veterinario_recomendado_carga: {
      id_veterinario: 31,
      id_sede: 1,
      sede_nombre: 'Sede Principal',
      total_asignados: 4,
      pendientes: 1,
      en_proceso: 1,
      finalizadas: 2,
      carga_activa: 2,
      urgentes_activos: 1,
      saturado: false,
      porcentaje_completado: 50
    },
    justificacion_recomendacion: 'Menor carga activa en la sede.',
    carga_veterinarios_snapshot: [],
    decision_prioridad: 'PENDIENTE',
    decision_prioridad_por_id: null,
    decision_prioridad_por_nombre: null,
    decision_prioridad_en: null,
    decision_prioridad_observacion: '',
    prioridad_aplicada: null,
    decision_veterinario: 'PENDIENTE',
    decision_veterinario_por_id: null,
    decision_veterinario_por_nombre: null,
    decision_veterinario_en: null,
    decision_veterinario_observacion: '',
    veterinario_asignado_decision_id: null,
    historial_decisiones: [],
    modelo_texto_usado: 'models/gemini-3.5-flash-lite',
    modelo_vision_usado: 'models/gemini-3.5-flash-lite',
    fecha_creacion: '2026-11-27T01:00:00Z',
    fecha_actualizacion: '2026-11-27T01:00:12Z',
    ...overrides
  };
}

describe('TriajeInteligentePanelComponent', () => {
  const baseApi = environment.apiBaseUrl.replace(/\/+$/, '');
  const basePeticiones = environment.apiUrlPeticiones.replace(/\/+$/, '');
  let httpMock: HttpTestingController;
  let authMock: ReturnType<typeof crearAuthMock>;

  beforeEach(async () => {
    authMock = crearAuthMock(2, 'Jurídico');
    await TestBed.configureTestingModule({
      imports: [TriajeInteligentePanelComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authMock }
      ]
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function montarPanel(idPeticion = 501, esDuplicada = false): ComponentFixture<TriajeInteligentePanelComponent> {
    const fixture = TestBed.createComponent(TriajeInteligentePanelComponent);
    fixture.componentInstance.idPeticion = idPeticion;
    fixture.componentInstance.peticion = { id_peticion: idPeticion, prioridad: 'Media', estado: 'En revisión' };
    fixture.componentInstance.esDuplicada = esDuplicada;
    fixture.componentInstance.ngOnChanges({
      idPeticion: {
        currentValue: idPeticion,
        previousValue: null,
        firstChange: true,
        isFirstChange: () => true
      }
    });
    fixture.detectChanges();
    return fixture;
  }

  it('muestra estado completo, signos separados, advertencia de contradicción, duplicados, veterinario/sede/carga y nota no probabilística', () => {
    const fixture = montarPanel(501);
    expect(fixture.debugElement.query(By.css('[data-testid="triaje-cargando"]'))).toBeTruthy();

    const req = httpMock.expectOne(`${baseApi}/triaje-ia/peticiones/501/`);
    req.flush(
      crearTriajeMock({
        contradiccion_foto_descripcion: true,
        advertencias_contradiccion: ['La fotografía muestra un ave y la descripción reporta un perro.']
      })
    );
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Completado');
    expect(text).toContain('URGENTE');
    expect(text).toContain('Sangrado activo');
    expect(text).toContain('Herida visible en extremidad posterior');
    expect(text).toContain('La fotografía muestra un ave y la descripción reporta un perro.');
    expect(text).toContain('PET-2026-00499');
    expect(text).toContain('78.0%');
    expect(text).toContain('91.4%');
    expect(text).toContain('DINOv2');
    expect(text).toContain('35 m');
    expect(text).toContain('Laura Gómez');
    expect(text).toContain('Sede Principal');
    expect(text).toContain('Carga activa: 2');
    expect(text).toContain('no representa una probabilidad clínica verificada de acierto');
  });

  it('no inventa signos fotográficos cuando la denuncia no tiene fotografías', () => {
    const fixture = montarPanel(502);
    httpMock.expectOne(`${baseApi}/triaje-ia/peticiones/502/`).flush(
      crearTriajeMock({
        id_peticion: 502,
        tiene_fotografias: false,
        signos_fotografia: ['No debería verse'],
        resumen_vision: ''
      })
    );
    fixture.detectChanges();

    const seccionFoto = fixture.debugElement.query(By.css('[data-testid="triaje-signos-fotografia"]')).nativeElement
      .textContent as string;
    expect(seccionFoto).toContain('no tiene fotografías adjuntas');
    expect(seccionFoto).not.toContain('No debería verse');
  });

  it('maneja denuncias antiguas sin triaje y automatización desactivada', () => {
    const fixture = montarPanel(105);
    const req = httpMock.expectOne(`${baseApi}/triaje-ia/peticiones/105/`);
    req.flush(
      {
        error: 'No existe registro de triaje para la petición #105.',
        existe_triaje: false,
        automatizacion_activa: false
      },
      { status: 404, statusText: 'Not Found' }
    );
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('[data-testid="triaje-sin-registro"]'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('[data-testid="triaje-automatizacion-desactivada"]'))).toBeTruthy();
    const btnRetry = fixture.debugElement.query(By.css('[data-testid="btn-reintentar-triaje"]'));
    expect(btnRetry.nativeElement.disabled).toBe(true);
  });

  it('permite reintentar cuando el análisis está fallido o parcial y automatización activa', () => {
    const fixture = montarPanel(503);
    httpMock.expectOne(`${baseApi}/triaje-ia/peticiones/503/`).flush(
      crearTriajeMock({
        id_peticion: 503,
        estado_analisis: 'FALLIDO',
        estado_envio: 'FALLO_DEFINITIVO',
        puede_reintentar: true,
        automatizacion_activa: true,
        ultimo_error_envio: 'Timeout en webhook n8n'
      })
    );
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('[data-testid="triaje-estado-badge"]')).nativeElement.textContent).toContain(
      'Fallido'
    );
    const btnRetry = fixture.debugElement.query(By.css('[data-testid="btn-reintentar-triaje"]'));
    expect(btnRetry.nativeElement.disabled).toBe(false);
    btnRetry.nativeElement.click();

    const postRetry = httpMock.expectOne(`${baseApi}/triaje-ia/peticiones/503/reintentar/`);
    expect(postRetry.request.method).toBe('POST');
    expect(postRetry.request.body).toEqual({ forzar: true });
    postRetry.flush({ ejecutado: true, asincrono: true, automatizacion_activa: true });

    httpMock.expectOne(`${baseApi}/triaje-ia/peticiones/503/`).flush(
      crearTriajeMock({
        id_peticion: 503,
        estado_analisis: 'EN_PROCESO',
        estado_envio: 'ENVIADO',
        puede_reintentar: true
      })
    );
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('[data-testid="triaje-estado-badge"]')).nativeElement.textContent).toContain(
      'Procesando'
    );
  });

  it('acepta veterinario recomendado mediante POST /decision/ atómico y rechaza prioridad sin mutar', () => {
    const fixture = montarPanel(501);
    httpMock.expectOne(`${baseApi}/triaje-ia/peticiones/501/`).flush(crearTriajeMock());
    fixture.detectChanges();

    // 1. Aceptar veterinario recomendado -> único POST /decision/ atómico (el backend delega en AsignarPeticionView)
    fixture.debugElement.query(By.css('[data-testid="btn-aceptar-veterinario"]')).nativeElement.click();
    httpMock.expectNone(`${basePeticiones}/501/asignar/`);

    const reqDecVet = httpMock.expectOne(`${baseApi}/triaje-ia/peticiones/501/decision/`);
    expect(reqDecVet.request.method).toBe('POST');
    expect(reqDecVet.request.body).toEqual({
      tipo_recomendacion: 'VETERINARIO',
      decision: 'ACEPTADA',
      observacion: 'Asignación aceptada desde recomendación de Triaje Inteligente.'
    });
    reqDecVet.flush({
      mensaje: 'Decisión registrada.',
      cambiada: true,
      triaje: crearTriajeMock({
        asignado_a_id_peticion: 31,
        decision_veterinario: 'ACEPTADA',
        decision_veterinario_por_nombre: 'Jurídico Uno',
        decision_veterinario_en: '2026-11-27T01:05:00Z',
        historial_decisiones: [
          {
            tipo_recomendacion: 'VETERINARIO',
            decision: 'ACEPTADA',
            valor_sugerido: 'Laura Gómez (#31)',
            valor_anterior: 'Sin asignar',
            valor_resultante: 'Laura Gómez (#31)',
            observacion: 'Asignación aceptada',
            usuario_id: 15,
            usuario_nombre: 'Jurídico Uno',
            usuario_rol: 'Jurídico',
            fecha: '2026-11-27T01:05:00Z'
          }
        ]
      })
    });
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css('[data-testid="triaje-decision-veterinario-badge"]')).nativeElement.textContent
    ).toContain('Aceptada');

    // 2. Rechazar prioridad sugerida -> POST /decision/
    fixture.debugElement.query(By.css('[data-testid="btn-rechazar-prioridad"]')).nativeElement.click();
    const reqDecPrio = httpMock.expectOne(`${baseApi}/triaje-ia/peticiones/501/decision/`);
    expect(reqDecPrio.request.body).toEqual({
      tipo_recomendacion: 'PRIORIDAD',
      decision: 'RECHAZADA',
      observacion: ''
    });
    reqDecPrio.flush({
      mensaje: 'Decisión registrada.',
      triaje: crearTriajeMock({
        decision_prioridad: 'RECHAZADA',
        decision_prioridad_por_nombre: 'Jurídico Uno',
        decision_prioridad_en: '2026-11-27T01:06:00Z'
      })
    });
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css('[data-testid="triaje-decision-prioridad-badge"]')).nativeElement.textContent
    ).toContain('Rechazada');
  });

  it('muestra error de sede (403) y oculta el panel completamente para roles no autorizados', () => {
    const fixture = montarPanel(700);
    httpMock.expectOne(`${baseApi}/triaje-ia/peticiones/700/`).flush(
      { detail: 'No tiene permiso para acceder a peticiones de otra sede.' },
      { status: 403, statusText: 'Forbidden' }
    );
    fixture.detectChanges();

    const errBox = fixture.debugElement.query(By.css('[data-testid="triaje-error-carga"]'));
    expect(errBox.nativeElement.textContent).toContain('otra sede');

    // Veterinario no dispara requests ni ve el panel
    authMock.estado.set({ autenticado: true, id_rol: 3, rol: 'Veterinario' });
    const fixtureVet = montarPanel(701);
    httpMock.expectNone(`${baseApi}/triaje-ia/peticiones/701/`);
    expect(fixtureVet.debugElement.query(By.css('[data-testid="panel-triaje-inteligente"]'))).toBeNull();
  });
});
