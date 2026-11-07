# -*- coding: utf-8 -*-
"""
Generador Maestro del Inventario Veterinario Normalizado en Excel (.xlsx)
Ingeniería de Datos & Farmacología Veterinaria Especializada.
"""

import os
import shutil
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from catalog_part1 import CATALOG as c1
from catalog_part2 import CATALOG as c2
from catalog_part3 import CATALOG as c3
from catalog_part4 import CATALOG as c4
from catalog_part5 import CATALOG as c5

# Lista total de los 290 ítems
ALL_RAW_ITEMS = c1 + c2 + c3 + c4 + c5
assert len(ALL_RAW_ITEMS) == 290, f"Error: esperados 290 items, encontrados {len(ALL_RAW_ITEMS)}"

# Normalización fina y Deduplicación
# Definimos los duplicados y su correspondencia
DEDUP_MAPPING = {
    # (duplicate_raw_index, original_raw_index, reason)
    81: (80, "Error tipográfico en celda original (ML9 vs ML). Misma presentación."),
    89: (88, "Error tipográfico en celda original (MILILITROS10 vs MILILITROS). Misma presentación."),
    146: (145, "Espaciado y denominación idéntica ('ZEELAMPOLLA' vs 'ZEEL AMPOLLA'). Misma ampolla x 5 ml."),
    160: (83, "Ítem idéntico repetido en la lista ('VERDEMINT X 50 GRAMS' vs 'X 50 GRAMOS')."),
    219: (172, "Ítem técnico idéntico ('AGUJA 23 DESECHABLE' vs 'Agujas hipodermica # 23 G 1\"')."),
    222: (221, "Celda idéntica consecutiva ('Bolsas rojas/ negras / blancas / verdes')."),
    223: (26, "Ítem técnico idéntico ('BURETROLE X UNIDAD' vs 'Buretrol')."),
    225: (57, "Ítem técnico idéntico ('VENOCLISIS X UNIDAD MACRO' vs 'Equipo venoclisis macrogoteo')."),
    226: (169, "Ítem técnico idéntico ('VENOCLISIS X UNIDAD MICRO' vs 'Equipo venoclisis microgoteo')."),
    230: (107, "Ítem técnico idéntico ('JERINGA 3 ML' vs 'Jeringas 3 ml')."),
    231: (39, "Ítem técnico idéntico ('JERINGA X 5ML' vs 'Jeringas 5 ml')."),
    249: (216, "Fórmula idéntica repetida ('Extracto natural de hígado de cerdo 0,083 g' vs 'Extracto de hígado 0.083 g')."),
    250: (244, "Fórmula queratolítica idéntica ('ácido salicílico azufre antisarna' vs 'Ácido salicílico 2g/100ml, Azufre 2g/100ml')."),
    257: (252, "Fórmula dermatológica idéntica ('Oxido de Zinc... Lidocaina... Neomicina...' vs formulación tópica)."),
    258: (252, "Fórmula dermatológica idéntica ('UT balance Oxido de Zinc...')."),
    272: (129, "Biológico idéntico ('Vacuna Leucemia felina' vs 'VACUNA LEUCEMIA FELINA')."),
    273: (63, "Prueba diagnóstica idéntica ('Prueba de dispemper canino' vs 'TEST MOQUILLO- DISTEMPER')."),
    275: (91, "Prueba diagnóstica idéntica ('Prueba de parvovirus' vs 'TEST DE PARVOVIRUS BIONOTE X UNIDAD')."),
    277: (128, "Biológico idéntico ('Triple felina' vs 'VACUNA PUREVAX TRIPLE FELINA X DOSIS')."),
    278: (125, "Solución cristaloide idéntica ('Solución salina 500ml' vs 'CLORURO DE SODIO AL 0,9% X 500 ML')."),
    279: (120, "Insumo de laboratorio idéntico ('Tubo tapa roja vacutainer' vs 'TUBO TAPA ROJA X UNIDAD')."),
    280: (119, "Insumo de laboratorio idéntico ('Tubo vacutainer tapa lila' vs 'TUBO LILA X UNIDAD')."),
    271: (121, "Biológico idéntico ('Vacuna quintuple canino' vs 'CANIGEN MHA2PPI/L QUINTUPLE X DOSIS')."),
    224: (99, "Insumo quirúrgico idéntico ('Campos quirúrgicos de mesa de cirugía' vs 'CAMPO QUIRÚRGICO DESECHABLE')."),
}

dedup_report = []
processed_rows = []

