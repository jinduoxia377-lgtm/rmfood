path = r'D:\RMFOODFP\backend\app\services\terminology_service.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = '''            results = db.execute(stmt.filter(
                or_(
                    Term.term.ilike(f"%{query_normalized}%"),
                    Term.term_en.ilike(f"%{query_normalized}%"),
                    Term.pinyin.ilike(f"%{query_normalized}%")
                )
            ).limit(max_results)).scalars().all()'''

new = '''            stmt = stmt.where(
                or_(
                    Term.term.ilike(f"%{query_normalized}%"),
                    Term.term_en.ilike(f"%{query_normalized}%"),
                    Term.pinyin.ilike(f"%{query_normalized}%")
                )
            ).limit(max_results)
            results = db.execute(stmt).scalars().all()'''

if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed!')
else:
    print('Pattern not found')
    lines = content.split('\n')
    for i, line in enumerate(lines[269:285], 270):
        print(f'{i}: {repr(line)}')
