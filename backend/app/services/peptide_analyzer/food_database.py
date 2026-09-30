"""
食品肽数据库服务 - 支持在线API查询
集成 DFBP、BioPeptideDB 等食品肽数据库
"""

import logging
import asyncio
import aiohttp
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class DatabasePeptide:
    """数据库中的肽记录"""
    sequence: str
    source_protein: Optional[str] = None
    source_organism: Optional[str] = None
    activity_type: Optional[str] = None
    activity_value: Optional[float] = None
    activity_unit: Optional[str] = None
    molecular_weight: Optional[float] = None
    hydrolysis_enzyme: Optional[str] = None
    database_id: Optional[str] = None
    literature_doi: Optional[str] = None
    source_database: str = "DFBP"
    food_source: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> dict:
        return {
            "sequence": self.sequence,
            "source_protein": self.source_protein,
            "source_organism": self.source_organism,
            "activity_type": self.activity_type,
            "activity_value": self.activity_value,
            "activity_unit": self.activity_unit,
            "molecular_weight": self.molecular_weight,
            "hydrolysis_enzyme": self.hydrolysis_enzyme,
            "database_id": self.database_id,
            "literature_doi": self.literature_doi,
            "source_database": self.source_database,
            "food_source": self.food_source,
            "created_at": self.created_at.isoformat(),
        }


# ═══════════════════════════════════════════════════════════
# DFBP 数据库适配器
# ═══════════════════════════════════════════════════════════

class DFBPDatabase:
    """
    DFBP (Database of Food-derived Bioactive Peptides) 适配器
    
    提供在线API查询和本地数据缓存
    """
    
    def __init__(self):
        self.base_url = "https://db.baderlab.org/DFBP/api"
        self._local_cache: Dict[str, List[DatabasePeptide]] = {}
        self._build_local_index()
        logger.info("DFBP 数据库适配器初始化")
    
    def _build_local_index(self):
        """从 DFBP 主数据源构建本地索引（避免重复定义）"""
        try:
            from app.services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE
            for peptide_data in DFBP_PEPTIDE_DATABASE:
                seq = peptide_data.get('sequence', '').upper().replace('-', '')
                if seq not in self._local_cache:
                    self._local_cache[seq] = []
                # 将主数据源字段映射到 DatabasePeptide
                food_source_map = {
                    'Bos taurus': '牛奶', 'Gallus gallus': '鸡蛋', 'Zea mays': '玉米',
                    'Sus scrofa': '动物血', 'Glycine max': '大豆', 'Oryza sativa': '水稻',
                    'Triticum aestivum': '小麦',
                }
                organism = peptide_data.get('source_organism', '')
                self._local_cache[seq].append(DatabasePeptide(
                    sequence=peptide_data.get('sequence', ''),
                    source_protein=peptide_data.get('source_protein'),
                    source_organism=peptide_data.get('source_organism'),
                    activity_type=peptide_data.get('activity_type'),
                    activity_value=peptide_data.get('activity_value'),
                    activity_unit=peptide_data.get('activity_unit'),
                    molecular_weight=peptide_data.get('molecular_weight'),
                    hydrolysis_enzyme=peptide_data.get('hydrolysis_enzyme'),
                    database_id=peptide_data.get('dfbp_id'),
                    food_source=food_source_map.get(organism, organism),
                    source_database='DFBP',
                ))
            logger.info(f"DFBP 数据库适配器初始化完成，加载 {len(self._local_cache)} 条肽记录")
        except ImportError:
            logger.warning("无法导入 DFBP_PEPTIDE_DATABASE，使用空索引")
    
    async def search_by_sequence(
        self,
        sequence: str,
        activity_type: Optional[str] = None,
        use_online: bool = True
    ) -> List[DatabasePeptide]:
        """搜索序列"""
        results = []
        seq_upper = sequence.upper()
        
        # 先查本地缓存
        if seq_upper in self._local_cache:
            results.extend(self._local_cache[seq_upper])
        
        # 模糊匹配
        if not results:
            results = self._fuzzy_match(seq_upper)
        
        # 尝试在线查询
        if use_online and not results:
            online_results = await self._search_online(seq_upper)
            results.extend(online_results)
        
        # 活性类型过滤
        if activity_type:
            results = [r for r in results if r.activity_type and 
                      activity_type.lower() in r.activity_type.lower()]
        
        return results
    
    async def _search_online(self, sequence: str) -> List[DatabasePeptide]:
        """在线搜索DFBP API"""
        results = []
        try:
            async with aiohttp.ClientSession() as session:
                # DFBP API端点
                url = f"{self.base_url}/peptides/search"
                params = {"sequence": sequence}
                
                async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        for item in data.get('results', []):
                            results.append(DatabasePeptide(
                                sequence=item.get('sequence', ''),
                                source_protein=item.get('source_protein'),
                                activity_type=item.get('activity_type'),
                                activity_value=item.get('activity_value'),
                                activity_unit=item.get('activity_unit'),
                                molecular_weight=item.get('molecular_weight'),
                                food_source=item.get('food_source'),
                                source_database='DFBP',
                            ))
                    else:
                        logger.warning(f"DFBP API返回错误状态: {resp.status}")
        except Exception as e:
            logger.warning(f"DFBP在线查询失败: {e}")
        
        return results
    
    def _fuzzy_match(self, sequence: str) -> List[DatabasePeptide]:
        """模糊匹配"""
        results = []
        for seq, peptides in self._local_cache.items():
            if sequence in seq or seq in sequence:
                results.extend(peptides)
        return results
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        activities = {}
        food_sources = {}

        for peptides in self._local_cache.values():
            for p in peptides:
                if p.activity_type:
                    activities[p.activity_type] = activities.get(p.activity_type, 0) + 1
                if p.food_source:
                    food_sources[p.food_source] = food_sources.get(p.food_source, 0) + 1
        
        return {
            "total_peptides": len(self._local_cache),
            "activities": activities,
            "food_sources": food_sources,
            "databases": ["DFBP"],
        }

    def get_all_peptides(self) -> List[DatabasePeptide]:
        """返回所有缓存的肽记录"""
        all_peptides = []
        for peptides in self._local_cache.values():
            all_peptides.extend(peptides)
        return all_peptides


