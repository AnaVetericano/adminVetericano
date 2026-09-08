import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-examenes-clinicos',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './examenes-clinicos.html',
  styleUrl: './examenes-clinicos.css',
})
export class ExamenesClinicos implements OnInit {
  listaCatalogo: any[] = [];

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarCatalogo();
  }

  cargarCatalogo() {
    this.authService.getCatalogo().subscribe({
      next: (data) => {
        this.listaCatalogo = data;
      },
      error: (err: any) => {
        console.error('Error al cargar el catálogo:', err);
      }
    });
  }

  eliminarExamen(id: number) {
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