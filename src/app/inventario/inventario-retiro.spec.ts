import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Swal from 'sweetalert2';

import { Inventario } from './inventario';
import { InventarioJuridicoComponent } from '../inventario-juridico/inventario-juridico';
import { VeterinaryInventoryService } from '../services/veterinary-inventory.service';

interface LoteReintegradoMock {
  id_kit_lote: number;
  id_inventario: number;
  cantidad_retirada: number;
  saldo_restante_kit: number;
  saldo_resultante_bodega: number;
}

interface BajaVencimientoMock {
  id_kit_lote: number;
  id_inventario: number;
  cantidad_baja: number;
  fecha_vencimiento: string;
}

const construirRespuestaRetiroBackend = (overrides: {
  id_medicamento?: number;
  nombre_medicamento?: string;
  cantidad_total_retirada: number;
  unidades_reintegradas: number;
  unidades_baja_vencimiento?: number;
  lotes_reintegrados_bodega?: LoteReintegradoMock[];
  bajas_vencimiento?: BajaVencimientoMock[];
}) => ({
  mensaje: 'Retiro ejecutado exitosamente',
  id_medicamento: overrides.id_medicamento ?? 5,
  nombre_medicamento: overrides.nombre_medicamento ?? 'Amoxicilina',
  cantidad_total_retirada: overrides.cantidad_total_retirada,
  unidades_reintegradas: overrides.unidades_reintegradas,
  unidades_baja_vencimiento: overrides.unidades_baja_vencimiento ?? 0,
  lotes_reintegrados_bodega: overrides.lotes_reintegrados_bodega ?? [],
  bajas_vencimiento: overrides.bajas_vencimiento ?? []
});

