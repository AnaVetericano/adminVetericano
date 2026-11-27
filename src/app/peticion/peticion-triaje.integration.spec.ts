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
