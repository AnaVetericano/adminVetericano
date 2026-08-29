import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-listar-especies',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './listar-especies.html',
  styleUrl: './listar-especies.css',
})
export class ListarEspecies implements OnInit {
  especies: any[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.obtenerEspecies();
  }

  obtenerEspecies() {
    this.http.get<any[]>('https://tu-api.com/rest/v1/especies')
      .subscribe({
        next: (respuesta) => {
          this.especies = respuesta;
          console.log(respuesta);
        },
        error: (err) => {
          console.log(err);
          alert('Error del servidor al cargar la lista');
        }
      });
  }
}