/**
 * Prueba de INTEGRACIÓN REAL (H1): Angular → backend Django local → PostgreSQL local.
 *
 * Se omite (skip) salvo que exista la variable de entorno VETERICANO_E2E_H1_CONFIG con el JSON que genera
 * el script de siembra (base_url de un backend LOCAL, JWT de un veterinario sintético e ids sembrados).
 * Usa los servicios y el componente reales con HttpClient real (withFetch) y el interceptor de autenticación real.
 * Todas las URLs http(s) del environment se reescriben al backend local antes de crear cualquier servicio,
 * y la prueba aborta si queda alguna apuntando a otro host.
 * Después, un script de verificación comprueba en la BD local los consumos, el Kardex y el saldo del kit
 * por veterinario y origen clínico (ver informe CORRECCION_H1).
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { firstValueFrom, tap } from 'rxjs';
import Swal from 'sweetalert2';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../environments/environment';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth';
import { VeterinaryInventoryService, ResultadoConsumoKit } from './veterinary-inventory.service';
import { HistoriaClinica2Component } from '../historia-clinica/historia-clinica';

const RAW_CFG = (globalThis as any).process?.env?.VETERICANO_E2E_H1_CONFIG as string | undefined;
const CFG: any = RAW_CFG ? JSON.parse(RAW_CFG) : null;
const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/;

describe.skipIf(!CFG)('Integración real H1: consumo de kit con origen clínico (backend local)', () => {
  let vetInv: VeterinaryInventoryService;
  let swalSpy: ReturnType<typeof vi.spyOn>;

  const medicamento = (cantidad: number) => ({
    id: CFG.id_medicamento, id_medicamento: CFG.id_medicamento, nombre: CFG.nombre_medicamento,
    cantidadAAdministrar: cantidad, stockDisponible: 10, administrado: false, cantidadEfectivaAdministrada: 0, administrando: false
  });

  beforeAll(() => {
    expect(String(CFG.base_url)).toMatch(LOCAL);
    for (const clave of Object.keys(environment)) {
      const valor = (environment as any)[clave];
      if (typeof valor === 'string' && /^https?:\/\//.test(valor)) {
        (environment as any)[clave] = valor.replace(/^https?:\/\/[^/]+/, CFG.base_url);
      }
    }
    const remotas = Object.values(environment).filter(v => typeof v === 'string' && /^https?:\/\//.test(v) && !v.startsWith(CFG.base_url));
    expect(remotas).toEqual([]);
  });

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('token', CFG.token);
    const sesion = { id_usuario: CFG.id_veterinario, rol: 'Veterinario', id_rol: 3 };
    await TestBed.configureTestingModule({
      imports: [HistoriaClinica2Component],
      providers: [
        provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            currentUser: () => sesion,
            getToken: () => CFG.token,
            // Solo los usa el interceptor ante un 401: no deben ocurrir con el JWT sembrado
            logout: () => { throw new Error('401 inesperado en la integración H1'); },
            renovarToken: () => { throw new Error('401 inesperado en la integración H1'); }
          }
        }
      ]
    }).compileComponents();
    vetInv = TestBed.inject(VeterinaryInventoryService);
    swalSpy = vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true } as any);
    // Kit real del veterinario desde el backend local (GET mi-kit y catálogos)
    const items = await firstValueFrom(vetInv.cargarInventarioVeterinario(CFG.id_veterinario));
    vetInv.guardarAsignacionesLocales(CFG.id_veterinario, items);
    (vetInv as any).inventarioActual$.next(items);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('el kit real del veterinario incluye el medicamento sembrado', async () => {
    const items = (vetInv as any).inventarioActual$.getValue();
    const item = items.find((i: any) => Number(i.id_medicamento) === CFG.id_medicamento);
    expect(item).toBeTruthy();
    expect(Number(item.saldoDisponible)).toBe(CFG.saldo_inicial_kit);
  }, 30000);

  it('Historia (componente real): la tarjeta confirma la consulta y envía su id_consulta → CONFIRMADO', async () => {
    const fixture = TestBed.createComponent(HistoriaClinica2Component);
    const component = fixture.componentInstance;
    vi.spyOn(component, 'recargarStockMedicamentos').mockImplementation(() => {});
    component.esNuevaConsulta = false;
    component.idHistoria = CFG.id_historia;
    component.historiaOriginal = { id_historia: CFG.id_historia, id_consulta: CFG.id_consulta, id_animal: CFG.id_animal } as any;
    const original = vetInv.registrarConsumo.bind(vetInv);
    const resultados: ResultadoConsumoKit[] = [];
    const consumoSpy = vi.spyOn(vetInv, 'registrarConsumo').mockImplementation((...args: any[]) =>
      (original as any)(...args).pipe(tap((r: ResultadoConsumoKit) => resultados.push(r))));
    const med: any = medicamento(2);

    component.registrarAdministracion(med, 0);
    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(2), { timeout: 20000, interval: 100 });
    expect(consumoSpy.mock.calls[0][4]).toEqual({ id_consulta: CFG.id_consulta });
    expect(resultados[0].estado).toBe('CONFIRMADO');
    expect(resultados[0].httpStatus).toBe(200);
    expect((swalSpy.mock.calls[1][0] as any).title).toBe('Descuento registrado');
    expect(med.administrado).toBe(true);
  }, 30000);

  it('Historia (componente real) en consulta nueva: no envía consumo y lo explica', async () => {
    const fixture = TestBed.createComponent(HistoriaClinica2Component);
    const component = fixture.componentInstance;
    component.esNuevaConsulta = true;
    component.idHistoria = CFG.id_historia;
    component.historiaOriginal = { id_historia: CFG.id_historia, id_consulta: CFG.id_consulta, id_animal: CFG.id_animal } as any;
    const consumoSpy = vi.spyOn(vetInv, 'registrarConsumo');
    const med: any = medicamento(2);

    component.registrarAdministracion(med, 0);
    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(2), { timeout: 20000, interval: 100 });
    expect(consumoSpy).not.toHaveBeenCalled();
    expect((swalSpy.mock.calls[1][0] as any).text).toContain('no tiene una consulta a la cual vincularse');
    expect(med.administrado).toBe(false);
  }, 30000);

  it('Acta: id_seguimiento_visita real → CONFIRMADO', async () => {
    const r = await firstValueFrom(vetInv.registrarConsumo(
      CFG.id_medicamento, 1, 'Administración en acta (integración H1)', CFG.nombre_medicamento,
      { id_seguimiento_visita: CFG.id_seguimiento }
    ));
    expect(r.estado).toBe('CONFIRMADO');
    expect(r.httpStatus).toBe(200);
  }, 30000);

  it('id_consulta inexistente → el backend responde 400 y queda RECHAZADO sin descuento', async () => {
    const r = await firstValueFrom(vetInv.registrarConsumo(
      CFG.id_medicamento, 1, 'origen inexistente', CFG.nombre_medicamento, { id_consulta: 987654321 }
    ));
    expect(r.estado).toBe('RECHAZADO');
    expect(r.httpStatus).toBe(400);
    expect(r.mensaje).toContain('identificador de origen no existe');
  }, 30000);

  it('sin origen clínico → RECHAZADO local, sin petición al backend', async () => {
    const r = await firstValueFrom(vetInv.registrarConsumo(CFG.id_medicamento, 1, 'sin origen', CFG.nombre_medicamento));
    expect(r.estado).toBe('RECHAZADO');
    expect(r.codigo).toBe('ORIGEN_CLINICO_REQUERIDO');
    expect(r.httpStatus).toBeNull();
  }, 30000);
});
