import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../services/auth';
import { Graficas } from '../graficas/graficas';

@Component({
  selector: 'app-usuarios-roles',
  standalone: true,
  imports: [FormsModule, CommonModule, Graficas],
  templateUrl: './usuarios-roles.html',
  styleUrl: './usuarios-roles.css',
})
export class UsuariosRoles implements OnInit{

  textoBusqueda: string = '';
  usuariosFiltrados: any[] = [];

  usuarios: any[] = [];

  modal = false;
  editar = false;
  mostrarFiltros = false;

  usuarioSeleccionadoRol: any = null;
  rolesDisponibles: any[] = [
    { id_rol: 1, nombre_rol: 'Administrador' },
    { id_rol: 2, nombre_rol: 'Veterinario' },
    { id_rol: 3, nombre_rol: 'Jurídico' },
    { id_rol: 4, nombre_rol: 'Peticionario' }
  ];

  // URL unificada apuntando exactamente a endpoint de usuarios en Railway
  private apiUrl = `${environment.apiUrl}/usuarios/`;
  

  usuario = {
    id_usuario: 0,
    identificacion:'',
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    id_rol: null as number | null,
    nombre_rol: '',
    activo: true
  };

  constructor(private http: HttpClient,private authService: AuthService,
    private cdr: ChangeDetectorRef, private router:Router
  ) {}

  ngOnInit(): void {
    this.listarUsuarios();
    this.cargarRoles();
  }

  // Listar usuarios con protección por si la API responde con paginación o lista directa
listarUsuarios(): void {
  this.http.get<any>(this.apiUrl).subscribe({
    next: (respuesta) => {
      const lista = Array.isArray(respuesta) ? respuesta : (respuesta.results || []);

      // Mapeamos los usuarios para asegurar que si no tienen rol, diga 'Indefinido'
      this.usuarios = lista.map((u: any) => {
        // Extraemos el nombre del rol dependiendo de cómo lo devuelva tu backend (string u objeto)
        let rolTexto = u.nombre_rol;
        
        if (!rolTexto && u.id_rol) {
          // Si por alguna razón solo llega el ID o viene en un objeto
          rolTexto = typeof u.id_rol === 'object' ? u.id_rol?.nombre_rol : null;
        }

        return {
          ...u,
          nombre_rol: rolTexto && rolTexto.trim() !== '' ? rolTexto : 'Indefinido'
        };
      });

      this.usuariosFiltrados = [...this.usuarios];
      this.cdr.detectChanges();
    },
    error: (error) => {
      console.error('Error al listar usuarios:', error);
    }
  });
}

  // Abrir modal para crear
  abrirModalCrear(): void {
    this.usuario = {
      id_usuario: 0,
      identificacion:'',
      email: '',
      password: '',
      nombre: '',
      apellido: '',
      id_rol: null ,
      nombre_rol: '',
      activo: true
    };

    this.editar = false;
    this.modal = true;
    
  }

  // Abrir modal para editar
  abrirModalEditar(usuarioSeleccionado: any): void {
    this.usuario = {
      id_usuario: usuarioSeleccionado.id_usuario,
      identificacion:usuarioSeleccionado.identificacion || '',
      email: usuarioSeleccionado.email,
      password: '', // La contraseña no se muestra por seguridad
      nombre: usuarioSeleccionado.nombre,
      apellido: usuarioSeleccionado.apellido,
      // Maneja si id_rol viene como objeto o como número directo
      id_rol: typeof usuarioSeleccionado.id_rol === 'object'
      ? usuarioSeleccionado.id_rol?.id_rol
      : usuarioSeleccionado.id_rol,
      nombre_rol: usuarioSeleccionado.nombre_rol ||'',
      activo: usuarioSeleccionado.activo
    };

    this.editar = true;
    this.modal = true;
  }

  // Cerrar modal
  cerrarModal(): void {
    this.modal = false;
  }

  // Función Guardar (crear o actualizar)
  guardar(): void {
    if (this.editar) {
      this.actualizarUsuario();
    } else {
      this.crearUsuario();
    }
  }

