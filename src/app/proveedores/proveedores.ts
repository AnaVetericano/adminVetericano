import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';
import { AnimalIconComponent } from '../animal-icon/animal-icon';
import { PageTitleComponent } from '../page-title/page-title';

@Component({
  selector: 'app-proveedores',
  standalone: true,
  imports: [FormsModule, CommonModule, AnimalIconComponent, PageTitleComponent],
  templateUrl: './proveedores.html',
  styleUrl: './proveedores.css',
})
export class Proveedores implements OnInit {

  textoBusqueda: string = '';
  proveedoresFiltrados: any[] = [];
  proveedores: any[] = [];

  modal = false;
  editar = false;
  mostrarFiltros = false;

  private apiUrl = 'https://backendvetericano-production.up.railway.app/api/inventario/proveedores/';

  proveedor = {
    id_proveedor: 0,
    nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    activo: true
  };

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.listarProveedores();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({ 'Authorization': `Bearer ${token}` });
  }

  listarProveedores(): void {
    this.http.get<any>(this.apiUrl, { headers: this.getAuthHeaders() }).subscribe({
      next: (respuesta) => {
        const lista = Array.isArray(respuesta) ? respuesta : (respuesta.results || []);
        this.proveedores = lista;
        this.proveedoresFiltrados = [...this.proveedores];
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error al listar proveedores:', error);
      }
    });
  }

  filtrarProveedores(): void {
    const busqueda = this.textoBusqueda.toLowerCase().trim();
    if (!busqueda) {
      this.proveedoresFiltrados = [...this.proveedores];
    } else {
      this.proveedoresFiltrados = this.proveedores.filter(p =>
        (p.nombre && p.nombre.toLowerCase().includes(busqueda)) ||
        (p.email && p.email.toLowerCase().includes(busqueda)) ||
        (p.telefono && p.telefono.includes(busqueda))
      );
    }
  }

  abrirModalCrear(): void {
    this.proveedor = {
      id_proveedor: 0,
      nombre: '',
      telefono: '',
      email: '',
      direccion: '',
      activo: true
    };
    this.editar = false;
    this.modal = true;
  }

  abrirModalEditar(proveedorExistente: any): void {
    this.proveedor = { ...proveedorExistente };
    this.editar = true;
    this.modal = true;
  }

  cerrarModal(): void {
    this.modal = false;
    this.proveedor = {
      id_proveedor: 0,
      nombre: '',
      telefono: '',
      email: '',
      direccion: '',
      activo: true
    };
  }

  guardar(): void {
    if (!this.proveedor.nombre || this.proveedor.nombre.trim() === '') {
      Swal.fire({
        icon: 'error',
        title: 'Campo obligatorio',
        text: 'Ingrese el nombre del proveedor.',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    // Adapt payload
    const payload = {
      nombre: this.proveedor.nombre,
      telefono: this.proveedor.telefono,
      email: this.proveedor.email,
      direccion: this.proveedor.direccion,
      activo: this.proveedor.activo
    };

    if (this.editar) {
      this.http.put(`${this.apiUrl}${this.proveedor.id_proveedor}/`, payload, { headers: this.getAuthHeaders() }).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Proveedor actualizado',
            text: 'Los datos del proveedor se guardaron correctamente.',
            confirmButtonText: 'Aceptar'
          });
          this.listarProveedores();
          this.cerrarModal();
        },
        error: (err) => {
          console.error('Error al actualizar proveedor:', err);
          const msg = err.error?.detail || err.error?.mensaje || 'No se pudo actualizar el proveedor';
          Swal.fire({
            icon: 'error',
            title: 'No fue posible actualizar el proveedor',
            text: msg,
            confirmButtonText: 'Aceptar'
          });
        }
      });
    } else {
      this.http.post(this.apiUrl, payload, { headers: this.getAuthHeaders() }).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Proveedor registrado',
            text: 'El proveedor se creó correctamente.',
            confirmButtonText: 'Aceptar'
          });
          this.listarProveedores();
          this.cerrarModal();
        },
        error: (err) => {
          console.error('Error al crear proveedor:', err);
          const msg = err.error?.detail || err.error?.mensaje || 'No se pudo registrar el proveedor';
          Swal.fire({
            icon: 'error',
            title: 'No fue posible registrar el proveedor',
            text: msg,
            confirmButtonText: 'Aceptar'
          });
        }
      });
    }
  }

  cambiarEstado(proveedorExistente: any): void {
    const nuevoEstado = !proveedorExistente.activo;
    
    // Mostramos confirmación
    Swal.fire({
      title: 'Confirmar cambio de estado',
      text: `Se va a ${nuevoEstado ? 'activar' : 'inactivar'} el proveedor ${proveedorExistente.nombre}.`,
      icon: 'warning',
      customClass: { popup: nuevoEstado ? '' : 'qa-destructivo' },
      showCancelButton: true,
      confirmButtonText: nuevoEstado ? 'Activar' : 'Inactivar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        // PATCH only activo
        this.http.patch(`${this.apiUrl}${proveedorExistente.id_proveedor}/`, { activo: nuevoEstado }, { headers: this.getAuthHeaders() }).subscribe({
          next: () => {
            proveedorExistente.activo = nuevoEstado;
            Swal.fire({
              icon: 'success',
              title: 'Estado actualizado',
              text: 'El estado del proveedor se actualizó correctamente.',
              confirmButtonText: 'Aceptar'
            });
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Error al cambiar estado:', err);
            const msg = err.error?.detail || err.error?.mensaje || 'No se pudo cambiar el estado';
            Swal.fire({
              icon: 'error',
              title: 'No fue posible cambiar el estado',
              text: msg,
              confirmButtonText: 'Aceptar'
            });
          }
        });
      }
    });
  }
}
