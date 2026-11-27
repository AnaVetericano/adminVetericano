import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import Swal from 'sweetalert2';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth';
import { Peticion } from './peticion';

function crearAuthMock(idRol: number, rol: string) {
  const estado = signal({ autenticado: true, id_rol: idRol, rol });
  return {
    estado,
    isAuthenticated: () => true,
    currentUser: () => ({
      id_usuario: 99,
      email: 'tester@vetericano.test',
      nombre: 'Usuario',
      apellido: 'Prueba',
      id_rol: estado().id_rol,
      rol: estado().rol
    }),
    userRole: () => estado().rol,
    isSuperAdmin: () => estado().id_rol === 5,
    isAdmin: () => estado().id_rol === 1,
    isJuridico: () => estado().id_rol === 2,
    isVeterinario: () => estado().id_rol === 3
  };
}

describe('Integración Peticion + Triaje Inteligente en detalle de denuncia', () => {
  const basePeticionesUrl = environment.apiUrlPeticiones.replace(/\/+$/, '');
  const baseApi = environment.apiBaseUrl.replace(/\/+$/, '');
  let httpMock: HttpTestingController;
  let authMock: ReturnType<typeof crearAuthMock>;
  let storageStore: Map<string, string>;

  const peticionMock = {
    id_peticion: 610,
    numero_radicado: 'PET-2026-00610',
    descripcion: 'Perro con fractura aparente en calle 5',
    estado: 'En revisión',
    prioridad: 'Media',
    fecha: '2026-11-26T10:00:00Z',
    tipo: 'Animal herido',
    ubicacion_direccion: 'Calle 5 # 10-20',
    foto: 'https://res.cloudinary.com/demo/image/upload/perro.jpg',
    fotos: ['https://res.cloudinary.com/demo/image/upload/perro.jpg'],
    total_fotos: 1
  };

  beforeEach(async () => {
    storageStore = new Map<string, string>();
    storageStore.set('token', 'token-jwt-test');
    vi.stubGlobal('localStorage', {
      get length() {
        return storageStore.size;
      },
      clear: () => storageStore.clear(),
      getItem: (k: string) => storageStore.get(k) ?? null,
      key: (i: number) => Array.from(storageStore.keys())[i] ?? null,
      removeItem: (k: string) => {
        storageStore.delete(k);
      },
      setItem: (k: string, v: string) => {
        storageStore.set(k, v);
      }
    });
    vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false });

    authMock = crearAuthMock(2, 'Jurídico');
    await TestBed.configureTestingModule({
      imports: [Peticion],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: authMock }
      ]
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function flushIniciales(): void {
    const reqs = httpMock.match((r) => r.method === 'GET');
    for (const r of reqs) {
      if (r.request.url.endsWith('/listar/')) {
        r.flush([peticionMock]);
      } else if (r.request.url.includes('/duplicados/alertas/')) {
        r.flush({ count: 0, page: 1, page_size: 100, total_pages: 1, resumen: { PENDIENTE: 0, CONFIRMADO: 0, DESCARTADO: 0, total: 0 }, results: [] });
      } else {
        r.flush([]);
      }
    }
  }

  it('integra el panel de Triaje Inteligente en el modal detalle para Jurídico y acepta prioridad', () => {
    const fixture: ComponentFixture<Peticion> = TestBed.createComponent(Peticion);
    fixture.detectChanges();
    flushIniciales();
    fixture.detectChanges();

    fixture.componentInstance.abrirModalDetalle(peticionMock);
    fixture.detectChanges();

    httpMock.expectOne(`${basePeticionesUrl}/610/`).flush(peticionMock);
    httpMock.expectOne(`${basePeticionesUrl}/610/historial-asignaciones/`).flush([]);
    httpMock.expectOne((r) => r.url === `${basePeticionesUrl}/610/duplicados/`).flush({
      id_peticion: 610,
      numero_radicado: 'PET-2026-00610',
      count: 0,
      resumen: { PENDIENTE: 0, CONFIRMADO: 0, DESCARTADO: 0, total: 0 },
      results: []
    });
    httpMock.expectOne(`${baseApi}/triaje-ia/peticiones/610/`).flush({
      id_triaje: 12,
      id_peticion: 610,
      numero_radicado: 'PET-2026-00610',
      clave_idempotencia: 'triaje-pet-610',
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
      completado_en: '2026-11-27T01:00:10Z',
      n8n_execution_id: 'exec-610',
      version_resultado: 1,
      prioridad_original: 'Media',
      prioridad_actual_peticion: 'Media',
      estado_peticion: 'En revisión',
      prioridad_sugerida: 'URGENTE',
      nivel_confianza: 0.9,
      justificacion: 'Posible fractura reportada y observada.',
      resumen_texto: 'Perro con fractura.',
      resumen_vision: 'Extremidad lesionada.',
      signos_detectados: ['Fractura'],
      signos_reportados: ['Fractura aparente'],
      signos_fotografia: ['Deformidad en extremidad'],
      contradiccion_foto_descripcion: false,
      advertencias_contradiccion: [],
      posibles_duplicados: [],
      posibles_duplicados_detalle: [],
      total_duplicados_detectados: 0,
      asignado_a_id_peticion: null,
      veterinario_recomendado_id: null,
      veterinario_recomendado_nombre: null,
      veterinario_recomendado_sede_id: null,
      veterinario_recomendado_sede: null,
      veterinario_recomendado_carga: null,
      justificacion_recomendacion: '',
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
      modelo_texto_usado: 'gemini',
      modelo_vision_usado: 'gemini',
      fecha_creacion: '2026-11-27T01:00:00Z',
      fecha_actualizacion: '2026-11-27T01:00:10Z'
    });
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('[data-testid="panel-triaje-inteligente"]'))).toBeTruthy();
    fixture.debugElement.query(By.css('[data-testid="btn-aceptar-prioridad"]')).nativeElement.click();

    const reqDec = httpMock.expectOne(`${baseApi}/triaje-ia/peticiones/610/decision/`);
    reqDec.flush({
      mensaje: 'Decisión registrada.',
      triaje: {
        id_triaje: 12,
        id_peticion: 610,
        numero_radicado: 'PET-2026-00610',
        clave_idempotencia: 'triaje-pet-610',
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
        completado_en: '2026-11-27T01:00:10Z',
        n8n_execution_id: 'exec-610',
        version_resultado: 1,
        prioridad_original: 'Media',
        prioridad_actual_peticion: 'URGENTE',
        estado_peticion: 'En revisión',
        prioridad_sugerida: 'URGENTE',
        nivel_confianza: 0.9,
        justificacion: 'Posible fractura reportada y observada.',
        resumen_texto: 'Perro con fractura.',
        resumen_vision: 'Extremidad lesionada.',
        signos_detectados: ['Fractura'],
        signos_reportados: ['Fractura aparente'],
        signos_fotografia: ['Deformidad en extremidad'],
        contradiccion_foto_descripcion: false,
        advertencias_contradiccion: [],
        posibles_duplicados: [],
        posibles_duplicados_detalle: [],
        total_duplicados_detectados: 0,
        asignado_a_id_peticion: null,
        veterinario_recomendado_id: null,
        veterinario_recomendado_nombre: null,
        veterinario_recomendado_sede_id: null,
        veterinario_recomendado_sede: null,
        veterinario_recomendado_carga: null,
        justificacion_recomendacion: '',
        carga_veterinarios_snapshot: [],
        decision_prioridad: 'ACEPTADA',
        decision_prioridad_por_id: 99,
        decision_prioridad_por_nombre: 'Usuario Prueba',
        decision_prioridad_en: '2026-11-27T01:02:00Z',
        decision_prioridad_observacion: '',
        prioridad_aplicada: 'URGENTE',
        decision_veterinario: 'PENDIENTE',
        decision_veterinario_por_id: null,
        decision_veterinario_por_nombre: null,
        decision_veterinario_en: null,
        decision_veterinario_observacion: '',
        veterinario_asignado_decision_id: null,
        historial_decisiones: [],
        modelo_texto_usado: 'gemini',
        modelo_vision_usado: 'gemini',
        fecha_creacion: '2026-11-27T01:00:00Z',
        fecha_actualizacion: '2026-11-27T01:02:00Z'
      }
    });

    // onTriajePeticionActualizada refresca detalle, historial, listado y notificaciones
    flushIniciales();
    const recargasDetalle = httpMock.match((r) => r.url.startsWith(`${basePeticionesUrl}/610/`));
    for (const r of recargasDetalle) {
      r.flush(r.request.url.endsWith('/historial-asignaciones/') ? [] : { ...peticionMock, prioridad: 'URGENTE' });
    }
    fixture.detectChanges();

    expect(fixture.componentInstance.peticionDetalle.prioridad).toBe('URGENTE');
  });

  it('muestra prioridad sugerida, veterinario recomendado y carga laboral en tarjetas sin consultas N+1 y sincroniza tras polling', async () => {
    const peticionConTriaje = {
      ...peticionMock,
      id_peticion: 611,
      numero_radicado: 'PET-2026-00611',
      prioridad: 'Media',
      asignado_a: null,
      triaje_resumen: {
        id_triaje: 19,
        automatizacion_activa: true,
        puede_reintentar: false,
        estado_envio: 'ENVIADO',
        estado_analisis: 'COMPLETADO',
        prioridad_sugerida: 'URGENTE',
        prioridad_aplicada: null,
        decision_prioridad: 'PENDIENTE',
        veterinario_recomendado_id: 31,
        veterinario_recomendado_nombre: 'Laura Gómez',
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
        decision_veterinario: 'PENDIENTE',
        veterinario_asignado_decision_id: null,
        contradiccion_foto_descripcion: false,
        total_duplicados_detectados: 0,
        completado_en: '2026-11-27T01:00:10Z',
        fecha_actualizacion: '2026-11-27T01:00:10Z'
      }
    };

    const peticionEnProceso = {
      ...peticionMock,
      id_peticion: 612,
      numero_radicado: 'PET-2026-00612',
      prioridad: 'Baja',
      asignado_a: null,
      triaje_resumen: {
        id_triaje: 20,
        automatizacion_activa: true,
        puede_reintentar: true,
        estado_envio: 'ENVIADO',
        estado_analisis: 'EN_PROCESO',
        prioridad_sugerida: null,
        prioridad_aplicada: null,
        decision_prioridad: 'PENDIENTE',
        veterinario_recomendado_id: null,
        veterinario_recomendado_nombre: null,
        veterinario_recomendado_sede: null,
        veterinario_recomendado_carga: null,
        decision_veterinario: 'PENDIENTE',
        veterinario_asignado_decision_id: null,
        contradiccion_foto_descripcion: false,
        total_duplicados_detectados: 0,
        completado_en: null,
        fecha_actualizacion: '2026-11-27T01:00:05Z'
      }
    };

    const fixture: ComponentFixture<Peticion> = TestBed.createComponent(Peticion);
    fixture.detectChanges();

    const reqs = httpMock.match((r) => r.method === 'GET');
    for (const r of reqs) {
      if (r.request.url.endsWith('/listar/')) {
        r.flush([peticionConTriaje, peticionEnProceso]);
      } else if (r.request.url.includes('/duplicados/alertas/')) {
        r.flush({
          count: 0,
          page: 1,
          page_size: 100,
          total_pages: 1,
          resumen: { PENDIENTE: 0, CONFIRMADO: 0, DESCARTADO: 0, total: 0 },
          results: []
        });
      } else {
        r.flush([]);
      }
    }
    fixture.detectChanges();

    // Cero consultas individuales a /triaje-ia/ al renderizar tarjetas
    httpMock.expectNone((r) => r.url.includes('triaje-ia'));

    const card611 = fixture.debugElement.query(By.css('[data-testid="tarjeta-triaje-611"]')).nativeElement
      .textContent as string;
    expect(card611).toContain('URGENTE');
    expect(card611).toContain('Por confirmar');
    expect(card611).toContain('Laura Gómez');
    expect(card611).toContain('Carga activa: 2');
    expect(card611).toContain('Pend: 1 · Proc: 1');

    // Tarjeta 611 mantiene diferenciada la prioridad confirmada ('Media') y veterinario asignado ('Sin asignar')
    const textoGeneral = fixture.nativeElement.textContent as string;
    expect(textoGeneral).toContain('Veterinario asignado:');
    expect(textoGeneral).toContain('Sin asignar');
    expect(textoGeneral).toContain('Prioridad confirmada:');
    expect(textoGeneral).toContain('Media');

    // Al abrir el detalle de 612 y completarse el triaje vía polling, la tarjeta 612 se sincroniza sin /listar/ extra
    vi.useFakeTimers();
    try {
      fixture.componentInstance.abrirModalDetalle(peticionEnProceso);
      fixture.detectChanges();

      httpMock.expectOne(`${basePeticionesUrl}/612/`).flush(peticionEnProceso);
      httpMock.expectOne(`${basePeticionesUrl}/612/historial-asignaciones/`).flush([]);
      httpMock.expectOne((r) => r.url === `${basePeticionesUrl}/612/duplicados/`).flush({
        id_peticion: 612,
        numero_radicado: 'PET-2026-00612',
        count: 0,
        resumen: { PENDIENTE: 0, CONFIRMADO: 0, DESCARTADO: 0, total: 0 },
        results: []
      });
      httpMock.expectOne(`${baseApi}/triaje-ia/peticiones/612/`).flush({
        id_triaje: 20,
        id_peticion: 612,
        numero_radicado: 'PET-2026-00612',
        clave_idempotencia: 'triaje-pet-612',
        automatizacion_activa: true,
        tiene_fotografias: true,
        puede_reintentar: true,
        estado_envio: 'ENVIADO',
        estado_analisis: 'EN_PROCESO',
        intentos_envio: 1,
        max_intentos: 3,
        lease_expira_en: null,
        ultimo_intento_en: '2026-11-27T01:00:05Z',
        proximo_reintento_en: null,
        ultimo_codigo_http: 200,
        ultimo_error_envio: '',
        enviado_en: '2026-11-27T01:00:05Z',
        completado_en: null,
        n8n_execution_id: '',
        version_resultado: 0,
        prioridad_original: 'Baja',
        prioridad_actual_peticion: 'Baja',
        estado_peticion: 'En revisión',
        prioridad_sugerida: null,
        nivel_confianza: null,
        justificacion: '',
        resumen_texto: '',
        resumen_vision: '',
        signos_detectados: [],
        signos_reportados: [],
        signos_fotografia: [],
        contradiccion_foto_descripcion: false,
        advertencias_contradiccion: [],
        posibles_duplicados: [],
        posibles_duplicados_detalle: [],
        total_duplicados_detectados: 0,
        asignado_a_id_peticion: null,
        veterinario_recomendado_id: null,
        veterinario_recomendado_nombre: null,
        veterinario_recomendado_sede_id: null,
        veterinario_recomendado_sede: null,
        veterinario_recomendado_carga: null,
        justificacion_recomendacion: '',
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
        modelo_texto_usado: '',
        modelo_vision_usado: '',
        fecha_creacion: '2026-11-27T01:00:05Z',
        fecha_actualizacion: '2026-11-27T01:00:05Z'
      });
      fixture.detectChanges();

      await vi.advanceTimersByTimeAsync(3000);
      httpMock.expectOne(`${baseApi}/triaje-ia/peticiones/612/`).flush({
        id_triaje: 20,
        id_peticion: 612,
        numero_radicado: 'PET-2026-00612',
        clave_idempotencia: 'triaje-pet-612',
        automatizacion_activa: true,
        tiene_fotografias: true,
        puede_reintentar: false,
        estado_envio: 'ENVIADO',
        estado_analisis: 'COMPLETADO',
        intentos_envio: 1,
        max_intentos: 3,
        lease_expira_en: null,
        ultimo_intento_en: '2026-11-27T01:00:05Z',
        proximo_reintento_en: null,
        ultimo_codigo_http: 200,
        ultimo_error_envio: '',
        enviado_en: '2026-11-27T01:00:05Z',
        completado_en: '2026-11-27T01:00:12Z',
        n8n_execution_id: 'exec-612',
        version_resultado: 1,
        prioridad_original: 'Baja',
        prioridad_actual_peticion: 'Baja',
        estado_peticion: 'En revisión',
        prioridad_sugerida: 'ALTA',
        nivel_confianza: 0.85,
        justificacion: 'Lesión visible en extremidad.',
        resumen_texto: 'Perro con dolor.',
        resumen_vision: 'Cojera evidente.',
        signos_detectados: ['Cojera'],
        signos_reportados: ['Dolor'],
        signos_fotografia: ['Cojera'],
        contradiccion_foto_descripcion: false,
        advertencias_contradiccion: [],
        posibles_duplicados: [],
        posibles_duplicados_detalle: [],
        total_duplicados_detectados: 0,
        asignado_a_id_peticion: null,
        veterinario_recomendado_id: 32,
        veterinario_recomendado_nombre: 'Carlos Vet',
        veterinario_recomendado_sede_id: 1,
        veterinario_recomendado_sede: 'Sede Principal',
        veterinario_recomendado_carga: {
          id_veterinario: 32,
          id_sede: 1,
          sede_nombre: 'Sede Principal',
          total_asignados: 1,
          pendientes: 1,
          en_proceso: 0,
          finalizadas: 0,
          carga_activa: 1,
          urgentes_activos: 0,
          saturado: false,
          porcentaje_completado: 0
        },
        justificacion_recomendacion: 'Menor carga activa.',
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
        modelo_texto_usado: 'gemini',
        modelo_vision_usado: 'gemini',
        fecha_creacion: '2026-11-27T01:00:05Z',
        fecha_actualizacion: '2026-11-27T01:00:12Z'
      });
      fixture.detectChanges();

      const card612 = fixture.debugElement.query(By.css('[data-testid="tarjeta-triaje-612"]')).nativeElement
        .textContent as string;
      expect(card612).toContain('ALTA');
      expect(card612).toContain('Carlos Vet');
      expect(card612).toContain('Carga activa: 1');
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('no muestra el panel de Triaje Inteligente ni consulta /triaje-ia/ para Veterinario (rol 3)', () => {
    authMock.estado.set({ autenticado: true, id_rol: 3, rol: 'Veterinario' });
    const fixture: ComponentFixture<Peticion> = TestBed.createComponent(Peticion);
    fixture.detectChanges();
    flushIniciales();
    fixture.detectChanges();

    fixture.componentInstance.abrirModalDetalle(peticionMock);
    fixture.detectChanges();

    httpMock.expectOne(`${basePeticionesUrl}/610/`).flush(peticionMock);
    httpMock.expectOne(`${basePeticionesUrl}/610/historial-asignaciones/`).flush([]);
    httpMock.expectNone((r) => r.url.includes('triaje-ia'));
    expect(fixture.debugElement.query(By.css('[data-testid="panel-triaje-inteligente"]'))).toBeNull();
  });
});
