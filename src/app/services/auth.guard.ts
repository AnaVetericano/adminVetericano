import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

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
// mandar directo al panel.
export const loginGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('token');
  if (token) {
    router.navigate(['/inicio-admin']);
    return false;
  }
  return true;
};
