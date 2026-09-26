import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import Swal from 'sweetalert2';

interface Pet {
  id?: number;
  nombre: string;     // Coincide con tu backend (nombre en lugar de name)
  raza: string;       // Coincide con tu backend (raza en lugar de breed)
  imagen: string;     // Coincide con tu backend (imagen en lugar de image)
  descripcion: string;// Coincide con tu backend (descripcion en lugar de desc)
  estado: string;     // Coincide con tu backend (estado en lugar de status)
  fecha: string;      // Coincide con tu backend (fecha en lugar de date)
}

@Component({
  selector: 'app-adopciones',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './adopciones.html',
  styleUrl: './adopciones.css',
})
export class Adopciones implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef); // Inyectamos ChangeDetectorRef

  // Tu URL exacta de Railway
  private apiUrl = 'https://backendvetericano-production.up.railway.app/api/adopciones/';

  pets: Pet[] = [];
  searchTerm: string = '';
  isModalOpen: boolean = false;
  isEditMode: boolean = false;
  currentId: number | null = null;

  // Objeto actual mapeado a los nombres que espera tu API en español
  currentPet: Pet = {
    nombre: '',
    raza: '',
    imagen: '',
    descripcion: '',
    estado: 'Disponible',
    fecha: new Date().toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' })
  };

  ngOnInit() {
    this.loadPets();
  }

  // 1. OBTENER LAS MASCOTAS (GET)
  loadPets() {
    this.http.get<Pet[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.pets = data;
        this.cdr.detectChanges(); // Forzamos la detección de cambios al recibir los datos
      },
      error: (err) => {
        console.error("Error al cargar las mascotas:", err);
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'No se pudieron cargar las mascotas desde el servidor.',
          confirmButtonColor: '#3085d6'
        });
      }
    });
  }

  // Filtrar mascotas según el buscador
  get filteredPets(): Pet[] {
    return this.pets.filter(pet => 
      (pet.nombre && pet.nombre.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
      (pet.raza && pet.raza.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
      (pet.descripcion && pet.descripcion.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
      (pet.estado && pet.estado.toLowerCase().includes(this.searchTerm.toLowerCase()))
    );
  }

  // Abrir modal (Crear o Editar)
  openModal(index: number | null = null) {
    if (index !== null) {
      this.isEditMode = true;
      const selectedPet = this.filteredPets[index];
      this.currentId = selectedPet.id || null;
      this.currentPet = { ...selectedPet };
    } else {
      this.isEditMode = false;
      this.currentId = null;
      const fechaActual = new Date().toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' });
      this.currentPet = { 
        nombre: '', 
        raza: '', 
        imagen: '', 
        descripcion: '', 
        estado: 'Disponible', 
        fecha: fechaActual 
      };
    }
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  // 2. GUARDAR (POST para crear / PUT para actualizar)
  savePet() {
    if (!this.currentPet.nombre || !this.currentPet.raza || !this.currentPet.imagen || !this.currentPet.descripcion) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos incompletos',
        text: 'Por favor completa todos los campos obligatorios.',
        confirmButtonColor: '#f8bb86'
      });
      return;
    }

    if (this.isEditMode && this.currentId !== null) {
      // Petición PUT para actualizar
      this.http.put<Pet>(`${this.apiUrl}${this.currentId}/`, this.currentPet).subscribe({
        next: (updatedPet) => {
          const index = this.pets.findIndex(p => p.id === this.currentId);
          if (index !== -1) {
            this.pets[index] = updatedPet;
          }
          this.closeModal();
          this.cdr.detectChanges(); // Refrescamos la vista
          Swal.fire({
            icon: 'success',
            title: '¡Actualizado!',
            text: 'La información de la mascota se ha actualizado correctamente.',
            timer: 2000,
            showConfirmButton: false
          });
        },
        error: (err) => {
          console.error("Error al actualizar:", err);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un error al actualizar la mascota.',
            confirmButtonColor: '#d33'
          });
        }
      });
    } else {
      // Petición POST para crear nueva mascota
      this.http.post<Pet>(this.apiUrl, this.currentPet).subscribe({
        next: (newPet) => {
          this.pets.unshift(newPet);
          this.closeModal();
          this.cdr.detectChanges(); // Refrescamos la vista
          Swal.fire({
            icon: 'success',
            title: '¡Registrado!',
            text: 'La mascota se ha agregado con éxito a la base de datos.',
            timer: 2000,
            showConfirmButton: false
          });
        },
        error: (err) => {
          console.error("Error al crear:", err);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un error al guardar la mascota en la API.',
            confirmButtonColor: '#d33'
          });
        }
      });
    }
  }

  // 3. ELIMINAR MASCOTA (DELETE)
  deletePet(index: number) {
    const petToDelete = this.filteredPets[index];
    
    Swal.fire({
      title: `¿Estás seguro de eliminar a ${petToDelete.nombre}?`,
      text: "¡Esta acción no se puede revertir!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, ¡eliminar!',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        if (!petToDelete.id) {
          this.pets = this.pets.filter(p => p !== petToDelete);
          this.cdr.detectChanges();
          return;
        }

        this.http.delete(`${this.apiUrl}${petToDelete.id}/`).subscribe({
          next: () => {
            this.pets = this.pets.filter(p => p.id !== petToDelete.id);
            this.cdr.detectChanges(); // Refrescamos la vista tras eliminar
            Swal.fire({
              icon: 'success',
              title: '¡Eliminado!',
              text: 'El registro ha sido eliminado exitosamente.',
              timer: 2000,
              showConfirmButton: false
            });
          },
          error: (err) => {
            console.error("Error al eliminar:", err);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'No se pudo eliminar el registro de la API.',
              confirmButtonColor: '#d33'
            });
          }
        });
      }
    });
  }
}