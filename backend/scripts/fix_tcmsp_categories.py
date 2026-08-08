"""
TCMSP 中药库数据修复脚本
=========================
直接使用 SQL UPDATE 语句修复数据库中的分类、拉丁名、TCMSP ID 等字段。

问题：之前的迁移脚本虽然执行了 commit，但 ORM 对象的更新没有生效。
解决方案：使用原生 SQL 直接更新数据库。
"""
import asyncio
import sys
import os
import json
import hashlib
from datetime import datetime

# 设置 UTF-8 编码
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# 导入金标数据和工具函数
from scripts.etl_sync_pipeline import TCMSP_GOLDEN, CATEGORY_NORMALIZATION_MAP, FOOD_HOMOLOGY_CATALOG_RAW, check_food_homology as _check_food_homology, normalize_category as _normalize_category


def normalize_category(cat: str | None) -> str:
    """将非标准分类归一化为 TCMSP 标准分类"""
    if not cat:
        return "未分类"
    current = cat
    visited = set()
    for _ in range(10):
        if current in visited:
            break
        visited.add(current)
        if current in CATEGORY_NORMALIZATION_MAP:
            current = CATEGORY_NORMALIZATION_MAP[current]
        else:
            break
    return current


def check_food_homology(name_cn: str) -> bool:
    """根据药食同源目录检查药材是否为药食同源"""
    normalized = name_cn.split("（")[0].split("(")[0].strip()
    if normalized in FOOD_HOMOLOGY_CATALOG_RAW:
        return True
    for entry in FOOD_HOMOLOGY_CATALOG_RAW:
        if normalized in entry or entry in normalized:
            return True
    return False


