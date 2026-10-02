import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // 1. Obtener el token que ya guardas en el login
  const token = localStorage.getItem('token');

  // 2. Si existe un token, clonar la petición y agregar el encabezado Authorization
  if (token) {
    const peticionClonada = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(peticionClonada);
  }

  // 3. Si no hay token (por ejemplo en el login o registro), viaja normal
  return next(req);
};
