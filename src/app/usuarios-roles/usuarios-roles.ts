import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-usuarios-roles',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './usuarios-roles.html',
  styleUrl: './usuarios-roles.css',
})
export class UsuariosRoles implements OnInit {

  textoBusqueda: string = '';


  
usuariosFiltrados: any[] = [];

  usuarios: any[] = [];

  modal = false;
  editar = false;
  mostrarFiltros = false;

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
   
  }

  // Listar usuarios con protección por si la API responde con paginación o lista directa
 listarUsuarios(): void {

  this.http.get<any>(this.apiUrl).subscribe({

    next: (respuesta) => {

      this.usuarios = Array.isArray(respuesta)
        ? respuesta
        : (respuesta.results || []);

      // IMPORTANTE: cargar la lista que muestra la tabla
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

  this.usuariosFiltrados = this.usuarios.filter(usuarios =>
    usuarios.nombre?.toLowerCase().includes(texto) ||
    usuarios.descripcion?.toLowerCase().includes(texto) ||
    usuarios.id_especie?.toString().includes(texto)
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

}
