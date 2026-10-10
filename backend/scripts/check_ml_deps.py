# -*- coding: utf-8 -*-
"""Check availability of numpy/sklearn/etc for step 2 (model upgrade)."""
import sys
import os
sys.path.insert(0, r'D:\RMFOODFP\backend')
os.chdir(r'D:\RMFOODFP\backend')
sys.stdout.reconfigure(encoding='utf-8')

for name in ['numpy', 'sklearn', 'scipy', 'imblearn', 'xgboost', 'lightgbm']:
    try:
        mod = __import__(name)
        ver = getattr(mod, '__version__', '?')
        print('  %-10s OK   version=%s' % (name, ver))
    except Exception as e:
        print('  %-10s MISSING (%s)' % (name, type(e).__name__))