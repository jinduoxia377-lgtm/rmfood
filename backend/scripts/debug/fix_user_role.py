import sqlite3

conn = sqlite3.connect('rmfood.db')
cursor = conn.cursor()

print("=== 修正前的用户角色 ===")
cursor.execute("SELECT id, username, role FROM users")
for row in cursor.fetchall():
    print(f"ID: {row[0]}, Username: {row[1]}, Role: {row[2]}")

print("\n=== 修正用户角色 ===")
cursor.execute("UPDATE users SET role = 'admin' WHERE role = 'ADMIN'")
conn.commit()
print(f"更新了 {cursor.rowcount} 条记录")

print("\n=== 修正后的用户角色 ===")
cursor.execute("SELECT id, username, role FROM users")
for row in cursor.fetchall():
    print(f"ID: {row[0]}, Username: {row[1]}, Role: {row[2]}")

conn.close()
print("\n数据库修正完成！")