import sys
sys.stdout.reconfigure(encoding='utf-8')
import psycopg2

env = {}
with open(r'D:\RMFOODFP\backend\.env', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")

db_url = env.get('DATABASE_URL', '').replace('postgresql+asyncpg://', 'postgresql://')
conn = psycopg2.connect(db_url)
cur = conn.cursor()

print("=== Table row counts ===")
for tbl in ['organizations', 'organization_members', 'teams', 'api_keys', 'organization_activities']:
    try:
        cur.execute(f'SELECT COUNT(*) FROM {tbl}')
        print(f'  {tbl}: {cur.fetchone()[0]} rows')
    except Exception as e:
        print(f'  {tbl}: ERROR - {e}')

print("\n=== teams columns ===")
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='teams' ORDER BY ordinal_position")
for r in cur.fetchall():
    print(f'  teams.{r[0]}: {r[1]}')

print("\n=== api_keys columns ===")
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='api_keys' ORDER BY ordinal_position")
for r in cur.fetchall():
    print(f'  api_keys.{r[0]}: {r[1]}')

print("\n=== organization_members columns ===")
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='organization_members' ORDER BY ordinal_position")
for r in cur.fetchall():
    print(f'  org_members.{r[0]}: {r[1]}')

print("\n=== Main query test ===")
try:
    cur.execute('''
        SELECT o.id, o.name, o.slug, o.plan, o.is_active, o.owner_id, o.created_at, m.role as member_role
        FROM organizations o
        JOIN organization_members m ON o.id = m.organization_id
        WHERE m.user_id = 1 AND o.is_active = TRUE
        ORDER BY o.created_at DESC
    ''')
    rows = cur.fetchall()
    print(f'  Found {len(rows)} organizations')
    for r in rows[:5]:
        print(f'    id={r[0]} name={r[1]} plan={r[3]} role={r[7]}')
except Exception as e:
    print(f'  ERROR: {e}')

print("\n=== Member count query ===")
try:
    cur.execute('SELECT COUNT(*) FROM organization_members WHERE organization_id = 1 AND is_active = TRUE')
    print(f'  Count: {cur.fetchone()[0]}')
except Exception as e:
    print(f'  ERROR: {e}')

print("\n=== Team IDs query ===")
try:
    cur.execute('SELECT team_ids FROM organization_members WHERE organization_id = 1 AND is_active = TRUE')
    rows = cur.fetchall()
    print(f'  team_ids samples: {[r[0] for r in rows[:3]]}')
except Exception as e:
    print(f'  ERROR: {e}')

print("\n=== Teams ANY query ===")
try:
    cur.execute("SELECT COUNT(*) FROM teams WHERE id = ANY(%s)", ([1, 2, 3],))
    print(f'  Count: {cur.fetchone()[0]}')
except Exception as e:
    print(f'  ERROR: {e}')

print("\n=== API keys count query ===")
try:
    cur.execute('SELECT COUNT(*) FROM api_keys WHERE org_id = 1 AND is_active = TRUE')
    print(f'  Count: {cur.fetchone()[0]}')
except Exception as e:
    print(f'  ERROR: {e}')

print("\n=== DELETE organization_members test ===")
try:
    cur.execute('DELETE FROM organization_members WHERE organization_id = 99999')
    print(f'  Deleted: {cur.rowcount} (expected 0)')
except Exception as e:
    print(f'  ERROR: {e}')

print("\n=== DELETE teams test ===")
try:
    cur.execute('DELETE FROM teams WHERE org_id = 99999')
    print(f'  Deleted: {cur.rowcount} (expected 0)')
except Exception as e:
    print(f'  ERROR: {e}')

print("\n=== DELETE api_keys test ===")
try:
    cur.execute('DELETE FROM api_keys WHERE org_id = 99999')
    print(f'  Deleted: {cur.rowcount} (expected 0)')
except Exception as e:
    print(f'  ERROR: {e}')

cur.close()
conn.close()
print("\nDone!")
