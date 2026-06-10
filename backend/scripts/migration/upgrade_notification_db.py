"""
数据库升级脚本 - 通知系统表结构
直接执行SQL，不依赖Alembic
"""
import asyncio
import sys
sys.path.insert(0, '.')

from sqlalchemy import text
from app.core.config import settings


async def upgrade_notification_system():
    """升级通知系统表结构"""
    
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    
    print(f"🔧 连接数据库: {settings.database_url}")
    
    engine = create_async_engine(settings.database_url, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # ============================================================
            # 1. 检查并添加新字段到 notifications 表
            # ============================================================
            
            # 检查表是否存在
            result = await session.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='notifications'"
            ))
            table_exists = result.fetchone()
            
            if not table_exists:
                print("⚠️ notifications 表不存在，创建新表...")
                await session.execute(text("""
                    CREATE TABLE notifications (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        subject VARCHAR(200) NOT NULL,
                        body TEXT,
                        channel VARCHAR(20) DEFAULT 'in_app' NOT NULL,
                        metadata JSON,
                        is_read BOOLEAN DEFAULT FALSE NOT NULL,
                        read_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                """))
                await session.execute(text(
                    "CREATE INDEX ix_notifications_user_id ON notifications(user_id)"
                ))
                await session.execute(text(
                    "CREATE INDEX ix_notifications_created_at ON notifications(created_at)"
                ))
            else:
                print("✅ notifications 表已存在，检查字段...")
                
                # 获取现有列
                result = await session.execute(text("PRAGMA table_info(notifications)"))
                columns = {row[1] for row in result.fetchall()}
                
                # 添加缺失的字段
                if 'subject' not in columns:
                    print("  ➕ 添加 subject 字段...")
                    await session.execute(text(
                        "ALTER TABLE notifications ADD COLUMN subject VARCHAR(200)"
                    ))
                    # 从旧字段迁移数据
                    await session.execute(text(
                        "UPDATE notifications SET subject = COALESCE(title, '无标题') WHERE subject IS NULL"
                    ))
                
                if 'body' not in columns:
                    print("  ➕ 添加 body 字段...")
                    await session.execute(text(
                        "ALTER TABLE notifications ADD COLUMN body TEXT"
                    ))
                    await session.execute(text(
                        "UPDATE notifications SET body = COALESCE(content, '') WHERE body IS NULL"
                    ))
                
                if 'channel' not in columns:
                    print("  ➕ 添加 channel 字段...")
                    await session.execute(text(
                        "ALTER TABLE notifications ADD COLUMN channel VARCHAR(20) DEFAULT 'in_app'"
                    ))
                
                if 'metadata' not in columns:
                    print("  ➕ 添加 metadata 字段...")
                    await session.execute(text(
                        "ALTER TABLE notifications ADD COLUMN metadata JSON"
                    ))
                
                if 'is_read' not in columns:
                    print("  ➕ 添加 is_read 字段...")
                    await session.execute(text(
                        "ALTER TABLE notifications ADD COLUMN is_read BOOLEAN DEFAULT FALSE"
                    ))
                    # 从旧status字段迁移数据
                    await session.execute(text(
                        "UPDATE notifications SET is_read = (status = 'read') WHERE is_read IS FALSE"
                    ))
                
                if 'read_at' not in columns:
                    print("  ➕ 添加 read_at 字段...")
                    await session.execute(text(
                        "ALTER TABLE notifications ADD COLUMN read_at TIMESTAMP"
                    ))
            
            # ============================================================
            # 2. 创建 notification_preferences 表
            # ============================================================
            
            result = await session.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='notification_preferences'"
            ))
            pref_table_exists = result.fetchone()
            
            if not pref_table_exists:
                print("\n📋 创建 notification_preferences 表...")
                await session.execute(text("""
                    CREATE TABLE notification_preferences (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL UNIQUE,
                        data JSON NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                """))
                await session.execute(text(
                    "CREATE UNIQUE INDEX ix_notification_preferences_user_id ON notification_preferences(user_id)"
                ))
                print("  ✅ notification_preferences 表创建成功")
            else:
                print("  ✅ notification_preferences 表已存在")
            
            # 提交所有更改
            await session.commit()
            
            print("\n" + "="*60)
            print("🎉 通知系统表结构升级完成！")
            print("="*60)
            
            # 验证表结构
            print("\n📊 验证表结构:")
            
            result = await session.execute(text("PRAGMA table_info(notifications)"))
            print("\n📬 notifications 表字段:")
            for row in result.fetchall():
                print(f"   - {row[1]} ({row[2]})")
            
            result = await session.execute(text("PRAGMA table_info(notification_preferences)"))
            print("\n⚙️ notification_preferences 表字段:")
            for row in result.fetchall():
                print(f"   - {row[1]} ({row[2]})")
            
        except Exception as e:
            print(f"\n❌ 升级失败: {e}")
            import traceback
            traceback.print_exc()
            await session.rollback()
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(upgrade_notification_system())
