import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, vi } from 'vitest';
import Swal from 'sweetalert2';

import { ActaSeresSintientes } from './acta-seres-sintientes';
import { VeterinaryInventoryService, ResultadoConsumoKit } from '../services/veterinary-inventory.service';
import { HistoriaClinicaService } from '../services/historia-clinica.service';

describe('ActaSeresSintientes', () => {
  let component: ActaSeresSintientes;
  let fixture: ComponentFixture<ActaSeresSintientes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActaSeresSintientes],
      providers: [
        provideHttpClient(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ActaSeresSintientes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('ActaSeresSintientes · resultado explícito del consumo del kit', () => {
  let component: ActaSeresSintientes;
  let vetInv: VeterinaryInventoryService;
  let httpMock: HttpTestingController;
  let swalSpy: ReturnType<typeof vi.spyOn>;

  const resultado = (estado: ResultadoConsumoKit['estado'], mensaje: string, httpStatus: number | null = 409): ResultadoConsumoKit => ({
    estado, mensaje, clientUuid: 'uuid-1', idMedicamento: 7, unidades: 1, nombreMedicamento: 'Amoxicilina', httpStatus
  });

  const medicamento = () => ({
    id: 7, id_medicamento: 7, nombre: 'Amoxicilina', cantidadAAdministrar: 1, stockDisponible: 5,
    administrado: false, cantidadEfectivaAdministrada: 0, administrando: false
  });

  const textosSwal = (): string[] =>
    swalSpy.mock.calls.map((c: any[]) => JSON.stringify(c[0] ?? ''));

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ActaSeresSintientes],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    swalSpy = vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true } as any);
    const fixture = TestBed.createComponent(ActaSeresSintientes);
    component = fixture.componentInstance;
    vetInv = TestBed.inject(VeterinaryInventoryService);
    httpMock = TestBed.inject(HttpTestingController);
    vi.spyOn(component, 'recargarStockMedicamentos').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('tarjeta: RECHAZADO (409) muestra el motivo real, no marca administrado y no anuncia descuento', async () => {
    vi.spyOn(vetInv, 'registrarConsumo').mockReturnValue(of(resultado('RECHAZADO', 'Stock insuficiente en el kit de Amoxicilina: disponible 0, solicitado 1')));
    const med: any = medicamento();

    component.registrarAdministracion(med, 0);
    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(2));

    const alerta = swalSpy.mock.calls[1][0] as any;
    expect(alerta.icon).toBe('error');
    expect(alerta.text).toBe('Stock insuficiente en el kit de Amoxicilina: disponible 0, solicitado 1');
    expect(med.administrado).toBe(false);
    expect(textosSwal().some(t => t.includes('Descuento registrado') || t.includes('Administración registrada'))).toBe(false);
  });

  it('tarjeta con seguimiento registrado: envía id_seguimiento_visita como origen; sin seguimiento no hay origen', async () => {
    const consumoSpy = vi.spyOn(vetInv, 'registrarConsumo').mockReturnValue(of(resultado('CONFIRMADO', 'ok', 200)));
    component.seguimientoSeleccionado = { id_seguimiento: 31, id_animal: 3, nombre_paciente: 'Firulais' };
    component.registrarAdministracion(medicamento(), 0);
    await vi.waitFor(() => expect(consumoSpy).toHaveBeenCalledTimes(1));
    expect(consumoSpy.mock.calls[0][4]).toEqual({ id_seguimiento_visita: 31 });

    // Animal nuevo (acta sin seguimiento guardado): origen null → el servicio no envía nada
    component.seguimientoSeleccionado = { esNuevoAnimal: true, id_seguimiento: null, nombre_paciente: 'Nuevo' };
    component.registrarAdministracion(medicamento(), 0);
    await vi.waitFor(() => expect(consumoSpy).toHaveBeenCalledTimes(2));
    expect(consumoSpy.mock.calls[1][4]).toBeNull();
  });

  it('tarjeta: PENDIENTE muestra advertencia "pendiente de sincronizar", nunca éxito', async () => {
    vi.spyOn(vetInv, 'registrarConsumo').mockReturnValue(of(resultado('PENDIENTE', 'Sin conexión', 0)));
    const med: any = medicamento();

    component.registrarAdministracion(med, 0);
    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(2));

    const alerta = swalSpy.mock.calls[1][0] as any;
    expect(alerta.icon).toBe('warning');
    expect(alerta.title).toContain('pendiente de sincronizar');
    expect(med.administrado).toBe(false);
    expect(med.cantidadEfectivaAdministrada).toBe(0);
    expect(med.descuentoKitPendiente).toBe(true);
    expect(textosSwal().some(t => t.includes('Descuento registrado') || t.includes('Administración registrada'))).toBe(false);
  });

  it('guardado de acta tras un PENDIENTE de tarjeta: no reenvía el consumo y advierte', async () => {
    const consumoSpy = vi.spyOn(vetInv, 'registrarConsumo');
    const med: any = { ...medicamento(), descuentoKitPendiente: true, cantidadPendienteKit: 1 };
    component.medicamentosSeleccionados = [med];
    component.seguimientoSeleccionado = { id_animal: 3, nombre_paciente: 'Firulais' };

    (component as any).procesarConsultaAsociada(10, { numero_historia: 'HC-3' }, new HttpHeaders());
    httpMock.expectOne(r => r.method === 'POST' && /consultas\/?$/.test(r.url)).flush({ id_consulta: 99 });

    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(1));
    expect(consumoSpy).not.toHaveBeenCalled();
    const alerta = swalSpy.mock.calls[0][0] as any;
    expect(alerta.icon).toBe('warning');
    expect(alerta.text).toContain('pendiente de sincronizar');
    expect(med.administrado).toBe(false);
  });

  it('nuevo paciente con un PENDIENTE de tarjeta: no pide además descuento de bodega', async () => {
    const historiaSvc = TestBed.inject(HistoriaClinicaService);
    const crearSpy = vi.spyOn(historiaSvc, 'crearExpedienteCompleto').mockReturnValue(of({ status: 'success', id_animal: 3, numero_historia: 'HC-3' }));
    component.medicamentosSeleccionados = [{ ...medicamento(), descuentoKitPendiente: true, cantidadPendienteKit: 1 }];
    component.seguimientoSeleccionado = { esNuevoAnimal: true, nombre_paciente: 'Firulais', paciente_especie: 'Canino' };

    (component as any).registrarExpedienteClinicoParaNuevo('Firulais', '', [], [], 12, new HttpHeaders());

    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(1));
    const payload: any = crearSpy.mock.calls[0][0];
    expect(payload.hoja2.tratamientos[0].descontar_inventario).toBe(false);
    expect((swalSpy.mock.calls[0][0] as any).icon).toBe('warning');
  });

  it('nuevo paciente con un RECHAZADO de tarjeta: no se convierte en descuento de bodega y se advierte', async () => {
    const historiaSvc = TestBed.inject(HistoriaClinicaService);
    const crearSpy = vi.spyOn(historiaSvc, 'crearExpedienteCompleto').mockReturnValue(of({ status: 'success', id_animal: 3, numero_historia: 'HC-3' }));
    const rechazo = resultado('RECHAZADO', 'Stock insuficiente en el kit de Amoxicilina', 409);
    component.medicamentosSeleccionados = [{ ...medicamento(), resultadoKitRechazado: rechazo }];
    component.seguimientoSeleccionado = { esNuevoAnimal: true, nombre_paciente: 'Firulais', paciente_especie: 'Canino' };

    (component as any).registrarExpedienteClinicoParaNuevo('Firulais', '', [], [], 12, new HttpHeaders());

    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(1));
    const payload: any = crearSpy.mock.calls[0][0];
    // Antes de la corrección cualquier intento en la tarjeta dejaba descontar_inventario=false; se conserva
    expect(payload.hoja2.tratamientos[0].descontar_inventario).toBe(false);
    const alerta = swalSpy.mock.calls[0][0] as any;
    expect(alerta.icon).toBe('warning');
    expect(alerta.text).toContain('no fue descontado del kit');
    expect(alerta.text).toContain('Stock insuficiente en el kit de Amoxicilina');
    expect(textosSwal().some(t => t.includes('Descuento registrado'))).toBe(false);
  });

  it('guardado de acta tras un RECHAZADO de tarjeta: no reenvía el consumo y advierte', async () => {
    const consumoSpy = vi.spyOn(vetInv, 'registrarConsumo');
    const rechazo = resultado('RECHAZADO', 'Stock insuficiente en el kit de Amoxicilina', 409);
    const med: any = { ...medicamento(), resultadoKitRechazado: rechazo };
    component.medicamentosSeleccionados = [med];
    component.seguimientoSeleccionado = { id_animal: 3, nombre_paciente: 'Firulais' };

    (component as any).procesarConsultaAsociada(10, { numero_historia: 'HC-3' }, new HttpHeaders());
    httpMock.expectOne(r => r.method === 'POST' && /consultas\/?$/.test(r.url)).flush({ id_consulta: 99 });

    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(1));
    expect(consumoSpy).not.toHaveBeenCalled();
    const alerta = swalSpy.mock.calls[0][0] as any;
    expect(alerta.icon).toBe('warning');
    expect(alerta.text).toContain('Stock insuficiente en el kit de Amoxicilina');
    expect(med.administrado).toBe(false);
  });

  it('guardado de acta: consulta guardada pero consumo RECHAZADO → advertencia que diferencia ambos resultados', async () => {
    const consumoSpy = vi.spyOn(vetInv, 'registrarConsumo').mockReturnValue(of(resultado('RECHAZADO', 'Se requieren permisos de veterinario activo para realizar esta acción.', 403)));
    const med: any = medicamento();
    component.medicamentosSeleccionados = [med];
    component.seguimientoSeleccionado = { id_animal: 3, nombre_paciente: 'Firulais' };

    (component as any).procesarConsultaAsociada(10, { numero_historia: 'HC-3' }, new HttpHeaders());
    const reqConsulta = httpMock.expectOne(r => r.method === 'POST' && /consultas\/?$/.test(r.url));
    reqConsulta.flush({ id_consulta: 99 });

    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(1));
    expect(consumoSpy).toHaveBeenCalledTimes(1);
    // Origen clínico: la consulta que el backend acaba de crear para el acta (respConsulta.id_consulta)
    expect(consumoSpy.mock.calls[0][4]).toEqual({ id_consulta: 99 });
    const alerta = swalSpy.mock.calls[0][0] as any;
    expect(alerta.icon).toBe('warning');
    expect(alerta.title).toBe('Acta guardada con advertencias');
    expect(alerta.text).toContain('Acta guardada correctamente, pero el medicamento no fue descontado del kit. Revisa las alertas de farmacia.');
    expect(alerta.text).toContain('Se requieren permisos de veterinario activo');
    expect(alerta.html).toBeUndefined();
    expect(med.administrado).toBe(false);
    expect(textosSwal().some(t => t.includes('Descuento registrado'))).toBe(false);
  });

  it('guardado de acta: consulta guardada y consumo CONFIRMADO → éxito', async () => {
    vi.spyOn(vetInv, 'registrarConsumo').mockReturnValue(of(resultado('CONFIRMADO', 'ok', 200)));
    const med: any = medicamento();
    component.medicamentosSeleccionados = [med];
    component.seguimientoSeleccionado = { id_animal: 3, nombre_paciente: 'Firulais' };

    (component as any).procesarConsultaAsociada(10, { numero_historia: 'HC-3' }, new HttpHeaders());
    httpMock.expectOne(r => r.method === 'POST' && /consultas\/?$/.test(r.url)).flush({ id_consulta: 99 });

    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(1));
    expect((swalSpy.mock.calls[0][0] as any).icon).toBe('success');
    expect(med.administrado).toBe(true);
  });

  it('nuevo paciente: expediente 201 con alertas_farmacia → acta guardada sin descuento (advertencia)', async () => {
    const historiaSvc = TestBed.inject(HistoriaClinicaService);
    vi.spyOn(historiaSvc, 'crearExpedienteCompleto').mockReturnValue(of({
      status: 'success', id_animal: 3, numero_historia: 'HC-3',
      alertas_farmacia: { conflictos_stock: [{ id_medicamento: 7, nombre_medicamento: 'Amoxicilina', motivo_rechazo: 'Stock insuficiente en el kit de Amoxicilina' }] }
    }));
    component.seguimientoSeleccionado = { esNuevoAnimal: true, nombre_paciente: 'Firulais', paciente_especie: 'Canino' };

    (component as any).registrarExpedienteClinicoParaNuevo('Firulais', '', [], [], 12, new HttpHeaders());

    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(1));
    const alerta = swalSpy.mock.calls[0][0] as any;
    expect(alerta.icon).toBe('warning');
    expect(alerta.text).toContain('Acta guardada correctamente, pero el medicamento no fue descontado del kit.');
    expect(alerta.text).toContain('Stock insuficiente en el kit de Amoxicilina');
  });
});
