"""PostgreSQL 连接诊断 v2 — 排查 SSL/认证配置"""
import asyncio
import asyncpg

async def diagnose_v2():
    """诊断 PostgreSQL 连接（含 SSL 禁用选项）"""

    configs = [
        # 基础配置
        {"dsn": "postgresql://postgres@localhost:5432/postgres", "ssl": None},
        {"dsn": "postgresql://postgres@localhost:5432/postgres", "ssl": False},
        {"dsn": "postgresql://postgres:postgres@localhost:5432/postgres", "ssl": False},
        # 不同端口
        {"dsn": "postgresql://postgres@localhost:5433/postgres", "ssl": None},
        {"dsn": "postgresql://postgres@localhost:5432/postgres?sslmode=disable", "ssl": None},
    ]

    for cfg in configs:
        dsn = cfg["dsn"]
        ssl = cfg["ssl"]
        ssl_desc = f"ssl={ssl}" if ssl is not None else "ssl=default"
        print(f"\n尝试: {dsn} ({ssl_desc})")

        try:
            kwargs = {"timeout": 5}
            if ssl is not None:
                kwargs["ssl"] = ssl

            conn = await asyncpg.connect(dsn, **kwargs)
            version = await conn.fetchval("SELECT version()")
            print(f"  ✅ 成功! 版本: {str(version)[:80]}")
            await conn.close()
            return True

        except asyncpg.exceptions.InvalidAuthorizationSpecificationError as e:
            print(f"  ❌ 认证失败: {e}")
        except asyncpg.exceptions.ConnectionDoesNotExistError as e:
            print(f"  ❌ 连接被拒(中途关闭): {e}")
        except OSError as e:
            if "Connection refused" in str(e) or "无法连接" in str(e):
                print(f"  ❌ 连接被拒(端口未监听): {e}")
            else:
                print(f"  ❌ OS错误: {e}")
        except Exception as e:
            print(f"  ❌ {type(e).__name__}: {e}")

    return False

if __name__ == "__main__":
    ok = asyncio.run(diagnose_v2())
    exit(0 if ok else 1)
