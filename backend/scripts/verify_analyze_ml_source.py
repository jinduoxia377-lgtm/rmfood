# -*- coding: utf-8 -*-
"""验证 /analyze 主流程：真实 ML 模型并列分 + NCBI 在线文献证据链"""
import json, urllib.request

BASE = 'http://localhost:8000/api/v1/peptide-structure'

def post_json(url, payload, timeout=60):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), method='POST',
                                headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())

for seq in ['IPP', 'VLGYT']:
    print(f'=== /analyze {seq} ===')
    d = post_json(BASE + '/analyze', {'sequence': seq, 'enantiomer': 'D', 'ph': 7.0})
    ml = d.get('activities', {}).get('ml_model', {})
    print(f"  QSAR 规则 ACE 分: {d.get('activities', {}).get('ace_inhibition', {}).get('score')}")
    print(f"  真实 ML ACE 分:   {ml.get('ace_score')}  method={ml.get('method')}")
    print(f"  训练样本: {ml.get('training_samples')}  验证准确率: {ml.get('validation_accuracy')}")
    print(f"  来源数据库: {d.get('source', {}).get('database')}  食物来源: {d.get('source', {}).get('food')}")
    refs = d.get('source', {}).get('references', [])
    print(f"  文献证据链 ({len(refs)} 条):")
    for r in refs:
        print(f"    - {r[:100]}")
    print()
