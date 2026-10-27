import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Proveedor {
  id_proveedor: number;
  nombre: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  activo?: boolean;
}

export interface MedicamentoItem {
  id?: number;
  id_medicamento?: number;
  nombre: string;
  descripcion?: string;
  cantidad_ml?: string | number;
  tipo?: string;
  via_administracion?: string;
  via?: string;
  activo?: boolean;
  estado?: boolean;
  presentacion?: string;
  concentracion?: string;
  principio_activo?: string;
  id_salida?: number;
}

export interface Compra {
  id_compra?: number;
  id_proveedor: number;
  fecha?: string;
  // Propiedades calculadas para la interfaz
  proveedor?: Proveedor;
  detalles?: DetalleCompraConMedicamento[];
  total?: number;
  totalItems?: number;
  totalUnidades?: number;
}

export interface DetalleCompra {
  id_detalle_compra?: number;
  id_compra: number;
  id_medicamento: number;
  cantidad: number;
  precio_unitario: number | string;
}

export interface DetalleCompraConMedicamento extends DetalleCompra {
  medicamento?: MedicamentoItem;
  subtotal?: number;
}

export interface DetalleRegistroFila {
  id_detalle_compra?: number | null;
  id_medicamento: number | null;
  cantidad: number | null;
  precio_unitario: number | null;
  subtotal?: number;
}

export interface ResultadoRegistroCompra {
  compra: Compra;
  detalles: DetalleCompra[];
}

@Injectable({
  providedIn: 'root'
})
export class ComprasService {
  constructor(private http: HttpClient) {}

  private get baseUrlInventario(): string {
    const envInventario = (environment as any).apiUrlInventario;
    if (envInventario) {
      return envInventario.endsWith('/') ? envInventario : `${envInventario}/`;
    }
    const urlBase = environment.apiUrl.endsWith('/') ? environment.apiUrl.slice(0, -1) : environment.apiUrl;
    const clean = urlBase.replace(/\/usuarios$/, '');
    return `${clean}/inventario/`;
  }

  /**
   * Endpoint de la tabla medicamentos_medicamento (/api/medicamentos/)
   */
  private get baseUrlMedicamentos(): string {
    const envMedicamentos = environment.apiUrlMedicamentos;
    if (envMedicamentos) {
      return envMedicamentos.endsWith('/') ? envMedicamentos : `${envMedicamentos}/`;
    }
    const urlBase = environment.apiUrl.endsWith('/') ? environment.apiUrl.slice(0, -1) : environment.apiUrl;
    const clean = urlBase.replace(/\/usuarios$/, '');
    return `${clean}/medicamentos/`;
  }

  /**
   * Catálogo de inventario para compatibilidad de FK (/api/medicamentos-catalogo/)
   */
  private get baseUrlMedicamentosCatalogo(): string {
    const envCatalogo = (environment as any).apiUrlMedicamentosCatalogo;
    if (envCatalogo) {
      return envCatalogo.endsWith('/') ? envCatalogo : `${envCatalogo}/`;
    }
    const urlBase = environment.apiUrl.endsWith('/') ? environment.apiUrl.slice(0, -1) : environment.apiUrl;
    const clean = urlBase.replace(/\/usuarios$/, '');
    return `${clean}/medicamentos-catalogo/`;
  }

  // --- Endpoints de Compras ---

  listarCompras(): Observable<Compra[]> {
    return this.http.get<any>(`${this.baseUrlInventario}compras/`).pipe(
      map(res => Array.isArray(res) ? res : (res.results || []))
    );
  }

  obtenerCompra(id: number): Observable<Compra> {
    return this.http.get<Compra>(`${this.baseUrlInventario}compras/${id}/`);
  }

  crearCompra(payload: {
    id_proveedor: number;
    detalles?: Array<{ id_medicamento: number; cantidad: number; precio_unitario?: number }>;
  }): Observable<Compra> {
    return this.http.post<Compra>(`${this.baseUrlInventario}compras/`, payload);
  }

