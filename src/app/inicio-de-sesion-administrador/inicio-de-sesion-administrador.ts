import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-inicio-de-sesion-administrador',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './inicio-de-sesion-administrador.component.html',
  styleUrl: './inicio-de-sesion-administrador.component.css'
})
export class InicioDeSesionAdministradorComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);

  loginForm = this.fb.nonNullable.group({
    emailOrPhone: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  onLogin(): void {
    if (this.loginForm.valid) {
      console.log('Credenciales enviadas:', this.loginForm.value);
      // Redirecciona al panel principal tras autenticar
      this.router.navigate(['/inicio-administrador']);
    } else {
      this.loginForm.markAllAsTouched();
    }
  }
}