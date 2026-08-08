from sqlalchemy import create_engine, text

engine = create_engine(
    'postgresql+psycopg2://postgres:password@localhost:5432/rmfood',
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600,
)

try:
    with engine.connect() as conn:
        print('DB connection OK')
        tables = ['retail_products', 'import_tasks', 'import_errors', 'off_sync_state']
        for tbl in tables:
            res = conn.execute(text(f"SELECT EXISTS (SELECT FROM pg_tables WHERE tablename='{tbl}')"))
            exists = res.fetchone()[0]
            print(f'{tbl}: {"YES" if exists else "NO"}')
except Exception as e:
    print(f'Error: {e}')
finally:
    engine.dispose()
