import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { ComprasService } from '../services/compras.service';
import { VeterinaryInventoryService } from '../services/veterinary-inventory.service';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventario.html',
  styleUrl: './inventario.css',
})
export class Inventario implements OnInit {
  cargando = true;
  error = '';
  filas: any[] = [];
  filasBase: any[] = [];
  filtro = '';
  filtroEstado = 'todos';
  umbralBajo = 10;
  totalCompras = 0;

  // Estado del Modal de Asignación de Lote a Veterinario
  modalAsignarAbierto = false;
  loteSeleccionado: any = null;
  veterinarios: any[] = [];
  cargandoVeterinarios = false;
  idVeterinarioSeleccionado: number | null = null;
  cantidadAAsignar: number = 1;
  motivoAsignacion = 'Dotación para maletín de campo veterinario';
  guardandoAsignacion = false;
  errorAsignacion = '';

  constructor(
    private svc: ComprasService,
    private vetInvSvc: VeterinaryInventoryService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.cargando = true; this.error = '';
    forkJoin({
      inv: this.svc.listarInventarios().pipe(catchError(() => of([]))),
      com: this.svc.listarCompras().pipe(catchError(() => of([]))),
      det: this.svc.listarDetallesCompra().pipe(catchError(() => of([]))),
      med: this.svc.listarMedicamentos().pipe(catchError(() => of([]))),
      cat: this.svc.listarMedicamentosCatalogo().pipe(catchError(() => of([]))),
      pro: this.svc.listarProveedores().pipe(catchError(() => of([]))),
    }).subscribe({
      next: (r: any) => {
        this.armar(r.inv || [], r.com || [], r.det || [], r.med || [], r.cat || [], r.pro || []);
        this.cargando = false; this.cdr.detectChanges();
      },
      error: () => { this.error = 'No se pudo cargar compras.'; this.cargando = false; this.cdr.detectChanges(); }
    });
  }

