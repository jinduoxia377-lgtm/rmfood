# -*- coding: utf-8 -*-
import sys
import re
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

def fix_peptide_design_routes():
    file_path = Path(r'D:\RMFOODFP\backend\app\api\peptide_design_routes.py')
    content = file_path.read_text(encoding='utf-8')
    
    # ??????
    lines = content.split('\n')
    for i in range(len(lines)-1, -1, -1):
        line = lines[i]
        if 'except Exception as e:' in line:
            lines[i] = line.replace('except Exception as e:', 'except (RuntimeError, ValueError, TypeError) as e:')
    
    content = '\n'.join(lines)
    file_path.write_text(content, encoding='utf-8')
    print('peptide_design_routes.py fixed')

if __name__ == '__main__':
    fix_peptide_design_routes()
