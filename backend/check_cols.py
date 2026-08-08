from sqlalchemy import create_engine, text

engine = create_engine("postgresql://rmfood:***@localhost:5432/rmfood_db")
with engine.connect() as conn:
    r = conn.execute(text(
        "SELECT attname, format_type(atttypid, atttypmod) AS type "
        "FROM pg_attribute "
        "WHERE attrelid = 'food_materials'::regclass "
        "AND attnum > 0 AND NOT attisdropped "
        "ORDER BY attnum"
    ))
    for row in r.fetchall():
        print(f"{row[0]:30s} = {row[1]}")
