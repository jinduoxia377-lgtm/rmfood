#!/usr/bin/env python3
"""Layer dependency checker for Hexagonal Architecture."""
import ast
import os
from pathlib import Path

# Project base - adjusted for this environment
BASE_PATH = Path('/d/RMFOOD配方平台/backend')
LAYERS = {'core': 'app/core', 'domain': 'app/domain', 'ports': 'app/domain/ports', 
          'application': 'app/application', 'infrastructure': 'app/infrastructure', 
          'api': 'app/api', 'factories': 'app/factories'}
ALLOWED = {('domain','ports'),('domain','core'),('domain','domain'), ('application','domain'),('application','ports'),('application','core'),('application','application'), ('infrastructure','ports'),('infrastructure','application'),('infrastructure','infrastructure'), ('api','infrastructure'),('api','application'),('api','domain')}

def get_layer(filepath):
    rel = str(filepath.relative_to(BASE_PATH)).replace(chr(92), '/')
    for layer_name, subdir in LAYERS.items():
        if rel.startswith(subdir + '/'): return layer_name
    return None

def get_imports(filepath):
    try:
        with open(filepath, 'r') as f: tree = ast.parse(f.read())
        imp = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    name = alias.name
                    if name.startswith('app.') and not name.startswith('app.tests'): imp.append(name)
            elif isinstance(node, ast.ImportFrom):
                mod = node.module
                if mod and mod.startswith('app.') and not mod.startswith('app.tests'):
                    name = mod + ('.' + (node.name if node.name else ''))
                    imp.append(name)
        return imp
    except: return []

def analyze(filepath, layer):
    res = []
    for imp in get_imports(filepath):
        parts = imp.split('.')
        if len(parts)>=2 and parts[0]=='app':
            tb = '.'.join(parts[1:3])
            tl = None
            for lname in LAYERS:
                if tb.startswith(lname+'.') or tb == lname: tl=lname; break
            if tl and tl!=layer and (layer, tl) not in ALLOWED:
                res.append((tl, imp, True))
    return res

def main():
    violations = []
    files_checked = 0
    for root, dirs, flist in os.walk(BASE_PATH):
        if '__pycache__' in root or 'tests' in root: continue
        for f in flist:
            if not f.endswith('.py'): continue
            filepath = Path(root) / f
            lay = get_layer(filepath)
            if lay is None: continue
            files_checked += 1
            for target, stmt, is_viol in analyze(filepath, lay):
                violations.append({'file': filepath.name, 'from': lay, 'target': target, 'stmt': stmt})
    
    print(f"=== Layer Dependency Check Report ===")
    print(f"Files analyzed: {files_checked}")
    print(f"Violations found: {len(violations)}")
    if violations:
        print("\nViolations:")
        for v in violations[:10]:
            print(f"  [{v['from']}] {v['file']} -> imports '{v['stmt']}' from '{v['target']}' layer")
        if len(violations) > 10:
            print(f"  ... and {len(violations)-10} more")
        exit(1)
    else:
        print("✓ No layer dependency violations detected!")
        exit(0)

if __name__ == '__main__':
    main()
