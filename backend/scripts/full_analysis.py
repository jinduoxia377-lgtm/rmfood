# -*- coding: utf-8 -*-
"""全面项目完整性分析"""
import sys, asyncio, re, os
sys.path.insert(0, 'D:/RMFOODFP/backend')

from app.core.database.session import get_session_factory
from sqlalchemy import text

async def check_db():
    Session = get_session_factory()
    async with Session() as db:
        # Table list and counts
        result = await db.execute(text("""
            SELECT relname AS table_name, n_live_tup
            FROM pg_stat_user_tables WHERE schemaname='public'
            ORDER BY n_live_tup DESC NULLS LAST
        """))
        rows = result.fetchall()
        print("=== 数据库表状态 ===")
        for name, cnt in rows:
            print(f"  {name}: {cnt if cnt else 0} 条")
        
        # Check empty tables
        empty = []
        for t in ['experiments','comments','organizations','teams','notifications','terms','term_categories']:
            try:
                r = await db.execute(text(f'SELECT COUNT(*) FROM "{t}"'))
                cnt = r.scalar_one()
                if cnt == 0:
                    empty.append(t)
            except Exception as e:
                empty.append(f"{t}(不存在)")
        if empty:
            print(f"\n空表/缺失表: {', '.join(empty)}")

def scan_backend_routes():
    routes = set()
    base = 'D:/RMFOODFP/backend/app/api/v1'
    for f in os.listdir(base):
        if not f.endswith('.py') or f.startswith('__'):
            continue
        path = os.path.join(base, f)
        with open(path, 'r', encoding='utf-8') as fh:
            content = fh.read()
        for m in re.finditer(r'@(?:get|post|put|delete|patch)\s*\(\s*"([^"]+)"', content):
            routes.add(m.group(1))
    return routes

def scan_frontend_apis():
    apis = {}
    base = 'D:/RMFOODFP/frontend/src/api'
    for f in os.listdir(base):
        if not f.endswith('.ts') or 'mock' in f:
            continue
        path = os.path.join(base, f)
        with open(path, 'r', encoding='utf-8') as fh:
            content = fh.read()
        for m in re.finditer(r'["`/](/api/v1/[\w/_-]+)["`/]', content):
            p = m.group(1)
            if '{' not in p:
                if p not in apis:
                    apis[p] = []
                apis[p].append(f)
    return apis

if __name__ == '__main__':
    # DB
    asyncio.run(check_db())
    
    # Routes
    backend_routes = scan_backend_routes()
    frontend_apis = scan_frontend_apis()
    
    print("\n=== 后端路由 (按模块分组) ===")
    by_module = {}
    for r in sorted(backend_routes):
        parts = [p for p in r.split('/') if p and p != 'v1']
        module = parts[0] if parts else 'root'
        if module not in by_module:
            by_module[module] = []
        by_module[module].append(r)
    for mod in sorted(by_module):
        print(f"\n  [{mod}] ({len(by_module[mod])} routes)")
        for r in sorted(by_module[mod])[:8]:
            print(f"    {r}")
        if len(by_module[mod]) > 8:
            print(f"    ... +{len(by_module[mod])-8} more")
    
    print("\n=== 前端API调用 vs 后端实现 ===")
    all_frontend_paths = set(frontend_apis.keys())
    all_backend_paths = backend_routes
    
    # Normalize for comparison
    missing = []
    for fp in sorted(all_frontend_paths):
        base_path = fp.split('?')[0].split('{')[0]
        found = any(bp.split('?')[0].startswith(base_path) for bp in all_backend_paths)
        # Also check if base module exists in backend
        mod = fp.split('/')[3] if len(fp.split('/')) > 3 else ''
        has_mod = any(r.startswith('/' + mod) for r in all_backend_paths)
        if not found and not has_mod:
            missing.append(fp)
    
    if missing:
        print("  缺失的后端API:")
        for m in missing:
            files = ', '.join(set(frontend_apis[m]))
            print(f"    {m} (由 {files} 调用)")
    else:
        print("  所有前端API均有后端实现 ✓")
    
    print("\n=== 关键发现 ===")
    # Check for pages using mock/stub data
    pages_base = 'D:/RMFOODFP/frontend/src/pages'
    stub_pages = []
    for root, dirs, files in os.walk(pages_base):
        for f in files:
            if not f.endswith('.tsx'):
                continue
            fp = os.path.join(root, f)
            with open(fp, 'r', encoding='utf-8') as fh:
                content = fh.read()
            has_mock = bool(re.search(r'mockData|示例数据|const.*=\s*\[\s*\{.*name', content))
            has_todo = bool(re.search(r'TODO|placeholder', content))
            has_api = bool(re.search(r'useQuery|fetch\(|api\.|axios\.', content))
            size = os.path.getsize(fp) / 1024
            rel = fp.replace(pages_base + '/', '')
            if has_mock and not has_api:
                stub_pages.append((rel, size, 'mock-only'))
            elif has_todo and size < 15:
                stub_pages.append((rel, size, f'{has_todo} TODOs'))
    
    print("  可能使用静态数据的页面:")
    for p, sz, note in sorted(stub_pages, key=lambda x: -x[1]):
        print(f"    [{sz:.1f}KB] {p} ({note})")
