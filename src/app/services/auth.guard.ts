import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService, UserRole } from './auth';
import Swal from 'sweetalert2';

// Guard de sesión persistente vía localStorage.
// La sesión se cierra con "Cerrar sesión" del sidebar (onLogout) o cuando
// el interceptor no puede renovar el token (refresh vencido o rechazado).
// Cerrar la ventana NO cierra sesión.
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
    if (authService.isSuperAdmin()) {
      router.navigate(['/inicio-admin/super-dashboard']);
    } else if (authService.isJuridico()) {
      router.navigate(['/inicio-admin/dashboard-juridico']);
    } else if (authService.isVeterinario()) {
      router.navigate(['/inicio-admin/dashboard-veterinario']);
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

  // Sin rol identificable no se supone ninguno: cerrar sesión y pedir iniciar de nuevo
  if (!authService.userRole()) {
    authService.logout();
    router.navigate(['/iniciodesesionadministrador']);
    return false;
  }

  // Notificación de acceso no autorizado
  Swal.fire({
    title: 'Acceso restringido',
    text: 'Su rol no tiene autorización para acceder a este módulo.',
    icon: 'warning',
    confirmButtonText: 'Aceptar'
  });

  // Redirección inteligente al módulo principal según su rol
  if (authService.isSuperAdmin()) {
    router.navigate(['/inicio-admin/super-dashboard']);
  } else if (authService.isJuridico()) {
    router.navigate(['/inicio-admin/dashboard-juridico']);
  } else if (authService.isVeterinario()) {
    router.navigate(['/inicio-admin/dashboard-veterinario']);
  } else {
    router.navigate(['/inicio-admin']);
  }

  return false;
};
