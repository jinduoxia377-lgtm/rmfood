#!/usr/bin/env python3
"""Simple database connectivity check"""
import os
import sys
import asyncio

# Setup environment
os.environ['SECRET_KEY'] = 'test-secret-key-32-chars-long-1234567890abcdef'
os.environ['ENV'] = 'development'
os.environ['DATABASE_URL'] = 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood'

async def check_database():
    """Check if database is reachable"""
    db_url = os.environ['DATABASE_URL']

    # Simple connection attempt using asyncpg directly
    try:
        import asyncpg
        conn = await asyncpg.connect(user='postgres', password='password',
                                    host='localhost', port=5432, database='rmfood')
        print("✅ PostgreSQL connected successfully!")

        version = await conn.fetchval("SELECT version();")
        print(f"  Version: {version[:80]}...")

        # Check tables
        result = await conn.fetch("""
            SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
        """)
        print(f"\n📋 Public schema tables ({len(result)}):")
        for row in result:
            status = " ⭐ TARGET TABLE" if row['tablename'] == 'retail_products' else ""
            print(f"  - {row['tablename']}{status}")

        await conn.close()

        if 'retail_products' not in [r['tablename'] for r in result]:
            print("\n⚠️ retail_products table does NOT exist")
            print("   Need to run migrations before importing")

    except Exception as e:
        print("[-] Database check failed: {}: {}".format(type(e).__name__, e))
        print("\nPossible causes:")
        print("  1. PostgreSQL server is not running")
        print("  2. Connection refused (check firewall and bind address)")
        print("  3. Authentication failure (wrong username/password)")
        print("  4. Database 'rmfood' does not exist")

if __name__ == "__main__":
    asyncio.run(check_database())
