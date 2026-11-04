# -*- coding: utf-8 -*-
import re
from catalog_part1 import CATALOG as c1
from catalog_part2 import CATALOG as c2
from catalog_part3 import CATALOG as c3
from catalog_part4 import CATALOG as c4
from catalog_part5 import CATALOG as c5

all_items = c1 + c2 + c3 + c4 + c5
forms = ['crema', 'pomada', 'ungüento', 'gotas', 'jarabe', 'gel', 'suspensión', 'solución', 'spray', 'polvo', 'colirio', 'loción', 'champú', 'shampoo']

found = []
for it in all_items:
    desc = it[3].lower()
    for word in forms:
        if re.search(r'\b' + word + r'\b', desc, re.IGNORECASE):
            found.append((it[0], it[2], word, it[3]))

print(f"Total matches with dosage form words: {len(found)}")
for f in found[:25]:
    print(f"Item {f[0]:3d} [{f[1]}]: contains '{f[2]}' -> '{f[3]}'")
