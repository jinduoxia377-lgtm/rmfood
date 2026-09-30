"""
肽链结构分析模块 - 数据库迁移脚本
直接执行 SQL 创建表，不依赖 alembic
"""

import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import create_engine, text
from app.core.config import settings


def create_peptide_structures_table():
    """创建 peptide_structures 表"""
    engine = create_engine(settings.database_url.replace('postgresql+asyncpg', 'postgresql'))
    
    with engine.connect() as conn:
        # 启用 pg_trgm 扩展（用于 GIN 索引）
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
            conn.commit()
            print("  [OK] pg_trgm extension enabled")
        except Exception as e:
            print(f"  [WARN] pg_trgm extension skip: {e}")
        
        # 检查表是否已存在
        result = conn.execute(text("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'peptide_structures'
        """))
        if result.fetchone():
            print("[OK] Table peptide_structures already exists, skipping")
            return True
        
        # 创建表
        conn.execute(text("""
            CREATE TABLE peptide_structures (
                id BIGSERIAL PRIMARY KEY,
                sequence VARCHAR(100) NOT NULL UNIQUE,
                smiles TEXT,
                selfies VARCHAR(2000),
                is_cyclic BOOLEAN DEFAULT FALSE,
                cyclization_type VARCHAR(50),
                modifications JSONB,
                molecular_weight DOUBLE PRECISION,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))
        
        # 创建索引
        conn.execute(text("""
            CREATE INDEX idx_peptide_structures_sequence ON peptide_structures(sequence)
        """))
        
        try:
            conn.execute(text("""
                CREATE INDEX idx_peptide_structures_smiles ON peptide_structures USING gin(smiles gin_trgm_ops)
            """))
        except Exception as e:
            print(f"  - GIN index creation skipped: {e}")
        
        conn.commit()
        print("[OK] Table peptide_structures created successfully")
        return True


def create_peptide_structure_analyses_table():
    """创建 peptide_structure_analyses 表（历史分析记录）"""
    engine = create_engine(settings.database_url.replace('postgresql+asyncpg', 'postgresql'))
    
    with engine.connect() as conn:
        # 检查表是否已存在
        result = conn.execute(text("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'peptide_structure_analyses'
        """))
        if result.fetchone():
            print("[OK] Table peptide_structure_analyses already exists, skipping")
            return True
        
        # 创建表
        conn.execute(text("""
            CREATE TABLE peptide_structure_analyses (
                id BIGSERIAL PRIMARY KEY,
                sequence VARCHAR(500) NOT NULL,
                user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
                smiles TEXT,
                selfies TEXT,
                molecular_weight DOUBLE PRECISION DEFAULT 0,
                isoelectric_point DOUBLE PRECISION DEFAULT 0,
                hydrophobicity DOUBLE PRECISION DEFAULT 0,
                ace_inhibition_score DOUBLE PRECISION DEFAULT 0,
                antioxidant_score DOUBLE PRECISION DEFAULT 0,
                antimicrobial_score DOUBLE PRECISION DEFAULT 0,
                is_allergen BOOLEAN DEFAULT FALSE,
                is_toxic BOOLEAN DEFAULT FALSE,
                digestibility VARCHAR(20) DEFAULT 'unknown',
                bitterness_score DOUBLE PRECISION DEFAULT 0,
                umami_potential DOUBLE PRECISION DEFAULT 0,
                food_safety_score DOUBLE PRECISION DEFAULT 0,
                source_food VARCHAR(200),
                source_database VARCHAR(100),
                literature_refs JSONB DEFAULT '[]'::jsonb,
                n_terminal_mod VARCHAR(20),
                c_terminal_mod VARCHAR(20),
                unusual_aas JSONB DEFAULT '[]'::jsonb,
                status VARCHAR(20) DEFAULT 'completed',
                error_message TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                deleted_at TIMESTAMP WITH TIME ZONE
            )
        """))
        
        # 创建索引
        conn.execute(text("""
            CREATE INDEX ix_peptide_structure_seq ON peptide_structure_analyses(sequence)
        """))
        
        conn.execute(text("""
            CREATE INDEX ix_peptide_structure_user_time ON peptide_structure_analyses(user_id, created_at)
        """))
        
        conn.execute(text("""
            CREATE INDEX ix_peptide_structure_score ON peptide_structure_analyses(food_safety_score)
        """))
        
        conn.commit()
        print("[OK] Table peptide_structure_analyses created successfully")
        return True


def add_has_structure_column():
    """给 peptide_analyses 表添加 has_structure 列"""
    engine = create_engine(settings.database_url.replace('postgresql+asyncpg', 'postgresql'))
    
    with engine.connect() as conn:
        # 检查列是否已存在
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'peptide_analyses' 
            AND column_name = 'has_structure'
        """))
        if result.fetchone():
            print("[OK] Column has_structure already exists, skipping")
            return True
        
        # 添加列
        conn.execute(text("""
            ALTER TABLE peptide_analyses 
            ADD COLUMN has_structure BOOLEAN
        """))
        
        conn.commit()
        print("[OK] Column has_structure added successfully")
        return True


def main():
    """主函数"""
    print("=" * 60)
    print("  肽链结构分析模块 - 数据库迁移")
    print("=" * 60)
    
    try:
        # 执行迁移
        create_peptide_structures_table()
        create_peptide_structure_analyses_table()
        add_has_structure_column()
        
        print("\n" + "=" * 60)
        print("  [OK] All migrations completed!")
        print("=" * 60)
        return 0
    except Exception as e:
        print(f"\n[FAIL] Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
