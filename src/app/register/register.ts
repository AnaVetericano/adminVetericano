import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth';
import Swal from 'sweetalert2';

import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register implements OnDestroy {
  mostrarPassword: boolean = false;
  cargandoRegistro: boolean = false;

  // Estado del modal de verificación de correo por código OTP
  mostrarModalVerificacion: boolean = false;
  codigoVerificacion: string = '';
  cargandoConfirmacion: boolean = false;
  cargandoReenvio: boolean = false;
  mensajeExitoModal: string = '';
  mensajeErrorModal: string = '';
  cooldownRestante: number = 0;
  private cooldownIntervalId: any = null;

  register = {
    email: '',
    identificacion: '',
    password: '',
    nombre: '',
    apellido: '',
  };

  constructor(
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnDestroy(): void {
    this.detenerCooldownTimer();
  }

  private iniciarCooldownTimer(segundos: number = 60): void {
    this.detenerCooldownTimer();
    this.cooldownRestante = segundos;
    this.cdr.detectChanges();
    this.cooldownIntervalId = setInterval(() => {
      if (this.cooldownRestante > 0) {
        this.cooldownRestante--;
        this.cdr.detectChanges();
      } else {
        this.detenerCooldownTimer();
        this.cdr.detectChanges();
      }
    }, 1000);
  }

  private detenerCooldownTimer(): void {
    if (this.cooldownIntervalId) {
      clearInterval(this.cooldownIntervalId);
      this.cooldownIntervalId = null;
    }
  }

  volverAlInicio(): void {
    this.router.navigate(['/']);
  }

  private extraerMensajeError(err: any, fallback: string): string {
    const errData = err?.error;
    if (!errData || typeof errData !== 'object') {
      return fallback;
    }
    const primerCampo = Object.keys(errData)[0];
    return (
      errData.error ||
      errData.detail ||
      errData.mensaje ||
      (primerCampo && Array.isArray(errData[primerCampo]) ? errData[primerCampo][0] : null) ||
      fallback
    );
  }

  registrarse() {
    if (this.cargandoRegistro) {
      return;
    }

    if (!this.register.email || !this.register.identificacion || !this.register.password || !this.register.nombre || !this.register.apellido) {
      Swal.fire({
        title: 'Campos obligatorios incompletos',
        text: 'Complete todos los campos obligatorios para continuar.',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    if (this.register.password.length < 8 || !/[A-Z]/.test(this.register.password)) {
      Swal.fire({
        title: 'Contraseña insegura',
        text: 'La contraseña debe tener al menos 8 caracteres e incluir al menos una letra mayúscula.',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    this.cargandoRegistro = true;
    this.cdr.detectChanges();

    this.authService.solicitarCodigoRegistro(this.register).subscribe({
      next: (respuesta) => {
        this.cargandoRegistro = false;
        this.codigoVerificacion = '';
        this.mensajeErrorModal = '';
        this.mensajeExitoModal =
          respuesta?.mensaje || `Te enviamos un código de 6 dígitos a ${this.register.email}.`;
        this.mostrarModalVerificacion = true;
        this.iniciarCooldownTimer(respuesta?.cooldown_segundos || 60);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargandoRegistro = false;
        this.cdr.detectChanges();
        const mensajeReal = this.extraerMensajeError(err, 'Ocurrió un error al validar el registro.');
        Swal.fire({
          title: 'No fue posible iniciar la verificación',
          text: mensajeReal,
          icon: 'error',
          confirmButtonText: 'Aceptar'
        });
      }
    });
  }

  reenviarCodigoVerificacion(): void {
    if (this.cargandoReenvio || this.cooldownRestante > 0) {
      return;
    }

    this.cargandoReenvio = true;
    this.mensajeErrorModal = '';
    this.mensajeExitoModal = '';
    this.cdr.detectChanges();

    this.authService.solicitarCodigoRegistro(this.register).subscribe({
      next: (res) => {
        this.cargandoReenvio = false;
        this.mensajeExitoModal = res?.mensaje || 'Se ha enviado un nuevo código a tu correo.';
        this.iniciarCooldownTimer(res?.cooldown_segundos || 60);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargandoReenvio = false;
        const retry = Number(err?.error?.retry_after);
        if (!isNaN(retry) && retry > 0) {
          this.iniciarCooldownTimer(retry);
        }
        this.mensajeErrorModal = this.extraerMensajeError(err, 'No se pudo reenviar el código.');
        this.cdr.detectChanges();
      }
    });
  }

  confirmarCodigoYCrearCuenta(): void {
    if (this.cargandoConfirmacion) {
      return;
    }

    const codigoLimpio = (this.codigoVerificacion || '').trim();
    if (codigoLimpio.length !== 6) {
      this.mensajeErrorModal = 'Por favor ingresa el código de verificación de 6 dígitos.';
      this.cdr.detectChanges();
      return;
    }

    this.cargandoConfirmacion = true;
    this.mensajeErrorModal = '';
    this.mensajeExitoModal = '';
    this.cdr.detectChanges();

    this.authService
      .confirmarCodigoRegistro({
        email: this.register.email.trim(),
        codigo: codigoLimpio
      })
      .subscribe({
        next: (respuesta) => {
          this.cargandoConfirmacion = false;
          this.mostrarModalVerificacion = false;
          this.detenerCooldownTimer();
          this.cdr.detectChanges();

          Swal.fire({
            title: '¡Correo verificado y cuenta creada!',
            text: respuesta?.mensaje || 'Tu cuenta ha sido verificada y registrada correctamente.',
            icon: 'success',
            confirmButtonText: 'Aceptar'
          }).then(() => {
            this.router.navigate(['/iniciodesesionadministrador']);
          });
        },
        error: (err) => {
          this.cargandoConfirmacion = false;
          this.mensajeErrorModal = this.extraerMensajeError(
            err,
            'El código de verificación es incorrecto o ha expirado.'
          );
          this.cdr.detectChanges();
        }
      });
  }

  cerrarModalVerificacion(): void {
    this.mostrarModalVerificacion = false;
    this.mensajeErrorModal = '';
    this.mensajeExitoModal = '';
    this.cdr.detectChanges();
  }

  iniciarSesion() {
    this.router.navigate(['/iniciodesesionadministrador']);
  }
}