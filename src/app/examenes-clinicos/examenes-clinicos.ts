import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ExamenesClinicosService,
  ExamenClinico,
  RespuestaPaginadaExamenes
} from '../services/examenes-clinicos.service';

@Component({
  selector: 'app-examenes-clinicos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './examenes-clinicos.html',
  styleUrl: './examenes-clinicos.css',
})
export class ExamenesClinicos implements OnInit {
  // Catálogo completo y catálogo filtrado
  listaCatalogo: ExamenClinico[] = [];
  listaFiltrada: ExamenClinico[] = [];
  
  // Estado de carga y búsqueda
  cargando: boolean = true;
  filtroBusqueda: string = '';

  // Control de paginación (Criterio 1)
  paginaActual: number = 1;
  tamanoPagina: number = 6;
  totalRegistros: number = 0;
  totalPaginas: number = 1;

  constructor(
    private examenesService: ExamenesClinicosService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarCatalogo();
  }

  /**
   * Criterio 1: Carga los datos del catálogo consumiendo el servicio adaptado al backend
   */
  cargarCatalogo(): void {
    this.cargando = true;
    this.examenesService.obtenerTodos().subscribe({
      next: (data: ExamenClinico[]) => {
        this.listaCatalogo = data || [];
        this.filtrarExamenes();
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error al cargar catálogo de exámenes clínicos:', err);
        this.listaCatalogo = [];
        this.listaFiltrada = [];
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Criterio 2: Búsqueda reactiva por nombre de examen clínico
   */
  filtrarExamenes(): void {
    const texto = (this.filtroBusqueda || '').toLowerCase().trim();
    if (!texto) {
      this.listaFiltrada = [...this.listaCatalogo];
    } else {
      this.listaFiltrada = this.listaCatalogo.filter(item =>
        (item.nombre && item.nombre.toLowerCase().includes(texto)) ||
        (item.nombre_tipo && item.nombre_tipo.toLowerCase().includes(texto)) ||
        (item.descripcion && item.descripcion.toLowerCase().includes(texto))
      );
    }

    // Actualiza métricas de paginación y regresa a la primera página
    this.totalRegistros = this.listaFiltrada.length;
    this.totalPaginas = Math.ceil(this.totalRegistros / this.tamanoPagina) || 1;
    this.paginaActual = 1;
  }

  /**
   * Limpia el campo de búsqueda y restablece el catálogo completo
   */
  limpiarBusqueda(): void {
    this.filtroBusqueda = '';
    this.filtrarExamenes();
  }

  // =========================================================================
  // CONTROL DE PAGINACIÓN (Criterio 1)
  // =========================================================================

  /**
   * Obtiene la porción de exámenes correspondientes a la página activa
   */
  get examenesPaginados(): ExamenClinico[] {
    const inicio = (this.paginaActual - 1) * this.tamanoPagina;
    const fin = inicio + this.tamanoPagina;
    return this.listaFiltrada.slice(inicio, fin);
  }

  cambiarPagina(nuevaPagina: number): void {
    if (nuevaPagina >= 1 && nuevaPagina <= this.totalPaginas) {
      this.paginaActual = nuevaPagina;
    }
  }

  paginaAnterior(): void {
    if (this.paginaActual > 1) {
      this.paginaActual--;
    }
  }

  paginaSiguiente(): void {
    if (this.paginaActual < this.totalPaginas) {
      this.paginaActual++;
    }
  }

  get paginasDisponibles(): number[] {
    const paginas: number[] = [];
    for (let i = 1; i <= this.totalPaginas; i++) {
      paginas.push(i);
    }
    return paginas;
  }

  get indiceInicio(): number {
    if (this.totalRegistros === 0) return 0;
    return (this.paginaActual - 1) * this.tamanoPagina + 1;
  }

  get indiceFin(): number {
    return Math.min(this.paginaActual * this.tamanoPagina, this.totalRegistros);
  }
}