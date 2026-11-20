/**
 * Resultado explícito de un consumo del kit de campo enviado a
 * POST /api/inventario/kit/sincronizar-offline/.
 *
 * - CONFIRMADO: HTTP 200 y el client_uuid enviado aparece en `aplicados` con estado APLICADO.
 * - RECHAZADO: 4xx (403 no veterinario, 409 CONFLICTO_STOCK_KIT, 400 validación/dominio, ...)
 *   o validación local (medicamento fuera del kit / sin saldo). El stock local NO se descuenta.
 * - PENDIENTE: sin conexión (status 0) o resultado incierto (5xx, respuesta sin confirmación).
 *   Se conserva el registro local como antes, pero nunca se presenta como éxito.
 */
export type EstadoConsumoKit = 'CONFIRMADO' | 'RECHAZADO' | 'PENDIENTE';

export interface ResultadoConsumoKit {
  estado: EstadoConsumoKit;
  mensaje: string;
  clientUuid: string | null;
  idMedicamento: number;
  unidades: number;
  nombreMedicamento?: string;
  /** null cuando no se hizo llamada HTTP (rechazo local); 0 sin conexión. */
  httpStatus: number | null;
  codigo?: string;
  unidadesDescontadas?: number;
  conflictos?: any[];
}

export interface ContextoConsumoKit {
  clientUuid: string | null;
  idMedicamento: number;
  unidades: number;
  nombreMedicamento?: string;
}

/**
 * Origen clínico exigido por el backend para el consumo DIRECTO en sincronizar-offline
 * (inventario/services/consumo_service.py::_resolver_origen_item): al menos un identificador
 * de historia (id_consulta / id_tratamiento) O de acta (id_seguimiento_visita / id_visita_animal),
 * sin mezclar ambos grupos. Solo deben enviarse identificadores confirmados por el backend.
 */
export interface OrigenClinicoConsumo {
  id_consulta?: number | null;
  id_tratamiento?: number | null;
  id_seguimiento_visita?: number | null;
  id_visita_animal?: number | null;
}

export const CODIGO_ORIGEN_CLINICO_REQUERIDO = 'ORIGEN_CLINICO_REQUERIDO';

export const MENSAJE_ORIGEN_CLINICO_REQUERIDO =
  'El descuento del kit requiere el vínculo con una consulta o una visita ya registrada en el servidor. ' +
  'No se envió el consumo y no se descontó del inventario.';

