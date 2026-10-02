import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-peticion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
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

  private apiUrl = 'https://backendvetericano-production.up.railway.app/api/peticiones/iniciar/';
  private apiListarUrl = 'https://backendvetericano-production.up.railway.app/api/peticiones/listar/';
  private apiFuncionariosUrl = 'https://backendvetericano-production.up.railway.app/api/peticiones/seguimiento/funcionarios/';

  peticionesLista: any[] = [];
  cargandoPeticiones = false;
  mostrarLista = false;

  funcionarios: any[] = [];

  // Solo veterinarios (id_rol === 3) para el combo de asignación.
  // Se calcula desde `funcionarios` que ya viene filtrado del backend/GET.
  get veterinariosDisponibles(): any[] {
    return this.funcionarios;
  }

  // Nombre del veterinario asignado tolerante a distintos nombres de campo
  // que puede devolver el backend (sin tocar backend).
  nombreAsignado(p: any): string {
    if (!p) return '';
    const nombre = (p.asignado_a_nombre || p.asignado_nombre || p.veterinario_nombre || '').toString().trim();
    const apellido = (p.asignado_a_apellido || p.asignado_apellido || p.veterinario_apellido || '').toString().trim();
    const completo = `${nombre} ${apellido}`.trim();
    if (completo) return completo;
    const directo = (p.asignado_a || p.veterinario || p.asignado || '').toString().trim();
    // Si solo viene el id numérico, no inventar nombre: se muestra "Sin asignar"
    if (/^\d+$/.test(directo)) return '';
    return directo;
  }

  cargandoFuncionarios = false;

  peticionSeleccionada: any = null;
  mostrarModalAsignar = false;
  veterinarioSeleccionado: number | null = null;
  asignando = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.reporteForm = this.fb.group({
      tipoPeticion: ['maltrato', Validators.required],
      otroEspecificacion: [''],
      descripcion: ['', Validators.required],
      ubicacion: ['', Validators.required]
    });
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  toggleVistaPeticiones(): void {
    this.mostrarLista = !this.mostrarLista;
    if (this.mostrarLista) {
      this.obtenerPeticiones();
      this.obtenerFuncionarios();
    }
  }

  obtenerPeticiones(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this.mostrarAlerta('Sesión no iniciada', 'Debes iniciar sesión para ver las peticiones.', 'error');
      return;
    }

    this.cargandoPeticiones = true;
    this.http.get(this.apiListarUrl, { headers: this.getAuthHeaders() }).subscribe({
      next: (response: any) => {
        const datos = response?.results || response?.data || response;
        this.peticionesLista = Array.isArray(datos) ? datos : [];
        this.cargandoPeticiones = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error al obtener peticiones:', error);
        this.cargandoPeticiones = false;
        this.cdr.detectChanges();
        this.mostrarAlerta('Error', 'No se pudieron cargar las peticiones.', 'error');
      }
    });
  }

  obtenerFuncionarios(): void {
    if (!localStorage.getItem('token')) return;
    this.cargandoFuncionarios = true;
    this.http.get<any[]>(this.apiFuncionariosUrl, { headers: this.getAuthHeaders() }).subscribe({
      next: (data) => {
        const lista = Array.isArray(data) ? data : [];
        // El endpoint trae roles 1,2,3 (admin/jurídico/veterinario), pero para
        // asignar casos solo sirven veterinarios. Se filtra en frontend
        // (sin tocar backend): id_rol === 3 o rol === 'Veterinario'.
        this.funcionarios = lista.filter((f: any) => {
          const idRol = Number(f.id_rol ?? f.idRol ?? f.rol_id ?? 0);
          const nombreRol = String(f.rol ?? f.nombre_rol ?? f.nombreRol ?? '').toLowerCase();
          return idRol === 3 || nombreRol.includes('veterinario');
        });
        this.cargandoFuncionarios = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al obtener funcionarios:', err);
        this.cargandoFuncionarios = false;
      }
    });
  }

  abrirModalAsignar(peticion: any): void {
    this.peticionSeleccionada = peticion;
    this.veterinarioSeleccionado = null;
    this.mostrarModalAsignar = true;
  }

  cerrarModalAsignar(): void {
    this.mostrarModalAsignar = false;
    this.peticionSeleccionada = null;
    this.veterinarioSeleccionado = null;
  }

  asignarVeterinario(): void {
    if (!this.peticionSeleccionada || !this.veterinarioSeleccionado) {
      this.mostrarAlerta('Selecciona un veterinario', 'Debes elegir un veterinario para asignar la petición.', 'warning');
      return;
    }

    this.asignando = true;
    const url = `https://backendvetericano-production.up.railway.app/api/peticiones/${this.peticionSeleccionada.id_peticion}/asignar/`;

    // El backend (AsignarPeticionView) solo acepta PATCH con la llave "asignado_a".
    // Antes se mandaba POST con "id_funcionario" y por eso fallaba con 400/405.
    this.http.patch(url, { asignado_a: Number(this.veterinarioSeleccionado) }, { headers: this.getAuthHeaders() }).subscribe({
      next: () => {
        // Reflejar el asignado de inmediato en la fila (el PATCH no devuelve nombres).
        const vet = this.funcionarios.find((f: any) => Number(f.id_usuario ?? f.id) === Number(this.veterinarioSeleccionado));
        if (vet && this.peticionSeleccionada) {
          this.peticionSeleccionada.asignado_a_nombre = vet.nombre || vet.first_name || vet.username || '';
          this.peticionSeleccionada.asignado_a_apellido = vet.apellido || vet.last_name || '';
          const idx = this.peticionesLista.findIndex((x: any) => x.id_peticion === this.peticionSeleccionada.id_peticion);
          if (idx >= 0) {
            this.peticionesLista[idx].asignado_a_nombre = this.peticionSeleccionada.asignado_a_nombre;
            this.peticionesLista[idx].asignado_a_apellido = this.peticionSeleccionada.asignado_a_apellido;
          }
        }
        this.asignando = false;
        this.cerrarModalAsignar();
        this.mostrarAlerta('¡Asignado!', 'La petición fue asignada correctamente.', 'success');
        this.obtenerPeticiones();
      },
      error: (err) => {
        this.asignando = false;
        const detalle = err.error?.error || err.error?.detail || err.error?.mensaje || 'Error al asignar la petición.';
        this.mostrarAlerta('Error al asignar', detalle, 'error');
      }
    });
  }

  recargarPeticiones(): void {
    this.obtenerPeticiones();
  }

  async buscarUbicacion(): Promise<void> {
    const ubicacion = this.reporteForm.get('ubicacion')?.value?.trim();
    if (!ubicacion) {
      this.mensajeUbicacion = 'Escribe una ubicación primero.';
      return;
    }

    try {
      const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(ubicacion + ', Popayán')}&limit=1`;
      const res = await fetch(geoUrl);
      if (res.ok) {
        const datos = await res.json();
        if (datos?.length > 0) {
          this.latitud = parseFloat(datos[0].lat);
          this.longitud = parseFloat(datos[0].lon);
        }
      }
    } catch (e) {
      console.log('Geocodificación opcional no completada:', e);
    }

    const url = `https://www.google.com/maps?q=${encodeURIComponent(ubicacion)}&output=embed`;
    this.mapaUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    this.ubicacionObtenida = true;
    this.mensajeUbicacion = `Ubicación encontrada: ${ubicacion}`;
  }

  async obtenerDireccion(lat: number, lon: number): Promise<void> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=es`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const datos = await res.json();

      if (datos.display_name) {
        this.reporteForm.patchValue({ ubicacion: datos.display_name });
        this.mensajeUbicacion = 'Dirección obtenida correctamente.';
      } else {
        this.reporteForm.patchValue({ ubicacion: 'Dirección no disponible' });
        this.mensajeUbicacion = 'No se encontró dirección específica.';
      }
    } catch {
      this.reporteForm.patchValue({ ubicacion: 'No se pudo obtener la dirección' });
      this.mensajeUbicacion = 'GPS obtenido, pero falló la conversión de dirección.';
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.archivoSeleccionado = input.files[0];
    }
  }

  usarMiUbicacion(): void {
    if (!navigator.geolocation) {
      this.mensajeUbicacion = 'Tu navegador no soporta la geolocalización.';
      this.ubicacionObtenida = false;
      return;
    }

    this.cargandoUbicacion = true;
    this.mensajeUbicacion = 'Obteniendo tu ubicación actual...';

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        this.latitud = position.coords.latitude;
        this.longitud = position.coords.longitude;

        const url = `https://www.google.com/maps?q=${this.latitud},${this.longitud}&output=embed`;
        this.mapaUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);

        await this.obtenerDireccion(this.latitud, this.longitud);
        this.ubicacionObtenida = true;
        this.cargandoUbicacion = false;
      },
      (error) => {
        this.cargandoUbicacion = false;
        this.ubicacionObtenida = false;
        const mensajes: Record<number, string> = {
          1: 'Permiso de ubicación denegado.',
          2: 'No se pudo obtener tu ubicación.',
          3: 'Agotado tiempo de espera.'
        };
        this.mensajeUbicacion = mensajes[error.code] || 'Error al obtener ubicación.';
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  abrirGoogleMaps(): void {
    if (this.latitud !== null && this.longitud !== null) {
      window.open(`https://www.google.com/maps?q=${this.latitud},${this.longitud}`, '_blank');
    }
  }

  compartirUbicacion(): void {
    if (this.latitud === null || this.longitud === null) return;
    const url = `https://www.google.com/maps?q=${this.latitud},${this.longitud}`;

    if (navigator.share) {
      navigator.share({ title: 'Ubicación del reporte', text: `Ubicación del reporte: ${url}`, url });
    } else {
      navigator.clipboard.writeText(url);
      alert('Enlace copiado al portapapeles.');
    }
  }

  async enviarReporte(): Promise<void> {
    if (this.reporteForm.invalid) {
      this.mostrarAlerta('Formulario incompleto', 'Completa todos los campos requeridos.', 'warning');
      this.reporteForm.markAllAsTouched();
      return;
    }

    if (!this.ubicacionObtenida) {
      this.mostrarAlerta('Ubicación requerida', 'Debes buscar o seleccionar tu ubicación.', 'warning');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      this.mostrarAlerta('Sesión no iniciada', 'Por favor inicia sesión nuevamente.', 'error');
      return;
    }

    const tipoValor = this.reporteForm.get('tipoPeticion')?.value;
    const mapaTipos: Record<string, number> = { herido: 1, maltrato: 2, calle: 3, otro: 4 };
    const idTipo = mapaTipos[tipoValor] || 2;

    let descripcion = (this.reporteForm.get('descripcion')?.value || '').trim();
    if (tipoValor === 'otro') {
      const espec = (this.reporteForm.get('otroEspecificacion')?.value || '').trim();
      if (espec) descripcion = `[Especificación: ${espec}] - ${descripcion}`;
    }

    Swal.fire({
      title: 'Enviando petición...',
      text: 'Por favor espera un momento.',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

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
        }
      } catch (uploadErr) {
        console.warn('Error subiendo foto:', uploadErr);
      }
    }

    const payload: any = {
      id_tipo: idTipo,
      descripcion,
      direccion: this.reporteForm.get('ubicacion')?.value || ''
    };

    if (this.latitud !== null) payload.latitud = Number(this.latitud.toFixed(7));
    if (this.longitud !== null) payload.longitud = Number(this.longitud.toFixed(7));
    if (urlFoto) payload.foto = urlFoto;

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    this.http.post(this.apiUrl, payload, { headers }).subscribe({
      next: (response: any) => {
        this.mostrarAlerta('¡Petición enviada!', `El caso #${response.id_peticion || ''} ha sido registrado con éxito.`, 'success');
        this.resetearFormulario();
        if (this.mostrarLista) this.obtenerPeticiones();
      },
      error: (error) => {
        const detalle = error.error?.detail || error.error?.mensaje || 'Error al registrar la petición.';
        this.mostrarAlerta('Error al enviar', detalle, 'error');
      }
    });
  }

  private resetearFormulario(): void {
    this.reporteForm.reset({ tipoPeticion: 'maltrato', otroEspecificacion: '', descripcion: '', ubicacion: '' });
    this.archivoSeleccionado = null;
    this.latitud = null;
    this.longitud = null;
    this.ubicacionObtenida = false;
    this.mapaUrl = null;
    this.mensajeUbicacion = '';
  }

  private mostrarAlerta(title: string, text: string, icon: 'success' | 'error' | 'warning'): void {
    Swal.fire({ title, text, icon, confirmButtonColor: '#4141a5' });
  }
}