# -*- coding: utf-8 -*-
"""Seed terminology database with full data from all seed scripts."""
import asyncio
import re
import sys
import os

# Add backend root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database.session import get_session_factory

# ── Collect all term entries from seed scripts ──────────────────────

SEED_FILES = [
    r'scripts\terminology\terminology_data.py',
    r'scripts\terminology\terminology_final.py',
    r'scripts\terminology\terminology_supplement.py',
]

def parse_seed_file(path: str) -> list[dict]:
    """Extract {term, category, pinyin, term_en, definition, unit} dicts."""
    content = open(path, encoding='utf-8').read()
    results = []
    # Match dict blocks that contain "term" and "category"
    for m in re.finditer(r'\{([^}]*?"term"\s*:\s*"([^"]+)"[^}]*?"category"\s*:\s*"([^"]+)"[^}]*)\}', content, re.DOTALL):
        block = m.group(1)
        term = m.group(2)
        category = m.group(3)

        def extract(field: str) -> str | None:
            pat = f'"{field}"\\s*:\\s*"([^"]*)"'
            r = re.search(pat, block)
            return r.group(1) if r else None

        results.append({
            'term': term,
            'category': category,
            'term_en': extract('term_en'),
            'pinyin': extract('pinyin'),
            'definition': extract('definition'),
            'unit': extract('unit'),
        })
    return results


