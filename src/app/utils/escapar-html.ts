/**
 * Escapa un valor para insertarlo dentro de HTML construido como texto
 * (por ejemplo en las opciones `html`/`title` de SweetAlert2, que se insertan con innerHTML).
 *
 * Todo dato que venga de usuarios, de la base de datos o del backend (nombres, correos,
 * descripciones, mensajes de error) debe pasar por aquí: se mostrará como texto literal y
 * nunca se interpretará como etiquetas, scripts ni atributos (`onerror`, `onclick`, ...).
 * Los caracteres Unicode y las tildes se conservan tal cual.
 *
 * Misma semántica que los `escaparHtml` privados que ya existen en inventario e
 * inventario-juridico.
 */
const ENTIDADES_HTML: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escaparHtml(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return '';
  }
  return String(valor).replace(/[&<>"']/g, (caracter) => ENTIDADES_HTML[caracter]);
}
