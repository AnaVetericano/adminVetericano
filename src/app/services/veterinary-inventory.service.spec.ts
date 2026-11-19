import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { forkJoin } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { VeterinaryInventoryService, VeterinaryKitItem, ResultadoConsumoKit } from './veterinary-inventory.service';
import { AuthService } from './auth';
import {
  construirAvisoGuardadoClinico,
  extraerConflictosStockFarmacia,
  clasificarErrorConsumoKit,
  clasificarRespuestaConsumoKit,
  resultadoPendientePrevioKit
} from './consumo-kit-resultado';

const ID_VET = 41;
// Origen clínico confirmado (consulta existente) exigido por el backend para el consumo DIRECTO
const ORIGEN = { id_consulta: 55 };
const KEY_ASIG = `vetericano_lotes_asignados_vet_${ID_VET}`;
const KEY_CONS = `vetericano_consumos_veterinario_${ID_VET}`;

function itemKit(parcial: Partial<VeterinaryKitItem> = {}): VeterinaryKitItem {
  return {
    id: 7,
    id_medicamento: 7,
    nombre: 'Amoxicilina',
    tipo: 'Antibiótico',
    cantidadEntregada: 10,
    cantidadConsumida: 0,
    saldoDisponible: 10,
    umbralBajo: false,
    ...parcial
  };
}

function saldoLocal(): number | undefined {
  const items = JSON.parse(localStorage.getItem(KEY_ASIG) || '[]');
  return items.find((i: any) => Number(i.id_medicamento) === 7)?.saldoDisponible;
}

function consumosLocales(): Record<string, number> {
  return JSON.parse(localStorage.getItem(KEY_CONS) || '{}');
}

