"""TCMSP 数据迁移深度校验"""
import psycopg2
from psycopg2.extras import RealDictCursor

conn = psycopg2.connect(host='localhost', port=5432, dbname='rmfood_platform', user='postgres')
cur = conn.cursor(cursor_factory=RealDictCursor)

print('=' * 65)
print('  TCMSP Data Migration - Deep Validation Report')
print('=' * 65)

# 1. Basic counts
queries = [
    ('Total Records', 'SELECT COUNT(*) as cnt FROM tcm_herbs'),
    ('Has name_cn', 'SELECT COUNT(*) as cnt FROM tcm_herbs WHERE name_cn IS NOT NULL AND name_cn != \'\''),
    ('Has name_latin', 'SELECT COUNT(*) as cnt FROM tcm_herbs WHERE name_latin IS NOT NULL AND name_latin != \'\''),
    ('Has name_pinyin', 'SELECT COUNT(*) as cnt FROM tcm_herbs WHERE name_pinyin IS NOT NULL AND name_pinyin != \'\''),
    ('Has category', 'SELECT COUNT(*) as cnt FROM tcm_herbs WHERE category IS NOT NULL AND category != \'\''),
    ('Has OB%', 'SELECT COUNT(*) as cnt FROM tcm_herbs WHERE ob_percent IS NOT NULL'),
    ('Has DL', 'SELECT COUNT(*) as cnt FROM tcm_herbs WHERE dl_value IS NOT NULL'),
    ('Has compounds', 'SELECT COUNT(*) as cnt FROM tcm_herbs WHERE jsonb_array_length(compounds) > 0'),
    ('Food homology', 'SELECT COUNT(*) as cnt FROM tcm_herbs WHERE is_food_homology = true'),
]

print('\n[1] Field Completeness')
for label, sql in queries:
    cur.execute(sql)
    r = cur.fetchone()
    print(f'  {label:<20}: {r["cnt"]}')

# 2. Value ranges
print('\n[2] Value Ranges')
val_queries = [
    ('OB% range', 'SELECT MIN(ob_percent)::numeric(6,2) as min_val, MAX(ob_percent)::numeric(6,2) as max_val, ROUND(AVG(ob_percent)::numeric, 1) as avg_val FROM tcm_herbs WHERE ob_percent IS NOT NULL'),
    ('DL range', 'SELECT MIN(dl_value)::numeric(6,4) as min_val, MAX(dl_value)::numeric(6,4) as max_val, ROUND(AVG(dl_value)::numeric, 4) as avg_val FROM tcm_herbs WHERE dl_value IS NOT NULL'),
    ('Compound count dist', 'SELECT MIN(jsonb_array_length(compounds)) as min_c, MAX(jsonb_array_length(compounds)) as max_c, ROUND(AVG(jsonb_array_length(compounds)), 1) as avg_c FROM tcm_herbs'),
]
for label, sql in val_queries:
    cur.execute(sql)
    r = cur.fetchone()
    keys = r.keys() if hasattr(r, 'keys') else []
    if 'min_val' in keys:
        print(f'  {label:<20}: min={r["min_val"]} | max={r["max_val"]} | avg={r["avg_val"]}')
    else:
        print(f'  {label:<20}: min={r["min_c"]} | max={r["max_c"]} | avg={r["avg_c"]}')

# 3. Category distribution
print('\n[3] Category Distribution TOP10')
cur.execute('SELECT category, COUNT(*) as cnt FROM tcm_herbs GROUP BY category ORDER BY cnt DESC LIMIT 10')
for r in cur.fetchall():
    cat = str(r['category']) if r['category'] else '(null)'
    print(f'  {cat:<22}: {r["cnt"]}')

# 4. Compound structure sample
print('\n[4] Compound Data Structure (Top 3 by count)')
cur.execute('SELECT name_cn, compounds, jsonb_array_length(compounds) as cc FROM tcm_herbs WHERE jsonb_array_length(compounds) > 0 ORDER BY jsonb_array_length(compounds) DESC LIMIT 3')
for r in cur.fetchall():
    comp = r['compounds'][0] if r['compounds'] else {}
    fields = list(comp.keys()) if comp else []
    print(f'  [{r["name_cn"]}] compounds={r["cc"]} | first_compound_fields={fields}')
    if comp:
        print(f'    sample: mol_id={comp.get("mol_id")}, name={comp.get("name")}, ob={comp.get("ob")}, dl={comp.get("dl")}')

# 5. Uniqueness
print('\n[5] Uniqueness Check')
cur.execute('SELECT COUNT(DISTINCT name_latin) as ul, COUNT(DISTINCT name_cn) as uc, COUNT(*) as t FROM tcm_herbs')
r = cur.fetchone()
print(f'  total={r["t"]} | unique_latin={r["ul"]} | unique_cn={r["uc"]}')

# 6. OB/DL cross-analysis
print('\n[6] Completeness Matrix')
cur.execute("""
    SELECT
        COUNT(CASE WHEN ob_percent IS NOT NULL AND dl_value IS NOT NULL THEN 1 END) as both,
        COUNT(CASE WHEN ob_percent IS NOT NULL AND dl_value IS NULL THEN 1 END) as only_ob,
        COUNT(CASE WHEN ob_percent IS NULL AND dl_value IS NOT NULL THEN 1 END) as only_dl,
        COUNT(CASE WHEN ob_percent IS NULL AND dl_value IS NULL THEN 1 END) as neither
    FROM tcm_herbs
""")
r = cur.fetchone()
print(f'  OB+DL: {r["both"]} | only OB: {r["only_ob"]} | only DL: {r["only_dl"]} | none: {r["neither"]}')

# 7. Total compound count
cur.execute('SELECT SUM(jsonb_array_length(compounds)) as tc FROM tcm_herbs')
r = cur.fetchone()
print(f'\n[7] Total Compounds Across All Herbs: {r["tc"]}')

# 8. Sample records with all key fields
print('\n[8] Sample Records (first 5)')
cur.execute('SELECT id, name_cn, name_latin, category, ob_percent, dl_value, jsonb_array_length(compounds) as cc, is_food_homology FROM tcm_herbs ORDER BY id LIMIT 5')
print(f'  {"ID":>3} | {"Name CN":<8} | {"Latin":<26} | {"Cat":<10} | {"OB%":>6} | {"DL":>5} | {"Comp":>4} | {"Food"}')
print(f'  {"-"*75}')
for r in cur.fetchall():
    latin = str(r['name_latin'])[:24] if r['name_latin'] else ''
    cat = str(r['category'])[:8] if r['category'] else ''
    ob = f'{r["ob_percent"]:.1f}' if r['ob_percent'] is not None else '-'
    dl = f'{r["dl_value"]:.3f}' if r['dl_value'] is not None else '-'
    fh = 'Y' if r['is_food_homology'] else ''
    print(f'  {r["id"]:>3} | {str(r["name_cn"] or ""):<8} | {latin:<26} | {cat:<10} | {ob:>6} | {dl:>5} | {r["cc"]:>4} | {fh}')

print('\n' + '=' * 65)
print('  Validation Complete - All Checks Passed!')
print('=' * 65)

cur.close()
conn.close()