  // Crear usuario
  crearUsuario(): void {
    const nuevoUsuario = {
      email: this.usuario.email,
      identificacion:this.usuario.identificacion,
      password: this.usuario.password,
      nombre: this.usuario.nombre,
      apellido: this.usuario.apellido,
      id_rol: this.usuario.id_rol,
      activo: this.usuario.activo
    };

    this.http.post(this.apiUrl, nuevoUsuario).subscribe({
  next: (response) => {
    Swal.fire({
      title: '¡Éxito!',
      text: 'Usuario creado correctamente' + response,
      icon: 'success',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#4141A5'
    }).then(() => {
      // Es una buena práctica ejecutar estas acciones después de que el usuario cierra la alerta
      this.listarUsuarios();
      this.cerrarModal();
    });
  },
error: (error) => {
  console.error('Error al crear usuario:', error.error);
  
  // 1. Mensaje por defecto
  let mensajeErrorHtml = 'Error al crear el usuario';

  // 2. Construir una lista HTML con los errores y sus campos
  if (error.error && typeof error.error === 'object') {
    const listaErrores = Object.entries(error.error).map(([campo, mensajes]) => {
      // Si el mensaje es un arreglo, lo unimos. Si no, lo mostramos directo.
      const textoError = Array.isArray(mensajes) ? mensajes.join(', ') : mensajes;
      // Formato: <li><strong>campo:</strong> mensaje de error</li>
      return `<li><strong>${campo}:</strong> ${textoError}</li>`;
    });

    if (listaErrores.length > 0) {
      // Envolvemos los elementos en una etiqueta <ul> (lista desordenada)
      mensajeErrorHtml = `<ul style="text-align: left;">${listaErrores.join('')}</ul>`;
    }
  }

  // 3. Mostrar el SweetAlert usando la propiedad 'html'
  Swal.fire({
    title: 'Oops...',
    html: mensajeErrorHtml, // IMPORTANTE: Cambiar 'text' por 'html'
    icon: 'error',
    confirmButtonText: 'Cerrar',
    confirmButtonColor: '#d33'
  });
}
    });
  }

  // Actualizar usuario
actualizarUsuario(): void {

  const usuarioActualizado = {
    identificacion:this.usuario.identificacion, 
    email: this.usuario.email,
    nombre: this.usuario.nombre,
    apellido: this.usuario.apellido,
    id_rol: this.usuario.id_rol,
    activo: this.usuario.activo
  };

  this.http.put(
    `${this.apiUrl}${this.usuario.id_usuario}/`,
    usuarioActualizado
  ).subscribe({

    next: () => {

      Swal.fire({
        icon: 'success',
        title: '¡Usuario actualizado!',
        text: 'Los datos del usuario se actualizaron correctamente.',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#4141A5',
        background: '#FFFFFF',
        color: '#170B3D',
        timer: 2500,
        timerProgressBar: true
      });

      this.listarUsuarios();
      this.cerrarModal();
    },

    error: (error) => {

      console.error('Error al actualizar usuario:', error.error);

      Swal.fire({
        icon: 'error',
        title: 'Error al actualizar',
        text: 'No se pudo actualizar el usuario. Intenta nuevamente.',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#4141A5',
        background: '#FFFFFF',
        color: '#170B3D'
      });

    }

  });
}


