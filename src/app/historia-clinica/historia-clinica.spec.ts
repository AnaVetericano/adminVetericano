import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, vi } from 'vitest';
import Swal from 'sweetalert2';

import { HistoriaClinica2Component } from './historia-clinica';
import { VeterinaryInventoryService, ResultadoConsumoKit } from '../services/veterinary-inventory.service';
import { HistoriaClinicaService } from '../services/historia-clinica.service';

describe('HistoriaClinica2Component', () => {
  let component: HistoriaClinica2Component;
  let fixture: ComponentFixture<HistoriaClinica2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoriaClinica2Component],
      providers: [
        provideHttpClient(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HistoriaClinica2Component);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('HistoriaClinica2Component · resultado explícito del consumo del kit', () => {
  let component: HistoriaClinica2Component;
  let vetInv: VeterinaryInventoryService;
  let historiaSvc: HistoriaClinicaService;
  let swalSpy: ReturnType<typeof vi.spyOn>;
  let verificarSpy: ReturnType<typeof vi.spyOn>;

  const resultado = (estado: ResultadoConsumoKit['estado'], mensaje: string, httpStatus: number | null = 403): ResultadoConsumoKit => ({
    estado, mensaje, clientUuid: 'uuid-1', idMedicamento: 7, unidades: 2, nombreMedicamento: 'Amoxicilina', httpStatus
  });

  const medicamento = () => ({
    id: 7, id_medicamento: 7, nombre: 'Amoxicilina', cantidadAAdministrar: 2, stockDisponible: 10,
    administrado: false, cantidadEfectivaAdministrada: 0, administrando: false
  });

  const textosSwal = (): string[] =>
    swalSpy.mock.calls.map((c: any[]) => JSON.stringify(c[0] ?? ''));

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HistoriaClinica2Component],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    swalSpy = vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true } as any);
    const fixture = TestBed.createComponent(HistoriaClinica2Component);
    component = fixture.componentInstance;
    vetInv = TestBed.inject(VeterinaryInventoryService);
    historiaSvc = TestBed.inject(HistoriaClinicaService);
    vi.spyOn(component, 'recargarStockMedicamentos').mockImplementation(() => {});
    // Consulta existente (edición) confirmada por el backend: es el origen clínico del consumo
    component.esNuevaConsulta = false;
    component.idHistoria = 5 as any;
    component.historiaOriginal = { id_historia: 5, id_consulta: 9, id_animal: 3 } as any;
    verificarSpy = vi.spyOn(historiaSvc, 'verificarConsultaDeHistoria').mockReturnValue(of(9));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('tarjeta con consulta confirmada: envía id_consulta de esa consulta como origen del consumo', async () => {
    const consumoSpy = vi.spyOn(vetInv, 'registrarConsumo').mockReturnValue(of(resultado('CONFIRMADO', 'ok', 200)));
    const med: any = medicamento();

    component.registrarAdministracion(med, 0);
    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(2));

    expect(verificarSpy).toHaveBeenCalledWith(9, 5);
    expect(consumoSpy).toHaveBeenCalledTimes(1);
    expect(consumoSpy.mock.calls[0][4]).toEqual({ id_consulta: 9 });
    expect(med.administrado).toBe(true);
  });

  it('tarjeta en consulta nueva (sin guardar): no envía consumo y explica la falta de vínculo', async () => {
    const consumoSpy = vi.spyOn(vetInv, 'registrarConsumo');
    component.esNuevaConsulta = true;
    const med: any = medicamento();

    component.registrarAdministracion(med, 0);
    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(2));

    // El id de historiaOriginal sería el de una consulta ANTERIOR: no se usa ni se verifica
    expect(verificarSpy).not.toHaveBeenCalled();
    expect(consumoSpy).not.toHaveBeenCalled();
    const alerta = swalSpy.mock.calls[1][0] as any;
    expect(alerta.icon).toBe('error');
    expect(alerta.text).toContain('no tiene una consulta a la cual vincularse');
    expect(med.administrado).toBe(false);
    expect(textosSwal().some(t => t.includes('Descuento registrado'))).toBe(false);
  });

  it('tarjeta con consulta no confirmada por el backend: no envía consumo', async () => {
    const consumoSpy = vi.spyOn(vetInv, 'registrarConsumo');
    verificarSpy.mockReturnValue(of(null));
    const med: any = medicamento();

    component.registrarAdministracion(med, 0);
    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(2));

    expect(consumoSpy).not.toHaveBeenCalled();
    expect((swalSpy.mock.calls[1][0] as any).text).toContain('No se pudo confirmar con el servidor la consulta');
    expect(med.administrado).toBe(false);
  });

  it('guardar consulta nueva: la historia se guarda y se advierte que el descuento no tuvo vínculo (sin consumo)', async () => {
    const consumoSpy = vi.spyOn(vetInv, 'registrarConsumo');
    const actualizarSpy = vi.spyOn(historiaSvc, 'actualizarHistoria').mockReturnValue(of({ success: true, mensaje: 'ok', historia_id: 5, consulta_id: 10 } as any));
    // Tras guardar una consulta nueva el componente navega al detalle: el router de pruebas no tiene rutas
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    component.esNuevaConsulta = true;
    const med: any = medicamento();
    component.medicamentosSeleccionados = [med];

    component.guardarEdicion();
    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(1));

    expect(consumoSpy).not.toHaveBeenCalled();
    expect(actualizarSpy).toHaveBeenCalledTimes(1);
    expect((actualizarSpy.mock.calls[0][1] as any).tratamientos[0].administrado).toBe(false);
    const alerta = swalSpy.mock.calls[0][0] as any;
    expect(alerta.icon).toBe('warning');
    expect(alerta.text).toContain('Historia clínica guardada correctamente, pero el medicamento no fue descontado del kit.');
    expect(alerta.text).toContain('no tiene una consulta a la cual vincularse');
    expect(textosSwal().some(t => t.includes('Descuento registrado') || t.includes('Descuento automático'))).toBe(false);
  });

  it('guardar edición: un solo GET de verificación y cada consumo lleva el id_consulta confirmado', async () => {
    const consumoSpy = vi.spyOn(vetInv, 'registrarConsumo').mockReturnValue(of(resultado('CONFIRMADO', 'ok', 200)));
    vi.spyOn(historiaSvc, 'actualizarHistoria').mockReturnValue(of({ success: true, mensaje: 'ok', historia_id: 5, consulta_id: 9 } as any));
    component.medicamentosSeleccionados = [medicamento(), { ...medicamento(), id: 8, id_medicamento: 8, nombre: 'Meloxicam' }];

    component.guardarEdicion();
    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(1));

    expect(verificarSpy).toHaveBeenCalledTimes(1);
    expect(consumoSpy).toHaveBeenCalledTimes(2);
    consumoSpy.mock.calls.forEach((args: any[]) => expect(args[4]).toEqual({ id_consulta: 9 }));
    expect((swalSpy.mock.calls[0][0] as any).icon).toBe('success');
  });

  it('tarjeta: RECHAZADO (403) muestra el mensaje real y no marca administrado ni "Descuento registrado"', async () => {
    vi.spyOn(vetInv, 'registrarConsumo').mockReturnValue(of(resultado('RECHAZADO', 'Se requieren permisos de veterinario activo para realizar esta acción.')));
    const med: any = medicamento();

    component.registrarAdministracion(med, 0);
    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(2));

    const alerta = swalSpy.mock.calls[1][0] as any;
    expect(alerta.icon).toBe('error');
    expect(alerta.text).toBe('Se requieren permisos de veterinario activo para realizar esta acción.');
    expect(alerta.html).toBeUndefined();
    expect(med.administrado).toBe(false);
    expect(med.stockDisponible).toBe(10);
    expect(textosSwal().some(t => t.includes('Descuento registrado'))).toBe(false);
  });

  it('tarjeta: PENDIENTE (sin conexión) muestra advertencia, nunca éxito', async () => {
    vi.spyOn(vetInv, 'registrarConsumo').mockReturnValue(of(resultado('PENDIENTE', 'Sin conexión con el servidor. Pendiente de sincronizar.', 0)));
    const med: any = medicamento();

    component.registrarAdministracion(med, 0);
    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(2));

    const alerta = swalSpy.mock.calls[1][0] as any;
    expect(alerta.icon).toBe('warning');
    expect(alerta.title).toContain('pendiente de sincronizar');
    // Nunca se marca como descontado (badge "Descontado") ni se fija stock/cantidad antes de CONFIRMADO
    expect(med.administrado).toBe(false);
    expect(med.cantidadEfectivaAdministrada).toBe(0);
    expect(med.stockDisponible).toBe(10);
    expect(med.descuentoKitPendiente).toBe(true);
    expect(textosSwal().some(t => t.includes('Descuento registrado'))).toBe(false);
  });

  it('tras un PENDIENTE no hay reenvío: ni al volver a pulsar ni al guardar (sin client_uuid nuevo)', async () => {
    const consumoSpy = vi.spyOn(vetInv, 'registrarConsumo').mockReturnValue(of(resultado('PENDIENTE', 'Sin conexión', 0)));
    const actualizarSpy = prepararGuardado({ success: true, mensaje: 'ok', historia_id: 5, consulta_id: 9 });
    const med: any = medicamento();
    component.medicamentosSeleccionados = [med];

    component.registrarAdministracion(med, 0);
    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(2));
    component.registrarAdministracion(med, 0);
    expect((swalSpy.mock.calls[2][0] as any).title).toBe('Descuento pendiente de sincronizar');

    component.guardarEdicion();
    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(4));

    expect(consumoSpy).toHaveBeenCalledTimes(1);
    expect(actualizarSpy).toHaveBeenCalledTimes(1);
    expect((actualizarSpy.mock.calls[0][1] as any).tratamientos[0].administrado).toBe(false);
    const alerta = swalSpy.mock.calls[3][0] as any;
    expect(alerta.icon).toBe('warning');
    expect(alerta.text).toContain('pendiente de sincronizar');
    expect(textosSwal().some(t => t.includes('Descuento registrado') || t.includes('Descuento automático'))).toBe(false);
  });

  it('tras un RECHAZADO en la tarjeta, guardar no reenvía el consumo y advierte con el motivo real', async () => {
    const consumoSpy = vi.spyOn(vetInv, 'registrarConsumo').mockReturnValue(
      of(resultado('RECHAZADO', 'Stock insuficiente en el kit de Amoxicilina', 409))
    );
    const actualizarSpy = prepararGuardado({ success: true, mensaje: 'ok', historia_id: 5, consulta_id: 9 });
    const med: any = medicamento();
    component.medicamentosSeleccionados = [med];

    component.registrarAdministracion(med, 0);
    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(2));
    expect((swalSpy.mock.calls[1][0] as any).icon).toBe('error');

    component.guardarEdicion();
    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(3));

    // Un único intento (el de la tarjeta): el guardado no genera otro consumo con un client_uuid nuevo
    expect(consumoSpy).toHaveBeenCalledTimes(1);
    expect(actualizarSpy).toHaveBeenCalledTimes(1);
    expect((actualizarSpy.mock.calls[0][1] as any).tratamientos[0].administrado).toBe(false);
    expect(med.administrado).toBe(false);
    const alerta = swalSpy.mock.calls[2][0] as any;
    expect(alerta.icon).toBe('warning');
    expect(alerta.text).toContain('Historia clínica guardada correctamente, pero el medicamento no fue descontado del kit.');
    expect(alerta.text).toContain('Stock insuficiente en el kit de Amoxicilina');
    expect(textosSwal().some(t => t.includes('Descuento registrado') || t.includes('Descuento automático'))).toBe(false);
  });

  it('tarjeta: CONFIRMADO es el único caso que muestra "Descuento registrado"', async () => {
    vi.spyOn(vetInv, 'registrarConsumo').mockReturnValue(of(resultado('CONFIRMADO', 'ok', 200)));
    const med: any = medicamento();

    component.registrarAdministracion(med, 0);
    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(2));

    expect((swalSpy.mock.calls[1][0] as any).title).toBe('Descuento registrado');
    expect(med.administrado).toBe(true);
    expect(med.stockDisponible).toBe(8);
  });

  function prepararGuardado(respuestaGuardado: any) {
    component.idHistoria = 5 as any;
    component.historiaOriginal = { id_historia: 5, id_consulta: 9, id_animal: 3 } as any;
    const actualizarSpy = vi.spyOn(historiaSvc, 'actualizarHistoria').mockReturnValue(of(respuestaGuardado));
    return actualizarSpy;
  }

  it('guardado: historia guardada pero consumo RECHAZADO → advertencia y tratamiento sin administrado', async () => {
    const consumoSpy = vi.spyOn(vetInv, 'registrarConsumo').mockReturnValue(of(resultado('RECHAZADO', 'Stock insuficiente en el kit de Amoxicilina: disponible 1, solicitado 2', 409)));
    const actualizarSpy = prepararGuardado({ success: true, mensaje: 'ok', historia_id: 5, consulta_id: 9 });
    const med: any = medicamento();
    component.medicamentosSeleccionados = [med];

    component.guardarEdicion();
    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(1));

    expect(consumoSpy).toHaveBeenCalledTimes(1);
    expect(actualizarSpy).toHaveBeenCalledTimes(1);
    const dto: any = actualizarSpy.mock.calls[0][1];
    expect(dto.tratamientos[0].administrado).toBe(false);
    expect(med.administrado).toBe(false);

    const alerta = swalSpy.mock.calls[0][0] as any;
    expect(alerta.icon).toBe('warning');
    expect(alerta.text).toContain('Historia clínica guardada correctamente, pero el medicamento no fue descontado del kit. Revisa las alertas de farmacia.');
    expect(alerta.text).toContain('Stock insuficiente en el kit de Amoxicilina');
    expect(textosSwal().some(t => t.includes('Descuento registrado') || t.includes('Descuento automático'))).toBe(false);
  });

  it('guardado: consumo PENDIENTE → advertencia "pendiente de sincronizar", sin mensaje de descuento', async () => {
    vi.spyOn(vetInv, 'registrarConsumo').mockReturnValue(of(resultado('PENDIENTE', 'Sin conexión', 0)));
    const actualizarSpy = prepararGuardado({ success: true, mensaje: 'ok', historia_id: 5, consulta_id: 9 });
    const med: any = medicamento();
    component.medicamentosSeleccionados = [med];

    component.guardarEdicion();
    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(1));

    expect(actualizarSpy).toHaveBeenCalledTimes(1);
    expect((actualizarSpy.mock.calls[0][1] as any).tratamientos[0].administrado).toBe(false);
    expect(med.administrado).toBe(false);
    expect(med.descuentoKitPendiente).toBe(true);
    const alerta = swalSpy.mock.calls[0][0] as any;
    expect(alerta.icon).toBe('warning');
    expect(alerta.text).toContain('pendiente de sincronizar');
    expect(textosSwal().some(t => t.includes('Descuento registrado') || t.includes('Descuento automático'))).toBe(false);
  });

  it('guardado: respuesta clínica 200 con alertas_farmacia.conflictos_stock → advertencia aunque el consumo se haya confirmado', async () => {
    vi.spyOn(vetInv, 'registrarConsumo').mockReturnValue(of(resultado('CONFIRMADO', 'ok', 200)));
    prepararGuardado({
      success: true, mensaje: 'ok', historia_id: 5, consulta_id: 9,
      alertas_farmacia: { conflictos_stock: [{ id_medicamento: 8, nombre_medicamento: 'Meloxicam', motivo_rechazo: 'Stock insuficiente en el kit de Meloxicam' }] }
    });
    component.medicamentosSeleccionados = [medicamento()];

    component.guardarEdicion();
    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(1));

    const alerta = swalSpy.mock.calls[0][0] as any;
    expect(alerta.icon).toBe('warning');
    expect(alerta.text).toContain('pero el medicamento no fue descontado del kit');
    expect(alerta.text).toContain('Meloxicam');
  });

  it('guardado: todo CONFIRMADO y sin alertas → éxito con descuento automático', async () => {
    vi.spyOn(vetInv, 'registrarConsumo').mockReturnValue(of(resultado('CONFIRMADO', 'ok', 200)));
    prepararGuardado({ success: true, mensaje: 'ok', historia_id: 5, consulta_id: 9 });
    component.medicamentosSeleccionados = [medicamento()];

    component.guardarEdicion();
    await vi.waitFor(() => expect(swalSpy).toHaveBeenCalledTimes(1));

    const alerta = swalSpy.mock.calls[0][0] as any;
    expect(alerta.icon).toBe('success');
    expect(alerta.html).toContain('Descuento automático de maletín');
  });
});

