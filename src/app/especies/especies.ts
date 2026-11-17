import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { debounceTime } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { environment } from '../../environments/environment';
import { AuthService, CrearEspecie, ActualizarEspecie } from '../services/auth';
import { RealtimeEventosService } from '../services/realtime-eventos.service';
import { AnimalIconComponent } from '../animal-icon/animal-icon';
import { PageTitleComponent } from '../page-title/page-title';

@Component({
selector: 'app-especies',
standalone: true,
imports: [FormsModule, CommonModule, AnimalIconComponent, PageTitleComponent],
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
) {
  inject(RealtimeEventosService)
    .on('catalogo.clinico_actualizado')
    .pipe(debounceTime(1000), takeUntilDestroyed())
    .subscribe(() => this.listarEspecies());
}

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
      title: 'No fue posible cargar las especies',
      text: 'No se pudieron cargar las especies. Verifique la conexión e intente nuevamente.',
      icon: 'error',
      confirmButtonText: 'Aceptar'
    });

  }

});

}

// BUSCAR ESPECIES
filtrarEspecies(): void {
  const texto = this.textoBusqueda.trim().toLowerCase();

  if (!texto) {
    this.especiesFiltradas = [...this.especies];
    return;
  }

  this.especiesFiltradas = this.especies.filter(especie =>
    especie.nombre?.toLowerCase().includes(texto) ||
    especie.descripcion?.toLowerCase().includes(texto) ||
    especie.id_especie?.toString().includes(texto)
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
    title: 'Campos obligatorios incompletos',
    text: 'Ingrese el nombre de la especie.',
    icon: 'warning',
    confirmButtonText: 'Aceptar'
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
      title: 'Registro guardado',
      text: 'La especie se registró correctamente.',
      icon: 'success',
      confirmButtonText: 'Aceptar'
    }).then(() => {

      this.listarEspecies();
      this.cerrarModal();

    });

  },

  error: (error) => {

    console.error('Error al crear especie:', error);

    const mensajeError = error?.error?.nombre?.[0] || error?.error?.detail || 'No se pudo crear la especie. Revisa la consola.';

    Swal.fire({
      title: 'No fue posible guardar el registro',
      text: mensajeError,
      icon: 'error',
      confirmButtonText: 'Aceptar'
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
      title: 'Especie actualizada',
      text: 'Los datos se actualizaron correctamente.',
      confirmButtonText: 'Aceptar',
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
      title: 'No fue posible actualizar el registro',
      text: mensajeError,
      confirmButtonText: 'Aceptar'
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

  title: 'Confirmar cambio de estado',

  text: `La especie "${especie.nombre}" será ${nuevoEstado ? 'activada' : 'inactivada'}.`,

  icon: 'warning',

  customClass: { popup: nuevoEstado ? '' : 'qa-destructivo' },

  showCancelButton: true,

  confirmButtonText: nuevoEstado ? 'Activar' : 'Inactivar',

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
        title: 'No fue posible completar la acción',
        text: mensajeError,
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });

    }

  });

});

}

}
