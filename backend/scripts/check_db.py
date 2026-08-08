"""检查数据库结构和数据量"""
import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text


async def check_database():
    # 直接从固定路径读取 .env
    env_path = r'D:\RMFOOD配方平台\backend\.env'
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    env_vars[k.strip()] = v.strip()
    else:
        print(f'警告: .env 文件不存在: {env_path}')

    db_url = env_vars.get('DATABASE_URL', '')
    if not db_url:
        print('错误: DATABASE_URL 未配置')
        return

    print(f'数据库连接: {db_url[:60]}...')
    print()

    try:
        engine = create_async_engine(db_url, echo=False)

        async with engine.connect() as conn:
            # 1. PostgreSQL 版本
            result = await conn.execute(text('SELECT version()'))
            print('=== PostgreSQL 版本 ===')
            print(result.scalar())
            print()

            # 2. 列出所有表
            q_tables = text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name
            """)
            result = await conn.execute(q_tables)
            tables = [r[0] for r in result.fetchall()]
            print(f'=== 数据库表列表 (共 {len(tables)} 张表) ===')
            for i, t in enumerate(tables, 1):
                print(f'  {i:2d}. {t}')
            print()

            # 3. 各表数据量统计
            q_stats = text("""
                SELECT
                    relname AS table_name,
                    n_live_tup AS row_estimate,
                    pg_size_pretty(pg_relation_size(relid)) AS table_size,
                    pg_size_pretty(pg_indexes_size(relid)) AS index_size,
                    pg_size_pretty(pg_total_relation_size(relid)) AS total_size
                FROM pg_stat_user_tables
                WHERE schemaname = 'public'
                ORDER BY n_live_tup DESC NULLS LAST
            """)
            result = await conn.execute(q_stats)
            rows = result.fetchall()

            print('=== 各表数据量统计 ===')
            hdr = f'{"表名":<45} {"行数":<12} {"表大小":<12} {"索引大小":<12} {"总计":<12}'
            print(hdr)
            print('-' * 93)
            for name, est_rows, tbl_sz, idx_sz, tot_sz in rows:
                rows_str = f'{est_rows:,}' if est_rows and est_rows > 0 else '(无)'
                print(f'{name:<45} {rows_str:<12} {tbl_sz:<12} {idx_sz:<12} {tot_sz:<12}')
            print()

            # 4. 数据库总大小
            q_total = text('SELECT pg_size_pretty(pg_database_size(current_database()))')
            result = await conn.execute(q_total)
            print(f'=== 数据库总大小: {result.scalar()} ===')
            print()

            # 5. 核心表数据示例
            core_tables = ['users', 'formulas', 'ingredients', 'peptides', 'experiments',
                          'teams', 'notifications', 'audit_logs', 'system_configs',
                          'chat_sessions', 'chat_messages', 'knowledge_graph_nodes',
                          'knowledge_graph_edges', 'tcm_herbs', 'tcm_compounds',
                          'ga_run_records', 'peptide_designs', 'peptide_analyses']

            print('=== 核心表数据示例 (每条只显示前3列) ===')
            for ct in core_tables:
                if ct not in tables:
                    continue
                try:
                    q_count = text(f'SELECT COUNT(*) FROM public.{ct}')
                    result = await conn.execute(q_count)
                    cnt = result.scalar()

                    q_sample = text(f'SELECT * FROM public.{ct} LIMIT 1')
                    result = await conn.execute(q_sample)
                    samples = result.fetchall()
                    cols = list(result.keys())

                    print(f'\n  [{ct}] 共 {cnt} 条记录 | 列: {", ".join(cols[:8])}')
                    if samples:
                        row = samples[0]
                        for c in cols[:5]:
                            v = row[cols.index(c)]
                            vstr = str(v)[:60]
                            print(f'       {c} = {vstr}')
                    else:
                        print('    (空表)')
                except Exception as e:
                    print(f'  [{ct}] 查询出错: {e}')

        await engine.dispose()
        print('\n=== 检查完成 ===')

    except Exception as e:
        print(f'连接失败: {e}')
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    asyncio.run(check_database())
