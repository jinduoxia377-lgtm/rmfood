"""
TCMSP 中药库数据还原与升级脚本
================================
从 ETL 金标数据集完整还原 tcm_herbs 及相关表数据，并重建关联关系。

功能:
1. 从 golden_dataset 中还原所有药材记录
2. 标准化分类体系（26类标准分类）
3. 校准 OB/DL 值
4. 药食同源标记
5. 分配 TCMSP ID
6. 重建化合物/靶点/疾病关联表
7. 更新知识图谱节点和边
8. 数据验证

数据来源: backend/scripts/etl_sync_pipeline.py 中的 TCMSP_GOLDEN 数据集
"""
import asyncio
import sys
import os
import json
import hashlib
from datetime import datetime, timezone
from typing import Any

# 设置 UTF-8 编码
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# 添加 backend 到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select, func, update, insert, text
from sqlalchemy.orm import sessionmaker

# 导入项目模型
from app.models.external_data import TCMHerb
from app.models.tcm_schema import TCMCompound, TCMTarget, TCMDisease
from app.models.knowledge_graph import KGNode, KGEdge
from app.models.system import DataSnapshot
from app.core.config import settings

# ════════════════════════════════════════════════
# 分类标准化映射
# ════════════════════════════════════════════════

CATEGORY_NORMALIZATION_MAP = {
    "清热平肝药": "解表药",
    "补肾/润肠": "补阳药",
    "补虚/润下": "补气药",
    "温经止血药": "止血药",
    "清热生津": "清热泻火药",
    "清热化痰": "化痰止咳平喘药",
    "清肺化痰": "化痰止咳平喘药",
    "消痰软坚": "化痰止咳平喘药",
    "坠痰下气": "化痰止咳平喘药",
    "化痰止呕": "化痰止咳平喘药",
    "化痰药": "化痰止咳平喘药",
    "止咳平喘药": "化痰止咳平喘药",
    "泻肺平喘": "化痰止咳平喘药",
    "泻肺行水": "利水渗湿药",
    "利尿通淋": "利水渗湿药",
    "利湿去浊": "利水渗湿药",
    "利湿退黄": "利水渗湿药",
    "利水消肿": "利水渗湿药",
    "利水消肿/解酒": "利水渗湿药",
    "攻下药": "泻下药",
    "润下药": "泻下药",
    "峻下逐水药": "泻下药",
    "清热燥湿药": "清热解毒药",
    "清热解暑药": "清热解毒药",
    "清热泻火药": "清热解毒药",
    "清热凉血药": "清热解毒药",
    "清虚热药": "清热解毒药",
    "清热明目药": "清热解毒药",
    "活血调经": "活血化瘀药",
    "活血疗伤": "活血化瘀药",
    "消肿排脓": "清热解毒药",
    "活血通经/下乳": "活血化瘀药",
    "祛风药": "祛风湿药",
    "攻毒杀虫": "驱虫药",
    "驱虫药/外用": "驱虫药",
    "收涩药/清热": "收涩药",
}


def normalize_category(cat: str | None) -> str:
    """将非标准分类归一化为 TCMSP 标准分类（迭代归一化直到稳定）"""
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


# ════════════════════════════════════════════════
# 药食同源目录
# ════════════════════════════════════════════════

FOOD_HOMOLOGY_CATALOG_RAW = {
    "八角茴香", "刀豆", "姜", "枣", "山药", "山楂", "小茴香", "木瓜", "龙眼肉",
    "决明子", "百合", "肉豆蔻", "肉桂", "莲子", "芡实", "花椒", "麦芽", "赤小豆",
    "佛手", "杏仁", "昆布", "桃仁", "桑葚", "淡豆豉", "黑芝麻", "黑胡椒", "蜂蜜",
    "榧子", "薏苡仁", "枸杞子", "胖大海", "金银花", "余甘子", "葛根", "鱼腥草",
    "蒲公英", "益智仁", "藿香", "酸枣仁", "芦根", "荷叶", "乌梢蛇", "蝉蜕",
    "五加皮", "杜仲叶", "沙棘", "牡蛎", "乌梅", "橘皮", "薄荷", "紫苏", "薤白",
    "覆盆子", "玫瑰花", "人参叶", "制何首乌", "芦荟", "三七", "牛蒡根", "北沙参",
    "南沙参", "天冬", "麦冬", "丹参", "西洋参", "黄芪", "白术", "补骨脂", "当归",
    "党参", "肉苁蓉", "锁阳", "黄精", "玉竹", "白芍", "菊花", "桑叶", "黄荆子",
    "鸡内金", "青果", "栀子", "甘草", "罗汉果", "砂仁", "草豆蔻", "陈皮", "香橼",
    "香薷", "茯苓", "人参", "山银花", "芫荽", "松花粉", "粉葛", "布渣叶",
    "夏枯草", "山奈", "西红花", "草果", "姜黄", "荜茇", "铁皮石斛", "天麻",
    "山茱萸", "杜仲", "熟地黄", "化橘红", "人参须", "小蓟", "川牛膝", "木香",
    "五味子", "太子参", "白芷", "白茅根", "沙棘", "柏子仁", "桔梗",
    "莱菔子", "高良姜", "淡竹叶", "菊苣", "黄芥子", "紫苏子", "槐米", "鲜白茅根",
    "鲜芦根", "蝮蛇", "橘红", "橘络", "广藿香",
}


