import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';

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
  fechaEntrega?: string;
  lote?: string;
  umbralBajo: boolean; // saldoDisponible <= 10
}

export interface ConsumoValidationResult {
  valido: boolean;
  saldoDisponible: number;
  cantidadSolicitada: number;
  mensajeError?: string;
  alertaStockBajo?: string;
  alternativasDisponibles: VeterinaryKitItem[];
}

@Injectable({
  providedIn: 'root'
})
export class VeterinaryInventoryService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private readonly UMBRAL_STOCK_BAJO = 10;
  private readonly STORAGE_CONSUMOS_KEY = 'vetericano_consumos_veterinario_';

  private inventarioActual$ = new BehaviorSubject<VeterinaryKitItem[]>([]);
  public inventario$ = this.inventarioActual$.asObservable();

  private get baseUrlInventario(): string {
    const envInventario = (environment as any)['apiUrlInventario'];
    if (envInventario) {
      return envInventario.endsWith('/') ? envInventario : `${envInventario}/`;
    }
    const urlBase = environment.apiUrl.endsWith('/') ? environment.apiUrl.slice(0, -1) : environment.apiUrl;
    const clean = urlBase.replace(/\/usuarios$/, '');
    return `${clean}/inventario/`;
  }

  private get baseUrlMedicamentos(): string {
    const envMed = (environment as any)['apiUrlMedicamentos'];
    if (envMed) {
      return envMed.endsWith('/') ? envMed : `${envMed}/`;
    }
    const urlBase = environment.apiUrl.endsWith('/') ? environment.apiUrl.slice(0, -1) : environment.apiUrl;
    const clean = urlBase.replace(/\/usuarios$/, '');
    return `${clean}/medicamentos/`;
  }

  /**
   * Obtiene el identificador del veterinario logueado actualmente
   */
  public getVeterinarioLogueadoId(): number {
    const sesion = this.authService.currentUser();
    if (sesion?.['id_usuario']) return Number(sesion['id_usuario']);
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return Number(payload['id_usuario'] || payload['user_id'] || payload['id'] || 1);
      } catch {}
    }
    return 1;
  }

  /**
   * Obtiene el nombre del veterinario logueado
   */
  public getVeterinarioLogueadoNombre(): string {
    const sesion = this.authService.currentUser();
    const nombre = `${sesion?.['nombre'] || ''} ${sesion?.['apellido'] || ''}`.trim();
    return nombre || 'Médico Veterinario';
  }

  private readonly STORAGE_ASIGNACIONES_KEY = 'vetericano_lotes_asignados_vet_';
  private readonly STORAGE_HISTORIAL_KEY = 'vetericano_historial_asignaciones';

  /**
   * Carga el inventario de campo asignado a un veterinario específico o al veterinario logueado actual
   */
  public cargarInventarioVeterinario(idVetParam?: number): Observable<VeterinaryKitItem[]> {
    const idVet = idVetParam || this.getVeterinarioLogueadoId();

    return forkJoin({
      salidas: this.http.get<any>(`${this.baseUrlInventario}salidas/`).pipe(
        map(res => Array.isArray(res) ? res : (res?.['results'] || [])),
        catchError(() => of([]))
      ),
      detallesSalida: this.http.get<any>(`${this.baseUrlInventario}detalles-salida/`).pipe(
        map(res => Array.isArray(res) ? res : (res?.['results'] || [])),
        catchError(() => of([]))
      ),
      inventarios: this.http.get<any>(`${this.baseUrlInventario}inventarios/`).pipe(
        map(res => Array.isArray(res) ? res : (res?.['results'] || [])),
        catchError(() => of([]))
      ),
      medicamentos: this.http.get<any>(this.baseUrlMedicamentos).pipe(
        map(res => Array.isArray(res) ? res : (res?.['results'] || [])),
        catchError(() => of([]))
      )
    }).pipe(
      map(({ salidas, detallesSalida, inventarios, medicamentos }) => {
        return this.procesarKitCampo(idVet, salidas, detallesSalida, inventarios, medicamentos);
      }),
      tap(items => {
        this.inventarioActual$.next(items);
      })
    );
  }

  /**
   * Procesa los datos del backend y los consolida con las asignaciones reales realizadas desde CBA
   */
  private procesarKitCampo(
    idVet: number,
    salidas: any[],
    detallesSalida: any[],
    inventarios: any[],
    medicamentos: any[]
  ): VeterinaryKitItem[] {
    const medMap = new Map<number, any>();
    medicamentos.forEach((m: any) => {
      const id = Number(m['id'] ?? m['id_medicamento']);
      if (!isNaN(id)) medMap.set(id, m);
    });

    const salidasMap = new Map<number, any>();
    salidas.forEach((s: any) => {
      const id = Number(s['id_salida'] ?? s['id']);
      if (!isNaN(id)) salidasMap.set(id, s);
    });

    const consumosPersistidos = this.obtenerConsumosLocales(idVet);
    const itemsMap = new Map<number, VeterinaryKitItem>();

    // 1. Procesar asignaciones registradas desde la tabla general de inventarios CBA
    const asignacionesReales = this.obtenerAsignacionesLocales(idVet);
    asignacionesReales.forEach((item: VeterinaryKitItem) => {
      const idMed = Number(item.id_medicamento || item.id);
      const consumidoLocal = consumosPersistidos.get(idMed) || item.cantidadConsumida || 0;
      const entregado = Number(item.cantidadEntregada) || 0;
      const saldo = Math.max(0, entregado - consumidoLocal);

      itemsMap.set(idMed, {
        ...item,
        cantidadEntregada: entregado,
        cantidadConsumida: consumidoLocal,
        saldoDisponible: saldo,
        umbralBajo: saldo <= this.UMBRAL_STOCK_BAJO
      });
    });

    // 2. Procesar salidas de la base de datos (si existen registradas en el backend)
    const detallesVet = detallesSalida.filter((d: any) => {
      const idUsuario = Number(d['id_usuario']);
      return idUsuario === idVet || idUsuario === 0 || !d['id_usuario'];
    });

    detallesVet.forEach((d: any) => {
      const idDetalle = Number(d['id_detalle_salida'] ?? d['id']);
      const cantEntregada = Number(d['cantidad']) || 0;
      const idMed = Number(d['id_medicamento'] || d['id_administracion'] || 1);
      const med = medMap.get(idMed);
      const nombre = med?.['nombre'] || `Medicamento #${idMed}`;
      const tipo = med?.['tipo'] || 'Medicamento de Campo';

      const invLote = inventarios.find((i: any) => Number(i['id_detalle_salida']) === idDetalle);
      const consumidoLocal = consumosPersistidos.get(idMed) || 0;
      
      let saldo = 0;
      if (invLote && invLote['cantidad_actual'] !== undefined) {
        saldo = Math.max(0, Number(invLote['cantidad_actual']) - consumidoLocal);
      } else {
        saldo = Math.max(0, cantEntregada - consumidoLocal);
      }

      if (!itemsMap.has(idMed)) {
        itemsMap.set(idMed, {
          id: idDetalle || idMed,
          id_medicamento: idMed,
          nombre,
          descripcion: med?.['descripcion'] || 'Suministro asignado al maletín de campo',
          tipo,
          presentacion: med?.['presentacion'] || med?.['cantidad_ml'] || 'Frasco / Ampolla',
          concentracion: med?.['concentracion'] || '',
          cantidadEntregada: cantEntregada,
          cantidadConsumida: consumidoLocal,
          saldoDisponible: saldo,
          fechaEntrega: salidasMap.get(Number(d['id_salida']))?.['fecha'] || new Date().toISOString(),
          lote: invLote ? `LOTE-${invLote['id_inventario']}` : `KIT-VET${idVet}`,
          umbralBajo: saldo <= this.UMBRAL_STOCK_BAJO
        });
      } else {
        const itemExistente = itemsMap.get(idMed)!;
        itemExistente.cantidadEntregada += cantEntregada;
        itemExistente.saldoDisponible = Math.max(0, itemExistente.cantidadEntregada - itemExistente.cantidadConsumida);
        itemExistente.umbralBajo = itemExistente.saldoDisponible <= this.UMBRAL_STOCK_BAJO;
      }
    });

    const resultado = Array.from(itemsMap.values());
    resultado.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return resultado;
  }

  /**
   * Asigna un lote / cantidad desde el inventario general de CBA al maletín de un veterinario
   */
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
    }
  ): Observable<boolean> {
    const idNum = Number(idVet);
    const asignaciones = this.obtenerAsignacionesLocales(idNum);
    const idMed = Number(payload.id_medicamento || payload.id_inventario);
    const index = asignaciones.findIndex(a => Number(a.id_medicamento) === idMed || Number(a.id) === Number(payload.id_inventario));

    const cantAsignar = Number(payload.cantidad) || 0;

    if (index >= 0) {
      asignaciones[index].cantidadEntregada = (Number(asignaciones[index].cantidadEntregada) || 0) + cantAsignar;
      const consumido = Number(asignaciones[index].cantidadConsumida) || 0;
      asignaciones[index].saldoDisponible = Math.max(0, asignaciones[index].cantidadEntregada - consumido);
      asignaciones[index].umbralBajo = asignaciones[index].saldoDisponible <= this.UMBRAL_STOCK_BAJO;
      asignaciones[index].fechaEntrega = new Date().toISOString();
    } else {
      asignaciones.push({
        id: payload.id_inventario,
        id_medicamento: idMed,
        nombre: payload.nombre,
        descripcion: payload.descripcion || 'Lote asignado desde inventario general CBA',
        tipo: payload.tipo || 'Medicamento General',
        presentacion: payload.presentacion || 'Unidad de campo',
        concentracion: '',
        cantidadEntregada: cantAsignar,
        cantidadConsumida: 0,
        saldoDisponible: cantAsignar,
        fechaEntrega: new Date().toISOString(),
        lote: payload.lote || `LOTE-${payload.id_inventario}`,
        umbralBajo: cantAsignar <= this.UMBRAL_STOCK_BAJO
      });
    }

    this.guardarAsignacionesLocales(idNum, asignaciones);

    // Registro de auditoría
    this.registrarEnHistorialAsignaciones({
      id: Date.now(),
      fecha: new Date().toISOString(),
      idVet: idNum,
      veterinarioNombre: payload.veterinarioNombre || `Veterinario #${idNum}`,
      idInventario: payload.id_inventario,
      nombreMedicamento: payload.nombre,
      cantidad: cantAsignar,
      motivo: payload.motivo || 'Dotación de maletín de campo'
    });

    // Si el usuario actualmente logueado es este veterinario, refrescar la lista reactiva
    if (this.getVeterinarioLogueadoId() === idNum) {
      this.cargarInventarioVeterinario(idNum).subscribe();
    }

    return of(true);
  }

  public obtenerAsignacionesLocales(idVet: number): VeterinaryKitItem[] {
    try {
      const data = localStorage.getItem(`${this.STORAGE_ASIGNACIONES_KEY}${idVet}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
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
   * Obtiene la lista de veterinarios ACTIVOS del sistema para asignarles lotes y supervisar sus maletines
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

        // Función estricta para asegurar que el usuario esté ACTIVO
        const esUsuarioActivo = (item: any): boolean => {
          if (!item) return false;
          // Si el campo activo o is_active es explícitamente false o 'false' o 0, NO está activo
          if (item['activo'] === false || item['activo'] === 'false' || item['activo'] === 0) return false;
          if (item['is_active'] === false || item['is_active'] === 'false' || item['is_active'] === 0) return false;
          if (typeof item['estado'] === 'string' && item['estado'].toLowerCase().includes('inactiv')) return false;
          return true;
        };

        // 1. Filtrar funcionarios ACTIVOS con rol Veterinario
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

        // 2. Filtrar usuarios ACTIVOS con rol Veterinario
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

  /**
   * Validación en tiempo real para cuando el veterinario formula o registra consumo:
   * 1. Verifica si la cantidad solicitada supera el Saldo Disponible
   * 2. Si supera: bloquea acción y genera mensaje de error estricto
   * 3. Busca alternativas disponibles en su stock
   * 4. Si saldo <= 10: genera alerta de stock bajo
   */
  public validarConsumo(idMedicamento: number, cantidadSolicitada: number): ConsumoValidationResult {
    const items = this.inventarioActual$.getValue();
    const item = items.find(i => Number(i.id_medicamento) === Number(idMedicamento) || Number(i.id) === Number(idMedicamento));
    
    const saldo = item ? item.saldoDisponible : 0;
    const cantNum = Number(cantidadSolicitada) || 0;

    const alternativas = this.obtenerAlternativas(idMedicamento, item?.tipo);

    // Alerta de stock bajo si saldo <= 10
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

  /**
   * Busca medicamentos alternativos en el stock del veterinario con saldo > 0
   */
  public obtenerAlternativas(idMedicamento: number, tipo?: string): VeterinaryKitItem[] {
    const items = this.inventarioActual$.getValue();
    const targetId = Number(idMedicamento);

    // Primero busca del mismo tipo terapéutico
    let alternativas = items.filter(i =>
      Number(i.id_medicamento) !== targetId &&
      Number(i.id) !== targetId &&
      i.saldoDisponible > 0 &&
      tipo && i.tipo && i.tipo.toLowerCase() === tipo.toLowerCase()
    );

    // Si no hay del mismo tipo, busca cualquier producto disponible con saldo
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
   * Registra un consumo en el inventario de campo del veterinario
   */
  public registrarConsumo(idMedicamento: number, cantidad: number, observaciones?: string): Observable<boolean> {
    const idVet = this.getVeterinarioLogueadoId();
    const validacion = this.validarConsumo(idMedicamento, cantidad);

    if (!validacion.valido) {
      return of(false);
    }

    // Actualizar en el estado reactivo
    const items = this.inventarioActual$.getValue().map(item => {
      if (Number(item.id_medicamento) === Number(idMedicamento) || Number(item.id) === Number(idMedicamento)) {
        const nuevoConsumo = item.cantidadConsumida + cantidad;
        const nuevoSaldo = Math.max(0, item.cantidadEntregada - nuevoConsumo);
        return {
          ...item,
          cantidadConsumida: nuevoConsumo,
          saldoDisponible: nuevoSaldo,
          umbralBajo: nuevoSaldo <= this.UMBRAL_STOCK_BAJO
        };
      }
      return item;
    });

    this.inventarioActual$.next(items);
    this.guardarConsumoLocal(idVet, idMedicamento, cantidad);

    return of(true);
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
}