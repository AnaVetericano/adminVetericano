import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { ComprasService } from '../services/compras.service';
import { VeterinaryInventoryService, VeterinaryKitItem } from '../services/veterinary-inventory.service';

@Component({
  selector: 'app-inventario-juridico',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventario-juridico.html',
  styleUrl: './inventario-juridico.css',
})
export class InventarioJuridicoComponent implements OnInit {
  private svc = inject(ComprasService);
  private vetInvSvc = inject(VeterinaryInventoryService);
  private cdr = inject(ChangeDetectorRef);

  // Control de pestañas
  pestanaActiva: 'general' | 'veterinarios' = 'general';

  // --- ESTADO HU 1: INVENTARIO GENERAL CBA ---
  cargandoGeneral = true;
  errorGeneral = '';
  filas: any[] = [];
  filasBase: any[] = [];
  filtro = '';
  filtroEstado = 'todos';
  umbralBajo = 10;
  totalCompras = 0;

  // --- ESTADO HU 2: INVENTARIO POR VETERINARIO CBA ---
  cargandoVeterinarios = false;
  cargandoKitVet = false;
  veterinarios: any[] = [];
  idVeterinarioSeleccionado: number | null = null;
  veterinarioSeleccionado: any = null;
  itemsVeterinario: VeterinaryKitItem[] = [];
  itemsVeterinarioFiltrados: VeterinaryKitItem[] = [];
  filtroVetTexto = '';
  filtroVetEstado = 'todos';

  ngOnInit(): void {
    this.cargarInventarioGeneral();
    this.cargarListaVeterinarios();
  }

  // =========================================================================
  // HU 1: CONSULTA Y REPLICACIÓN DE INVENTARIO GENERAL CBA (IDÉNTICO AL ADMIN)
  // =========================================================================