describe('HistoriaClinica2Component · hospitalización CBA y plan sanitario', () => {
  let fixture: ComponentFixture<HistoriaClinica2Component>;
  let component: HistoriaClinica2Component;
  let historiaSvc: HistoriaClinicaService;
  let swalSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HistoriaClinica2Component],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    swalSpy = vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true } as any);
    fixture = TestBed.createComponent(HistoriaClinica2Component);
    component = fixture.componentInstance;
    historiaSvc = TestBed.inject(HistoriaClinicaService);
    vi.spyOn(component, 'cargarHistoria').mockImplementation(() => {
      component.idHistoria = 11;
      component.historiaOriginal = { id_historia: 11, id_consulta: 22, id_animal: 33 } as any;
      component.cargando = false;
    });
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('muestra hojaHospitalizacionNumero, seguimientosHospitalarios y controles de nota cuando ingresaCBA es SI', () => {
    component.pestanaPrincipal = 'atencion';
    component.ingresaCBA = 'SI';
    component.ingresa_cba = true;
    component.hojaHospitalizacionNumero = 3;
    component.seguimientosHospitalarios = [
      { id_seguimiento_hosp: 1, evolucion: 'Paciente come con buen apetito', fecha: '2026-11-19T10:00:00Z' }
    ];
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    expect(host.textContent).toContain('Hoja Hospitalización N°');
    expect(host.textContent).toContain('Bitácora de Seguimiento Hospitalario CBA');
    expect(host.textContent).toContain('Paciente come con buen apetito');

    const inputHoja = host.querySelector('input[type="number"][min="1"]') as HTMLInputElement | null;
    expect(inputHoja).toBeTruthy();

    const botonAgregar = Array.from(host.querySelectorAll('button')).find(
      b => b.textContent?.includes('Agregar Nota Hospitalaria')
    );
    expect(botonAgregar).toBeTruthy();
  });

  it('permite agregar una nota de seguimiento hospitalario y actualiza la bitácora', async () => {
    const registrarSpy = vi.spyOn(historiaSvc, 'registrarSeguimientoHospitalario').mockReturnValue(
      of({ id_seguimiento_hosp: 99, id_hospitalizacion: 4, evolucion: 'Turno noche: signos estables', fecha: '2026-11-19T22:00:00Z' })
    );
    vi.spyOn(historiaSvc, 'obtenerHospitalizacionYSeguimientos').mockReturnValue(
      of({
        hospitalizacion: { id_hospitalizacion: 4, hoja_numero: 2 },
        seguimientos: [{ id_seguimiento_hosp: 99, id_hospitalizacion: 4, evolucion: 'Turno noche: signos estables', fecha: '2026-11-19T22:00:00Z' }]
      })
    );

    component.ingresaCBA = 'SI';
    component.hojaHospitalizacionNumero = 2;
    component.nuevaNotaHospitalaria = 'Turno noche: signos estables';
    component.agregarNotaSeguimientoHospitalario();
    fixture.detectChanges();

    expect(registrarSpy).toHaveBeenCalledTimes(1);
    expect(registrarSpy.mock.calls[0][0]).toBe(22);
    expect(registrarSpy.mock.calls[0][1]).toBe('Turno noche: signos estables');
    expect(component.nuevaNotaHospitalaria).toBe('');
    expect(component.seguimientosHospitalarios.length).toBe(1);
    expect(component.seguimientosHospitalarios[0].evolucion).toBe('Turno noche: signos estables');
    expect(swalSpy).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success' }));
  });

  it('maneja error al agregar nota hospitalaria sin limpiar la nota ni mostrar éxito', () => {
    vi.spyOn(historiaSvc, 'registrarSeguimientoHospitalario').mockReturnValue(
      throwError(() => ({ status: 500, error: { detail: 'Error en seguimiento hospitalario' } }))
    );

    component.nuevaNotaHospitalaria = 'Nota con fallo de red';
    component.agregarNotaSeguimientoHospitalario();

    expect(component.guardandoNotaHospitalaria).toBe(false);
    expect(component.nuevaNotaHospitalaria).toBe('Nota con fallo de red');
    expect(component.seguimientosHospitalarios.length).toBe(0);
    expect(swalSpy.mock.calls.some((c: any[]) => c[0]?.icon === 'success')).toBe(false);
    expect(swalSpy).toHaveBeenCalledWith(expect.objectContaining({ icon: 'error' }));
  });

  it('fallo en autocreación de hospitalización: propaga error HTTP, no crea nota ficticia, conserva texto y no muestra éxito', () => {
    const httpMock = TestBed.inject(HttpTestingController);
    component.hospitalizacionActiva = null;
    component.nuevaNotaHospitalaria = 'Paciente en monitoreo nocturno';
    component.agregarNotaSeguimientoHospitalario();

    httpMock.expectOne(req => req.method === 'GET' && req.url.includes('/hospitalizaciones/?id_consulta=22')).flush([]);
    httpMock.expectOne(req => req.method === 'POST' && req.url.includes('/hospitalizaciones/'))
      .flush({ detail: 'No se pudo crear hospitalización' }, { status: 500, statusText: 'Server Error' });
    httpMock.expectNone(req => req.method === 'POST' && req.url.includes('/seguimientos-hospitalarios/'));

    expect(component.guardandoNotaHospitalaria).toBe(false);
    expect(component.nuevaNotaHospitalaria).toBe('Paciente en monitoreo nocturno');
    expect(component.seguimientosHospitalarios.length).toBe(0);
    expect(swalSpy.mock.calls.some((c: any[]) => c[0]?.icon === 'success')).toBe(false);
    expect(swalSpy).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error',
      text: expect.stringContaining('No se pudo crear hospitalización')
    }));
  });

  it('fallo en POST de seguimiento tras hospitalización existente: propaga error, conserva nota y no muestra éxito', () => {
    const httpMock = TestBed.inject(HttpTestingController);
    component.hospitalizacionActiva = { id_hospitalizacion: 7, hoja_numero: 1 };
    component.nuevaNotaHospitalaria = 'Control de hidratación';
    component.agregarNotaSeguimientoHospitalario();

    httpMock.expectOne(req => req.method === 'POST' && req.url.includes('/seguimientos-hospitalarios/'))
      .flush({ detail: 'Error persistiendo seguimiento' }, { status: 500, statusText: 'Server Error' });

    expect(component.guardandoNotaHospitalaria).toBe(false);
    expect(component.nuevaNotaHospitalaria).toBe('Control de hidratación');
    expect(component.seguimientosHospitalarios.length).toBe(0);
    expect(swalSpy.mock.calls.some((c: any[]) => c[0]?.icon === 'success')).toBe(false);
    expect(swalSpy).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error',
      text: expect.stringContaining('Error persistiendo seguimiento')
    }));
  });

  it('no inserta nota ficticia ni muestra éxito si el backend no devuelve id_seguimiento_hosp confirmado', () => {
    vi.spyOn(historiaSvc, 'registrarSeguimientoHospitalario').mockReturnValue(of(null));

    component.nuevaNotaHospitalaria = 'Nota sin confirmación';
    component.agregarNotaSeguimientoHospitalario();

    expect(component.guardandoNotaHospitalaria).toBe(false);
    expect(component.nuevaNotaHospitalaria).toBe('Nota sin confirmación');
    expect(component.seguimientosHospitalarios.length).toBe(0);
    expect(swalSpy.mock.calls.some((c: any[]) => c[0]?.icon === 'success')).toBe(false);
    expect(swalSpy).toHaveBeenCalledWith(expect.objectContaining({ icon: 'error' }));
  });

  it('conserva y envía planSanitario.ultimoCelo, planSanitario.fechaUltimoParto y hojaHospitalizacionNumero al guardar', async () => {
    component.pestanaPrincipal = 'plan_sanitario';
    component.ingresaCBA = 'SI';
    component.hojaHospitalizacionNumero = 4;
    component.planSanitario.ultimoCelo = '2026-09-15';
    component.planSanitario.fechaUltimoParto = '2026-03-10';
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    expect(host.textContent).toContain('Fecha de Último Celo');
    expect(host.textContent).toContain('Fecha de Último Parto');

    const actualizarSpy = vi.spyOn(historiaSvc, 'actualizarHistoria').mockReturnValue(
      of({ success: true, mensaje: 'ok', historia_id: 11, consulta_id: 22 } as any)
    );
    component.medicamentosSeleccionados = [];
    component.guardarEdicion();
    await vi.waitFor(() => expect(actualizarSpy).toHaveBeenCalledTimes(1));

    const dto: any = actualizarSpy.mock.calls[0][1];
    expect(dto.anamnesicos.ultimoCelo).toBe('2026-09-15');
    expect(dto.anamnesicos.fechaUltimoParto).toBe('2026-03-10');
    expect(dto.organos_sistemas._ultimo_celo).toBe('2026-09-15');
    expect(dto.organos_sistemas._fecha_ultimo_parto).toBe('2026-03-10');
    expect(dto.organos_sistemas._hoja_hospitalizacion_numero).toBe(4);
    expect(dto.ingreso_cba.hoja_numero).toBe(4);
  });
});
