# -*- coding: utf-8 -*-
"""探测当前 8000 服务跑的代码版本，确认协同端点新字段是否生效"""
import json, urllib.request, sys
sys.stdout.reconfigure(encoding='utf-8')

req = urllib.request.Request(
    'http://localhost:8000/api/v1/ai/peptide/advanced/analyze/synergy',
    data=json.dumps({'peptide_sequences': ['IPP'], 'herb_names': ['人参', '黄芪', '菊花']}).encode(),
    method='POST', headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req, timeout=180) as r:
        d = json.loads(r.read())
    body = d.get('data', d)
    print('协同 body keys:', list(body.keys()))
    print('  含 herb_knowledge_source:', 'herb_knowledge_source' in body)
    print('  含 herb_interactions:', 'herb_interactions' in body)
    hks = body.get('herb_knowledge_source')
    hi = body.get('herb_interactions')
    if hks:
        print('  TCMSP matched:', hks.get('tcmsp_matched'), ' unknown:', hks.get('unknown'))
        print('  sources:', hks.get('sources'))
    if hi:
        print('  配伍: 命中', len(hi.get('matched_pairs', [])),
              ' 协同', hi.get('synergy_hits'), ' 修正', hi.get('net_adjustment'),
              ' 调整后', hi.get('adjusted_overall'))
        for m in hi.get('matched_pairs', []):
            print(f'    {m["a"]}+{m["b"]} {m["type"]} strength={m["strength"]} adj={m["adjustment"]} ({m["basis"]})')
    sm = body.get('synergy_matrix', [])
    if sm:
        for c in sm[0]:
            print(f'  {c.get("herb")}: synergy={c.get("synergy_score")} herb_source={c.get("herb_source")}')
except Exception as e:
    print('协同端点调用失败:', e)
