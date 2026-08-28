import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'D:\RMFOODFP\backend\app\api\v1\formula_cases.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: case_stats return keys — use 'total' and 'featured' to match frontend
old_return = '''    return {
        "total_cases": total,
        "featured_cases": featured,
        "total_views": total_views,
        "total_likes": total_likes,
        "total_bookmarks": total_bookmarks,
        "total_comments": 0,  # Would need subquery
        "categories": [{"category": c, "count": n} for c, n in cats],
        "recent_cases": [_enrich_case(db, c) for c in recents],
    }'''

new_return = '''    return {
        "total": total,
        "featured": featured,
        "total_views": total_views,
        "total_likes": total_likes,
        "total_bookmarks": total_bookmarks,
        "total_comments": 0,
        "categories": [{"category": c, "count": n} for c, n in cats],
        "recent_cases": [_enrich_case(db, c) for c in recents],
    }'''

if old_return in content:
    content = content.replace(old_return, new_return)
    print('Fix 1: case_stats keys fixed')
else:
    print('Fix 1: pattern NOT found, trying line-by-line...')
    lines = content.split('\n')
    new_lines = []
    for line in lines:
        if '"total_cases": total,' in line:
            new_lines.append(line.replace('"total_cases": total,', '"total": total,'))
        elif '"featured_cases": featured,' in line:
            new_lines.append(line.replace('"featured_cases": featured,', '"featured": featured,'))
        else:
            new_lines.append(line)
    content = '\n'.join(new_lines)
    print('Fix 1: applied line-by-line')

# Fix 2: _enrich_case — use db.execute with text for consistency (AsyncSession has no sync_session)
old_enrich = """def _enrich_case(db, case):
    formula = None
    try:
        formula = db.sync_session.get(Formula, case.formula_id) if hasattr(db, 'sync_session') else None
    except Exception:
        formula = None

    # Use raw SQL for efficiency
    creator_name = None
    formula_name = None
    if formula:
        try:
            cr = db.sync_session.execute(
                text("SELECT username FROM users WHERE id = :uid"),
                {"uid": formula.creator_id} if formula.creator_id else {},
            )
            row = cr.fetchone()
            creator_name = row[0] if row else None
            formula_name = formula.name if formula else None
        except Exception:
            pass

    return {"""

new_enrich = """async def _enrich_case(db, case):
    formula = await db.get(Formula, case.formula_id) if case.formula_id else None
    creator_name = None
    formula_name = None
    if formula:
        formula_name = formula.name
        if formula.creator_id:
            try:
                creator = await db.get(User, formula.creator_id)
                creator_name = creator.username if creator else None
            except Exception:
                pass

    return {"""

if old_enrich in content:
    content = content.replace(old_enrich, new_enrich)
    print('Fix 2: _enrich_case made async + fixed sync_session')
else:
    print('Fix 2: pattern NOT found, checking...')
    idx = content.find('def _enrich_case')
    if idx >= 0:
        print(f'Found at {idx}: {repr(content[idx:idx+300])}')

# Fix 3: Update all _enrich_case calls to await them
content = content.replace('_enrich_case(db, c)', '_enrich_case(db, c)')
# Actually need to add await — let me do it properly
content = content.replace('return [_enrich_case(db, c) for c in cases]', 'return [await _enrich_case(db, c) for c in cases]')
content = content.replace('return [_enrich_case(db, c) for c in recents]', 'return [await _enrich_case(db, c) for c in recents]')
content = content.replace('return [_enrich_case(db, c) for c in case_list]' if 'case_list' in content else '', 'return [await _enrich_case(db, c) for c in cases]')
print('Fix 3: await added to _enrich_case calls')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Backend file saved')
