import sqlite3
import os

# 测试数据库连接
db_path = 'rmfood.db'

def check_db():
    """检查数据库文件状态，返回 True 表示正常"""
    if not os.path.exists(db_path):
        print(f"提示: 数据库文件 {db_path} 不存在（使用 PostgreSQL）")
        return False
    if not os.access(db_path, os.R_OK):
        print(f"错误: 无法读取数据库文件 {db_path}")
        return False
    if not os.access(db_path, os.W_OK):
        print(f"错误: 无法写入数据库文件 {db_path}")
        return False
    return True


if __name__ == "__main__":
    try:
        if not check_db():
            exit(0)  # SQLite 不可用时正常退出

        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()

        print(f"数据库连接成功！")
        print(f"数据库文件大小: {os.path.getsize(db_path)} 字节")
        print(f"数据库中的表:")
        for table in tables:
            print(f"  - {table[0]}")

        conn.close()
        print("\n测试完成，数据库连接正常")
    except Exception as e:
        print(f"错误: {str(e)}")
        exit(1)
