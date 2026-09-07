import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { environment } from '../../environments/environment';
import { AuthService, CrearEspecie, ActualizarEspecie } from '../services/auth';

@Component({
selector: 'app-especies',
standalone: true,
imports: [FormsModule, CommonModule],
templateUrl: './especies.html',
styleUrl: './especies.css',
})
export class Especies implements OnInit {

especies: any[] = [];
especiesFiltradas: any[] = [];

modal = false;
editar = false;

textoBusqueda = '';

// Endpoint de especies
private apiUrl = `${environment.apiUrlespecies}/especies/`;

especie = {
id_especie: 0,
nombre: '',
descripcion: '',
activo: true
};

constructor(
private http: HttpClient,
private authService: AuthService,
private cdr: ChangeDetectorRef,
private router: Router
) {}

ngOnInit(): void {
this.listarEspecies();
}

// LISTAR ESPECIES

listarEspecies(): void {

this.authService.listarEspecies().subscribe({

  next: (respuesta) => {

    // Soporta respuesta directa o paginada
    this.especies = Array.isArray(respuesta)
      ? respuesta
      : (respuesta.results || []);

    this.especiesFiltradas = [...this.especies];

    this.cdr.detectChanges();

  },

  error: (error) => {

    console.error('Error al listar especies:', error);

    Swal.fire({
      title: 'Error',
      text: 'No se pudieron cargar las especies.',
      icon: 'error',
      confirmButtonText: 'Cerrar',
      confirmButtonColor: '#d33'
    });

  }

});

}

// BUSCAR ESPECIES

filtrarEspecies(): void {

const texto = this.textoBusqueda
  .toLowerCase()
  .trim();

if (!texto) {

  this.especiesFiltradas = [...this.especies];
  return;

}

this.especiesFiltradas = this.especies.filter((especie) =>
  especie.nombre?.toLowerCase().includes(texto) ||
  especie.descripcion?.toLowerCase().includes(texto)
);

}

// LIMPIAR BUSQUEDA

limpiarBusqueda(): void {

this.textoBusqueda = '';
this.especiesFiltradas = [...this.especies];

}

// ABRIR MODAL CREAR

abrirModalCrear(): void {

this.especie = {
  id_especie: 0,
  nombre: '',
  descripcion: '',
  activo: true
};

this.editar = false;
this.modal = true;

}

// ABRIR MODAL EDITAR

abrirModalEditar(especieSeleccionada: any): void {

this.especie = {

  id_especie: especieSeleccionada.id_especie,

  nombre: especieSeleccionada.nombre,

  descripcion: especieSeleccionada.descripcion || '',

  activo: especieSeleccionada.activo

};

this.editar = true;
this.modal = true;

}

// CERRAR MODAL

cerrarModal(): void {


this.modal = false;

}

// GUARDAR

guardar(): void {

if (!this.especie.nombre.trim()) {

  Swal.fire({
    title: 'Campo obligatorio',
    text: 'Debes ingresar el nombre de la especie.',
    icon: 'warning',
    confirmButtonText: 'Entendido',
    confirmButtonColor: '#4141A5'
  });

  return;
}

if (this.editar) {

  this.actualizarEspecie();

} else {

  this.crearEspecie();

}

}

// CREAR ESPECIE

crearEspecie(): void {

const nuevaEspecie: CrearEspecie = {

  nombre: this.especie.nombre.trim(),

  descripcion: this.especie.descripcion ? this.especie.descripcion.trim() : '',

  activo: this.especie.activo

};

this.authService.crearEspecie(nuevaEspecie).subscribe({

  next: () => {

    Swal.fire({
      title: '¡Éxito!',
      text: 'La especie se creó correctamente.',
      icon: 'success',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#4141A5'
    }).then(() => {

      this.listarEspecies();
      this.cerrarModal();

    });

  },

  error: (error) => {

    console.error('Error al crear especie:', error);

    const mensajeError = error?.error?.nombre?.[0] || error?.error?.detail || 'No se pudo crear la especie. Revisa la consola.';

    Swal.fire({
      title: 'Oops...',
      text: mensajeError,
      icon: 'error',
      confirmButtonText: 'Cerrar',
      confirmButtonColor: '#d33'
    });

  }

});

}

// ACTUALIZAR ESPECIE

actualizarEspecie(): void {

const especieActualizada: ActualizarEspecie = {

  nombre: this.especie.nombre.trim(),

  descripcion: this.especie.descripcion ? this.especie.descripcion.trim() : '',

  activo: this.especie.activo

};

this.authService.actualizarEspecie(
  this.especie.id_especie,
  especieActualizada
).subscribe({

  next: () => {

    Swal.fire({
      icon: 'success',
      title: '¡Especie actualizada!',
      text: 'Los datos se actualizaron correctamente.',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#4141A5',
      background: '#FFFFFF',
      color: '#170B3D',
      timer: 2500,
      timerProgressBar: true
    });

    this.listarEspecies();
    this.cerrarModal();

  },

  error: (error) => {

    console.error(
      'Error al actualizar especie:',
      error
    );

    const mensajeError = error?.error?.nombre?.[0] || error?.error?.detail || 'No se pudo actualizar la especie.';

    Swal.fire({
      icon: 'error',
      title: 'Error al actualizar',
      text: mensajeError,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#4141A5'
    });

  }

});

}

// ACTIVAR / INACTIVAR

cambiarEstado(especie: any): void {

const nuevoEstado = !especie.activo;

const accion = nuevoEstado
  ? 'activar'
  : 'inactivar';

Swal.fire({

  title: `¿Deseas ${accion} esta especie?`,

  text: `La especie "${especie.nombre}" será ${nuevoEstado ? 'activada' : 'inactivada'}.`,

  icon: 'warning',

  showCancelButton: true,

  confirmButtonColor: nuevoEstado
    ? '#16a34a'
    : '#ef4444',

  cancelButtonColor: '#64748b',

  confirmButtonText: `Sí, ${accion}`,

  cancelButtonText: 'Cancelar'

}).then((resultado) => {

  if (!resultado.isConfirmed) {
    return;
  }

  this.authService.cambiarEstadoEspecie(
    especie.id_especie,
    nuevoEstado
  ).subscribe({

    next: () => {

      Swal.fire({
        title: `Especie ${nuevoEstado ? 'activada' : 'inactivada'} correctamente`,
        icon: 'success',
        timer: 1800,
        showConfirmButton: false
      });

      this.listarEspecies();

    },

    error: (error) => {

      console.error(
        `Error al ${accion} especie:`,
        error
      );

      const mensajeError = error?.error?.detail || `No se pudo ${accion} la especie.`;

      Swal.fire({
        title: 'Error',
        text: mensajeError,
        icon: 'error'
      });

    }

  });

});

}

}
