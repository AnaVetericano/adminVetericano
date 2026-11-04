# -*- coding: utf-8 -*-
"""
Script de normalización de inventario veterinario.
Ingeniería de Datos & Farmacología Veterinaria.
"""

import json
import re

# Cargamos los 290 items crudos
with open('parsed_items.json', 'r', encoding='utf-8') as f:
    raw_data = json.load(f)

print(f"Total raw items loaded: {len(raw_data)}")
