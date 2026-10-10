# -*- coding: utf-8 -*-
"""验证 Pareto 多目标优化 + 协同分析使用真实 ML 模型分"""
import json, urllib.request, urllib.error

BASE = 'http://localhost:8000/api/v1'

def post(url, payload, auth=False):
    data = json.dumps(payload).encode()
    headers = {'Content-Type': 'application/json'}
    req = urllib.request.Request(url, data=data, method='POST', headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {'http_error': e.code, 'body': e.read().decode('utf-8', errors='replace')[:400]}

# 1) Pareto 多目标优化（含 ACE_inhibitory → 真实 ML 分参与寻优）
print('=== /optimize/pareto (ACE_inhibitory + antioxidant + stability) ===')
d = post(BASE + '/ai/peptide/advanced/optimize/pareto',
         {'sequences': ['IPP', 'VLGYT', 'LPP', 'YLP', 'PLP'],
          'objectives': ['ACE_inhibitory', 'antioxidant', 'stability']})
if 'http_error' in d:
    print('  HTTP', d['http_error'], d.get('body'))
    print('  （该端点需认证；ml_model_provenance 在 data 层，验证需带 token）')
else:
    mlp = d.get('data', {}).get('ml_model_provenance')
    print('  success:', d.get('success'), '| ML provenance:', json.dumps(mlp, ensure_ascii=False))
    for p in d.get('data', {}).get('pareto_points', [])[:5]:
        print(f"    {p['sequence']}: ACE={p['objectives'].get('ACE_inhibitory')} 优化目标={len(p['objectives'])} rank={p['rank']}")

# 2) 直接验证 _predict_ace_with_ml 真实 ML 分（走 /analyze 的 ml_model 已验证过）
#    这里验证协同分析端点的 ml_model_provenance 字段
print('=== /analyze/synergy ===')
d2 = post(BASE + '/ai/peptide/advanced/analyze/synergy',
          {'peptide_sequences': ['IPP', 'VLGYT'], 'herb_names': ['黄芪', '枸杞子', '山楂']})
if 'http_error' in d2:
    print('  HTTP', d2['http_error'], d2.get('body'))
else:
    mlp2 = d2.get('data', d2).get('ml_model_provenance')
    print('  success:', d2.get('success'))
    print('  ML provenance:', json.dumps(mlp2, ensure_ascii=False))
