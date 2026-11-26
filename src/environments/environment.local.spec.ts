import { environment } from './environment.local';

/**
 * Barrera: `ng serve -c local` nunca debe hablar con producción. Todas las URLs del entorno local
 * (REST y WebSocket) apuntan a 127.0.0.1 / localhost.
 */
describe('environment.local', () => {
  it('todas las URLs de REST y WebSocket son locales (sin Railway ni Vercel)', () => {
    const urls = Object.entries(environment).filter(
      ([, v]) => typeof v === 'string' && /^(https?|wss?):\/\//.test(v)
    );
    expect(urls.length).toBeGreaterThan(10);
    for (const [clave, url] of urls) {
      expect({ clave, local: /^(https?|wss?):\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(`${url}/`) })
        .toEqual({ clave, local: true });
    }
  });

  it('el WebSocket local usa ws:// a 127.0.0.1:8002 y las notificaciones quedan habilitadas', () => {
    expect(environment.wsUrl).toBe('ws://127.0.0.1:8002/ws/notificaciones/');
    expect(environment.notificacionesHabilitadas).toBe(true);
    expect(environment.wsHabilitado).toBe(true);
  });
});
