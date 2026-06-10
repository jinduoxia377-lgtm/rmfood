import sqlite3
import os

# 测试数据库连接
db_path = 'rmfood.db'

try:
    # 检查文件是否存在
    if not os.path.exists(db_path):
        print(f"错误: 数据库文件 {db_path} 不存在")
        exit(1)
    
    # 检查文件是否可读写
    if not os.access(db_path, os.R_OK):
        print(f"错误: 无法读取数据库文件 {db_path}")
        exit(1)
    
    if not os.access(db_path, os.W_OK):
        print(f"错误: 无法写入数据库文件 {db_path}")
        exit(1)
    
    # 尝试连接数据库
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 测试数据库操作 - 获取所有表
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    print(f"数据库连接成功！")
    print(f"数据库文件大小: {os.path.getsize(db_path)} 字节")
    print(f"数据库中的表:")
    for table in tables:
        print(f"  - {table[0]}")
    
    # 关闭连接
    conn.close()
    print("\n测试完成，数据库连接正常")
    
except Exception as e:
    print(f"错误: {str(e)}")
