# -*- coding: utf-8 -*-
"""
Auditoría Final de Control de Calidad del Archivo Excel.
"""

import openpyxl

wb = openpyxl.load_workbook("inventario_veterinario_procesado.xlsx")
ws = wb.active

headers = [cell.value for cell in ws[1]]
print("Encabezados:", headers)
expected_headers = ['NOMBRE', 'DESCRIPCIÓN', 'TIPO', 'VÍA DE ADMINISTRACIÓN', 'CANTIDAD']
assert headers == expected_headers, f"Encabezados no coinciden: {headers} vs {expected_headers}"

row_count = ws.max_row
print(f"Filas totales (incluyendo cabecera): {row_count}")
print(f"Total registros de datos: {row_count - 1}")

desc_lengths = []
errors = []

for r in range(2, row_count + 1):
    nombre = ws.cell(row=r, column=1).value
    desc = ws.cell(row=r, column=2).value
    tipo = ws.cell(row=r, column=3).value
    via = ws.cell(row=r, column=4).value
    cant = ws.cell(row=r, column=5).value
    
    if not all([nombre, desc, tipo, via, cant]):
        errors.append(f"Fila {r}: Contiene campo nulo o vacío -> {[nombre, desc, tipo, via, cant]}")
    
    l = len(desc) if desc else 0
    desc_lengths.append(l)
    if l < 50 or l > 70:
        errors.append(f"Fila {r} [{nombre}]: Longitud de descripción inválida ({l}) -> '{desc}'")

print(f"Longitud de descripciones: Mínima={min(desc_lengths)}, Máxima={max(desc_lengths)}")
print(f"Total de inconsistencias encontradas: {len(errors)}")
if errors:
    for e in errors[:10]:
        print("  ERROR:", e)
else:
    print("-> AUDITORÍA 100% EXITOSA. Todos los registros cumplen estrictamente con los criterios requeridos.")
