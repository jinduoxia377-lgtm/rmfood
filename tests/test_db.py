import sys
sys.stdout.reconfigure(encoding='utf-8')

# Read DB URL from backend .env
env = {}
with open(r'D:\RMFOODFP\backend\.env', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")

db_url = env.get('DATABASE_URL', '')
# Convert asyncpg URL to sync URL for psycopg2
sync_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
print(f'Connecting to: {sync_url[:50]}...')

import psycopg2
conn = psycopg2.connect(sync_url)
cur = conn.cursor()

# 1. Check organization_members columns
cur.execute("""
    SELECT column_name FROM information_schema.columns 
    WHERE table_name='organization_members' ORDER BY ordinal_position
""")
cols = [r[0] for r in cur.fetchall()]
print('organization_members columns:', cols)

# 2. Check teams columns
cur.execute("""
    SELECT column_name FROM information_schema.columns 
    WHERE table_name='teams' ORDER BY ordinal_position
""")
cols = [r[0] for r in cur.fetchall()]
print('teams columns:', cols)

# 3. Check api_keys columns
cur.execute("""
    SELECT column_name FROM information_schema.columns 
    WHERE table_name='api_keys' ORDER BY ordinal_position
""")
cols = [r[0] for r in cur.fetchall()]
print('api_keys columns:', cols)

# 4. Test main query
try:
    cur.execute("""
        SELECT o.id, o.name, o.slug, o.plan, o.is_active, o.owner_id, o.created_at, m.role as member_role
        FROM organizations o
        JOIN organization_members m ON o.id = m.organization_id
        WHERE m.user_id = 1 AND o.is_active = TRUE
        ORDER BY o.created_at DESC
    """)
    rows = cur.fetchall()
    print(f'\nMain query: Found {len(rows)} organizations')
    for r in rows[:3]:
        print(f'  id={r[0]} name={r[1]} plan={r[3]} role={r[7]}')
except Exception as e:
    print(f'\nMain query ERROR: {e}')

# 5. Test team_ids query
try:
    cur.execute('SELECT team_ids FROM organization_members WHERE organization_id=1 AND is_active=TRUE')
    rows = cur.fetchall()
    print(f'\nteam_ids sample: {[r[0] for r in rows[:3]]}')
except Exception as e:
    print(f'\nteam_ids ERROR: {e}')

# 6. Test api_keys count
try:
    cur.execute('SELECT COUNT(*) FROM api_keys WHERE organization_id=1 AND is_active=TRUE')
    print(f'\napi_keys count for org 1: {cur.fetchone()[0]}')
except Exception as e:
    print(f'\napi_keys ERROR: {e}')

# 7. Test teams ANY query
try:
    cur.execute("SELECT COUNT(*) FROM teams WHERE id = ANY(%s)", ([1,2,3],))
    print(f'\nteams ANY test: {cur.fetchone()[0]}')
except Exception as e:
    print(f'\nteams ANY ERROR: {e}')

cur.close()
conn.close()
print('\nDone!')