function idPositivo(valor: any): number | null {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Normaliza el origen clínico con los nombres exactos del contrato. Devuelve null si no hay
 * ningún identificador válido o si se mezclan identificadores de historia y de acta.
 */
export function normalizarOrigenClinicoConsumo(origen: OrigenClinicoConsumo | null | undefined): OrigenClinicoConsumo | null {
  if (!origen || typeof origen !== 'object') return null;
  const historia: OrigenClinicoConsumo = {};
  const acta: OrigenClinicoConsumo = {};
  const consulta = idPositivo(origen.id_consulta);
  const tratamiento = idPositivo(origen.id_tratamiento);
  const seguimiento = idPositivo(origen.id_seguimiento_visita);
  const visita = idPositivo(origen.id_visita_animal);
  if (consulta) historia.id_consulta = consulta;
  if (tratamiento) historia.id_tratamiento = tratamiento;
  if (seguimiento) acta.id_seguimiento_visita = seguimiento;
  if (visita) acta.id_visita_animal = visita;
  const tieneHistoria = Object.keys(historia).length > 0;
  const tieneActa = Object.keys(acta).length > 0;
  if (tieneHistoria === tieneActa) return null; // ninguno, o ambos grupos mezclados
  return tieneHistoria ? historia : acta;
}

function mismoUuid(a: any, b: string | null): boolean {
  if (!b || a === null || a === undefined) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function aplanarTextos(valor: any, salida: string[], profundidad = 0): void {
  if (salida.length >= 3 || profundidad > 4 || valor === null || valor === undefined) return;
  if (typeof valor === 'string') {
    const t = valor.trim();
    if (t) salida.push(t);
  } else if (Array.isArray(valor)) {
    valor.forEach((v) => aplanarTextos(v, salida, profundidad + 1));
  } else if (typeof valor === 'object') {
    Object.keys(valor).forEach((k) => aplanarTextos(valor[k], salida, profundidad + 1));
  }
}

/**
 * Extrae el mensaje legible del cuerpo de error del backend de inventario:
 * conflictos[].motivo_rechazo, detalle / mensaje / detail (traducir_error_inventario y DRF)
 * o errores de validación del serializer. Devuelve null si no hay texto utilizable.
 */
export function extraerMensajeBackendKit(body: any, clientUuid: string | null = null): string | null {
  if (body === null || body === undefined) return null;
  if (typeof body === 'string') {
    const t = body.trim();
    // Páginas HTML de proxy/servidor no se muestran al usuario
    if (!t || t.startsWith('<')) return null;
    return t.slice(0, 300);
  }
  if (typeof body !== 'object') return null;

  const conflictos = Array.isArray(body.conflictos) ? body.conflictos : [];
  const conflicto = conflictos.find((c: any) => mismoUuid(c?.client_uuid, clientUuid)) || conflictos[0];
  if (conflicto && typeof conflicto.motivo_rechazo === 'string' && conflicto.motivo_rechazo.trim()) {
    return conflicto.motivo_rechazo.trim();
  }

  for (const clave of ['detalle', 'mensaje', 'detail', 'message']) {
    const v = body[clave];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }

  const textos: string[] = [];
  Object.keys(body)
    .filter((k) => !['error', 'codigo', 'aplicados', 'conflictos', 'client_uuid'].includes(k))
    .forEach((k) => aplanarTextos(body[k], textos));
  if (textos.length > 0) return textos.join('; ');

  return null;
}

/** Clasifica una respuesta HTTP 2xx de sincronizar-offline. */
export function clasificarRespuestaConsumoKit(body: any, ctx: ContextoConsumoKit): ResultadoConsumoKit {
  const base = {
    clientUuid: ctx.clientUuid,
    idMedicamento: ctx.idMedicamento,
    unidades: ctx.unidades,
    nombreMedicamento: ctx.nombreMedicamento,
    httpStatus: 200
  };
  const aplicados = Array.isArray(body?.aplicados) ? body.aplicados : [];
  const conflictos = Array.isArray(body?.conflictos) ? body.conflictos : [];

  const conflictoPropio = conflictos.find((c: any) => mismoUuid(c?.client_uuid, ctx.clientUuid));
  if (conflictoPropio) {
    return {
      ...base,
      estado: 'RECHAZADO',
      codigo: 'CONFLICTO_STOCK_KIT',
      conflictos,
      mensaje: `El servidor rechazó el descuento del kit: ${extraerMensajeBackendKit(body, ctx.clientUuid) || 'conflicto de stock.'}`
    };
  }

  const aplicado = aplicados.find((a: any) => mismoUuid(a?.client_uuid, ctx.clientUuid));
  const estadoAplicado = String(aplicado?.estado ?? 'APLICADO').toUpperCase();
  if (aplicado && estadoAplicado === 'APLICADO') {
    const descontadas = Number(aplicado.unidades_descontadas);
    return {
      ...base,
      estado: 'CONFIRMADO',
      unidadesDescontadas: Number.isFinite(descontadas) ? descontadas : ctx.unidades,
      mensaje: 'Consumo confirmado por el servidor y descontado del kit.'
    };
  }

  if (aplicado) {
    return {
      ...base,
      estado: 'RECHAZADO',
      codigo: estadoAplicado,
      mensaje: `El servidor no aplicó el consumo (estado ${estadoAplicado}).`
    };
  }

  // 200 sin el client_uuid en aplicados: no hay confirmación inequívoca.
  return {
    ...base,
    estado: 'PENDIENTE',
    codigo: 'SIN_CONFIRMACION',
    mensaje: 'El servidor respondió sin confirmar el consumo. Quedó registrado solo localmente, pendiente de sincronizar; el descuento del kit no está confirmado.'
  };
}

/**
 * Clasifica un error de sincronizar-offline:
 * - status 0 → PENDIENTE (sin conexión).
 * - 5xx → PENDIENTE (incierto: el servidor/proxy pudo procesarlo o no; no es éxito).
 * - 4xx → RECHAZADO con el mensaje real del backend.
 * - Error no HTTP (p. ej. timeout) → PENDIENTE.
 */
export function clasificarErrorConsumoKit(err: any, ctx: ContextoConsumoKit): ResultadoConsumoKit {
  // HttpErrorResponse (o cualquier error con status numérico); otro tipo de error → NaN (incierto)
  const status = typeof err?.status === 'number' ? Number(err.status) : NaN;
  const body = err?.error;
  const base = {
    clientUuid: ctx.clientUuid,
    idMedicamento: ctx.idMedicamento,
    unidades: ctx.unidades,
    nombreMedicamento: ctx.nombreMedicamento
  };
  const codigoBackend = typeof body?.error === 'string' ? body.error : (typeof body?.codigo === 'string' ? body.codigo : undefined);
  const mensajeBackend = extraerMensajeBackendKit(body, ctx.clientUuid);

  if (status === 0) {
    return {
      ...base,
      estado: 'PENDIENTE',
      httpStatus: 0,
      codigo: 'SIN_CONEXION',
      mensaje: 'Sin conexión con el servidor. El consumo quedó registrado solo localmente, pendiente de sincronizar; el descuento del kit no está confirmado.'
    };
  }

  if (status >= 400 && status < 500) {
    let fallback = `El servidor rechazó el descuento del kit (HTTP ${status}).`;
    if (status === 403) fallback = 'No tienes permisos de veterinario activo para descontar del kit.';
    else if (status === 409) fallback = 'El servidor rechazó el descuento del kit por conflicto de stock.';
    else if (status === 400) fallback = 'El servidor rechazó los datos del consumo; no se descontó del kit.';
    return {
      ...base,
      estado: 'RECHAZADO',
      httpStatus: status,
      codigo: codigoBackend,
      conflictos: Array.isArray(body?.conflictos) ? body.conflictos : undefined,
      // Se conserva el texto real del backend (p. ej. "detalle" de CONSUMO_INVALIDO) con un prefijo legible
      mensaje: mensajeBackend ? `El servidor rechazó el descuento del kit: ${mensajeBackend}` : fallback
    };
  }

  if (status >= 500) {
    return {
      ...base,
      estado: 'PENDIENTE',
      httpStatus: status,
      codigo: codigoBackend || 'ERROR_SERVIDOR',
      mensaje: `El servidor no confirmó el consumo (HTTP ${status}). Quedó registrado solo localmente, pendiente de verificar y sincronizar; el descuento del kit no está confirmado.`
    };
  }

  return {
    ...base,
    estado: 'PENDIENTE',
    httpStatus: Number.isFinite(status) ? status : null,
    codigo: 'RESULTADO_INCIERTO',
    mensaje: 'No se obtuvo confirmación del servidor. El consumo quedó registrado solo localmente, pendiente de sincronizar; el descuento del kit no está confirmado.'
  };
}

/** Rechazo local sin llamada HTTP (medicamento fuera del kit o sin saldo). */
export function resultadoRechazoLocalKit(ctx: ContextoConsumoKit, mensaje: string, codigo = 'NO_DISPONIBLE_EN_KIT'): ResultadoConsumoKit {
  return {
    estado: 'RECHAZADO',
    mensaje,
    clientUuid: null,
    idMedicamento: ctx.idMedicamento,
    unidades: ctx.unidades,
    nombreMedicamento: ctx.nombreMedicamento,
    httpStatus: null,
    codigo
  };
}

/**
 * Resultado PENDIENTE de una administración registrada antes (tarjeta) cuyo descuento quedó
 * sin confirmar. Se usa para advertir al guardar sin reenviar el consumo (sin nuevo client_uuid).
 */
export function resultadoPendientePrevioKit(med: any): ResultadoConsumoKit {
  return {
    estado: 'PENDIENTE',
    mensaje: 'Registrado solo localmente; el descuento del kit sigue pendiente de sincronizar (no confirmado). No se reenvió.',
    clientUuid: null,
    idMedicamento: Number(med?.id_medicamento || med?.id) || 0,
    unidades: Number(med?.cantidadPendienteKit || med?.cantidadAAdministrar) || 0,
    nombreMedicamento: med?.nombre,
    httpStatus: null,
    codigo: 'PENDIENTE_PREVIO'
  };
}

/**
 * Devuelve alertas_farmacia.conflictos_stock de una respuesta de guardado clínico
 * (historia / acta). Lista vacía si no hay conflictos.
 */
export function extraerConflictosStockFarmacia(resp: any): any[] {
  const conflictos = resp?.alertas_farmacia?.conflictos_stock;
  return Array.isArray(conflictos) ? conflictos.filter((c: any) => c !== null && c !== undefined) : [];
}

/**
 * Texto (plano, apto para `text:` de SweetAlert) que diferencia "registro clínico guardado"
 * de "descuento del kit no confirmado". Devuelve null si todos los consumos se confirmaron
 * y no hay conflictos de farmacia.
 */
export function construirAvisoGuardadoClinico(
  tipo: 'historia' | 'acta',
  resultados: ResultadoConsumoKit[],
  conflictosFarmacia: any[] = []
): string | null {
  const rechazados = (resultados || []).filter((r) => r && r.estado === 'RECHAZADO');
  const pendientes = (resultados || []).filter((r) => r && r.estado === 'PENDIENTE');
  const conflictos = Array.isArray(conflictosFarmacia) ? conflictosFarmacia : [];
  if (rechazados.length === 0 && pendientes.length === 0 && conflictos.length === 0) return null;

  const sujeto = tipo === 'historia' ? 'Historia clínica guardada correctamente' : 'Acta guardada correctamente';
  const varios = rechazados.length + conflictos.length > 1;
  const partes: string[] = [];

  if (rechazados.length > 0 || conflictos.length > 0) {
    partes.push(varios
      ? `${sujeto}, pero algunos medicamentos no fueron descontados del kit. Revisa las alertas de farmacia.`
      : `${sujeto}, pero el medicamento no fue descontado del kit. Revisa las alertas de farmacia.`);
  } else {
    partes.push(`${sujeto}, pero el descuento del kit quedó pendiente de sincronizar y no está confirmado por el servidor.`);
  }

  const nombre = (r: { nombreMedicamento?: string; idMedicamento?: number }) =>
    r.nombreMedicamento || (r.idMedicamento ? `Medicamento #${r.idMedicamento}` : 'Medicamento');

  rechazados.forEach((r) => partes.push(`No descontado: ${nombre(r)} (${r.unidades} uds) — ${r.mensaje}`));
  pendientes.forEach((r) => partes.push(`Pendiente de sincronizar (no confirmado): ${nombre(r)} (${r.unidades} uds) — ${r.mensaje}`));
  conflictos.forEach((c) => {
    const nom = c?.nombre_medicamento || (c?.id_medicamento ? `Medicamento #${c.id_medicamento}` : 'Medicamento');
    const motivo = c?.motivo_rechazo || 'conflicto de stock en el kit';
    partes.push(`Alerta de farmacia: ${nom} — ${motivo}`);
  });

  return partes.join(' ');
}
