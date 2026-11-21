import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Swal from 'sweetalert2';

import { ComprasService } from './compras.service';
import { AuthService } from './auth';
import { Compra } from '../compra/compra';
import { Inventario } from '../inventario/inventario';

describe('ComprasService & flujo seguro de bodega/compras', () => {
  let service: ComprasService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Compra, Inventario],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });

    service = TestBed.inject(ComprasService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try {
      httpMock.verify();
    } finally {
      vi.restoreAllMocks();
      TestBed.resetTestingModule();
    }
  });

  it('registrarCompraCompleta envía POST /compras/ con fecha_vencimiento sin llamar PATCH ni POST /inventarios/', () => {
    let resultado: any;
    let errorRecibido: any;

    service.registrarCompraCompleta(
      3,
      [{ id_medicamento: 7, cantidad: 10, fecha_vencimiento: '2027-06-30' }],
      [{ id_medicamento: 7, nombre: 'Amoxicilina' }]
    ).subscribe({
      next: (res) => (resultado = res),
      error: (err) => (errorRecibido = err)
    });

    const catReq = httpMock.expectOne((r) => r.url.includes('/medicamentos-catalogo/'));
    expect(catReq.request.method).toBe('GET');
    catReq.flush([{ id_medicamento: 7, nombre: 'Amoxicilina' }]);

    const postReq = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/inventario/compras/'));
    expect(postReq.request.body).toEqual({
      id_proveedor: 3,
      detalles: [{ id_medicamento: 7, cantidad: 10, fecha_vencimiento: '2027-06-30' }]
    });
    postReq.flush({
      id_compra: 55,
      id_proveedor: 3,
      detalles: [{ id_detalle_compra: 101, id_compra: 55, id_medicamento: 7, cantidad: 10 }]
    });

    // No deben dispararse llamadas secundarias a /inventarios/
    httpMock.expectNone((r) => r.url.includes('/inventarios/'));

    expect(errorRecibido).toBeUndefined();
    expect(resultado.compra.id_compra).toBe(55);
    expect(resultado.detalles.length).toBe(1);
    expect(resultado.detalles[0].fecha_vencimiento).toBe('2027-06-30');
  });

  it('registrarCompraCompleta propaga errores del servidor en lugar de silenciarlos', () => {
    let errorRecibido: any;

    service.registrarCompraCompleta(
      3,
      [{ id_medicamento: 7, cantidad: 10 }],
      [{ id_medicamento: 7, nombre: 'Amoxicilina' }]
    ).subscribe({
      error: (err) => (errorRecibido = err)
    });

    const catReq = httpMock.expectOne((r) => r.url.includes('/medicamentos-catalogo/'));
    catReq.flush([{ id_medicamento: 7, nombre: 'Amoxicilina' }]);

    const postReq = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/inventario/compras/'));
    postReq.flush({ detalles: 'El medicamento está inactivo.' }, { status: 400, statusText: 'Bad Request' });

    expect(errorRecibido).toBeTruthy();
    expect(errorRecibido.status).toBe(400);
  });

  it('actualizarCompraCompleta, anularCompra y descontarStockMedicamento rechazan sin peticiones HTTP inseguras', () => {
    let errAct: any;
    let errAnular: any;
    let errDesc: any;

    service.actualizarCompraCompleta(1, 2, [], []).subscribe({ error: (e) => (errAct = e) });
    service.anularCompra(1, 'Motivo').subscribe({ error: (e) => (errAnular = e) });
    service.descontarStockMedicamento(7, 2).subscribe({ error: (e) => (errDesc = e) });

    httpMock.expectNone(() => true);
    expect(errAct).toBeInstanceOf(Error);
    expect(errAnular).toBeInstanceOf(Error);
    expect(errDesc).toBeInstanceOf(Error);
  });

  it('Compra bloquea doble envío mientras guardando=true y ante status 500 consulta la lista sin reintentar POST', () => {
    const swalSpy = vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true } as any);

    const fixture = TestBed.createComponent(Compra);
    const comp = fixture.componentInstance;
    comp.idProveedorSeleccionado = 3;
    comp.medicamentos = [{ id_medicamento: 7, nombre: 'Amoxicilina' }];
    comp.filasDetalle = [{
      id_medicamento: 7,
      cantidad: 5,
      precio_unitario: 1000,
      subtotal: 5000,
      fecha_vencimiento: '2027-05-01'
    }];

    comp.guardarCompra();
    expect(comp.guardando).toBe(true);

    // Segundo clic / envío mientras está en curso no debe disparar otra petición
    comp.guardarCompra();

    const catReq = httpMock.expectOne((r) => r.url.includes('/medicamentos-catalogo/'));
    catReq.flush([{ id_medicamento: 7, nombre: 'Amoxicilina' }]);

    const postReqs = httpMock.match((r) => r.method === 'POST' && r.url.endsWith('/inventario/compras/'));
    expect(postReqs.length).toBe(1);
    postReqs[0].flush({ detail: 'Timeout' }, { status: 500, statusText: 'Server Error' });

    expect(comp.guardando).toBe(false);
    expect(swalSpy).toHaveBeenCalled();

    // Ante error incierto >=500 llama obtenerDatos() para refrescar compras/inventarios/detalles/proveedores/meds
    const refrescos = httpMock.match((r) => r.method === 'GET');
    expect(refrescos.length).toBeGreaterThan(0);
    refrescos.forEach((req) => req.flush([]));
  });

  it('Inventario al asignar stock no envía PATCH id_medicamento previo ni PATCH cantidad_actual en fallback', () => {
    vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true } as any);

    const fixture = TestBed.createComponent(Inventario);
    const comp = fixture.componentInstance;
    comp.loteSeleccionado = {
      idInv: 42,
      idInvs: [42],
      idMed: 7,
      nombre: 'Amoxicilina',
      stock: 10
    };
    comp.idVeterinarioSeleccionado = 15;
    comp.cantidadAAsignar = 3;
    comp.motivoAsignacion = 'Reposición';
    comp.veterinarios = [{ id_usuario: 15, nombre: 'Dra. Ana' }];

    comp.confirmarAsignacion();

    // No debe emitir ningún PATCH /inventarios/
    httpMock.expectNone((r) => r.method === 'PATCH' && r.url.includes('/inventarios/'));

    const asigReq = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/inventario/kit/asignar/'));
    asigReq.flush(
      { error: 'ERROR_DOMINIO', detalle: 'Fallo controlado en servidor' },
      { status: 400, statusText: 'Bad Request' }
    );

    // Tampoco tras error debe hacer fallback PATCH cantidad_actual
    httpMock.expectNone((r) => r.method === 'PATCH' && r.url.includes('/inventarios/'));
    expect(comp.guardandoAsignacion).toBe(false);
    expect(comp.errorAsignacion).toContain('Fallo controlado');
  });

  it('obtenerMapaStockMedicamentos evita HTTP 403 en /inventarios/ y /detalles-compra/ cuando el rol es Veterinario', () => {
    const authService = TestBed.inject(AuthService);
    vi.spyOn(authService, 'isAdmin').mockReturnValue(false);
    vi.spyOn(authService, 'isJuridico').mockReturnValue(false);
    vi.spyOn(authService, 'isSuperAdmin').mockReturnValue(false);
    vi.spyOn(authService, 'isVeterinario').mockReturnValue(true);

    let mapaResultado: any;
    service.obtenerMapaStockMedicamentos().subscribe((res) => (mapaResultado = res));

    httpMock.expectNone((r) => r.url.includes('/inventario/inventarios/') || r.url.includes('/inventario/detalles-compra/'));
    const medsReq = httpMock.expectOne((r) => r.url.endsWith('/medicamentos/'));
    const cataReq = httpMock.expectOne((r) => r.url.includes('/medicamentos-catalogo/'));
    medsReq.flush([]);
    cataReq.flush([]);

    expect(mapaResultado).toBeTruthy();
    expect(mapaResultado.porId.size).toBe(0);
  });
});