  private num(v: any): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v); return isNaN(n) ? null : n;
  }

  private armar(invs: any[], compras: any[], dets: any[], meds: any[], cata: any[], provs: any[]): void {
    this.totalCompras = compras.length;
    const medMap = new Map<number, any>();
    meds.forEach((m: any) => {
      const id = Number(m.id ?? m.id_medicamento);
      if (!isNaN(id)) medMap.set(id, m);
    });
    cata.forEach((c: any) => {
      const id = Number(c.id_medicamento ?? c.id);
      if (!isNaN(id) && !medMap.has(id)) {
        medMap.set(id, {
          id,
          id_medicamento: id,
          nombre: c.nombre,
          descripcion: c.descripcion || c.presentacion,
          tipo: c.tipo,
          cantidad_ml: c.cantidad_ml
        });
      }
    });

    // Schema real /inventario/compras/: { id_compra, fecha, id_proveedor, proveedor_nombre }
    const comMap = new Map<number, any>();
    compras.forEach((c: any) => comMap.set(Number(c.id_compra ?? c.id), c));

    const proMap = new Map<number, any>();
    provs.forEach((p: any) => proMap.set(Number(p.id_proveedor ?? p.id), p));

    // Indexar detalles de compra (tanto los de la API como los embebidos en compras)
    const detMap = new Map<number, any>();
    dets.forEach((d: any) => detMap.set(Number(d.id_detalle_compra ?? d.id), d));
    compras.forEach((c: any) => {
      if (Array.isArray(c.detalles)) {
        c.detalles.forEach((d: any) => {
          const idDet = Number(d.id_detalle_compra ?? d.id);
          if (!isNaN(idDet) && !detMap.has(idDet)) {
            detMap.set(idDet, { ...d, id_compra: c.id_compra ?? c.id });
          }
        });
      }
    });

    // Agrupar los lotes de la tabla inventarios por id_detalle_compra y por id_medicamento
    // En inventarios es donde reside la cantidad_actual (stock físico real de la clínica)
    const invPorDetalle = new Map<number, any[]>();
    const invPorMedicamento = new Map<number, any[]>();
    (invs || []).forEach((inv: any) => {
      const idDet = Number(inv.id_detalle_compra);
      if (!isNaN(idDet) && idDet > 0) {
        if (!invPorDetalle.has(idDet)) invPorDetalle.set(idDet, []);
        invPorDetalle.get(idDet)!.push(inv);
      }
      const idMed = Number(inv.id_medicamento);
      if (!isNaN(idMed) && idMed > 0) {
        if (!invPorMedicamento.has(idMed)) invPorMedicamento.set(idMed, []);
        invPorMedicamento.get(idMed)!.push(inv);
      }
    });

    // Conjunto global para asegurar que NINGÚN lote se cuente dos veces
    const lotesGlobalesContados = new Set<number>();
    const mapa = new Map<string, any>();

    // 1. Procesar todos los detalles de compras agrupando por medicamento (ID real preferido)
    detMap.forEach((d: any) => {
      const idMed = this.num(d.id_medicamento);
      const med = idMed !== null ? medMap.get(idMed) : null;
      const com = comMap.get(Number(d.id_compra));
      const prov = com ? (proMap.get(Number(com.id_proveedor)) || (com.proveedor_nombre ? { nombre: com.proveedor_nombre } : null)) : null;
      const nombre = med?.nombre || (idMed !== null ? `Medicamento #${idMed}` : 'Sin medicamento vinculado');
      const clave = String(idMed ?? nombre);

      if (!mapa.has(clave)) {
        mapa.set(clave, {
          idMed,
          nombre,
          descripcion: String(med?.descripcion || med?.presentacion || '').trim() || 'Sin descripción',
          tipo: String(med?.tipo || 'General'),
          totalComprado: 0,
          stockActual: 0,
          entradas: 0,
          comprasSet: new Set<number>(),
          provs: [] as string[],
          ultima: '',
          vencimiento: '',
          idDetalles: [] as number[],
          idInvs: [] as number[],
          refInv: null as any,
          tieneLoteInventario: false
        });
      }

      const g = mapa.get(clave);
      const cantComprada = this.num(d.cantidad) ?? 0;
      g.totalComprado += cantComprada;
      g.entradas += 1;

      const idDet = Number(d.id_detalle_compra ?? d.id);
      if (!isNaN(idDet) && idDet > 0 && !g.idDetalles.includes(idDet)) {
        g.idDetalles.push(idDet);
      }

      const idCom = this.num(d.id_compra);
      if (idCom !== null) g.comprasSet.add(idCom);

      const pn = prov?.nombre || (com ? `Proveedor #${com.id_proveedor}` : '');
      if (pn && !g.provs.includes(pn)) g.provs.push(pn);

      if (com?.fecha && (!g.ultima || com.fecha > g.ultima)) g.ultima = com.fecha;

      // Relacionar cada detalle de compra con su registro de inventario correspondiente
      const lotes = invPorDetalle.get(idDet) || [];
      if (lotes.length > 0) {
        lotes.forEach((invItem: any) => {
          const idInv = Number(invItem.id_inventario ?? invItem.id);
          if (!isNaN(idInv) && !lotesGlobalesContados.has(idInv)) {
            lotesGlobalesContados.add(idInv);
            g.tieneLoteInventario = true;
            if (!g.idInvs.includes(idInv)) g.idInvs.push(idInv);

            // Regla: Para mostrar existencias, utilizar Inventarios.cantidad_actual
            const cantActual = Number(invItem.cantidad_actual);
            if (!isNaN(cantActual) && cantActual >= 0) {
              g.stockActual += cantActual;
            }
            if (!g.vencimiento && invItem.fecha_vencimiento) {
              g.vencimiento = invItem.fecha_vencimiento;
            }
            if (!g.refInv) g.refInv = invItem;
          }
        });
      }
      // REGLA OBLIGATORIA: Si NO existe registro de inventario, NO usar cantComprada como stock actual
      // ni inventar una cantidad. Se deja tieneLoteInventario en false si no hay lotes válidos.
    });

    // 2. Revisar si hay lotes vinculados directamente por id_medicamento que falten por sumar
    invPorMedicamento.forEach((lotes, idMed) => {
      const clave = String(idMed);
      if (mapa.has(clave)) {
        const g = mapa.get(clave);
        lotes.forEach((invItem: any) => {
          const idInv = Number(invItem.id_inventario ?? invItem.id);
          if (!isNaN(idInv) && !lotesGlobalesContados.has(idInv)) {
            lotesGlobalesContados.add(idInv);
            g.tieneLoteInventario = true;
            if (!g.idInvs.includes(idInv)) g.idInvs.push(idInv);
            const cantActual = Number(invItem.cantidad_actual);
            if (!isNaN(cantActual) && cantActual >= 0) {
              g.stockActual += cantActual;
            }
            if (!g.vencimiento && invItem.fecha_vencimiento) {
              g.vencimiento = invItem.fecha_vencimiento;
            }
            if (!g.refInv) g.refInv = invItem;
          }
        });
      }
    });

    // 3. Procesar lotes de inventarios huérfanos o no vinculados a detalles conocidos
    (invs || []).forEach((inv: any) => {
      const idInv = Number(inv.id_inventario ?? inv.id);
      if (!isNaN(idInv) && !lotesGlobalesContados.has(idInv)) {
        lotesGlobalesContados.add(idInv);
        const cantActual = Number(inv.cantidad_actual) || 0;
        const clave = `inv_${idInv}`;
        if (!mapa.has(clave)) {
          mapa.set(clave, {
            idMed: inv.id_medicamento ? Number(inv.id_medicamento) : null,
            nombre: `Lote #${idInv}`,
            descripcion: inv.estado || 'Lote de inventario sin compra vinculada',
            tipo: 'General',
            totalComprado: cantActual,
            stockActual: cantActual,
            entradas: 1,
            comprasSet: new Set<number>(),
            provs: [] as string[],
            ultima: '',
            vencimiento: inv.fecha_vencimiento || '',
            idDetalles: [] as number[],
            idInvs: [idInv],
            refInv: inv,
            tieneLoteInventario: true
          });
        }
      }
    });

    const lista = Array.from(mapa.values()).map((g: any) => {
      const sinLote = !g.tieneLoteInventario;
      const stock = sinLote ? 0 : Math.max(0, g.stockActual);
      const totalComprado = g.totalComprado;
      const consumidas = sinLote ? 0 : Math.max(0, totalComprado - stock);

      let estado = 'disponible';
      let estadoDb = 'Disponible';

      if (sinLote) {
        estado = 'sin_lote';
        estadoDb = 'Sin lote asignado';
      } else if (stock <= 0) {
        estado = 'agotado';
        estadoDb = 'Agotado';
      } else if (stock <= this.umbralBajo) {
        estado = 'bajo';
        estadoDb = g.refInv?.estado || 'Stock bajo';
      } else {
        estado = 'disponible';
        estadoDb = g.refInv?.estado || 'Disponible';
      }

      const idInvTexto = g.idInvs.length > 0 ? g.idInvs.join(', ') : '—';
      const idDetTexto = g.idDetalles.length > 0 ? g.idDetalles.join(', ') : '—';
      const facturaTexto = g.comprasSet.size > 0
        ? Array.from(g.comprasSet).map(id => `#${id}`).join(', ')
        : '—';

      return {
        idInv: idInvTexto,
        idDetComp: idDetTexto,
        idDetSal: null,
        idMed: g.idMed,
        nombre: g.nombre,
        descripcion: g.descripcion,
        tipo: g.tipo,
        stock,
        sinLote,
        cantidadEntrada: totalComprado,
        consumidas,
        entradas: g.entradas,
        numCompras: g.comprasSet.size,
        vencimiento: g.vencimiento,
        estado,
        estadoDb,
        proveedor: g.provs.length ? g.provs.join(', ') : '—',
        fecha: g.ultima,
        idCompra: g.comprasSet.size === 1 ? Array.from(g.comprasSet)[0] : null,
        facturaTexto,
        refInv: g.refInv,
        idInvs: g.idInvs
      };
    });

    lista.sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
    this.filasBase = lista;
    this.filtrar();
  }

  filtrar(): void {
    const t = this.filtro.toLowerCase().trim();
    this.filas = this.filasBase.filter((f: any) => {
      if (this.filtroEstado !== 'todos' && f.estado !== this.filtroEstado) return false;
      if (!t) return true;
      return (
        String(f.nombre || '').toLowerCase().includes(t) ||
        String(f.descripcion || '').toLowerCase().includes(t) ||
        String(f.proveedor || '').toLowerCase().includes(t) ||
        String(f.idInv || '').includes(t) ||
        String(f.idDetComp || '').includes(t) ||
        String(f.idMed || '').includes(t) ||
        String(f.facturaTexto || '').toLowerCase().includes(t)
      );
    });
  }

  limpiar(): void { this.filtro = ''; this.filtroEstado = 'todos'; this.filas = [...this.filasBase]; }
  get totalRef(): number { return this.filasBase.length; }
  get totalUnd(): number { return this.filasBase.filter(f => !f.sinLote).reduce((s: number, f: any) => s + (Number(f.stock) || 0), 0); }
  get totalDisp(): number { return this.filasBase.filter((f: any) => f.estado === 'disponible').length; }
  get totalBajo(): number { return this.filasBase.filter((f: any) => f.estado === 'bajo').length; }
  get totalAgot(): number { return this.filasBase.filter((f: any) => f.estado === 'agotado').length; }
  get totalSinLote(): number { return this.filasBase.filter((f: any) => f.sinLote).length; }

  // --- LÓGICA DE ASIGNACIÓN DE LOTE / MALETÍN A VETERINARIO ---

  abrirModalAsignar(fila: any): void {
    if (fila.sinLote || (Number(fila.stock) || 0) <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Stock no disponible',
        text: 'Este registro no cuenta con unidades disponibles en CBA para asignar a un veterinario.',
        confirmButtonColor: '#4141a5'
      });
      return;
    }

    this.loteSeleccionado = fila;
    this.cantidadAAsignar = Math.min(Number(fila.stock) || 1, 5);
    this.motivoAsignacion = `Dotación de campo: ${fila.nombre}`;
    this.errorAsignacion = '';
    this.modalAsignarAbierto = true;

    if (this.veterinarios.length === 0) {
      this.cargarVeterinarios();
    }
  }

  cerrarModalAsignar(): void {
    this.modalAsignarAbierto = false;
    this.loteSeleccionado = null;
    this.guardandoAsignacion = false;
    this.errorAsignacion = '';
  }

  cargarVeterinarios(): void {
    this.cargandoVeterinarios = true;
    this.vetInvSvc.obtenerVeterinarios().subscribe({
      next: (vets) => {
        this.veterinarios = vets;
        if (vets.length > 0 && !this.idVeterinarioSeleccionado) {
          this.idVeterinarioSeleccionado = vets[0].id_usuario;
        }
        this.cargandoVeterinarios = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoVeterinarios = false;
        this.cdr.detectChanges();
      }
    });
  }

  confirmarAsignacion(): void {
    this.errorAsignacion = '';

    if (!this.loteSeleccionado) return;

    if (!this.idVeterinarioSeleccionado) {
      this.errorAsignacion = 'Por favor selecciona un médico veterinario de destino.';
      return;
    }

    const cant = Number(this.cantidadAAsignar) || 0;
    const stockActual = Number(this.loteSeleccionado.stock) || 0;

    if (cant <= 0) {
      this.errorAsignacion = 'La cantidad a asignar debe ser mayor a 0.';
      return;
    }

    if (cant > stockActual) {
      this.errorAsignacion = `No puedes asignar ${cant} unidades porque solo hay ${stockActual} disponibles en este lote.`;
      return;
    }

    const vet = this.veterinarios.find(v => Number(v.id_usuario) === Number(this.idVeterinarioSeleccionado));
    const nombreVet = vet ? vet.nombre : `Veterinario #${this.idVeterinarioSeleccionado}`;

    this.guardandoAsignacion = true;

    // 1. Calcular nuevo stock en CBA y nuevo estado
    const nuevoStock = Math.max(0, stockActual - cant);
    let nuevoEstado = 'Disponible';
    if (nuevoStock <= 0) {
      nuevoEstado = 'Agotado';
    } else if (nuevoStock <= this.umbralBajo) {
      nuevoEstado = 'Stock bajo';
    }

    // 2. Si el registro tiene ID de inventario real en backend, actualizarlo vía API
    const idInventarioReal = this.loteSeleccionado.refInv?.id_inventario ?? 
      (this.loteSeleccionado.idInvs && this.loteSeleccionado.idInvs.length > 0 ? this.loteSeleccionado.idInvs[0] : null);

    const ejecutarActualizacionInventario = idInventarioReal
      ? this.svc.actualizarInventario(idInventarioReal, {
          cantidad_actual: nuevoStock,
          estado: nuevoEstado
        })
      : of(null);

    ejecutarActualizacionInventario.subscribe({
      next: () => {
        // 3. Registrar asignación en el kit de campo del veterinario
        this.vetInvSvc.asignarLoteAVeterinario(Number(this.idVeterinarioSeleccionado), {
          id_inventario: idInventarioReal || Number(this.loteSeleccionado.idMed) || Date.now(),
          id_medicamento: Number(this.loteSeleccionado.idMed) || 0,
          nombre: this.loteSeleccionado.nombre,
          tipo: this.loteSeleccionado.tipo,
          descripcion: this.loteSeleccionado.descripcion,
          lote: idInventarioReal ? `LOTE-${idInventarioReal}` : 'LOTE-CBA',
          cantidad: cant,
          motivo: this.motivoAsignacion,
          veterinarioNombre: nombreVet
        }).subscribe({
          next: () => {
            this.guardandoAsignacion = false;
            this.cerrarModalAsignar();

            Swal.fire({
              icon: 'success',
              title: '¡Lote Asignado al Veterinario!',
              html: `
                <div class="text-left text-sm space-y-2">
                  <p><strong>Producto:</strong> ${this.loteSeleccionado?.nombre}</p>
                  <p><strong>Veterinario destino:</strong> ${nombreVet}</p>
                  <p><strong>Cantidad entregada:</strong> <span class="text-emerald-600 font-bold">${cant} unidades</span></p>
                  <p><strong>Nuevo saldo disponible en CBA:</strong> <span class="text-[#4141a5] font-bold">${nuevoStock} unidades</span></p>
                  <div class="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs mt-3">
                    El producto ya está disponible en el <strong>"Inventario Veterinario"</strong> del doctor para sus prescripciones y atenciones de campo.
                  </div>
                </div>
              `,
              confirmButtonText: 'Entendido',
              confirmButtonColor: '#4141a5'
            });

            // Recargar la tabla de inventario para reflejar el stock descontado
            this.cargar();
          },
          error: (err) => {
            console.error('Error al registrar asignación en kit:', err);
            this.guardandoAsignacion = false;
            this.errorAsignacion = 'Error al asignar al kit del veterinario. Intenta nuevamente.';
            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        console.error('Error al actualizar inventario en backend:', err);
        this.guardandoAsignacion = false;
        this.errorAsignacion = 'No se pudo descontar el stock del inventario en el servidor.';
        this.cdr.detectChanges();
      }
    });
  }
}
