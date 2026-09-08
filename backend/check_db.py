"""Quick DB schema check"""
import asyncio, asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres:password@localhost:5432/rmfood')
    
    # List tables
    tables = await conn.fetch(
        "SELECT table_name FROM information_schema.tables WHERE table_schema=$1 ORDER BY table_name",
        'public'
    )
    print("=== Tables ===")
    for t in tables:
        print(t['table_name'])
    
    # Check notifications table columns
    cols = await conn.fetch(
        "SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position",
        'public', 'notifications'
    )
    print("\n=== notifications columns ===")
    for c in cols:
        print(f"  {c['column_name']}: {c['data_type']} (udt={c['udt_name']})")
    
    # Check if notificationstatus enum exists
    enums = await conn.fetch(
        "SELECT enum_typname FROM pg_type WHERE typtype = 'e' ORDER BY enum_typname"
    )
    print("\n=== Enum types ===")
    for e in enums:
        print(f"  {e['enum_typname']}")
    
    # Check alembic_version
    try:
        ver = await conn.fetchval("SELECT version_num FROM alembic_version")
        print(f"\n=== Alembic version ===\n{ver}")
    except Exception as e:
        print(f"\nNo alembic_version table: {e}")
    
    await conn.close()

asyncio.run(main())
