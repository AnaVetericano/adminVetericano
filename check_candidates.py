# -*- coding: utf-8 -*-
"""
Comparación detallada de posibles duplicados adicionales.
"""

from test_dedup import all_items

candidates = [
    (119, 280, "TUBO VACUTAINER TAPA LILA"),
    (120, 279, "TUBO VACUTAINER TAPA ROJA"),
    (63, 273, "TEST DISTEMPER CANINO"),
    (91, 275, "TEST PARVOVIRUS"),
    (121, 271, "VACUNA QUINTUPLE CANINA"),
    (128, 277, "VACUNA TRIPLE FELINA"),
    (125, 278, "SOLUCION SALINA 0.9% / CLORURO DE SODIO 500 ML"),
    (37, 174, "CARDIAL TABLETAS"),
    (99, 224, "CAMPO QUIRURGICO DESECHABLE"),
]

for idx1, idx2, label in candidates:
    it1 = all_items[idx1 - 1]
    it2 = all_items[idx2 - 1]
    print(f"\n--- {label} ---")
    print(f"Item {it1[0]}: {it1[1]} | Cant: {it1[6]}")
    print(f"Item {it2[0]}: {it2[1]} | Cant: {it2[6]}")
