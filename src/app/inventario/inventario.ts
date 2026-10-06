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
      if (!isNaN(id) && !medMap.has(id)) medMap.set(id, { id, nombre: c.nombre, descripcion: c.descripcion, tipo: c.tipo, cantidad_ml: c.cantidad_ml });
    });
    // Schema real tabla inventarios: id_inventario, id_detalle_salida, id_detalle_compra, cantidad_actual, fecha_vencimiento, estado
    // Schema real /inventario/compras/: { id_compra, fecha, id_proveedor }
    const detMap = new Map<number, any>();
    dets.forEach((d: any) => detMap.set(Number(d.id_detalle_compra ?? d.id), d));
    const comMap = new Map<number, any>();
    compras.forEach((c: any) => comMap.set(Number(c.id_compra ?? c.id), c));
    const proMap = new Map<number, any>();
    provs.forEach((p: any) => proMap.set(Number(p.id_proveedor ?? p.id), p));

    // Fuente de verdad: los detalles de Compras (facturas). El inventario
    // muestra la suma de cantidad por medicamento; cantidad_actual de la
    // tabla inventarios solo se usa como referencia de descuadre.
    const mapa = new Map<string, any>();
    dets.forEach((d: any) => {
      const idMed = this.num(d.id_medicamento);
      const med = idMed !== null ? medMap.get(idMed) : null;
      const com = comMap.get(Number(d.id_compra));
      const prov = com ? proMap.get(Number(com.id_proveedor)) : null;
      const nombre = med?.nombre || (idMed !== null ? `Medicamento #${idMed}` : 'Sin medicamento vinculado');
      const clave = String(idMed ?? nombre);
      if (!mapa.has(clave)) mapa.set(clave, {
        idMed, nombre,
        descripcion: String(med?.descripcion || '').trim() || 'Sin descripción',
        tipo: String(med?.tipo || 'General'),
        stock: 0, entradas: 0, comprasSet: new Set<number>(),
        provs: [] as string[], ultima: '', vencimiento: '',
        idDetalles: [] as number[], refInv: null as any
      });
      const g = mapa.get(clave);
      g.stock += this.num(d.cantidad) ?? 0; g.entradas += 1;
      g.idDetalles.push(Number(d.id_detalle_compra ?? d.id));
      const idCom = this.num(d.id_compra);
      if (idCom !== null) g.comprasSet.add(idCom);
      const pn = prov?.nombre || (com ? `Proveedor #${com.id_proveedor}` : '');
      if (pn && !g.provs.includes(pn)) g.provs.push(pn);
      if (com?.fecha && (!g.ultima || com.fecha > g.ultima)) g.ultima = com.fecha;
    });
    // Enriquecer con la tabla inventarios: vencimiento + cantidad_actual de referencia
    const invPorDetalle = new Map<number, any>();
    (invs || []).forEach((inv: any) => {
      const idDet = Number(inv.id_detalle_compra);
      if (!isNaN(idDet) && !invPorDetalle.has(idDet)) invPorDetalle.set(idDet, inv);
    });
    const lista = Array.from(mapa.values()).map((g: any) => {
      let vencimiento = '';
      let refCantidad: number | null = null;
      let idInvRef: number | null = null;
      g.idDetalles.forEach((idDet: number) => {
        const inv = invPorDetalle.get(idDet);
        if (!inv) return;
        if (!vencimiento && inv.fecha_vencimiento) vencimiento = inv.fecha_vencimiento;
        if (idInvRef === null) { idInvRef = Number(inv.id_inventario ?? inv.id) || null; g.refInv = inv; }
        const rc = Number(inv.cantidad_actual);
        if (!isNaN(rc)) refCantidad = (refCantidad ?? 0) + rc;
      });
      const estado = g.stock <= 0 ? 'agotado' : g.stock <= this.umbralBajo ? 'bajo' : 'disponible';
      return {
        idInv: idInvRef, idDetComp: g.idDetalles.length === 1 ? g.idDetalles[0] : null, idDetSal: null,
        idMed: g.idMed, nombre: g.nombre, descripcion: g.descripcion, tipo: g.tipo,
        stock: g.stock, entradas: g.entradas, numCompras: g.comprasSet.size,
        vencimiento, estado, estadoDb: g.refInv?.estado || '—',
        proveedor: g.provs.length ? g.provs.join(', ') : '—',
        fecha: g.ultima, idCompra: null,
        cantidadEntrada: g.stock, refCantidad,
        descuadre: refCantidad !== null && refCantidad !== g.stock
      };
    });
    lista.sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
    this.filasBase = lista; this.filtrar();
  }

  filtrar(): void {
    const t = this.filtro.toLowerCase().trim();
    this.filas = this.filasBase.filter((f: any) => {
      if (this.filtroEstado !== 'todos' && f.estado !== this.filtroEstado) return false;
      if (!t) return true;
      return String(f.nombre || '').toLowerCase().includes(t) || String(f.descripcion || '').toLowerCase().includes(t) || String(f.proveedor || '').toLowerCase().includes(t) || String(f.idInv ?? '').includes(t) || String(f.idDetComp ?? '').includes(t) || String(f.idMed ?? '').includes(t);
    });
  }

  limpiar(): void { this.filtro = ''; this.filtroEstado = 'todos'; this.filas = [...this.filasBase]; }
  get totalRef(): number { return this.filasBase.length; }
  get totalUnd(): number { return this.filasBase.reduce((s: number, f: any) => s + (Number(f.stock) || 0), 0); }
  get totalDisp(): number { return this.filasBase.filter((f: any) => f.estado === 'disponible').length; }
  get totalBajo(): number { return this.filasBase.filter((f: any) => f.estado === 'bajo').length; }
  get totalAgot(): number { return this.filasBase.filter((f: any) => f.estado === 'agotado').length; }
}
