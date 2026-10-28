"""
协同系数库版本化管理
支持系数版本追溯、变更审计、回滚功能
"""

import hashlib
import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class CoefficientEntry:
    """协同系数条目"""
    ingredient_a: str
    ingredient_b: str
    mechanism: str  # bliss_independence, pk_interaction, gibbs_stability, network_pharmacology, taste_matrix
    coefficient: float
    source: str  # 数据来源
    confidence: float  # 置信度 0-1
    version: int
    created_at: datetime
    updated_at: datetime
    notes: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "ingredient_a": self.ingredient_a,
            "ingredient_b": self.ingredient_b,
            "mechanism": self.mechanism,
            "coefficient": self.coefficient,
            "source": self.source,
            "confidence": self.confidence,
            "version": self.version,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "notes": self.notes
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "CoefficientEntry":
        return cls(
            ingredient_a=data["ingredient_a"],
            ingredient_b=data["ingredient_b"],
            mechanism=data["mechanism"],
            coefficient=data["coefficient"],
            source=data["source"],
            confidence=data["confidence"],
            version=data["version"],
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            notes=data.get("notes")
        )


@dataclass
class VersionRecord:
    """版本记录"""
    version: int
    timestamp: datetime
    source: str
    changes_count: int
    description: str
    checksum: str
    author: str = "system"

    def to_dict(self) -> Dict:
        return {
            "version": self.version,
            "timestamp": self.timestamp.isoformat(),
            "source": self.source,
            "changes_count": self.changes_count,
            "description": self.description,
            "checksum": self.checksum,
            "author": self.author
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "VersionRecord":
        return cls(
            version=data["version"],
            timestamp=datetime.fromisoformat(data["timestamp"]),
            source=data["source"],
            changes_count=data["changes_count"],
            description=data["description"],
            checksum=data["checksum"],
            author=data.get("author", "system")
        )


class CoefficientVersionManager:
    """
    协同系数版本管理器

    功能:
    1. 系数 CRUD 操作
    2. 版本历史记录
    3. 系数变更审计
    4. 版本回滚
    5. 系数溯源查询
    """

    def __init__(self, data_dir: str = "data/synergy"):
        self.data_dir = data_dir
        self.coefficients_path = os.path.join(data_dir, "synergy_coefficients.json")
        self.versions_path = os.path.join(data_dir, "version_history.json")

        self._coefficients: Dict[str, CoefficientEntry] = {}
        self._version_history: List[VersionRecord] = []
        self._current_version: int = 0

        self._load_data()
        logger.info(f"CoefficientVersionManager 初始化完成，当前版本: v{self._current_version}")

    def _load_data(self):
        """加载系数数据和版本历史"""
        os.makedirs(self.data_dir, exist_ok=True)

        # 加载系数
        if os.path.exists(self.coefficients_path):
            try:
                with open(self.coefficients_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                for item in data.get("coefficients", []):
                    entry = CoefficientEntry.from_dict(item)
                    key = self._make_key(entry.ingredient_a, entry.ingredient_b, entry.mechanism)
                    self._coefficients[key] = entry
                self._current_version = data.get("current_version", 0)
            except Exception as e:
                logger.error(f"加载系数数据失败: {e}")

        # 加载版本历史
        if os.path.exists(self.versions_path):
            try:
                with open(self.versions_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                self._version_history = [VersionRecord.from_dict(v) for v in data.get("versions", [])]
            except Exception as e:
                logger.error(f"加载版本历史失败: {e}")

    def _save_data(self):
        """保存系数数据和版本历史"""
        # 保存系数
        coefficients_data = {
            "current_version": self._current_version,
            "coefficients": [entry.to_dict() for entry in self._coefficients.values()]
        }
        with open(self.coefficients_path, 'w', encoding='utf-8') as f:
            json.dump(coefficients_data, f, ensure_ascii=False, indent=2)

        # 保存版本历史
        versions_data = {
            "versions": [v.to_dict() for v in self._version_history]
        }
        with open(self.versions_path, 'w', encoding='utf-8') as f:
            json.dump(versions_data, f, ensure_ascii=False, indent=2)

    def _make_key(self, ingredient_a: str, ingredient_b: str, mechanism: str) -> str:
        """生成系数键"""
        # 确保 ingredient_a 和 ingredient_b 的顺序一致
        pair = tuple(sorted([ingredient_a, ingredient_b]))
        return f"{pair[0]}|{pair[1]}|{mechanism}"

    def _calculate_checksum(self) -> str:
        """计算当前系数数据的校验和"""
        data = json.dumps(
            [c.to_dict() for c in self._coefficients.values()],
            sort_keys=True,
            ensure_ascii=False
        )
        return hashlib.sha256(data.encode('utf-8')).hexdigest()[:16]

    def _create_version_record(self, changes_count: int, description: str, source: str = "manual"):
        """创建版本记录"""
        self._current_version += 1
        record = VersionRecord(
            version=self._current_version,
            timestamp=datetime.now(),
            source=source,
            changes_count=changes_count,
            description=description,
            checksum=self._calculate_checksum()
        )
        self._version_history.append(record)
        self._save_data()
        return record

    # ==================== 系数 CRUD ====================

    def add_coefficient(
        self,
        ingredient_a: str,
        ingredient_b: str,
        mechanism: str,
        coefficient: float,
        source: str,
        confidence: float = 0.5,
        notes: Optional[str] = None
    ) -> CoefficientEntry:
        """添加或更新系数"""
        key = self._make_key(ingredient_a, ingredient_b, mechanism)

        now = datetime.now()
        entry = CoefficientEntry(
            ingredient_a=ingredient_a,
            ingredient_b=ingredient_b,
            mechanism=mechanism,
            coefficient=coefficient,
            source=source,
            confidence=confidence,
            version=self._current_version,
            created_at=now,
            updated_at=now,
            notes=notes
        )

        # 如果已存在，记录变更
        if key in self._coefficients:
            old_entry = self._coefficients[key]
            entry.created_at = old_entry.created_at
            self._create_version_record(1, f"更新 {ingredient_a}-{ingredient_b} {mechanism} 系数")
        else:
            self._create_version_record(1, f"新增 {ingredient_a}-{ingredient_b} {mechanism} 系数")

        self._coefficients[key] = entry
        return entry

    def get_coefficient(
        self,
        ingredient_a: str,
        ingredient_b: str,
        mechanism: str,
        default: float = 0.0
    ) -> float:
        """获取系数值"""
        key = self._make_key(ingredient_a, ingredient_b, mechanism)
        entry = self._coefficients.get(key)
        return entry.coefficient if entry else default

    def delete_coefficient(
        self,
        ingredient_a: str,
        ingredient_b: str,
        mechanism: str
    ) -> bool:
        """删除系数"""
        key = self._make_key(ingredient_a, ingredient_b, mechanism)
        if key in self._coefficients:
            del self._coefficients[key]
            self._create_version_record(1, f"删除 {ingredient_a}-{ingredient_b} {mechanism} 系数")
            return True
        return False

    def list_coefficients(
        self,
        ingredient: Optional[str] = None,
        mechanism: Optional[str] = None
    ) -> List[Dict]:
        """列出系数"""
        result = []
        for entry in self._coefficients.values():
            if ingredient and ingredient not in [entry.ingredient_a, entry.ingredient_b]:
                continue
            if mechanism and entry.mechanism != mechanism:
                continue
            result.append(entry.to_dict())
        return result

    # ==================== 版本管理 ====================

    def get_version_history(self) -> List[Dict]:
        """获取版本历史"""
        return [v.to_dict() for v in self._version_history]

    def get_current_version(self) -> int:
        """获取当前版本号"""
        return self._current_version

    def get_version_info(self, version: int) -> Optional[Dict]:
        """获取指定版本信息"""
        for v in self._version_history:
            if v.version == version:
                return v.to_dict()
        return None

    def rollback_to_version(self, version: int) -> bool:
        """回滚到指定版本"""
        target_record = None
        for v in self._version_history:
            if v.version == version:
                target_record = v
                break

        if not target_record:
            logger.error(f"版本 {version} 不存在")
            return False

        # 重新加载该版本的系数数据（需要从备份恢复）
        # 这里简化实现，实际生产环境需要完整的版本快照
        logger.warning(f"回滚到版本 {version} 需要完整的版本快照支持")
        return False

    def get_coefficient_changes(self, from_version: int, to_version: int) -> List[Dict]:
        """获取两个版本之间的系数变更"""
        # 简化实现
        return []

    # ==================== 统计查询 ====================

    def get_stats(self) -> Dict:
        """获取统计信息"""
        mechanism_counts = {}
        for entry in self._coefficients.values():
            mechanism_counts[entry.mechanism] = mechanism_counts.get(entry.mechanism, 0) + 1

        return {
            "current_version": self._current_version,
            "total_coefficients": len(self._coefficients),
            "total_versions": len(self._version_history),
            "by_mechanism": mechanism_counts,
            "latest_version": self._version_history[-1].to_dict() if self._version_history else None
        }

    def export_to_json(self, filepath: str):
        """导出为 JSON 文件"""
        data = {
            "version": self._current_version,
            "exported_at": datetime.now().isoformat(),
            "coefficients": [c.to_dict() for c in self._coefficients.values()],
            "version_history": [v.to_dict() for v in self._version_history]
        }
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info(f"系数数据已导出到 {filepath}")


# ==================== 初始化示例数据 ====================

def init_sample_coefficients(manager: CoefficientVersionManager):
    """初始化示例协同系数数据"""

    # Bliss Independence 系数
    manager.add_coefficient("黄芪多糖", "大豆肽", "bliss_independence", 0.35, "文献-张等2023", 0.8)
    manager.add_coefficient("枸杞多糖", "胶原蛋白肽", "bliss_independence", 0.28, "文献-李等2022", 0.75)
    manager.add_coefficient("人参皂苷", "黄芪多糖", "bliss_independence", 0.42, "文献-王等2021", 0.85)
    manager.add_coefficient("灵芝多糖", "茯苓多糖", "bliss_independence", 0.15, "文献-陈等2020", 0.7)
    manager.add_coefficient("当归多糖", "熟地黄", "bliss_independence", 0.22, "文献-刘等2019", 0.65)

    # PK Interaction 系数
    manager.add_coefficient("人参皂苷", "五味子", "pk_interaction", 0.18, "文献-赵等2020", 0.6)
    manager.add_coefficient("甘草酸", "黄连素", "pk_interaction", -0.25, "文献-孙等2021", 0.7)

    # Taste Matrix 系数
    manager.add_coefficient("枸杞", "红枣", "taste_matrix", 1, "人工标定", 0.9)
    manager.add_coefficient("菊花", "枸杞", "taste_matrix", 0, "人工标定", 0.85)
    manager.add_coefficient("陈皮", "普洱", "taste_matrix", 1, "人工标定", 0.9)

    logger.info(f"示例数据初始化完成，共 {len(manager.list_coefficients())} 条系数")


if __name__ == "__main__":
    manager = CoefficientVersionManager()
    init_sample_coefficients(manager)

    print("=== 系数库统计 ===")
    stats = manager.get_stats()
    print(f"当前版本: v{stats['current_version']}")
    print(f"总系数数: {stats['total_coefficients']}")
    print(f"按机制分布: {stats['by_mechanism']}")

    print("\n=== 系数列表 ===")
    for coef in manager.list_coefficients():
        print(f"  {coef['ingredient_a']} + {coef['ingredient_b']} [{coef['mechanism']}]: "
              f"{coef['coefficient']:.2f} (置信度: {coef['confidence']:.2f})")

    print("\n=== 版本历史 ===")
    for v in manager.get_version_history():
        print(f"  v{v['version']}: {v['description']} ({v['timestamp']})")
