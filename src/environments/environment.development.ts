// =========================================================================================
// CONFIGURACIÓN CENTRALIZADA DEL BACKEND EN LA NUBE (Render / Supabase / Railway / etc.)
// =========================================================================================
// 👉 PEGA AQUÍ LA URL DE TU SERVIDOR DESPLEGADO EN LA NUBE (ej. Render, Supabase, Railway):
// NOTA: Debe colocarse sin barra final ('/').
export const BACKEND_CLOUD_URL = 'https://backendvetericano-production.up.railway.app';

export const environment = {
  production: false,
  // Servidor raíz en la nube
  backendUrl: BACKEND_CLOUD_URL,
  apiBaseUrl: `${BACKEND_CLOUD_URL}/api`,

  // Endpoints del módulo de Historia Clínica
  apiUrlClinica: `${BACKEND_CLOUD_URL}/api/clinica/`,
  apiUrlHistorias: `${BACKEND_CLOUD_URL}/api/clinica/historias/`,
  apiUrlConsultas: `${BACKEND_CLOUD_URL}/api/clinica/consultas/`,
  apiUrlExpedienteCompleto: `${BACKEND_CLOUD_URL}/api/clinica/expediente-completo/`,
  apiUrlExpedientePorAnimal: `${BACKEND_CLOUD_URL}/api/clinica/expediente-por-animal/`,

  // Endpoints de módulos complementarios
  apiUrlAnimales: `${BACKEND_CLOUD_URL}/api/animales/animales/`,
  apiUrl: `${BACKEND_CLOUD_URL}/api/usuarios`,
  apiUrlespecies: `${BACKEND_CLOUD_URL}/api/especies/`,
  apiUrlMedicamentos: `${BACKEND_CLOUD_URL}/api/medicamentos/`,
  apiUrlInventario: `${BACKEND_CLOUD_URL}/api/inventario/`,
  apiUrlMedicamentosCatalogo: `${BACKEND_CLOUD_URL}/api/medicamentos-catalogo/`
};
