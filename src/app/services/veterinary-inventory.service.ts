import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';

export interface KitItemLote {
  id_kit_lote: number;
  id_inventario: number;
  cantidad_actual: number;
  fecha_vencimiento: string | null;
  vencido: boolean;
}

export interface KitResponseItem {
  id_medicamento: number;
  nombre: string;
  saldo_disponible: number;
  saldo_vencido: number;
  lotes: KitItemLote[];
}

export interface MiKitResponse {
  total_unidades: number;
  items: KitResponseItem[];
}

export interface KitAlertasResponse {
  agotados: { id_medicamento: number; nombre: string; saldo_disponible: number }[];
  criticos: { id_medicamento: number; nombre: string; saldo_disponible: number }[];
  bajos: { id_medicamento: number; nombre: string; saldo_disponible: number }[];
  vencidos: { id_medicamento: number; nombre: string; id_kit_lote: number; cantidad_vencida: number; fecha_vencimiento: string }[];
  proximos_a_vencer: { id_medicamento: number; nombre: string; id_kit_lote: number; cantidad: number; fecha_vencimiento: string; dias_restantes: number }[];
}

export interface VeterinaryKitItem {
  id: number;
  id_medicamento: number;
  nombre: string;
  descripcion?: string;
  tipo: string;
  presentacion?: string;
  concentracion?: string;
  cantidadEntregada: number;
  cantidadConsumida: number;
  saldoDisponible: number;
  saldoVencido?: number;
  fechaEntrega?: string;
  lote?: string;
  umbralBajo: boolean; // saldoDisponible <= 10
  lotes?: KitItemLote[];
}

export interface ConsumoValidationResult {
  valido: boolean;
  saldoDisponible: number;
  cantidadSolicitada: number;
  mensajeError?: string;
  alertaStockBajo?: string;
  alternativasDisponibles: VeterinaryKitItem[];
}

export interface AsignarKitPayload {
  id_veterinario: number;
  motivo?: string;
  items: {
    id_medicamento: number;
    cantidad: number;
  }[];
}

export interface RetiroDirectoPayload {
  id_veterinario: number;
  id_medicamento: number;
  cantidad: number;
  motivo?: string;
}

