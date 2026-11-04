import json

with open('parsed_items.json', 'r', encoding='utf-8') as f:
    items = json.load(f)

print("--- Items 61 to 120 ---")
for it in items[60:120]:
    print(f"{it['idx']:3d}: {it['raw']}")

print("--- Items 121 to 180 ---")
for it in items[120:180]:
    print(f"{it['idx']:3d}: {it['raw']}")

print("--- Items 181 to 240 ---")
for it in items[180:240]:
    print(f"{it['idx']:3d}: {it['raw']}")

print("--- Items 241 to 290 ---")
for it in items[240:290]:
    print(f"{it['idx']:3d}: {it['raw']}")
