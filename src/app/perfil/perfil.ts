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
  cargando: boolean = true;

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
        next: (res) => {
          if (res) {
            this.usuario.identificacion = res.identificacion ?? this.usuario.identificacion;
            this.usuario.nombre = res.nombre ?? res.first_name ?? this.usuario.nombre;
            this.usuario.apellido = res.apellido ?? res.last_name ?? this.usuario.apellido;
            this.usuario.email = res.email ?? this.usuario.email;
            this.usuario.telefono = res.telefono ?? this.usuario.telefono;
            this.usuario.direccion = res.direccion ?? this.usuario.direccion;
            this.usuario.tarjeta_profesional = res.tarjeta_profesional ?? this.usuario.tarjeta_profesional;
            this.usuario.matricula = res.matricula ?? this.usuario.matricula;
            this.usuario.foto = res.foto ?? res.foto_perfil ?? this.usuario.foto;
            
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
              foto: this.usuario.foto
            });
          }
          this.cargando = false;
          this.cdr.detectChanges();
        },
        error: () => {
          // Si el endpoint específico falla, se mantienen los datos cargados de sesión
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
    this.usuario = {
      id_usuario: sesion.id_usuario,
      identificacion: sesion.identificacion || '',
      nombre: sesion.nombre || '',
      apellido: sesion.apellido || '',
      email: sesion.email || '',
      telefono: sesion.telefono || '',
      direccion: sesion.direccion || '',
      tarjeta_profesional: sesion.tarjeta_profesional || '',
      matricula: sesion.matricula || '',
      foto: sesion.foto || '',
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

    // Validar tamaño máximo (máx 3 MB)
    if (file.size > 3 * 1024 * 1024) {
      Swal.fire({
        icon: 'warning',
        title: 'Imagen muy pesada',
        text: 'El tamaño de la imagen no debe superar los 3 MB.',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.usuario.foto = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  eliminarFoto(): void {
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

    const datosActualizados: Partial<UserSession> = {
      nombre: this.usuario.nombre.trim(),
      apellido: this.usuario.apellido.trim(),
      identificacion: this.usuario.identificacion.trim(),
      email: this.usuario.email.trim(),
      telefono: this.usuario.telefono.trim(),
      direccion: this.usuario.direccion.trim(),
      tarjeta_profesional: this.usuario.tarjeta_profesional.trim(),
      matricula: this.usuario.matricula.trim(),
      foto: this.usuario.foto
    };

    // Actualizamos de inmediato en el estado local y localStorage
    this.authService.actualizarSesion(datosActualizados);

    // Si tenemos id de usuario, enviamos al backend
    if (this.usuario.id_usuario) {
      const payloadBackend = {
        nombre: this.usuario.nombre.trim(),
        apellido: this.usuario.apellido.trim(),
        identificacion: this.usuario.identificacion.trim(),
        email: this.usuario.email.trim(),
        telefono: this.usuario.telefono.trim(),
        direccion: this.usuario.direccion.trim(),
        tarjeta_profesional: this.usuario.tarjeta_profesional.trim(),
        matricula: this.usuario.matricula.trim(),
        foto: this.usuario.foto
      };

      this.authService.actualizarPerfilUsuario(this.usuario.id_usuario, payloadBackend).subscribe({
        next: () => {
          this.guardando = false;
          this.cdr.detectChanges();
          Swal.fire({
            icon: 'success',
            title: '¡Perfil actualizado!',
            text: 'Tus datos de perfil se han guardado y sincronizado correctamente.',
            confirmButtonColor: '#4141A5',
            timer: 2000,
            showConfirmButton: false
          });
        },
        error: (err) => {
          console.warn('Advertencia al guardar en backend:', err);
          this.guardando = false;
          this.cdr.detectChanges();
          // Aun si el backend tiene algún campo restringido, se mantiene guardado en la sesión local
          Swal.fire({
            icon: 'success',
            title: '¡Perfil guardado!',
            text: 'Tus datos han sido actualizados en tu sesión del sistema.',
            confirmButtonColor: '#4141A5',
            timer: 2000,
            showConfirmButton: false
          });
        }
      });
    } else {
      this.guardando = false;
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
