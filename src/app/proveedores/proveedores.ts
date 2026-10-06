import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-proveedores',
  standalone: true,
  imports: [FormsModule, CommonModule],
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
      Swal.fire('Error', 'El nombre del proveedor es requerido', 'error');
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
          Swal.fire('¡Actualizado!', 'Proveedor actualizado correctamente', 'success');
          this.listarProveedores();
          this.cerrarModal();
        },
        error: (err) => {
          console.error('Error al actualizar proveedor:', err);
          const msg = err.error?.detail || err.error?.mensaje || 'Hubo un error al actualizar';
          Swal.fire('Error', msg, 'error');
        }
      });
    } else {
      this.http.post(this.apiUrl, payload, { headers: this.getAuthHeaders() }).subscribe({
        next: () => {
          Swal.fire('¡Creado!', 'Proveedor creado correctamente', 'success');
          this.listarProveedores();
          this.cerrarModal();
        },
        error: (err) => {
          console.error('Error al crear proveedor:', err);
          const msg = err.error?.detail || err.error?.mensaje || 'Hubo un error al crear';
          Swal.fire('Error', msg, 'error');
        }
      });
    }
  }

  cambiarEstado(proveedorExistente: any): void {
    const nuevoEstado = !proveedorExistente.activo;
    
    // Mostramos confirmación
    Swal.fire({
      title: '¿Estás seguro?',
      text: `Vas a ${nuevoEstado ? 'activar' : 'inactivar'} al proveedor ${proveedorExistente.nombre}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4141a5',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, cambiar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        // PATCH only activo
        this.http.patch(`${this.apiUrl}${proveedorExistente.id_proveedor}/`, { activo: nuevoEstado }, { headers: this.getAuthHeaders() }).subscribe({
          next: () => {
            proveedorExistente.activo = nuevoEstado;
            Swal.fire('¡Cambiado!', 'El estado ha sido actualizado', 'success');
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Error al cambiar estado:', err);
            const msg = err.error?.detail || err.error?.mensaje || 'No se pudo cambiar el estado';
            Swal.fire('Error', msg, 'error');
          }
        });
      }
    });
  }
}
