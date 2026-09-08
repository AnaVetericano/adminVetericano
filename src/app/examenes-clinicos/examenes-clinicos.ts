import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService, ProcedimientoCatalogo } from '../services/auth';

@Component({
  selector: 'app-examenes-clinicos',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './examenes-clinicos.html',
  styleUrl: './examenes-clinicos.css',
})
export class ExamenesClinicos implements OnInit {
  listaCatalogo: ProcedimientoCatalogo[] = [];
  cargando: boolean = true; // Controla el estado de carga

  constructor(
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef // Inyectamos el detector de cambios
  ) {
    // Refresca automáticamente al navegar a esta ruta
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.cargarCatalogo();
    });
  }

  ngOnInit(): void {
    this.cargarCatalogo();
  }

  cargarCatalogo() {
    this.cargando = true;
    this.authService.getCatalogo().subscribe({
      next: (data: ProcedimientoCatalogo[]) => {
        this.listaCatalogo = data || [];
        this.cargando = false;
        this.cdr.detectChanges(); // Forzamos a Angular a pintar los datos inmediatamente
      },
      error: (err: any) => {
        console.error('Error al cargar el catálogo:', err);
        this.listaCatalogo = [];
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  eliminarExamen(id?: number) {
    if (!id) return;
    if (confirm('¿Estás seguro de que deseas eliminar este examen?')) {
      this.authService.eliminarCatalogo(id).subscribe({
        next: () => {
          this.cargarCatalogo();
        },
        error: (err: any) => {
          console.error('Error al eliminar:', err);
        }
      });
    }
  }

  ediex() {
    this.router.navigate(['/editar-examen']);
  }

  irACrearExamen() {
    this.router.navigate(['/inicio-admin/examen-clinico']);
  }
}