  actualizarCompra(id: number, payload: { id_proveedor: number }): Observable<Compra> {
    return this.http.patch<Compra>(`${this.baseUrlInventario}compras/${id}/`, payload);
  }

  eliminarCompra(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrlInventario}compras/${id}/`);
  }

  // --- Endpoints de Detalles de Compra ---

  listarDetallesCompra(): Observable<DetalleCompra[]> {
    return this.http.get<any>(`${this.baseUrlInventario}detalles-compra/`).pipe(
      map(res => Array.isArray(res) ? res : (res.results || []))
    );
  }

  crearDetalleCompra(payload: {
    id_compra: number;
    id_medicamento: number;
    cantidad: number;
    precio_unitario: number;
  }): Observable<DetalleCompra> {
    return this.http.post<DetalleCompra>(`${this.baseUrlInventario}detalles-compra/`, payload);
  }

  actualizarDetalleCompra(
    id: number,
    payload: {
      id_compra?: number;
      id_medicamento?: number;
      cantidad?: number;
      precio_unitario?: number;
    }
  ): Observable<DetalleCompra> {
    return this.http.patch<DetalleCompra>(`${this.baseUrlInventario}detalles-compra/${id}/`, payload);
  }

  eliminarDetalleCompra(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrlInventario}detalles-compra/${id}/`);
  }

  // --- Endpoints de Inventarios (desvinculación segura de FK) ---

  listarInventarios(): Observable<any[]> {
    return this.http.get<any>(`${this.baseUrlInventario}inventarios/`).pipe(
      map(res => Array.isArray(res) ? res : (res.results || [])),
      catchError(() => of([]))
    );
  }

  desvincularDetalleInventario(idInventario: number): Observable<any> {
    return this.http.patch<any>(`${this.baseUrlInventario}inventarios/${idInventario}/`, {
      id_detalle_compra: null
    }).pipe(
      catchError(() => of(null))
    );
  }

  desvincularYLimpiarDetalles(detallesIds: number[]): Observable<any> {
    if (!detallesIds || detallesIds.length === 0) {
      return of([]);
    }

    return this.listarInventarios().pipe(
      switchMap((inventarios: any[]) => {
        const inventariosAfectados = inventarios.filter(inv =>
          inv.id_detalle_compra && detallesIds.includes(Number(inv.id_detalle_compra))
        );

        const desvinculaciones = inventariosAfectados.map(inv =>
          this.desvincularDetalleInventario(inv.id_inventario)
        );

        const obsDesvinculacion = desvinculaciones.length > 0 ? forkJoin(desvinculaciones) : of([]);

        return obsDesvinculacion.pipe(
          switchMap(() => {
            const eliminaciones = detallesIds.map(id =>
              this.eliminarDetalleCompra(id).pipe(catchError(() => of(null)))
            );
            return forkJoin(eliminaciones);
          })
        );
      })
    );
  }

  // --- Datos de Apoyo (Proveedores y Medicamentos) ---

  listarProveedores(): Observable<Proveedor[]> {
    return this.http.get<any>(`${this.baseUrlInventario}proveedores/`).pipe(
      map(res => Array.isArray(res) ? res : (res.results || []))
    );
  }

  /**
   * Carga los medicamentos directamente desde la tabla medicamentos_medicamento (/api/medicamentos/)
   */
  listarMedicamentos(): Observable<MedicamentoItem[]> {
    return this.http.get<any>(this.baseUrlMedicamentos).pipe(
      map(res => {
        const raw = Array.isArray(res) ? res : (res.results || []);
        return raw.map((item: any) => ({
          ...item,
          id: item.id ?? item.id_medicamento,
          id_medicamento: item.id ?? item.id_medicamento,
          activo: item.activo !== undefined ? item.activo : (item.estado !== undefined ? item.estado : true)
        }));
      })
    );
  }

  listarMedicamentosCatalogo(): Observable<any[]> {
    return this.http.get<any>(this.baseUrlMedicamentosCatalogo).pipe(
      map(res => Array.isArray(res) ? res : (res.results || [])),
      catchError(() => of([]))
    );
  }

  crearMedicamentoCatalogo(payload: any): Observable<any> {
    return this.http.post<any>(this.baseUrlMedicamentosCatalogo, payload);
  }

  /**
   * Asegura que el medicamento seleccionado de medicamentos_medicamento tenga
   * un ID válido para la llave foránea de DetalleCompra (tabla medicamentos).
   */
  asegurarIdMedicamentoParaDetalle(
    idMedSeleccionado: number,
    listaMedicamentos: MedicamentoItem[],
    catalogoExistente: any[]
  ): Observable<number> {
    // 1. Buscar primero en la lista de medicamentos_medicamento por su ID
    const medSeleccionado = listaMedicamentos.find(m =>
      Number(m.id ?? m.id_medicamento) === Number(idMedSeleccionado)
    );

    if (medSeleccionado && medSeleccionado.nombre) {
      // 2. Buscar si ya existe por nombre en el catálogo de medicamentos (tabla medicamentos)
      const porNombre = catalogoExistente.find(c =>
        c.nombre &&
        c.nombre.toLowerCase().trim() === medSeleccionado.nombre.toLowerCase().trim()
      );
      if (porNombre) {
        return of(Number(porNombre.id_medicamento ?? porNombre.id));
      }

      // 3. Si no existe por nombre en el catálogo, registrarlo para satisfacer la FK de DetalleCompra
      const nuevoCatalogoPayload = {
        nombre: medSeleccionado.nombre.trim(),
        tipo: medSeleccionado.tipo || 'General',
        cantidad_ml: medSeleccionado.cantidad_ml ? String(medSeleccionado.cantidad_ml) : 'N/A',
        activo: true
      };

      return this.crearMedicamentoCatalogo(nuevoCatalogoPayload).pipe(
        map(creado => Number(creado.id_medicamento ?? creado.id)),
        catchError(() => of(idMedSeleccionado))
      );
    }

    // 4. Si no se encontró en listaMedicamentos (o ya era un ID del catálogo), verificar si coincide directamente en catálogo
    const porId = catalogoExistente.find(c => Number(c.id_medicamento ?? c.id) === Number(idMedSeleccionado));
    if (porId) {
      return of(Number(porId.id_medicamento ?? porId.id));
    }

    return of(idMedSeleccionado);
  }

  // --- Transacción compuesta: Registrar Compra y sus Detalles ---

  registrarCompraCompleta(
    id_proveedor: number,
    detalles: Array<{ id_medicamento: number; cantidad: number; precio_unitario?: number }>,
    listaMedicamentos: MedicamentoItem[] = []
  ): Observable<ResultadoRegistroCompra> {
    const obsMedicamentos = (listaMedicamentos && listaMedicamentos.length > 0)
      ? of(listaMedicamentos)
      : this.listarMedicamentos().pipe(catchError(() => of([])));

    return forkJoin({
      catalogo: this.listarMedicamentosCatalogo(),
      medicamentos: obsMedicamentos
    }).pipe(
      switchMap(({ catalogo, medicamentos }) => {
        // Asegurar que cada id_medicamento exista en la tabla medicamentos (catálogo) para la FK
        const resoluciones = detalles.map(d =>
          this.asegurarIdMedicamentoParaDetalle(d.id_medicamento, medicamentos, catalogo).pipe(
            map(idValido => ({
              id_medicamento: idValido,
              cantidad: Number(d.cantidad)
            }))
          )
        );

        const obsDetallesValidos = resoluciones.length > 0 ? forkJoin(resoluciones) : of([]);

        return obsDetallesValidos.pipe(
          switchMap(detallesAsegurados => {
            const payloadBackend = {
              id_proveedor: Number(id_proveedor),
              detalles: detallesAsegurados.map(d => ({
                id_medicamento: Number(d.id_medicamento),
                cantidad: Number(d.cantidad)
              }))
            };

            // Enviamos la compra con sus detalles directamente al endpoint nativo del backend (/api/inventario/compras/)
            // El backend crea la Compra, DetalleCompra e Inventarios (lote con cantidad_actual) de forma atómica
            return this.crearCompra(payloadBackend).pipe(
              map((compraCreada: any) => {
                const idCompra = Number(compraCreada.id_compra ?? compraCreada.id);
                const detallesRetornados = (compraCreada.detalles && compraCreada.detalles.length > 0)
                  ? compraCreada.detalles
                  : detallesAsegurados.map((d, idx) => ({
                      id_detalle_compra: idx + 1,
                      id_compra: idCompra,
                      id_medicamento: d.id_medicamento,
                      cantidad: d.cantidad,
                      precio_unitario: 0
                    }));

                return {
                  compra: { ...compraCreada, id_compra: idCompra },
                  detalles: detallesRetornados
                };
              })
            );
          })
        );
      })
    );
  }

  // --- Transacción compuesta: Actualizar Compra y sincronizar sus Detalles ---

  actualizarCompraCompleta(
    idCompra: number,
    idProveedor: number,
    detallesNuevos: DetalleRegistroFila[],
    detallesOriginalesIds: number[],
    listaMedicamentos: MedicamentoItem[] = []
  ): Observable<any> {
    const obsMedicamentos = (listaMedicamentos && listaMedicamentos.length > 0)
      ? of(listaMedicamentos)
      : this.listarMedicamentos().pipe(catchError(() => of([])));

    return forkJoin({
      catalogo: this.listarMedicamentosCatalogo(),
      medicamentos: obsMedicamentos
    }).pipe(
      switchMap(({ catalogo, medicamentos }) => {
        const resoluciones = detallesNuevos.map(f =>
          this.asegurarIdMedicamentoParaDetalle(Number(f.id_medicamento), medicamentos, catalogo).pipe(
            map(idValido => ({
              ...f,
              id_medicamento: idValido
            }))
          )
        );

        const obsFilasAseguradas = resoluciones.length > 0 ? forkJoin(resoluciones) : of([]);

        return obsFilasAseguradas.pipe(
          switchMap(filasAseguradas => {
            return this.actualizarCompra(idCompra, { id_proveedor: Number(idProveedor) }).pipe(
              switchMap((compraActualizada: Compra) => {
                const idsAEliminar = detallesOriginalesIds.filter(
                  idOriginal => !filasAseguradas.some(f => f.id_detalle_compra === idOriginal)
                );

                const filasAActualizar = filasAseguradas.filter(f => f.id_detalle_compra);
                const filasACrear = filasAseguradas.filter(f => !f.id_detalle_compra);

                const obsEliminar = idsAEliminar.length > 0
                  ? this.desvincularYLimpiarDetalles(idsAEliminar)
                  : of([]);

                return obsEliminar.pipe(
                  switchMap(() => {
                    const obsActualizar = filasAActualizar.map(f =>
                      this.actualizarDetalleCompra(Number(f.id_detalle_compra), {
                        id_compra: idCompra,
                        id_medicamento: Number(f.id_medicamento),
                        cantidad: Number(f.cantidad),
                        precio_unitario: Number(f.precio_unitario)
                      })
                    );

                    const obsCrear = filasACrear.map(f =>
                      this.crearDetalleCompra({
                        id_compra: idCompra,
                        id_medicamento: Number(f.id_medicamento),
                        cantidad: Number(f.cantidad),
                        precio_unitario: Number(f.precio_unitario)
                      })
                    );

                    const todasLasPeticiones = [...obsActualizar, ...obsCrear];

                    if (todasLasPeticiones.length === 0) {
                      return of({ compra: compraActualizada, detalles: [] });
                    }

                    return forkJoin(todasLasPeticiones).pipe(
                      map(detallesSincronizados => ({
                        compra: compraActualizada,
                        detalles: detallesSincronizados
                      })),
                      switchMap((resultado: any) =>
                        this.sincronizarInventariosParaDetalles(resultado.detalles).pipe(
                          map(() => resultado),
                          catchError(() => of(resultado))
                        )
                      )
                    );
                  })
                );
              })
            );
          })
        );
      })
    );
  }

  crearInventario(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrlInventario}inventarios/`, payload).pipe(
      catchError(() => of(null))
    );
  }

  actualizarInventario(idInventario: number, payload: any): Observable<any> {
    return this.http.patch<any>(`${this.baseUrlInventario}inventarios/${idInventario}/`, payload).pipe(
      catchError(() => of(null))
    );
  }

  eliminarInventario(idInventario: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrlInventario}inventarios/${idInventario}/`).pipe(
      catchError(() => of(null))
    );
  }

  private payloadEntrada(detalle: any): any {
    // Campos reales tabla inventarios: id_detalle_compra, cantidad_actual, fecha_vencimiento, estado
    const cantidad = Number(detalle?.cantidad) || 0;
    return {
      id_detalle_compra: Number(detalle?.id_detalle_compra ?? detalle?.id),
      cantidad_actual: cantidad,
      estado: 'Disponible'
    };
  }

  private crearEntradaConFallback(detalle: any): Observable<any> {
    const base = this.payloadEntrada(detalle);
    if (!base.id_detalle_compra) return of(null);
    return this.crearInventario(base).pipe(
      switchMap((creado) => {
        if (creado) return of(creado);
        return this.crearInventario({ id_detalle_compra: base.id_detalle_compra, cantidad_actual: base.cantidad_actual });
      }),
      catchError(() => of(null))
    );
  }

  asegurarInventarioParaDetalle(detalle: any): Observable<any> {
    const idDet = Number(detalle?.id_detalle_compra ?? detalle?.id);
    if (!idDet) return of(null);
    return this.listarInventarios().pipe(
      switchMap((invs: any[]) => {
        const existente = (invs || []).find((inv: any) =>
          Number(inv.id_detalle_compra) === idDet
        );
        if (existente) {
          const idInv = Number(existente.id_inventario ?? existente.id);
          const cantidad = Number(detalle?.cantidad) || 0;
          return this.actualizarInventario(idInv, { cantidad_actual: cantidad });
        }
        return this.crearEntradaConFallback(detalle);
      }),
      catchError(() => of(null))
    );
  }

  sincronizarInventariosParaDetalles(detalles: any[]): Observable<any> {
    if (!detalles || detalles.length === 0) return of([]);
    const peticiones = detalles
      .filter((d: any) => d && (d.id_detalle_compra ?? d.id))
      .map((d: any) => this.asegurarInventarioParaDetalle(d));
    if (peticiones.length === 0) return of([]);
    return forkJoin(peticiones).pipe(catchError(() => of([])));
  }

  // --- Eliminación Segura: Desvincula inventarios y elimina compra y detalles ---

  eliminarCompraConDetalles(idCompra: number, detallesIds: number[]): Observable<any> {
    return this.desvincularYLimpiarDetalles(detallesIds).pipe(
      switchMap(() => this.eliminarCompra(idCompra))
    );
  }

  // --- Consulta y Descuento Real de Stock para Administración de Medicamentos ---

  /**
   * Obtiene un mapa con el stock actual real de cada medicamento identificado por su ID.
   * Utiliza las existencias reales de la tabla Inventarios (cantidad_actual).
   */
  obtenerMapaStockMedicamentos(): Observable<{ porId: Map<number, number>; porNombre: Map<string, number> }> {
    return forkJoin({
      invs: this.listarInventarios(),
      dets: this.listarDetallesCompra(),
      meds: this.listarMedicamentos().pipe(catchError(() => of([]))),
      cata: this.listarMedicamentosCatalogo().pipe(catchError(() => of([])))
    }).pipe(
      map(({ invs, dets, meds, cata }) => {
        const mapaId = new Map<number, number>();
        const mapaNombre = new Map<string, number>();

        // Indexar medicamentos por ID y nombre
        const nombresPorId = new Map<number, string>();
        (cata || []).forEach((c: any) => {
          const id = Number(c.id_medicamento ?? c.id);
          if (!isNaN(id) && c.nombre) {
            nombresPorId.set(id, c.nombre.trim().toLowerCase());
          }
        });
        (meds || []).forEach((m: any) => {
          const id = Number(m.id ?? m.id_medicamento);
          if (!isNaN(id) && m.nombre && !nombresPorId.has(id)) {
            nombresPorId.set(id, m.nombre.trim().toLowerCase());
          }
        });

        // Indexar detalles de compra por su id_detalle_compra
        const medIdPorDetalle = new Map<number, number>();
        (dets || []).forEach((d: any) => {
          const idDet = Number(d.id_detalle_compra ?? d.id);
          const idMed = Number(d.id_medicamento);
          if (!isNaN(idDet) && !isNaN(idMed)) {
            medIdPorDetalle.set(idDet, idMed);
          }
        });

        // Sumar existencias de los lotes de inventario (evitando duplicar lotes)
        const lotesVistos = new Set<number>();
        (invs || []).forEach((inv: any) => {
          const idInv = Number(inv.id_inventario ?? inv.id);
          if (isNaN(idInv) || lotesVistos.has(idInv)) return;
          lotesVistos.add(idInv);

          const cantActual = Number(inv.cantidad_actual);
          if (isNaN(cantActual) || cantActual < 0) return;

          const idDet = Number(inv.id_detalle_compra);
          const idMed = medIdPorDetalle.get(idDet) ?? (inv.id_medicamento ? Number(inv.id_medicamento) : null);

          if (idMed !== null && !isNaN(idMed)) {
            mapaId.set(idMed, (mapaId.get(idMed) || 0) + cantActual);
            const nombre = nombresPorId.get(idMed);
            if (nombre) {
              mapaNombre.set(nombre, (mapaNombre.get(nombre) || 0) + cantActual);
            }
          }
        });

        return { porId: mapaId, porNombre: mapaNombre };
      }),
      catchError(() => of({ porId: new Map<number, number>(), porNombre: new Map<string, number>() }))
    );
  }

  /**
   * Obtiene los lotes de inventario reales con stock disponible para un medicamento específico.
   */
  obtenerLotesDisponiblesParaMedicamento(idMedicamento: number, nombreMedicamento?: string): Observable<any[]> {
    return forkJoin({
      invs: this.listarInventarios(),
      dets: this.listarDetallesCompra(),
      cata: this.listarMedicamentosCatalogo().pipe(catchError(() => of([]))),
      meds: this.listarMedicamentos().pipe(catchError(() => of([])))
    }).pipe(
      map(({ invs, dets, cata, meds }) => {
        const idTarget = Number(idMedicamento);
        const nombreTarget = (nombreMedicamento || '').trim().toLowerCase();

        // Encontrar IDs de detalles de compra asociados a este medicamento
        const idsDetallesValidos = new Set<number>();

        (dets || []).forEach((d: any) => {
          const idDet = Number(d.id_detalle_compra ?? d.id);
          const idMedDet = Number(d.id_medicamento);

          let coincide = (!isNaN(idTarget) && idMedDet === idTarget);

          // Si hay nombre, verificar si coincide en catálogo
          if (!coincide && nombreTarget) {
            const medEnCata = (cata || []).find((c: any) => Number(c.id_medicamento ?? c.id) === idMedDet);
            if (medEnCata && (medEnCata.nombre || '').trim().toLowerCase() === nombreTarget) {
              coincide = true;
            }
            const medEnMeds = (meds || []).find((m: any) => Number(m.id ?? m.id_medicamento) === idMedDet);
            if (medEnMeds && (medEnMeds.nombre || '').trim().toLowerCase() === nombreTarget) {
              coincide = true;
            }
          }

          if (coincide && !isNaN(idDet)) {
            idsDetallesValidos.add(idDet);
          }
        });

        // Filtrar lotes de inventario con stock disponible
        const lotesValidos: any[] = [];
        const lotesVistos = new Set<number>();

        (invs || []).forEach((inv: any) => {
          const idInv = Number(inv.id_inventario ?? inv.id);
          if (isNaN(idInv) || lotesVistos.has(idInv)) return;

          const idDet = Number(inv.id_detalle_compra);
          const cantActual = Number(inv.cantidad_actual);

          const esDeEsteMed = idsDetallesValidos.has(idDet) ||
            (!isNaN(idTarget) && Number(inv.id_medicamento) === idTarget);

          if (esDeEsteMed && !isNaN(cantActual) && cantActual > 0) {
            lotesVistos.add(idInv);
            lotesValidos.push({
              ...inv,
              id_inventario: idInv,
              cantidad_actual: cantActual
            });
          }
        });

        // Ordenar por fecha de vencimiento más próxima (FIFO) si existe, o por id_inventario
        lotesValidos.sort((a, b) => {
          if (a.fecha_vencimiento && b.fecha_vencimiento) {
            return a.fecha_vencimiento.localeCompare(b.fecha_vencimiento);
          }
          if (a.fecha_vencimiento) return -1;
          if (b.fecha_vencimiento) return 1;
          return a.id_inventario - b.id_inventario;
        });

        return lotesValidos;
      })
    );
  }

  /**
   * Descuenta stock físico de los lotes de inventario de un medicamento.
   * Utiliza exclusivamente la operación real PATCH en /api/inventario/inventarios/{id}/.
   * Valida stock suficiente y no permite sobregiros.
   */
  descontarStockMedicamento(
    idMedicamento: number,
    cantidadADescontar: number,
    nombreMedicamento?: string
  ): Observable<{ exito: boolean; descontado: number; restante: number }> {
    const cantNum = Number(cantidadADescontar);
    if (isNaN(cantNum) || cantNum <= 0) {
      return throwError(() => new Error('La cantidad a administrar debe ser un número mayor a cero.'));
    }

    return this.obtenerLotesDisponiblesParaMedicamento(idMedicamento, nombreMedicamento).pipe(
      switchMap((lotesDisponibles: any[]) => {
        const totalDisponible = lotesDisponibles.reduce((sum, l) => sum + (Number(l.cantidad_actual) || 0), 0);

        if (totalDisponible <= 0) {
          return throwError(() => new Error(`No hay existencias disponibles en inventario para este medicamento.`));
        }

        if (cantNum > totalDisponible) {
          return throwError(() => new Error(
            `Stock insuficiente. Intentas administrar ${cantNum} uds, pero solo quedan ${totalDisponible} uds disponibles en inventario.`
          ));
        }

        // Distribuir el descuento entre los lotes (consumir por orden de vencimiento/lote)
        let pendientePorDescontar = cantNum;
        const operacionesActualizacion: Observable<any>[] = [];

        for (const lote of lotesDisponibles) {
          if (pendientePorDescontar <= 0) break;

          const disponibleEnLote = Number(lote.cantidad_actual) || 0;
          const aDescontarDeEsteLote = Math.min(disponibleEnLote, pendientePorDescontar);
          const nuevaCantidadLote = disponibleEnLote - aDescontarDeEsteLote;
          const nuevoEstado = nuevaCantidadLote <= 0 ? 'Agotado' : (lote.estado || 'Disponible');

          operacionesActualizacion.push(
            this.actualizarInventario(lote.id_inventario, {
              cantidad_actual: nuevaCantidadLote,
              estado: nuevoEstado
            }).pipe(
              switchMap(res => {
                if (res === null) {
                  return throwError(() => new Error(`Error del servidor al actualizar lote #${lote.id_inventario}`));
                }
                return of(res);
              })
            )
          );

          pendientePorDescontar -= aDescontarDeEsteLote;
        }

        return forkJoin(operacionesActualizacion).pipe(
          map(() => ({
            exito: true,
            descontado: cantNum,
            restante: totalDisponible - cantNum
          }))
        );
      })
    );
  }
}