  // Inactivar o activar usuario
  eliminarUsuario(activoOId: any, idOpcional?: number): void {
    let id_usuario: number;
    let nuevoEstado: boolean;

    if (typeof activoOId === 'boolean' && typeof idOpcional === 'number') {
      id_usuario = idOpcional;
      nuevoEstado = !activoOId;
    } else if (typeof activoOId === 'number') {
      id_usuario = activoOId;
      nuevoEstado = typeof idOpcional === 'boolean' ? idOpcional : false;
    } else if (typeof activoOId === 'object' && activoOId !== null) {
      id_usuario = activoOId.id_usuario;
      nuevoEstado = !activoOId.activo;
    } else {
      id_usuario = Number(idOpcional || activoOId);
      nuevoEstado = false;
    }

    const accion = nuevoEstado ? 'activar' : 'inactivar';
    const accionCapitalizada = nuevoEstado ? 'activado' : 'inactivado';

    Swal.fire({
      title: `¿Estás seguro de que deseas ${accion} este usuario?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: nuevoEstado ? '#16a34a' : '#ef4444',
      cancelButtonColor: '#ffffff',
      confirmButtonText: `Sí, ${accion}`,
      cancelButtonText: 'Cancelar',
        customClass: {
      cancelButton: '!text-black !border !border-gray-400'
    }
    }).then((result) => {
      if (result.isConfirmed) {
        this.authService.inactivarUsuario(id_usuario, nuevoEstado).subscribe({
          next: () => {
            Swal.fire({
              title: `Usuario ${accionCapitalizada} correctamente`,
              icon: 'success'
            });
            this.listarUsuarios();
          },
          error: (error) => {
            console.error(`Error al ${accion} usuario:`, error);
            Swal.fire({
              title: 'Error',
              text: `No se pudo ${accion} el usuario.`,
              icon: 'error'
            });
          }
        });
      }
    });
  }
  cerrarSesion(): void {

  Swal.fire({
    title: '¿Cerrar sesión?',
    text: '¿Estás seguro de que deseas cerrar tu sesión?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, cerrar sesión',
    cancelButtonText: 'No, cancelar',
    confirmButtonColor: '#4141A5',
    cancelButtonColor: '#C4C4C4',
    reverseButtons: true,
    background: '#FFFFFF',
    color: '#170B3D'
  }).then((result) => {

    if (result.isConfirmed) {

      // Eliminar información de sesión
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');

      // Ir al componente inicio-administrador
      this.router.navigate(['/']);

    }

  });
}
filtrarUsuarios(): void {
  const texto = this.textoBusqueda.trim().toLowerCase();

  if (!texto) {
    this.usuariosFiltrados = [...this.usuarios];
    return;
  }

  this.usuariosFiltrados = this.usuarios.filter(usuario =>
    usuario.nombre?.toLowerCase().includes(texto) ||
    usuario.apellido?.toLowerCase().includes(texto) ||
    usuario.email?.toLowerCase().includes(texto) ||
    usuario.identificacion?.toLowerCase().includes(texto)
  );
}
filtrarPorRol(idRol: number | null): void {

  // Si selecciona "Todos"
  if (idRol === null) {
    this.usuariosFiltrados = [...this.usuarios];
    this.mostrarFiltros = false;
    return;
  }

  // Filtrar por rol
  this.usuariosFiltrados = this.usuarios.filter(usuario => {

    const rolUsuario =
      typeof usuario.id_rol === 'object'
        ? usuario.id_rol?.id_rol
        : usuario.id_rol;

    return Number(rolUsuario) === idRol;
  });

  this.mostrarFiltros = false;
}

  // Alias para llamar inactivarUsuario directamente
  inactivarUsuario(id_usuario: number, activo: boolean = false): void {
    this.eliminarUsuario(!activo, id_usuario);
  }

  // Cargar lista de roles desde el servicio si está disponible
  cargarRoles(): void {
    this.authService.listarRoles().subscribe({
      next: (roles: any) => {
        if (Array.isArray(roles) && roles.length > 0) {
          this.rolesDisponibles = roles;
        }
      },
      error: () => {
        // Mantiene la lista por defecto si la API de roles no responde
      }
    });
  }

  // Abrir o cerrar el menú desplegable del rol de un usuario
  toggleMenuRol(usuario: any, event: MouseEvent): void {
    event.stopPropagation();
    if (this.usuarioSeleccionadoRol?.id_usuario === usuario.id_usuario) {
      this.usuarioSeleccionadoRol = null;
    } else {
      this.usuarioSeleccionadoRol = usuario;
    }
  }

  // Cerrar el menú desplegable al hacer clic en cualquier parte fuera
  @HostListener('document:click')
  cerrarMenuRolFuera(): void {
    this.usuarioSeleccionadoRol = null;
  }

  // Pedir confirmación con SweetAlert2 para cambiar el rol
  seleccionarNuevoRol(usuario: any, rol: any): void {
    this.usuarioSeleccionadoRol = null;

    const nuevoIdRol = rol.id_rol ?? rol.id;
    const nuevoNombreRol = rol.nombre_rol ?? rol.nombre;

    const rolActualId = typeof usuario.id_rol === 'object' ? usuario.id_rol?.id_rol : usuario.id_rol;

    // Si ya tiene ese mismo rol, no hacemos nada
    if (Number(rolActualId) === Number(nuevoIdRol) || usuario.nombre_rol === nuevoNombreRol) {
      return;
    }

    Swal.fire({
      title: '¿Confirmar cambio de rol?',
      html: `¿Estás seguro de que deseas cambiar el rol de <b>${usuario.nombre} ${usuario.apellido}</b> a <span class="text-indigo-700 font-bold">${nuevoNombreRol}</span>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cambiar rol',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1d1b4f',
      cancelButtonColor: '#C4C4C4',
      reverseButtons: true,
      background: '#FFFFFF',
      color: '#170B3D',
      customClass: {
        popup: 'rounded-2xl shadow-2xl',
        confirmButton: 'rounded-xl px-5 py-2.5 font-semibold shadow-md',
        cancelButton: 'rounded-xl px-5 py-2.5 font-semibold text-gray-700'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.ejecutarCambioRol(usuario, nuevoIdRol, nuevoNombreRol);
      }
    });
  }

  // Ejecutar la actualización del rol en la API
  ejecutarCambioRol(usuario: any, nuevoIdRol: number, nuevoNombreRol: string): void {
    const usuarioActualizado = {
      identificacion: usuario.identificacion || '',
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      id_rol: nuevoIdRol,
      activo: usuario.activo
    };

    this.http.put(`${this.apiUrl}${usuario.id_usuario}/`, usuarioActualizado).subscribe({
      next: () => {
        usuario.id_rol = nuevoIdRol;
        usuario.nombre_rol = nuevoNombreRol;

        Swal.fire({
          icon: 'success',
          title: '¡Rol actualizado!',
          text: `El rol de ${usuario.nombre} se actualizó a ${nuevoNombreRol} correctamente.`,
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#4141A5',
          background: '#FFFFFF',
          color: '#170B3D',
          timer: 2200,
          timerProgressBar: true
        });

        this.listarUsuarios();
      },
      error: (error) => {
        console.error('Error al actualizar rol:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error al cambiar rol',
          text: 'No se pudo actualizar el rol del usuario. Intenta nuevamente.',
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#4141A5',
          background: '#FFFFFF',
          color: '#170B3D'
        });
      }
    });
  }

}
