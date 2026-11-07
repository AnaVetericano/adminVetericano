# -*- coding: utf-8 -*-
"""
Script de consolidación, validación y deduplicación.
"""

from catalog_part1 import CATALOG as c1
from catalog_part2 import CATALOG as c2
from catalog_part3 import CATALOG as c3
from catalog_part4 import CATALOG as c4
from catalog_part5 import CATALOG as c5
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

all_items = c1 + c2 + c3 + c4 + c5
print(f"Total raw items mapped: {len(all_items)}")

# 1. Validar longitudes de descripciones
for idx, raw, nombre, desc, tipo, via, cant in all_items:
    l = len(desc)
    assert 50 <= l <= 70, f"Error longitud en item {idx}: {l} -> {desc}"

print("-> Todas las 290 descripciones cumplen estrictamente con 50 <= longitud <= 70.")

# 2. Análisis de duplicados
# Analizamos por (nombre, cantidad, tipo, via) o por celdas idénticas / nombres comerciales exactamente iguales en todo su contenido.
# El prompt dice:
# "Si detectas dos o más celdas con información idéntica o nombres comerciales exactamente iguales en todo su contenido,
# elimina los duplicados y conserva únicamente un registro único (puedes incluir un breve reporte en texto al usuario indicando cuántos duplicados se unificaron)."

seen_keys = {}
unique_records = []
duplicates_report = []

for item in all_items:
    idx, raw, nombre, desc, tipo, via, cant = item
    
    # Llave de deduplicación normalizada
    # Si dos celdas tienen exactamente el mismo nombre comercial y la misma cantidad/presentación o el mismo contenido conceptual
    key = (nombre.strip().upper(), cant.strip().upper())
    
    if key in seen_keys:
        orig_idx, orig_item = seen_keys[key]
        duplicates_report.append({
            'duplicate_idx': idx,
            'duplicate_raw': raw,
            'original_idx': orig_idx,
            'original_raw': orig_item[1],
            'nombre': nombre,
            'cantidad': cant
        })
    else:
        seen_keys[key] = (idx, item)
        unique_records.append(item)

print(f"Total de registros unicos tras deduplicacion: {len(unique_records)}")
print(f"Total de duplicados unificados: {len(duplicates_report)}")

for dup in duplicates_report:
    print(f"  [Item {dup['duplicate_idx']:3d}] '{dup['duplicate_raw']}' unificado con [Item {dup['original_idx']:3d}] '{dup['original_raw']}' -> {dup['nombre']} ({dup['cantidad']})")
