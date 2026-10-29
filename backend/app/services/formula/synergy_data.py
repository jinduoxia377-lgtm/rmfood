"""
SynergyEngine 数据管理模块

提供研究数据导入、Schema 验证、版本管理和统计功能。
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List

try:
    import jsonschema
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False

# A-27：301 行会读 HAS_SCIPY，但全文件从未定义过它（只定义了 HAS_JSONSCHEMA），
#       一调用 get_stats() 就是 NameError。
try:
    import scipy  # noqa: F401
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

from .synergy_models import (
    SynergyCoefficient,
    VersionRecord,
)

logger = logging.getLogger(__name__)


class SynergyDataMixin:
    """
    数据管理 mixin 类

    提供研究数据导入、Schema 验证、版本管理和统计功能。
    需要被混入拥有 _coefficients, _version_history, _current_version
    等属性的类中使用。
    """

    RESEARCH_DATA_SCHEMA = {
        "type": "object",
        "required": ["data_source", "coefficients"],
        "properties": {
            "data_source": {
                "type": "string",
                "description": "数据来源标识",
            },
            "research_paper": {
                "type": "string",
                "description": "参考文献（可选）",
            },
            "coefficients": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": [
                        "ingredient_a",
                        "ingredient_b",
                        "mechanism",
                        "coefficient",
                        "confidence",
                    ],
                    "properties": {
                        "ingredient_a": {"type": "string"},
                        "ingredient_b": {"type": "string"},
                        "mechanism": {
                            "type": "string",
                            "enum": [
                                "bliss_independence",
                                "pk_interaction",
                                "gibbs_stability",
                                "network_pharmacology",
                                "taste_matrix",
                                "ki_value",
                                "gamma_interaction",
                            ],
                        },
                        "coefficient": {"type": "number"},
                        "confidence": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 1,
                        },
                        "notes": {"type": "string"},
                    },
                },
            },
        },
    }

    def import_research_data(
        self,
        data: Dict[str, Any],
        validate_schema: bool = True,
    ) -> Dict[str, Any]:
        """
        导入研究数据以更新协同系数库

        功能:
        1. JSON Schema 验证输入数据格式
        2. 批量导入新的协同系数
        3. 版本管理: 记录时间戳、来源、变更内容
        4. 变更日志查询功能

        Args:
            data: 研究数据字典，符合 JSON Schema
            validate_schema: 是否验证 Schema

        Returns:
            导入结果报告 {
                "success": bool,
                "version": int,
                "imported_count": int,
                "updated_count": int,
                "errors": list,
                "warnings": list,
            }

        Raises:
            ValueError: 数据验证失败
            TypeError: 数据格式错误

        Example:
            >>> engine = SynergyEngine()
            >>> result = engine.import_research_data({
            ...     "data_source": "literature_review_2024",
            ...     "research_paper": "Zhang et al., Food Chem, 2024",
            ...     "coefficients": [
            ...         {
            ...             "ingredient_a": "黄芪",
            ...             "ingredient_b": "大豆肽",
            ...             "mechanism": "bliss_independence",
            ...             "coefficient": 0.85,
            ...             "confidence": 0.9,
            ...             "notes": "体外实验验证",
            ...         },
            ...     ],
            ... })
        """
        errors = []
        warnings = []
        imported_count = 0
        updated_count = 0

        # 1. Schema 验证
        if validate_schema and HAS_JSONSCHEMA:
            try:
                jsonschema.validate(data, self.RESEARCH_DATA_SCHEMA)
            except jsonschema.ValidationError as e:
                raise ValueError(f"JSON Schema 验证失败: {e.message}")
        elif validate_schema and not HAS_JSONSCHEMA:
            warnings.append("jsonschema 未安装，使用简化验证")
            self._simple_validate(data, errors, warnings)

        if errors:
            raise ValueError(f"数据验证错误: {errors}")

        # 2. 提取元信息
        data_source = data.get("data_source", "unknown")
        research_paper = data.get("research_paper", "")
        coefficients = data.get("coefficients", [])

        if not coefficients:
            raise ValueError("系数列表不能为空")

        # 3. 创建新版本
        new_version = self._current_version + 1
        now = datetime.now()

        # 4. 处理每个系数
        for coeff_data in coefficients:
            try:
                key = self._make_coefficient_key(
                    coeff_data["ingredient_a"],
                    coeff_data["ingredient_b"],
                    coeff_data["mechanism"],
                )

                # 检查是否已存在
                existing = self._coefficients.get(key)

                coefficient = SynergyCoefficient(
                    ingredient_a=coeff_data["ingredient_a"],
                    ingredient_b=coeff_data["ingredient_b"],
                    mechanism=coeff_data["mechanism"],
                    coefficient=float(coeff_data["coefficient"]),
                    source=data_source,
                    confidence=float(coeff_data["confidence"]),
                    version=new_version,
                    created_at=existing.created_at if existing else now,
                    updated_at=now,
                    notes=coeff_data.get("notes") or research_paper,
                )

                self._coefficients[key] = coefficient

                if existing:
                    updated_count += 1
                else:
                    imported_count += 1

            except Exception:
                errors.append("处理系数失败: 服务异常")

        # 5. 更新版本号并保存
        self._current_version = new_version

        # 6. 创建版本记录
        version_record = VersionRecord(
            version=new_version,
            timestamp=now,
            source=data_source,
            changes_count=imported_count + updated_count,
            description=(
                f"导入 {imported_count} 个新系数，更新 {updated_count} 个现有系数"
            ),
            checksum=self._compute_checksum(coefficients),
        )
        self._version_history.append(version_record)

        # 7. 持久化存储
        self._save_coefficients()
        self._save_version_history()

        result = {
            "success": len(errors) == 0,
            "version": new_version,
            "imported_count": imported_count,
            "updated_count": updated_count,
            "errors": errors,
            "warnings": warnings,
            "timestamp": now.isoformat(),
        }

        logger.info(
            f"研究数据导入完成: v{new_version}, "
            f"新增={imported_count}, 更新={updated_count}, 来源={data_source}"
        )

        return result

    def _simple_validate(
        self,
        data: Dict[str, Any],
        errors: List[str],
        warnings: List[str],
    ) -> None:
        """简化的数据验证（当 jsonschema 不可用时）"""
        if "data_source" not in data:
            errors.append("缺少 data_source 字段")
        if "coefficients" not in data or not isinstance(data["coefficients"], list):
            errors.append("缺少或无效的 coefficients 字段")
            return

        required_fields = [
            "ingredient_a", "ingredient_b",
            "mechanism", "coefficient", "confidence",
        ]
        valid_mechanisms = {
            "bliss_independence", "pk_interaction",
            "gibbs_stability", "network_pharmacology",
            "taste_matrix", "ki_value", "gamma_interaction",
        }

        for i, coeff in enumerate(data["coefficients"]):
            for field in required_fields:
                if field not in coeff:
                    errors.append(f"系数 #{i+1} 缺少 {field} 字段")

            if "mechanism" in coeff and coeff["mechanism"] not in valid_mechanisms:
                warnings.append(f"系数 #{i+1} 未知的机制类型: {coeff['mechanism']}")

            if "confidence" in coeff and not (0 <= coeff["confidence"] <= 1):
                errors.append(f"系数 #{i+1} confidence 不在 [0, 1] 范围内")

    def _compute_checksum(self, data: Any) -> str:
        """计算数据的校验和"""
        import hashlib
        data_str = json.dumps(data, sort_keys=True, ensure_ascii=False)
        return hashlib.md5(data_str.encode()).hexdigest()[:12]

    # ================================================================
    # UTILITY METHODS
    # ================================================================

    def get_statistics(self) -> Dict[str, Any]:
        """
        获取引擎统计信息

        Returns:
            统计信息字典
        """
        mechanism_counts: Dict[str, int] = {}
        for coeff in self._coefficients.values():
            mechanism_counts[coeff.mechanism] = mechanism_counts.get(coeff.mechanism, 0) + 1

        return {
            "total_coefficients": len(self._coefficients),
            "current_version": self._current_version,
            "versions_count": len(self._version_history),
            "mechanism_distribution": mechanism_counts,
            "has_scipy": HAS_SCIPY,
            "has_jsonschema": HAS_JSONSCHEMA,
        }

    def clear_all_data(self) -> None:
        """清除所有数据（仅用于测试）"""
        self._coefficients.clear()
        self._version_history.clear()
        self._current_version = 0
        self._save_coefficients()
        self._save_version_history()
        logger.warning("已清除所有协同系数数据")

