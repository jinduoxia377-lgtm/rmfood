"""Check alembic state and fix."""
import asyncio, asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres:password@localhost:5432/rmfood')
    v = await conn.fetch('SELECT version_num FROM alembic_version ORDER BY version_num')
    print('Current alembic versions in DB:', [x['version_num'] for x in v])
    
    # Check if notificationstatus enum exists
    try:
        enums = await conn.fetch("SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname")
        print('Existing enums:', [e['typname'] for e in enums])
    except Exception as e:
        print('Enum check error:', e)
    
    await conn.close()

asyncio.run(main())
