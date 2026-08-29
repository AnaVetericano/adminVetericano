import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-crear-medicamentos',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './crear-medicamentos.html',
  styleUrl: './crear-medicamentos.css',
})
export class CrearMedicamentos {
  medicamento = {
    nombre: '',
    tipo: '',
    descripcion: '',
    observaciones: '',
    estado: ''
  };

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  guardarMedicamento() {
    this.http.post('https://tu-api.com/rest/v1/medicamentos', this.medicamento, {
      headers: { 'Content-Type': 'application/json' }
    }).subscribe({
      next: (respuesta) => {
        alert('Medicamento creado correctamente');
        console.log(respuesta);
        this.router.navigate(['/listarmedicamentos']);
      },
      error: (err) => {
        console.log(err);
        alert('Error del servidor al crear el medicamento');
      }
    });
  }
}