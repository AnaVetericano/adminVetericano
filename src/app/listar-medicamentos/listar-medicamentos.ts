import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // 1. Importa FormsModule

@Component({
  selector: 'app-listar-medicamentos',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule], // 2. Agrégalo aquí en los imports
  templateUrl: './listar-medicamentos.html',
  styleUrl: './listar-medicamentos.css',
})
export class ListarMedicamentos implements OnInit {
  medicamentos: any[] = [];
  
  // 3. Variables para controlar el modal y el nuevo medicamento
  modalAbierto: boolean = false;
  medicamento = {
    nombre: '',
    tipo: '',
    descripcion: '',
    observaciones: '',
    estado: ''
  };

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.obtenerMedicamentos();
  }

  // 4. Funciones del modal
  abrirModalCrear() {
    this.modalAbierto = true;
  }

  cerrarModal() {
    this.modalAbierto = false;
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

  // 5. Función para guardar y refrescar la tabla automáticamente
  guardarMedicamento() {
    this.http.post('https://tu-api.com/rest/v1/medicamentos', this.medicamento, {
      headers: { 'Content-Type': 'application/json' }
    }).subscribe({
      next: (respuesta) => {
        alert('Medicamento creado correctamente');
        console.log(respuesta);
        this.cerrarModal();
        this.obtenerMedicamentos(); // Recarga la tabla con el nuevo registro
        // Limpia el formulario
        this.medicamento = { nombre: '', tipo: '', descripcion: '', observaciones: '', estado: '' };
      },
      error: (err) => {
        console.log(err);
        alert('Error al crear el medicamento');
      }
    });
  }
}