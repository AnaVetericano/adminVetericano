import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { AuthService, UserSession } from '../services/auth';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css'
})
export class PerfilComponent implements OnInit {
  public authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  guardando: boolean = false;
  subiendoACloudinary: boolean = false;
  cargando: boolean = true;

  // Archivo seleccionado pendiente de subida a Cloudinary
  archivoSeleccionado: File | null = null;

  // Foto por defecto
  avatarPredeterminado: string = 'images/logoVetWhite.svg';

  usuario = {
    id_usuario: undefined as number | undefined,
    identificacion: '',
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    direccion: '',
    tarjeta_profesional: '',
    matricula: '',
    foto: '',
    rol: 'Veterinario'
  };

  ngOnInit(): void {
    this.cargarDatosPerfil();
  }

  cargarDatosPerfil(): void {
    const sesion = this.authService.currentUser();

    if (sesion) {
      this.asignarDatosDesdeSesion(sesion);
    }

    // Si contamos con id_usuario, consultar datos actualizados del backend
    if (sesion?.id_usuario) {
      this.authService.obtenerPerfilUsuario(sesion.id_usuario).subscribe({
        next: (res: any) => {
          if (res) {
            this.usuario.identificacion = res.identificacion ?? this.usuario.identificacion;
            this.usuario.nombre = res.nombre ?? res.first_name ?? this.usuario.nombre;
            this.usuario.apellido = res.apellido ?? res.last_name ?? this.usuario.apellido;
            this.usuario.email = res.email ?? this.usuario.email;
            this.usuario.telefono = res.telefono ?? this.usuario.telefono;
            this.usuario.direccion = res.direccion ?? this.usuario.direccion;
            this.usuario.tarjeta_profesional = res.tarjeta_profesional ?? this.usuario.tarjeta_profesional;
            this.usuario.matricula = res.matricula ?? res.matricula_profesional ?? this.usuario.matricula;
            
            const fotoActual = res.foto_perfil || res.foto || this.usuario.foto;
            this.usuario.foto = fotoActual;

            // Actualizar sesión reactiva local
            this.authService.actualizarSesion({
              identificacion: this.usuario.identificacion,
              nombre: this.usuario.nombre,
              apellido: this.usuario.apellido,
              email: this.usuario.email,
              telefono: this.usuario.telefono,
              direccion: this.usuario.direccion,
              tarjeta_profesional: this.usuario.tarjeta_profesional,
              matricula: this.usuario.matricula,
              matricula_profesional: res.matricula_profesional ?? this.usuario.matricula,
              foto: fotoActual,
              foto_perfil: fotoActual
            });
          }
          this.cargando = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.cargando = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  private asignarDatosDesdeSesion(sesion: UserSession): void {
    const sesionAny = sesion as any;
    this.usuario = {
      id_usuario: sesion.id_usuario,
      identificacion: sesion.identificacion || '',
      nombre: sesion.nombre || '',
      apellido: sesion.apellido || '',
      email: sesion.email || '',
      telefono: sesion.telefono || '',
      direccion: sesion.direccion || '',
      tarjeta_profesional: sesion.tarjeta_profesional || '',
      matricula: sesion.matricula || sesionAny.matricula_profesional || '',
      foto: sesion.foto || sesionAny.foto_perfil || '',
      rol: sesion.rol || 'Veterinario'
    };
  }

  // Manejar selección de foto de perfil
  onFotoSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      Swal.fire({
        icon: 'warning',
        title: 'Formato no válido',
        text: 'Por favor selecciona un archivo de imagen (PNG, JPG o WEBP).',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    // Validar tamaño máximo (máx 5 MB)
    if (file.size > 5 * 1024 * 1024) {
      Swal.fire({
        icon: 'warning',
        title: 'Imagen muy pesada',
        text: 'El tamaño de la imagen no debe superar los 5 MB.',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    this.archivoSeleccionado = file;

    // Vista previa inmediata para el usuario en la interfaz
    const reader = new FileReader();
    reader.onload = () => {
      this.usuario.foto = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  eliminarFoto(): void {
    this.archivoSeleccionado = null;
    this.usuario.foto = '';
    this.cdr.detectChanges();
  }

  guardarPerfil(): void {
    // Validaciones básicas
    if (!this.usuario.nombre.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo requerido',
        text: 'Por favor ingresa tu nombre.',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    if (!this.usuario.email.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo requerido',
        text: 'Por favor ingresa un correo electrónico válido.',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    this.guardando = true;

    // Si el usuario seleccionó un nuevo archivo de imagen, subirlo a Cloudinary
    if (this.archivoSeleccionado) {
      this.subiendoACloudinary = true;
      this.cdr.detectChanges();

      this.authService.subirImagenCloudinary(this.archivoSeleccionado).subscribe({
        next: (secureUrl: string) => {
          this.subiendoACloudinary = false;
          this.archivoSeleccionado = null;
          this.usuario.foto = secureUrl;
          this.persistirPerfil(secureUrl);
        },
        error: (err: any) => {
          console.warn('Error subiendo directamente a Cloudinary vía API, usando subida asistida por backend:', err);
          this.subiendoACloudinary = false;
          // Si falla la conexión directa a Cloudinary (bloqueadores, CORS), enviamos el Data URI base64 al backend
          // donde validate_foto_perfil la subirá en el servidor.
          this.persistirPerfil(this.usuario.foto);
        }
      });
    } else {
      // No hay archivo nuevo pendiente de subida, persistir directamente
      this.persistirPerfil(this.usuario.foto);
    }
  }

  private persistirPerfil(fotoUrl: string): void {
    const credencialVeterinaria = (this.usuario.matricula || this.usuario.tarjeta_profesional || '').trim();

    const datosActualizados: Partial<UserSession> = {
      nombre: this.usuario.nombre.trim(),
      apellido: this.usuario.apellido.trim(),
      identificacion: this.usuario.identificacion.trim(),
      email: this.usuario.email.trim(),
      telefono: this.usuario.telefono.trim(),
      direccion: this.usuario.direccion.trim(),
      tarjeta_profesional: this.usuario.tarjeta_profesional.trim(),
      matricula: this.usuario.matricula.trim(),
      matricula_profesional: credencialVeterinaria,
      foto: fotoUrl || '',
      foto_perfil: fotoUrl || ''
    };

    // Actualizamos de inmediato en el estado reactivo local y localStorage
    this.authService.actualizarSesion(datosActualizados);

    // Si tenemos id de usuario, enviamos al backend
    if (this.usuario.id_usuario) {
      const payloadBackend = {
        nombre: this.usuario.nombre.trim(),
        apellido: this.usuario.apellido.trim(),
        identificacion: this.usuario.identificacion.trim(),
        email: this.usuario.email.trim(),
        telefono: this.usuario.telefono.trim(),
        matricula_profesional: credencialVeterinaria || null,
        foto_perfil: fotoUrl || null,
        foto: fotoUrl || null
      };

      this.authService.actualizarPerfilUsuario(this.usuario.id_usuario, payloadBackend).subscribe({
        next: (res: any) => {
          this.guardando = false;
          this.subiendoACloudinary = false;

          const urlFinal = res?.foto_perfil || res?.foto || fotoUrl;
          this.usuario.foto = urlFinal;
          this.authService.actualizarSesion({
            ...datosActualizados,
            foto: urlFinal,
            foto_perfil: urlFinal
          });
          this.cdr.detectChanges();

          Swal.fire({
            icon: 'success',
            title: '¡Perfil actualizado!',
            text: 'Tu foto de perfil se guardó correctamente en Cloudinary y tus datos se sincronizaron con éxito.',
            confirmButtonColor: '#4141A5',
            timer: 2300,
            showConfirmButton: false
          });
        },
        error: (err: any) => {
          console.error('Error al guardar en backend:', err);
          this.guardando = false;
          this.subiendoACloudinary = false;
          this.cdr.detectChanges();

          const mensajeError = err?.error?.detail || err?.error?.message || 'No fue posible guardar los cambios en el servidor. Por favor intenta nuevamente.';
          Swal.fire({
            icon: 'error',
            title: 'Error al actualizar',
            text: mensajeError,
            confirmButtonColor: '#4141A5'
          });
        }
      });
    } else {
      this.guardando = false;
      this.subiendoACloudinary = false;
      this.cdr.detectChanges();
      Swal.fire({
        icon: 'success',
        title: '¡Perfil actualizado!',
        text: 'Los cambios se han guardado en tu sesión activa.',
        confirmButtonColor: '#4141A5',
        timer: 2000,
        showConfirmButton: false
      });
    }
  }
}