describe('Retiro de kit sin doble reintegro (Administrador y Jurídico)', () => {
  let httpMock: HttpTestingController;
  let swalSpy: ReturnType<typeof vi.spyOn>;

  const flushInventoryGetRequests = (
    inventariosPayload: any[] = [],
    kitVeterinarioPayload: any = { items: [] }
  ) => {
    const getReqs = httpMock.match((req) => req.method === 'GET');
    for (const req of getReqs) {
      if (req.request.url.includes('/api/inventario/inventarios/')) {
        req.flush(inventariosPayload);
      } else if (req.request.url.includes('/api/inventario/compras/')) {
        req.flush([
          {
            id_compra: 10,
            id_proveedor: 1,
            estado: 'COMPLETADA',
            fecha: '2026-11-01',
            detalles: [{ id_detalle_compra: 100, id_medicamento: 5, cantidad: 50 }]
          }
        ]);
      } else if (req.request.url.includes('/api/inventario/detalles-compra/')) {
        req.flush([{ id_detalle_compra: 100, id_compra: 10, id_medicamento: 5, cantidad: 50 }]);
      } else if (req.request.url.includes('/api/medicamentos-catalogo/')) {
        req.flush([{ id_medicamento: 5, nombre: 'Amoxicilina', descripcion: '500mg', tipo: 'Antibiótico' }]);
      } else if (req.request.url.includes('/api/medicamentos/')) {
        req.flush([{ id: 5, id_medicamento: 5, nombre: 'Amoxicilina' }]);
      } else if (req.request.url.includes('/api/inventario/proveedores/')) {
        req.flush([{ id_proveedor: 1, nombre: 'VetSupply' }]);
      } else if (req.request.url.includes('/api/inventario/kit/')) {
        req.flush(kitVeterinarioPayload);
      } else {
        req.flush([]);
      }
    }
  };

  const assertZeroInventoryPatchRequests = () => {
    const patchReqs = httpMock.match(
      (req) => req.method === 'PATCH' && req.url.includes('/api/inventario/inventarios/')
    );
    expect(patchReqs).toHaveLength(0);
  };

  beforeEach(() => {
    localStorage.clear();
    swalSpy = vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true } as any);

    TestBed.configureTestingModule({
      imports: [Inventario, InventarioJuridicoComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    assertZeroInventoryPatchRequests();
    vi.restoreAllMocks();
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  describe('VeterinaryInventoryService.ajustarStockKit (RETIRO)', () => {
    it('envía únicamente POST /api/inventario/kit/retiro-directo/ usando el contrato real del backend y nunca PATCH /api/inventario/inventarios/', () => {
      const svc = TestBed.inject(VeterinaryInventoryService);
      let respuesta: any;

      svc.ajustarStockKit(7, 5, 4, 'RETIRO', 'Devolución a bodega').subscribe((res) => {
        respuesta = res;
      });

      const postReq = httpMock.expectOne(
        (req) => req.method === 'POST' && req.url.includes('/api/inventario/kit/retiro-directo/')
      );
      expect(postReq.request.body).toEqual({
        id_veterinario: 7,
        id_medicamento: 5,
        cantidad: 4,
        motivo: 'Devolución a bodega'
      });

      postReq.flush(
        construirRespuestaRetiroBackend({
          id_medicamento: 5,
          nombre_medicamento: 'Amoxicilina',
          cantidad_total_retirada: 4,
          unidades_reintegradas: 4,
          unidades_baja_vencimiento: 0,
          lotes_reintegrados_bodega: [
            {
              id_kit_lote: 30,
              id_inventario: 101,
              cantidad_retirada: 4,
              saldo_restante_kit: 6,
              saldo_resultante_bodega: 14
            }
          ]
        })
      );

      expect(respuesta?.mensaje).toBe('Retiro ejecutado exitosamente');
      expect(respuesta?.unidades_reintegradas).toBe(4);
      expect(respuesta?.lotes_reintegrados_bodega).toHaveLength(1);
      assertZeroInventoryPatchRequests();
      httpMock.verify();
    });

    it('propaga errores HTTP 400/403 del backend en RETIRO en lugar de simular éxito offline', () => {
      const svc = TestBed.inject(VeterinaryInventoryService);
      let errorRecibido: any;
      let exitoRecibido: any;

      svc.ajustarStockKit(7, 5, 99, 'RETIRO', 'Exceso').subscribe({
        next: (res) => (exitoRecibido = res),
        error: (err) => (errorRecibido = err)
      });

      const postReq = httpMock.expectOne(
        (req) => req.method === 'POST' && req.url.includes('/api/inventario/kit/retiro-directo/')
      );
      postReq.flush(
        { error: 'STOCK_INSUFICIENTE_KIT', detalle: 'El veterinario solo tiene 5 unidades.' },
        { status: 400, statusText: 'Bad Request' }
      );

      expect(exitoRecibido).toBeUndefined();
      expect(errorRecibido?.status).toBe(400);
      expect(errorRecibido?.error?.error).toBe('STOCK_INSUFICIENTE_KIT');
      expect(localStorage.getItem('vetericano_lotes_asignados_vet_7')).toBeNull();
      expect(localStorage.getItem('vetericano_historial_asignaciones')).toBeNull();
      assertZeroInventoryPatchRequests();
      httpMock.verify();
    });

    it('ante error de red (status 0) en RETIRO NO simula éxito en localStorage, NO repite POST y propaga el error', () => {
      const svc = TestBed.inject(VeterinaryInventoryService);
      let errorRecibido: any;
      let exitoRecibido: any;

      svc.ajustarStockKit(7, 5, 4, 'RETIRO', 'Corte de red').subscribe({
        next: (res) => (exitoRecibido = res),
        error: (err) => (errorRecibido = err)
      });

      const postReq = httpMock.expectOne(
        (req) => req.method === 'POST' && req.url.includes('/api/inventario/kit/retiro-directo/')
      );
      postReq.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      expect(exitoRecibido).toBeUndefined();
      expect(errorRecibido?.status).toBe(0);
      expect(localStorage.getItem('vetericano_lotes_asignados_vet_7')).toBeNull();
      expect(localStorage.getItem('vetericano_historial_asignaciones')).toBeNull();
      expect(
        httpMock.match((req) => req.method === 'POST' && req.url.includes('/api/inventario/kit/retiro-directo/'))
      ).toHaveLength(0);
      assertZeroInventoryPatchRequests();
      httpMock.verify();
    });
  });

  describe('Administrador (Inventario component)', () => {
    it('1 lote: retira del kit sin emitir PATCH /inventarios/ y recarga stock real desde backend', () => {
      const fixture = TestBed.createComponent(Inventario);
      const comp = fixture.componentInstance;
      const cargarSpy = vi.spyOn(comp, 'cargar');

      comp.veterinarios = [{ id_usuario: 7, nombre: 'Dra. Ana' }];
      comp.loteSeleccionado = {
        idMed: 5,
        nombre: 'Amoxicilina',
        stock: 10,
        idInvs: [101],
        refInv: { id_inventario: 101, estado: 'Disponible' }
      };
      comp.idVeterinarioSeleccionado = 7;
      comp.tipoOperacionAsignar = 'RETIRO';
      comp.cantidadAAsignar = 4;
      comp.motivoAsignacion = 'Reintegro normal';
      comp.modalAsignarAbierto = true;

      comp.confirmarAsignacion();

      const postReq = httpMock.expectOne(
        (req) => req.method === 'POST' && req.url.includes('/api/inventario/kit/retiro-directo/')
      );
      postReq.flush(
        construirRespuestaRetiroBackend({
          id_medicamento: 5,
          nombre_medicamento: 'Amoxicilina',
          cantidad_total_retirada: 4,
          unidades_reintegradas: 4,
          unidades_baja_vencimiento: 0,
          lotes_reintegrados_bodega: [
            {
              id_kit_lote: 30,
              id_inventario: 101,
              cantidad_retirada: 4,
              saldo_restante_kit: 6,
              saldo_resultante_bodega: 14
            }
          ]
        })
      );

      assertZeroInventoryPatchRequests();
      expect(cargarSpy).toHaveBeenCalledTimes(1);

      flushInventoryGetRequests([
        { id_inventario: 101, id_detalle_compra: 100, id_medicamento: 5, cantidad_actual: 14, estado: 'Disponible' }
      ]);

      expect(comp.modalAsignarAbierto).toBe(false);
      expect(comp.filas.find((i: any) => i.idMed === 5)?.stock).toBe(14);
      expect(swalSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: 'success',
          title: 'Stock devuelto a bodega'
        })
      );

      fixture.destroy();
      httpMock.verify();
    });

    it('múltiples lotes: no suma el stock total sobre un solo idInv y refleja la suma real de lotes recargados', () => {
      const fixture = TestBed.createComponent(Inventario);
      const comp = fixture.componentInstance;

      comp.veterinarios = [{ id_usuario: 7, nombre: 'Dra. Ana' }];
      comp.loteSeleccionado = {
        idMed: 5,
        nombre: 'Amoxicilina',
        stock: 25,
        idInvs: [101, 102],
        refInv: { id_inventario: 101, estado: 'Disponible' }
      };
      comp.idVeterinarioSeleccionado = 7;
      comp.tipoOperacionAsignar = 'RETIRO';
      comp.cantidadAAsignar = 6;
      comp.modalAsignarAbierto = true;

      comp.confirmarAsignacion();

      const postReq = httpMock.expectOne(
        (req) => req.method === 'POST' && req.url.includes('/api/inventario/kit/retiro-directo/')
      );
      postReq.flush(
        construirRespuestaRetiroBackend({
          id_medicamento: 5,
          nombre_medicamento: 'Amoxicilina',
          cantidad_total_retirada: 6,
          unidades_reintegradas: 6,
          unidades_baja_vencimiento: 0,
          lotes_reintegrados_bodega: [
            {
              id_kit_lote: 31,
              id_inventario: 102,
              cantidad_retirada: 4,
              saldo_restante_kit: 0,
              saldo_resultante_bodega: 19
            },
            {
              id_kit_lote: 30,
              id_inventario: 101,
              cantidad_retirada: 2,
              saldo_restante_kit: 3,
              saldo_resultante_bodega: 12
            }
          ]
        })
      );

      assertZeroInventoryPatchRequests();

      flushInventoryGetRequests([
        { id_inventario: 101, id_detalle_compra: 100, id_medicamento: 5, cantidad_actual: 12, estado: 'Disponible' },
        { id_inventario: 102, id_detalle_compra: 100, id_medicamento: 5, cantidad_actual: 19, estado: 'Disponible' }
      ]);

      expect(comp.filas.find((i: any) => i.idMed === 5)?.stock).toBe(31);
      fixture.destroy();
      httpMock.verify();
    });

    it('unidades parcialmente vencidas: solo reintegra unidades vigentes y mantiene bajas fuera de bodega', () => {
      const fixture = TestBed.createComponent(Inventario);
      const comp = fixture.componentInstance;

      comp.veterinarios = [{ id_usuario: 7, nombre: 'Dra. Ana' }];
      comp.loteSeleccionado = {
        idMed: 5,
        nombre: 'Amoxicilina',
        stock: 10,
        idInvs: [101],
        refInv: { id_inventario: 101, estado: 'Disponible' }
      };
      comp.idVeterinarioSeleccionado = 7;
      comp.tipoOperacionAsignar = 'RETIRO';
      comp.cantidadAAsignar = 5;
      comp.modalAsignarAbierto = true;

      comp.confirmarAsignacion();

      const postReq = httpMock.expectOne(
        (req) => req.method === 'POST' && req.url.includes('/api/inventario/kit/retiro-directo/')
      );
      postReq.flush(
        construirRespuestaRetiroBackend({
          id_medicamento: 5,
          nombre_medicamento: 'Amoxicilina',
          cantidad_total_retirada: 5,
          unidades_reintegradas: 2,
          unidades_baja_vencimiento: 3,
          lotes_reintegrados_bodega: [
            {
              id_kit_lote: 32,
              id_inventario: 101,
              cantidad_retirada: 2,
              saldo_restante_kit: 4,
              saldo_resultante_bodega: 12
            }
          ],
          bajas_vencimiento: [
            {
              id_kit_lote: 29,
              id_inventario: 99,
              cantidad_baja: 3,
              fecha_vencimiento: '2026-01-10'
            }
          ]
        })
      );

      assertZeroInventoryPatchRequests();

      flushInventoryGetRequests([
        { id_inventario: 101, id_detalle_compra: 100, id_medicamento: 5, cantidad_actual: 12, estado: 'Disponible' }
      ]);

      expect(comp.filas.find((i: any) => i.idMed === 5)?.stock).toBe(12);
      const swalArg = swalSpy.mock.calls[0][0] as any;
      expect(swalArg.html).toContain('2');
      expect(swalArg.html).toContain('3');
      expect(swalArg.html).not.toContain('Stock resultante');

      fixture.destroy();
      httpMock.verify();
    });

    it('todas las unidades vencidas: reintegra 0 unidades a bodega y no emite PATCH', () => {
      const fixture = TestBed.createComponent(Inventario);
      const comp = fixture.componentInstance;

      comp.veterinarios = [{ id_usuario: 7, nombre: 'Dra. Ana' }];
      comp.loteSeleccionado = {
        idMed: 5,
        nombre: 'Amoxicilina',
        stock: 10,
        idInvs: [101],
        refInv: { id_inventario: 101, estado: 'Disponible' }
      };
      comp.idVeterinarioSeleccionado = 7;
      comp.tipoOperacionAsignar = 'RETIRO';
      comp.cantidadAAsignar = 5;
      comp.modalAsignarAbierto = true;

      comp.confirmarAsignacion();

      const postReq = httpMock.expectOne(
        (req) => req.method === 'POST' && req.url.includes('/api/inventario/kit/retiro-directo/')
      );
      postReq.flush(
        construirRespuestaRetiroBackend({
          id_medicamento: 5,
          nombre_medicamento: 'Amoxicilina',
          cantidad_total_retirada: 5,
          unidades_reintegradas: 0,
          unidades_baja_vencimiento: 5,
          lotes_reintegrados_bodega: [],
          bajas_vencimiento: [
            {
              id_kit_lote: 28,
              id_inventario: 98,
              cantidad_baja: 5,
              fecha_vencimiento: '2026-01-05'
            }
          ]
        })
      );

      assertZeroInventoryPatchRequests();

      flushInventoryGetRequests([
        { id_inventario: 101, id_detalle_compra: 100, id_medicamento: 5, cantidad_actual: 10, estado: 'Disponible' }
      ]);

      expect(comp.filas.find((i: any) => i.idMed === 5)?.stock).toBe(10);
      const swalArg = swalSpy.mock.calls[0][0] as any;
      expect(swalArg.title).toBe('Unidades vencidas dadas de baja');
      expect(swalArg.html).toContain('0');
      expect(swalArg.html).toContain('5');
      expect(swalArg.html).toContain('Baja por vencimiento');

      fixture.destroy();
      httpMock.verify();
    });

    it('retiro parcial desde kit incluso cuando cantidad > stockActual en bodega general', () => {
      const fixture = TestBed.createComponent(Inventario);
      const comp = fixture.componentInstance;

      comp.veterinarios = [{ id_usuario: 7, nombre: 'Dra. Ana' }];
      comp.loteSeleccionado = {
        idMed: 5,
        nombre: 'Amoxicilina',
        stock: 2,
        idInvs: [101],
        refInv: { id_inventario: 101, estado: 'Disponible' }
      };
      comp.idVeterinarioSeleccionado = 7;
      comp.tipoOperacionAsignar = 'RETIRO';
      comp.cantidadAAsignar = 5;
      comp.modalAsignarAbierto = true;

      comp.confirmarAsignacion();

      expect(comp.errorAsignacion).toBe('');
      const postReq = httpMock.expectOne(
        (req) => req.method === 'POST' && req.url.includes('/api/inventario/kit/retiro-directo/')
      );
      expect(postReq.request.body.cantidad).toBe(5);
      postReq.flush(
        construirRespuestaRetiroBackend({
          id_medicamento: 5,
          nombre_medicamento: 'Amoxicilina',
          cantidad_total_retirada: 5,
          unidades_reintegradas: 5,
          unidades_baja_vencimiento: 0,
          lotes_reintegrados_bodega: [
            {
              id_kit_lote: 33,
              id_inventario: 101,
              cantidad_retirada: 5,
              saldo_restante_kit: 5,
              saldo_resultante_bodega: 7
            }
          ]
        })
      );

      assertZeroInventoryPatchRequests();

      flushInventoryGetRequests([
        { id_inventario: 101, id_detalle_compra: 100, id_medicamento: 5, cantidad_actual: 7, estado: 'Disponible' }
      ]);

      expect(comp.filas.find((i: any) => i.idMed === 5)?.stock).toBe(7);
      fixture.destroy();
      httpMock.verify();
    });

    it('error HTTP 400 en retiro muestra detalle en errorAsignacion sin cerrar modal ni disparar éxito', () => {
      const fixture = TestBed.createComponent(Inventario);
      const comp = fixture.componentInstance;

      comp.veterinarios = [{ id_usuario: 7, nombre: 'Dra. Ana' }];
      comp.loteSeleccionado = {
        idMed: 5,
        nombre: 'Amoxicilina',
        stock: 10,
        idInvs: [101],
        refInv: { id_inventario: 101, estado: 'Disponible' }
      };
      comp.idVeterinarioSeleccionado = 7;
      comp.tipoOperacionAsignar = 'RETIRO';
      comp.cantidadAAsignar = 20;
      comp.modalAsignarAbierto = true;

      comp.confirmarAsignacion();

      const postReq = httpMock.expectOne(
        (req) => req.method === 'POST' && req.url.includes('/api/inventario/kit/retiro-directo/')
      );
      postReq.flush(
        { error: 'STOCK_INSUFICIENTE_KIT', detalle: 'Saldo insuficiente en el kit del veterinario.' },
        { status: 400, statusText: 'Bad Request' }
      );

      expect(comp.modalAsignarAbierto).toBe(true);
      expect(comp.guardandoAsignacion).toBe(false);
      expect(comp.errorAsignacion).toBe('Saldo insuficiente en el kit del veterinario.');
      expect(swalSpy).not.toHaveBeenCalled();

      assertZeroInventoryPatchRequests();
      fixture.destroy();
      httpMock.verify();
    });

    it('resultado incierto (status 0) informa al usuario, recupera estado por GET sin repetir POST ni usar localStorage', () => {
      const fixture = TestBed.createComponent(Inventario);
      const comp = fixture.componentInstance;
      const cargarSpy = vi.spyOn(comp, 'cargar');

      comp.veterinarios = [{ id_usuario: 7, nombre: 'Dra. Ana' }];
      comp.loteSeleccionado = {
        idMed: 5,
        nombre: 'Amoxicilina',
        stock: 10,
        idInvs: [101],
        refInv: { id_inventario: 101, estado: 'Disponible' }
      };
      comp.idVeterinarioSeleccionado = 7;
      comp.tipoOperacionAsignar = 'RETIRO';
      comp.cantidadAAsignar = 4;
      comp.modalAsignarAbierto = true;

      comp.confirmarAsignacion();

      const postReq = httpMock.expectOne(
        (req) => req.method === 'POST' && req.url.includes('/api/inventario/kit/retiro-directo/')
      );
      postReq.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      expect(comp.guardandoAsignacion).toBe(false);
      expect(comp.modalAsignarAbierto).toBe(false);
      expect(cargarSpy).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('vetericano_lotes_asignados_vet_7')).toBeNull();
      expect(
        httpMock.match((req) => req.method === 'POST' && req.url.includes('/api/inventario/kit/retiro-directo/'))
      ).toHaveLength(0);

      flushInventoryGetRequests([
        { id_inventario: 101, id_detalle_compra: 100, id_medicamento: 5, cantidad_actual: 14, estado: 'Disponible' }
      ]);

      expect(comp.filas.find((i: any) => i.idMed === 5)?.stock).toBe(14);
      expect(swalSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: 'warning',
          title: 'No se pudo confirmar el retiro',
          text: 'No se recibió confirmación definitiva del servidor. El retiro pudo haberse aplicado. Revisa el inventario actualizado antes de intentar nuevamente la operación.'
        })
      );

      assertZeroInventoryPatchRequests();
      fixture.destroy();
      httpMock.verify();
    });

    it('escapa etiquetas HTML en nombreProd y nombreVet dentro del modal Swal.fire', () => {
      const fixture = TestBed.createComponent(Inventario);
      const comp = fixture.componentInstance;

      comp.veterinarios = [{ id_usuario: 7, nombre: "<script>alert('xss')</script>" }];
      comp.loteSeleccionado = {
        idMed: 5,
        nombre: '<img src=x onerror=alert(1)>',
        stock: 10,
        idInvs: [101],
        refInv: { id_inventario: 101, estado: 'Disponible' }
      };
      comp.idVeterinarioSeleccionado = 7;
      comp.tipoOperacionAsignar = 'RETIRO';
      comp.cantidadAAsignar = 2;
      comp.modalAsignarAbierto = true;

      comp.confirmarAsignacion();

      const postReq = httpMock.expectOne(
        (req) => req.method === 'POST' && req.url.includes('/api/inventario/kit/retiro-directo/')
      );
      postReq.flush(
        construirRespuestaRetiroBackend({
          id_medicamento: 5,
          nombre_medicamento: '<img src=x onerror=alert(1)>',
          cantidad_total_retirada: 2,
          unidades_reintegradas: 2,
          unidades_baja_vencimiento: 0,
          lotes_reintegrados_bodega: [
            {
              id_kit_lote: 34,
              id_inventario: 101,
              cantidad_retirada: 2,
              saldo_restante_kit: 8,
              saldo_resultante_bodega: 12
            }
          ]
        })
      );

      flushInventoryGetRequests([
        { id_inventario: 101, id_detalle_compra: 100, id_medicamento: 5, cantidad_actual: 12, estado: 'Disponible' }
      ]);

      const swalArg = swalSpy.mock.calls[0][0] as any;
      expect(swalArg.html).not.toContain('<img');
      expect(swalArg.html).not.toContain('<script');
      expect(swalArg.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(swalArg.html).toContain('&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;');

      fixture.destroy();
      httpMock.verify();
    });
  });

  describe('Jurídico (InventarioJuridicoComponent)', () => {
    it('retiro con unidades parciales y vencidas: no emite PATCH /inventarios/, recarga general + kit y muestra stock real', () => {
      const fixture = TestBed.createComponent(InventarioJuridicoComponent);
      const comp = fixture.componentInstance;
      const generalSpy = vi.spyOn(comp, 'cargarInventarioGeneral');
      const vetSpy = vi.spyOn(comp, 'cargarInventarioDeVeterinario');

      comp.veterinarios = [{ id_usuario: 9, nombre: 'Dr. Carlos' }];
      comp.idVeterinarioSeleccionado = 9;
      comp.idVeterinarioAsignar = 9;
      comp.loteSeleccionado = {
        idMed: 5,
        nombre: 'Amoxicilina',
        stock: 20,
        idInvs: [201, 202],
        refInv: { id_inventario: 201, estado: 'Disponible' }
      };
      comp.tipoOperacionAsignar = 'RETIRO';
      comp.cantidadAAsignar = 6;
      comp.motivoAsignacion = 'Auditoría jurídica';
      comp.modalAsignarAbierto = true;

      comp.confirmarAsignacion();

      const postReq = httpMock.expectOne(
        (req) => req.method === 'POST' && req.url.includes('/api/inventario/kit/retiro-directo/')
      );
      expect(postReq.request.body).toEqual({
        id_veterinario: 9,
        id_medicamento: 5,
        cantidad: 6,
        motivo: 'Auditoría jurídica'
      });

      postReq.flush(
        construirRespuestaRetiroBackend({
          id_medicamento: 5,
          nombre_medicamento: 'Amoxicilina',
          cantidad_total_retirada: 6,
          unidades_reintegradas: 4,
          unidades_baja_vencimiento: 2,
          lotes_reintegrados_bodega: [
            {
              id_kit_lote: 40,
              id_inventario: 201,
              cantidad_retirada: 4,
              saldo_restante_kit: 3,
              saldo_resultante_bodega: 14
            }
          ],
          bajas_vencimiento: [
            {
              id_kit_lote: 39,
              id_inventario: 200,
              cantidad_baja: 2,
              fecha_vencimiento: '2026-01-12'
            }
          ]
        })
      );

      assertZeroInventoryPatchRequests();
      expect(generalSpy).toHaveBeenCalledTimes(1);
      expect(vetSpy).toHaveBeenCalledWith(9);

      flushInventoryGetRequests(
        [
          { id_inventario: 201, id_detalle_compra: 100, id_medicamento: 5, cantidad_actual: 14, estado: 'Disponible' },
          { id_inventario: 202, id_detalle_compra: 100, id_medicamento: 5, cantidad_actual: 10, estado: 'Disponible' }
        ],
        {
          items: [{ id_medicamento: 5, nombre: 'Amoxicilina', cantidad_actual: 3 }]
        }
      );

      expect(comp.modalAsignarAbierto).toBe(false);
      expect(comp.filas.find((i: any) => i.idMed === 5)?.stock).toBe(24);
      const swalArg = swalSpy.mock.calls[0][0] as any;
      expect(swalArg.icon).toBe('success');
      expect(swalArg.html).toContain('4');
      expect(swalArg.html).toContain('2');
      expect(swalArg.html).not.toContain('Stock resultante');

      fixture.destroy();
      httpMock.verify();
    });

    it('todas las unidades vencidas en Jurídico: 0 unidades regresan a bodega y 0 PATCH emitidos', () => {
      const fixture = TestBed.createComponent(InventarioJuridicoComponent);
      const comp = fixture.componentInstance;

      comp.veterinarios = [{ id_usuario: 9, nombre: 'Dr. Carlos' }];
      comp.idVeterinarioSeleccionado = 9;
      comp.idVeterinarioAsignar = 9;
      comp.loteSeleccionado = {
        idMed: 5,
        nombre: 'Amoxicilina',
        stock: 20,
        idInvs: [201],
        refInv: { id_inventario: 201, estado: 'Disponible' }
      };
      comp.tipoOperacionAsignar = 'RETIRO';
      comp.cantidadAAsignar = 4;
      comp.modalAsignarAbierto = true;

      comp.confirmarAsignacion();

      const postReq = httpMock.expectOne(
        (req) => req.method === 'POST' && req.url.includes('/api/inventario/kit/retiro-directo/')
      );
      postReq.flush(
        construirRespuestaRetiroBackend({
          id_medicamento: 5,
          nombre_medicamento: 'Amoxicilina',
          cantidad_total_retirada: 4,
          unidades_reintegradas: 0,
          unidades_baja_vencimiento: 4,
          lotes_reintegrados_bodega: [],
          bajas_vencimiento: [
            {
              id_kit_lote: 41,
              id_inventario: 205,
              cantidad_baja: 4,
              fecha_vencimiento: '2026-01-01'
            }
          ]
        })
      );

      assertZeroInventoryPatchRequests();

      flushInventoryGetRequests(
        [{ id_inventario: 201, id_detalle_compra: 100, id_medicamento: 5, cantidad_actual: 20, estado: 'Disponible' }],
        { items: [] }
      );

      expect(comp.filas.find((i: any) => i.idMed === 5)?.stock).toBe(20);
      const swalArg = swalSpy.mock.calls[0][0] as any;
      expect(swalArg.html).toContain('0');
      expect(swalArg.html).toContain('4');

      fixture.destroy();
      httpMock.verify();
    });

    it('error HTTP 400 en Jurídico detiene el flujo sin recarga ni éxito falso', () => {
      const fixture = TestBed.createComponent(InventarioJuridicoComponent);
      const comp = fixture.componentInstance;

      comp.veterinarios = [{ id_usuario: 9, nombre: 'Dr. Carlos' }];
      comp.idVeterinarioAsignar = 9;
      comp.loteSeleccionado = {
        idMed: 5,
        nombre: 'Amoxicilina',
        stock: 20,
        idInvs: [201],
        refInv: { id_inventario: 201, estado: 'Disponible' }
      };
      comp.tipoOperacionAsignar = 'RETIRO';
      comp.cantidadAAsignar = 10;
      comp.modalAsignarAbierto = true;

      comp.confirmarAsignacion();

      const postReq = httpMock.expectOne(
        (req) => req.method === 'POST' && req.url.includes('/api/inventario/kit/retiro-directo/')
      );
      postReq.flush(
        { detalle: 'Stock insuficiente en kit.' },
        { status: 400, statusText: 'Bad Request' }
      );

      expect(comp.modalAsignarAbierto).toBe(true);
      expect(comp.guardandoAsignacion).toBe(false);
      expect(comp.errorAsignacion).toBe('Stock insuficiente en kit.');
      expect(swalSpy).not.toHaveBeenCalled();

      assertZeroInventoryPatchRequests();
      fixture.destroy();
      httpMock.verify();
    });

    it('resultado incierto (status 0) en Jurídico informa y recupera estado real por GET sin localStorage ni reintento POST', () => {
      const fixture = TestBed.createComponent(InventarioJuridicoComponent);
      const comp = fixture.componentInstance;
      const generalSpy = vi.spyOn(comp, 'cargarInventarioGeneral');
      const vetSpy = vi.spyOn(comp, 'cargarInventarioDeVeterinario');

      comp.veterinarios = [{ id_usuario: 9, nombre: 'Dr. Carlos' }];
      comp.idVeterinarioSeleccionado = 9;
      comp.idVeterinarioAsignar = 9;
      comp.loteSeleccionado = {
        idMed: 5,
        nombre: 'Amoxicilina',
        stock: 20,
        idInvs: [201],
        refInv: { id_inventario: 201, estado: 'Disponible' }
      };
      comp.tipoOperacionAsignar = 'RETIRO';
      comp.cantidadAAsignar = 4;
      comp.modalAsignarAbierto = true;

      comp.confirmarAsignacion();

      const postReq = httpMock.expectOne(
        (req) => req.method === 'POST' && req.url.includes('/api/inventario/kit/retiro-directo/')
      );
      postReq.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      expect(comp.guardandoAsignacion).toBe(false);
      expect(comp.modalAsignarAbierto).toBe(false);
      expect(generalSpy).toHaveBeenCalledTimes(1);
      expect(vetSpy).toHaveBeenCalledWith(9);
      expect(localStorage.getItem('vetericano_lotes_asignados_vet_9')).toBeNull();
      expect(
        httpMock.match((req) => req.method === 'POST' && req.url.includes('/api/inventario/kit/retiro-directo/'))
      ).toHaveLength(0);

      flushInventoryGetRequests(
        [{ id_inventario: 201, id_detalle_compra: 100, id_medicamento: 5, cantidad_actual: 24, estado: 'Disponible' }],
        { items: [{ id_medicamento: 5, nombre: 'Amoxicilina', cantidad_actual: 1 }] }
      );

      expect(comp.filas.find((i: any) => i.idMed === 5)?.stock).toBe(24);
      expect(swalSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: 'warning',
          title: 'No se pudo confirmar el retiro',
          text: 'No se recibió confirmación definitiva del servidor. El retiro pudo haberse aplicado. Revisa el inventario actualizado antes de intentar nuevamente la operación.'
        })
      );

      assertZeroInventoryPatchRequests();
      fixture.destroy();
      httpMock.verify();
    });

    it('escapa etiquetas HTML en nombreProd y nombreVet dentro del modal Swal.fire en Jurídico', () => {
      const fixture = TestBed.createComponent(InventarioJuridicoComponent);
      const comp = fixture.componentInstance;

      comp.veterinarios = [{ id_usuario: 9, nombre: '<b>Dr. Malicioso</b>' }];
      comp.idVeterinarioSeleccionado = 9;
      comp.idVeterinarioAsignar = 9;
      comp.loteSeleccionado = {
        idMed: 5,
        nombre: '<svg onload=alert(1)>',
        stock: 20,
        idInvs: [201],
        refInv: { id_inventario: 201, estado: 'Disponible' }
      };
      comp.tipoOperacionAsignar = 'RETIRO';
      comp.cantidadAAsignar = 3;
      comp.modalAsignarAbierto = true;

      comp.confirmarAsignacion();

      const postReq = httpMock.expectOne(
        (req) => req.method === 'POST' && req.url.includes('/api/inventario/kit/retiro-directo/')
      );
      postReq.flush(
        construirRespuestaRetiroBackend({
          id_medicamento: 5,
          nombre_medicamento: '<svg onload=alert(1)>',
          cantidad_total_retirada: 3,
          unidades_reintegradas: 3,
          unidades_baja_vencimiento: 0,
          lotes_reintegrados_bodega: [
            {
              id_kit_lote: 42,
              id_inventario: 201,
              cantidad_retirada: 3,
              saldo_restante_kit: 5,
              saldo_resultante_bodega: 23
            }
          ]
        })
      );

      flushInventoryGetRequests(
        [{ id_inventario: 201, id_detalle_compra: 100, id_medicamento: 5, cantidad_actual: 23, estado: 'Disponible' }],
        { items: [{ id_medicamento: 5, nombre: '<svg onload=alert(1)>', cantidad_actual: 5 }] }
      );

      const swalArg = swalSpy.mock.calls[0][0] as any;
      expect(swalArg.html).not.toContain('<svg');
      expect(swalArg.html).not.toContain('<b>');
      expect(swalArg.html).toContain('&lt;svg onload=alert(1)&gt;');
      expect(swalArg.html).toContain('&lt;b&gt;Dr. Malicioso&lt;/b&gt;');

      fixture.destroy();
      httpMock.verify();
    });
  });
});
