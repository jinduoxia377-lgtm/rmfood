import sys
sys.path.insert(0, 'backend')

import traceback

try:
    from app.api.analytics import router
    print('SUCCESS: Analytics module loaded')
    print(f'Routes count: {len(router.routes)}')
except Exception as e:
    print('FAILED to load analytics module')
    traceback.print_exc()
