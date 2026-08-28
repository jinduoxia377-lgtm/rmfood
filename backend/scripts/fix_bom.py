# -*- coding: utf-8 -*-
import re
path = 'D:/RMFOODFP/backend/app/api/formulas.py'
with open(path, 'rb') as f:
    raw = f.read()
if raw.startswith(b'\xef\xbb\xbf'):
    raw = raw[3:]
with open(path, 'wb') as f:
    f.write(raw)
import ast
ast.parse(raw.decode('utf-8'))
print('OK: BOM removed, syntax valid')
