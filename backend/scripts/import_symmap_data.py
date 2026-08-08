"""SymMap 中药材数据导入脚本

从清洗后的 DataFrame 导入数据到 symmap_herbs 表。
"""
import asyncio
import logging
import sys
from datetime import datetime, timezone

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


async def import_symmap_herbs():
    """导入 SymMap 药材数据到数据库"""
    from sqlalchemy import select
    from app.core.session import async_session_factory
    from app.models.external_data import SymMapHerb
    import pandas as pd

    # 读取清洗后的数据
    logger.info("读取清洗后的 SymMap 数据...")
    df = pd.read_csv('C:/Users/Administrator/AppData/Local/Temp/symmap_herbs_cleaned.csv', encoding='utf-8-sig')
    logger.info(f"读取到 {len(df)} 条记录")

    async with async_session_factory() as db:
        # 检查是否已有数据
        result = await db.execute(select(SymMapHerb).limit(1))
        existing = result.scalar_one_or_none()
        if existing:
            logger.info("symmap_herbs 表已有数据，跳过导入")
            return

        # 导入数据
        count = 0
        for _, row in df.iterrows():
            herb = SymMapHerb(
                symmap_id=int(row['symmap_id']),
                name_cn=row['name_cn'],
                name_pinyin=row['name_pinyin'] if pd.notna(row['name_pinyin']) else None,
                name_latin=row['name_latin'] if pd.notna(row['name_latin']) else None,
                name_eng=row['name_eng'] if pd.notna(row['name_eng']) else None,
                nature_cn=row['nature_cn'] if pd.notna(row['nature_cn']) else None,
                nature_eng=row['nature_eng'] if pd.notna(row['nature_eng']) else None,
                meridians_cn=row['meridians_cn'] if pd.notna(row['meridians_cn']) else None,
                meridians_eng=row['meridians_eng'] if pd.notna(row['meridians_eng']) else None,
                category_cn=row['category_cn'] if pd.notna(row['category_cn']) else None,
                category_eng=row['category_eng'] if pd.notna(row['category_eng']) else None,
                use_part=row['use_part'] if pd.notna(row['use_part']) else None,
                tcmsp_id=int(row['tcmsp_id']) if pd.notna(row['tcmsp_id']) else None,
                tcmid_id=int(row['tcmid_id']) if pd.notna(row['tcmid_id']) else None,
                tcmid2_id=int(row['tcmid2_id']) if pd.notna(row['tcmid2_id']) else None,
                herbdb_id=row['herbdb_id'] if pd.notna(row['herbdb_id']) else None,
                alias=row['alias'] if pd.notna(row['alias']) else None,
                source_version='v2.0_symmap',
                synced_at=datetime.now(timezone.utc),
            )
            db.add(herb)
            count += 1

        await db.commit()
        logger.info(f"✅ 成功导入 {count} 条 SymMap 药材数据")


def main():
    """主函数"""
    asyncio.run(import_symmap_herbs())


if __name__ == "__main__":
    main()