describe('VeterinaryInventoryService.registrarConsumo (resultado explícito)', () => {
  let service: VeterinaryInventoryService;
  let httpMock: HttpTestingController;

  const esSync = (r: { method: string; url: string }) =>
    r.method === 'POST' && r.url.endsWith('/kit/sincronizar-offline/');

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { currentUser: () => ({ id_usuario: ID_VET, rol: 'Veterinario', id_rol: 3 }) } }
      ]
    });
    service = TestBed.inject(VeterinaryInventoryService);
    httpMock = TestBed.inject(HttpTestingController);
    service.guardarAsignacionesLocales(ID_VET, [itemKit()]);
  });

  afterEach(() => {
    try {
      // Ningún escenario debe dejar un segundo POST (ni ninguna otra petición) pendiente
      httpMock.verify();
    } finally {
      localStorage.clear();
      TestBed.resetTestingModule();
    }
  });

  it('CONFIRMADO: 200 con el client_uuid en aplicados; descuento local aplicado una sola vez y solo tras la respuesta', () => {
    let resultado: ResultadoConsumoKit | undefined;
    let errorRecibido: unknown;
    service.registrarConsumo(7, 2, 'obs', 'Amoxicilina', ORIGEN).subscribe({ next: r => (resultado = r), error: e => (errorRecibido = e) });

    const req = httpMock.expectOne(esSync);
    // Contrato HTTP: mismos campos + el origen clínico exigido por el backend (id_consulta)
    expect(Object.keys(req.request.body)).toEqual(['consumos']);
    expect(req.request.body.consumos.length).toBe(1);
    const consumo = req.request.body.consumos[0];
    expect(Object.keys(consumo).sort()).toEqual(['client_uuid', 'fecha_consumo', 'id_consulta', 'id_medicamento', 'unidades']);
    expect(consumo.id_medicamento).toBe(7);
    expect(consumo.unidades).toBe(2);
    expect(consumo.id_consulta).toBe(55);

    // Sin descuento optimista antes de que el backend confirme
    expect(saldoLocal()).toBe(10);
    expect(consumosLocales()).toEqual({});

    req.flush({
      aplicados: [{ client_uuid: consumo.client_uuid, estado: 'APLICADO', unidades_descontadas: 2 }],
      conflictos: []
    });

    expect(errorRecibido).toBeUndefined();
    expect(resultado?.estado).toBe('CONFIRMADO');
    expect(resultado?.clientUuid).toBe(consumo.client_uuid);
    expect(resultado?.unidadesDescontadas).toBe(2);
    expect(saldoLocal()).toBe(8);
    expect(consumosLocales()).toEqual({ '7': 2 });
  });

  it('RECHAZADO 403 (no veterinario): mensaje real del backend y sin descuento local', () => {
    let resultado: ResultadoConsumoKit | undefined;
    service.registrarConsumo(7, 2, 'obs', 'Amoxicilina', ORIGEN).subscribe(r => (resultado = r));

    httpMock.expectOne(esSync).flush(
      { detail: 'Se requieren permisos de veterinario activo para realizar esta acción.' },
      { status: 403, statusText: 'Forbidden' }
    );

    expect(resultado?.estado).toBe('RECHAZADO');
    expect(resultado?.httpStatus).toBe(403);
    expect(resultado?.mensaje).toBe('El servidor rechazó el descuento del kit: Se requieren permisos de veterinario activo para realizar esta acción.');
    expect(saldoLocal()).toBe(10);
    expect(consumosLocales()).toEqual({});
  });

  it('RECHAZADO 409 CONFLICTO_STOCK_KIT: usa motivo_rechazo de conflictos y no descuenta', () => {
    let resultado: ResultadoConsumoKit | undefined;
    service.registrarConsumo(7, 2, 'obs', 'Amoxicilina', ORIGEN).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(esSync);
    const uuid = req.request.body.consumos[0].client_uuid;
    req.flush(
      {
        error: 'CONFLICTO_STOCK_KIT',
        aplicados: [],
        conflictos: [{
          client_uuid: uuid,
          estado: 'RECHAZADO_CONFLICTO',
          codigo_http: 409,
          motivo_rechazo: 'Stock insuficiente en el kit de Amoxicilina: disponible 1, solicitado 2'
        }]
      },
      { status: 409, statusText: 'Conflict' }
    );

    expect(resultado?.estado).toBe('RECHAZADO');
    expect(resultado?.httpStatus).toBe(409);
    expect(resultado?.codigo).toBe('CONFLICTO_STOCK_KIT');
    expect(resultado?.conflictos?.length).toBe(1);
    expect(resultado?.mensaje).toBe('El servidor rechazó el descuento del kit: Stock insuficiente en el kit de Amoxicilina: disponible 1, solicitado 2');
    expect(saldoLocal()).toBe(10);
    expect(consumosLocales()).toEqual({});
  });

  it('RECHAZADO 400 de dominio (traducir_error_inventario): usa "detalle"', () => {
    let resultado: ResultadoConsumoKit | undefined;
    service.registrarConsumo(7, 1, 'obs', 'Amoxicilina', ORIGEN).subscribe(r => (resultado = r));

    httpMock.expectOne(esSync).flush(
      { error: 'CONSUMO_INVALIDO', detalle: "Error en consumo #1: origen_tipo 'DIRECTO' solo es válido si incluye identificadores de origen." },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(resultado?.estado).toBe('RECHAZADO');
    expect(resultado?.codigo).toBe('CONSUMO_INVALIDO');
    // Caso real actual (payload sin IDs de origen): el texto del backend llega en "detalle" y se muestra legible
    expect(resultado?.mensaje).toBe("El servidor rechazó el descuento del kit: Error en consumo #1: origen_tipo 'DIRECTO' solo es válido si incluye identificadores de origen.");
    expect(consumosLocales()).toEqual({});
  });

  it('RECHAZADO sin HTTP: medicamento inexistente en el kit', () => {
    let resultado: ResultadoConsumoKit | undefined;
    service.registrarConsumo(999, 1, 'obs', 'Inexistente', ORIGEN).subscribe(r => (resultado = r));

    httpMock.expectNone(esSync);
    expect(resultado?.estado).toBe('RECHAZADO');
    expect(resultado?.httpStatus).toBeNull();
    expect(resultado?.mensaje).toContain('no está asignado a tu kit');
    expect(saldoLocal()).toBe(10);
    expect(consumosLocales()).toEqual({});
  });

  it('RECHAZADO sin HTTP: medicamento del kit sin saldo', () => {
    (service as any).inventarioActual$.next([itemKit({ saldoDisponible: 0, cantidadConsumida: 10 })]);
    let resultado: ResultadoConsumoKit | undefined;
    service.registrarConsumo(7, 1, 'obs', 'Amoxicilina', ORIGEN).subscribe(r => (resultado = r));

    httpMock.expectNone(esSync);
    expect(resultado?.estado).toBe('RECHAZADO');
    expect(resultado?.codigo).toBe('SIN_SALDO_EN_KIT');
    expect(consumosLocales()).toEqual({});
  });

  it('cantidad mayor que el saldo local (saldo > 0): decide el backend como antes; su 409 queda RECHAZADO sin descuento', () => {
    let resultado: ResultadoConsumoKit | undefined;
    service.registrarConsumo(7, 11, 'obs', 'Amoxicilina', ORIGEN).subscribe(r => (resultado = r));

    // Un solo POST (comportamiento previo conservado: el caché local puede estar desactualizado)
    const req = httpMock.expectOne(esSync);
    const uuid = req.request.body.consumos[0].client_uuid;
    req.flush(
      {
        error: 'CONFLICTO_STOCK_KIT',
        aplicados: [],
        conflictos: [{ client_uuid: uuid, estado: 'RECHAZADO_CONFLICTO', motivo_rechazo: 'Stock insuficiente: disponible 10, solicitado 11' }]
      },
      { status: 409, statusText: 'Conflict' }
    );

    expect(resultado?.estado).toBe('RECHAZADO');
    expect(resultado?.httpStatus).toBe(409);
    expect(resultado?.mensaje).toContain('Stock insuficiente: disponible 10, solicitado 11');
    expect(saldoLocal()).toBe(10);
    expect(consumosLocales()).toEqual({});
  });

  it('PENDIENTE sin conexión (status 0): conserva el registro local como antes, sin confirmarlo', () => {
    let resultado: ResultadoConsumoKit | undefined;
    service.registrarConsumo(7, 2, 'obs', 'Amoxicilina', ORIGEN).subscribe(r => (resultado = r));

    httpMock.expectOne(esSync).error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(resultado?.estado).toBe('PENDIENTE');
    expect(resultado?.httpStatus).toBe(0);
    expect(resultado?.mensaje).toContain('pendiente de sincronizar');
    expect(saldoLocal()).toBe(8);
    expect(consumosLocales()).toEqual({ '7': 2 });
  });

  it('PENDIENTE con 5xx (resultado incierto): nunca éxito', () => {
    let resultado: ResultadoConsumoKit | undefined;
    service.registrarConsumo(7, 1, 'obs', 'Amoxicilina', ORIGEN).subscribe(r => (resultado = r));

    httpMock.expectOne(esSync).flush('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' });

    expect(resultado?.estado).toBe('PENDIENTE');
    expect(resultado?.httpStatus).toBe(502);
    expect(resultado?.mensaje).toContain('no está confirmado');
    expect(resultado?.mensaje).not.toContain('<html>');
  });

  it('PENDIENTE con 200 que no incluye el client_uuid enviado', () => {
    let resultado: ResultadoConsumoKit | undefined;
    service.registrarConsumo(7, 1, 'obs', 'Amoxicilina', ORIGEN).subscribe(r => (resultado = r));

    httpMock.expectOne(esSync).flush({ aplicados: [{ client_uuid: 'otro-uuid', estado: 'APLICADO' }], conflictos: [] });

    expect(resultado?.estado).toBe('PENDIENTE');
    expect(resultado?.codigo).toBe('SIN_CONFIRMACION');
  });

  it('dos consumos concurrentes confirmados: cada uno descuenta una vez (sin pérdida ni doble descuento)', () => {
    let resultados: ResultadoConsumoKit[] = [];
    forkJoin([
      service.registrarConsumo(7, 2, 'a', 'Amoxicilina', ORIGEN),
      service.registrarConsumo(7, 1, 'b', 'Amoxicilina', ORIGEN)
    ]).subscribe(r => (resultados = r));

    const reqs = httpMock.match(esSync);
    expect(reqs.length).toBe(2);
    reqs.forEach(req => {
      const c = req.request.body.consumos[0];
      req.flush({ aplicados: [{ client_uuid: c.client_uuid, estado: 'APLICADO', unidades_descontadas: c.unidades }], conflictos: [] });
    });

    expect(resultados.map(r => r.estado)).toEqual(['CONFIRMADO', 'CONFIRMADO']);
    expect(saldoLocal()).toBe(7);
    expect(consumosLocales()).toEqual({ '7': 3 });
  });

  it('origen de acta: envía id_seguimiento_visita con su nombre exacto y sin id_consulta', () => {
    let resultado: ResultadoConsumoKit | undefined;
    service.registrarConsumo(7, 1, 'obs', 'Amoxicilina', { id_seguimiento_visita: 31 }).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(esSync);
    const consumo = req.request.body.consumos[0];
    expect(consumo.id_seguimiento_visita).toBe(31);
    expect('id_consulta' in consumo).toBe(false);
    req.flush({ aplicados: [{ client_uuid: consumo.client_uuid, estado: 'APLICADO', unidades_descontadas: 1 }], conflictos: [] });
    expect(resultado?.estado).toBe('CONFIRMADO');
    expect(saldoLocal()).toBe(9);
  });

  it('sin origen clínico: RECHAZADO ORIGEN_CLINICO_REQUERIDO, sin HTTP ni descuento local', () => {
    const resultados: ResultadoConsumoKit[] = [];
    service.registrarConsumo(7, 1, 'obs', 'Amoxicilina').subscribe(r => resultados.push(r));
    service.registrarConsumo(7, 1, 'obs', 'Amoxicilina', null).subscribe(r => resultados.push(r));
    service.registrarConsumo(7, 1, 'obs', 'Amoxicilina', { id_consulta: 0 }).subscribe(r => resultados.push(r));
    service.registrarConsumo(7, 1, 'obs', 'Amoxicilina', { id_consulta: 1.5 as any }).subscribe(r => resultados.push(r));
    // Mezclar historia y acta tampoco es un origen válido para el backend
    service.registrarConsumo(7, 1, 'obs', 'Amoxicilina', { id_consulta: 5, id_seguimiento_visita: 6 }).subscribe(r => resultados.push(r));

    httpMock.expectNone(esSync);
    expect(resultados.length).toBe(5);
    resultados.forEach(r => {
      expect(r.estado).toBe('RECHAZADO');
      expect(r.codigo).toBe('ORIGEN_CLINICO_REQUERIDO');
      expect(r.httpStatus).toBeNull();
      expect(r.mensaje).not.toContain('Descuento registrado');
    });
    expect(saldoLocal()).toBe(10);
    expect(consumosLocales()).toEqual({});
  });

  it('id_consulta inexistente: el 400 del backend queda RECHAZADO con su mensaje y sin descuento', () => {
    let resultado: ResultadoConsumoKit | undefined;
    service.registrarConsumo(7, 1, 'obs', 'Amoxicilina', { id_consulta: 999999 }).subscribe(r => (resultado = r));
    const req = httpMock.expectOne(esSync);
    expect(req.request.body.consumos[0].id_consulta).toBe(999999);
    req.flush(
      { error: 'CONSUMO_INVALIDO', detalle: 'No se pudo registrar el consumo: el identificador de origen no existe o los datos son inválidos' },
      { status: 400, statusText: 'Bad Request' }
    );
    expect(resultado?.estado).toBe('RECHAZADO');
    expect(resultado?.httpStatus).toBe(400);
    expect(resultado?.mensaje).toContain('el identificador de origen no existe');
    expect(saldoLocal()).toBe(10);
  });

  it('ningún resultado RECHAZADO/PENDIENTE contiene el texto "Descuento registrado"', () => {
    const recibidos: ResultadoConsumoKit[] = [];
    const casos: Array<{ status: number; body: any }> = [
      { status: 403, body: { detail: 'Sin permisos' } },
      { status: 409, body: { error: 'CONFLICTO_STOCK_KIT', aplicados: [], conflictos: [{ motivo_rechazo: 'Sin stock' }] } },
      { status: 400, body: { consumos: [{ client_uuid: ['UUID inválido'] }] } },
      { status: 500, body: null }
    ];
    casos.forEach(caso => {
      service.registrarConsumo(7, 1, 'obs', 'Amoxicilina', ORIGEN).subscribe(r => recibidos.push(r));
      httpMock.expectOne(esSync).flush(caso.body, { status: caso.status, statusText: 'x' });
    });
    service.registrarConsumo(999, 1, 'obs', 'Inexistente', ORIGEN).subscribe(r => recibidos.push(r));

    expect(recibidos.length).toBe(5);
    recibidos.forEach(r => {
      expect(r.estado).not.toBe('CONFIRMADO');
      expect(r.mensaje).not.toContain('Descuento registrado');
    });
    expect(recibidos[2].mensaje).toBe('El servidor rechazó el descuento del kit: UUID inválido');
  });
});