# ═══════════════════════════════════════════════════════════
# BioPeptideDB 适配器
# ═══════════════════════════════════════════════════════════

class BioPeptideDB:
    """
    BioPeptideDB 适配器
    
    提供生物活性肽数据库的查询接口
    """
    
    def __init__(self):
        self.base_url = "https://bps-db.cs.duke.edu/api"
        self._local_cache: Dict[str, List[DatabasePeptide]] = {}
        logger.info("BioPeptideDB 适配器初始化")
    
    async def search_by_sequence(
        self,
        sequence: str,
        use_online: bool = True
    ) -> List[DatabasePeptide]:
        """搜索序列"""
        results = []
        
        # 尝试在线查询
        if use_online:
            online_results = await self._search_online(sequence)
            results.extend(online_results)
        
        return results
    
    async def _search_online(self, sequence: str) -> List[DatabasePeptide]:
        """在线搜索BioPeptideDB API"""
        results = []
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.base_url}/peptides"
                params = {"sequence": sequence}
                
                async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        for item in data.get('peptides', []):
                            results.append(DatabasePeptide(
                                sequence=item.get('sequence', ''),
                                source_protein=item.get('source_protein'),
                                activity_type=item.get('activity_type'),
                                activity_value=item.get('activity_value'),
                                source_database='BioPeptideDB',
                            ))
                    else:
                        logger.warning(f"BioPeptideDB API返回错误状态: {resp.status}")
        except Exception as e:
            logger.warning(f"BioPeptideDB在线查询失败: {e}")
        
        return results


# ═══════════════════════════════════════════════════════════
# 统一数据库管理器
# ═══════════════════════════════════════════════════════════

class FoodPeptideDatabaseManager:
    """食品肽数据库管理器"""
    
    def __init__(self):
        self.dfbp = DFBPDatabase()
        self.bio_peptide_db = BioPeptideDB()
        logger.info("食品肽数据库管理器初始化")
    
    async def search(
        self,
        sequence: Optional[str] = None,
        activity_type: Optional[str] = None,
        min_value: Optional[float] = None,
        max_value: Optional[float] = None,
        food_source: Optional[str] = None,
        database: Optional[str] = None,
        use_online: bool = True
    ) -> List[DatabasePeptide]:
        """统一搜索接口"""
        results = []

        # 有序列时走精确/模糊搜索
        if sequence:
            # DFBP搜索
            if database is None or database == 'DFBP':
                dfbp_results = await self.dfbp.search_by_sequence(
                    sequence, activity_type=activity_type, use_online=use_online
                )
                results.extend(dfbp_results)

            # BioPeptideDB搜索
            if database is None or database == 'BioPeptideDB':
                bp_results = await self.bio_peptide_db.search_by_sequence(
                    sequence, use_online=use_online
                )
                results.extend(bp_results)
        else:
            # 无序列时，返回全量数据并过滤
            all_peptides = self.dfbp.get_all_peptides()
            for p in all_peptides:
                if activity_type and p.activity_type:
                    if activity_type.lower() not in p.activity_type.lower():
                        continue
                if min_value is not None and p.activity_value is not None:
                    if p.activity_value < min_value:
                        continue
                if max_value is not None and p.activity_value is not None:
                    if p.activity_value > max_value:
                        continue
                if food_source and p.food_source:
                    if food_source.lower() not in p.food_source.lower():
                        continue
                results.append(p)
        
        return results
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        return self.dfbp.get_statistics()


# 向后兼容别名
FoodPeptideDatabase = FoodPeptideDatabaseManager


# 全局单例
_database_manager: Optional[FoodPeptideDatabaseManager] = None


def get_food_peptide_database() -> FoodPeptideDatabaseManager:
    """获取食品肽数据库管理器单例"""
    global _database_manager
    if _database_manager is None:
        _database_manager = FoodPeptideDatabaseManager()
    return _database_manager
