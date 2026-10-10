# -*- coding: utf-8 -*-
import json, urllib.request
url = 'http://localhost:8000/api/v1/peptide-structure/analyze?sequence=VLGYT&enantiomer=D&ph=7.0'
req = urllib.request.Request(url, method='POST')
d = json.loads(urllib.request.urlopen(req, timeout=60).read())
acts = d.get('activities', {})
print('activities keys:', list(acts.keys()))
print('ml_model:', json.dumps(acts.get('ml_model'), ensure_ascii=False))
print('ace_inhibition:', json.dumps(acts.get('ace_inhibition'), ensure_ascii=False))
src = d.get('source', {})
print('source.database:', src.get('database'))
print('source.food:', src.get('food'))
refs = src.get('references', [])
print(f'source.references ({len(refs)}):')
for r in refs:
    print('  -', r[:110])
