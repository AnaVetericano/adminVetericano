import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-historia-clinica',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historia-clinica.html',
  styleUrls: ['./historia-clinica.css']
})
export class HistoriaClinica2Component {
   popalog = {

    logopop: 'images/Escudo_Popayan.svg'
  };
   
  formData = {
    fecha: new Date().toISOString().split('T')[0],
    numeroHistoria: '',
    nombre: '',
    raza: '',
    especie: '',
    sexo: 'M',
    ultimaDesparasitacion: '',
    vacunas: '',
    enfermedadesAnteriores: '',
    tratamiento: '',
    evolucion: '',
    alimentacion: '',
    historiaReproductiva: '',
    motivoConsulta: '',
    fRespiratoria: '',
    fCardiaca: '',
    temperatura: '',
    pulso: '',
    tiempoLlenadoCapilar: '',
    mucosas: '',
    actitudTemperamento: '',
    organos: {
      estadoGeneral: 'Normal',
      hidratacion: 'Normal',
      tegumentario: 'Normal',
      ojos: 'Normal',
      oidos: 'Normal',
      digestivo: 'Normal',
      respiratorio: 'Normal',
      nervioso: 'Normal',
      musculoEsqueletico: 'Normal',
      cardiovascular: 'Normal',
      genitourinario: 'Normal'
    } as Record<string, string>
  };

  limpiarFormulario() {
    this.formData = {
      fecha: new Date().toISOString().split('T')[0],
      numeroHistoria: '',
      nombre: '',
      raza: '',
      especie: '',
      sexo: 'M',
      ultimaDesparasitacion: '',
      vacunas: '',
      enfermedadesAnteriores: '',
      tratamiento: '',
      evolucion: '',
      alimentacion: '',
      historiaReproductiva: '',
      motivoConsulta: '',
      fRespiratoria: '',
      fCardiaca: '',
      temperatura: '',
      pulso: '',
      tiempoLlenadoCapilar: '',
      mucosas: '',
      actitudTemperamento: '',
      organos: {
        estadoGeneral: 'Normal',
        hidratacion: 'Normal',
        tegumentario: 'Normal',
        ojos: 'Normal',
        oidos: 'Normal',
        digestivo: 'Normal',
        respiratorio: 'Normal',
        nervioso: 'Normal',
        musculoEsqueletico: 'Normal',
        cardiovascular: 'Normal',
        genitourinario: 'Normal'
      } as Record<string, string>
    };
    alert('Formulario limpiado correctamente.');
  }

  guardarHistoria() {
    console.log('Datos de la historia clínica:', this.formData);
    alert('¡Historia clínica guardada con éxito!');
  }
}