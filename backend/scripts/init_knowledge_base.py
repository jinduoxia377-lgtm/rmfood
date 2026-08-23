"""
知识数据初始化脚本
执行所有数据文件的创建和初始化
"""

import sys
import os
import logging
from pathlib import Path

# 添加 backend 根目录到路径
backend_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_root))

from app.services.formula.pk_pd_database import get_coverage_stats as get_pk_stats
from app.services.formula.nutrition_database import get_coverage_stats as get_nutrition_stats
from app.services.formula.compatibility_rules import get_rule_count
from app.services.formula.coefficient_version_manager import CoefficientVersionManager, init_sample_coefficients

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def init_pk_pd_database():
    """初始化 PK/PD 数据库"""
    logger.info("=" * 60)
    logger.info("初始化 PK/PD 参数数据库")
    logger.info("=" * 60)
    
    stats = get_pk_stats()
    logger.info(f"PK 参数覆盖: {stats['total_ingredients']} 味")
    logger.info(f"  - 肽类: {stats['peptide_count']} 味")
    logger.info(f"  - 多糖类: {stats['polysaccharide_count']} 味")
    logger.info(f"  - 皂苷类: {stats['saponin_count']} 味")
    logger.info(f"  - 黄酮类: {stats['flavonoid_count']} 味")
    logger.info(f"  - 其他: {stats['other_count']} 味")
    
    return stats


def init_nutrition_database():
    """初始化营养数据库"""
    logger.info("=" * 60)
    logger.info("初始化营养数据库")
    logger.info("=" * 60)
    
    stats = get_nutrition_stats()
    logger.info(f"营养数据覆盖: {stats['total_ingredients']} 味")
    for cat, count in stats['categories'].items():
        logger.info(f"  - {cat}: {count} 味")
    
    return stats


def init_compatibility_rules():
    """初始化兼容性规则库"""
    logger.info("=" * 60)
    logger.info("初始化兼容性规则库")
    logger.info("=" * 60)
    
    stats = get_rule_count()
    logger.info(f"总规则数: {stats['total']} 条")
    for rule_type, count in stats['by_type'].items():
        logger.info(f"  - {rule_type}: {count} 条")
    
    return stats


def init_coefficient_manager():
    """初始化协同系数管理器"""
    logger.info("=" * 60)
    logger.info("初始化协同系数管理器")
    logger.info("=" * 60)
    
    manager = CoefficientVersionManager()
    init_sample_coefficients(manager)
    
    stats = manager.get_stats()
    logger.info(f"当前版本: v{stats['current_version']}")
    logger.info(f"总系数数: {stats['total_coefficients']} 条")
    logger.info(f"按机制分布: {stats['by_mechanism']}")
    
    return manager


def verify_data_integrity():
    """验证数据完整性"""
    logger.info("=" * 60)
    logger.info("验证数据完整性")
    logger.info("=" * 60)
    
    issues = []
    
    # 检查 PK/PD 数据库一致性
    from app.services.formula.pk_pd_database import PK_PARAMETERS_DB, PD_PARAMETERS_DB
    pk_names = set(PK_PARAMETERS_DB.keys())
    pd_names = set(PD_PARAMETERS_DB.keys())
    
    missing_pk = pd_names - pk_names
    missing_pd = pk_names - pd_names
    
    if missing_pk:
        issues.append(f"PK 参数缺失: {missing_pk}")
    if missing_pd:
        issues.append(f"PD 参数缺失: {missing_pd}")
    
    # 检查营养数据库
    from app.services.formula.nutrition_database import HERB_NUTRITION_DB
    if len(HERB_NUTRITION_DB) < 50:
        issues.append(f"营养数据库覆盖不足: {len(HERB_NUTRITION_DB)} 味，目标 50+")
    
    # 检查兼容性规则
    from app.services.formula.compatibility_rules import COMPATIBILITY_RULES
    if len(COMPATIBILITY_RULES) < 50:
        issues.append(f"兼容性规则覆盖不足: {len(COMPATIBILITY_RULES)} 条，目标 50+")
    
    if issues:
        logger.warning("数据完整性检查发现问题:")
        for issue in issues:
            logger.warning(f"  - {issue}")
        return False
    else:
        logger.info("数据完整性检查通过!")
        return True


def main():
    """主初始化流程"""
    logger.info("=" * 60)
    logger.info("RMFOOD 知识数据底座初始化")
    logger.info("=" * 60)
    
    # 1. 初始化各数据库
    pk_stats = init_pk_pd_database()
    nutrition_stats = init_nutrition_database()
    compat_stats = init_compatibility_rules()
    manager = init_coefficient_manager()
    
    # 2. 验证数据完整性
    integrity_ok = verify_data_integrity()
    
    # 3. 汇总报告
    logger.info("=" * 60)
    logger.info("初始化完成 - 数据覆盖报告")
    logger.info("=" * 60)
    logger.info(f"PK/PD 参数: {pk_stats['total_ingredients']} 味 (目标: 40+)" + 
                (" ✅" if pk_stats['total_ingredients'] >= 40 else " ⚠️"))
    logger.info(f"营养数据库: {nutrition_stats['total_ingredients']} 味 (目标: 50+)" + 
                (" ✅" if nutrition_stats['total_ingredients'] >= 50 else " ⚠️"))
    logger.info(f"兼容性规则: {compat_stats['total']} 条 (目标: 50+)" + 
                (" ✅" if compat_stats['total'] >= 50 else " ⚠️"))
    logger.info(f"协同系数: {manager.get_stats()['total_coefficients']} 条 (目标: 10+)")
    logger.info(f"数据完整性: {'✅ 通过' if integrity_ok else '⚠️ 存在问题'}")
    
    return integrity_ok


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
