"""
数据库结构修复脚本 - 添加 User 表缺失的字段

用于将旧版数据库升级到 SSS 版本
"""
import sqlite3
import asyncio
import logging

logger = logging.getLogger(__name__)

DB_PATH = "rmfood.db"


async def fix_database():
    """修复数据库表结构，添加缺失的列"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # 获取 users 表的现有列
        cursor.execute("PRAGMA table_info(users)")
        existing_columns = {row[1] for row in cursor.fetchall()}
        
        logger.info(f"📋 当前 users 表列: {existing_columns}")
        
        # 需要添加的新列定义
        new_columns = [
            ("avatar_url", "VARCHAR(500)"),
            ("preferences", "JSON DEFAULT '{}'"),
            ("last_login", "DATETIME"),
            ("login_attempts", "INTEGER DEFAULT 0"),
            ("locked_until", "DATETIME"),
        ]
        
        added_count = 0
        for column_name, column_type in new_columns:
            if column_name not in existing_columns:
                try:
                    sql = f"ALTER TABLE users ADD COLUMN {column_name} {column_type}"
                    cursor.execute(sql)
                    logger.info(f"✅ 添加列: {column_name} ({column_type})")
                    added_count += 1
                except Exception as e:
                    logger.warning(f"⚠️ 添加列 {column_name} 失败: {e}")
            else:
                logger.info(f"⏭️ 列已存在: {column_name}")
        
        # 提交更改
        conn.commit()
        
        logger.info(f"🎉 数据库修复完成! 共添加 {added_count} 个新列")
        
        # 验证
        cursor.execute("PRAGMA table_info(users)")
        final_columns = [row[1] for row in cursor.fetchall()]
        logger.info(f"📋 修复后 users 表列 ({len(final_columns)}): {final_columns}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ 数据库修复失败: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
    asyncio.run(fix_database())
