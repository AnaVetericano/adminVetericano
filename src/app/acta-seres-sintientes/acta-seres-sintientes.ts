import { Component } from '@angular/core';

@Component({
  selector: 'app-acta-seres-sintientes',
  imports: [],
  templateUrl: './acta-seres-sintientes.html',
  styleUrl: './acta-seres-sintientes.css',
})
export class ActaSeresSintientes {
  popalog = {

    logopop: 'images/Escudo_Popayan.svg'
  };
   
  onLimpiar() {
    // Lógica para limpiar el formulario
    console.log('Formulario limpiado');
  }

  onGuardar() {
    // Lógica para guardar el formulario
    console.log('Formulario guardado');
  }
}
