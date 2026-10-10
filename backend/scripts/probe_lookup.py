# -*- coding: utf-8 -*-
"""探测 /external-source/lookup 的 GET/POST 实际行为 + 协同端点新字段"""
import json, urllib.request, urllib.error, sys
sys.stdout.reconfigure(encoding='utf-8')

# 1) GET 看是否 405
try:
    with urllib.request.urlopen('http://localhost:8000/api/v1/peptide-structure/external-source/lookup?sequence=VLGYT&use_online=false', timeout=30) as r:
        print('GET /external-source/lookup ->', r.status)
except urllib.error.HTTPError as e:
    print('GET /external-source/lookup ->', e.code, '(405=method not allowed)')

# 2) POST 看是否正常
try:
    req = urllib.request.Request('http://localhost:8000/api/v1/peptide-structure/external-source/lookup?sequence=VLGYT&use_online=false',
                                 data=b'', method='POST')
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.loads(r.read())
    print('POST /external-source/lookup ->', r.status, '| match_count:', d.get('match_count'))
except urllib.error.HTTPError as e:
    print('POST ->', e.code, e.read().decode('utf-8','replace')[:100])

# 3) 协同端点新字段
try:
    req = urllib.request.Request(
        'http://localhost:8000/api/v1/ai/peptide/advanced/analyze/synergy',
        data=json.dumps({'peptide_sequences': ['IPP'], 'herb_names': ['人参', '黄芪', '菊花']}).encode(),
        method='POST', headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=180) as r:
        d = json.loads(r.read())
    body = d.get('data', d)
    print('协同 body keys:', list(body.keys()))
    hks = body.get('herb_knowledge_source')
    hi = body.get('herb_interactions')
    print('  含 herb_knowledge_source:', bool(hks))
    print('  含 herb_interactions:', bool(hi))
    if hks:
        print('  TCMSP matched:', hks.get('tcmsp_matched'), '| unknown:', hks.get('unknown'))
        print('  sources:', hks.get('sources'))
    if hi:
        print('  配伍命中:', len(hi.get('matched_pairs', [])), '| 协同:', hi.get('synergy_hits'),
              '| 修正:', hi.get('net_adjustment'), '| 调整后:', hi.get('adjusted_overall'))
        for m in hi.get('matched_pairs', []):
            print(f'    {m["a"]}+{m["b"]} {m["type"]} strength={m["strength"]} adj={m["adjustment"]} ({m["basis"]})')
    sm = body.get('synergy_matrix', [])
    if sm:
        for c in sm[0]:
            print(f'  {c.get("herb")}: synergy={c.get("synergy_score")} herb_source={c.get("herb_source")}')
except urllib.error.HTTPError as e:
    print('协同端点 ->', e.code, e.read().decode('utf-8','replace')[:200])
except Exception as e:
    print('协同端点异常:', e)
