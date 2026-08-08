#!/usr/bin/env python3
"""Fix Unicode surrogate pairs in Python source files"""
import os
import re
import sys

def fix_file(filepath):
    """Fix surrogates in a single file"""
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    # Count surrogates
    surrogates = sum(1 for c in content if 0xD800 <= ord(c) <= 0xDFFF)

    if surrogates > 0:
        # Remove surrogates
        cleaned = re.sub(r'[\ud800-\udfff]', '', content)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(cleaned)
        print(f'Fixed {filepath}: removed {surrogates} surrogates')
        return True
    return False

def main():
    # Fix all Python files in app/
    fixed = 0
    for root, dirs, files in os.walk('app'):
        for f in files:
            if f.endswith('.py'):
                path = os.path.join(root, f)
                if fix_file(path):
                    fixed += 1

    print(f'\nFixed {fixed} files')

if __name__ == '__main__':
    main()
