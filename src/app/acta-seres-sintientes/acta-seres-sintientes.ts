import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-acta-seres-sintientes',
  imports: [FormsModule, CommonModule],
  templateUrl: './acta-seres-sintientes.html',
  styleUrl: './acta-seres-sintientes.css',
})
export class ActaSeresSintientes implements OnInit {
  popalog = {
    logopop: 'images/Escudo_Popayan.svg'
  };

  // Lista de animales que vienen de la API
  listaPacientes: any[] = [];
  selectedPacienteId: any = '';

  formData = {
    fecha: new Date().toISOString().split('T')[0],
    nombre: '',
    raza: '',
    especie: '',
    sexo: '',
    peso: '',
    ultimaDesparasitacion: '',
    vacunas: '',
    observaciones: '',
    enfermedadesAnteriores: '',
    tratamiento: '',
    evolucion: '',
    alimentacion: '',
    historiaReproductiva: '',
    mucosas: '',
    actitudTemperamento: '',
    fRespiratoria: '',
    fCardiaca: '',
    temperatura: '',
    pulso: '',
    tiempoLlenadoCapilar: ''
  };

  ngOnInit() {
    this.cargarPacientesDesdeApi();
  }

  // Método para hacer el GET a la API y traer los animales
  cargarPacientesDesdeApi() {
    fetch('https://backendvetericano-production.up.railway.app/api/peticiones/seguimiento/')
      .then(response => response.json())
      .then(data => {
        // Asignamos los datos asegurando que sea un arreglo
        this.listaPacientes = Array.isArray(data) ? data : (data.results || []);
        console.log('Pacientes cargados de la BD:', this.listaPacientes);
      })
      .catch(error => {
        console.error('Error al conectar con la API:', error);
      });
  }

  // Método que se ejecuta al cambiar de animal en el selector
  onSeleccionarPaciente(event: any) {
    const valorSeleccionado = event.target.value;
    
    // Buscamos el paciente por ID o por Nombre en el arreglo
    const pacienteEncontrado = this.listaPacientes.find(
      p => (p.id == valorSeleccionado || p.nombre === valorSeleccionado)
    );

    if (pacienteEncontrado) {
      // Fusionamos los datos del paciente con el formulario
      this.formData = {
        ...this.formData,
        ...pacienteEncontrado,
        fecha: pacienteEncontrado.fecha || this.formData.fecha
      };
      console.log('Mostrando información de:', pacienteEncontrado.nombre);
    }
  }
   
  onLimpiar() {
    this.formData = {
      fecha: new Date().toISOString().split('T')[0],
      nombre: '',
      raza: '',
      especie: '',
      sexo: '',
      peso: '',
      ultimaDesparasitacion: '',
      vacunas: '',
      observaciones: '',
      enfermedadesAnteriores: '',
      tratamiento: '',
      evolucion: '',
      alimentacion: '',
      historiaReproductiva: '',
      mucosas: '',
      actitudTemperamento: '',
      fRespiratoria: '',
      fCardiaca: '',
      temperatura: '',
      pulso: '',
      tiempoLlenadoCapilar: ''
    };
    this.selectedPacienteId = '';
    console.log('Formulario limpiado');
  }

  onGuardar() {
    console.log('Formulario guardado', this.formData);
  }
}