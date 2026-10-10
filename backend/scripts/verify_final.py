# -*- coding: utf-8 -*-
"""重启后端后全链路验证：/analyze + /database/search + /analyze/synergy + /ml-status"""
import json, urllib.request, urllib.error, urllib.parse

BASE = 'http://localhost:8000/api/v1'

def post(url, payload, timeout=120):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), method='POST', headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8', 'replace'))

def get(url, timeout=90):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')[:120]

print('=' * 60)
print('[1] /analyze ml_model 真实/合成拆分')
code, d = post(BASE + '/peptide-structure/analyze', {'sequence': 'VLGYT'})
ml = d.get('ml_model', {}) if isinstance(d, dict) else {}
print(f'  lib real={ml.get("library_real_count")} synth={ml.get("library_synth_count")}')
print(f'  train real={ml.get("train_real_count")} synth={ml.get("train_synth_count")}')
print(f'  method={ml.get("method")} ace={ml.get("ace_score")}')
print(f'  honest_note: {ml.get("honest_note")}')

print()
print('[2] /database/search 合成标记')
code, d = get(BASE + '/peptide-structure/database/search?activity_type=ACE%20inhibitory&page_size=5')
print(f'  状态码 {code}')
if isinstance(d, dict):
    for r in d.get('peptides', [])[:5]:
        print(f'    {r.get("database_id")} is_synthetic={r.get("is_synthetic")} provenance={r.get("provenance")}')

print()
print('[3] /ml-status 真实/合成拆分')
code, d = get(BASE + '/peptide-structure/ml-status?target_activity=ACE%20inhibitory')
if isinstance(d, dict):
    print(f'  lib real={d.get("library_real_count")} synth={d.get("library_synth_count")}')
    print(f'  train real={d.get("train_real_count")} synth={d.get("train_synth_count")}')
    print(f'  note: {d.get("note","")[:150]}')

print()
print('[4] /analyze/synergy 药材知识来源')
code, d = post(BASE + '/ai/peptide/advanced/analyze/synergy',
               {'peptide_sequences': ['IPP'], 'herb_names': ['黄芪', '菊花', '灵芝', '未知草药X', '当归']})
if isinstance(d, dict) and d.get('success'):
    data = d.get('data', d)
    hks = data.get('herb_knowledge_source', {})
    print(f'  TCMSP={hks.get("tcmsp_matched")} fallback={hks.get("fallback_8herb")} unknown={hks.get("unknown")}')
    for name, src in hks.get('sources', {}).items():
        print(f'    {name} -> {src}')
    for row in (data.get('synergy_matrix') or [[]])[0:3]:
        for c in row:
            print(f'    {c.get("herb")}: synergy={c.get("synergy_score")} herb_source={c.get("herb_source")}')
else:
    print(f'  状态码 {code} -> {str(d)[:200]}')
