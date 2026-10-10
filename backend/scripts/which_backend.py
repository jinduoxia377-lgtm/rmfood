# -*- coding: utf-8 -*-
"""确认 14248 是谁，新后端实际绑到哪个地址，以及新后端是否真的加载了新代码。"""
import json, urllib.request, sys, subprocess
sys.stdout.reconfigure(encoding='utf-8')

# 1) 查 14248 进程
out = subprocess.check_output(['powershell', '-NoProfile', '-Command',
    "Get-CimInstance Win32_Process | Where-Object {$_.ProcessId -eq 14248} | Select-Object ProcessId,Name,CommandLine,CreationDate | Format-List"],
    text=True, errors='replace')
print('=== PID 14248 ===')
print(out.strip() if out.strip() else '  (进程不存在)')

# 2) 探测 127.0.0.1:8000 的 /ml-status（这是新后端绑定的地址）
print('=== 127.0.0.1:8000 /ml-status ===')
try:
    d = json.loads(urllib.request.urlopen('http://127.0.0.1:8000/api/v1/peptide-structure/ml-status?target_activity=ACE%20inhibitory', timeout=30).read())
    v = d.get('metrics', {}).get('validation', {})
    print('  accuracy:', v.get('accuracy'), ' 基线:', v.get('majority_baseline'))
    print('  F1:', v.get('f1'), ' 平衡:', v.get('balanced_accuracy'))
    print('  saved_at in metrics?', 'honest_note' in (d.get('metrics') or {}))
except Exception as e:
    print('  127.0.0.1:8000 不可达:', e)

# 3) 探测 localhost:8000（可能命中 14248）
print('=== localhost:8000 /ml-status ===')
try:
    d = json.loads(urllib.request.urlopen('http://localhost:8000/api/v1/peptide-structure/ml-status?target_activity=ACE%20inhibitory', timeout=30).read())
    v = d.get('metrics', {}).get('validation', {})
    print('  accuracy:', v.get('accuracy'), ' F1:', v.get('f1'))
except Exception as e:
    print('  localhost:8000 不可达:', e)