describe('consumo-kit-resultado (funciones puras)', () => {
  const ctx = { clientUuid: 'abc', idMedicamento: 7, unidades: 2, nombreMedicamento: 'Amoxicilina' };

  it('clasificarRespuestaConsumoKit: conflicto propio en 200 → RECHAZADO; aplicado → CONFIRMADO', () => {
    expect(clasificarRespuestaConsumoKit({ aplicados: [], conflictos: [{ client_uuid: 'ABC', motivo_rechazo: 'x' }] }, ctx).estado).toBe('RECHAZADO');
    expect(clasificarRespuestaConsumoKit({ aplicados: [{ client_uuid: 'abc', estado: 'APLICADO' }], conflictos: [] }, ctx).estado).toBe('CONFIRMADO');
    expect(clasificarRespuestaConsumoKit(null, ctx).estado).toBe('PENDIENTE');
  });

  it('clasificarErrorConsumoKit: 0 / 5xx / error no HTTP → PENDIENTE; 4xx → RECHAZADO', () => {
    expect(clasificarErrorConsumoKit({ status: 0 }, ctx).estado).toBe('PENDIENTE');
    expect(clasificarErrorConsumoKit({ status: 503 }, ctx).estado).toBe('PENDIENTE');
    expect(clasificarErrorConsumoKit(new Error('timeout'), ctx).estado).toBe('PENDIENTE');
    expect(clasificarErrorConsumoKit({ status: 401, error: {} }, ctx).estado).toBe('RECHAZADO');
  });

  it('resultadoPendientePrevioKit: PENDIENTE sin client_uuid nuevo (no se reenvía)', () => {
    const r = resultadoPendientePrevioKit({ id: 7, nombre: 'Amoxicilina', cantidadPendienteKit: 2 });
    expect(r.estado).toBe('PENDIENTE');
    expect(r.clientUuid).toBeNull();
    expect(r.unidades).toBe(2);
    expect(r.mensaje).toContain('pendiente de sincronizar');
  });

  it('extraerConflictosStockFarmacia lee alertas_farmacia.conflictos_stock de la respuesta clínica', () => {
    const resp = {
      status: 'success',
      historia_id: 5,
      alertas_farmacia: { conflictos_stock: [{ id_medicamento: 7, nombre_medicamento: 'Amoxicilina', motivo_rechazo: 'Stock insuficiente' }] }
    };
    expect(extraerConflictosStockFarmacia(resp).length).toBe(1);
    expect(extraerConflictosStockFarmacia({ status: 'success' })).toEqual([]);
    expect(extraerConflictosStockFarmacia(null)).toEqual([]);
  });

  it('construirAvisoGuardadoClinico diferencia guardado clínico de descuento no confirmado', () => {
    const rechazado: ResultadoConsumoKit = {
      estado: 'RECHAZADO', mensaje: 'Sin permisos', clientUuid: 'abc', idMedicamento: 7, unidades: 2,
      nombreMedicamento: 'Amoxicilina', httpStatus: 403
    };
    const pendiente: ResultadoConsumoKit = { ...rechazado, estado: 'PENDIENTE', mensaje: 'Sin conexión', httpStatus: 0 };
    const confirmado: ResultadoConsumoKit = { ...rechazado, estado: 'CONFIRMADO', mensaje: 'ok', httpStatus: 200 };

    const avisoHistoria = construirAvisoGuardadoClinico('historia', [rechazado]);
    expect(avisoHistoria).toContain('Historia clínica guardada correctamente, pero el medicamento no fue descontado del kit. Revisa las alertas de farmacia.');
    expect(avisoHistoria).toContain('Sin permisos');

    const avisoActa = construirAvisoGuardadoClinico('acta', [], [{ nombre_medicamento: 'Amoxicilina', motivo_rechazo: 'Stock insuficiente' }]);
    expect(avisoActa).toContain('Acta guardada correctamente, pero el medicamento no fue descontado del kit.');
    expect(avisoActa).toContain('Alerta de farmacia: Amoxicilina — Stock insuficiente');

    const avisoPendiente = construirAvisoGuardadoClinico('historia', [pendiente]);
    expect(avisoPendiente).toContain('pendiente de sincronizar');

    expect(construirAvisoGuardadoClinico('historia', [confirmado], [])).toBeNull();
    [avisoHistoria, avisoActa, avisoPendiente].forEach(a => expect(a).not.toContain('Descuento registrado'));
  });
});
