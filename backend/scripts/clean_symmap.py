"""
SymMap 数据清洗脚本
====================

修正补全过程中产生的问题：
1. 将英文 use_part 翻译为中文
2. 修正明显错误的推导值
3. 清理重复/无效数据
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# 英文 → 中文药用部位映射
EN_TO_CN_PART = {
    'root': '根', 'roots': '根', 'radix': '根',
    'rhizoma': '根茎', 'rhizome': '根茎',
    'stem': '茎', 'caulis': '茎',
    'leaf': '叶', 'folium': '叶', 'leaves': '叶',
    'bark': '皮', 'cortex': '皮',
    'fruit': '果实', 'fructus': '果实',
    'seed': '种子', 'semen': '种子',
    'flower': '花', 'flos': '花',
    'herb': '全草', 'herba': '全草',
    'resin': '树脂', 'resina': '树脂',
    'gum': '树脂',
    'gelatin': '胶', 'colla': '胶',
    'bulb': '鳞茎', 'bulbus': '鳞茎',
    'tuber': '块茎',
    'nut': '种子',
    'spine': '刺',
    'shell': '贝壳',
    'bone': '骨',
    'skin': '皮',
    'peel': '果皮',
    'pollen': '花粉',
    'exudate': '树脂',
    'balsam': '树脂',
    'periostracum': '外壳',
    'kernel': '仁/种仁',
    'pericarp': '果皮',
    'inflorescence': '花序',
    'tuberoid': '块茎',
    'achene': '瘦果',
    'bud': '芽',
    'calyx': '萼',
    'capitulum': '头状花序',
    'capsule': '蒴果',
    'exocarp': '外果皮',
    'gallstone': '胆结石',
    'heartwood': '心材',
    'rattan': '藤茎',
    'sclerotium': '菌核',
    'spike': '穗状花序',
    'sporocarp': '孢子叶球',
    'twig': '嫩枝',
}

# 明显错误的修正映射
FIXED_USE_PART = {
    '蝉蜕': '蜕壳',  # 不是"骨"
    '艾片（左旋龙脑）': '结晶',
    '艾片': '结晶',
}


async def clean_symmap_data():
    """数据清洗流程"""
    print("=" * 70)
    print("  SymMap 数据清洗")
    print("=" * 70)

    engine = create_async_engine(settings.database.url, echo=False, pool_pre_ping=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    stats = {'english_to_chinese': 0, 'fixed_errors': 0, 'total': 0}

    async with async_session() as session:
        # 1. 获取所有有英文 use_part 的记录
        print("\n[1/3] 查找英文药用部位...")
        r = await session.execute(text("""
            SELECT symmap_id, name_cn, use_part
            FROM symmap_herbs
            WHERE use_part IS NOT NULL AND use_part <> ''
            AND use_part ~ '^[a-zA-Z]+$'
        """))
        rows = r.fetchall()
        print(f"  找到 {len(rows)} 条英文 use_part")

        for row in rows:
            sid, name_cn, en_part = row
            cn_part = EN_TO_CN_PART.get(en_part.strip().lower(), en_part)
            await session.execute(
                text("UPDATE symmap_herbs SET use_part = :part WHERE symmap_id = :id"),
                {"part": cn_part, "id": sid}
            )
            stats['english_to_chinese'] += 1

        # 2. 修正已知错误
        print("\n[2/3] 修正已知错误...")
        for name, correct_part in FIXED_USE_PART.items():
            r = await session.execute(
                text("UPDATE symmap_herbs SET use_part = :part WHERE name_cn = :name AND use_part != :part"),
                {"part": correct_part, "name": name}
            )
            if r.rowcount > 0:
                stats['fixed_errors'] += 1
                print(f"  修正: {name} -> {correct_part}")

        # 3. 检查是否还有英文 use_part
        r = await session.execute(text("""
            SELECT COUNT(*) FROM symmap_herbs
            WHERE use_part IS NOT NULL AND use_part <> ''
            AND use_part ~ '^[a-zA-Z]+$'
        """))
        remaining = r.scalar()

        await session.commit()

    await engine.dispose()

    # 报告
    print(f"\n[3/3] 清洗报告:")
    print(f"  英文->中文转换: {stats['english_to_chinese']} 条")
    print(f"  错误修正:       {stats['fixed_errors']} 条")
    print(f"  剩余英文 use_part: {remaining} 条")
    print(f"\n{'=' * 70}")


if __name__ == "__main__":
    asyncio.run(clean_symmap_data())
