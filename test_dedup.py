# -*- coding: utf-8 -*-
from catalog_part1 import CATALOG as c1
from catalog_part2 import CATALOG as c2
from catalog_part3 import CATALOG as c3
from catalog_part4 import CATALOG as c4
from catalog_part5 import CATALOG as c5

all_items = c1 + c2 + c3 + c4 + c5

# Ajustes específicos para homologar duplicados reales entre la lista comercial (1-174) y la lista genérica/insumos (175-290)
# Item 26 y 223: BURETROL -> CANTIDAD: UNIDAD
# Item 39 y 231: JERINGA 5 ML -> CANTIDAD: 5 ML
# Item 57 y 225: EQUIPO VENOCLISIS MACROGOTEO -> CANTIDAD: UNIDAD
# Item 169 y 226: EQUIPO VENOCLISIS MICROGOTEO -> CANTIDAD: UNIDAD
# Item 172 y 219: AGUJA HIPODERMICA 23G -> CANTIDAD: 23G X 1"
# Item 216 y 249: EXTRACTO DE HIGADO DE CERDO -> CANTIDAD: 0.083 G
# Item 244 y 250: ACIDO SALICILICO + AZUFRE ANTISARNA -> CANTIDAD: 2% + 2%
# Item 257 y 258: OXIDO DE ZINC + LIDOCAINA + ALANTOINA + NEOMICINA -> CANTIDAD: POMADA CSP 100 G
# Item 80 y 81: NEOLYTIC MUCOLITICO -> X 120 ML
# Item 88 y 89: BERBEEL - OMACOOR -> AMPOLLA X 5 ML
# Item 145 y 146: ZEEL COMPOSITUM -> AMPOLLA X 5 ML
# Item 83 y 160: VERDEMINT -> X 50 G
# Item 221 y 222: BOLSAS PARA RESIDUOS HOSPITALARIOS -> PAQUETE
# Item 107 y 230: JERINGA 3 ML -> 3 ML
# Item 129 y 272: VACUNA LEUCEMIA FELINA -> DOSIS

# Vamos a ver cuántos duplicados exactos e idénticos se detectan
seen = {}
unique = []
dups = []

for item in all_items:
    idx, raw, nombre, desc, tipo, via, cant = item
    
    # Normalización para matching
    n_clean = nombre.strip().upper()
    c_clean = cant.strip().upper().replace('MILILITROS', 'ML').replace('GRAMOS', 'G').replace('GR', 'G')
    c_clean = c_clean.replace('X ', '').replace('X', '').strip()
    
    # Reglas de equivalencia clínica exacta
    if n_clean in ["BURETROLE", "BURETROL"]:
        n_clean = "BURETROL"
        c_clean = "UNIDAD"
    elif n_clean in ["VENOCLISIS MACRO", "EQUIPO VENOCLISIS MACROGOTEO"]:
        n_clean = "EQUIPO VENOCLISIS MACROGOTEO"
        c_clean = "UNIDAD"
    elif n_clean in ["VENOCLISIS MICRO", "EQUIPO VENOCLISIS MICROGOTEO"]:
        n_clean = "EQUIPO VENOCLISIS MICROGOTEO"
        c_clean = "UNIDAD"
    elif n_clean in ["AGUJA HIPODERMICA 23G", "AGUJA 23 DESECHABLE"]:
        n_clean = "AGUJA HIPODERMICA 23G"
        c_clean = "23G X 1\""
    elif "EXTRACTO DE HIGADO" in n_clean:
        n_clean = "EXTRACTO DE HIGADO DE CERDO"
        c_clean = "0.083 G"
    elif "ACIDO SALICILICO" in n_clean and "AZUFRE" in n_clean:
        n_clean = "ACIDO SALICILICO + AZUFRE ANTISARNA"
        c_clean = "SOLUCION 2% + 2%"
    elif "OXIDO DE ZINC" in n_clean and "LIDOCAINA" in n_clean:
        n_clean = "OXIDO DE ZINC + LIDOCAINA + ALANTOINA + NEOMICINA"
        c_clean = "POMADA CSP 100 G"
    elif n_clean == "JERINGA 5 ML":
        c_clean = "5 ML"
    elif n_clean == "JERINGA 3 ML":
        c_clean = "3 ML"
    elif n_clean in ["VERDEMINT"]:
        c_clean = "50 G"
    elif n_clean in ["BOLSAS PARA RESIDUOS HOSPITALARIOS"]:
        c_clean = "PAQUETE"
    elif n_clean in ["ZEEL COMPOSITUM"]:
        c_clean = "AMPOLLA 5 ML"
    elif n_clean in ["NEOLYTIC MUCOLITICO"]:
        c_clean = "120 ML"
    elif n_clean in ["BERBEEL - OMACOOR"]:
        c_clean = "AMPOLLA 5 ML"
    elif n_clean in ["VACUNA LEUCEMIA FELINA"]:
        c_clean = "DOSIS"

    k = (n_clean, c_clean)
    if k in seen:
        dups.append((idx, raw, seen[k][0], seen[k][1]))
    else:
        seen[k] = (idx, item)
        unique.append(item)

print(f"Total unicos: {len(unique)}")
print(f"Total duplicados detectados: {len(dups)}")
for d in dups:
    print(f"  [Item {d[0]:3d}] '{d[1]}' == [Item {d[2]:3d}] '{d[3][1]}'")
