"""直接创建术语数据库表（绕过alembic编码问题）"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.terminology import Term, TermCategory, TermVariant, TermValidation, TermNormalizationRule, TermStatistics
from app.core.database import Base

# 创建数据库连接（使用同步引擎）
db_url = settings.database_url
if 'aiosqlite' in db_url:
    db_url = db_url.replace('+aiosqlite', '')
print(f"数据库URL: {db_url}")
engine = create_engine(db_url)

def create_tables():
    """创建表结构"""
    print("创建术语相关表...")
    
    # 创建所有术语相关表
    Base.metadata.create_all(engine, tables=[
        TermCategory.__table__,
        Term.__table__,
        TermVariant.__table__,
        TermValidation.__table__,
        TermNormalizationRule.__table__,
        TermStatistics.__table__,
    ])
    
    print("✅ 表结构创建完成")

if __name__ == "__main__":
    create_tables()