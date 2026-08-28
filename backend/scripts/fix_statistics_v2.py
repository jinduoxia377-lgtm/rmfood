# -*- coding: utf-8 -*-
"""Direct line-by-line fix for terminology.py statistics function"""
path = 'D:/RMFOODFP/backend/app/api/terminology.py'
with open(path, 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()

# Find and replace the statistics function (lines 433-459, 0-indexed 432-458)
new_func = '''@router.get("/statistics", response_model=ApiResponse)
async def get_statistics(db: AsyncSession = Depends(get_db_session)):
    """获取术语统计信息"""
    result = await db.execute(select(func.count(Term.id)))
    total_terms = result.scalar_one() or 0
    result = await db.execute(select(func.count(TermVariant.id)))
    total_variants = result.scalar_one() or 0
    result = await db.execute(select(func.count(TermCategory.id)))
    total_categories = result.scalar_one() or 0

    # 按分类统计
    category_stats = []
    result = await db.execute(select(TermCategory))
    categories = result.scalars().all()
    for cat in categories:
        result = await db.execute(select(func.count(Term.id)).where(Term.category_id == cat.id))
        term_count = result.scalar_one() or 0
        category_stats.append({
            "category_id": cat.id,
            "category_name": cat.name,
            "term_count": term_count
        })

    return ApiResponse(data={
        "total_terms": total_terms,
        "total_categories": total_categories,
        "total_variants": total_variants,
        "category_stats": category_stats
    })

'''

# Find the start and end of the statistics function
start_idx = None
end_idx = None
for i, line in enumerate(lines):
    if '@router.get("/statistics"' in line:
        start_idx = i
    elif start_idx is not None and line.startswith('@router') and i > start_idx:
        end_idx = i
        break

if start_idx is not None and end_idx is not None:
    new_lines = lines[:start_idx] + [new_func] + lines[end_idx:]
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.writelines(new_lines)
    print(f"OK: Replaced lines {start_idx+1}-{end_idx} with new statistics function")
else:
    print(f"ERROR: Could not find statistics function (start={start_idx}, end={end_idx})")
    # Try to find it differently
    for i, line in enumerate(lines):
        if 'get_statistics' in line:
            print(f"  Found at line {i+1}: {line.strip()}")

import ast
with open(path, 'r', encoding='utf-8') as f:
    ast.parse(f.read())
print("Syntax OK")
