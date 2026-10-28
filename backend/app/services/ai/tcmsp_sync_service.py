"""
TCMSP 药材数据库同步服务

支持从 TCMSP 官网批量导入药材数据，扩充优化器搜索空间。

功能：
- 从 TCMSP API 获取药材列表
- 解析化合物、靶点、疾病关联
- 更新数据库中的药材记录
- 增量同步避免重复导入
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class TCMSPHerbData:
    """TCMSP 药材数据结构"""
    tcmsp_id: str
    name_cn: str
    name_pinyin: Optional[str]
    category: Optional[str]
    compounds: List[Dict]
    targets: List[Dict]
    diseases: List[Dict]
    ob_percent: Optional[float]
    dl_value: Optional[float]
    effects: Optional[str]
    is_food_homology: bool = False


class TCMSPSyncService:
    """TCMSP 数据库同步服务"""

    # TCMSP API 端点
    TCMSP_BASE_URL = "https://tcmsp-e.com"
    HERB_LIST_API = f"{TCMSP_BASE_URL}/api/json/herb/herbspage"
    HERB_DETAIL_API = f"{TCMSP_BASE_URL}/api/json/herb/detail"

    # 同步配置
    BATCH_SIZE = 20
    MAX_HERBS = 200
    REQUEST_TIMEOUT = 30

    def __init__(self, session_factory):
        self._session_factory = session_factory

    async def sync_herbs(self, force_full_sync: bool = False) -> Dict:
        """
        同步 TCMSP 药材数据

        Args:
            force_full_sync: 是否强制全量同步

        Returns:
            同步统计信息
        """
        from ..models.external_data import TCMHerb

        async with self._session_factory() as session:
            # 获取现有药材ID
            if not force_full_sync:
                result = await session.execute(select(TCMHerb.tcmsp_id))
                existing_ids = {row[0] for row in result.all() if row[0]}
                logger.info(f"现有 TCMSP 药材记录: {len(existing_ids)} 条")
            else:
                existing_ids = set()

            # 获取药材列表
            herb_list = await self._fetch_herb_list()
            logger.info(f"TCMSP 药材列表共 {len(herb_list)} 条")

            # 过滤新药材
            new_herbs = [h for h in herb_list if h.tcmsp_id not in existing_ids]
            logger.info(f"新增药材: {len(new_herbs)} 条")

            stats = {
                "total_in_db": len(existing_ids),
                "new_herbs": len(new_herbs),
                "updated_herbs": 0,
                "failed_herbs": 0,
            }

            # 批量同步
            for i, herb_data in enumerate(new_herbs[:self.MAX_HERBS]):
                try:
                    await self._sync_herb_detail(session, herb_data)
                    stats["updated_herbs"] += 1

                    # 进度日志
                    if (i + 1) % 10 == 0:
                        logger.info(f"同步进度: {i + 1}/{len(new_herbs)}")

                    # 限速
                    await asyncio.sleep(0.5)

                except Exception as e:
                    logger.error(f"同步药材失败 {herb_data.name_cn}: {e}")
                    stats["failed_herbs"] += 1

            await session.commit()
            stats["final_count"] = len(existing_ids) + stats["updated_herbs"]

        return stats

    async def _fetch_herb_list(self) -> List[TCMSPHerbData]:
        """获取药材列表"""
        async with httpx.AsyncClient(timeout=self.REQUEST_TIMEOUT) as client:
            all_herbs = []

            for page in range(1, 11):  # 最多10页
                try:
                    resp = await client.get(
                        self.HERB_LIST_API,
                        params={"page": page, "herbspagelimit": self.BATCH_SIZE},
                    )
                    resp.raise_for_status()
                    data = resp.json()

                    if not data or "data" not in data:
                        break

                    for item in data["data"]:
                        herb = TCMSPHerbData(
                            tcmsp_id=item.get("id", ""),
                            name_cn=item.get("name", ""),
                            name_pinyin=item.get("pin_yin"),
                            category=item.get("category"),
                            compounds=[],
                            targets=[],
                            diseases=[],
                            ob_percent=None,
                            dl_value=None,
                            effects=None,
                        )
                        all_herbs.append(herb)

                    if len(data["data"]) < self.BATCH_SIZE:
                        break

                except Exception as e:
                    logger.error(f"获取药材列表第{page}页失败: {e}")
                    break

            return all_herbs

    async def _sync_herb_detail(
        self,
        session: AsyncSession,
        herb_data: TCMSPHerbData,
    ) -> None:
        """同步单个药材详情"""
        from ..models.external_data import TCMHerb

        async with httpx.AsyncClient(timeout=self.REQUEST_TIMEOUT) as client:
            try:
                resp = await client.get(
                    self.HERB_DETAIL_API,
                    params={"sp_id": herb_data.tcmsp_id},
                )
                resp.raise_for_status()
                data = resp.json()

                if not data or "data" not in data:
                    logger.warning(f"药材详情为空: {herb_data.name_cn}")
                    return

                detail = data["data"]

                # 解析化合物
                compounds = []
                if "mu" in detail and isinstance(detail["mu"], list):
                    for comp in detail["mu"]:
                        compounds.append({
                            "name": comp.get("compound_name", ""),
                            "mw": comp.get("molecular_weight"),
                            "ob": comp.get("ob"),
                            "dl": comp.get("dl"),
                        })

                # 解析靶点
                targets = []
                if "target" in detail and isinstance(detail["target"], list):
                    for t in detail["target"]:
                        targets.append({
                            "name": t.get("target_name", ""),
                            "species": t.get("species", ""),
                            "action": t.get("action", ""),
                        })

                # 解析疾病
                diseases = []
                if "disease" in detail and isinstance(detail["disease"], list):
                    for d in detail["disease"]:
                        diseases.append({
                            "name": d.get("disease_name", ""),
                            "evidence": d.get("evidence", ""),
                        })

                # 判断是否药食同源
                is_food_homology = self._check_food_homology(herb_data.name_cn)

                # 更新或插入
                stmt = select(TCMHerb).where(TCMHerb.tcmsp_id == herb_data.tcmsp_id)
                result = await session.execute(stmt)
                existing = result.scalar_one_or_none()

                herb_record = TCMHerb(
                    name_cn=herb_data.name_cn,
                    name_pinyin=herb_data.name_pinyin,
                    category=herb_data.category,
                    compounds=compounds,
                    targets=targets,
                    diseases=diseases,
                    ob_percent=detail.get("ob"),
                    dl_value=detail.get("dl"),
                    effects=detail.get("effects"),
                    is_food_homology=is_food_homology,
                    tcmsp_id=herb_data.tcmsp_id,
                    source="tcsp",
                    synced_at=datetime.now(timezone.utc),
                )

                if existing:
                    # 更新现有记录
                    for key, value in herb_record.__dict__.items():
                        if not key.startswith("_"):
                            setattr(existing, key, value)
                else:
                    # 插入新记录
                    session.add(herb_record)

            except Exception as e:
                logger.error(f"同步药材详情失败 {herb_data.name_cn}: {e}")
                raise

    def _check_food_homology(self, name_cn: str) -> bool:
        """检查是否为药食同源药材"""
        # 国家卫健委公布的药食同源目录（简化版）
        food_homology_list = {
            "黄芪", "党参", "枸杞子", "山药", "红枣", "甘草",
            "茯苓", "白术", "陈皮", "山楂", "菊花", "决明子",
            "罗汉果", "桑叶", "薄荷", "金银花", "桂圆", "莲子",
            "薏苡仁", "赤小豆", "百合", "麦芽", "山楂", "八角",
            "乌梅", "益智仁", "胖大海", "蒲黄", "莱菔子",
        }
        return name_cn in food_homology_list

    async def get_herb_by_tcmsp_id(self, tcmsp_id: str) -> Optional[Dict]:
        """根据 TCMSP ID 查询药材"""
        from ..models.external_data import TCMHerb

        async with self._session_factory() as session:
            stmt = select(TCMHerb).where(TCMHerb.tcmsp_id == tcmsp_id)
            result = await session.execute(stmt)
            herb = result.scalar_one_or_none()

            if herb:
                return {
                    "tcmsp_id": herb.tcmsp_id,
                    "name_cn": herb.name_cn,
                    "name_pinyin": herb.name_pinyin,
                    "category": herb.category,
                    "compounds": herb.compounds or [],
                    "targets": herb.targets or [],
                    "diseases": herb.diseases or [],
                    "ob_percent": herb.ob_percent,
                    "dl_value": herb.dl_value,
                    "effects": herb.effects,
                    "is_food_homology": herb.is_food_homology,
                }
            return None

    async def search_herbs(self, keyword: str, limit: int = 20) -> List[Dict]:
        """搜索药材"""
        from ..models.external_data import TCMHerb

        async with self._session_factory() as session:
            stmt = select(TCMHerb).where(
                TCMHerb.name_cn.contains(keyword) |
                TCMHerb.name_pinyin.contains(keyword)
            ).limit(limit)
            result = await session.execute(stmt)
            herbs = result.scalars().all()

            return [
                {
                    "tcmsp_id": h.tcmsp_id,
                    "name_cn": h.name_cn,
                    "name_pinyin": h.name_pinyin,
                    "category": h.category,
                    "is_food_homology": h.is_food_homology,
                }
                for h in herbs
            ]


# 全局单例
_tcmsp_sync_service = None


def get_tcmsp_sync_service():
    """获取 TCMSP 同步服务单例"""
    global _tcmsp_sync_service
    return _tcmsp_sync_service


def set_tcmsp_sync_service(service: TCMSPSyncService):
    """设置 TCMSP 同步服务"""
    global _tcmsp_sync_service
    _tcmsp_sync_service = service
