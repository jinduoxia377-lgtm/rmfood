# -*- coding: utf-8 -*-
"""验证新增端点：在线数据源状态 / ML 训练 / ML 预测 / ML 状态 / 在线文献"""
import json, urllib.request, urllib.parse

BASE = 'http://localhost:8000/api/v1/peptide-structure'

def get(url, timeout=120):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.loads(r.read())

def post(url, timeout=120):
    req = urllib.request.Request(url, method='POST')
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())

# 1) 在线数据源状态
print('--- /online-source/status ---')
d = get(BASE + '/online-source/status')
for s in d.get('sources', []):
    print(f"  {s['name']}: reachable={s['reachable']}  {s.get('note','')[:70]}")
print('  online_count:', d.get('online_source_count'), 'offline_count:', d.get('offline_source_count'))

# 2) 真实 ML 训练
print('--- /ml-train (DFBP 真实数据) ---')
url = BASE + '/ml-train?target_activity=' + urllib.parse.quote('ACE inhibitory') + '&epochs=60'
d = post(url)
print('  success:', d.get('success'))
print('  training_samples:', d.get('training_samples'))
print('  metrics:', json.dumps(d.get('metrics'), ensure_ascii=False))
print('  artifact:', d.get('artifact'))

# 3) ML 预测
print('--- /ml-predict IPP ---')
url = BASE + '/ml-predict?sequence=' + urllib.parse.quote('IPP')
d = post(url)
print('  sequence:', d.get('sequence'), 'method:', d.get('method'), 'score:', d.get('score'))

# 4) ML 状态
print('--- /ml-status ---')
d = get(BASE + '/ml-status')
print('  trained:', d.get('trained'))
print('  metrics:', json.dumps(d.get('metrics'), ensure_ascii=False))
print('  training_samples:', d.get('training_samples'))

# 5) 在线文献（诚实降级验证）
print('--- /online-source/literature ---')
try:
    d = get(BASE + '/online-source/literature?limit=3', timeout=60)
except urllib.error.HTTPError as e:
    print('  HTTP', e.code)
    import traceback; traceback.print_exc()
    raise SystemExit(1)
print('  reachable:', d.get('reachable'), 'refs:', len(d.get('references', [])))
for ref in d.get('references', [])[:3]:
    print(f"    PMID {ref.get('pmid')}: {ref.get('title','')[:60]} ({ref.get('journal','')})")
print('  note:', d.get('note'))