  cargarInventarioGeneral(): void {
    this.cargandoGeneral = true;
    this.errorGeneral = '';
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
        this.cargandoGeneral = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorGeneral = 'No se pudo cargar la información del inventario general.';
        this.cargandoGeneral = false;
        this.cdr.detectChanges();
      }
    });
  }

  private num(v: any): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  }

  private armar(invs: any[], compras: any[], dets: any[], meds: any[], cata: any[], provs: any[]): void {
    this.totalCompras = compras.length;
    const medMap = new Map<number, any>();
    cata.forEach((c: any) => {
      const id = Number(c.id_medicamento ?? c.id);
      if (!isNaN(id)) {
        medMap.set(id, {
          id,
          id_medicamento: id,
          nombre: c.nombre,
          descripcion: c.descripcion || c.presentacion,
          tipo: c.tipo,
          presentacion: c.presentacion,
          concentracion: c.concentracion || '',
          cantidad_ml: c.cantidad_ml
        });
      }
    });
    meds.forEach((m: any) => {
      const id = Number(m.id ?? m.id_medicamento);
      if (!isNaN(id) && !medMap.has(id)) medMap.set(id, m);
    });

    const comMap = new Map<number, any>();
    compras.forEach((c: any) => comMap.set(Number(c.id_compra ?? c.id), c));

    const proMap = new Map<number, any>();
    provs.forEach((p: any) => proMap.set(Number(p.id_proveedor ?? p.id), p));

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

    const lotesGlobalesContados = new Set<number>();
    const mapa = new Map<string, any>();

    // 1. Procesar todos los detalles de compras agrupando por medicamento
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

      const lotes = invPorDetalle.get(idDet) || [];
      if (lotes.length > 0) {
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

    // 2. Revisar si hay lotes vinculados directamente por id_medicamento
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

    // 3. Procesar lotes de inventarios huérfanos o sin compra vinculada
    (invs || []).forEach((inv: any) => {
      const idInv = Number(inv.id_inventario ?? inv.id);
      if (!isNaN(idInv) && !lotesGlobalesContados.has(idInv)) {
        lotesGlobalesContados.add(idInv);
        const cantActual = Number(inv.cantidad_actual) || 0;
        const clave = `inv_${idInv}`;
        if (!mapa.has(clave)) {
          const idDet = Number(inv.id_detalle_compra);
          const detVinculado = !isNaN(idDet) && idDet > 0 ? detMap.get(idDet) : null;
          let idMed = inv.id_medicamento ? Number(inv.id_medicamento) : (detVinculado ? Number(detVinculado.id_medicamento) : null);
          const med = idMed ? medMap.get(idMed) : null;
          const nombre = med?.nombre || (idMed ? `Medicamento #${idMed}` : `Lote #${idInv}`);

          mapa.set(clave, {
            idMed: idMed || null,
            nombre,
            descripcion: med?.descripcion || inv.estado || 'Lote de inventario',
            tipo: med?.tipo || 'General',
            totalComprado: cantActual,
            stockActual: cantActual,
            entradas: 1,
            comprasSet: new Set<number>(),
            provs: [] as string[],
            ultima: '',
            vencimiento: inv.fecha_vencimiento || '',
            idDetalles: idDet ? [idDet] : ([] as number[]),
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
    this.filtrarGeneral();
  }

  filtrarGeneral(): void {
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

  limpiarFiltrosGeneral(): void {
    this.filtro = '';
    this.filtroEstado = 'todos';
    this.filas = [...this.filasBase];
  }

  get totalRef(): number { return this.filasBase.length; }
  get totalUnd(): number { return this.filasBase.filter(f => !f.sinLote).reduce((s: number, f: any) => s + (Number(f.stock) || 0), 0); }
  get totalDisp(): number { return this.filasBase.filter((f: any) => f.estado === 'disponible').length; }
  get totalBajo(): number { return this.filasBase.filter((f: any) => f.estado === 'bajo').length; }
  get totalAgot(): number { return this.filasBase.filter((f: any) => f.estado === 'agotado').length; }
  get totalSinLote(): number { return this.filasBase.filter((f: any) => f.sinLote).length; }

  // =========================================================================
  // HU 2: CONSULTA DE INVENTARIO ACTUALIZADO POR VETERINARIO DEL CBA
  // =========================================================================

  cargarListaVeterinarios(): void {
    this.cargandoVeterinarios = true;
    this.vetInvSvc.obtenerVeterinarios().subscribe({
      next: (vets) => {
        this.veterinarios = vets || [];
        this.cargandoVeterinarios = false;
        if (this.veterinarios.length > 0 && !this.idVeterinarioSeleccionado) {
          this.seleccionarVeterinario(this.veterinarios[0]);
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoVeterinarios = false;
        this.cdr.detectChanges();
      }
    });
  }

  onCambioVeterinario(event: any): void {
    const id = Number(event?.target?.value || this.idVeterinarioSeleccionado);
    const encontrado = this.veterinarios.find(v => Number(v.id_usuario ?? v.id) === id);
    if (encontrado) {
      this.seleccionarVeterinario(encontrado);
    }
  }

  seleccionarVeterinario(vet: any): void {
    this.veterinarioSeleccionado = vet;
    this.idVeterinarioSeleccionado = Number(vet.id_usuario ?? vet.id);
    this.cargarInventarioDeVeterinario(this.idVeterinarioSeleccionado);
  }

  cargarInventarioDeVeterinario(idVet: number): void {
    this.cargandoKitVet = true;
    this.itemsVeterinario = [];
    this.itemsVeterinarioFiltrados = [];
    this.vetInvSvc.cargarInventarioVeterinario(idVet).subscribe({
      next: (items) => {
        this.itemsVeterinario = items || [];
        this.filtrarKitVeterinario();
        this.cargandoKitVet = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoKitVet = false;
        this.cdr.detectChanges();
      }
    });
  }

  filtrarKitVeterinario(): void {
    const t = this.filtroVetTexto.toLowerCase().trim();
    this.itemsVeterinarioFiltrados = this.itemsVeterinario.filter((item: VeterinaryKitItem) => {
      if (this.filtroVetEstado === 'bajo' && item.saldoDisponible > 10) return false;
      if (this.filtroVetEstado === 'agotado' && item.saldoDisponible > 0) return false;
      if (this.filtroVetEstado === 'disponible' && item.saldoDisponible <= 0) return false;

      if (!t) return true;
      return (
        String(item.nombre || '').toLowerCase().includes(t) ||
        String(item.tipo || '').toLowerCase().includes(t) ||
        String(item.presentacion || '').toLowerCase().includes(t) ||
        String(item.id_medicamento || '').includes(t)
      );
    });
  }

  limpiarFiltrosVet(): void {
    this.filtroVetTexto = '';
    this.filtroVetEstado = 'todos';
    this.itemsVeterinarioFiltrados = [...this.itemsVeterinario];
  }

  get totalItemsVet(): number {
    return this.itemsVeterinario.length;
  }

  get totalUnidadesEntregadasVet(): number {
    return this.itemsVeterinario.reduce((acc, curr) => acc + (Number(curr.cantidadEntregada) || 0), 0);
  }

  get totalUnidadesConsumidasVet(): number {
    return this.itemsVeterinario.reduce((acc, curr) => acc + (Number(curr.cantidadConsumida) || 0), 0);
  }

  get totalSaldoDisponibleVet(): number {
    return this.itemsVeterinario.reduce((acc, curr) => acc + (Number(curr.saldoDisponible) || 0), 0);
  }

  get totalBajoStockVet(): number {
    return this.itemsVeterinario.filter(i => i.saldoDisponible > 0 && i.saldoDisponible <= 10).length;
  }

  // =========================================================================
  // HU 3: GENERAR REPORTE EN PDF O EXCEL DEL INVENTARIO GENERAL CBA
  // =========================================================================

  exportarGeneralExcel(): void {
    if (this.filas.length === 0) {
      Swal.fire('Sin datos', 'No hay registros en el inventario general para exportar.', 'info');
      return;
    }

    const encabezados = [
      'ID Inventario',
      'Detalle Compra',
      'Medicamento',
      'Descripción / Presentación',
      'Tipo',
      'Cantidad Actual',
      'Entradas Compra',
      'Consumidas / Salidas',
      'Fecha Vencimiento',
      'Estado',
      'Proveedor',
      'Facturas'
    ];

    const filasCsv = this.filas.map((f) => [
      `"${f.idInv ?? ''}"`,
      `"${f.idDetComp ?? ''}"`,
      `"${(f.nombre || '').replace(/"/g, '""')}"`,
      `"${(f.descripcion || '').replace(/"/g, '""')}"`,
      `"${f.tipo || ''}"`,
      f.sinLote ? 0 : f.stock,
      f.cantidadEntrada || 0,
      f.consumidas || 0,
      `"${f.vencimiento || 'N/A'}"`,
      `"${f.estadoDb || f.estado || ''}"`,
      `"${(f.proveedor || '').replace(/"/g, '""')}"`,
      `"${(f.facturaTexto || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [encabezados.join(';'), ...filasCsv.map(e => e.join(';'))].join('\r\n');
    this.descargarArchivo(csvContent, `Inventario_General_CBA_${this.formatoFechaArchivo()}.csv`, 'text/csv;charset=utf-8;');

    Swal.fire({
      icon: 'success',
      title: 'Reporte Excel Generado',
      text: 'El archivo Excel/CSV del inventario general se descargó correctamente.',
      timer: 2000,
      showConfirmButton: false
    });
  }

  exportarGeneralPDF(): void {
    if (this.filas.length === 0) {
      Swal.fire('Sin datos', 'No hay registros en el inventario general para exportar.', 'info');
      return;
    }

    const fechaActual = new Date().toLocaleString('es-CO');
    const filasHtml = this.filas.map((f, i) => `
      <tr style="border-bottom: 1px solid #e5e7eb; ${i % 2 === 0 ? 'background-color: #fafafa;' : ''}">
        <td style="padding: 8px 10px; font-weight: bold; color: #170B3D;">#${f.idInv || '—'}</td>
        <td style="padding: 8px 10px;">
          <strong style="color: #170B3D;">${f.nombre}</strong><br>
          <span style="font-size: 11px; color: #6b7280;">${f.descripcion || ''}</span>
        </td>
        <td style="padding: 8px 10px; text-align: center; font-weight: bold; color: #170B3D;">${f.sinLote ? '0' : f.stock} uds</td>
        <td style="padding: 8px 10px; text-align: center;">${f.cantidadEntrada} uds</td>
        <td style="padding: 8px 10px; text-align: center; color: #4b5563;">${f.vencimiento || '—'}</td>
        <td style="padding: 8px 10px; text-align: center;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold; ${
            f.estado === 'disponible' ? 'background: rgba(65,65,165,0.1); color: #4141a5;' :
            f.estado === 'bajo' ? 'background: rgba(241,198,60,0.25); color: #170B3D;' :
            f.estado === 'agotado' ? 'background: #e2e8f0; color: #334155;' : 'background: #f1f5f9; color: #64748b;'
          }">
            ${f.estadoDb || f.estado}
          </span>
        </td>
        <td style="padding: 8px 10px; font-size: 11px; color: #4b5563;">${f.proveedor || '—'}</td>
        <td style="padding: 8px 10px; font-size: 11px; color: #4b5563;">${f.facturaTexto || '—'}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Reporte Oficial - Inventario General CBA</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: 'Nunito', Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; font-size: 12px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #4141a5; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { margin: 0; color: #170B3D; font-size: 20px; text-transform: uppercase; }
          .header p { margin: 3px 0 0; color: #64748b; font-size: 12px; }
          .kpis { display: flex; gap: 15px; margin-bottom: 20px; }
          .kpi-card { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; background: #f8fafc; }
          .kpi-card .lbl { font-size: 10px; text-transform: uppercase; font-weight: bold; color: #64748b; }
          .kpi-card .val { font-size: 18px; font-weight: 800; color: #4141a5; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background-color: #4141a5; color: #ffffff; text-align: left; padding: 9px 10px; font-size: 11px; text-transform: uppercase; }
          .footer { margin-top: 25px; padding-top: 12px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Centro de Bienestar Animal (CBA)</h1>
            <p><strong>Reporte de Control y Existencias de Medicamentos (Inventario General)</strong></p>
            <p>Emitido para: Área Jurídica / Gestión de Suministros</p>
          </div>
          <div style="text-align: right;">
            <p><strong>Fecha de corte:</strong> ${fechaActual}</p>
            <p>Total registros: <strong>${this.totalRef}</strong> | Total unidades: <strong>${this.totalUnd}</strong></p>
          </div>
        </div>

        <div class="kpis">
          <div class="kpi-card"><div class="lbl">Registros CBA</div><div class="val">${this.totalRef}</div></div>
          <div class="kpi-card"><div class="lbl">Unidades Actuales</div><div class="val">${this.totalUnd}</div></div>
          <div class="kpi-card"><div class="lbl">Disponibles</div><div class="val" style="color: #4141a5;">${this.totalDisp}</div></div>
          <div class="kpi-card"><div class="lbl">Stock Bajo (&le;10)</div><div class="val" style="color: #170B3D;">${this.totalBajo}</div></div>
          <div class="kpi-card"><div class="lbl">Agotados</div><div class="val" style="color: #64748b;">${this.totalAgot}</div></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 80px;">ID Inv.</th>
              <th>Medicamento / Descripción</th>
              <th style="text-align: center; width: 90px;">Stock CBA</th>
              <th style="text-align: center; width: 90px;">Entradas</th>
              <th style="text-align: center; width: 90px;">Vencimiento</th>
              <th style="text-align: center; width: 100px;">Estado</th>
              <th>Proveedor</th>
              <th style="width: 80px;">Factura</th>
            </tr>
          </thead>
          <tbody>
            ${filasHtml}
          </tbody>
        </table>

        <div class="footer">
          <span>Sistema Integrado Vetericano CBA · Módulo Jurídico</span>
          <span>Página 1 de 1 · Documento oficial de inventario</span>
        </div>
      </body>
      </html>
    `;

    this.abrirVentanaImpresion(html);
  }

  // =========================================================================
  // HU 4: GENERAR REPORTE EN PDF O EXCEL DEL INVENTARIO POR VETERINARIO CBA
  // =========================================================================

  exportarVeterinarioExcel(): void {
    if (this.itemsVeterinarioFiltrados.length === 0) {
      Swal.fire('Sin datos', 'No hay medicamentos asignados en este veterinario para exportar.', 'info');
      return;
    }

    const nombreVet = this.veterinarioSeleccionado?.nombre || this.veterinarioSeleccionado?.username || 'Veterinario';
    const encabezados = [
      'ID Medicamento',
      'Nombre Medicamento',
      'Tipo / Clasificación',
      'Presentación',
      'Cantidad Entregada (Dotación)',
      'Cantidad Consumida',
      'Saldo Disponible Actual',
      'Alerta Stock Bajo'
    ];

    const filasCsv = this.itemsVeterinarioFiltrados.map((item) => [
      item.id_medicamento,
      `"${(item.nombre || '').replace(/"/g, '""')}"`,
      `"${item.tipo || 'General'}"`,
      `"${(item.presentacion || '').replace(/"/g, '""')}"`,
      item.cantidadEntregada || 0,
      item.cantidadConsumida || 0,
      item.saldoDisponible || 0,
      item.saldoDisponible <= 10 ? 'SÍ (Bajo)' : 'NO'
    ]);

    const csvContent = '\uFEFF' + [
      `"Reporte de Inventario por Veterinario: ${nombreVet}"`,
      `"Fecha de generación: ${new Date().toLocaleString('es-CO')}"`,
      '',
      encabezados.join(';'),
      ...filasCsv.map(e => e.join(';'))
    ].join('\r\n');

    this.descargarArchivo(csvContent, `Inventario_Vet_${nombreVet.replace(/\s+/g, '_')}_${this.formatoFechaArchivo()}.csv`, 'text/csv;charset=utf-8;');

    Swal.fire({
      icon: 'success',
      title: 'Reporte Excel Generado',
      text: `Inventario del Dr.(a) ${nombreVet} descargado correctamente.`,
      timer: 2000,
      showConfirmButton: false
    });
  }

  exportarVeterinarioPDF(): void {
    if (this.itemsVeterinarioFiltrados.length === 0) {
      Swal.fire('Sin datos', 'No hay medicamentos asignados en este veterinario para exportar.', 'info');
      return;
    }

    const nombreVet = this.veterinarioSeleccionado?.nombre || this.veterinarioSeleccionado?.username || 'Médico Veterinario';
    const emailVet = this.veterinarioSeleccionado?.email || this.veterinarioSeleccionado?.correo || 'No especificado';
    const fechaActual = new Date().toLocaleString('es-CO');

    const filasHtml = this.itemsVeterinarioFiltrados.map((item, i) => `
      <tr style="border-bottom: 1px solid #e5e7eb; ${i % 2 === 0 ? 'background-color: #fafafa;' : ''}">
        <td style="padding: 8px 10px; font-weight: bold; color: #170B3D;">#${item.id_medicamento}</td>
        <td style="padding: 8px 10px;">
          <strong style="color: #170B3D;">${item.nombre}</strong><br>
          <span style="font-size: 11px; color: #6b7280;">${item.presentacion || item.tipo || ''}</span>
        </td>
        <td style="padding: 8px 10px; text-align: center; color: #4b5563;">${item.tipo || 'General'}</td>
        <td style="padding: 8px 10px; text-align: center; font-weight: bold; color: #475569;">${item.cantidadEntregada || 0} uds</td>
        <td style="padding: 8px 10px; text-align: center; font-weight: bold; color: #170B3D;">${item.cantidadConsumida || 0} uds</td>
        <td style="padding: 8px 10px; text-align: center; font-weight: 800; font-size: 13px; color: #4141a5;">
          ${item.saldoDisponible || 0} uds
        </td>
        <td style="padding: 8px 10px; text-align: center;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold; ${
            item.saldoDisponible <= 0 ? 'background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;' :
            item.saldoDisponible <= 10 ? 'background: rgba(241,198,60,0.25); color: #170B3D; border: 1px solid #F1C63C;' : 'background: rgba(65,65,165,0.1); color: #4141a5; border: 1px solid rgba(65,65,165,0.2);'
          }">
            ${item.saldoDisponible <= 0 ? 'Agotado' : item.saldoDisponible <= 10 ? 'Stock Bajo' : 'Disponible'}
          </span>
        </td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Reporte Maletín Veterinario - CBA</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          body { font-family: 'Nunito', Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; font-size: 12px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #4141a5; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { margin: 0; color: #170B3D; font-size: 18px; text-transform: uppercase; }
          .header p { margin: 3px 0 0; color: #64748b; font-size: 12px; }
          .vet-info { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin-bottom: 18px; }
          .kpis { display: flex; gap: 10px; margin-bottom: 18px; }
          .kpi-card { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; background: #ffffff; text-align: center; }
          .kpi-card .lbl { font-size: 10px; text-transform: uppercase; font-weight: bold; color: #64748b; }
          .kpi-card .val { font-size: 16px; font-weight: 800; color: #4141a5; margin-top: 3px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background-color: #4141a5; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; }
          .sign-area { margin-top: 45px; display: flex; justify-content: space-between; gap: 40px; }
          .sign-box { flex: 1; border-top: 1px solid #64748b; text-align: center; padding-top: 6px; font-size: 11px; color: #475569; }
          .footer { margin-top: 25px; padding-top: 12px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Centro de Bienestar Animal (CBA)</h1>
            <p><strong>Acta y Balance de Insumos / Maletín por Veterinario</strong></p>
            <p>Área Jurídica y Control de Suministros</p>
          </div>
          <div style="text-align: right;">
            <p><strong>Fecha de emisión:</strong> ${fechaActual}</p>
          </div>
        </div>

        <div class="vet-info">
          <p style="margin: 0 0 4px;"><strong>Profesional a Cargo:</strong> ${nombreVet}</p>
          <p style="margin: 0; color: #64748b;"><strong>Contacto institucional:</strong> ${emailVet} | <strong>ID Profesional:</strong> #${this.idVeterinarioSeleccionado}</p>
        </div>

        <div class="kpis">
          <div class="kpi-card"><div class="lbl">Medicamentos Asignados</div><div class="val">${this.totalItemsVet}</div></div>
          <div class="kpi-card"><div class="lbl">Total Entregado</div><div class="val">${this.totalUnidadesEntregadasVet} uds</div></div>
          <div class="kpi-card"><div class="lbl">Total Consumido</div><div class="val" style="color: #170B3D;">${this.totalUnidadesConsumidasVet} uds</div></div>
          <div class="kpi-card"><div class="lbl">Saldo Disponible</div><div class="val" style="color: #4141a5;">${this.totalSaldoDisponibleVet} uds</div></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 70px;">ID Med.</th>
              <th>Medicamento</th>
              <th style="text-align: center;">Tipo</th>
              <th style="text-align: center;">Dotación</th>
              <th style="text-align: center;">Consumido</th>
              <th style="text-align: center;">Saldo Actual</th>
              <th style="text-align: center;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${filasHtml}
          </tbody>
        </table>

        <div class="sign-area">
          <div class="sign-box">
            Firma Médico Veterinario Receptor<br>
            <strong>${nombreVet}</strong>
          </div>
          <div class="sign-box">
            Firma Responsable Jurídico / CBA<br>
            <strong>Control y Gestión de Suministros</strong>
          </div>
        </div>

        <div class="footer">
          <span>Sistema Integrado Vetericano CBA · Módulo Jurídico</span>
          <span>Reporte emitido con fines de fiscalización y trazabilidad</span>
        </div>
      </body>
      </html>
    `;

    this.abrirVentanaImpresion(html);
  }

  // --- MÉTODOS AUXILIARES DE EXPORTACIÓN Y DESCARGA ---

  private descargarArchivo(contenido: string, nombreArchivo: string, tipoMime: string): void {
    const blob = new Blob([contenido], { type: tipoMime });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  private abrirVentanaImpresion(html: string): void {
    const ventana = window.open('', '_blank', 'width=1000,height=800');
    if (!ventana) {
      Swal.fire('Bloqueo de Pop-ups', 'Por favor habilita las ventanas emergentes en tu navegador para ver y guardar el reporte en PDF.', 'warning');
      return;
    }
    ventana.document.write(html);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => {
      ventana.print();
    }, 400);
  }

  private formatoFechaArchivo(): string {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  }
}
