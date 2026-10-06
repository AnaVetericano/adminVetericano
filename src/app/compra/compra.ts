import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import Swal from 'sweetalert2';
import {
  ComprasService,
  Compra as CompraModel,
  Proveedor,
  MedicamentoItem,
  DetalleRegistroFila,
  DetalleCompraConMedicamento
} from '../services/compras.service';

@Component({
  selector: 'app-compra',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './compra.html',
  styleUrl: './compra.css',
})
export class Compra implements OnInit {
  // Estados de datos
  compras: CompraModel[] = [];
  comprasOriginales: CompraModel[] = [];
  proveedores: Proveedor[] = [];
  medicamentos: MedicamentoItem[] = [];
  cargando: boolean = true;
  guardando: boolean = false;

  // Filtros
  filtroBusqueda: string = '';
  proveedorFiltroId: number | null = null;

  // Modal de Registro / Edición
  modalRegistroAbierto: boolean = false;
  editandoId: number | null = null;
  detallesOriginalesIds: number[] = [];
  idProveedorSeleccionado: number | null = null;
  fechaRegistro: string = '';
  filasDetalle: DetalleRegistroFila[] = [];

  // Modal de Detalle
  modalDetalleAbierto: boolean = false;
  compraSeleccionada: CompraModel | null = null;

  constructor(
    private comprasService: ComprasService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.obtenerDatos();
  }

