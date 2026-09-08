import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms'; // Asegúrate de importar FormsModule para el ngModel

@Component({
  selector: 'app-patologias',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './patologias.html',
  styleUrl: './patologias.css',
})
export class Patologias {
  modalAbierto: boolean = false;
  
  // Objeto para los datos de la patología
  patologia = {
    nombre: '',
    descripcion: '',
    estado: ''
  };

  constructor(private router: Router) {}

  abrirModalCrear(): void {
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
  }

  guardarPatologia(): void {
    // Aquí tu lógica para guardar
    console.log('Guardando patología...', this.patologia);
    this.cerrarModal();
  }
}