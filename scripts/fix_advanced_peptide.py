# -*- coding: utf-8 -*-
import sys
import re
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

def fix_advanced_peptide():
    file_path = Path(r'D:\RMFOODFP\backend\app\api\advanced_peptide.py')
    content = file_path.read_text(encoding='utf-8')
    
    # ?? SQLAlchemyError ??
    if 'SQLAlchemyError' not in content:
        content = content.replace(
            'from typing import Any, Dict, List, Optional',
            'from typing import Any, Dict, List, Optional\nfrom sqlalchemy.exc import SQLAlchemyError'
        )
    
    # ??????
    lines = content.split('\n')
    for i in range(len(lines)-1, -1, -1):
        line = lines[i]
        if 'except Exception as e:' in line or 'except Exception as analysis_error:' in line:
            lines[i] = line.replace('except Exception', 'except (ValueError, RuntimeError, TypeError)')
    
    content = '\n'.join(lines)
    file_path.write_text(content, encoding='utf-8')
    print('advanced_peptide.py fixed')

if __name__ == '__main__':
    fix_advanced_peptide()
