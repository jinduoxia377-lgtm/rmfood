"""运行数据库迁移"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from alembic.config import Config
from alembic import command

def main():
    # 加载配置
    cfg = Config('alembic.ini')
    
    # 设置数据库连接
    from app.core.config import settings
    cfg.set_main_option('sqlalchemy.url', settings.database_url)
    
    # 执行迁移
    print("执行数据库迁移...")
    command.upgrade(cfg, 'head')
    print("✅ 数据库迁移完成")

if __name__ == '__main__':
    main()