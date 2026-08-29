import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-listar-medicamentos',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './listar-medicamentos.html',
  styleUrl: './listar-medicamentos.css',
})
export class ListarMedicamentos implements OnInit {
  medicamentos: any[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.obtenerMedicamentos();
  }

  obtenerMedicamentos() {
    this.http.get<any[]>('https://tu-api.com/rest/v1/medicamentos')
      .subscribe({
        next: (respuesta) => {
          this.medicamentos = respuesta;
          console.log(respuesta);
        },
        error: (err) => {
          console.log(err);
          alert('Error del servidor al cargar la lista');
        }
      });
  }
}