async def fix_database():
    """主修复流程"""
    print("=" * 70)
    print("  TCMSP 中药库数据修复脚本")
    print("=" * 70)

    # 连接数据库
    from app.core.config import get_settings
    settings = get_settings()
    db_url = settings.database.url

    print(f"\n[1] 连接数据库...")
    engine = create_async_engine(db_url, echo=False, pool_pre_ping=True)

    async with engine.begin() as conn:
        # 2. 获取现有数据
        print(f"[2] 获取现有数据...")
        result = await conn.execute(text("SELECT id, name_cn FROM tcm_herbs ORDER BY id"))
        existing = result.fetchall()
        print(f"  现有药材: {len(existing)} 条")

        # 3. 统计金标数据
        print(f"\n[3] 金标数据统计...")
        print(f"  金标药材: {len(TCMSP_GOLDEN)} 味")

        # 4. 执行批量更新
        print(f"\n[4] 执行批量更新...")
        updated = 0
        inserted_ids = []

        # 构建批量更新的参数
        batch_updates = []
        for name_cn, data in TCMSP_GOLDEN.items():
            # 查找对应的数据库记录
            herb_id = None
            for row in existing:
                if row[1] == name_cn:
                    herb_id = row[0]
                    break

            if herb_id is None:
                # 新药材，需要插入
                continue

            # 计算标准化分类
            raw_cat = data.get("cat", "")
            norm_cat = normalize_category(raw_cat)

            # 检查药食同源
            is_food = data.get("food", check_food_homology(name_cn))

            # OB/DL 范围
            ob_range = data.get("ob_range", (0, 100))
            dl_range = data.get("dl_range", (0, 1))

            batch_updates.append({
                "id": herb_id,
                "name_latin": data.get("latin", ""),
                "category": norm_cat,
                "ob_percent": (ob_range[0] + ob_range[1]) / 2,
                "dl_value": (dl_range[0] + dl_range[1]) / 2,
                "is_food_homology": is_food,
                "tcmsp_id": f"TMSP_{herb_id:04d}",
                "source_version": "v3.1-tcmsp-fixed",
            })

        # 分批执行更新（每批100条）
        batch_size = 100
        for i in range(0, len(batch_updates), batch_size):
            batch = batch_updates[i:i+batch_size]
            for update in batch:
                await conn.execute(text("""
                    UPDATE tcm_herbs SET
                        name_latin = :name_latin,
                        category = :category,
                        ob_percent = :ob_percent,
                        dl_value = :dl_value,
                        is_food_homology = :is_food_homology,
                        tcmsp_id = :tcmsp_id,
                        source_version = :source_version,
                        synced_at = NOW()
                    WHERE id = :id
                """), update)
                updated += 1

        await conn.commit()
        print(f"  更新: {updated} 条")

        # 5. 更新知识图谱节点 - 使用新的连接
        print(f"\n[5] 更新知识图谱节点...")
        kg_engine = create_async_engine(db_url, echo=False, pool_pre_ping=True)
        async with kg_engine.begin() as kg_conn:
            kg_result = await kg_conn.execute(text("""
                SELECT id, node_label, properties
                FROM kg_nodes
                WHERE node_type = 'herb'
            """))
            kg_herbs = {row[1]: {"id": row[0], "properties": row[2]} for row in kg_result.fetchall()}

            kg_updated = 0
            for name_cn in TCMSP_GOLDEN.keys():
                if name_cn in kg_herbs:
                    herb_kg = kg_herbs[name_cn]
                    props = herb_kg["properties"] or {}
                    if props.get("source") != "tcmsp":
                        props["source"] = "tcmsp"
                        props["restored_at"] = datetime.now().isoformat()
                        await kg_conn.execute(text("""
                            UPDATE kg_nodes SET properties = :props WHERE id = :id
                        """), {"props": json.dumps(props, ensure_ascii=False), "id": herb_kg["id"]})
                        kg_updated += 1

            await kg_conn.commit()
            print(f"  知识图谱更新: {kg_updated} 个节点")
        await kg_engine.dispose()

        # 6. 创建数据快照 - 使用新的连接
        print(f"\n[6] 创建数据快照...")
        snapshot_engine = create_async_engine(db_url, echo=False, pool_pre_ping=True)
        async with snapshot_engine.begin() as snap_conn:
            now = datetime.utcnow()
            snapshot_id = f"tcmsp_fix_{now.strftime('%Y%m%d_%H%M%S')}"

            await snap_conn.execute(text("""
                UPDATE data_snapshots SET is_active = FALSE WHERE source_db = 'tcmsp_fix'
            """))

            checksum = hashlib.sha256(json.dumps(sorted(list(TCMSP_GOLDEN.keys()))).encode()).hexdigest()

            await snap_conn.execute(text("""
                INSERT INTO data_snapshots
                    (snapshot_id, source_db, total_records, checksum, metadata, is_active, created_at)
                VALUES
                    (:snapshot_id, 'tcmsp_fix', :total, :checksum, :metadata, TRUE, NOW())
            """), {
                "snapshot_id": snapshot_id,
                "total": len(TCMSP_GOLDEN),
                "checksum": checksum,
                "metadata": json.dumps({
                    "fixed": updated,
                    "kg_updated": kg_updated,
                    "version": "v3.1-tcmsp-fixed",
                    "timestamp": now.isoformat(),
                }, ensure_ascii=False),
            })
            await snap_conn.commit()
            print(f"  快照ID: {snapshot_id}")
        await snapshot_engine.dispose()

    await engine.dispose()

    # 7. 验证结果
    print(f"\n[7] 验证结果...")
    engine = create_async_engine(db_url, echo=False, pool_pre_ping=True)
    async with engine.begin() as conn:
        # 分类统计
        result = await conn.execute(text("""
            SELECT category, COUNT(*) as cnt
            FROM tcm_herbs
            GROUP BY category
            ORDER BY cnt DESC
            LIMIT 10
        """))
        rows = result.fetchall()
        print(f"  分类统计 (前10类):")
        for row in rows:
            print(f"    {row[0]}: {row[1]}")

        # 药食同源统计
        result = await conn.execute(text("""
            SELECT
                COUNT(*) FILTER (WHERE is_food_homology = TRUE) as food_true,
                COUNT(*) FILTER (WHERE is_food_homology = FALSE) as food_false
            FROM tcm_herbs
        """))
        food_true, food_false = result.fetchone()
        print(f"\n  药食同源: 是={food_true}, 否={food_false}")

        # TCMSP ID 统计
        result = await conn.execute(text("""
            SELECT
                COUNT(*) FILTER (WHERE tcmsp_id IS NOT NULL AND tcmsp_id != '') as tcmsp_count,
                MIN(tcmsp_id) as min_id,
                MAX(tcmsp_id) as max_id
            FROM tcm_herbs
        """))
        tcmsp_count, min_id, max_id = result.fetchone()
        print(f"  TCMSP ID: 已分配={tcmsp_count}, 范围={min_id} ~ {max_id}")

        # 示例数据
        result = await conn.execute(text("""
            SELECT name_cn, name_latin, category, ob_percent, dl_value, is_food_homology, tcmsp_id
            FROM tcm_herbs
            WHERE name_cn IN ('人参', '黄芪', '党参')
            ORDER BY name_cn
        """))
        print(f"\n  示例数据:")
        for row in result.fetchall():
            print(f"    {row[0]}: latin={row[1]}, cat={row[2]}, ob={row[3]}, dl={row[4]}, food={row[5]}, id={row[6]}")

    await engine.dispose()

    print(f"\n{'=' * 70}")
    print("  修复完成!")
    print(f"  更新药材: {updated} 条")
    print(f"  更新知识图谱: {kg_updated} 个节点")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    asyncio.run(fix_database())
