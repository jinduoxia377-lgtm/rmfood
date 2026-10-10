# -*- coding: utf-8 -*-
"""直接打印协同分析端点原始 JSON 结构，确认新字段是否真的生效"""
import json, urllib.request, sys
sys.stdout.reconfigure(encoding='utf-8')

# 多味药触发 HERB_INTERACTIONS 配伍（黄芪+人参+菊花，含经典配伍对）
url = 'http://localhost:8000/api/v1/ai/peptide/advanced/analyze/synergy'
payload = {"peptide_sequences": ["IPP", "VLGYT"], "herb_names": ["黄芪", "人参", "菊花", "当归", "丹参"]}
req = urllib.request.Request(url, data=json.dumps(payload).encode(), method='POST',
                             headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req, timeout=180) as r:
        d = json.loads(r.read())
    print('状态码:', r.status)
    print('顶层 keys:', list(d.keys()))
    # 协同结果可能包在 d 直接 或 d['data']
    body = d.get('data', d)
    print('body keys:', list(body.keys()))
    print()
    print('=== herb_knowledge_source ===')
    print(json.dumps(body.get('herb_knowledge_source', {}), ensure_ascii=False, indent=2))
    print()
    print('=== herb_interactions ===')
    print(json.dumps(body.get('herb_interactions', {}), ensure_ascii=False, indent=2))
    print()
    print('=== synergy_matrix (第一味药 IPP 行，显示 herb_source) ===')
    sm = body.get('synergy_matrix', [])
    if sm:
        for c in sm[0]:
            print(f"  {c.get('herb')}: synergy={c.get('synergy_score')} herb_source={c.get('herb_source')}")
except Exception as e:
    print('调用失败:', e)
    import traceback; traceback.print_exc()