async def main():
    Session = get_session_factory()
    async with Session() as db:
        from sqlalchemy import text

        # ── 1. Collect & deduplicate terms ─────────────────────────
        all_entries: dict[str, dict] = {}  # key: term → dict
        for path in SEED_FILES:
            for entry in parse_seed_file(path):
                t = entry['term']
                if t not in all_entries:
                    all_entries[t] = entry
                else:
                    # Prefer entries with more fields filled
                    cur = all_entries[t]
                    for k in ('term_en', 'pinyin', 'definition', 'unit'):
                        if not cur.get(k) and entry.get(k):
                            cur[k] = entry[k]

        print(f"Total unique terms to seed: {len(all_entries)}")
        categories = sorted({e['category'] for e in all_entries.values()})
        print(f"Unique categories: {len(categories)} → {categories}")

        # ── 2. Seed categories ─────────────────────────────────────
        cat_id_map: dict[str, int] = {}
        now_str = "NOW()"
        for i, cat_name in enumerate(categories):
            rc = await db.execute(
                text("SELECT id FROM term_categories WHERE name = :n"),
                {'n': cat_name},
            )
            existing = rc.scalar_one_or_none()
            if existing is not None:
                cat_id_map[cat_name] = existing
                continue
            new_id = (
                await db.execute(
                    text("SELECT COALESCE(MAX(id), 0) + 1 FROM term_categories")
                )
            ).scalar_one()
            await db.execute(
                text("""
                    INSERT INTO term_categories (id, name, description, level, sort_order, created_at, updated_at)
                    VALUES (:id, :name, :desc, 1, :sort, NOW(), NOW())
                """),
                {
                    'id': new_id,
                    'name': cat_name,
                    'desc': f'{cat_name}术语分类',
                    'sort': i,
                },
            )
            cat_id_map[cat_name] = new_id

        print(f"Categories seeded: {len(cat_id_map)}")

        # ── 3. Seed terms ──────────────────────────────────────────
        inserted = 0
        skipped = 0
        for term_name, entry in all_entries.items():
            cat_id = cat_id_map.get(entry['category'])
            if not cat_id:
                skipped += 1
                continue
            rc = await db.execute(
                text("SELECT id FROM terms WHERE term = :t"),
                {'t': term_name},
            )
            if rc.scalar_one_or_none() is not None:
                skipped += 1
                continue
            new_id = (
                await db.execute(
                    text("SELECT COALESCE(MAX(id), 0) + 1 FROM terms")
                )
            ).scalar_one()
            await db.execute(
                text("""
                    INSERT INTO terms
                      (id, term, term_en, pinyin, definition, category_id,
                       unit, is_standard, confidence, frequency, created_at, updated_at)
                    VALUES (:id, :term, :term_en, :pinyin, :def, :cat_id,
                            :unit, TRUE, 0.95, 0, NOW(), NOW())
                """),
                {
                    'id': new_id,
                    'term': term_name,
                    'term_en': entry.get('term_en'),
                    'pinyin': entry.get('pinyin'),
                    'def': entry.get('definition') or '',
                    'cat_id': cat_id,
                    'unit': entry.get('unit'),
                },
            )
            inserted += 1

        await db.commit()
        print(f"Terms inserted: {inserted}, skipped (already exist): {skipped}")

        # ── 4. Seed normalization rules ────────────────────────────
        rules = [
            ('\\s+', '', 'regex', 10, '去除多余空白字符'),
            ('^(\\s+)|(\\s+)$', '', 'regex', 20, '去除首尾空白'),
            ('【([^】]+)】', r'\1', 'regex', 30, '去除书名号'),
            ('《([^》]+)》', r'\1', 'regex', 31, '去除书名号2'),
            ('（([^）]+)）', r'\1', 'regex', 32, '去除中文括号内容保留'),
            ('(.)\\1{2,}', r'\1\1', 'regex', 45, '压缩连续重复字符'),
            ('黄芪', '黄芪', 'exact', 50, '标准名统一'),
            ('桂枝', '桂枝', 'exact', 51, '标准名统一'),
            ('人参', '人参', 'exact', 52, '标准名统一'),
            ('当归', '当归', 'exact', 53, '标准名统一'),
            ('枸杞', '枸杞', 'exact', 54, '标准名统一'),
            ('红枣', '红枣', 'exact', 55, '标准名统一'),
            ('金银花', '金银花', 'exact', 56, '标准名统一'),
            ('连翘', '连翘', 'exact', 57, '标准名统一'),
            ('山楂', '山楂', 'exact', 58, '标准名统一'),
            ('甘草', '甘草', 'exact', 59, '标准名统一'),
            ('薄荷', '薄荷', 'exact', 60, '标准名统一'),
            ('蒲公英', '蒲公英', 'exact', 61, '标准名统一'),
            ('板蓝根', '板蓝根', 'exact', 62, '标准名统一'),
            ('茯苓', '茯苓', 'exact', 63, '标准名统一'),
            ('山药', '山药', 'exact', 64, '标准名统一'),
            ('川芎', '川芎', 'exact', 65, '标准名统一'),
            ('丹参', '丹参', 'exact', 66, '标准名统一'),
            ('白术', '白术', 'exact', 67, '标准名统一'),
            ('陈皮', '陈皮', 'exact', 68, '标准名统一'),
            ('半夏', '半夏', 'exact', 69, '标准名统一'),
            ('柴胡', '柴胡', 'exact', 70, '标准名统一'),
            ('熟地黄', '熟地黄', 'exact', 71, '标准名统一'),
            ('酸枣仁', '酸枣仁', 'exact', 72, '标准名统一'),
            ('白芍', '白芍', 'exact', 73, '标准名统一'),
            ('附子', '附子', 'exact', 74, '标准名统一'),
            ('干姜', '干姜', 'exact', 75, '标准名统一'),
            ('泽泻', '泽泻', 'exact', 76, '标准名统一'),
            ('牡丹皮', '牡丹皮', 'exact', 77, '标准名统一'),
            ('炙甘草', '甘草', 'exact', 79, '炙甘草→甘草标准化'),
            ('党参', '党参', 'exact', 80, '标准名统一'),
            ('麦冬', '麦冬', 'exact', 81, '标准名统一'),
            ('五味子', '五味子', 'exact', 82, '标准名统一'),
            ('五味', '五味子', 'exact', 83, '五味→五味子'),
            ('山茱萸', '山茱萸', 'exact', 84, '标准名统一'),
            ('丹皮', '牡丹皮', 'exact', 88, '丹皮→牡丹皮'),
            ('生地', '生地黄', 'exact', 89, '生地→生地黄'),
            ('熟地', '熟地黄', 'exact', 90, '熟地→熟地黄'),
            ('归身', '当归', 'exact', 91, '归身→当归'),
            ('归尾', '当归', 'exact', 92, '归尾→当归'),
            ('全当归', '当归', 'exact', 93, '全当归→当归'),
            ('红花', '红花', 'exact', 94, '标准名统一'),
            ('桃仁', '桃仁', 'exact', 95, '标准名统一'),
            ('莪术', '莪术', 'exact', 96, '标准名统一'),
            ('三棱', '三棱', 'exact', 97, '标准名统一'),
            ('延胡索', '延胡索', 'exact', 98, '标准名统一'),
            ('元胡', '延胡索', 'exact', 99, '元胡→延胡索'),
        ]

        rule_inserted = 0
        for pattern, replacement, rule_type, priority, description in rules:
            rc = await db.execute(
                text("SELECT id FROM term_normalization_rules WHERE pattern = :p"),
                {'p': pattern},
            )
            if rc.scalar_one_or_none() is not None:
                continue
            new_id = (
                await db.execute(
                    text("SELECT COALESCE(MAX(id), 0) + 1 FROM term_normalization_rules")
                )
            ).scalar_one()
            await db.execute(
                text("""
                    INSERT INTO term_normalization_rules
                      (id, pattern, replacement, rule_type, priority, description, enabled, created_at, updated_at)
                    VALUES (:id, :pattern, :replacement, :type, :priority, :desc, TRUE, NOW(), NOW())
                """),
                {
                    'id': new_id,
                    'pattern': pattern,
                    'replacement': replacement,
                    'type': rule_type,
                    'priority': priority,
                    'desc': description,
                },
            )
            rule_inserted += 1

        await db.commit()
        print(f"Normalization rules inserted: {rule_inserted}")

        # ── 5. Summary ─────────────────────────────────────────────
        r_cat = await db.execute(text("SELECT COUNT(*) FROM term_categories"))
        r_term = await db.execute(text("SELECT COUNT(*) FROM terms"))
        r_rule = await db.execute(text("SELECT COUNT(*) FROM term_normalization_rules"))
        print(f"\n✓ Done! Final counts:")
        print(f"  term_categories: {r_cat.scalar_one()}")
        print(f"  terms: {r_term.scalar_one()}")
        print(f"  term_normalization_rules: {r_rule.scalar_one()}")


if __name__ == '__main__':
    asyncio.run(main())
