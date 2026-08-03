"""清除 OpenAPI schema 缓存并重启服务"""
import os
import sys

# Clear any pycache
import shutil
for root, dirs, files in os.walk('.'):
    for d in dirs:
        if d == '__pycache__':
            cache_path = os.path.join(root, d)
            try:
                shutil.rmtree(cache_path)
                print(f'Cleared: {cache_path}')
            except:
                pass

print('Cache cleared. Please restart the backend service.')
