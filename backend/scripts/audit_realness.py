# -*- coding: utf-8 -*-
"""全面核查 /peptide-structure + /ai/peptide/advanced 每个端点返回的是真实数据还是骨架/模拟"""
import json, urllib.request, urllib.error

BASE = 'http://localhost:8000/api/v1/peptide-structure'
AIB = 'http://localhost:8000/api/v1/ai/peptide/advanced'

def post(url, payload, timeout=90):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), method='POST', headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8', 'replace')) if e.headers.get('Content-Type','').startswith('application/json') else e.read().decode('utf-8','replace')[:200]
    except Exception as e:
        return 0, f'{type(e).__name__}: {str(e)[:100]}'

def get(url, timeout=60):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8','replace')[:200]

print('=' * 60)
print('端点真实性核查（VLGYT / IPP）')
print('=' * 60)

# 1) /analyze —— 看各数据块来源
code, d = post(BASE + '/analyze', {'sequence': 'VLGYT'})
print(f'\n[1] POST /analyze  -> {code}')
print(f'    物化: MW={d.get("molecular_weight")}, pI={d.get("isoelectric_point")}, logP={d.get("hydrophobicity")}')
print(f'    QSAR ACE={d.get("ace_inhibition",{}).get("score")}, 置信度={d.get("ace_inhibition",{}).get("confidence")}')
print(f'    ML ACE={d.get("ml_model",{}).get("ace_score")} ({d.get("ml_model",{}).get("method")}), 库{d.get("ml_model",{}).get("library_size")}→训{d.get("ml_model",{}).get("training_samples")}/验{d.get("ml_model",{}).get("validation_samples")}')
src = d.get('source', {})
print(f'    来源: food={src.get("food")}, db={src.get("database")}, refs={len(src.get("references",[]))}')
lit = [r for r in src.get("references",[]) if "PubMed" in str(r) or "PMID" in str(r)]
print(f'    NCBI在线文献条数: {len(lit)}')

# 2) /database/search —— 看是否真实 DFBP 记录
code, d2 = get(BASE + '/database/search?activity_type=ACE%20inhibitory&page_size=3')
print(f'\n[2] GET /database/search -> {code}')
if code == 200:
    recs = d2.get("data",{}).get("records", d2.get("records", []))
    total = d2.get("data",{}).get("total", d2.get("total", len(recs)))
    print(f'    total={total}, 首条: {json.dumps(recs[0], ensure_ascii=False)[:150] if recs else "空"}')
else:
    print(f'    -> {str(d2)[:150]}')

# 3) /external-source/lookup
code, d3 = get(BASE + '/external-source/lookup?sequence=VLGYT&use_online=false')
print(f'\n[3] GET /external-source/lookup -> {code}')
if code == 200:
    print(f'    sources: {json.dumps(d3.get("data",{}).get("sources",{}), ensure_ascii=False)[:200] if "data" in d3 else json.dumps(d3, ensure_ascii=False)[:200]}')

# 4) /online-source/status
code, d4 = get(BASE + '/online-source/status', 60)
print(f'\n[4] GET /online-source/status -> {code}')
if code == 200:
    for s in d4.get("data",{}).get("sources", d4.get("sources",[])) if isinstance(d4.get("data",{}).get("sources", d4.get("sources",[])), list) else []:
        print(f'    {s.get("name")}: reachable={s.get("reachable")}, note={s.get("note","")[:40]}')
    if not d4.get("data",{}).get("sources") and not d4.get("sources"):
        print(f'    -> {json.dumps(d4, ensure_ascii=False)[:200]}')

# 5) /ml-status
code, d5 = get(BASE + '/ml-status?target_activity=ACE%20inhibitory')
print(f'\n[5] GET /ml-status -> {code}')
if code == 200:
    print(f'    trained={d5.get("trained")}, lib={d5.get("library_size")}, train={d5.get("training_samples")}, val={d5.get("validation_samples")}')

# 6) Pareto（看 ml_model_provenance + ACE 目标是否 ML 分）
code, d6 = post(AIB + '/optimize/pareto', {'sequences':['IPP','VLGYT','LPP','YLP'],'objectives':['ACE_inhibitory','antioxidant']})
print(f'\n[6] POST /optimize/pareto -> {code}')
if code == 200:
    mlp = d6.get("data",{}).get("ml_model_provenance")
    print(f'    ml_provenance: {json.dumps(mlp, ensure_ascii=False)[:150] if mlp else "缺失!"}')
    for p in d6.get("data",{}).get("pareto_points",[])[:2]:
        print(f'    {p.get("sequence")}: ACE={p.get("objectives",{}).get("ACE_inhibitory")} rank={p.get("rank")}')

# 7) 协同（看是否真实药材库 vs 硬编码 8 味）
code, d7 = post(AIB + '/analyze/synergy', {'peptide_sequences':['IPP'],'herb_names':['黄芪','菊花','未知草药X']})
print(f'\n[7] POST /analyze/synergy -> {code}')
if code == 200:
    mlp = d7.get("data",{}).get("ml_model_provenance")
    print(f'    ml_provenance: {json.dumps(mlp, ensure_ascii=False)[:120] if mlp else "缺失!"}')
    for row in (d7.get("data",{}).get("synergy_matrix") or [[]])[0:3]:
        for cell in row:
            print(f'    {cell.get("peptide")}×{cell.get("herb")}: synergy={cell.get("synergy_score")}, mech={cell.get("mechanism","")[:30]}')
