"""PostgreSQL 连接诊断脚本 — 逐步排查连接问题"""
import asyncio
import asyncpg

async def diagnose():
    """分步诊断 PostgreSQL 连接问题"""

    # Step 1: 尝试连接默认 postgres 数据库（验证基本连通性）
    print("=" * 50)
    print("Step 1: 测试基础连通性 (postgres 库)")
    print("=" * 50)
    for dsn in [
        "postgresql://postgres@localhost:5432/postgres",
        "postgresql://postgres:postgres@localhost:5432/postgres",
        "postgresql://postgres:123456@localhost:5432/postgres",
    ]:
        try:
            conn = await asyncpg.connect(dsn, timeout=3)
            version = await conn.fetchval("SELECT version()")
            print(f"  ✅ {dsn}")
            print(f"     版本: {str(version)[:60]}")

            # Step 2: 检查目标数据库是否存在
            print("\n" + "=" * 50)
            print("Step 2: 检查 rmfood_platform 数据库")
            print("=" * 50)
            exists = await conn.fetchval(
                "SELECT 1 FROM pg_database WHERE datname = 'rmfood_platform'"
            )
            if exists:
                print(f"  ✅ 数据库 'rmfood_platform' 已存在")
            else:
                print(f"  ❌ 数据库 'rmfood_platform' 不存在，正在创建...")
                try:
                    await conn.execute('CREATE DATABASE "rmfood_platform"')
                    print(f"  ✅ 数据库创建成功!")
                except Exception as e:
                    print(f"  ⚠️ 创建失败(可能需要超级用户权限): {e}")

            await conn.close()
            return True

        except asyncpg.exceptions.InvalidAuthorizationSpecificationError as e:
            print(f"  ❌ 认证失败: {dsn}")
            print(f"     错误: {e}")
        except asyncpg.exceptions.ConnectionDoesNotExistError as e:
            print(f"  ❌ 连接被拒: {dsn}")
            print(f"     错误: {e}")
        except Exception as e:
            print(f"  ❌ 其他错误: {type(e).__name__}: {e}")

    print("\n" + "=" * 50)
    print("Step 3: 列出所有可用数据库")
    print("=" * 50)
    try:
        # 尝试信任认证（无密码）
        conn = await asyncpg.connect(
            "postgresql://postgres@localhost:5432/postgres",
            timeout=3
        )
        dbs = await conn.fetch("SELECT datname, datistemplate FROM pg_database ORDER BY datname")
        for row in dbs:
            tmpl = " [模板]" if row['datistemplate'] else ""
            print(f"  - {row['datname']}{tmpl}")
        await conn.close()
    except Exception as e:
        print(f"  无法列出数据库: {e}")

    return False

if __name__ == "__main__":
    ok = asyncio.run(diagnose())
    exit(0 if ok else 1)
