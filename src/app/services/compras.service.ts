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
  estado?: string;
  motivo_anulacion?: string;
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
  fecha_vencimiento?: string | null;
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

  /**
   * Registra la compra de forma atómica en el backend.
   * Nota de esquema: la tabla `compra` no cuenta actualmente con llave de idempotencia (`client_uuid`);
   * la protección ante doble envío depende del bloqueo `guardando` en UI y de no reintentar automáticamente
   * ante respuestas inciertas de red/timeout.
   */
  crearCompra(payload: {
    id_proveedor: number;
    detalles?: Array<{
      id_medicamento: number;
      cantidad: number;
      precio_unitario?: number;
      fecha_vencimiento?: string | null;
    }>;
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
    precio_unitario?: number;
    fecha_vencimiento?: string | null;
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

  // --- Endpoints de Inventarios (solo consulta y metadatos seguros) ---

  listarInventarios(): Observable<any[]> {
    return this.http.get<any>(`${this.baseUrlInventario}inventarios/`).pipe(
      map(res => Array.isArray(res) ? res : (res.results || [])),
      catchError(() => of([]))
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
    detalles: Array<{ id_medicamento: number; cantidad: number; precio_unitario?: number; fecha_vencimiento?: string | null }>,
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
              cantidad: Number(d.cantidad),
              fecha_vencimiento: d.fecha_vencimiento || null
            }))
          )
        );

        const obsDetallesValidos = resoluciones.length > 0 ? forkJoin(resoluciones) : of([]);

        return obsDetallesValidos.pipe(
          switchMap(detallesAsegurados => {
            const payloadBackend = {
              id_proveedor: Number(id_proveedor),
              detalles: detallesAsegurados.map(d => {
                const item: any = {
                  id_medicamento: Number(d.id_medicamento),
                  cantidad: Number(d.cantidad)
                };
                if (d.fecha_vencimiento) {
                  item.fecha_vencimiento = d.fecha_vencimiento;
                }
                return item;
              })
            };

            // Enviamos la compra con sus detalles y fecha_vencimiento directamente al backend (/api/inventario/compras/).
            // El backend crea atómicamente Compra, DetalleCompra, Inventarios y Kardex ENTRADA_COMPRA;
            // por lo tanto no se reintenta ni se simulan lotes desde el cliente, y cualquier error se propaga.
            return this.crearCompra(payloadBackend).pipe(
              map((compraCreada: any) => {
                const idCompra = Number(compraCreada.id_compra ?? compraCreada.id);
                const detallesRetornados = Array.isArray(compraCreada.detalles)
                  ? compraCreada.detalles.map((cd: any, idx: number) => ({
                      ...cd,
                      fecha_vencimiento: cd.fecha_vencimiento || detallesAsegurados[idx]?.fecha_vencimiento
                    }))
                  : [];

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

  // --- Operaciones de Edición / Anulación bloqueadas hasta soporte formal en backend ---

  actualizarCompraCompleta(
    _idCompra: number,
    _idProveedor: number,
    _detallesNuevos: DetalleRegistroFila[],
    _detallesOriginalesIds: number[],
    _listaMedicamentos: MedicamentoItem[] = []
  ): Observable<any> {
    return throwError(() => new Error(
      'La edición retroactiva de facturas y detalles de compra está deshabilitada para preservar la integridad de lotes y Kardex.'
    ));
  }

  actualizarInventario(
    idInventario: number,
    payload: { estado?: string; fecha_vencimiento?: string | null }
  ): Observable<any> {
    return this.http.patch<any>(`${this.baseUrlInventario}inventarios/${idInventario}/`, payload);
  }

  anularCompra(_idCompra: number, _motivo: string = 'Anulación solicitada por administración', _idUsuario?: number): Observable<any> {
    return throwError(() => new Error(
      'La anulación de compras no está soportada en esta versión del backend porque requiere reversión transaccional certificada en Kardex.'
    ));
  }

  eliminarCompraConDetalles(idCompra: number, _detallesIds: number[], motivo?: string): Observable<any> {
    return this.anularCompra(idCompra, motivo);
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
   * Deshabilitado: los descuentos de stock en clínica y actas se registran
   * exclusivamente a través del módulo de kit veterinario (/api/inventario/kit/sincronizar-offline/)
   * para conservar el Kardex inmutable y no mutar directamente Bodega General.
   */
  descontarStockMedicamento(
    _idMedicamento: number,
    _cantidadADescontar: number,
    _nombreMedicamento?: string
  ): Observable<{ exito: boolean; descontado: number; restante: number }> {
    return throwError(() => new Error(
      'El descuento directo de existencias en Bodega General está bloqueado. Use el flujo oficial del kit veterinario.'
    ));
  }
}

