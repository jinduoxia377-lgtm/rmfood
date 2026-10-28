"""
数据库初始化脚本
建表 + 初始化管理员账号 + 种子数据（TCMSP/DFBP）
"""
import logging

from sqlalchemy import select

from app.models import User, UserRole

from ..config import settings
from ..database.session import async_session_factory

logger = logging.getLogger(__name__)


async def _seed_tcmsp_herbs(session) -> int:
    """将内存中的TCMSP药材数据导入PostgreSQL，返回导入条数"""
    from app.models.external_data import TCMHerb
    from app.services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE

    # 检查是否已有数据
    result = await session.execute(select(TCMHerb).limit(1))
    if result.scalar_one_or_none() is not None:
        logger.info("tcm_herbs 表已有数据，跳过种子初始化")
        return 0

    count = 0
    for herb_data in TCMSP_HERB_DATABASE:
        herb = TCMHerb(
            name_cn=herb_data.get("name_cn", ""),
            name_latin=herb_data.get("name_latin"),
            name_pinyin=herb_data.get("name_pinyin"),
            category=herb_data.get("category"),
            compounds=herb_data.get("compounds", []),
            targets=herb_data.get("targets", []),
            diseases=herb_data.get("diseases", []),
            ob_percent=herb_data.get("ob_percent"),
            dl_value=herb_data.get("dl_value"),
            effects=herb_data.get("effects"),
            is_food_homology=herb_data.get("is_food_homology", False),
            tcmsp_id=herb_data.get("tcmsp_id"),
            source_version="v2.0-tcmsp",
        )
        session.add(herb)
        count += 1

    await session.commit()
    logger.info(f"✅ 已导入 {count} 条 TCMSP 药材到 tcm_herbs 表")
    return count


async def _seed_mmid_herbs(session) -> int:
    """将 MMID 药材数据导入 mmid_herbs 表（仅用于全新数据库初始化）

    MMID 数据来源于 HKBU 药用植物图像数据库，包含四气五味等传统中药属性。
    注意：已有数据库会通过 alembic 迁移自动从 tcm_herbs 转移数据，
    此函数仅用于首次初始化（此时 tcm_herbs 中可能已有 MMID 数据）。
    """
    from app.models.external_data import MMIDHerb

    # 检查是否已有数据
    result = await session.execute(select(MMIDHerb).limit(1))
    if result.scalar_one_or_none() is not None:
        logger.info("mmid_herbs 表已有数据，跳过种子初始化")
        return 0

    # 使用原始 SQL 查询 tcm_herbs 中 pid IS NOT NULL 的记录
    # 避免 ORM 模型引用已迁移走的列
    # 注意：pid 列在 alembic 迁移 20260702 中已被从 tcm_herbs 移除，
    #       若表结构已是最新则直接跳过迁移（mmid_herbs 应为空时再执行）
    from sqlalchemy import text
    try:
        pid_check = await session.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'tcm_herbs' AND column_name = 'pid'"
        ))
        has_pid = pid_check.scalar_one_or_none() is not None
    except Exception:
        has_pid = False

    if not has_pid:
        logger.info("tcm_herbs 表中无 pid 列（已迁移），跳过 MMID 种子导入")
        return 0

    mmid_rows = await session.execute(text("""
        SELECT id, pid, name_cn, name_latin, name_pinyin, name_eng,
               botanical_type, category, nature, flavor, toxicity,
               efficacy_raw, origin, processing, botanical_source,
               characteristics, quality, notes, meridians,
               nature_flavor_raw, source_version, synced_at, created_at
        FROM tcm_herbs WHERE pid IS NOT NULL
    """))

    count = 0
    for row in mmid_rows:
        mmid_herb = MMIDHerb(
            id=row.id,
            pid=row.pid or "",
            name_cn=row.name_cn or "",
            name_latin=row.name_latin,
            name_pinyin=row.name_pinyin,
            name_eng=row.name_eng,
            botanical_type=row.botanical_type,
            category=row.category,
            nature=row.nature,
            flavor=row.flavor,
            toxicity=row.toxicity,
            efficacy_raw=row.efficacy_raw,
            origin=row.origin,
            processing=row.processing,
            botanical_source=row.botanical_source,
            characteristics=row.characteristics,
            quality=row.quality,
            notes=row.notes,
            meridians=row.meridians,
            nature_flavor_raw=row.nature_flavor_raw,
            source_version=row.source_version,
            synced_at=row.synced_at,
            created_at=row.created_at,
        )
        session.add(mmid_herb)
        count += 1

    await session.commit()
    if count > 0:
        logger.info(f"✅ 已从 tcm_herbs 迁移 {count} 条 MMID 药材到 mmid_herbs 表")
    else:
        logger.info("无 MMID 种子数据需要导入")
    return count


async def _seed_dfbp_peptides(session) -> int:
    """将内存中的DFBP活性肽数据导入PostgreSQL，返回导入条数"""
    from app.models.external_data import BioactivePeptide
    from app.services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE

    result = await session.execute(select(BioactivePeptide).limit(1))
    if result.scalar_one_or_none() is not None:
        logger.info("bioactive_peptides 表已有数据，跳过种子初始化")
        return 0

    count = 0
    for pep_data in DFBP_PEPTIDE_DATABASE:
        peptide = BioactivePeptide(
            sequence=pep_data.get("sequence", ""),
            source_protein=pep_data.get("source_protein"),
            source_organism=pep_data.get("source_organism"),
            activity_type=pep_data.get("activity_type"),
            activity_value=pep_data.get("activity_value"),
            activity_unit=pep_data.get("activity_unit"),
            molecular_weight=pep_data.get("molecular_weight"),
            hydrolysis_enzyme=pep_data.get("hydrolysis_enzyme"),
            dfbp_id=pep_data.get("dfbp_id"),
            dfbp_version="v1.0-dfbp",
        )
        session.add(peptide)
        count += 1

    await session.commit()
    logger.info(f"✅ 已导入 {count} 条 DFBP 活性肽到 bioactive_peptides 表")
    return count


async def init_db():
    """初始化数据库：建表 + 管理员 + TCMSP/DFBP种子数据"""
    from ..database.session import init_database

    # 建表
    await init_database()
    logger.info("数据库表已创建")

    async with async_session_factory() as session:
        # 创建默认管理员
        result = await session.execute(
            select(User).where(User.username == settings.admin_username)
        )
        admin = result.scalar_one_or_none()

        if admin is None:
            from ...utils.auth import get_password_hash

            admin = User(
                username=settings.admin_username,
                email=settings.admin_email,
                hashed_password=get_password_hash(settings.admin_password),
                full_name="系统管理员",
                role=UserRole.ADMIN,
                is_active=True,
            )
            session.add(admin)
            await session.commit()
            logger.info(f"默认管理员已创建: {settings.admin_username}")
        else:
            logger.info("管理员账号已存在，跳过创建")

        # 导入种子数据（仅在表为空时执行）
        herbs_count = await _seed_tcmsp_herbs(session)
        peptides_count = await _seed_dfbp_peptides(session)
        mmid_count = await _seed_mmid_herbs(session)

        if herbs_count > 0 or peptides_count > 0 or mmid_count > 0:
            logger.info(f"🌱 种子数据初始化完成: {herbs_count} TCMSP 药材 + {peptides_count} 活性肽 + {mmid_count} MMID 药材")
