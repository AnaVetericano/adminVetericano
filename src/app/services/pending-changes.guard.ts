import { CanDeactivateFn } from '@angular/router';
import { Observable } from 'rxjs';

export interface ComponenteConCambiosPendientes {
  tieneCambiosPendientes: () => boolean | Observable<boolean> | Promise<boolean>;
}

/**
 * Guard para interceptar la navegación fuera del componente si hay cambios no guardados.
 * Permite que el componente gestione su propio modal visual o retorne confirmación.
 */
export const pendingChangesGuard: CanDeactivateFn<ComponenteConCambiosPendientes> = (
  component
) => {
  if (component && typeof component.tieneCambiosPendientes === 'function') {
    return component.tieneCambiosPendientes();
  }
  return true;
};
