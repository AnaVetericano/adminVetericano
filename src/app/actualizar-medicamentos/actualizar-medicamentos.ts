import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-actualizar-medicamentos',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './actualizar-medicamentos.html',
  styleUrl: './actualizar-medicamentos.css',
})
export class ActualizarMedicamentos implements OnInit {
  id: number | string = 0;

  medicamento = {
    nombre: '',
    tipo: '',
    descripcion: '',
    observaciones: '',
    estado: ''
  };

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.id = this.route.snapshot.params['id'];
    // Opcional: Cargar los datos actuales del medicamento si tu API lo requiere
  }

  actualizarMedicamento() {
    this.http.patch(`https://tu-api.com/rest/v1/medicamentos?id=eq.${this.id}`, this.medicamento, {
      headers: { 'Content-Type': 'application/json' }
    }).subscribe({
      next: (respuesta) => {
        alert('Medicamento actualizado correctamente');
        console.log(respuesta);
        this.router.navigate(['/listarmedicamentos']);
      },
      error: (err) => {
        console.log(err);
        alert('Error del servidor al actualizar el medicamento');
      }
    });
  }
}