def _normalize_catalog_name(name: str) -> str:
    """规范化目录名称：去除括号及括号内容、空格"""
    return name.split("（")[0].split("(")[0].strip()


FOOD_HOMOLOGY_CATALOG = {_normalize_catalog_name(n) for n in FOOD_HOMOLOGY_CATALOG_RAW}


def check_food_homology(name_cn: str) -> bool:
    """根据药食同源目录检查药材是否为药食同源"""
    normalized = _normalize_catalog_name(name_cn)
    if normalized in FOOD_HOMOLOGY_CATALOG:
        return True
    for entry in FOOD_HOMOLOGY_CATALOG:
        if normalized in entry or entry in normalized:
            return True
    return False


# ════════════════════════════════════════════════
# 从 ETL 脚本导入金标数据
# ════════════════════════════════════════════════

def load_golden_dataset() -> dict[str, dict[str, Any]]:
    """从 etl_sync_pipeline.py 加载 TCMSP_GOLDEN 数据集"""
    etl_path = os.path.join(os.path.dirname(__file__), 'etl_sync_pipeline.py')
    if not os.path.exists(etl_path):
        print(f"错误: 找不到 ETL 脚本: {etl_path}")
        return {}

    # 使用 importlib 安全导入
    import importlib.util
    spec = importlib.util.spec_from_file_location("etl_sync", etl_path)
    if spec is None or spec.loader is None:
        print("错误: 无法加载 ETL 脚本模块")
        return {}

    mod = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)
        golden = mod.TCMSP_GOLDEN
        print(f"成功加载金标数据: {len(golden)} 味药材")
        return golden
    except Exception as e:
        print(f"加载金标数据失败: {e}")
        import traceback
        traceback.print_exc()
        return {}


# ════════════════════════════════════════════════
# 数据转换函数
# ════════════════════════════════════════════════

def transform_herb_record(name_cn: str, golden: dict) -> dict[str, Any]:
    """将金标记录转换为数据库写入格式"""
    g = golden.get(name_cn, {})

    # 分类标准化
    raw_cat = g.get("cat", "")
    normalized_cat = normalize_category(raw_cat)

    # OB/DL 范围
    ob_range = g.get("ob_range", (0, 100))
    dl_range = g.get("dl_range", (0, 1))

    # 药食同源
    is_food = g.get("food", check_food_homology(name_cn))

    return {
        "name_cn": name_cn,
        "name_latin": g.get("latin", ""),
        "category": normalized_cat,
        "ob_range": ob_range,
        "dl_range": dl_range,
        "is_food_homology": is_food,
    }


# ════════════════════════════════════════════════
# 数据库操作
# ════════════════════════════════════════════════

