import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-acta-seres-sintientes',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule
  ],
  templateUrl: './acta-seres-sintientes.html',
  styleUrl: './acta-seres-sintientes.css',
})
export class ActaSeresSintientes implements OnInit {
  mostrarNuevosCasos: boolean = true;
  alternarNuevosCasos(): void {
  this.mostrarNuevosCasos = !this.mostrarNuevosCasos;
}

  popalog = {
    logopop: 'images/Escudo_Popayan.svg'
  };

  pestanaActiva: string = 'consulta';

  // Datos que vienen del backend
  seguimientos: any[] = [];

  seguimientosFiltrados: any[] = [];

textoBusqueda: string = '';
filtroEspecie: string = 'Todos';
filtrarPorEspecie(especie: string): void {
  this.filtroEspecie = especie;

  // Si está seleccionado "Todos"
  if (especie === 'Todos') {
    this.seguimientosFiltrados = [...this.seguimientos];
    this.buscarSeguimientos();
    return;
  }

  // Filtrar por especie
  this.seguimientosFiltrados = this.seguimientos.filter((seguimiento: any) => {
    const especieAnimal = String(
      seguimiento.paciente_especie || ''
    ).trim().toLowerCase();

    return especieAnimal === especie.toLowerCase();
  });

  // Si también hay texto escrito en el buscador,
  // aplicamos ambos filtros
  this.aplicarFiltros();
}
aplicarFiltros(): void {
  const texto = this.textoBusqueda.trim().toLowerCase();

  this.seguimientosFiltrados = this.seguimientos.filter((seguimiento: any) => {

    // Filtro por especie
    const especieAnimal = String(
      seguimiento.paciente_especie || ''
    ).trim().toLowerCase();

    const coincideEspecie =
      this.filtroEspecie === 'Todos' ||
      especieAnimal === this.filtroEspecie.toLowerCase();

    // Filtro por texto
    const nombre = String(
      seguimiento.nombre_paciente || ''
    ).toLowerCase();

    const especie = String(
      seguimiento.paciente_especie || ''
    ).toLowerCase();

    const raza = String(
      seguimiento.paciente_raza || ''
    ).toLowerCase();

    const microchip = String(
      seguimiento.microchip || ''
    ).toLowerCase();

    const coincideTexto =
      !texto ||
      nombre.includes(texto) ||
      especie.includes(texto) ||
      raza.includes(texto) ||
      microchip.includes(texto);

    return coincideEspecie && coincideTexto;
  });
}

  // Animal seleccionado
  seguimientoSeleccionado: any = null;

  cargando: boolean = false;
  error: string = '';

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}
  // Catálogo de exámenes clínicos
mostrarExamenes: boolean = false;
examenesClinicos: any[] = [];
cargandoExamenes: boolean = false;
mensajeExamenes: string = '';

// Exámenes que seleccionas para el acta

 ngOnInit(): void {
  this.cargarSeguimientos();
  this.cargarSistemasGuardados();
}

  cambiarPestana(pestana: string) {
    this.pestanaActiva = pestana;
  }

  cargarSeguimientos(): void {

    this.cargando = true;
    this.error = '';

    this.authService.listarSeguimientos().subscribe({

      next: (respuesta) => {

        console.log('Respuesta seguimiento:', respuesta);

       if (Array.isArray(respuesta)) {
  this.seguimientos = respuesta;
}
else if (respuesta?.results) {
  this.seguimientos = respuesta.results;
}
else {
  this.seguimientos = [];
}

// Al principio mostramos todos
this.seguimientosFiltrados = [...this.seguimientos];

        console.log('Seguimientos cargados:', this.seguimientos);

        this.cargando = false;
        this.cdr.detectChanges();
      },

      error: (error) => {

        console.error('Error cargando seguimientos:', error);

        this.error = 'No se pudieron cargar los animales en espera.';

        this.cargando = false;
        this.cdr.detectChanges();
      }

    });
  }
  

  // ==========================================
  // SELECCIONAR ANIMAL
  // ==========================================
  buscarSeguimientos(): void {
    this.aplicarFiltros();

  console.log('Filtro especie:', this.filtroEspecie);
  console.log('Texto buscado:', this.textoBusqueda);
  console.log('Resultados:', this.seguimientosFiltrados);

  const texto = this.textoBusqueda.trim().toLowerCase();

  // Si el buscador está vacío, mostrar todos
  if (!texto) {
    this.seguimientosFiltrados = [...this.seguimientos];
    return;
  }

  this.seguimientosFiltrados = this.seguimientos.filter((seguimiento: any) => {

    const nombre = String(
      seguimiento.nombre_paciente || ''
    ).toLowerCase();

    const especie = String(
      seguimiento.paciente_especie || ''
    ).toLowerCase();

    const raza = String(
      seguimiento.paciente_raza || ''
    ).toLowerCase();

    const microchip = String(
      seguimiento.microchip || ''
    ).toLowerCase();

    return (
      nombre.includes(texto) ||
      especie.includes(texto) ||
      raza.includes(texto) ||
      microchip.includes(texto)
    );
  });

  console.log('Resultados encontrados:', this.seguimientosFiltrados);
}

  seleccionarSeguimiento(seguimiento: any): void {

    console.log('Animal seleccionado:', seguimiento);

    this.seguimientoSeleccionado = seguimiento;
    console.log('Datos del animal:', seguimiento.animales);
console.log('Descripción del paciente:', seguimiento.descripcion_paciente);
console.log(
  'Descripción dentro de animales:',
  seguimiento.animales?.[0]?.descripcion_paciente
  

);
const animal = this.seguimientoSeleccionado?.animales?.[0];

console.log('Descripción del paciente:', animal?.descripcion_paciente);
console.log('Datos del animal:', animal);
console.log('Seguimiento seleccionado:', this.seguimientoSeleccionado);
console.log('Animales:', this.seguimientoSeleccionado?.animales);

console.log('Objeto completo del animal:', this.seguimientoSeleccionado?.animales?.[0]);

console.log(
  'Propiedades del animal:',
  Object.keys(this.seguimientoSeleccionado?.animales?.[0] || {})
);

    console.log('Nombre:', seguimiento?.nombre_paciente);
    console.log('Especie:', seguimiento?.paciente_especie);
    console.log('Raza:', seguimiento?.paciente_raza);
    console.log('Sexo:', seguimiento?.paciente_sexo);
    console.log('Color:', seguimiento?.paciente_color);
    console.log('Edad:', seguimiento?.paciente_edad);
    console.log('Peso:', seguimiento?.peso_paciente);

    // Datos que pueden venir dentro de animales
    console.log('Animales:', seguimiento?.animales);

    this.cdr.detectChanges();
  }
  

