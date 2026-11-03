import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import Swal from 'sweetalert2';
import { environment } from '../../environments/environment';

import { DashboardJuridicoComponent } from '../dashboard-juridico/dashboard-juridico';

@Component({
  selector: 'app-peticion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, DashboardJuridicoComponent],
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

  // Endpoints dinámicos centralizados con el environment
  private basePeticionesUrl = `${environment.apiBaseUrl}/peticiones`;
  private apiUrl = `${this.basePeticionesUrl}/iniciar/`;
  private apiListarUrl = `${this.basePeticionesUrl}/listar/`;
  private apiFuncionariosUrl = `${this.basePeticionesUrl}/seguimiento/funcionarios/`;
  private apiNotificacionesUrl = `${this.basePeticionesUrl}/notificaciones/`;
  private apiTiposUrl = `${this.basePeticionesUrl}/tipos/`;

  peticionesLista: any[] = [];
  vistaJuridica: 'peticiones' | 'dashboard' = 'peticiones';

  alternarVistaDashboard(): void {
    this.vistaJuridica = this.vistaJuridica === 'dashboard' ? 'peticiones' : 'dashboard';
    if (this.vistaJuridica === 'peticiones') {
      this.mostrarLista = true;
    }
    this.cdr.detectChanges();
  }

  setVistaJuridica(vista: 'peticiones' | 'dashboard'): void {
    this.vistaJuridica = vista;
    if (vista === 'peticiones') {
      this.mostrarLista = true;
    }
    this.cdr.detectChanges();
  }
  cargandoPeticiones = false;
  mostrarLista = true; // Por defecto mostramos la lista para Jurídico

  // Filtros locales para la vista de tarjetas de peticiones
  filtroBusqueda = '';
  filtroEstadoAsignacion: 'Todos' | 'Asignadas' | 'Sin asignar' = 'Todos';
  filtroEstadoPeticion: string = 'Todos';
  filtroPrioridad: 'Todos' | 'Urgentes' | 'Estandar' = 'Todos';
  filtroAtrasadas = false;
  menuFiltroAbierto = false;
  menuFiltroEstadoAbierto = false;

  // Catálogo unificado de estados
  estadosCatalogoPrevistos: string[] = [
    'En revisión',
    'Asignada',
    'En evaluación',
    'En proceso',
    'En tratamiento',
    'En observación',
    'Atendida',
    'Alta médica',
    'Resuelta',
    'Finalizada',
    'Lista para adopción'
  ];

  // Catálogo dinámico de tipos de petición
  tiposDisponibles: any[] = [];

  // Centro de Notificaciones en tiempo real
  panelNotificacionesAbierto = false;
  notificaciones: any[] = [];
  cargandoNotificaciones = false;

  get notificacionesNoLeidas(): number {
    return this.notificaciones.filter(n => !n.leida).length;
  }

  togglePanelNotificaciones(): void {
    this.panelNotificacionesAbierto = !this.panelNotificacionesAbierto;
    if (this.panelNotificacionesAbierto && this.notificaciones.length === 0) {
      this.obtenerNotificaciones();
    }
  }

  // Modal de detalle de la petición
  modalDetalleAbierto = false;
  peticionDetalle: any = null;
  historialAsignaciones: any[] = [];
  cargandoHistorial = false;

  // Modal para Asignación tradicional
  peticionSeleccionada: any = null;
  mostrarModalAsignar = false;
  veterinarioSeleccionado: number | null = null;
  asignando = false;

  // Modal para Reasignación con motivo (SCRUM-210)
  mostrarModalReasignar = false;
  peticionParaReasignar: any = null;
  nuevoVeterinarioSeleccionado: number | null = null;
  motivoReasignacion = '';

  // Modal para Cambio de Estado de la petición (PATCH /api/peticiones/<id>/estado/)
  mostrarModalEstado = false;
  peticionParaCambiarEstado: any = null;
  nuevoEstadoSeleccionado = '';
  observacionEstado = '';
  cambiandoEstado = false;

  funcionarios: any[] = [];
  cargandoFuncionarios = false;

  // Visor de evidencia
  evidenciaSeleccionada: string | null = null;
  evidenciaEsVideo = false;

  // Solo veterinarios (id_rol === 3) para el combo de asignación
  get veterinariosDisponibles(): any[] {
    return this.funcionarios;
  }

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    if (typeof window !== 'undefined' && (window.location.search.includes('dashboard') || window.location.hash.includes('dashboard'))) {
      this.vistaJuridica = 'dashboard';
    }
    this.reporteForm = this.fb.group({
      tipoPeticion: ['maltrato', Validators.required],
      otroEspecificacion: [''],
      prioridad: ['Media'],
      descripcion: ['', Validators.required],
      ubicacion: ['', Validators.required]
    });

    // Cargar automáticamente peticiones, funcionarios, notificaciones y tipos
    this.obtenerPeticiones();
    this.obtenerFuncionarios();
    this.obtenerNotificaciones();
    this.obtenerTiposPeticion();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // =========================================================================
  // GESTIÓN DE NOTIFICACIONES (GET / POST / PATCH /notificaciones/)
  // =========================================================================

  obtenerNotificaciones(): void {
    if (!localStorage.getItem('token')) return;
    this.cargandoNotificaciones = true;
    const url = `${this.apiNotificacionesUrl}?todas=true`;

    this.http.get<any[]>(url, { headers: this.getAuthHeaders() }).subscribe({
      next: (data) => {
        const lista = Array.isArray(data) ? data : (data as any)?.results || [];
        this.notificaciones = lista;
        this.cargandoNotificaciones = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn('Endpoint de notificaciones no disponible aún en servidor:', err);
        this.notificaciones = [];
        this.cargandoNotificaciones = false;
        this.cdr.detectChanges();
      }
    });
  }

  marcarTodasNotificacionesLeidas(): void {
    if (!localStorage.getItem('token')) return;
    const url = `${this.apiNotificacionesUrl}marcar-leida/`;

    this.http.patch(url, { marcar_todas: true }, { headers: this.getAuthHeaders() }).subscribe({
      next: () => {
        this.notificaciones.forEach(n => n.leida = true);
        this.cdr.detectChanges();
      },
      error: () => {
        this.notificaciones.forEach(n => n.leida = true);
        this.cdr.detectChanges();
      }
    });
  }

  marcarNotificacionLeida(notif: any): void {
    if (!localStorage.getItem('token') || !notif) return;
    const idNotif = notif.id_notificacion || notif.id;
    const url = idNotif
      ? `${this.apiNotificacionesUrl}${idNotif}/marcar-leida/`
      : `${this.apiNotificacionesUrl}marcar-leida/`;

    this.http.patch(url, {}, { headers: this.getAuthHeaders() }).subscribe({
      next: () => {
        notif.leida = true;
        this.cdr.detectChanges();
        this.abrirPeticionDesdeNotificacion(notif);
      },
      error: () => {
        notif.leida = true;
        this.cdr.detectChanges();
        this.abrirPeticionDesdeNotificacion(notif);
      }
    });
  }

  abrirPeticionDesdeNotificacion(notif: any): void {
    this.panelNotificacionesAbierto = false;
    const idPet = notif.id_peticion;
    if (idPet) {
      const encontrada = this.peticionesLista.find(p => Number(p.id_peticion) === Number(idPet));
      if (encontrada) {
        this.abrirModalDetalle(encontrada);
      } else {
        this.consultarDetallePeticionPorId(Number(idPet));
      }
    }
  }

  // =========================================================================
  // CONSULTA DE TIPOS Y PETICIONES (GET /tipos/, GET /listar/, GET /<id>/)
  // =========================================================================

  obtenerTiposPeticion(): void {
    if (!localStorage.getItem('token')) return;
    this.http.get<any[]>(this.apiTiposUrl, { headers: this.getAuthHeaders() }).subscribe({
      next: (data) => {
        const lista = Array.isArray(data) ? data : (data as any)?.results || [];
        if (lista.length > 0) {
          this.tiposDisponibles = lista;
        }
      },
      error: (err) => console.warn('Catálogo de tipos dinámicos no cargado, usando fallback:', err)
    });
  }

  toggleVistaPeticiones(): void {
    this.mostrarLista = !this.mostrarLista;
    if (this.mostrarLista) {
      this.obtenerPeticiones();
      this.obtenerFuncionarios();
      this.obtenerNotificaciones();
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

  recargarPeticiones(): void {
    this.obtenerPeticiones();
    this.obtenerNotificaciones();
  }

  obtenerFuncionarios(): void {
    if (!localStorage.getItem('token')) return;
    this.cargandoFuncionarios = true;
    this.http.get<any[]>(this.apiFuncionariosUrl, { headers: this.getAuthHeaders() }).subscribe({
      next: (data) => {
        const lista = Array.isArray(data) ? data : [];
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

  // =========================================================================
  // DETALLE COMPLETO E HISTORIAL DE ASIGNACIONES (GET /<id>/, GET /<id>/historial-asignaciones/)
  // =========================================================================

  abrirModalDetalle(p: any): void {
    this.peticionDetalle = { ...p };
    this.modalDetalleAbierto = true;
    const id = p.id_peticion;
    if (id) {
      this.cargarDetalleCompleto(id);
      this.obtenerHistorialAsignaciones(id);
    }
  }

  cerrarModalDetalle(): void {
    this.modalDetalleAbierto = false;
    this.peticionDetalle = null;
    this.historialAsignaciones = [];
  }

  cargarDetalleCompleto(id: number): void {
    const url = `${this.basePeticionesUrl}/${id}/`;
    this.http.get(url, { headers: this.getAuthHeaders() }).subscribe({
      next: (res: any) => {
        if (res) {
          this.peticionDetalle = { ...this.peticionDetalle, ...res };
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.warn('Detalle completo individual no cargado:', err)
    });
  }

  consultarDetallePeticionPorId(id: number): void {
    const url = `${this.basePeticionesUrl}/${id}/`;
    this.http.get(url, { headers: this.getAuthHeaders() }).subscribe({
      next: (res: any) => {
        if (res) {
          this.abrirModalDetalle(res);
        }
      },
      error: () => {
        this.mostrarAlerta('No encontrada', `No se encontró la petición #${id}.`, 'warning');
      }
    });
  }

  obtenerHistorialAsignaciones(id: number): void {
    this.cargandoHistorial = true;
    this.historialAsignaciones = [];
    const url = `${this.basePeticionesUrl}/${id}/historial-asignaciones/`;

    this.http.get<any[]>(url, { headers: this.getAuthHeaders() }).subscribe({
      next: (data) => {
        this.historialAsignaciones = Array.isArray(data) ? data : (data as any)?.results || [];
        this.cargandoHistorial = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn('Historial de asignaciones no disponible en backend:', err);
        this.historialAsignaciones = [];
        this.cargandoHistorial = false;
        this.cdr.detectChanges();
      }
    });
  }

  // =========================================================================
  // ASIGNACIÓN Y REASIGNACIÓN (PATCH /api/peticiones/<id>/asignar/)
  // =========================================================================

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
    const petId = this.peticionSeleccionada.id_peticion;
    const url = `${this.basePeticionesUrl}/${petId}/asignar/`;

    this.http.patch(url, { asignado_a: Number(this.veterinarioSeleccionado) }, { headers: this.getAuthHeaders() }).subscribe({
      next: () => {
        const vet = this.funcionarios.find((f: any) => Number(f.id_usuario ?? f.id) === Number(this.veterinarioSeleccionado));
        if (vet && this.peticionSeleccionada) {
          this.peticionSeleccionada.asignado_a_nombre = vet.nombre || vet.first_name || vet.username || '';
          this.peticionSeleccionada.asignado_a_apellido = vet.apellido || vet.last_name || '';
          this.peticionSeleccionada.fecha_asignacion = new Date().toISOString();
          this.peticionSeleccionada.estado = 'Asignada';
          const idx = this.peticionesLista.findIndex((x: any) => x.id_peticion === petId);
          if (idx >= 0) {
            this.peticionesLista[idx].asignado_a_nombre = this.peticionSeleccionada.asignado_a_nombre;
            this.peticionesLista[idx].asignado_a_apellido = this.peticionSeleccionada.asignado_a_apellido;
            this.peticionesLista[idx].fecha_asignacion = this.peticionSeleccionada.fecha_asignacion;
            this.peticionesLista[idx].estado = 'Asignada';
          }
        }
        this.asignando = false;
        this.cerrarModalAsignar();
        this.mostrarAlerta('¡Asignado!', 'La petición fue asignada correctamente al veterinario.', 'success');
        this.obtenerPeticiones();
        this.obtenerNotificaciones();
      },
      error: (err) => {
        this.asignando = false;
        const detalle = err.error?.error || err.error?.detail || err.error?.mensaje || 'Error al asignar la petición.';
        this.mostrarAlerta('Error al asignar', detalle, 'error');
      }
    });
  }

  abrirModalReasignar(peticion: any): void {
    this.peticionParaReasignar = peticion;
    this.nuevoVeterinarioSeleccionado = null;
    this.motivoReasignacion = '';
    this.mostrarModalReasignar = true;
  }

  cerrarModalReasignar(): void {
    this.mostrarModalReasignar = false;
    this.peticionParaReasignar = null;
    this.nuevoVeterinarioSeleccionado = null;
    this.motivoReasignacion = '';
  }

  confirmarReasignacionVisual(): void {
    if (!this.peticionParaReasignar || !this.nuevoVeterinarioSeleccionado) {
      this.mostrarAlerta('Selecciona el nuevo veterinario', 'Debes elegir el veterinario que asumirá el caso.', 'warning');
      return;
    }

    this.asignando = true;
    const petId = this.peticionParaReasignar.id_peticion;
    const url = `${this.basePeticionesUrl}/${petId}/asignar/`;

    const payload: any = {
      asignado_a: Number(this.nuevoVeterinarioSeleccionado)
    };
    if (this.motivoReasignacion && this.motivoReasignacion.trim()) {
      payload.motivo = this.motivoReasignacion.trim();
    }

    this.http.patch(url, payload, { headers: this.getAuthHeaders() }).subscribe({
      next: () => {
        this.asignando = false;
        this.cerrarModalReasignar();
        this.mostrarAlerta('¡Caso Reasignado!', 'El nuevo veterinario y el motivo han sido registrados exitosamente en el historial.', 'success');
        this.obtenerPeticiones();
        this.obtenerNotificaciones();
        if (this.modalDetalleAbierto && this.peticionDetalle?.id_peticion === petId) {
          this.cargarDetalleCompleto(petId);
          this.obtenerHistorialAsignaciones(petId);
        }
      },
      error: (err) => {
        this.asignando = false;
        const detalle = err.error?.error || err.error?.detail || err.error?.mensaje || 'Error al reasignar el caso.';
        this.mostrarAlerta('Error al reasignar', detalle, 'error');
      }
    });
  }

  // =========================================================================
  // CAMBIO DE ESTADO DE LA PETICIÓN (PATCH /api/peticiones/<id>/estado/)
  // =========================================================================

  abrirModalCambiarEstado(p: any): void {
    this.peticionParaCambiarEstado = p;
    this.nuevoEstadoSeleccionado = p?.estado || '';
    this.observacionEstado = '';
    this.mostrarModalEstado = true;
  }

  cerrarModalCambiarEstado(): void {
    this.mostrarModalEstado = false;
    this.peticionParaCambiarEstado = null;
    this.nuevoEstadoSeleccionado = '';
    this.observacionEstado = '';
    this.cambiandoEstado = false;
  }

  confirmarCambioEstado(): void {
    if (!this.peticionParaCambiarEstado || !this.nuevoEstadoSeleccionado) {
      this.mostrarAlerta('Selecciona un estado', 'Debes seleccionar el nuevo estado de la petición.', 'warning');
      return;
    }

    this.cambiandoEstado = true;
    const petId = this.peticionParaCambiarEstado.id_peticion;
    const url = `${this.basePeticionesUrl}/${petId}/estado/`;

    const payload: any = {
      estado: this.nuevoEstadoSeleccionado
    };
    if (this.observacionEstado && this.observacionEstado.trim()) {
      payload.observacion = this.observacionEstado.trim();
    }

    this.http.patch(url, payload, { headers: this.getAuthHeaders() }).subscribe({
      next: (res: any) => {
        this.cambiandoEstado = false;
        const nombreEstado = res.estado || this.nuevoEstadoSeleccionado;
        if (this.peticionDetalle && this.peticionDetalle.id_peticion === petId) {
          this.peticionDetalle.estado = nombreEstado;
        }
        const idx = this.peticionesLista.findIndex((x: any) => x.id_peticion === petId);
        if (idx >= 0) {
          this.peticionesLista[idx].estado = nombreEstado;
        }
        this.cerrarModalCambiarEstado();
        this.mostrarAlerta('Estado Actualizado', `El caso #${petId} ahora se encuentra en estado '${nombreEstado}'.`, 'success');
        this.obtenerPeticiones();
        this.obtenerNotificaciones();
        if (this.modalDetalleAbierto && this.peticionDetalle?.id_peticion === petId) {
          this.cargarDetalleCompleto(petId);
        }
      },
      error: (err) => {
        this.cambiandoEstado = false;
        const detalle = err.error?.error || err.error?.detail || err.error?.mensaje || 'Error al actualizar el estado.';
        this.mostrarAlerta('Error al actualizar estado', detalle, 'error');
      }
    });
  }

  // =========================================================================
  // CREACIÓN DE PETICIÓN (POST /api/peticiones/iniciar/)
  // =========================================================================

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

    const prioridadSeleccionada = this.reporteForm.get('prioridad')?.value || 'Media';

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
      prioridad: prioridadSeleccionada,
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
        this.mostrarLista = true;
        this.obtenerPeticiones();
        this.obtenerNotificaciones();
      },
      error: (error) => {
        const detalle = error.error?.detail || error.error?.mensaje || 'Error al registrar la petición.';
        this.mostrarAlerta('Error al enviar', detalle, 'error');
      }
    });
  }

  private resetearFormulario(): void {
    this.reporteForm.reset({
      tipoPeticion: 'maltrato',
      otroEspecificacion: '',
      prioridad: 'Media',
      descripcion: '',
      ubicacion: ''
    });
    this.archivoSeleccionado = null;
    this.latitud = null;
    this.longitud = null;
    this.ubicacionObtenida = false;
    this.mapaUrl = null;
    this.mensajeUbicacion = '';
  }

  // =========================================================================
  // GEOLOCALIZACIÓN Y MAPAS
  // =========================================================================

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

  // =========================================================================
  // FILTROS, MÉTRICAS Y HELPERS DE PRESENTACIÓN
  // =========================================================================

  nombreAsignado(p: any): string {
    if (!p) return '';
    const nombre = (p.asignado_a_nombre || p.asignado_nombre || p.veterinario_nombre || '').toString().trim();
    const apellido = (p.asignado_a_apellido || p.asignado_apellido || p.veterinario_apellido || '').toString().trim();
    const completo = `${nombre} ${apellido}`.trim();
    if (completo) return completo;
    const directo = (p.asignado_a ?? p.veterinario ?? p.asignado ?? p.id_veterinario ?? p.id_funcionario ?? '').toString().trim();
    if (!directo) return '';
    if (/^\d+$/.test(directo)) {
      const vet = this.funcionarios.find((f: any) => Number(f.id_usuario ?? f.id) === Number(directo));
      if (vet) {
        const nomVet = `${vet.nombre || vet.first_name || vet.username || ''} ${vet.apellido || vet.last_name || ''}`.trim();
        if (nomVet) return nomVet;
      }
      return '';
    }
    return directo;
  }

  estaAsignada(p: any): boolean {
    if (!p) return false;
    if (this.nombreAsignado(p)) return true;
    const idAsig = p.asignado_a ?? p.id_veterinario ?? p.id_funcionario ?? p.veterinario_id ?? p.asignado;
    if (idAsig !== null && idAsig !== undefined && String(idAsig).trim() !== '' && Number(idAsig) > 0) {
      return true;
    }
    if (p.fecha_asignacion) return true;
    const estado = String(p.estado || '').toLowerCase().trim();
    if (estado.includes('asignad') && !estado.includes('sin asignar')) return true;
    return false;
  }

  esUrgente(p: any): boolean {
    if (!p) return false;
    const prio = String(p.prioridad || '').toLowerCase();
    const tipo = String(p.tipo || this.tipoLabel(p) || '').toLowerCase();
    const est = String(p.estado || '').toLowerCase();
    return prio.includes('urgente') || prio.includes('alta') || prio.includes('crit') ||
      tipo.includes('herido') || est.includes('urgente');
  }

  diasTranscurridos(p: any): number | null {
    if (!p) return null;
    const fechaRef = p.fecha_asignacion || p.fecha;
    if (!fechaRef) return null;
    try {
      const d = new Date(fechaRef);
      if (isNaN(d.getTime())) return null;
      const diffMs = Date.now() - d.getTime();
      return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    } catch {
      return null;
    }
  }

  esAtrasada(p: any): boolean {
    const dias = this.diasTranscurridos(p);
    if (dias === null) return false;
    const estado = String(p.estado || '').toLowerCase();
    if (estado.includes('atendid') || estado.includes('finaliz') || estado.includes('alta') || estado.includes('cerrad')) {
      return false;
    }
    return dias >= 5;
  }

  get totalPeticiones(): number {
    return this.peticionesLista.length;
  }

  get totalPendientes(): number {
    return this.peticionesLista.filter(p => !this.estaAsignada(p)).length;
  }

  get totalAsignadas(): number {
    return this.peticionesLista.filter(p => this.estaAsignada(p)).length;
  }

  get totalUrgentes(): number {
    return this.peticionesLista.filter(p => this.esUrgente(p)).length;
  }

  get totalAtrasadas(): number {
    return this.peticionesLista.filter(p => this.esAtrasada(p)).length;
  }

  get peticionesFiltradas(): any[] {
    const q = (this.filtroBusqueda || '').trim().toLowerCase();

    return this.peticionesLista.filter((p) => {
      const asignada = this.estaAsignada(p);
      const urgente = this.esUrgente(p);
      const atrasada = this.esAtrasada(p);

      if (this.filtroEstadoAsignacion === 'Asignadas' && !asignada) return false;
      if (this.filtroEstadoAsignacion === 'Sin asignar' && asignada) return false;

      if (this.filtroPrioridad === 'Urgentes' && !urgente) return false;
      if (this.filtroPrioridad === 'Estandar' && urgente) return false;

      if (this.filtroAtrasadas && !atrasada) return false;

      if (this.filtroEstadoPeticion !== 'Todos') {
        const estP = String(p.estado || '').toLowerCase();
        const estF = this.filtroEstadoPeticion.toLowerCase();
        if (!estP.includes(estF) && !estF.includes(estP)) {
          return false;
        }
      }

      if (!q) return true;

      const radicado = String(p.numero_radicado || `rad-pet-${p.id_peticion}` || '').toLowerCase();
      const idPet = String(p.id_peticion || '').toLowerCase();
      const tipo = this.tipoLabel(p).toLowerCase();
      const direccion = String(p.ubicacion_direccion || p.direccion || '').toLowerCase();
      const descripcion = String(p.descripcion || '').toLowerCase();
      const estado = String(p.estado || '').toLowerCase();
      const prioridad = String(p.prioridad || '').toLowerCase();
      const vet = this.nombreAsignado(p).toLowerCase();
      const estAsigTexto = asignada ? 'asignada asignado' : 'sin asignar pendiente';

      return (
        radicado.includes(q) ||
        idPet.includes(q) ||
        tipo.includes(q) ||
        direccion.includes(q) ||
        descripcion.includes(q) ||
        estado.includes(q) ||
        prioridad.includes(q) ||
        vet.includes(q) ||
        estAsigTexto.includes(q)
      );
    });
  }

  filtrarPorEstadoAsignacion(estado: 'Todos' | 'Asignadas' | 'Sin asignar'): void {
    this.filtroEstadoAsignacion = estado;
    this.menuFiltroAbierto = false;
  }

  filtrarPorEstadoPeticion(estado: string): void {
    this.filtroEstadoPeticion = estado;
    this.menuFiltroEstadoAbierto = false;
  }

  filtrarPorPrioridad(prio: 'Todos' | 'Urgentes' | 'Estandar'): void {
    this.filtroPrioridad = prio;
  }

  toggleFiltroAtrasadas(): void {
    this.filtroAtrasadas = !this.filtroAtrasadas;
  }

  toggleMenuFiltro(): void {
    this.menuFiltroAbierto = !this.menuFiltroAbierto;
  }

  toggleMenuFiltroEstado(): void {
    this.menuFiltroEstadoAbierto = !this.menuFiltroEstadoAbierto;
  }

  limpiarBusqueda(): void {
    this.filtroBusqueda = '';
  }

  limpiarTodosFiltros(): void {
    this.filtroBusqueda = '';
    this.filtroEstadoAsignacion = 'Todos';
    this.filtroEstadoPeticion = 'Todos';
    this.filtroPrioridad = 'Todos';
    this.filtroAtrasadas = false;
  }

  tipoLabel(p: any): string {
    const t = p?.tipo ?? p?.tipo_reporte ?? p?.nombre_tipo ?? p?.id_tipo;
    if (t === null || t === undefined || t === '') return 'Sin tipo';

    // Si coincide con los tipos cargados dinámicamente desde /api/peticiones/tipos/
    if (this.tiposDisponibles.length > 0) {
      const match = this.tiposDisponibles.find(tipo => tipo.id_tipo === Number(t) || tipo.id === Number(t));
      if (match?.nombre) return match.nombre;
    }

    const mapaNum: Record<string, string> = {
      '1': 'Animal herido',
      '2': 'Maltrato animal',
      '3': 'Animal en condición de calle',
      '4': 'Otro'
    };
    if (typeof t === 'number' || /^\d+$/.test(String(t).trim())) {
      return mapaNum[String(t).trim()] || `Tipo ${t}`;
    }
    return String(t);
  }

  estadoBadgeClase(p: any): string {
    const est = String(p?.estado || (this.estaAsignada(p) ? 'Asignada' : 'En revisión')).toLowerCase();
    if (est.includes('revis') || est.includes('pend')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (est.includes('asignad')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (est.includes('proces')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    if (est.includes('atendid') || est.includes('resuelt')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (est.includes('tratamient') || est.includes('observac')) {
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    }
    if (est.includes('adopci')) {
      return 'bg-pink-50 text-pink-700 border-pink-200';
    }
    if (est.includes('finaliz') || est.includes('alta') || est.includes('cerrad')) {
      return 'bg-slate-100 text-slate-700 border-slate-300';
    }
    return 'bg-gray-100 text-gray-700 border-gray-200';
  }

  prioridadClase(prioridad: any, esUrg: boolean = false): string {
    if (esUrg) return 'bg-red-50 text-red-700 border-red-200';
    const v = String(prioridad || '').toLowerCase();
    if (v.includes('alta') || v.includes('urgente') || v.includes('crít') || v.includes('crit')) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    if (v.includes('media')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (v.includes('baja')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    return 'bg-gray-50 text-gray-600 border-gray-200';
  }

  fotoDe(p: any): string {
    if (!p) return '';
    const f: any = p.foto ?? p.foto_url ?? p.imagen ?? p.evidencia;
    if (!f) return '';
    if (Array.isArray(f)) return f.length > 0 ? String(f[0]) : '';
    return String(f);
  }

  contarFotos(p: any): string {
    const f: any = p?.foto ?? p?.foto_url ?? p?.imagen ?? p?.evidencia;
    if (Array.isArray(f)) return `${f.length} foto${f.length === 1 ? '' : 's'}`;
    if (!f) return '0 fotos';
    return this.esVideo(f) ? '1 video' : '1 foto';
  }

  mapaLink(p: any): string {
    const lat = p?.ubicacion_latitud ?? p?.latitud;
    const lng = p?.ubicacion_longitud ?? p?.longitud;
    if (lat === null || lat === undefined || lat === '' || lng === null || lng === undefined || lng === '') {
      return '';
    }
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  formatearFecha(valor: any): string {
    if (!valor) return 'Sin fecha';
    try {
      const d = new Date(valor);
      if (isNaN(d.getTime())) return String(valor);
      return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return String(valor);
    }
  }

  formatearFechaCorta(valor: any): string {
    if (!valor) return 'No registrada';
    try {
      const d = new Date(valor);
      if (isNaN(d.getTime())) return String(valor);
      return d.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
      });
    } catch {
      return String(valor);
    }
  }

  formatearFechaHora(valor: any): string {
    if (!valor) return 'No registrada';
    try {
      const d = new Date(valor);
      if (isNaN(d.getTime())) return String(valor);
      return d.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(valor);
    }
  }

  tiempoRelativo(valor: any): string {
    if (!valor) return '';
    try {
      const d = new Date(valor);
      if (isNaN(d.getTime())) return '';
      const diffMs = Date.now() - d.getTime();
      const mins = Math.floor(diffMs / (1000 * 60));
      if (mins < 1) return 'Hace un momento';
      if (mins < 60) return `Hace ${mins} min`;
      const horas = Math.floor(mins / 60);
      if (horas < 24) return `Hace ${horas} h`;
      const dias = Math.floor(horas / 24);
      return `Hace ${dias} d`;
    } catch {
      return '';
    }
  }

  esVideo(url: any): boolean {
    const u = String(url || '').toLowerCase().split('?')[0];
    if (!u) return false;
    if (u.includes('/video/upload')) return true;
    return /\.(mp4|webm|mov|avi|mkv|m4v|ogv)(\.|$)/.test(u);
  }

  abrirEvidencia(url: string): void {
    if (!url) return;
    this.evidenciaSeleccionada = url;
    this.evidenciaEsVideo = this.esVideo(url);
    document.body.style.overflow = 'hidden';
  }

  cerrarEvidencia(): void {
    this.evidenciaSeleccionada = null;
    this.evidenciaEsVideo = false;
    document.body.style.overflow = '';
  }

  onImgError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void {
    if (this.evidenciaSeleccionada) {
      this.cerrarEvidencia();
    } else if (this.mostrarModalEstado) {
      this.cerrarModalCambiarEstado();
    } else if (this.mostrarModalReasignar) {
      this.cerrarModalReasignar();
    } else if (this.mostrarModalAsignar) {
      this.cerrarModalAsignar();
    } else if (this.modalDetalleAbierto) {
      this.cerrarModalDetalle();
    } else if (this.panelNotificacionesAbierto) {
      this.panelNotificacionesAbierto = false;
    } else if (this.menuFiltroAbierto) {
      this.menuFiltroAbierto = false;
    } else if (this.menuFiltroEstadoAbierto) {
      this.menuFiltroEstadoAbierto = false;
    }
  }

  private mostrarAlerta(title: string, text: string, icon: 'success' | 'error' | 'warning'): void {
    Swal.fire({ title, text, icon, confirmButtonColor: '#4141a5' });
  }
}