  /**
   * Carga en paralelo compras, detalles, medicamentos_medicamento y proveedores
   */
  obtenerDatos(): void {
    this.cargando = true;

    forkJoin({
      proveedores: this.comprasService.listarProveedores().pipe(catchError(() => of([]))),
      medicamentos: this.comprasService.listarMedicamentos().pipe(catchError(() => of([]))),
      catalogo: this.comprasService.listarMedicamentosCatalogo().pipe(catchError(() => of([]))),
      detalles: this.comprasService.listarDetallesCompra().pipe(catchError(() => of([]))),
      compras: this.comprasService.listarCompras().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ proveedores, medicamentos, catalogo, detalles, compras }) => {
        this.proveedores = proveedores;
        this.medicamentos = medicamentos;
        this.procesarCompras(compras, detalles, catalogo);
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al sincronizar datos del módulo de compras:', err);
        this.cargando = false;
        this.cdr.detectChanges();
        Swal.fire({
          title: 'Error de conexión',
          text: 'No se pudieron cargar los datos de compras e inventario.',
          icon: 'error',
          confirmButtonColor: '#d33'
        });
      }
    });
  }

  /**
   * Vincula las compras con sus respectivos proveedores y detalles de medicamentos_medicamento
   */
  private procesarCompras(comprasRaw: any[], detallesRaw: any[], catalogoRaw: any[] = []): void {
    const provMap = new Map<number, Proveedor>();
    this.proveedores.forEach((p) => {
      const id = p.id_proveedor ?? (p as any).id;
      if (id !== undefined) provMap.set(Number(id), p);
    });

    const medMap = new Map<number, MedicamentoItem>();
    this.medicamentos.forEach((m) => {
      const id = m.id ?? m.id_medicamento;
      if (id !== undefined) medMap.set(Number(id), m);
    });

    const catalogoMap = new Map<number, any>();
    catalogoRaw.forEach((c) => {
      const idCat = c.id_medicamento ?? c.id;
      if (idCat !== undefined) catalogoMap.set(Number(idCat), c);
    });

    const detallesPorCompra = new Map<number, DetalleCompraConMedicamento[]>();
    detallesRaw.forEach((d) => {
      const idCompra = Number(d.id_compra);
      if (!detallesPorCompra.has(idCompra)) {
        detallesPorCompra.set(idCompra, []);
      }
      const idMed = Number(d.id_medicamento);

      // 1. Buscar primero en la lista de medicamentos_medicamento
      let med = medMap.get(idMed);

      // 2. Si no coincide por ID directo (por ejemplo, si el detalle apunta a un ID del catálogo antiguo),
      // buscar por nombre en el catálogo y cruzar con medicamentos_medicamento
      if (!med) {
        const catItem = catalogoMap.get(idMed);
        if (catItem?.nombre) {
          const nombreCat = catItem.nombre.toLowerCase().trim();
          med = this.medicamentos.find(m => m.nombre && m.nombre.toLowerCase().trim() === nombreCat);
          if (!med) {
            med = {
              id: idMed,
              id_medicamento: idMed,
              nombre: catItem.nombre,
              tipo: catItem.tipo || 'General',
              cantidad_ml: catItem.cantidad_ml || '',
              activo: catItem.activo !== false
            };
          }
        }
      }

      const subtotal = (Number(d.cantidad) || 0) * (Number(d.precio_unitario) || 0);

      detallesPorCompra.get(idCompra)!.push({
        ...d,
        medicamento: med,
        subtotal
      });
    });

    const resultado: CompraModel[] = comprasRaw.map((c) => {
      const idComp = Number(c.id_compra ?? c.id);
      const prov = provMap.get(Number(c.id_proveedor));
      const dets = detallesPorCompra.get(idComp) || [];
      const total = dets.reduce((sum, item) => sum + (item.subtotal || 0), 0);
      const totalUnidades = dets.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);
      const totalItems = dets.length;

      return {
        ...c,
        id_compra: idComp,
        id_proveedor: Number(c.id_proveedor),
        proveedor: prov,
        detalles: dets,
        total,
        totalItems,
        totalUnidades
      };
    });

    // Ordenar de más reciente a más antigua
    resultado.sort((a, b) => {
      if (a.fecha && b.fecha) {
        return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      }
      return (b.id_compra || 0) - (a.id_compra || 0);
    });

    this.compras = resultado;
    this.comprasOriginales = [...resultado];
    this.filtrarCompras();
  }

  /**
   * Filtrar compras por búsqueda de texto y/o proveedor
   */
  filtrarCompras(): void {
    const termino = this.filtroBusqueda.toLowerCase().trim();

    this.compras = this.comprasOriginales.filter((c) => {
      const cumpleProveedor = this.proveedorFiltroId === null || c.id_proveedor === this.proveedorFiltroId;
      if (!cumpleProveedor) return false;

      if (!termino) return true;

      const idStr = String(c.id_compra || '');
      const provNombre = (c.proveedor?.nombre || '').toLowerCase();
      const fechaStr = c.fecha ? new Date(c.fecha).toLocaleDateString() : '';

      const coincideMedicamento = c.detalles?.some((d) =>
        (d.medicamento?.nombre || '').toLowerCase().includes(termino)
      );

      return (
        idStr.includes(termino) ||
        provNombre.includes(termino) ||
        fechaStr.includes(termino) ||
        coincideMedicamento
      );
    });
  }

  limpiarFiltros(): void {
    this.filtroBusqueda = '';
    this.proveedorFiltroId = null;
    this.compras = [...this.comprasOriginales];
  }

  // --- Métricas acumuladas ---

  get totalInversion(): number {
    return this.compras.reduce((sum, c) => sum + (c.total || 0), 0);
  }

  get totalUnidadesCompradas(): number {
    return this.compras.reduce((sum, c) => sum + (c.totalUnidades || 0), 0);
  }

  // --- Modal de Registro y Edición (Tabla Dinámica) ---

  abrirModalCrear(): void {
    if (this.medicamentos.length === 0 || this.proveedores.length === 0) {
      this.obtenerDatos();
    }

    this.editandoId = null;
    this.detallesOriginalesIds = [];
    this.idProveedorSeleccionado = null;
    this.guardando = false;

    // Inicializar con la fecha local actual
    const ahora = new Date();
    ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
    this.fechaRegistro = ahora.toISOString().slice(0, 16);

    this.filasDetalle = [
      { id_detalle_compra: null, id_medicamento: null, cantidad: 1, precio_unitario: null, subtotal: 0 }
    ];

    this.modalRegistroAbierto = true;
  }

  abrirModalEditar(compra: CompraModel): void {
    if (this.medicamentos.length === 0 || this.proveedores.length === 0) {
      this.obtenerDatos();
    }

    this.editandoId = compra.id_compra ?? null;
    this.idProveedorSeleccionado = compra.id_proveedor;
    this.guardando = false;

    if (compra.fecha) {
      const fechaObj = new Date(compra.fecha);
      if (!isNaN(fechaObj.getTime())) {
        fechaObj.setMinutes(fechaObj.getMinutes() - fechaObj.getTimezoneOffset());
        this.fechaRegistro = fechaObj.toISOString().slice(0, 16);
      }
    }

    // Guardar IDs originales para sincronizar eliminaciones
    this.detallesOriginalesIds = (compra.detalles || [])
      .map(d => d.id_detalle_compra)
      .filter((id): id is number => typeof id === 'number');

    // Mapear los detalles existentes en las filas dinámicas
    if (compra.detalles && compra.detalles.length > 0) {
      this.filasDetalle = compra.detalles.map(d => {
        const idMedMedicamento = d.medicamento
          ? Number(d.medicamento.id ?? d.medicamento.id_medicamento ?? d.id_medicamento)
          : Number(d.id_medicamento);

        return {
          id_detalle_compra: d.id_detalle_compra,
          id_medicamento: idMedMedicamento,
          cantidad: d.cantidad,
          precio_unitario: Number(d.precio_unitario),
          subtotal: (Number(d.cantidad) || 0) * (Number(d.precio_unitario) || 0)
        };
      });
    } else {
      this.filasDetalle = [
        { id_detalle_compra: null, id_medicamento: null, cantidad: 1, precio_unitario: null, subtotal: 0 }
      ];
    }

    this.modalRegistroAbierto = true;
  }

  cerrarModalRegistro(): void {
    this.modalRegistroAbierto = false;
    this.editandoId = null;
    this.detallesOriginalesIds = [];
    this.guardando = false;
  }

  agregarFilaDetalle(): void {
    this.filasDetalle.push({
      id_detalle_compra: null,
      id_medicamento: null,
      cantidad: 1,
      precio_unitario: null,
      subtotal: 0
    });
  }

  eliminarFilaDetalle(index: number): void {
    if (this.filasDetalle.length <= 1) {
      Swal.fire({
        title: 'Mínimo de detalle',
        text: 'La factura debe tener al menos un medicamento registrado.',
        icon: 'info',
        confirmButtonColor: '#4141A5'
      });
      return;
    }
    this.filasDetalle.splice(index, 1);
  }

  actualizarSubtotalFila(fila: DetalleRegistroFila): void {
    const cant = Number(fila.cantidad) || 0;
    const precio = Number(fila.precio_unitario) || 0;
    fila.subtotal = Math.max(0, cant * precio);
  }

  calcularTotalFactura(): number {
    return this.filasDetalle.reduce((sum, f) => sum + (f.subtotal || 0), 0);
  }

  calcularTotalUnidadesFactura(): number {
    return this.filasDetalle.reduce((sum, f) => sum + (Number(f.cantidad) || 0), 0);
  }

  guardarCompra(): void {
    if (!this.idProveedorSeleccionado) {
      Swal.fire({
        title: 'Campo obligatorio',
        text: 'Debes seleccionar el proveedor emisor de la factura.',
        icon: 'warning',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    if (!this.filasDetalle || this.filasDetalle.length === 0) {
      Swal.fire({
        title: 'Detalles requeridos',
        text: 'Debes agregar al menos un medicamento a la factura.',
        icon: 'warning',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    // Validar cada fila de la tabla dinámica
    const medicamentosSeleccionados = new Set<number>();

    for (let i = 0; i < this.filasDetalle.length; i++) {
      const fila = this.filasDetalle[i];
      const numFila = i + 1;

      if (!fila.id_medicamento) {
        Swal.fire({
          title: 'Medicamento requerido',
          text: `En la fila #${numFila} debes seleccionar un medicamento del catálogo.`,
          icon: 'warning',
          confirmButtonColor: '#4141A5'
        });
        return;
      }

      const idMed = Number(fila.id_medicamento);
      if (medicamentosSeleccionados.has(idMed)) {
        Swal.fire({
          title: 'Medicamento repetido',
          text: `El medicamento de la fila #${numFila} ya está en la lista. Agrupa la cantidad en una sola fila.`,
          icon: 'warning',
          confirmButtonColor: '#4141A5'
        });
        return;
      }
      medicamentosSeleccionados.add(idMed);

      const cantidad = Number(fila.cantidad);
      if (!fila.cantidad || isNaN(cantidad) || cantidad <= 0 || !Number.isInteger(cantidad)) {
        Swal.fire({
          title: 'Cantidad inválida',
          text: `En la fila #${numFila} la cantidad debe ser un número entero mayor a 0.`,
          icon: 'warning',
          confirmButtonColor: '#4141A5'
        });
        return;
      }

      const precio = Number(fila.precio_unitario);
      if (fila.precio_unitario === null || fila.precio_unitario === undefined || isNaN(precio) || precio <= 0) {
        Swal.fire({
          title: 'Precio inválido',
          text: `En la fila #${numFila} el precio unitario debe ser mayor a 0.`,
          icon: 'warning',
          confirmButtonColor: '#4141A5'
        });
        return;
      }
    }

    this.guardando = true;

    // Modo 1: ACTUALIZACIÓN
    if (this.editandoId !== null) {
      this.comprasService.actualizarCompraCompleta(
        this.editandoId,
        Number(this.idProveedorSeleccionado),
        this.filasDetalle,
        this.detallesOriginalesIds,
        this.medicamentos
      ).subscribe({
        next: () => {
          this.guardando = false;
          const idEditado = this.editandoId;
          this.cerrarModalRegistro();

          Swal.fire({
            title: '¡Compra Actualizada!',
            text: `Factura #${idEditado} y sus medicamentos fueron actualizados con éxito.`,
            icon: 'success',
            confirmButtonColor: '#4141A5',
            timer: 2300
          });

          this.obtenerDatos();
        },
        error: (err) => {
          this.guardando = false;
          console.error('Error al actualizar la compra:', err);
          const msj = this.extraerMensajeError(err, 'No se pudo actualizar la compra.');
          Swal.fire({
            title: 'Error al actualizar',
            text: msj,
            icon: 'error',
            confirmButtonColor: '#d33'
          });
        }
      });
      return;
    }

    // Modo 2: CREACIÓN
    const payloadDetalles = this.filasDetalle.map((f) => ({
      id_medicamento: Number(f.id_medicamento),
      cantidad: Number(f.cantidad),
      precio_unitario: Number(f.precio_unitario)
    }));

    this.comprasService
      .registrarCompraCompleta(Number(this.idProveedorSeleccionado), payloadDetalles, this.medicamentos)
      .subscribe({
        next: (resultado) => {
          this.guardando = false;
          this.cerrarModalRegistro();

          Swal.fire({
            title: '¡Compra Registrada!',
            text: `Factura #${resultado.compra.id_compra} guardada con éxito con ${payloadDetalles.length} detalle(s).`,
            icon: 'success',
            confirmButtonColor: '#4141A5',
            timer: 2300
          });

          this.obtenerDatos();
        },
        error: (err) => {
          this.guardando = false;
          console.error('Error al registrar la compra:', err);
          const msj = this.extraerMensajeError(err, 'No se pudo guardar la compra en el servidor.');
          Swal.fire({
            title: 'Error al registrar',
            text: msj,
            icon: 'error',
            confirmButtonColor: '#d33'
          });
        }
      });
  }

  private extraerMensajeError(err: any, mensajePorDefecto: string): string {
    if (!err?.error) return mensajePorDefecto;
    if (typeof err.error === 'string') return err.error;
    if (err.error.detail) return err.error.detail;
    if (typeof err.error === 'object') {
      const primerCampo = Object.keys(err.error)[0];
      const valor = err.error[primerCampo];
      return `${primerCampo}: ${Array.isArray(valor) ? valor.join(' ') : valor}`;
    }
    return mensajePorDefecto;
  }

  // --- Modal de Detalle de Factura ---

  abrirModalDetalle(compra: CompraModel): void {
    this.compraSeleccionada = compra;
    this.modalDetalleAbierto = true;
  }

  cerrarModalDetalle(): void {
    this.modalDetalleAbierto = false;
    this.compraSeleccionada = null;
  }

  imprimirFactura(): void {
    window.print();
  }

  // --- Eliminar Compra Segura ---

  eliminarCompra(c: CompraModel): void {
    const idCompra = c.id_compra;
    if (!idCompra) return;

    const detallesIds = (c.detalles || [])
      .map((d) => d.id_detalle_compra)
      .filter((id): id is number => typeof id === 'number');

    Swal.fire({
      title: `¿Eliminar Compra #${idCompra}?`,
      text: `Se desvinculará del inventario y se eliminará la compra junto con sus ${detallesIds.length} medicamentos detallados.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((resultado) => {
      if (!resultado.isConfirmed) return;

      this.comprasService.eliminarCompraConDetalles(idCompra, detallesIds).subscribe({
        next: () => {
          Swal.fire({
            title: '¡Eliminada!',
            text: `La compra #${idCompra} fue eliminada correctamente.`,
            icon: 'success',
            timer: 1800,
            showConfirmButton: false
          });
          this.obtenerDatos();
        },
        error: (err) => {
          console.error('Error al eliminar compra:', err);
          const msj = err?.error?.detail || 'No se pudo eliminar la compra.';
          Swal.fire({
            title: 'Error',
            text: msj,
            icon: 'error',
            confirmButtonColor: '#d33'
          });
        }
      });
    });
  }

  // --- Helpers de Formato e Identificación ---

  getNombreMedicamento(idMed: number): string {
    const med = this.medicamentos.find((m) => Number(m.id ?? m.id_medicamento) === Number(idMed));
    if (!med) return `Medicamento #${idMed}`;
    const detalles: string[] = [];
    if (med.tipo) detalles.push(med.tipo);
    if (med.cantidad_ml && med.cantidad_ml !== 'N/A') detalles.push(`${med.cantidad_ml}`);
    else if (med.presentacion) detalles.push(med.presentacion);
    const extras = detalles.join(' • ');
    return extras ? `${med.nombre} (${extras})` : med.nombre;
  }

  getNombreProveedor(idProv: number): string {
    const prov = this.proveedores.find((p) => (p.id_proveedor ?? (p as any).id) === idProv);
    return prov?.nombre || `Proveedor #${idProv}`;
  }

  getIdProveedor(p: any): number {
    return p?.id_proveedor ?? p?.id ?? 0;
  }

  getIdMedicamento(m: any): number {
    return Number(m?.id ?? m?.id_medicamento ?? 0);
  }
}