export interface SolicitudKitPayload {
  tipo: 'REPOSICION' | 'DEVOLUCION';
  justificacion?: string;
  items: {
    id_medicamento: number;
    cantidad_solicitada: number;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class VeterinaryInventoryService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private readonly UMBRAL_STOCK_BAJO = 10;
  private readonly STORAGE_CONSUMOS_KEY = 'vetericano_consumos_veterinario_';
  private readonly STORAGE_ASIGNACIONES_KEY = 'vetericano_lotes_asignados_vet_';
  private readonly STORAGE_HISTORIAL_KEY = 'vetericano_historial_asignaciones';

  private inventarioActual$ = new BehaviorSubject<VeterinaryKitItem[]>([]);
  public inventario$ = this.inventarioActual$.asObservable();

  // Alertas reactivas de maletín compartidas entre barra superior y dashboard
  private _alertasMaletin = new BehaviorSubject<any[]>([]);
  public readonly alertasMaletin$ = this._alertasMaletin.asObservable();

  public setAlertasMaletin(alertas: any[]): void {
    this._alertasMaletin.next(alertas);
  }

  public get alertasMaletinActuales(): any[] {
    return this._alertasMaletin.value;
  }

  /**
   * URL base de Inventario general: https://.../api/inventario/
   */
  public get baseUrlInventario(): string {
    const envInventario = (environment as any)['apiUrlInventario'];
    if (envInventario) {
      return envInventario.endsWith('/') ? envInventario : `${envInventario}/`;
    }
    const urlBase = environment.apiUrl.endsWith('/') ? environment.apiUrl.slice(0, -1) : environment.apiUrl;
    const clean = urlBase.replace(/\/usuarios$/, '');
    return `${clean}/inventario/`;
  }

  /**
   * URL base de endpoints de Kit de Campo (PDF Backend Froshi): https://.../api/inventario/kit/
   */
  public get baseUrlKit(): string {
    return `${this.baseUrlInventario}kit/`;
  }

  /**
   * URL base de catálogo de medicamentos
   */
  public get baseUrlMedicamentos(): string {
    const envMed = (environment as any)['apiUrlMedicamentos'];
    if (envMed) {
      return envMed.endsWith('/') ? envMed : `${envMed}/`;
    }
    const urlBase = environment.apiUrl.endsWith('/') ? environment.apiUrl.slice(0, -1) : environment.apiUrl;
    const clean = urlBase.replace(/\/usuarios$/, '');
    return `${clean}/medicamentos/`;
  }

  /**
   * URL base de catálogo de medicamentos (tabla medicamentos / compatible con FK de inventario)
   */
  public get baseUrlMedicamentosCatalogo(): string {
    const envCat = (environment as any)['apiUrlMedicamentosCatalogo'];
    if (envCat) {
      return envCat.endsWith('/') ? envCat : `${envCat}/`;
    }
    const urlBase = environment.apiUrl.endsWith('/') ? environment.apiUrl.slice(0, -1) : environment.apiUrl;
    const clean = urlBase.replace(/\/usuarios$/, '');
    return `${clean}/medicamentos-catalogo/`;
  }

  /**
   * Obtiene el identificador del usuario veterinario logueado actualmente
   */
  public getVeterinarioLogueadoId(): number {
    const sesion = this.authService.currentUser();
    const rol = String(sesion?.rol ?? sesion?.['nombre_rol'] ?? '').toLowerCase();
    const esAdmin = rol.includes('admin') || rol.includes('jur') || Number(sesion?.id_rol) === 1 || Number(sesion?.id_rol) === 2;

    // Si es administrador, verificar si hay un veterinario seleccionado para supervisión activa
    if (esAdmin) {
      const vetSupervisado = sessionStorage.getItem('veterinario_seleccionado_supervision') || localStorage.getItem('veterinario_seleccionado_supervision');
      if (vetSupervisado && !isNaN(Number(vetSupervisado)) && Number(vetSupervisado) > 0) {
        return Number(vetSupervisado);
      }
    }

    if (sesion?.['id_usuario']) return Number(sesion['id_usuario']);
    if (sesion?.['id']) return Number(sesion['id']);
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return Number(payload['id_usuario'] || payload['user_id'] || payload['id'] || 0);
      } catch {}
    }
    return 0;
  }

  /**
   * Obtiene el nombre completo del veterinario logueado
   */
  public getVeterinarioLogueadoNombre(): string {
    const sesion = this.authService.currentUser();
    const nombre = `${sesion?.['nombre'] || ''} ${sesion?.['apellido'] || ''}`.trim();
    return nombre || 'Médico Veterinario';
  }

  // =========================================================================
  // ENDPOINTS BACKEND OFICIALES (Guía de integración del inventario por kit)
  // =========================================================================

  /**
   * A1. Asignar stock al kit de un veterinario (Bodega -> Kit)
   * POST /api/inventario/kit/asignar/
   * Consume por FIFO lotes no vencidos en bodega general y los transfiere al kit.
   */
  public asignarStockKit(
    idVeterinario: number,
    items: { id_medicamento: number; cantidad: number }[],
    motivo: string = 'Dotación inicial kit de campo'
  ): Observable<any> {
    const payload: AsignarKitPayload = {
      id_veterinario: Number(idVeterinario),
      motivo,
      items: items.map(it => ({
        id_medicamento: Number(it.id_medicamento),
        cantidad: Number(it.cantidad)
      }))
    };

    return this.http.post<any>(`${this.baseUrlKit}asignar/`, payload).pipe(
      tap(() => {
        // Registrar en historial local de auditoría
        items.forEach(it => {
          this.registrarEnHistorialAsignaciones({
            id: Date.now(),
            fecha: new Date().toISOString(),
            idVet: idVeterinario,
            idMedicamento: it.id_medicamento,
            cantidad: it.cantidad,
            motivo
          });
        });
      })
    );
  }

  /**
   * B1. Consultar mi kit (Médico Veterinario de Campo)
   * GET /api/inventario/kit/mi-kit/
   * Devuelve items asignados con saldo_disponible, saldo_vencido y desglose de lotes.
   */
  public obtenerMiKit(): Observable<MiKitResponse> {
    return this.http.get<MiKitResponse>(`${this.baseUrlKit}mi-kit/`);
  }

  /**
   * A2. Supervisar kit de un veterinario específico (Rol Administrador / Supervisor)
   * GET /api/inventario/kit/veterinario/{id}/
   */
  public obtenerKitVeterinario(idVeterinario: number): Observable<MiKitResponse> {
    return this.http.get<MiKitResponse>(`${this.baseUrlKit}veterinario/${idVeterinario}/`);
  }

  /**
   * A5 / B4. Consultar alertas de stock (agotados, criticos, bajos, vencidos, proximos_a_vencer)
   * GET /api/inventario/kit/alertas/ [?id_veterinario=X]
   */
  public obtenerAlertasKit(idVeterinario?: number): Observable<KitAlertasResponse> {
    let params = new HttpParams().set('page_size', '1000').set('limit', '1000');
    if (idVeterinario) {
      params = params.set('id_veterinario', String(idVeterinario)).set('id_vete', String(idVeterinario));
    }
    return this.http.get<KitAlertasResponse>(`${this.baseUrlKit}alertas/`, { params });
  }

  /**
   * A6 / B5. Consultar kardex de movimientos
   * GET /api/inventario/kit/kardex/
   */
  public obtenerKardexKit(filtros?: any): Observable<any> {
    let params = new HttpParams().set('page_size', '1000').set('limit', '1000');
    if (filtros) {
      Object.keys(filtros).forEach(key => {
        if (filtros[key] !== undefined && filtros[key] !== null && filtros[key] !== '') {
          params = params.set(key, String(filtros[key]));
        }
      });
    }
    return this.http.get<any>(`${this.baseUrlKit}kardex/`, { params });
  }

  /**
   * Consulta exhaustiva y reactiva de la totalidad de movimientos de Kardex,
   * siguiendo la paginación recursiva de DRF (next URL) para no truncar consumos ni asignaciones.
   */
  public obtenerTodoElKardexKit(filtros?: any): Observable<any[]> {
    const fetchPage = (url: string, params?: HttpParams): Observable<any[]> => {
      return this.http.get<any>(url, { params }).pipe(
        switchMap(res => {
          let items: any[] = [];
          let nextUrl: string | null = null;
          if (Array.isArray(res)) {
            items = res;
          } else if (res && typeof res === 'object') {
            items = Array.isArray(res.results) ? res.results : (Array.isArray(res.movimientos) ? res.movimientos : (Array.isArray(res.data) ? res.data : []));
            nextUrl = res.next || null;
          }

          if (nextUrl) {
            return fetchPage(nextUrl).pipe(
              map(nextItems => items.concat(nextItems)),
              catchError(() => of(items))
            );
          }
          return of(items);
        }),
        catchError(() => of([]))
      );
    };

    let params = new HttpParams().set('page_size', '1000').set('limit', '1000');
    if (filtros) {
      Object.keys(filtros).forEach(key => {
        if (filtros[key] !== undefined && filtros[key] !== null && filtros[key] !== '') {
          params = params.set(key, String(filtros[key]));
        }
      });
    }

    return fetchPage(`${this.baseUrlKit}kardex/`, params);
  }

  /**
   * A3. Retiro directo desde el kit (Correcciones o devoluciones forzosas por administrador)
   * POST /api/inventario/kit/retiro-directo/
   */
  public retiroDirectoKit(payload: RetiroDirectoPayload): Observable<any> {
    return this.http.post<any>(`${this.baseUrlKit}retiro-directo/`, payload);
  }

  /**
   * B3. Crear solicitud de reposición o devolución
   * POST /api/inventario/kit/solicitudes/
   */
  public crearSolicitudKit(payload: SolicitudKitPayload): Observable<any> {
    return this.http.post<any>(`${this.baseUrlKit}solicitudes/`, payload);
  }

  /**
   * A4. Consultar solicitudes (Bandeja gestor y veterinario)
   * GET /api/inventario/kit/solicitudes/
   */
  public obtenerSolicitudesKit(filtros?: any): Observable<any> {
    let params = new HttpParams().set('page_size', '1000').set('limit', '1000');
    if (filtros) {
      Object.keys(filtros).forEach(key => {
        if (filtros[key] !== undefined && filtros[key] !== null && filtros[key] !== '') {
          params = params.set(key, String(filtros[key]));
        }
      });
    }
    return this.http.get<any>(`${this.baseUrlKit}solicitudes/`, { params });
  }

  /**
   * A4. Aprobar solicitud de reposición/devolución
   * POST /api/inventario/kit/solicitudes/{id}/aprobar/
   */
  public aprobarSolicitudKit(
    idSolicitud: number,
    payload: { observaciones_gestor?: string; aprobaciones: { id_medicamento: number; cantidad_aprobada: number }[] }
  ): Observable<any> {
    return this.http.post<any>(`${this.baseUrlKit}solicitudes/${idSolicitud}/aprobar/`, payload);
  }

  /**
   * A4. Rechazar solicitud
   * POST /api/inventario/kit/solicitudes/{id}/rechazar/
   */
  public rechazarSolicitudKit(idSolicitud: number, observacionesGestor?: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrlKit}solicitudes/${idSolicitud}/rechazar/`, {
      observaciones_gestor: observacionesGestor || ''
    });
  }

  /**
   * B3. Cancelar solicitud propia
   * POST /api/inventario/kit/solicitudes/{id}/cancelar/
   */
  public cancelarSolicitudKit(idSolicitud: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrlKit}solicitudes/${idSolicitud}/cancelar/`, {});
  }

  /**
   * B2. Sincronizar consumos de campo (Online / Offline)
   * POST /api/inventario/kit/sincronizar-offline/
   */
  public sincronizarConsumosOffline(consumos: any[]): Observable<any> {
    return this.http.post<any>(`${this.baseUrlKit}sincronizar-offline/`, { consumos });
  }

  // =========================================================================
  // CARGA REACTIVA Y CONSOLIDACIÓN DEL INVENTARIO VETERINARIO
  // =========================================================================

  /**
   * Carga el inventario de campo asignado a un veterinario específico o al veterinario logueado actual,
   * integrando el endpoint real del backend `/api/inventario/kit/` y enriqueciendo con el catálogo.
   */
  public cargarInventarioVeterinario(idVetParam?: number): Observable<VeterinaryKitItem[]> {
    const sesion: any = this.authService.currentUser();
    const rol = String(sesion?.rol ?? sesion?.['nombre_rol'] ?? '').toLowerCase();
    const esAdmin = rol.includes('admin') || rol.includes('jur') || Number(sesion?.id_rol) === 1 || Number(sesion?.id_rol) === 2;

    const idVet = idVetParam || this.getVeterinarioLogueadoId();

    // Consulta del Kit según rol y contexto:
    // Si es Administrador supervisando un maletín, se consulta exclusivamente el kit de ese veterinario.
    // Nunca debe caer en obtenerMiKit() para evitar mezclar la sesión del administrador con el maletín supervisado.
    const kitRequest$ = (esAdmin && idVet)
      ? this.obtenerKitVeterinario(idVet).pipe(
          catchError(() => of({ total_unidades: 0, items: [] }))
        )
      : (idVet ? this.obtenerKitVeterinario(idVet).pipe(
          catchError(() => this.obtenerMiKit().pipe(catchError(() => of({ total_unidades: 0, items: [] }))))
        ) : this.obtenerMiKit().pipe(
          catchError(() => of({ total_unidades: 0, items: [] }))
        ));

    return forkJoin({
      kit: kitRequest$,
      medicamentos: this.http.get<any>(this.baseUrlMedicamentos).pipe(
        map(res => Array.isArray(res) ? res : (res?.['results'] || [])),
        catchError(() => of([]))
      ),
      catalogo: this.http.get<any>(this.baseUrlMedicamentosCatalogo).pipe(
        map(res => Array.isArray(res) ? res : (res?.['results'] || [])),
        catchError(() => of([]))
      ),
      kardex: this.obtenerTodoElKardexKit({ id_veterinario: idVet }).pipe(
        map(res => Array.isArray(res) ? res : (res?.['results'] || res?.['movimientos'] || [])),
        catchError(() => of([]))
      )
    }).pipe(
      map(({ kit, medicamentos, catalogo, kardex }) => {
        const medMap = new Map<number, any>();
        catalogo.forEach((c: any) => {
          const id = Number(c['id_medicamento'] ?? c['id']);
          if (!isNaN(id)) {
            medMap.set(id, {
              id,
              id_medicamento: id,
              nombre: c['nombre'],
              descripcion: c['descripcion'] || c['presentacion'],
              tipo: c['tipo'],
              presentacion: c['presentacion'],
              concentracion: c['concentracion'] || '',
              cantidad_ml: c['cantidad_ml']
            });
          }
        });
        medicamentos.forEach((m: any) => {
          const id = Number(m['id'] ?? m['id_medicamento']);
          if (!isNaN(id) && !medMap.has(id)) medMap.set(id, m);
        });

        // Consumos, asignaciones y retiros reales consolidados desde el Kardex oficial de Supabase
        const consumosKardexPorMed = new Map<number, number>();
        const asignacionesKardexPorMed = new Map<number, number>();
        const retirosKardexPorMed = new Map<number, number>();

        (kardex || []).forEach((k: any) => {
          const tipo = String(k['tipo_movimiento'] || '').toUpperCase();
          const idV = Number(k['id_veterinario'] ?? k['id_vete'] ?? k['veterinario_id'] ?? k['id_vet'] ?? k['id_usuario']);
          const idM = Number(k['id_medicamento'] ?? k['id_med'] ?? k['medicamento_id']);
          const cant = Number(k['cantidad']) || 0;
          const ubicacion = String(k['ubicacion'] || '').toUpperCase();
          const esDelVet = (
            idV === Number(idVet) ||
            Number(k['id_veterinario']) === Number(idVet) ||
            Number(k['id_vete']) === Number(idVet) ||
            Number(k['id_usuario']) === Number(idVet)
          );

          if (esDelVet && idM > 0) {
            // Asignación / dotación inicial a kit de campo
            if (tipo === 'ASIGNACION_KIT' && (ubicacion === 'KIT_VETERINARIO' || ubicacion === '')) {
              asignacionesKardexPorMed.set(idM, (asignacionesKardexPorMed.get(idM) || 0) + cant);
            }
            // Retiro o devolución a bodega (Filtrar exclusivamente el movimiento de salida del kit para no duplicar con la contrapartida de entrada a bodega)
            else if (
              (tipo === 'RETIRO_KIT' || tipo === 'RETIRO' || (tipo.includes('RETIRO') && !tipo.includes('BODEGA') && !tipo.includes('ENTRADA'))) &&
              ubicacion !== 'BODEGA_GENERAL' && ubicacion !== 'BODEGA'
            ) {
              retirosKardexPorMed.set(idM, (retirosKardexPorMed.get(idM) || 0) + cant);
            }
            // Consumo real (desde la app móvil o web en historias / actas)
            else if (
              (tipo.includes('CONSUMO') || tipo.includes('ACTA') || tipo === 'SALIDA' || tipo === 'FORMULACION') &&
              tipo !== 'ASIGNACION_KIT' && tipo !== 'ENTRADA' &&
              (ubicacion === 'KIT_VETERINARIO' || ubicacion === '')
            ) {
              consumosKardexPorMed.set(idM, (consumosKardexPorMed.get(idM) || 0) + cant);
            }
          }
        });

        // Cachear consumos descubiertos de Kardex en localStorage para que nunca se pierdan
        consumosKardexPorMed.forEach((cantKardex, idM) => {
          this.actualizarConsumoLocalMax(Number(idVet), idM, cantKardex);
        });

        const itemsBackend = (kit?.items || []) as KitResponseItem[];
        const consumosLocales = this.obtenerConsumosLocales(Number(idVet));
        const asignacionesLocales = this.obtenerAsignacionesLocales(Number(idVet));
        const resultado: VeterinaryKitItem[] = [];
        const idsMedicamentosEnResultado = new Set<number>();

        if (itemsBackend.length > 0) {
          itemsBackend.forEach(it => {
            const idMed = Number(it.id_medicamento);
            idsMedicamentosEnResultado.add(idMed);
            const medInfo = medMap.get(idMed);
            const saldoVenc = Number(it.saldo_vencido) || 0;

            // Cantidad consumida consolidada (Móvil desde Kardex + local web)
            const consumidoKardex = consumosKardexPorMed.get(idMed) || 0;
            const consumidoLocal = consumosLocales.get(idMed) || 0;
            const consumido = Math.max(consumidoKardex, consumidoLocal);

            // Saldo disponible base informado por el backend
            const saldoDispBackend = Number(it.saldo_disponible) || 0;

            // Cantidad entregada/dotada real al maletín de campo:
            // REGLA FUNDAMENTAL: La cantidad entregada representa la dotación fija
            // y NUNCA se incrementa cuando un veterinario realiza aplicaciones o consumos.
            const asigLocal = asignacionesLocales.find(a => Number(a.id_medicamento || a.id) === idMed);
            let entregado = 0;
            if (asignacionesKardexPorMed.has(idMed) && (asignacionesKardexPorMed.get(idMed) || 0) > 0) {
              const totalDotado = asignacionesKardexPorMed.get(idMed) || 0;
              const totalRetirado = retirosKardexPorMed.get(idMed) || 0;
              entregado = Math.max(0, totalDotado - totalRetirado);
            } else if (asigLocal && asigLocal.cantidadEntregada > 0) {
              entregado = asigLocal.cantidadEntregada;
            } else {
              entregado = saldoDispBackend;
            }

            // Protección de integridad: la dotación entregada nunca debe ser menor a lo consumido acumulado
            if (entregado < consumido) {
              entregado = consumido;
            }

            // Saldo disponible en tiempo real:
            // SALDO_DISPONIBLE = CANTIDAD_ENTREGADA - CANTIDAD_CONSUMIDA - SALDO_VENCIDO
            const saldoDisp = Math.max(0, entregado - consumido - saldoVenc);

            // Formatear texto de lotes
            let loteTexto = `KIT-VET${idVet}`;
            if (it.lotes && it.lotes.length > 0) {
              loteTexto = it.lotes.map(l => `Lote #${l.id_inventario}`).join(', ');
            }

            resultado.push({
              id: idMed,
              id_medicamento: idMed,
              nombre: it.nombre || medInfo?.nombre || `Medicamento #${idMed}`,
              descripcion: medInfo?.descripcion || medInfo?.presentacion || 'Medicamento asignado a kit de campo',
              tipo: medInfo?.tipo || 'Medicamento de Campo',
              presentacion: medInfo?.presentacion || medInfo?.cantidad_ml || 'Presentación clínica',
              concentracion: medInfo?.concentracion || '',
              cantidadEntregada: entregado,
              cantidadConsumida: consumido,
              saldoDisponible: saldoDisp,
              saldoVencido: saldoVenc,
              fechaEntrega: new Date().toISOString(),
              lote: loteTexto,
              umbralBajo: saldoDisp <= this.UMBRAL_STOCK_BAJO,
              lotes: it.lotes
            });
          });
        }

        // Si hay movimientos en inventario_kardex de Supabase que no estén en kit.items
        // (por ejemplo asignaciones registradas en Kardex que aún no consolidaron en la vista del kit)
        asignacionesKardexPorMed.forEach((dotado, idMed) => {
          if (!idsMedicamentosEnResultado.has(idMed) && dotado > 0) {
            idsMedicamentosEnResultado.add(idMed);
            const retirado = retirosKardexPorMed.get(idMed) || 0;
            const entregado = Math.max(0, dotado - retirado);
            const consumido = consumosKardexPorMed.get(idMed) || 0;
            const saldo = Math.max(0, entregado - consumido);
            const medInfo = medMap.get(idMed);

            resultado.push({
              id: idMed,
              id_medicamento: idMed,
              nombre: medInfo?.nombre || `Medicamento #${idMed}`,
              descripcion: medInfo?.descripcion || medInfo?.presentacion || 'Medicamento asignado a kit de campo',
              tipo: medInfo?.tipo || 'Medicamento de Campo',
              presentacion: medInfo?.presentacion || medInfo?.cantidad_ml || 'Presentación clínica',
              concentracion: medInfo?.concentracion || '',
              cantidadEntregada: entregado,
              cantidadConsumida: consumido,
              saldoDisponible: saldo,
              saldoVencido: 0,
              fechaEntrega: new Date().toISOString(),
              lote: `KIT-VET${idVet}`,
              umbralBajo: saldo <= this.UMBRAL_STOCK_BAJO
            });
          }
        });

        // Incorporar asignaciones locales guardadas en maletín si aún no están en resultado
        asignacionesLocales.forEach((asig) => {
          const idMed = Number(asig.id_medicamento || asig.id);
          if (!idsMedicamentosEnResultado.has(idMed) && idMed > 0) {
            idsMedicamentosEnResultado.add(idMed);
            const consumidoLocal = consumosLocales.get(idMed) || 0;
            const consumido = Math.max(consumidoLocal, asig.cantidadConsumida || 0);
            const entregado = Math.max(asig.cantidadEntregada || asig.saldoDisponible || 0, consumido);
            const saldoDisp = Math.max(0, entregado - consumido);
            resultado.push({
              ...asig,
              id: idMed,
              id_medicamento: idMed,
              cantidadEntregada: entregado,
              cantidadConsumida: consumido,
              saldoDisponible: saldoDisp,
              umbralBajo: saldoDisp <= this.UMBRAL_STOCK_BAJO
            });
          }
        });

        resultado.sort((a, b) => a.nombre.localeCompare(b.nombre));
        return resultado;
      }),
      tap(items => {
        this.inventarioActual$.next(items);
        this.guardarAsignacionesLocales(Number(idVet), items);
      })
    );
  }

  // =========================================================================
  // PERSISTENCIA LOCAL Y HISTORIAL
  // =========================================================================

  public asignarLoteAVeterinario(
    idVet: number,
    payload: {
      id_inventario: number;
      id_medicamento?: number;
      nombre: string;
      tipo?: string;
      descripcion?: string;
      presentacion?: string;
      lote?: string;
      cantidad: number;
      motivo?: string;
      veterinarioNombre?: string;
      tipoOperacion?: 'ASIGNAR' | 'RETIRO' | 'AJUSTE';
    }
  ): Observable<boolean> {
    const idNum = Number(idVet);
    const asignaciones = this.obtenerAsignacionesLocales(idNum);
    const idMed = Number(payload.id_medicamento || payload.id_inventario);
    const index = asignaciones.findIndex(a => Number(a.id_medicamento) === idMed || Number(a.id) === Number(payload.id_inventario));

    const cantRaw = Number(payload.cantidad) || 0;
    const esRetiro = payload.tipoOperacion === 'RETIRO' || cantRaw < 0;
    const cantAbs = Math.abs(cantRaw);

    if (index >= 0) {
      if (esRetiro) {
        // Reducir la cantidad entregada (50 - 10 = 40)
        asignaciones[index].cantidadEntregada = Math.max(0, (Number(asignaciones[index].cantidadEntregada) || 0) - cantAbs);
      } else {
        // Sumar a la dotación
        asignaciones[index].cantidadEntregada = (Number(asignaciones[index].cantidadEntregada) || 0) + cantAbs;
      }
      const consumido = Number(asignaciones[index].cantidadConsumida) || 0;
      asignaciones[index].saldoDisponible = Math.max(0, asignaciones[index].cantidadEntregada - consumido);
      asignaciones[index].umbralBajo = asignaciones[index].saldoDisponible <= this.UMBRAL_STOCK_BAJO;
      asignaciones[index].fechaEntrega = new Date().toISOString();
    } else {
      const currentItems = this.inventarioActual$.value || [];
      const itemExistente = currentItems.find(it => Number(it.id_medicamento || it.id) === idMed);
      const baseEntregada = itemExistente ? (Number(itemExistente.cantidadEntregada) || Number(itemExistente.saldoDisponible) || 0) : 0;
      const baseConsumida = itemExistente ? (Number(itemExistente.cantidadConsumida) || 0) : 0;

      const nuevaEntregada = esRetiro ? Math.max(0, baseEntregada - cantAbs) : (baseEntregada + cantAbs);
      const nuevoSaldo = Math.max(0, nuevaEntregada - baseConsumida);

      asignaciones.push({
        id: payload.id_inventario,
        id_medicamento: idMed,
        nombre: itemExistente?.nombre || payload.nombre,
        descripcion: itemExistente?.descripcion || payload.descripcion || 'Lote asignado desde inventario general CBA',
        tipo: itemExistente?.tipo || payload.tipo || 'Medicamento General',
        presentacion: itemExistente?.presentacion || payload.presentacion || 'Unidad de campo',
        concentracion: itemExistente?.concentracion || '',
        cantidadEntregada: nuevaEntregada,
        cantidadConsumida: baseConsumida,
        saldoDisponible: nuevoSaldo,
        fechaEntrega: new Date().toISOString(),
        lote: itemExistente?.lote || payload.lote || `LOTE-${payload.id_inventario}`,
        umbralBajo: nuevoSaldo <= this.UMBRAL_STOCK_BAJO
      });
    }

    this.guardarAsignacionesLocales(idNum, asignaciones);

    this.registrarEnHistorialAsignaciones({
      id: Date.now(),
      fecha: new Date().toISOString(),
      idVet: idNum,
      veterinarioNombre: payload.veterinarioNombre || `Veterinario #${idNum}`,
      idInventario: payload.id_inventario,
      nombreMedicamento: payload.nombre,
      cantidad: esRetiro ? -cantAbs : cantAbs,
      motivo: payload.motivo || (esRetiro ? 'Devolución de stock a bodega CBA' : 'Dotación de maletín de campo')
    });

    if (this.getVeterinarioLogueadoId() === idNum) {
      this.cargarInventarioVeterinario(idNum).subscribe();
    }

    return of(true);
  }

  /**
   * Ajuste de inventario / Retiro directo de kit a bodega:
   * Si es RETIRO (devolver unidades a bodega general o corregir diferencias):
   * Resta en el backend kit mediante POST /api/inventario/kit/retiro-directo/ y descuenta en local
   */
  public ajustarStockKit(
    idVeterinario: number,
    idMedicamento: number,
    cantidad: number,
    tipoOperacion: 'ASIGNAR' | 'RETIRO' = 'RETIRO',
    motivo: string = 'Ajuste de inventario en kit de campo'
  ): Observable<any> {
    const cantNum = Math.abs(Number(cantidad)) || 0;
    const idVet = Number(idVeterinario);
    const idMed = Number(idMedicamento);

    if (tipoOperacion === 'RETIRO') {
      const payloadRetiro: RetiroDirectoPayload = {
        id_veterinario: idVet,
        id_medicamento: idMed,
        cantidad: cantNum,
        motivo
      };

      return this.retiroDirectoKit(payloadRetiro).pipe(
        tap(() => {
          // Si el backend procesó el retiro exitosamente, solo registramos en historial local
          this.registrarEnHistorialAsignaciones({
            id: Date.now(),
            fecha: new Date().toISOString(),
            idVet,
            veterinarioNombre: `Veterinario #${idVet}`,
            idInventario: idMed,
            nombreMedicamento: `Medicamento #${idMed}`,
            cantidad: -cantNum,
            motivo: motivo || 'Devolución de stock a bodega CBA'
          });
        }),
        catchError(() => {
          // Si el backend está desconectado/offline, descontamos exactamente 1 vez en local
          return this.asignarLoteAVeterinario(idVet, {
            id_inventario: idMed,
            id_medicamento: idMed,
            nombre: `Medicamento #${idMed}`,
            cantidad: cantNum,
            tipoOperacion: 'RETIRO',
            motivo
          });
        })
      );
    } else {
      return this.asignarStockKit(idVet, [{ id_medicamento: idMed, cantidad: cantNum }], motivo).pipe(
        tap(() => {
          this.registrarEnHistorialAsignaciones({
            id: Date.now(),
            fecha: new Date().toISOString(),
            idVet,
            veterinarioNombre: `Veterinario #${idVet}`,
            idInventario: idMed,
            nombreMedicamento: `Medicamento #${idMed}`,
            cantidad: cantNum,
            motivo: motivo || 'Dotación de maletín de campo'
          });
        }),
        catchError(() => {
          return this.asignarLoteAVeterinario(idVet, {
            id_inventario: idMed,
            id_medicamento: idMed,
            nombre: `Medicamento #${idMed}`,
            cantidad: cantNum,
            tipoOperacion: 'ASIGNAR',
            motivo
          });
        })
      );
    }
  }

  public obtenerAsignacionesLocales(idVet: number): VeterinaryKitItem[] {
    try {
      const idNum = Number(idVet);
      if (!idNum) return [];

      // Aislamiento: leer la clave asignada a este veterinario con fallback al veterinario oficial
      const data = localStorage.getItem(`${this.STORAGE_ASIGNACIONES_KEY}${idNum}`);
      if (!data) return [];

      const items = JSON.parse(data);
      if (!Array.isArray(items)) return [];

      // Descartar registros corruptos o de pruebas anteriores (ej. '+', 'Lote #3')
      return items.filter((it: any) => {
        const nom = String(it.nombre || '').trim();
        const tieneNombreValido = nom !== '' && nom !== '+' && !nom.startsWith('Lote #');
        const tieneSaldo = Number(it.saldoDisponible ?? it.cantidadEntregada ?? 0) > 0;
        return tieneNombreValido && tieneSaldo;
      });
    } catch {
      return [];
    }
  }

  /**
   * Limpia claves residuales generadas en pruebas previas en localStorage,
   * preservando tanto el veterinario activo actual como el veterinario de pruebas (ID 41).
   */
  public limpiarDatosResidualesVeterinarios(): void {
    try {
      const idActivo = this.getVeterinarioLogueadoId();
      const keysAEliminar: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(this.STORAGE_ASIGNACIONES_KEY) || key.startsWith(this.STORAGE_CONSUMOS_KEY))) {
          // Preservar clave si pertenece al veterinario activo actual o al 41
          const esDelActivo = idActivo && key.endsWith(String(idActivo));
          if (!esDelActivo) {
            keysAEliminar.push(key);
          }
        }
      }
      keysAEliminar.forEach(k => localStorage.removeItem(k));
    } catch {}
  }

  public guardarAsignacionesLocales(idVet: number, items: VeterinaryKitItem[]): void {
    try {
      localStorage.setItem(`${this.STORAGE_ASIGNACIONES_KEY}${idVet}`, JSON.stringify(items));
    } catch {}
  }

  public registrarEnHistorialAsignaciones(registro: any): void {
    try {
      const data = localStorage.getItem(this.STORAGE_HISTORIAL_KEY);
      const historial = data ? JSON.parse(data) : [];
      historial.unshift(registro);
      localStorage.setItem(this.STORAGE_HISTORIAL_KEY, JSON.stringify(historial.slice(0, 100)));
    } catch {}
  }

  public obtenerHistorialAsignaciones(): any[] {
    try {
      const data = localStorage.getItem(this.STORAGE_HISTORIAL_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Obtiene la lista de veterinarios ACTIVOS del sistema
   */
  public obtenerVeterinarios(): Observable<any[]> {
    const urlBase = environment.apiUrl.endsWith('/') ? environment.apiUrl.slice(0, -1) : environment.apiUrl;
    const clean = urlBase.replace(/\/usuarios$/, '');

    return forkJoin({
      funcionarios: this.http.get<any>(`${clean}/peticiones/seguimiento/funcionarios/`).pipe(
        map(res => Array.isArray(res) ? res : (res?.['results'] || [])),
        catchError(() => of([]))
      ),
      usuarios: this.http.get<any>(`${urlBase}/usuarios/`).pipe(
        map(res => Array.isArray(res) ? res : (res?.['results'] || [])),
        catchError(() => of([]))
      )
    }).pipe(
      map(({ funcionarios, usuarios }) => {
        const mapaVets = new Map<number, any>();

        const esUsuarioActivo = (item: any): boolean => {
          if (!item) return false;
          if (item['activo'] === false || item['activo'] === 'false' || item['activo'] === 0) return false;
          if (item['is_active'] === false || item['is_active'] === 'false' || item['is_active'] === 0) return false;
          if (typeof item['estado'] === 'string' && item['estado'].toLowerCase().includes('inactiv')) return false;
          return true;
        };

        (funcionarios || []).forEach((f: any) => {
          if (!esUsuarioActivo(f)) return;

          const id = Number(f['id_usuario'] ?? f['id']);
          const rol = String(f['rol'] ?? f['nombre_rol'] ?? '').toLowerCase();
          const idRol = Number(f['id_rol'] ?? 0);
          if (idRol === 2 || idRol === 3 || rol.includes('veterinario')) {
            const nombre = `${f['nombre'] || ''} ${f['apellido'] || ''}`.trim() || f['username'] || `Veterinario #${id}`;
            mapaVets.set(id, {
              id_usuario: id,
              nombre,
              email: f['email'] || '',
              identificacion: f['identificacion'] || '',
              rol: 'Veterinario',
              activo: true
            });
          }
        });

        (usuarios || []).forEach((u: any) => {
          if (!esUsuarioActivo(u)) return;

          const id = Number(u['id_usuario'] ?? u['id']);
          const idRol = Number(u['id_rol']?.['id_rol'] ?? u['id_rol'] ?? 0);
          const nombreRol = String(u['nombre_rol'] ?? u['id_rol']?.['nombre_rol'] ?? '').toLowerCase();
          if (idRol === 2 || idRol === 3 || nombreRol.includes('veterinario')) {
            if (!mapaVets.has(id)) {
              const nombre = `${u['nombre'] || ''} ${u['apellido'] || ''}`.trim() || u['username'] || `Veterinario #${id}`;
              mapaVets.set(id, {
                id_usuario: id,
                nombre,
                email: u['email'] || '',
                identificacion: u['identificacion'] || '',
                rol: 'Veterinario',
                activo: true
              });
            }
          }
        });

        const lista = Array.from(mapaVets.values());
        lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
        return lista;
      })
    );
  }

  // =========================================================================
  // VALIDACIÓN Y REGISTRO DE CONSUMOS DE CAMPO
  // =========================================================================

  /**
   * Validación en tiempo real para prescripción / consumo
   */
  public validarConsumo(idMedicamento: number, cantidadSolicitada: number, nombreMedicamento?: string): ConsumoValidationResult {
    let items = this.inventarioActual$.getValue();
    const idVet = this.getVeterinarioLogueadoId();

    if (!items || items.length === 0) {
      items = this.obtenerAsignacionesLocales(idVet);
      if (items.length > 0) {
        this.inventarioActual$.next(items);
      }
    }

    const nomNorm = (nombreMedicamento || '').trim().toLowerCase();
    const item = items.find(i =>
      (Number(idMedicamento) > 0 && (Number(i.id_medicamento) === Number(idMedicamento) || Number(i.id) === Number(idMedicamento))) ||
      (nomNorm.length > 0 && i.nombre && i.nombre.trim().toLowerCase() === nomNorm)
    );
    
    const saldo = item ? item.saldoDisponible : 0;
    const cantNum = Number(cantidadSolicitada) || 0;

    const alternativas = this.obtenerAlternativas(idMedicamento, item?.tipo);

    let alertaStockBajo: string | undefined;
    if (saldo <= this.UMBRAL_STOCK_BAJO && saldo > 0) {
      alertaStockBajo = `Recuerda que te quedan ${saldo} unidades de este producto. Es hora de solicitar reaprovisionamiento al inventario general.`;
    }

    if (cantNum <= 0) {
      return {
        valido: false,
        saldoDisponible: saldo,
        cantidadSolicitada: cantNum,
        mensajeError: 'Ingresa una cantidad válida mayor a 0.',
        alertaStockBajo,
        alternativasDisponibles: alternativas
      };
    }

    if (cantNum > saldo) {
      const mensajeError = `No cuentas con suficiente stock en tu inventario de campo (Disponibles: ${saldo}, Solicitados: ${cantNum}). Por favor, ajusta la cantidad o utiliza una alternativa de medicamento disponible.`;
      return {
        valido: false,
        saldoDisponible: saldo,
        cantidadSolicitada: cantNum,
        mensajeError,
        alertaStockBajo,
        alternativasDisponibles: alternativas
      };
    }

    return {
      valido: true,
      saldoDisponible: saldo,
      cantidadSolicitada: cantNum,
      alertaStockBajo,
      alternativasDisponibles: alternativas
    };
  }

  public obtenerAlternativas(idMedicamento: number, tipo?: string): VeterinaryKitItem[] {
    const items = this.inventarioActual$.getValue();
    const targetId = Number(idMedicamento);

    let alternativas = items.filter(i =>
      Number(i.id_medicamento) !== targetId &&
      Number(i.id) !== targetId &&
      i.saldoDisponible > 0 &&
      tipo && i.tipo && i.tipo.toLowerCase() === tipo.toLowerCase()
    );

    if (alternativas.length === 0) {
      alternativas = items.filter(i =>
        Number(i.id_medicamento) !== targetId &&
        Number(i.id) !== targetId &&
        i.saldoDisponible > 0
      );
    }

    return alternativas.slice(0, 4);
  }

  /**
   * Registra un consumo en el kit de campo del veterinario:
   * 1. Actualiza el estado reactivo en memoria.
   * 2. Guarda localmente para persistencia inmediata.
   * 3. Sincroniza con el backend mediante POST /api/inventario/kit/sincronizar-offline/
   */
  public registrarConsumo(idMedicamento: number, cantidad: number, observaciones?: string, nombreMedicamento?: string): Observable<boolean> {
    const idVet = this.getVeterinarioLogueadoId();
    let items = this.inventarioActual$.getValue();
    if (!items || items.length === 0) {
      items = this.obtenerAsignacionesLocales(idVet);
      if (items.length > 0) {
        this.inventarioActual$.next(items);
      }
    }

    const validacion = this.validarConsumo(idMedicamento, cantidad, nombreMedicamento);

    if (!validacion.valido && validacion.saldoDisponible <= 0) {
      return of(false);
    }

    // Actualizar reactivo y persistencia local de maletín
    let encontrado = false;
    let idEfectivo = Number(idMedicamento) || 0;
    const nomNorm = (nombreMedicamento || '').trim().toLowerCase();

    const itemsActualizados = items.map(item => {
      const matchId = idEfectivo > 0 && (Number(item.id_medicamento) === idEfectivo || Number(item.id) === idEfectivo);
      const matchNom = nomNorm.length > 0 && item.nombre && item.nombre.trim().toLowerCase() === nomNorm;

      if (matchId || matchNom) {
        encontrado = true;
        idEfectivo = Number(item.id_medicamento || item.id) || idEfectivo;
        const nuevoConsumo = (Number(item.cantidadConsumida) || 0) + cantidad;
        const nuevoSaldo = Math.max(0, (Number(item.cantidadEntregada) || item.saldoDisponible) - nuevoConsumo);
        return {
          ...item,
          cantidadConsumida: nuevoConsumo,
          saldoDisponible: nuevoSaldo,
          umbralBajo: nuevoSaldo <= this.UMBRAL_STOCK_BAJO
        };
      }
      return item;
    });

    if (encontrado) {
      this.inventarioActual$.next(itemsActualizados);
      this.guardarAsignacionesLocales(idVet, itemsActualizados);
    }

    if (idEfectivo > 0) {
      this.guardarConsumoLocal(idVet, idEfectivo, cantidad);
    }

    // Sincronizar con el backend con UUID v4 garantizado
    const clientUuid = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
    const payloadSinc = {
      consumos: [
        {
          client_uuid: clientUuid,
          id_medicamento: Number(idEfectivo),
          unidades: Number(cantidad),
          fecha_consumo: new Date().toISOString()
        }
      ]
    };

    return this.sincronizarConsumosOffline(payloadSinc.consumos).pipe(
      map(() => true),
      catchError(() => of(true)) // Si falla conexión o sincronización, se mantiene guardado localmente
    );
  }

  private obtenerConsumosLocales(idVet: number): Map<number, number> {
    const map = new Map<number, number>();
    try {
      const data = localStorage.getItem(`${this.STORAGE_CONSUMOS_KEY}${idVet}`);
      if (data) {
        const obj = JSON.parse(data);
        Object.keys(obj).forEach(k => map.set(Number(k), Number(obj[k])));
      }
    } catch {}
    return map;
  }

  private guardarConsumoLocal(idVet: number, idMedicamento: number, cantidad: number): void {
    try {
      const key = `${this.STORAGE_CONSUMOS_KEY}${idVet}`;
      const data = localStorage.getItem(key);
      const obj = data ? JSON.parse(data) : {};
      obj[idMedicamento] = (Number(obj[idMedicamento]) || 0) + Number(cantidad);
      localStorage.setItem(key, JSON.stringify(obj));
    } catch {}
  }
  public actualizarConsumoLocalMax(idVet: number, idMedicamento: number, cantidad: number): void {
    try {
      const key = `${this.STORAGE_CONSUMOS_KEY}${idVet}`;
      const data = localStorage.getItem(key);
      const obj = data ? JSON.parse(data) : {};
      const actual = Number(obj[idMedicamento]) || 0;
      if (Number(cantidad) > actual) {
        obj[idMedicamento] = Number(cantidad);
        localStorage.setItem(key, JSON.stringify(obj));
      }
    } catch {}
  }
}
