import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  DomSanitizer,
  SafeResourceUrl
} from '@angular/platform-browser';

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

  reporteForm!: FormGroup;
  archivoSeleccionado: File | null = null;

  latitud: number | null = null;
  longitud: number | null = null;

  ubicacionObtenida = false;
  cargandoUbicacion = false;
  mensajeUbicacion = '';

  mapaUrl: SafeResourceUrl | null = null;

  private apiUrl =
    'https://backendvetericano-production.up.railway.app/api/peticiones/iniciar/';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.reporteForm = this.fb.group({
      tipoPeticion: [
        'maltrato',
        Validators.required
      ],
      otroEspecificacion: [''],
      descripcion: [
        '',
        Validators.required
      ],
      ubicacion: [
        '',
        Validators.required
      ]
    });
  }

  buscarUbicacion(): void {
    const ubicacion =
      this.reporteForm
        .get('ubicacion')
        ?.value
        ?.trim();

    if (!ubicacion) {
      this.mensajeUbicacion =
        'Escribe una ubicación primero.';
      return;
    }

    console.log(
      'Buscando ubicación:',
      ubicacion
    );

    // Crear mapa usando el texto escrito
    const url =
      `https://www.google.com/maps?q=${encodeURIComponent(
        ubicacion
      )}&output=embed`;

    this.mapaUrl =
      this.sanitizer
        .bypassSecurityTrustResourceUrl(url);

    this.ubicacionObtenida = true;

    this.mensajeUbicacion =
      `Ubicación encontrada: ${ubicacion}`;

    console.log(
      'Mapa:',
      url
    );
  }

  // ==============================
  // OBTENER DIRECCIÓN DESDE GPS
  // ==============================

  async obtenerDireccion(
    latitud: number,
    longitud: number
  ): Promise<void> {
    try {
      const url =
        `https://nominatim.openstreetmap.org/reverse` +
        `?format=jsonv2` +
        `&lat=${latitud}` +
        `&lon=${longitud}` +
        `&zoom=18` +
        `&addressdetails=1` +
        `&accept-language=es`;

      console.log(
        'Consultando dirección:',
        url
      );

      const respuesta =
        await fetch(url);

      if (!respuesta.ok) {
        throw new Error(
          'No se pudo obtener la dirección'
        );
      }

      const datos =
        await respuesta.json();

      console.log(
        'Respuesta de dirección:',
        datos
      );

      if (datos.display_name) {
        // Mostrar la dirección en el formulario
        this.reporteForm.patchValue({
          ubicacion:
            datos.display_name
        });

        this.mensajeUbicacion =
          'Dirección obtenida correctamente.';
      } else {
        this.reporteForm.patchValue({
          ubicacion:
            'Dirección no disponible'
        });

        this.mensajeUbicacion =
          'No se encontró una dirección para esta ubicación.';
      }
    } catch (error) {
      console.error(
        'Error obteniendo dirección:',
        error
      );

      this.reporteForm.patchValue({
        ubicacion:
          'No se pudo obtener la dirección'
      });

      this.mensajeUbicacion =
        'Se obtuvo el GPS, pero no se pudo obtener la dirección.';
    }
  }

  // ==============================
  // SELECCIONAR ARCHIVO
  // ==============================

  onFileSelected(event: Event): void {
    const input =
      event.target as HTMLInputElement;

    if (
      input.files &&
      input.files.length > 0
    ) {
      this.archivoSeleccionado =
        input.files[0];
    }
  }

  // ==============================
  // USAR MI UBICACIÓN
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
      // ==============================
      // UBICACIÓN OBTENIDA
      // ==============================
      async (position) => {
        // Guardar coordenadas
        this.latitud =
          position.coords.latitude;

        this.longitud =
          position.coords.longitude;

        console.log(
          'Latitud:',
          this.latitud
        );

        console.log(
          'Longitud:',
          this.longitud
        );

        // ==============================
        // CREAR MAPA
        // ==============================

        const url =
          `https://www.google.com/maps?q=${this.latitud},${this.longitud}&output=embed`;

        this.mapaUrl =
          this.sanitizer
            .bypassSecurityTrustResourceUrl(url);

        console.log(
          'Mapa:',
          url
        );

        // ==============================
        // OBTENER DIRECCIÓN
        // ==============================

        await this.obtenerDireccion(
          this.latitud,
          this.longitud
        );

        // ==============================
        // FINALIZAR
        // ==============================

        this.ubicacionObtenida = true;
        this.cargandoUbicacion = false;
      },
      // ==============================
      // ERROR GPS
      // ==============================
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
      // ==============================
      // CONFIGURACIÓN GPS
      // ==============================
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

    window.open(
      url,
      '_blank'
    );
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

    // ==============================
    // COMPARTIR
    // ==============================

    if (navigator.share) {
      navigator.share({
        title:
          'Ubicación del reporte',
        text:
          texto,
        url:
          url
      })
      .catch((error) => {
        console.log(
          'Compartir cancelado:',
          error
        );
      });
    } else {
      navigator.clipboard
        .writeText(url);

      alert(
        'El enlace de la ubicación fue copiado al portapapeles.'
      );
    }
  }

  // ==============================
  // ENVIAR REPORTE
  // ==============================

  enviarReporte(): void {
    // ==============================
    // VALIDAR FORMULARIO
    // ==============================

    if (this.reporteForm.invalid) {
      alert(
        'Por favor completa los campos requeridos.'
      );

      this.reporteForm
        .markAllAsTouched();

      return;
    }

    // ==============================
    // VALIDAR UBICACIÓN
    // ==============================

    if (!this.ubicacionObtenida) {
      alert(
        'Primero debes obtener tu ubicación.'
      );

      return;
    }

    const formData =
      new FormData();

    // ==============================
    // TIPO
    // ==============================

    formData.append(
      'tipo_peticion',
      this.reporteForm
        .get('tipoPeticion')
        ?.value || ''
    );

    // ==============================
    // OTRO
    // ==============================

    formData.append(
      'otro_especificacion',
      this.reporteForm
        .get('otroEspecificacion')
        ?.value || ''
    );

    // ==============================
    // DESCRIPCIÓN
    // ==============================

    formData.append(
      'descripcion',
      this.reporteForm
        .get('descripcion')
        ?.value || ''
    );

    // ==============================
    // DIRECCIÓN
    // ==============================

    formData.append(
      'ubicacion',
      this.reporteForm
        .get('ubicacion')
        ?.value || ''
    );

    // ==============================
    // LATITUD
    // ==============================

    if (this.latitud !== null) {
      formData.append(
        'latitud',
        this.latitud.toString()
      );
    }

    // ==============================
    // LONGITUD
    // ==============================

    if (this.longitud !== null) {
      formData.append(
        'longitud',
        this.longitud.toString()
      );
    }

    // ==============================
    // EVIDENCIA
    // ==============================

    if (this.archivoSeleccionado) {
      formData.append(
        'evidencia',
        this.archivoSeleccionado,
        this.archivoSeleccionado.name
      );
    }

    // ==============================
    // OBTENER TOKEN DE AUTENTICACIÓN
    // ==============================
    const token = localStorage.getItem('token'); 
    console.log('Token recuperado del localStorage:', token);

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    // ==============================
    // ENVIAR A DJANGO CON HEADERS
    // ==============================

    this.http.post(
      this.apiUrl,
      formData,
      { headers }
    ).subscribe({
      next: (response) => {
        console.log(
          'Petición guardada correctamente:',
          response
        );

        alert(
          '¡Petición enviada y registrada correctamente!'
        );

        // ==============================
        // LIMPIAR FORMULARIO
        // ==============================

        this.reporteForm.reset({
          tipoPeticion:
            'maltrato',
          otroEspecificacion:
            '',
          descripcion:
            '',
          ubicacion:
            ''
        });

        // ==============================
        // LIMPIAR ARCHIVO
        // ==============================

        this.archivoSeleccionado =
          null;

        // ==============================
        // LIMPIAR UBICACIÓN
        // ==============================

        this.latitud =
          null;

        this.longitud =
          null;

        this.ubicacionObtenida =
          false;

        this.mapaUrl =
          null;

        this.mensajeUbicacion =
          '';
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