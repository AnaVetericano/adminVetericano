import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-usuarios-roles',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './usuarios-roles.html',
  styleUrl: './usuarios-roles.css',
})
export class UsuariosRoles implements OnInit {

  usuarios: any[] = [];

  modal = false;
  editar = false;

  // URL unificada apuntando exactamente a tu endpoint de usuarios
  private apiUrl = 'http://127.0.0.1:8000/api/users/usuarios/';

  usuario = {
    id_usuario: 0,
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    id_rol: 0,
    activo: true
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.listarUsuarios();
  }

  // Listar usuarios con protección por si la API responde con paginación o lista directa
  listarUsuarios(): void {
    this.http.get<any>('http://127.0.0.1:8000/api/users/usuarios/').subscribe({
      next: (respuesta) => {
        // Si Django devuelve paginación ({results: [...]}), toma results; si no, toma la respuesta directa.
        this.usuarios = Array.isArray(respuesta) ? respuesta : (respuesta.results || []);
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
      email: '',
      password: '',
      nombre: '',
      apellido: '',
      id_rol: 0,
      activo: true
    };

    this.editar = false;
    this.modal = true;
  }

  // Abrir modal para editar
  abrirModalEditar(usuarioSeleccionado: any): void {
    this.usuario = {
      id_usuario: usuarioSeleccionado.id_usuario,
      email: usuarioSeleccionado.email,
      password: '', // La contraseña no se muestra por seguridad
      nombre: usuarioSeleccionado.nombre,
      apellido: usuarioSeleccionado.apellido,
      // Maneja si id_rol viene como objeto o como número directo
      id_rol: usuarioSeleccionado.id_rol?.id_rol || usuarioSeleccionado.id_rol,
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
      password: this.usuario.password,
      nombre: this.usuario.nombre,
      apellido: this.usuario.apellido,
      id_rol: this.usuario.id_rol,
      activo: this.usuario.activo
    };

    this.http.post(this.apiUrl, nuevoUsuario).subscribe({
      next: () => {
        alert('Usuario creado correctamente');
        this.listarUsuarios();
        this.cerrarModal();
      },
      error: (error) => {
        console.error('Error al crear usuario:', error.error);
        alert('Error al crear el usuario. Revisa la consola.');
      }
    });
  }

  // Actualizar usuario
  actualizarUsuario(): void {
    const usuarioActualizado = {
      email: this.usuario.email,
      nombre: this.usuario.nombre,
      apellido: this.usuario.apellido,
      id_rol: this.usuario.id_rol,
      activo: this.usuario.activo
    };

    this.http.put(`${'http://127.0.0.1:8000/api/users/usuarios/'}${this.usuario.id_usuario}/`, usuarioActualizado).subscribe({
      next: () => {
        alert('Usuario actualizado correctamente');
        this.listarUsuarios();
        this.cerrarModal();
      },
      error: (error) => {
        console.error('Error al actualizar usuario:', error.error);
        alert('Error al actualizar el usuario. Revisa la consola.');
      }
    });
  }

  // Eliminar usuario
  eliminarUsuario(id_usuario: number): void {
    if (confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
      this.http.delete(`${'http://127.0.0.1:8000/api/users/usuarios/'}${id_usuario}/`).subscribe({
        next: () => {
          alert('Usuario eliminado correctamente');
          this.listarUsuarios();
        },
        error: (error) => {
          console.error('Error al eliminar usuario:', error);
          alert('No se pudo eliminar el usuario.');
        }
      });
    }
  }

}