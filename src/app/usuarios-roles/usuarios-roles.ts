import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-usuarios-roles',
  standalone: true,
  imports: [FormsModule, RouterLink,CommonModule],
  templateUrl: './usuarios-roles.html',
  styleUrl: './usuarios-roles.css',
})
export class UsuariosRoles implements OnInit {

  usuarios: any[] = [];

  modal = false;
  editar = false;

  private apiUrl = 'http://127.0.0.1:8000/api/users/';

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

  //listar

  listarUsuarios(): void {

    this.http.get<any[]>(this.apiUrl).subscribe({

      next: (respuesta) => {
        this.usuarios = respuesta;
      },

      error: (error) => {
        console.error('Error al listar usuarios:', error);
      }

    });

  }

 //modal

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

  // modal editar

  abrirModalEditar(usuarioSeleccionado: any): void {

    this.usuario = {
      id_usuario: usuarioSeleccionado.id_usuario,
      email: usuarioSeleccionado.email,
      password: '',
      nombre: usuarioSeleccionado.nombre,
      apellido: usuarioSeleccionado.apellido,
      id_rol: usuarioSeleccionado.id_rol,
      activo: usuarioSeleccionado.activo
    };

    this.editar = true;
    this.modal = true;

  }

  // cierre modal

  cerrarModal(): void {
    this.modal = false;
  }

  // funcion guardar

  guardar(): void {

    if (this.editar) {
      this.actualizarUsuario();
    } else {
      this.crearUsuario();
    }

  }

  // crear usuario

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

        console.error(
          'Error al crear usuario:',
          error.error
        );

      }

    });

  }

  //actualizar 

  actualizarUsuario(): void {

    const usuarioActualizado = {
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

        alert('Usuario actualizado correctamente');

        this.listarUsuarios();
        this.cerrarModal();

      },

      error: (error) => {

        console.error(
          'Error al actualizar usuario:',
          error.error
        );

      }

    });

  }

  //eliminar 

  eliminarUsuario(id_usuario: number): void {

    if (confirm('¿Estás seguro de que deseas eliminar este usuario?')) {

      this.http.delete(
        `${this.apiUrl}${id_usuario}/`
      ).subscribe({

        next: () => {

          alert('Usuario eliminado correctamente');

          this.listarUsuarios();

        },

        error: (error) => {

          console.error(
            'Error al eliminar usuario:',
            error
          );

        }

      });

    }

  }

}