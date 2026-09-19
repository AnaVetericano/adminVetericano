
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-peticion',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './peticion.html',
  styleUrl: './peticion.css'
})
export class Peticion implements OnInit {

  // ==============================
  // FORMULARIO
  // ==============================

  reporteForm!: FormGroup;

  // ==============================
  // ARCHIVO
  // ==============================

  archivoSeleccionado: File | null = null;

  // ==============================
  // UBICACIÓN
  // ==============================

  latitud: number | null = null;
  longitud: number | null = null;

  ubicacionObtenida = false;
  cargandoUbicacion = false;

  mensajeUbicacion = '';

  mapaUrl: string = '';

  // ==============================
  // API
  // ==============================

  private apiUrl = 'http://127.0.0.1:8000/api/peticiones/';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient
  ) {}

  // ==============================
  // INICIALIZAR
  // ==============================

  ngOnInit(): void {

    this.reporteForm = this.fb.group({
      tipoPeticion: ['maltrato', Validators.required],
      otroEspecificacion: [''],
      descripcion: ['', Validators.required],
      ubicacion: ['', Validators.required]
    });

  }

  // ==============================
  // SELECCIONAR ARCHIVO
  // ==============================

  onFileSelected(event: Event): void {

    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {

      this.archivoSeleccionado = input.files[0];

    }

  }

  // ==============================
  // OBTENER UBICACIÓN
  // ==============================

  usarMiUbicacion(): void {

    if (!navigator.geolocation) {

      this.mensajeUbicacion =
        'Tu navegador no soporta la geolocalización.';

      this.ubicacionObtenida = false;

      return;
    }

    this.cargandoUbicacion = true;

    this.mensajeUbicacion =
      'Obteniendo tu ubicación actual...';

    navigator.geolocation.getCurrentPosition(

      (position) => {

        this.latitud = position.coords.latitude;
        this.longitud = position.coords.longitude;

        this.ubicacionObtenida = true;
        this.cargandoUbicacion = false;

        // Guardamos las coordenadas en el formulario
        this.reporteForm.patchValue({
          ubicacion:
            `${this.latitud}, ${this.longitud}`
        });

        // Crear URL para mostrar Google Maps
        this.mapaUrl =
          `https://www.google.com/maps?q=${this.latitud},${this.longitud}&output=embed`;

        this.mensajeUbicacion =
          'Ubicación obtenida correctamente.';

      },

      (error) => {

        console.error(
          'Error obteniendo ubicación:',
          error
        );

        this.cargandoUbicacion = false;
        this.ubicacionObtenida = false;

        switch (error.code) {

          case error.PERMISSION_DENIED:

            this.mensajeUbicacion =
              'Permiso de ubicación denegado. Activa la ubicación en tu navegador.';

            break;

          case error.POSITION_UNAVAILABLE:

            this.mensajeUbicacion =
              'No se pudo obtener tu ubicación.';

            break;

          case error.TIMEOUT:

            this.mensajeUbicacion =
              'Se agotó el tiempo para obtener tu ubicación.';

            break;

          default:

            this.mensajeUbicacion =
              'Ocurrió un error al obtener la ubicación.';

            break;
        }

      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }

    );

  }

  // ==============================
  // ABRIR GOOGLE MAPS
  // ==============================

  abrirGoogleMaps(): void {

    if (
      this.latitud === null ||
      this.longitud === null
    ) {

      return;

    }

    const url =
      `https://www.google.com/maps?q=${this.latitud},${this.longitud}`;

    window.open(url, '_blank');

  }

  // ==============================
  // COMPARTIR UBICACIÓN
  // ==============================

  compartirUbicacion(): void {

    if (
      this.latitud === null ||
      this.longitud === null
    ) {

      return;

    }

    const url =
      `https://www.google.com/maps?q=${this.latitud},${this.longitud}`;

    const texto =
      `Ubicación del reporte: ${url}`;

    // Si el navegador soporta compartir
    if (navigator.share) {

      navigator.share({
        title: 'Ubicación del reporte',
        text: texto,
        url: url
      })
      .catch((error) => {

        console.log(
          'Compartir cancelado:',
          error
        );

      });

    } else {

      // Alternativa si no soporta navigator.share
      navigator.clipboard.writeText(url);

      alert(
        'El enlace de la ubicación fue copiado al portapapeles.'
      );

    }

  }

  // ==============================
  // ENVIAR REPORTE
  // ==============================

  enviarReporte(): void {

    if (this.reporteForm.invalid) {

      alert(
        'Por favor completa los campos requeridos.'
      );

      this.reporteForm.markAllAsTouched();

      return;

    }

    if (!this.ubicacionObtenida) {

      alert(
        'Primero debes obtener tu ubicación.'
      );

      return;

    }

    const formData = new FormData();

    // Tipo de petición
    formData.append(
      'tipo_peticion',
      this.reporteForm.get('tipoPeticion')?.value || ''
    );

    // Especificación de otro
    formData.append(
      'otro_especificacion',
      this.reporteForm.get('otroEspecificacion')?.value || ''
    );

    // Descripción
    formData.append(
      'descripcion',
      this.reporteForm.get('descripcion')?.value || ''
    );

    // Ubicación
    formData.append(
      'ubicacion',
      this.reporteForm.get('ubicacion')?.value || ''
    );

    // Latitud
    if (this.latitud !== null) {

      formData.append(
        'latitud',
        this.latitud.toString()
      );

    }

    // Longitud
    if (this.longitud !== null) {

      formData.append(
        'longitud',
        this.longitud.toString()
      );

    }

    // Evidencia
    if (this.archivoSeleccionado) {

      formData.append(
        'evidencia',
        this.archivoSeleccionado,
        this.archivoSeleccionado.name
      );

    }

    // ==============================
    // POST A DJANGO
    // ==============================

    this.http.post(
      this.apiUrl,
      formData
    ).subscribe({

      next: (response) => {

        console.log(
          'Petición guardada correctamente:',
          response
        );

        alert(
          '¡Petición enviada y registrada correctamente!'
        );

        // Limpiar formulario
        this.reporteForm.reset({
          tipoPeticion: 'maltrato',
          otroEspecificacion: '',
          descripcion: '',
          ubicacion: ''
        });

        // Limpiar archivo
        this.archivoSeleccionado = null;

      },

      error: (error) => {

        console.error(
          'Error al conectar con la API:',
          error
        );

        console.error(
          'Respuesta del servidor:',
          error.error
        );

        alert(
          'Hubo un error al enviar la petición. Revisa la consola.'
        );

      }

    });

  }
}
