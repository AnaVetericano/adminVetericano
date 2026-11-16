import { ApplicationConfig, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './services/auth.interceptor';
import { iniciarSincronizacionSesion } from './services/sesion-sync';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor])),
    // Renueva el token al abrir y al volver a la pestaña, y sincroniza pestañas (no bloquea el arranque)
    provideAppInitializer(iniciarSincronizacionSesion)
  ]
};
