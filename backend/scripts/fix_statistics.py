# -*- coding: utf-8 -*-
"""Fix terminology.py statistics function"""
path = 'D:/RMFOODFP/backend/app/api/terminology.py'
with open(path, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Fix the broken statistics function
old_stat = '''@router.get("/statistics", response_model=ApiResponse)
def get_statistics(db: Session = Depends(get_db)):
    """获取术语统计信息"""
    result = await db.execute(select(func.count(Term.id))); total_terms = result.scalar_one()
    result = await db.execute(select(func.count(TermVariant.id))); total_variants = result.scalar_one()

    # 按分类统计
    category_stats = []
    result = await db.execute(select(TermCategory).where(TermCategory.id == cat.id)); cat_obj = result.scalar_one_or_none()
        category_stats.append({
            "category_id": cat.id,
            "category_name": cat.name,
            "term_count": term_count
        })

    return ApiResponse(data={
        "total_terms": total_terms,
        "total_categories": total_categories,
        "total_variants": total_variants,
        "total_validations": total_validations,
        "category_stats": category_stats
    })'''

new_stat = '''@router.get("/statistics", response_model=ApiResponse)
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
    })'''

if old_stat in content:
    content = content.replace(old_stat, new_stat)
    print("OK: Replaced statistics function")
else:
    print("WARN: Old statistics pattern not found, trying line-by-line fix")
    # Alternative: find and replace by line numbers
    lines = content.split('\n')
    # Find the statistics function
    for i, line in enumerate(lines):
        if 'def get_statistics' in line or 'async def get_statistics' in line:
            print(f"Found at line {i+1}: {line.strip()}")
            # Replace from this line to the next function
            j = i + 1
            while j < len(lines) and not (lines[j].startswith('@router') and j > i + 5):
                j += 1
            print(f"Function spans lines {i+1} to {j}")
            break

with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

import ast
with open(path, 'r', encoding='utf-8') as f:
    ast.parse(f.read())
print("Syntax OK")
