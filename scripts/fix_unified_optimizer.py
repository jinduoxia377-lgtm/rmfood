# -*- coding: utf-8 -*-
import sys
import re
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

def fix_unified_optimizer():
    file_path = Path(r'D:\RMFOODFP\backend\app\services\ai\algorithms\unified_optimizer.py')
    content = file_path.read_text(encoding='utf-8')
    
    # ??????
    lines = content.split('\n')
    for i in range(len(lines)-1, -1, -1):
        line = lines[i]
        if 'except Exception as e:' in line and 'logger.error' in lines[i+1] if i+1 < len(lines) else False:
            # ????????????
            if 'RuntimeError' not in line and 'ValueError' not in line:
                lines[i] = line.replace('except Exception as e:', 'except (RuntimeError, ValueError, TypeError) as e:')
    
    content = '\n'.join(lines)
    file_path.write_text(content, encoding='utf-8')
    print('unified_optimizer.py fixed')

if __name__ == '__main__':
    fix_unified_optimizer()
