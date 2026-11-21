import * as XLSX from 'xlsx';

/**
 * Normaliza encabezados o cadenas para comparación tolerante a tildes, espacios y mayúsculas.
 */
export function normalizarTextoExcel(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Obtiene el valor de la primera columna coincidente en una fila de Excel.
 */
export function obtenerValorColumnaExcel(row: Record<string, any>, posiblesNombres: string[]): string {
  const keys = Object.keys(row || {});
  for (const posible of posiblesNombres) {
    const posNorm = normalizarTextoExcel(posible);
    const keyFound = keys.find(k => normalizarTextoExcel(k) === posNorm);
    if (keyFound && row[keyFound] !== undefined && row[keyFound] !== null) {
      const val = String(row[keyFound]).trim();
      if (val) return val;
    }
  }
  return '';
}

/**
 * Lee un archivo Excel (.xlsx / .xls) y retorna las filas de su primera hoja como objetos JSON.
 */
export function leerPrimeraHojaExcel(file: File): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('El archivo no contiene ninguna hoja de cálculo.');
        }
        const hoja = workbook.Sheets[workbook.SheetNames[0]];
        const filas: Record<string, any>[] = XLSX.utils.sheet_to_json(hoja, { defval: '' });
        resolve(filas || []);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Determina si un error HTTP corresponde a endpoint ausente (404/405) para habilitar fallback.
 */
export function esEndpointNoDisponible(err: any): boolean {
  const st = Number(err?.status);
  return st === 404 || st === 405 || st === 0;
}
