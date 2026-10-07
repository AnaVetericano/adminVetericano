import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-acta-seres-sintientes',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule
  ],
  templateUrl: './acta-seres-sintientes.html',
  styleUrl: './acta-seres-sintientes.css',
})
export class ActaSeresSintientes implements OnInit {

  popalog = {
    logopop: 'images/Escudo_Popayan.svg'
  };

  pestanaActiva: string = 'consulta';

  // Datos que vienen del backend
  seguimientos: any[] = [];

  // Animal seleccionado
  seguimientoSeleccionado: any = null;

  cargando: boolean = false;
  error: string = '';

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarSeguimientos();
  }

  cambiarPestana(pestana: string) {
    this.pestanaActiva = pestana;
  }

  cargarSeguimientos(): void {

    this.cargando = true;
    this.error = '';

    this.authService.listarSeguimientos().subscribe({

      next: (respuesta) => {

        console.log('Respuesta seguimiento:', respuesta);

        if (Array.isArray(respuesta)) {
          this.seguimientos = respuesta;
        }
        else if (respuesta?.results) {
          this.seguimientos = respuesta.results;
        }
        else {
          this.seguimientos = [];
        }

        console.log('Seguimientos cargados:', this.seguimientos);

        this.cargando = false;
        this.cdr.detectChanges();
      },

      error: (error) => {

        console.error('Error cargando seguimientos:', error);

        this.error = 'No se pudieron cargar los animales en espera.';

        this.cargando = false;
        this.cdr.detectChanges();
      }

    });
  }

  // ==========================================
  // SELECCIONAR ANIMAL
  // ==========================================

  seleccionarSeguimiento(seguimiento: any): void {

    console.log('Animal seleccionado:', seguimiento);

    this.seguimientoSeleccionado = seguimiento;

    console.log('Nombre:', seguimiento?.nombre_paciente);
    console.log('Especie:', seguimiento?.paciente_especie);
    console.log('Raza:', seguimiento?.paciente_raza);
    console.log('Sexo:', seguimiento?.paciente_sexo);
    console.log('Color:', seguimiento?.paciente_color);
    console.log('Edad:', seguimiento?.paciente_edad);
    console.log('Peso:', seguimiento?.peso_paciente);

    // Datos que pueden venir dentro de animales
    console.log('Animales:', seguimiento?.animales);

    this.cdr.detectChanges();
  }

  sistemas: { [key: string]: string } = {

    general: 'N',
    hidratacion: 'N',
    tegumentario: 'AN',
    ojos: 'N',
    oidos: 'N',
    nariz: 'N',
    digestivo: 'N',
    respiratorio: 'N',
    nervioso: 'N',
    musculoesqueletico: 'AN',
    cardiovascular: 'N',
    genitourinario: 'N'

  };

}