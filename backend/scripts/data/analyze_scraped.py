"""Analyze tcmsp_herbs_full.json structure"""
import json

with open(r'd:\RMFOOD配方平台\tcmsp_data\data\tcmsp_herbs_full.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Top-level keys: {list(data.keys())}")
print(f"Total: {data.get('total', '?')}")

# Find herb array
herbs = None
for k, v in data.items():
    if isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict):
        if 'name_cn' in v[0] or 'herb_cn_name' in v[0]:
            herbs = v
            print(f"Herb array at key '{k}': {len(herbs)} items")
            break

if herbs:
    h = herbs[0]
    print(f"\nFirst herb keys: {list(h.keys())}")
    print(f"name_cn: {h.get('name_cn')}")
    print(f"compounds count: {len(h.get('compounds', []))}")
    if h.get('compounds'):
        c = h['compounds'][0]
        print(f"Compound keys ({len(c)}): {list(c.keys())}")
        print(f"Sample compound: {json.dumps(c, ensure_ascii=False, indent=2)}")
    
    # Check OB anomalies
    ob_anomalies = []
    for herb in herbs:
        ob = herb.get('ob_percent')
        if ob is not None and (ob > 100 or ob < 0):
            ob_anomalies.append((herb.get('name_cn', '?'), ob))
    print(f"\nOB% anomalies (>100 or <0): {len(ob_anomalies)}")
    for name, val in ob_anomalies[:5]:
        print(f"  {name}: {val}%")
    
    # Check targets/diseases coverage
    has_targets = sum(1 for h in herbs if h.get('targets'))
    has_diseases = sum(1 for h in herbs if h.get('diseases'))
    has_compounds = sum(1 for h in herbs if h.get('compounds'))
    print(f"\nField coverage ({len(herbs)} total):")
    print(f"  has compounds: {has_compounds}/{len(herbs)} ({100*has_compounds/len(herbs):.1f}%)")
    print(f"  has targets:   {has_targets}/{len(herbs)} ({100*has_targets/len(herbs):.1f}%)")
    print(f"  has diseases:  {has_diseases}/{len(herbs)} ({100*has_diseases/len(herbs):.1f}%)")
