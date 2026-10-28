"""
CFAM 官方药食同源目录 API

提供国家卫健委官方106种药食同源目录的完整数据：
- GET  /databases/cfam/herbs           — 完整目录列表（含公告批次/特殊提示）
- GET  /databases/cfam/herbs/:name     — 单个药材详情（融合 TCMSP 数据）
- GET  /databases/cfam/stats           — 统计数据（用于 Dashboard）
- POST /databases/cfam/sync            — 从 JSON 文件重新同步
"""
import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.models.external_data import HFEHerb, TCMHerb
from app.models.user_model import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cfam", tags=["药食同源官方目录"])

# CFAM 数据路径
CFAM_DATA_PATH = Path(__file__).parent.parent.parent.parent / "data" / "CFAM" / "cfam_merged.json"


# ═══════════════════════════════════════════
# 路由端点
# ═══════════════════════════════════════════

@router.get("/herbs", summary="CFAM 药食同源完整目录")
async def get_cfam_herbs(
    keyword: str = Query("", description="搜索关键词"),
    announcement_id: str = Query(None, description="公告批次过滤 (ann_2002_51, ann_2019_8, ann_2023_9, ann_2024_4)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    获取 CFAM 官方药食同源目录（106种）
    数据来源：国家卫健委官方公告汇总（截止2026年05月24日）
    """
    # 查询 hf_enriched_herbs（已有数据）
    query = select(HFEHerb).where(HFEHerb.is_food_homology == True)  # noqa: E712
    count_query = select(func.count()).select_from(HFEHerb).where(HFEHerb.is_food_homology == True)  # noqa: E712

    if keyword:
        like_pattern = f"%{keyword}%"
        query = query.where(
            (HFEHerb.name_cn.ilike(like_pattern))
            | (HFEHerb.latin_name.ilike(like_pattern))
        )
        count_query = count_query.where(
            (HFEHerb.name_cn.ilike(like_pattern))
            | (HFEHerb.latin_name.ilike(like_pattern))
        )

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(HFEHerb.name_cn)
             .offset((page - 1) * page_size)
             .limit(page_size)
    )).scalars().all()

    return {
        "items": [
            {
                "id": h.id,
                "name_cn": h.name_cn,
                "name_en": h.name_en,
                "name_latin": h.latin_name,
                "nature_cn": h.nature_cn,
                "flavor_cn": h.flavor_cn,
                "meridians_cn": h.meridians_cn,
                "category": h.category,
                "ob_percent": h.ob_percent,
                "dl_value": h.dl_value,
                "is_food_homology": h.is_food_homology,
                "image_path": h.image_path,
                "compound_count": h.compound_count,
                "target_count": h.target_count,
                "tcmsp_id": h.tcmsp_id,
                "symmap_id": h.symmap_id,
                # 公告信息
                "announcement_source": _get_announcement_source(h.source_version),
                "special_notice": _get_special_notice(h),
                "usage_restriction": _get_usage_restriction(h),
            }
            for h in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "source": "cfam_official",
        "version": "2026.05.24",
    }


@router.get("/herbs/{name}", summary="CFAM 药材详情（融合 TCMSP）")
async def get_cfam_herb_detail(
    name: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取单个药材详情，融合 CFAM 官方数据 + TCMSP 关系链数据"""
    # 查询 CFAM 数据
    cfam_result = await db.execute(
        select(HFEHerb).where(HFEHerb.name_cn == name)
    )
    cfam_herb = cfam_result.scalar_one_or_none()

    if not cfam_herb:
        # 尝试模糊匹配
        cfam_result = await db.execute(
            select(HFEHerb).where(HFEHerb.name_cn.ilike(f"%{name}%")).limit(1)
        )
        cfam_herb = cfam_result.scalar_one_or_none()

    if not cfam_herb:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"药食同源药材未找到: {name}")

    # 查询 TCMSP 补充数据
    tcmsp_result = await db.execute(
        select(TCMHerb).where(
            (TCMHerb.name_cn == name)
            | (TCMHerb.name_latin.ilike(f"%{cfam_herb.latin_name}%"))
        ).limit(1)
    )
    tcmsp_herb = tcmsp_result.scalar_one_or_none()

    # 构建融合数据
    result = {
        # CFAM 官方数据
        "name_cn": cfam_herb.name_cn,
        "name_en": cfam_herb.name_en,
        "name_latin": cfam_herb.latin_name,
        "nature_cn": cfam_herb.nature_cn,
        "flavor_cn": cfam_herb.flavor_cn,
        "meridians_cn": cfam_herb.meridians_cn,
        "category": cfam_herb.category,
        "is_food_homology": cfam_herb.is_food_homology,
        "image_path": cfam_herb.image_path,
        "announcement_source": _get_announcement_source(cfam_herb.source_version),
        "special_notice": _get_special_notice(cfam_herb),
        "usage_restriction": _get_usage_restriction(cfam_herb),
        # TCMSP 补充数据
        "ob_percent": tcmsp_herb.ob_percent if tcmsp_herb else cfam_herb.ob_percent,
        "dl_value": tcmsp_herb.dl_value if tcmsp_herb else cfam_herb.dl_value,
        "effects": tcmsp_herb.effects if tcmsp_herb else None,
        "compounds": tcmsp_herb.compounds if tcmsp_herb else (cfam_herb.compounds or []),
        "targets": tcmsp_herb.targets if tcmsp_herb else (cfam_herb.targets or []),
        "diseases": tcmsp_herb.diseases if tcmsp_herb else (cfam_herb.diseases or []),
        "compound_count": tcmsp_herb.compound_count if tcmsp_herb else cfam_herb.compound_count,
        "target_count": tcmsp_herb.target_count if tcmsp_herb else cfam_herb.target_count,
        "disease_count": tcmsp_herb.disease_count if tcmsp_herb else cfam_herb.disease_count,
        "tcmsp_id": tcmsp_herb.tcmsp_id if tcmsp_herb else cfam_herb.tcmsp_id,
        "approval_date": cfam_herb.approval_date,
        "max_dosage": cfam_herb.max_dosage,
        "restrictions": cfam_herb.restrictions or [],
        "usage_forms": cfam_herb.usage_forms or [],
    }
    return result


@router.get("/stats", summary="CFAM 统计数据")
async def get_cfam_stats(db: AsyncSession = Depends(get_db_session)):
    """获取 CFAM 目录统计数据（用于 Dashboard）"""
    from sqlalchemy import text as sql_text

    # 总体统计
    total = (await db.execute(select(func.count()).select_from(HFEHerb).where(HFEHerb.is_food_homology.is_(True)))).scalar() or 0

    # 按公告批次统计
    announcement_stats = (await db.execute(sql_text("""
        SELECT
            CASE source_version
                WHEN '卫法监发[2002]51号' THEN 'ann_2002_51'
                WHEN '卫健委公告2019年第8号' THEN 'ann_2019_8'
                WHEN '卫健委公告2023年第9号' THEN 'ann_2023_9'
                WHEN '卫健委公告2024年第4号' THEN 'ann_2024_4'
                ELSE 'other'
            END as announcement_id,
            COUNT(*) as cnt
        FROM hf_enriched_herbs
        WHERE is_food_homology = true
        GROUP BY announcement_id
        ORDER BY announcement_id
    """))).all()

    # 四气分布
    nature_stats = (await db.execute(sql_text("""
        SELECT nature_cn, COUNT(*) as cnt
        FROM hf_enriched_herbs
        WHERE is_food_homology = true AND nature_cn IS NOT NULL
        GROUP BY nature_cn
        ORDER BY cnt DESC
        LIMIT 10
    """))).all()

    # 有图片的药材数
    image_count = (await db.execute(
        select(func.count()).select_from(HFEHerb)
        .where((HFEHerb.is_food_homology == True) & (HFEHerb.image_path.isnot(None)))  # noqa: E712
    )).scalar() or 0

    return {
        "total_herbs": total,
        "herbs_with_images": image_count,
        "announcement_distribution": [
            {"announcement_id": r[0], "count": r[1]} for r in announcement_stats
        ],
        "nature_distribution": [
            {"nature": r[0], "count": r[1]} for r in nature_stats
        ],
        "version": "2026.05.24",
        "source": "cfam_official",
    }


@router.post("/sync", summary="同步 CFAM 数据")
async def sync_cfam_data(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """从 cfam_merged.json 文件同步数据到数据库"""
    if not CFAM_DATA_PATH.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"CFAM 数据文件不存在: {CFAM_DATA_PATH}")

    with open(CFAM_DATA_PATH, "r", encoding="utf-8") as f:
        cfam_data = json.load(f)

    # 清除旧数据并重新插入
    await db.execute(text("TRUNCATE TABLE hf_enriched_herbs"))

    inserted = 0
    for herb in cfam_data.get("all_herbs", []):
        name_cn = herb["name"]
        source = herb.get("announcement_source", "")
        nature_flavor = _get_nature_flavor(name_cn)

        await db.execute(text("""
            INSERT INTO hf_enriched_herbs
            (name_cn, latin_name, nature_cn, flavor_cn, source_version, is_food_homology, data_quality_score, synced_at)
            VALUES (:name_cn, :latin_name, :nature_cn, :flavor_cn, :source_version, true, 1.0, NOW())
            ON CONFLICT (name_cn) DO UPDATE SET
                nature_cn = EXCLUDED.nature_cn,
                flavor_cn = EXCLUDED.flavor_cn,
                source_version = EXCLUDED.source_version,
                updated_at = NOW()
        """), {
            "name_cn": name_cn,
            "latin_name": _get_latin_name(name_cn),
            "nature_cn": nature_flavor.get("nature", ""),
            "flavor_cn": nature_flavor.get("flavor", ""),
            "source_version": source,
        })
        inserted += 1

    await db.commit()
    return {"status": "success", "inserted": inserted, "total": len(cfam_data.get("all_herbs", []))}


# ═══════════════════════════════════════════
# 辅助函数
# ═══════════════════════════════════════════

def _get_announcement_source(source_version: Optional[str]) -> Optional[str]:
    """根据 source_version 返回公告来源"""
    mapping = {
        "卫法监发[2002]51号": "ann_2002_51",
        "卫健委公告2019年第8号": "ann_2019_8",
        "卫健委公告2023年第9号": "ann_2023_9",
        "卫健委公告2024年第4号": "ann_2024_4",
    }
    return mapping.get(source_version)


def _get_special_notice(herb: HFEHerb) -> Optional[str]:
    """根据 source_version 返回特殊提示"""
    source = herb.source_version or ""
    if "2023年第9号" in source or "2024年第4号" in source:
        return "建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用"
    return None


def _get_usage_restriction(herb: HFEHerb) -> Optional[str]:
    """根据 source_version 返回使用限制"""
    source = herb.source_version or ""
    if "2019年第8号" in source:
        return "仅作为香辛料和调味品使用"
    return None


# ═══════════════════════════════════════════
# 静态映射数据（内嵌，避免频繁查询）
# ═══════════════════════════════════════════

_NATURE_FLAVOR_DB = {
    "丁香": {"nature": "温", "flavor": "辛"},
    "八角茴香": {"nature": "温", "flavor": "辛"},
    "山药": {"nature": "平", "flavor": "甘"},
    "山楂": {"nature": "微温", "flavor": "酸、甘"},
    "乌梅": {"nature": "平", "flavor": "酸、涩"},
    "甘草": {"nature": "平", "flavor": "甘"},
    "枸杞子": {"nature": "平", "flavor": "甘"},
    "金银花": {"nature": "寒", "flavor": "甘"},
    "菊花": {"nature": "微寒", "flavor": "甘、苦"},
    "薄荷": {"nature": "凉", "flavor": "辛"},
    "黄芪": {"nature": "微温", "flavor": "甘"},
    "当归": {"nature": "温", "flavor": "辛、甘"},
    "党参": {"nature": "平", "flavor": "甘"},
    "灵芝": {"nature": "平", "flavor": "甘"},
    "茯苓": {"nature": "平", "flavor": "甘、淡"},
    "桑叶": {"nature": "寒", "flavor": "甘、苦"},
    "桑椹": {"nature": "寒", "flavor": "甘、酸"},
    "黑芝麻": {"nature": "平", "flavor": "甘"},
    "蜂蜜": {"nature": "平", "flavor": "甘"},
    "生姜": {"nature": "温", "flavor": "辛"},
    "干姜": {"nature": "热", "flavor": "辛"},
    "肉桂": {"nature": "热", "flavor": "辛、甘"},
    "砂仁": {"nature": "温", "flavor": "辛"},
    "薏苡仁": {"nature": "凉", "flavor": "甘、淡"},
    "莲子": {"nature": "平", "flavor": "甘、涩"},
    "百合": {"nature": "微寒", "flavor": "甘"},
    "麦冬": {"nature": "微寒", "flavor": "甘、微苦"},
    "天冬": {"nature": "寒", "flavor": "甘、苦"},
    "黄精": {"nature": "平", "flavor": "甘"},
    "玉竹": {"nature": "微寒", "flavor": "甘"},
    "天麻": {"nature": "平", "flavor": "甘"},
    "杜仲叶": {"nature": "温", "flavor": "甘"},
    "山茱萸": {"nature": "微温", "flavor": "酸、涩"},
    "酸枣仁": {"nature": "平", "flavor": "甘、酸"},
    "胖大海": {"nature": "凉", "flavor": "甘"},
    "葛根": {"nature": "凉", "flavor": "甘、辛"},
    "荷叶": {"nature": "平", "flavor": "苦"},
    "蒲公英": {"nature": "寒", "flavor": "苦"},
    "鱼腥草": {"nature": "微寒", "flavor": "辛"},
    "罗汉果": {"nature": "凉", "flavor": "甘"},
    "龙眼肉": {"nature": "温", "flavor": "甘"},
    "大枣": {"nature": "温", "flavor": "甘"},
    "藿香": {"nature": "微温", "flavor": "辛"},
}

_LATIN_NAME_MAP = {
    "丁香": "Caryophylli Flos",
    "八角茴香": "Anisi Stellati Fructus",
    "山药": "Dioscoreae Rhizoma",
    "山楂": "Crataegi Fructus",
    "乌梅": "Mume Fructus",
    "甘草": "Glycyrrhizae Radix",
    "枸杞子": "Lycii Fructus",
    "金银花": "Lonicerae Japonicae Flos",
    "菊花": "Chrysanthemi Flos",
    "薄荷": "Menthae Haplocalyx",
    "黄芪": "Astragali Radix",
    "当归": "Angelicae Sinensis Radix",
    "党参": "Codonopsis Radix",
    "灵芝": "Ganoderma Lucidum",
    "茯苓": "Poria",
    "桑叶": "Mori Folium",
    "桑椹": "Mori Fructus",
    "黑芝麻": "Sesami Nigris Semen",
    "蜂蜜": "Mel",
    "生姜": "Zingiberis Rhizoma Recens",
    "干姜": "Zingiberis Rhizoma",
    "肉桂": "Cinnami Cortex",
    "砂仁": "Amomi Fructus",
    "薏苡仁": "Coicis Semen",
    "莲子": "Nelumbinis Semen",
    "百合": "Lilii Bulbus",
    "麦冬": "Ophiopogonis Radix",
    "天冬": "Asparagi Radix",
    "黄精": "Polygonati Rhizoma",
    "玉竹": "Polygonati Odorati Rhizoma",
    "天麻": "Gastrodiae Rhizoma",
    "杜仲叶": "Eucommiae Folium",
    "山茱萸": "Corni Fructus",
    "酸枣仁": "Ziziphi Spinosae Semen",
    "胖大海": "Sterculiae Lychnophorae Semen",
    "葛根": "Puerariae Lobatae Radix",
    "荷叶": "Nelumbinis Folium",
    "蒲公英": "Taraxaci Herba",
    "鱼腥草": "Houttuyniae Herba",
    "罗汉果": "Luo Guo",
    "龙眼肉": "Longan Arillus",
    "大枣": "Jujubae Fructus",
    "藿香": "Pogostemonis Herba",
}


def _get_nature_flavor(name: str) -> dict:
    return _NATURE_FLAVOR_DB.get(name, {})


def _get_latin_name(name: str) -> str:
    return _LATIN_NAME_MAP.get(name, "")
