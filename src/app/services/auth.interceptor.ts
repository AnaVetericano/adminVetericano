import { HttpInterceptorFn } from '@angular/common/http';

// Endpoints públicos que NO deben llevar Authorization.
// Si enviamos un access viejo/expirado en el login, DRF lo valida primero
// y responde 401 "Given token not valid for any token type" sin revisar
// las credenciales, aunque el correo/clave sean correctos.
const PUBLIC_ENDPOINTS = [
  '/api/usuarios/login/',
  '/api/usuarios/register/',
  '/api/usuarios/registro/',
  '/api/usuarios/recuperar-password/',
  '/api/usuarios/confirmar-password/',
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // 1. Si es login/registro/recuperación, viaja sin token
  const esPublica = PUBLIC_ENDPOINTS.some((url) => req.url.includes(url));
  if (esPublica) {
    return next(req);
  }

  // 2. Obtener el token que ya guardas en el login
  const token = localStorage.getItem('token');

  // 3. Si existe un token, clonar la petición y agregar el encabezado Authorization
  if (token) {
    const peticionClonada = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(peticionClonada);
  }

  // 4. Si no hay token, viaja normal
  return next(req);
};