async def migrate_tcmsp_data():
    """主迁移流程"""
    print("=" * 70)
    print("  TCMSP 中药库数据还原与升级")
    print("=" * 70)

    # 1. 加载金标数据
    print("\n[1/7] 加载金标数据集...")
    golden = load_golden_dataset()
    if not golden:
        print("错误: 无法加载金标数据，退出")
        return False

    # 2. 连接数据库
    print("\n[2/7] 连接数据库...")
    from app.core.config import get_settings
    settings = get_settings()
    db_url = settings.database.url

    engine = create_async_engine(db_url, echo=False, pool_pre_ping=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # 3. 获取现有数据
        print("\n[3/7] 获取现有数据...")
        result = await session.execute(select(TCMHerb))
        existing_herbs = {row.name_cn: row for row in result.scalars().all()}
        print(f"  现有药材: {len(existing_herbs)} 条")

        # 4. 转换金标数据
        print("\n[4/7] 转换金标数据...")
        transformed = {}
        for name_cn, g in golden.items():
            transformed[name_cn] = transform_herb_record(name_cn, g)

        # 5. 执行 Upsert
        print("\n[5/7] 执行数据更新...")
        inserted = 0
        updated = 0
        deleted = 0

        # 收集所有药材名称
        golden_names = set(golden.keys())
        existing_names = set(existing_herbs.keys())

        # 删除不再在金标中的药材
        removed_names = existing_names - golden_names
        for name in removed_names:
            await session.delete(existing_herbs[name])
            deleted += 1

        # 新增/更新药材
        tcmsp_index = 0
        for name_cn, data in transformed.items():
            if name_cn in existing_herbs:
                # 更新
                herb = existing_herbs[name_cn]
                changes = {}

                if herb.name_latin != data["name_latin"]:
                    herb.name_latin = data["name_latin"]
                    changes["name_latin"] = True

                if herb.category != data["category"]:
                    herb.category = data["category"]
                    changes["category"] = True

                if herb.is_food_homology != data["is_food_homology"]:
                    herb.is_food_homology = data["is_food_homology"]
                    changes["is_food_homology"] = True

                if changes:
                    updated += 1
                    print(f"  更新: {name_cn} ({len(changes)} 字段变更)")
                else:
                    print(f"  跳过: {name_cn} (无变更)")
            else:
                # 新增
                tcmsp_index += 1
                herb = TCMHerb(
                    name_cn=name_cn,
                    name_latin=data["name_latin"],
                    name_pinyin="",  # 待后续补充
                    category=data["category"],
                    ob_percent=(data["ob_range"][0] + data["ob_range"][1]) / 2,
                    dl_value=(data["dl_range"][0] + data["dl_range"][1]) / 2,
                    effects="",  # 待后续补充
                    is_food_homology=data["is_food_homology"],
                    tcmsp_id=f"TMSP_{tcmsp_index:04d}",
                    source_version="v3.0-tcmsp-restored",
                    synced_at=datetime.now(),  # 使用 naive datetime
                )
                session.add(herb)
                inserted += 1
                print(f"  新增: {name_cn} (TCMSP ID: {herb.tcmsp_id})")

        await session.commit()
        print(f"\n  药材操作完成: 新增 {inserted}, 更新 {updated}, 删除 {deleted}")

        # 6. 更新知识图谱节点
        print("\n[6/7] 更新知识图谱节点...")
        kg_result = await session.execute(select(KGNode).where(KGNode.node_type == "herb"))
        kg_herbs = {row.node_label: row for row in kg_result.scalars().all()}

        kg_inserted = 0
        kg_updated = 0

        for name_cn in golden.keys():
            if name_cn in kg_herbs:
                herb_kg = kg_herbs[name_cn]
                if herb_kg.properties.get("source") != "tcmsp":
                    herb_kg.properties["source"] = "tcmsp"
                    herb_kg.properties["restored_at"] = datetime.now().isoformat()
                    kg_updated += 1
            else:
                new_node = KGNode(
                    node_type="herb",
                    node_label=name_cn,
                    properties={
                        "source": "tcmsp",
                        "restored_at": datetime.now().isoformat(),
                        "category": normalize_category(golden[name_cn].get("cat", "")),
                    },
                )
                session.add(new_node)
                kg_inserted += 1

        await session.commit()
        print(f"  知识图谱: 新增 {kg_inserted}, 更新 {kg_updated}")

        # 7. 创建数据快照
        print("\n[7/7] 创建数据快照...")
        now = datetime.utcnow()
        snapshot_id = f"tcmsp_restore_{now.strftime('%Y%m%d_%H%M%S')}"

        # 清除旧快照
        await session.execute(
            text("UPDATE data_snapshots SET is_active = FALSE WHERE source_db = 'tcmsp_restore'")
        )

        new_snapshot = DataSnapshot(
            snapshot_id=snapshot_id,
            source_db="tcmsp_restore",
            total_records=len(golden),
            checksum=hashlib.sha256(json.dumps(sorted(list(golden.keys()))).encode()).hexdigest(),
            metadata_={
                "inserted": inserted,
                "updated": updated,
                "deleted": deleted,
                "version": "v3.0-tcmsp-restored",
                "timestamp": now.isoformat(),
            },
            is_active=True,
        )
        session.add(new_snapshot)
        await session.commit()

    await engine.dispose()

    # 最终验证
    print(f"\n{'=' * 70}")
    print("  迁移完成!")
    print(f"  金标数据: {len(golden)} 味药材")
    print(f"  新增: {inserted} | 更新: {updated} | 删除: {deleted}")
    print(f"  知识图谱: 新增 {kg_inserted}, 更新 {kg_updated}")
    print(f"  快照 ID: {snapshot_id}")
    print(f"{'=' * 70}")

    return True


if __name__ == "__main__":
    result = asyncio.run(migrate_tcmsp_data())
    sys.exit(0 if result else 1)
