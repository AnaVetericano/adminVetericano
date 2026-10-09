import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService, UserRole } from './auth';
import Swal from 'sweetalert2';

// Guard de sesión persistente vía localStorage.
// La sesión SOLO se cierra con "Cerrar sesión" del sidebar (onLogout),
// que borra token/refresh_token. Cerrar la ventana NO cierra sesión.
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('token');
  if (token) {
    return true;
  }
  router.navigate(['/iniciodesesionadministrador']);
  return false;
};

// Guard inverso: si ya hay token, no mostrar login/register/landing de acceso,
// mandar directo al panel según el rol activo.
export const loginGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const token = localStorage.getItem('token');
  if (token) {
    if (authService.isVeterinario()) {
      router.navigate(['/inicio-admin/acta-seres-sintientes']);
    } else {
      router.navigate(['/inicio-admin']);
    }
    return false;
  }
  return true;
};

// Guard de Control de Acceso Basado en Roles (RBAC)
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const token = localStorage.getItem('token');

  if (!token) {
    router.navigate(['/iniciodesesionadministrador']);
    return false;
  }

  const allowedRoles = route.data['roles'] as UserRole[] | undefined;

  // Si la ruta no especifica restricción de roles, se permite el acceso
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  // Si el usuario tiene uno de los roles permitidos
  if (authService.hasRole(allowedRoles)) {
    return true;
  }

  // Notificación de acceso no autorizado
  Swal.fire({
    title: 'Acceso Restringido',
    text: 'Tu rol actual no tiene autorización para acceder a este módulo.',
    icon: 'warning',
    confirmButtonText: 'Entendido',
    confirmButtonColor: '#4141A5',
    customClass: {
      popup: 'rounded-2xl',
      confirmButton: 'rounded-xl px-5 py-2.5 font-bold'
    }
  });

  // Redirección inteligente al módulo principal según su rol
  if (authService.isVeterinario()) {
    router.navigate(['/inicio-admin/acta-seres-sintientes']);
  } else {
    router.navigate(['/inicio-admin']);
  }

  return false;
};


