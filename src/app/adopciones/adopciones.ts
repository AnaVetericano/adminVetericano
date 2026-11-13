import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import Swal from 'sweetalert2';
import { HistoriaClinicaService } from '../services/historia-clinica.service';
import { environment, BACKEND_CLOUD_URL } from '../../environments/environment';

interface Pet {
  id?: number;
  numero_historia?: string;
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
  imports: [CommonModule, FormsModule],
  templateUrl: './adopciones.html',
  styleUrl: './adopciones.css',
})
export class Adopciones implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private historiaService = inject(HistoriaClinicaService);

  // Tu URL exacta de Railway
  private apiUrl = 'https://backendvetericano-production.up.railway.app/api/adopciones/';
  private readonly defaultImagen = 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80';

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

  private get authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return token
      ? new HttpHeaders({
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        })
      : new HttpHeaders({ 'Content-Type': 'application/json' });
  }

  private normalizarImagen(url?: string): string {
    if (!url || !url.trim() || url === 'null' || url === 'undefined') {
      return this.defaultImagen;
    }
    const u = url.trim();
    if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:image/') || u.startsWith('blob:')) {
      return u;
    }
    const baseUrl = (environment.backendUrl || BACKEND_CLOUD_URL || 'https://backendvetericano-production.up.railway.app').replace(/\/+$/, '');
    if (u.startsWith('/')) {
      return `${baseUrl}${u}`;
    }
    return `${baseUrl}/media/${u}`;
  }

  ngOnInit() {
    this.loadPets();
  }

  // 1. OBTENER LAS MASCOTAS (GET) Y SINCRONIZAR CON ALTAS MÉDICAS DE HOSPITALIZADOS CBA
  loadPets() {
    this.http.get<any>(this.apiUrl, { headers: this.authHeaders }).subscribe({
      next: (resp) => {
        const rawList: Pet[] = Array.isArray(resp) ? resp : (Array.isArray(resp?.results) ? resp.results : []);
        const syncLocal = this.historiaService.obtenerTodasAdopcionesLocales();
        const procesados: Pet[] = [];
        const idsVistos = new Set<number>();

        rawList.forEach((p: any) => {
          const idNum = Number(p?.id);
          const localInfo = idNum > 0 ? syncLocal[String(idNum)] : null;
          const cbaLocal = idNum > 0 ? this.historiaService.obtenerEstadoCbaLocal(null, idNum) : null;

          // Si el animal reingresó a Hospitalizados CBA, no mostrarlo en Adopciones mientras esté hospitalizado
          if (cbaLocal?.ingresa_cba === true) {
            return;
          }

          const estadoResuelto = localInfo !== undefined && localInfo !== null
            ? (localInfo.disponible_adopcion ? (localInfo.estado || 'Disponible') : 'No Disponible')
            : (p.estado || 'No Disponible');

          // Mostrar únicamente los animales que fueron enviados a adopción o creados en Adopciones (excluir 'No Disponible')
          if (estadoResuelto === 'No Disponible') {
            return;
          }

          if (idNum > 0) idsVistos.add(idNum);

          procesados.push({
            id: p.id,
            numero_historia: localInfo?.numero_historia || (p.id ? `HC-${p.id}` : ''),
            nombre: localInfo?.nombre || p.nombre || 'Mascota CBA',
            raza: localInfo?.raza || p.raza || 'Mestizo',
            imagen: this.normalizarImagen(localInfo?.imagen || p.imagen),
            descripcion:
              localInfo?.descripcion ||
              p.descripcion ||
              'Paciente recuperado satisfactoriamente en el Centro de Bienestar Animal (CBA), fuera de peligro y apto para adopción responsable.',
            estado: estadoResuelto,
            fecha: p.fecha || localInfo?.fecha || new Date().toISOString().split('T')[0]
          });
        });

        // Incorporar cualquier animal recién dado de alta hacia adopción que aún esté sincronizándose
        Object.keys(syncLocal).forEach((key) => {
          const item = syncLocal[key];
          const idNum = Number(item?.id_animal || item?.id || key);
          const cbaLocal = idNum > 0 ? this.historiaService.obtenerEstadoCbaLocal(item?.id_historia, idNum) : null;
          if (item?.disponible_adopcion && !cbaLocal?.ingresa_cba && !idsVistos.has(idNum)) {
            procesados.unshift({
              id: idNum,
              numero_historia: item.numero_historia || '',
              nombre: item.nombre || 'Mascota CBA',
              raza: item.raza || 'Mestizo',
              imagen: this.normalizarImagen(item.imagen),
              descripcion: item.descripcion || 'Paciente recuperado en el CBA, fuera de peligro y apto para adopción.',
              estado: item.estado || 'Disponible',
              fecha: item.fecha || new Date().toISOString().split('T')[0]
            });
          }
        });

        this.pets = procesados;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar las mascotas:', err);
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
      this.http.put<Pet>(`${this.apiUrl}${this.currentId}/`, this.currentPet, { headers: this.authHeaders }).subscribe({
        next: (updatedPet) => {
          this.historiaService.guardarEstadoAdopcionLocal(this.currentId, this.currentPet.estado !== 'No Disponible', {
            nombre: this.currentPet.nombre,
            raza: this.currentPet.raza,
            imagen: this.currentPet.imagen,
            descripcion: this.currentPet.descripcion,
            estado: this.currentPet.estado
          });
          const index = this.pets.findIndex(p => p.id === this.currentId);
          if (index !== -1) {
            this.pets[index] = {
              ...this.pets[index],
              ...updatedPet,
              estado: this.currentPet.estado,
              imagen: this.normalizarImagen(this.currentPet.imagen)
            };
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
      this.http.post<Pet>(this.apiUrl, this.currentPet, { headers: this.authHeaders }).subscribe({
        next: (newPet) => {
          if (newPet?.id) {
            this.historiaService.guardarEstadoAdopcionLocal(newPet.id, true, {
              nombre: newPet.nombre || this.currentPet.nombre,
              raza: newPet.raza || this.currentPet.raza,
              imagen: newPet.imagen || this.currentPet.imagen,
              descripcion: newPet.descripcion || this.currentPet.descripcion,
              estado: this.currentPet.estado || 'Disponible'
            });
          }
          this.pets.unshift({
            ...newPet,
            imagen: this.normalizarImagen(newPet?.imagen || this.currentPet.imagen)
          });
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

        this.http.put(`${this.apiUrl}${petToDelete.id}/`, { ...petToDelete, estado: 'No Disponible' }, { headers: this.authHeaders }).subscribe({
          next: () => {
            this.historiaService.guardarEstadoAdopcionLocal(petToDelete.id, false);
            this.pets = this.pets.filter(p => p.id !== petToDelete.id);
            this.cdr.detectChanges(); // Refrescamos la vista tras retirar de adopción
            Swal.fire({
              icon: 'success',
              title: '¡Retirado de Adopciones!',
              text: 'La mascota fue retirada del listado de adopciones (su historia clínica se conserva intacta).',
              timer: 2000,
              showConfirmButton: false
            });
          },
          error: (err) => {
            console.error("Error al retirar de adopciones:", err);
            this.historiaService.guardarEstadoAdopcionLocal(petToDelete.id, false);
            this.pets = this.pets.filter(p => p.id !== petToDelete.id);
            this.cdr.detectChanges();
          }
        });
      }
    });
  }
}