sistemas: { [key: string]: string } = {
  general: 'NE',
  hidratacion: 'NE',
  tegumentario: 'NE',
  ojos: 'NE',
  oidos: 'NE',
  nariz: 'NE',
  digestivo: 'NE',
  respiratorio: 'NE',
  nervioso: 'NE',
  musculoesqueletico: 'NE',
  cardiovascular: 'NE',
  genitourinario: 'NE'
};

guardarSistemas(): void {
  try {
    localStorage.setItem(
      'vetericano_sistemas',
      JSON.stringify(this.sistemas)
    );

    Swal.fire({
      icon: 'success',
      title: '¡Cambios guardados!',
      text: 'La evaluación física se guardó correctamente.',
      confirmButtonColor: '#4141A5'
    });
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error al guardar',
      text: 'No fue posible guardar la evaluación.'
    });
  }
}

cargarSistemasGuardados(): void {
  try {
    const datosGuardados = localStorage.getItem('vetericano_sistemas');

    if (datosGuardados) {
      const sistemasGuardados = JSON.parse(datosGuardados);

      this.sistemas = {
        ...this.sistemas,
        ...sistemasGuardados
      };
    }
  } catch (error) {
    console.error('Error al recuperar la evaluación:', error);
  }
}
  
// ==========================================
// EXÁMENES CLÍNICOS
// ==========================================

// Controla si la lista está visible


// Guarda los exámenes que devuelve el backend

examenesSolicitados: any[] = [];

// Agregar un examen al acta
agregarExamen(examen: any): void {
  const nombreExamen =
    examen.nombre ||
    examen.nombre_examen ||
    examen.nombre_tipo ||
    examen.tipo ||
    'Examen clínico';

  const yaExiste = this.examenesSolicitados.some(
    (item) =>
      item.id_examen === examen.id_examen ||
      item.id_examen === examen.id ||
      item.nombre === nombreExamen
  );

  if (yaExiste) {
    Swal.fire({
      icon: 'info',
      title: 'Examen ya agregado',
      text: 'Este examen ya se encuentra en la lista de solicitados.',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#4141A5'
    });
    return;
  }

  this.examenesSolicitados.push({
    ...examen,
    id_examen: examen.id_examen ?? examen.id ?? null,
    nombre: nombreExamen
  });

  Swal.fire({
    icon: 'success',
    title: 'Examen agregado',
    text: `${nombreExamen} se agregó a los exámenes solicitados.`,
    timer: 1400,
    showConfirmButton: false
  });
}

// Eliminar un examen con confirmación
eliminarExamen(indice: number): void {
  const examen = this.examenesSolicitados[indice];

  Swal.fire({
    icon: 'warning',
    title: '¿Deseas eliminar este examen?',
    text: `Se quitará "${examen.nombre}" de los exámenes solicitados.`,
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#d33',
    cancelButtonColor: '#4141A5',
    reverseButtons: true
  }).then((resultado) => {
    if (resultado.isConfirmed) {
      this.examenesSolicitados.splice(indice, 1);

      Swal.fire({
        icon: 'success',
        title: 'Examen eliminado',
        text: 'El examen se quitó de la lista.',
        timer: 1300,
        showConfirmButton: false
      });
    }
  });
}
desplegarExamenes(): void {
  if (this.mostrarExamenes) {
    this.mostrarExamenes = false;
    return;
  }

  this.mostrarExamenes = true;

  if (this.examenesClinicos.length > 0) {
    return;
  }

  this.cargandoExamenes = true;
  this.mensajeExamenes = '';

  this.authService.getCatalogo().subscribe({
    next: (respuesta: any) => {
      if (Array.isArray(respuesta)) {
        this.examenesClinicos = respuesta;
      } else if (Array.isArray(respuesta?.results)) {
        this.examenesClinicos = respuesta.results;
      } else if (Array.isArray(respuesta?.data)) {
        this.examenesClinicos = respuesta.data;
      } else {
        this.examenesClinicos = [];
      }

      this.cargandoExamenes = false;
      this.cdr.detectChanges();
    },
    error: (error: any) => {
      console.error('Error al cargar los exámenes:', error);

      this.mensajeExamenes =
        'No se pudieron cargar los exámenes clínicos.';

      this.cargandoExamenes = false;
      this.cdr.detectChanges();
    }
  });
}



}