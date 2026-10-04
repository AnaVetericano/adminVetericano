import { Component, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-acta-seres-sintientes',
  imports: [FormsModule, CommonModule],
  templateUrl: './acta-seres-sintientes.html',
  styleUrl: './acta-seres-sintientes.css',
})
export class ActaSeresSintientes {
  popalog = {
    logopop: 'images/Escudo_Popayan.svg'
  };

  pacientesDisponibles = [
    { id: 1, nombre: 'Firulais' },
    { id: 2, nombre: 'Luna' }
  ];

  selectedId: any = '';

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

  constructor(private cdr: ChangeDetectorRef) {}

  onSeleccionarPorId(event: any) {
    const id = event.target.value;
    if (!id) return;

    const url = `https://backendvetericano-production.up.railway.app/api/peticiones/seguimiento/${id}/`;
    
    const token = localStorage.getItem('access') || 
                  localStorage.getItem('access_token') || 
                  localStorage.getItem('token') || 
                  localStorage.getItem('auth_token') ||
                  sessionStorage.getItem('access') || '';

    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    fetch(url, { method: 'GET', headers })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Error en la petición: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Objeto completo recibido de la API:', data);

        // 1. Historia Reproductiva (Esterilizado / Entero)
        const valorReproductivo = data.esterilizacion ?? 
                                  data.castrado ?? 
                                  data.esterilizado ?? 
                                  data.is_esterilizado ?? 
                                  data.estado_reproductivo ?? 
                                  data.historia_reproductiva ?? 
                                  data.historiaReproductiva ?? 
                                  data.reproductivo;

        let textoReproductivo = '';
        if (valorReproductivo === true || valorReproductivo === 1 || valorReproductivo === 'true' || valorReproductivo === 'S' || valorReproductivo === 'Si') {
          textoReproductivo = 'Esterilizado';
        } else if (valorReproductivo === false || valorReproductivo === 0 || valorReproductivo === 'false' || valorReproductivo === 'N' || valorReproductivo === 'No') {
          textoReproductivo = 'Entero';
        } else if (typeof valorReproductivo === 'string' && valorReproductivo.trim() !== '') {
          textoReproductivo = valorReproductivo;
        }

        // 2. Desparasitación (Sí / No)
        const valorDesp = data.desparasitado ?? 
                          data.is_desparasitado ?? 
                          data.desparasitacion ?? 
                          data.ultimaDesparasitacion ?? 
                          data.ultima_desparasitacion;

        let textoDesp = 'No';
        if (valorDesp === true || valorDesp === 1 || valorDesp === 'true' || valorDesp === 'S' || valorDesp === 'Si' || valorDesp === 'sí') {
          textoDesp = 'Sí';
        } else if (typeof valorDesp === 'string' && valorDesp.trim() !== '' && valorDesp.toLowerCase() !== 'no' && valorDesp.toLowerCase() !== 'false' && valorDesp.toLowerCase() !== '0') {
          textoDesp = 'Sí';
        }

        // 3. Especie (Priorizando paciente_especie)
        const rawEspecie = data.paciente_especie ?? 
                           data.especie ?? 
                           data.especie_animal ?? 
                           data.tipo ?? 
                           data.species ?? 
                           data.tipo_especie ?? '';

        let textoEspecie = '';

        if (rawEspecie === 1 || rawEspecie === '1') {
          textoEspecie = 'Canino';
        } else if (rawEspecie === 2 || rawEspecie === '2') {
          textoEspecie = 'Felino';
        } else if (rawEspecie === 3 || rawEspecie === '3') {
          textoEspecie = 'Equino';
        } else if (rawEspecie === 4 || rawEspecie === '4') {
          textoEspecie = 'Bovino';
        } else if (rawEspecie === 5 || rawEspecie === '5') {
          textoEspecie = 'Porcino';
        } else {
          const especieStr = typeof rawEspecie === 'object' && rawEspecie !== null 
            ? (rawEspecie.nombre || rawEspecie.name || rawEspecie.descripcion || '') 
            : String(rawEspecie).trim();

          const lowerEsp = especieStr.toLowerCase();
          if (lowerEsp.includes('can') || lowerEsp.includes('perro')) {
            textoEspecie = 'Canino';
          } else if (lowerEsp.includes('fel') || lowerEsp.includes('gato')) {
            textoEspecie = 'Felino';
          } else if (lowerEsp.includes('equ') || lowerEsp.includes('caballo')) {
            textoEspecie = 'Equino';
          } else if (lowerEsp.includes('bov') || lowerEsp.includes('vaca')) {
            textoEspecie = 'Bovino';
          } else if (lowerEsp.includes('porc') || lowerEsp.includes('cerdo')) {
            textoEspecie = 'Porcino';
          } else if (especieStr !== '') {
            const capitalizada = especieStr.charAt(0).toUpperCase() + especieStr.slice(1).toLowerCase();
            const validas = ['Canino', 'Felino', 'Equino', 'Bovino', 'Porcino', 'Otro'];
            textoEspecie = validas.includes(capitalizada) ? capitalizada : 'Otro';
          }
        }

        // 4. Sexo (Priorizando paciente_sexo)
        const rawSexo = data.paciente_sexo ?? data.sexo ?? data.genero ?? '';
        const sexoStr = typeof rawSexo === 'object' && rawSexo !== null 
          ? (rawSexo.nombre || rawSexo.name || '') 
          : String(rawSexo).trim().toUpperCase();

        let textoSexo = '';
        if (sexoStr.startsWith('M') || sexoStr === 'MACHO' || sexoStr === 'TRUE' || sexoStr === '1') {
          textoSexo = 'M';
        } else if (sexoStr.startsWith('H') || sexoStr.startsWith('F') || sexoStr === 'HEMBRA' || sexoStr === 'FEMENINO' || sexoStr === 'FALSE' || sexoStr === '0') {
          textoSexo = 'H';
        }

        // Mapeo completo al formulario
        this.formData = {
          ...this.formData,
          nombre: data.nombre || data.nombre_paciente || data.paciente_nombre || '',
          raza: data.raza || data.paciente_raza || '',
          especie: textoEspecie,
          sexo: textoSexo,
          peso: data.peso || data.peso_kg || data.peso_paciente || data.paciente_peso || data.pesoKg || '',
          ultimaDesparasitacion: textoDesp,
          vacunas: data.vacunas || '',
          observaciones: data.observaciones || '',
          enfermedadesAnteriores: data.enfermedadesAnteriores || data.enfermedades_anteriores || '',
          tratamiento: data.tratamiento || '',
          evolucion: data.evolucion || '',
          alimentacion: data.alimentacion || '',
          historiaReproductiva: textoReproductivo,
          mucosas: data.mucosas || '',
          actitudTemperamento: data.actitudTemperamento || data.actitud_temperamento || '',
          fRespiratoria: data.fRespiratoria || data.f_respiratoria || '',
          fCardiaca: data.fCardiaca || data.f_cardiaca || '',
          temperatura: data.temperatura || '',
          pulso: data.pulso || '',
          tiempoLlenadoCapilar: data.tiempoLlenadoCapilar || data.tiempo_llenado_capilar || ''
        };
        this.cdr.detectChanges();
        console.log('Datos mapeados exitosamente:', this.formData);
      })
      .catch(error => {
        console.error('Error al consultar:', error);
      });
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
    this.selectedId = '';
    this.cdr.detectChanges();
  }

  onGuardar() {
    console.log('Guardado:', this.formData);
  }
}