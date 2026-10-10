# -*- coding: utf-8 -*-
import json, urllib.request, urllib.error

AIB = 'http://localhost:8000/api/v1/ai/peptide/advanced'

def post(url, payload, timeout=120):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), method='POST', headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')[:160]
    except Exception as e:
        return 0, f'{type(e).__name__}: {str(e)[:80]}'

tests = [
    ('analyze/deep', AIB + '/analyze/deep', {'sequence': 'VLGYT'}),
    ('analyze/batch', AIB + '/analyze/batch', {'sequences': ['IPP', 'VLGYT'], 'max_concurrent': 2}),
    ('optimize/pareto', AIB + '/optimize/pareto', {'sequences': ['IPP', 'VLGYT', 'LPP'], 'objectives': ['ACE_inhibitory', 'antioxidant']}),
    ('analyze/synergy', AIB + '/analyze/synergy', {'peptide_sequences': ['IPP'], 'herb_names': ['黄芪', '枸杞子']}),
    ('predict/solubility', AIB + '/predict/solubility', {'sequence': 'VLGYT'}),
    ('generate/variants', AIB + '/generate/variants', {'sequence': 'VLGYT', 'count': 5}),
]
print('=== advanced 端点（无 token）===')
for name, url, payload in tests:
    code, body = post(url, payload)
    tag = 'OK' if code == 200 else f'ERR({code})'
    print(f'  {tag}  {name}')
    if code != 200:
        print(f'      -> {body}')

# capabilities (GET)
try:
    with urllib.request.urlopen(AIB + '/capabilities', timeout=30) as r:
        print(f'  OK  capabilities (GET)')
except urllib.error.HTTPError as e:
    print(f'  ERR({e.code})  capabilities (GET) -> {e.read().decode()[:100]}')
