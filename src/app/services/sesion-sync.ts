import { DestroyRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, renovacionRechazada } from './auth';
import { AlertasDuplicadosService } from './alertas-duplicados.service';

const RUTA_LOGIN = '/iniciodesesionadministrador';
const CLAVES_SESION = ['token', 'refresh_token', 'user_session'];

/**
 * Mantiene la sesión al día sin bloquear el arranque:
 *  1. Al abrir el panel renueva el token, así el rol que se ve es el actual del servidor.
 *  2. Al volver a la pestaña renueva otra vez (como mucho cada 5 minutos).
 *  3. Sincroniza las pestañas abiertas: si en una se cierra sesión, las demás también;
 *     si en otra se renueva el token, aquí se actualiza el rol; si entra otra cuenta, se recarga.
 *
 * Se registra con provideAppInitializer en app.config.ts.
 */
export function iniciarSincronizacionSesion(): void {
  const auth = inject(AuthService);
  const router = inject(Router);
  const alertas = inject(AlertasDuplicadosService);

  // Quita los oyentes si la aplicación se destruye
  const oyentes = new AbortController();
  inject(DestroyRef).onDestroy(() => oyentes.abort());

  const cerrarSesionLocal = () => {
    auth.logout();
    alertas.limpiarEstado();
    router.navigate([RUTA_LOGIN]);
  };

  const renovar = () => {
    if (!localStorage.getItem('refresh_token')) return;
    auth.renovarToken().subscribe({
      error: (err) => {
        // Solo se cierra si el servidor rechazó el refresh; un fallo de red no saca al usuario
        if (renovacionRechazada(err) && localStorage.getItem('refresh_token')) {
          cerrarSesionLocal();
        }
      }
    });
  };

  // 1. Al abrir
  renovar();

  // 2. Al volver a la pestaña
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && auth.debeRenovar()) {
      renovar();
    }
  }, { signal: oyentes.signal });

  // 3. Entre pestañas (el evento solo llega a las OTRAS pestañas, no a la que hizo el cambio)
  let usuarioActual = auth.idUsuarioDelToken();
  window.addEventListener('storage', (evento) => {
    // key null = localStorage.clear()
    if (evento.key !== null && !CLAVES_SESION.includes(evento.key)) return;

    const usuarioNuevo = auth.idUsuarioDelToken();

    if (usuarioNuevo === null) {
      // Se cerró la sesión en otra pestaña
      if (usuarioActual !== null) {
        auth.sincronizarDesdeAlmacenamiento();
        alertas.limpiarEstado();
        router.navigate([RUTA_LOGIN]);
      }
    } else if (usuarioNuevo !== usuarioActual) {
      // Entró otra cuenta (o se inició sesión) en otra pestaña: recargar con la sesión nueva
      window.location.reload();
    } else {
      // Misma cuenta: token renovado o datos de perfil actualizados
      auth.sincronizarDesdeAlmacenamiento();
    }

    usuarioActual = usuarioNuevo;
  }, { signal: oyentes.signal });
}