for item in ALL_RAW_ITEMS:
    idx, raw, nombre, desc, tipo, via, cant = item
    
    # Verificamos si este índice fue identificado como duplicado
    if idx in DEDUP_MAPPING:
        orig_idx, reason = DEDUP_MAPPING[idx]
        orig_item = ALL_RAW_ITEMS[orig_idx - 1]
        dedup_report.append({
            'idx_duplicado': idx,
            'texto_duplicado': raw,
            'idx_original': orig_idx,
            'texto_original': orig_item[1],
            'nombre_unificado': orig_item[2],
            'cantidad_unificada': orig_item[6],
            'razon': reason
        })
        continue  # Omitimos el duplicado
    
    # Validamos restricciones del registro a incorporar
    l_desc = len(desc)
    assert 50 <= l_desc <= 70, f"Error longitud descripción en ítem {idx}: {l_desc} caracteres -> '{desc}'"
    
    processed_rows.append({
        'NOMBRE': nombre.strip().upper(),
        'DESCRIPCIÓN': desc.strip(),
        'TIPO': tipo.strip(),
        'VÍA DE ADMINISTRACIÓN': via.strip(),
        'CANTIDAD': cant.strip()
    })

print(f"Total ítems crudos analizados: {len(ALL_RAW_ITEMS)}")
print(f"Total registros duplicados unificados: {len(dedup_report)}")
print(f"Total registros únicos exportados: {len(processed_rows)}")

# Creación del libro de Excel con openpyxl
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Inventario Normalizado CBA"

# Encabezados requeridos con exactitud de mayúsculas y acentos
HEADERS = ["NOMBRE", "DESCRIPCIÓN", "TIPO", "VÍA DE ADMINISTRACIÓN", "CANTIDAD"]
ws.append(HEADERS)

# Estilos profesionales
header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid") # Azul corporativo oscuro
header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

data_font = Font(name="Calibri", size=10)
data_alignment_left = Alignment(horizontal="left", vertical="center")
data_alignment_center = Alignment(horizontal="center", vertical="center")

thin_border_side = Side(border_style="thin", color="D1D5DB")
data_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)

zebra_fill = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")

# Formatear encabezado
ws.row_dimensions[1].height = 28
for col_idx in range(1, len(HEADERS) + 1):
    cell = ws.cell(row=1, column=col_idx)
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = header_alignment
    cell.border = data_border

# Insertar datos y aplicar estilos
for row_idx, row_data in enumerate(processed_rows, start=2):
    ws.row_dimensions[row_idx].height = 22
    is_even = (row_idx % 2 == 0)
    current_fill = zebra_fill if is_even else None
    
    ws.cell(row=row_idx, column=1, value=row_data['NOMBRE'])
    ws.cell(row=row_idx, column=2, value=row_data['DESCRIPCIÓN'])
    ws.cell(row=row_idx, column=3, value=row_data['TIPO'])
    ws.cell(row=row_idx, column=4, value=row_data['VÍA DE ADMINISTRACIÓN'])
    ws.cell(row=row_idx, column=5, value=row_data['CANTIDAD'])
    
    for col_idx in range(1, 6):
        c = ws.cell(row=row_idx, column=col_idx)
        c.font = data_font
        c.border = data_border
        if current_fill:
            c.fill = current_fill
        
        if col_idx in [1, 2]:
            c.alignment = data_alignment_left
        elif col_idx in [3, 4, 5]:
            c.alignment = data_alignment_center

# Autoajuste de anchos de columna
column_widths = {
    1: 34, # NOMBRE
    2: 74, # DESCRIPCIÓN (para que quepan los 50-70 caracteres perfectamente legibles)
    3: 38, # TIPO
    4: 38, # VÍA DE ADMINISTRACIÓN
    5: 24  # CANTIDAD
}
for col_idx, width in column_widths.items():
    col_letter = get_column_letter(col_idx)
    ws.column_dimensions[col_letter].width = width

# Habilitar autofiltro en el encabezado
ws.auto_filter.ref = f"A1:E{len(processed_rows) + 1}"

# Guardar en las rutas requeridas
target_workspace_path = r"d:\ANGULAR\adminVetericano\inventario_veterinario_procesado.xlsx"
artifact_dir = r"C:\Users\Asus\.gemini\antigravity\brain\4a5bac80-7bbf-481b-b2ff-a64ea7a987e4"
target_artifact_path = os.path.join(artifact_dir, "inventario_veterinario_procesado.xlsx")

wb.save(target_workspace_path)
print(f"Archivo guardado en el workspace: {target_workspace_path}")

try:
    shutil.copy2(target_workspace_path, target_artifact_path)
    print(f"Archivo copiado al directorio de artefactos: {target_artifact_path}")
except Exception as e:
    print(f"Advertencia al copiar a artefactos: {e}")

# Guardar reporte de duplicados en JSON para inspección
with open("reporte_deduplicacion.json", "w", encoding="utf-8") as f:
    import json
    json.dump(dedup_report, f, ensure_ascii=False, indent=2)

print("Proceso completado exitosamente con 100% de cumplimiento de especificaciones.")
