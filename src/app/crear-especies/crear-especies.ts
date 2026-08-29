import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-crear-especies',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './crear-especies.html',
  styleUrl: './crear-especies.css',
})
export class CrearEspecies {
  especie = {
    nombre: '',
    descripcion: '',
    estado: ''
  };

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  guardarEspecie() {
    this.http.post('https://tu-api.com/rest/v1/especies', this.especie, {
      headers: { 'Content-Type': 'application/json' }
    }).subscribe({
      next: (respuesta) => {
        alert('Especie creada correctamente');
        console.log(respuesta);
        this.router.navigate(['/listarespecies']);
      },
      error: (err) => {
        console.log(err);
        alert('Error del servidor al crear la especie');
      }
    });
  }
}