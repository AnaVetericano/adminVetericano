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

  crearCompra(payload: { id_proveedor: number }): Observable<Compra> {
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
    detalles: Array<{ id_medicamento: number; cantidad: number; precio_unitario: number }>,
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
        // Asegurar IDs para DetalleCompra
        const resoluciones = detalles.map(d =>
          this.asegurarIdMedicamentoParaDetalle(d.id_medicamento, medicamentos, catalogo).pipe(
            map(idValido => ({
              ...d,
              id_medicamento: idValido
            }))
          )
        );

        const obsDetallesValidos = resoluciones.length > 0 ? forkJoin(resoluciones) : of([]);

        return obsDetallesValidos.pipe(
          switchMap(detallesAsegurados => {
            return this.crearCompra({ id_proveedor: Number(id_proveedor) }).pipe(
              switchMap((compraCreada: Compra) => {
                const idCompra = Number((compraCreada as any).id_compra ?? (compraCreada as any).id);
                if (!idCompra || isNaN(idCompra)) {
                  return throwError(() => new Error('No se recibió un ID válido para la compra creada.'));
                }

                if (!detallesAsegurados || detallesAsegurados.length === 0) {
                  return of({ compra: { ...compraCreada, id_compra: idCompra }, detalles: [] });
                }

                const peticiones = detallesAsegurados.map(d =>
                  this.crearDetalleCompra({
                    id_compra: idCompra,
                    id_medicamento: Number(d.id_medicamento),
                    cantidad: Number(d.cantidad),
                    precio_unitario: Number(d.precio_unitario)
                  })
                );

                return forkJoin(peticiones).pipe(
                  map(detallesCreados => ({
                    compra: { ...compraCreada, id_compra: idCompra },
                    detalles: detallesCreados
                  })),
                  catchError(errDetalle => {
                    return this.eliminarCompra(idCompra).pipe(
                      catchError(() => of(null)),
                      switchMap(() => throwError(() => errDetalle))
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
                      }))
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

  // --- Eliminación Segura: Desvincula inventarios y elimina compra y detalles ---

  eliminarCompraConDetalles(idCompra: number, detallesIds: number[]): Observable<any> {
    return this.desvincularYLimpiarDetalles(detallesIds).pipe(
      switchMap(() => this.eliminarCompra(idCompra))
    );
  }
}
