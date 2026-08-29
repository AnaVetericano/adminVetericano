import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-actualizar-especies',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './actualizar-especies.html',
  styleUrl: './actualizar-especies.css',
})
export class ActualizarEspecies implements OnInit {
  id: number | string = 0;

  especie = {
    nombre: '',
    descripcion: '',
    estado: ''
  };

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.id = this.route.snapshot.params['id'];
  }

  actualizarEspecie() {
    this.http.patch(`https://tu-api.com/rest/v1/especies?id=eq.${this.id}`, this.especie, {
      headers: { 'Content-Type': 'application/json' }
    }).subscribe({
      next: (respuesta) => {
        alert('Especie actualizada correctamente');
        console.log(respuesta);
        this.router.navigate(['/listarespecies']);
      },
      error: (err) => {
        console.log(err);
        alert('Error del servidor al actualizar la especie');
      }
    });
  }
}