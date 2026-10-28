"""
批量安全检查服务 (v1.0)

支持一次性检查多个配方/成分的安全性：
- 药食同源目录校验
- 十九畏/十八反配伍禁忌
- 过敏原检测
- 孕妇安全性
- 毒性评估
"""

import logging
from dataclasses import dataclass, field

from ...ai_models.safety_checker import SafetyCheckerService

logger = logging.getLogger(__name__)


@dataclass
class BatchCheckResult:
    """批量检查结果"""
    total_checked: int = 0
    passed: int = 0
    failed: int = 0
    warnings: int = 0
    items: list[dict] = field(default_factory=list)
    summary: str = ""


async def batch_safety_check(
    ingredients_list: list[list[str]],
    max_items: int = 100,
) -> BatchCheckResult:
    """
    批量安全检查

    Args:
        ingredients_list: 每组成分列表 [[成分1, 成分2], [成分3, 成分4], ...]
        max_items: 最大检查批次数

    Returns:
        BatchCheckResult
    """
    results = BatchCheckResult()
    checker = SafetyCheckerService()

    for i, batch in enumerate(ingredients_list[:max_items]):
        try:
            check = checker.check_batch(batch)
            results.total_checked += 1

            if check.get("passed", True):
                results.passed += 1
            elif check.get("warnings"):
                results.warnings += 1
            else:
                results.failed += 1

            results.items.append({
                "batch_index": i,
                "ingredients": batch,
                "result": check,
            })
        except Exception as e:
            logger.error("批量检查批次 %d 失败: %s", i, e)
            results.items.append({
                "batch_index": i,
                "ingredients": batch,
                "error": "安全检查异常",
            })

    results.summary = (
        f"共检查 {results.total_checked} 组成分，"
        f"通过 {results.passed}，警告 {results.warnings}，"
        f"失败 {results.failed}"
    )

    return results
