import asyncio
from app.core.session import async_session_factory
from sqlalchemy import text

async def check():
    async with async_session_factory() as db:
        r1 = await db.execute(text("SELECT count(*) FROM kg_nodes"))
        r2 = await db.execute(text("SELECT count(*) FROM kg_edges"))
        r3 = await db.execute(text("SELECT node_type, count(*) FROM kg_nodes GROUP BY node_type"))
        r4 = await db.execute(text("SELECT edge_type, count(*) FROM kg_edges GROUP BY edge_type"))
        print(f"kg_nodes: {r1.scalar()}")
        print(f"kg_edges: {r2.scalar()}")
        print("--- nodes ---")
        for row in r3.all():
            print(f"  {row[0]}: {row[1]}")
        print("--- edges ---")
        for row in r4.all():
            print(f"  {row[0]}: {row[1]}")

asyncio.run(check())
