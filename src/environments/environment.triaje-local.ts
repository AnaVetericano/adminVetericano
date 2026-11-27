// =========================================================================================
// CONFIGURACIÓN AISLADA PARA PRUEBAS DE TRIAJE INTELIGENTE EN PUERTO DEDICADO (8010)
// =========================================================================================
// Uso: ng serve -c triaje-local --port 4201
// No interfiere con el entorno habitual de localhost:4200 y 127.0.0.1:8000.
export const BACKEND_TRIAJE_LOCAL_URL = 'http://127.0.0.1:8010';
export const BACKEND_CLOUD_URL = 'https://backendvetericano-production.up.railway.app';

export const environment = {
  production: false,
  backendUrl: BACKEND_TRIAJE_LOCAL_URL,
  apiBaseUrl: `${BACKEND_TRIAJE_LOCAL_URL}/api`,

  apiUrlPeticiones: `${BACKEND_TRIAJE_LOCAL_URL}/api/peticiones/`,

  apiUrlClinica: `${BACKEND_TRIAJE_LOCAL_URL}/api/clinica/`,
  apiUrlHistorias: `${BACKEND_TRIAJE_LOCAL_URL}/api/clinica/historias/`,
  apiUrlConsultas: `${BACKEND_TRIAJE_LOCAL_URL}/api/clinica/consultas/`,
  apiUrlExpedienteCompleto: `${BACKEND_TRIAJE_LOCAL_URL}/api/clinica/expediente-completo/`,
  apiUrlExpedientePorAnimal: `${BACKEND_TRIAJE_LOCAL_URL}/api/clinica/expediente-por-animal/`,

  apiUrlDiagnosticoIA: `${BACKEND_TRIAJE_LOCAL_URL}/api/diagnostico-ia/sugerir/`,

  apiUrlAnimales: `${BACKEND_TRIAJE_LOCAL_URL}/api/animales/animales/`,
  apiUrl: `${BACKEND_TRIAJE_LOCAL_URL}/api/usuarios`,
  apiUrlespecies: `${BACKEND_TRIAJE_LOCAL_URL}/api/especies/`,
  apiUrlMedicamentos: `${BACKEND_TRIAJE_LOCAL_URL}/api/medicamentos/`,
  apiUrlInventario: `${BACKEND_TRIAJE_LOCAL_URL}/api/inventario/`,
  apiUrlMedicamentosCatalogo: `${BACKEND_TRIAJE_LOCAL_URL}/api/medicamentos-catalogo/`,
  apiUrlSedes: `${BACKEND_TRIAJE_LOCAL_URL}/api/sedes/`,
  apiUrlSuperAdmin: `${BACKEND_TRIAJE_LOCAL_URL}/api/super-administrador/`,

  notificacionesHabilitadas: true,
  wsHabilitado: false,
  wsUrl: 'ws://127.0.0.1:8012/ws/notificaciones/',
  wsRoles: [1, 2, 3, 5]
};
