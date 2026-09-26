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
import Swal from 'sweetalert2';

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

  async buscarUbicacion(): Promise<void> {
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

    // Intentar geocodificar con Nominatim para extraer latitud y longitud reales
    try {
      const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        ubicacion + ', Popayán'
      )}&limit=1`;
      const res = await fetch(geoUrl);
      if (res.ok) {
        const datos = await res.json();
        if (datos && datos.length > 0) {
          this.latitud = parseFloat(datos[0].lat);
          this.longitud = parseFloat(datos[0].lon);
          console.log('Coordenadas geocodificadas:', this.latitud, this.longitud);
        }
      }
    } catch (e) {
      console.log('Geocodificación opcional no completada:', e);
    }

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

  async enviarReporte(): Promise<void> {
    // ==============================
    // VALIDAR FORMULARIO
    // ==============================

    if (this.reporteForm.invalid) {
      Swal.fire({
        title: 'Formulario incompleto',
        text: 'Por favor completa todos los campos requeridos.',
        icon: 'warning',
        confirmButtonColor: '#4141a5'
      });
      this.reporteForm.markAllAsTouched();
      return;
    }

    // ==============================
    // VALIDAR UBICACIÓN
    // ==============================

    if (!this.ubicacionObtenida) {
      Swal.fire({
        title: 'Ubicación requerida',
        text: 'Primero debes buscar o seleccionar tu ubicación.',
        icon: 'warning',
        confirmButtonColor: '#4141a5'
      });
      return;
    }

    // ==============================
    // OBTENER TOKEN DE AUTENTICACIÓN
    // ==============================
    const token = localStorage.getItem('token');
    if (!token) {
      Swal.fire({
        title: 'Sesión no iniciada',
        text: 'No se encontró una sesión activa. Por favor inicia sesión nuevamente.',
        icon: 'error',
        confirmButtonColor: '#4141a5'
      });
      return;
    }

    // ==============================
    // DETERMINAR ID_TIPO NUMÉRICO
    // 1: Animal Herido, 2: Maltrato animal, 3: Animal en condicion de calle, 4: Otro
    // ==============================
    const tipoValor = this.reporteForm.get('tipoPeticion')?.value;
    let idTipo = 2; // Por defecto Maltrato animal
    if (tipoValor === 'herido') {
      idTipo = 1;
    } else if (tipoValor === 'maltrato') {
      idTipo = 2;
    } else if (tipoValor === 'calle') {
      idTipo = 3;
    } else if (tipoValor === 'otro') {
      idTipo = 4;
    }

    // ==============================
    // DESCRIPCIÓN
    // ==============================
    let descripcion = (this.reporteForm.get('descripcion')?.value || '').trim();
    if (tipoValor === 'otro') {
      const espec = (this.reporteForm.get('otroEspecificacion')?.value || '').trim();
      if (espec) {
        descripcion = `[Especificación: ${espec}] - ${descripcion}`;
      }
    }

    const direccion = this.reporteForm.get('ubicacion')?.value || '';

    // ==============================
    // MOSTRAR CARGANDO
    // ==============================
    Swal.fire({
      title: 'Enviando petición...',
      text: 'Por favor espera un momento mientras registramos el caso.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    // ==============================
    // SUBIDA DE ARCHIVO A CLOUDINARY (SI EXISTE)
    // ==============================
    let urlFoto: string | null = null;
    if (this.archivoSeleccionado) {
      try {
        const cloudData = new FormData();
        cloudData.append('file', this.archivoSeleccionado);
        cloudData.append('upload_preset', 'preset_android');

        const uploadRes = await fetch('https://api.cloudinary.com/v1_1/aefeig5y/auto/upload', {
          method: 'POST',
          body: cloudData
        });

        if (uploadRes.ok) {
          const uploadJson = await uploadRes.json();
          urlFoto = uploadJson.secure_url || null;
        } else {
          console.warn('No se pudo subir la foto a Cloudinary, se continuará sin la imagen.');
        }
      } catch (uploadErr) {
        console.warn('Error subiendo foto:', uploadErr);
      }
    }

    // ==============================
    // PAYLOAD PARA DJANGO API
    // ==============================
    const payload: any = {
      id_tipo: idTipo,
      descripcion: descripcion,
      direccion: direccion
    };

    if (this.latitud !== null) {
      payload.latitud = Number(this.latitud.toFixed(7));
    }
    if (this.longitud !== null) {
      payload.longitud = Number(this.longitud.toFixed(7));
    }
    if (urlFoto) {
      payload.foto = urlFoto;
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    // ==============================
    // ENVIAR A DJANGO
    // ==============================
    this.http.post(this.apiUrl, payload, { headers }).subscribe({
      next: (response: any) => {
        console.log('Petición guardada correctamente:', response);

        Swal.fire({
          title: '¡Petición enviada!',
          text: `El caso #${response.id_peticion || ''} ha sido registrado con éxito.`,
          icon: 'success',
          confirmButtonColor: '#4141a5'
        });

        // Limpiar formulario y estados
        this.reporteForm.reset({
          tipoPeticion: 'maltrato',
          otroEspecificacion: '',
          descripcion: '',
          ubicacion: ''
        });

        this.archivoSeleccionado = null;
        this.latitud = null;
        this.longitud = null;
        this.ubicacionObtenida = false;
        this.mapaUrl = null;
        this.mensajeUbicacion = '';
      },
      error: (error) => {
        console.error('Error al conectar con la API:', error);
        console.error('Respuesta del servidor:', error.error);

        const detalleError =
          error.error?.detail ||
          error.error?.mensaje ||
          (error.error ? JSON.stringify(error.error) : 'Error inesperado al registrar la petición.');

        Swal.fire({
          title: 'Error al enviar',
          text: `No se pudo registrar la petición: ${detalleError}`,
          icon: 'error',
          confirmButtonColor: '#4141a5'
        });
      }
    });
  }
}