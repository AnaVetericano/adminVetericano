import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ComprasService } from '../services/compras.service';

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

  constructor(private svc: ComprasService, private cdr: ChangeDetectorRef) {}

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

    // Agrupar los lotes de la tabla inventarios por id_detalle_compra
    // En inventarios es donde reside la cantidad_actual (stock físico real de la clínica)
    const invPorDetalle = new Map<number, any[]>();
    (invs || []).forEach((inv: any) => {
      const idDet = Number(inv.id_detalle_compra);
      if (!isNaN(idDet) && idDet > 0) {
        if (!invPorDetalle.has(idDet)) invPorDetalle.set(idDet, []);
        invPorDetalle.get(idDet)!.push(inv);
      }
    });

    const mapa = new Map<string, any>();

    // 1. Procesar todos los detalles de compras
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

      // Buscar stock real en la tabla inventarios vinculada al detalle
      const lotes = invPorDetalle.get(idDet) || [];
      if (lotes.length > 0) {
        g.tieneLoteInventario = true;
        lotes.forEach((invItem: any) => {
          const idInv = Number(invItem.id_inventario ?? invItem.id);
          if (!isNaN(idInv) && !g.idInvs.includes(idInv)) {
            g.idInvs.push(idInv);
          }
          const cantActual = Number(invItem.cantidad_actual);
          if (!isNaN(cantActual)) {
            g.stockActual += cantActual;
          }
          if (!g.vencimiento && invItem.fecha_vencimiento) {
            g.vencimiento = invItem.fecha_vencimiento;
          }
          if (!g.refInv) g.refInv = invItem;
        });
      } else {
        // Si aún no se ha creado registro en inventarios, la cantidad inicial es la comprada
        g.stockActual += cantComprada;
      }
    });

    // 2. Procesar lotes de inventarios huérfanos o no vinculados a detalles conocidos
    (invs || []).forEach((inv: any) => {
      const idDet = Number(inv.id_detalle_compra);
      const idInv = Number(inv.id_inventario ?? inv.id);
      if (!isNaN(idInv) && (!idDet || !detMap.has(idDet))) {
        const cantActual = Number(inv.cantidad_actual) || 0;
        const clave = `inv_${idInv}`;
        if (!mapa.has(clave)) {
          mapa.set(clave, {
            idMed: null,
            nombre: `Lote #${idInv}`,
            descripcion: inv.estado || 'Lote de inventario',
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
      const stock = Math.max(0, g.stockActual);
      const totalComprado = g.totalComprado;
      const consumidas = Math.max(0, totalComprado - stock);
      const estado = stock <= 0 ? 'agotado' : (stock <= this.umbralBajo ? 'bajo' : 'disponible');
      const estadoDb = stock <= 0 ? 'Agotado' : (g.refInv?.estado || 'Disponible');

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
        facturaTexto
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
  get totalUnd(): number { return this.filasBase.reduce((s: number, f: any) => s + (Number(f.stock) || 0), 0); }
  get totalDisp(): number { return this.filasBase.filter((f: any) => f.estado === 'disponible').length; }
  get totalBajo(): number { return this.filasBase.filter((f: any) => f.estado === 'bajo').length; }
  get totalAgot(): number { return this.filasBase.filter((f: any) => f.estado === 'agotado').length; }
}
