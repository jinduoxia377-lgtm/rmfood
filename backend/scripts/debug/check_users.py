import sqlite3

conn = sqlite3.connect('rmfood.db')
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print('Tables:', tables)

for table in tables:
    table_name = table[0]
    print(f'\n=== Table: {table_name} ===')
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = cursor.fetchall()
    print('Columns:', [col[1] for col in columns])

    cursor.execute(f"SELECT * FROM {table_name} LIMIT 5")
    rows = cursor.fetchall()
    for row in rows:
        print(row)

conn.close()