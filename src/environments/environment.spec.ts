import { environment as dev } from './environment.development';

/**
 * Barrera: el WebSocket debe ser del MISMO backend que la API REST (misma SECRET_KEY).
 * Un token emitido por el REST de Railway contra un ws local (o al revés) se rechaza con 4001.
 *
 * Nota: en las pruebas el builder sustituye environment.ts por environment.development.ts, así que
 * aquí se comprueba el de desarrollo (el que usa `ng serve`). El de producción se verifica en el
 * bundle de `ng build` (notificacionesHabilitadas/wsHabilitado true y la misma wsUrl).
 */
describe('environment.development (nube)', () => {
  it('API y WebSocket apuntan a Railway y el ws usa wss:// del mismo backend', () => {
    expect(dev.backendUrl).toMatch(/^https:\/\/[a-z0-9-]+\.up\.railway\.app$/);
    expect(dev.wsUrl).toBe('wss://vetericano-ws-production.up.railway.app/ws/notificaciones/');
  });
});
