# -*- coding: utf-8 -*-
"""
/peptide-structure 核心修复防还原门禁
=====================================

背景：2026-10-09 提交 de078cc（"全仓归零"策略）曾静默还原
8b5bb5f 中部分修复（history 路由、CSRF 豁免、匿名用户 500 修复），
导致 /peptide-structure 页面 9 个 Tab 中 4 个回归故障。

本脚本用于在任何"全仓归零 / 主题令牌化 / 批量 git checkout"
类提交前后运行，检测 7 个核心修复文件的关键代码是否仍在。

用法：
    python backend/scripts/peptide_structure_guard.py

退出码：
    0 = 全部修复均在位
    1 = 发现缺失，输出具体缺失项

每个检查项都是「关键代码片段 grep」，不依赖行号、不依赖格式，
对主题令牌化等无害改动保持幂等。
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ─────────────────────────────────────────────────────────────
# 检查项：(相对路径, 关键代码正则, 说明)
# ─────────────────────────────────────────────────────────────
CHECKS = [
    # P0-pI：等电点赋值（food_peptide_service.py:254 附近）
    (
        "backend/app/services/peptide_analyzer/food_peptide_service.py",
        r"result\.isoelectric_point\s*=\s*props\['isoelectric_point'\]",
        "pI 修复：result.isoelectric_point 必须赋值自 props",
    ),
    # P0-1：history 三路由
    (
        "backend/app/api/peptide_structure_routes.py",
        r"@router\.get\('/history'",
        "history 路由：GET /history 必须注册",
    ),
    (
        "backend/app/api/peptide_structure_routes.py",
        r"@router\.get\('/history/statistics'",
        "history 路由：GET /history/statistics 必须注册",
    ),
    (
        "backend/app/api/peptide_structure_routes.py",
        r"@router\.delete\('/history/\{record_id\}'",
        "history 路由：DELETE /history/{id} 必须注册",
    ),
    # P0-2：CSRF 豁免
    (
        "backend/app/core/security/security_middleware.py",
        r'if request\.url\.path\.startswith\("/api/v1/ai/peptide"\):',
        "CSRF 豁免：/api/v1/ai/peptide 前缀必须在白名单",
    ),
    # P0-2b：匿名用户 500 修复
    (
        "backend/app/api/advanced_peptide.py",
        r"_uid = current_user\.id if current_user else \"anonymous\"",
        "匿名用户修复：advanced_peptide deep_analysis 必须 _uid 三元表达式",
    ),
    # P1-1：数据库分布字段
    (
        "backend/app/api/peptide_structure_routes.py",
        r'"activity_distribution":\s*activity_distribution',
        "数据库分布：search 端点必须返回 activity_distribution",
    ),
    (
        "backend/app/api/peptide_structure_routes.py",
        r'"food_source_distribution":\s*food_source_distribution',
        "数据库分布：search 端点必须返回 food_source_distribution",
    ),
    # P1-3：深度分析字段路径（前端）
    (
        "frontend/src/pages/database/tabs/PeptideStructureAnalyzer.tsx",
        r"bpProps = result\.basic_properties",
        "深度分析 Tab：必须读 basic_properties（非扁平 result）",
    ),
    (
        "frontend/src/pages/database/tabs/PeptideStructureAnalyzer.tsx",
        r"pp\.net_charge_at_ph7",
        "深度分析 Tab：净电荷必须读 physicochemical_profile.net_charge_at_ph7",
    ),
    # P0-3：3D 四元数（球棍模型 + 管线模型两处都必须有）
    (
        "frontend/src/components/molecule/MoleculeViewer3D.tsx",
        r"import \{ Quaternion, Vector3 \} from 'three'",
        "3D 模型：必须 import Quaternion/Vector3",
    ),
    (
        "frontend/src/components/molecule/MoleculeViewer3D.tsx",
        r"new Quaternion\(\)\.setFromUnitVectors",
        "3D 模型：圆柱体必须用 Quaternion 对齐键方向",
    ),
    (
        "frontend/src/components/molecule/MoleculeViewer3D.tsx",
        r"quaternion=\{b\.quaternion\}",
        "3D 球棍模型：mesh 必须应用 quaternion",
    ),
    # evolution/align 路由修正（必须调用 align_sequences 而非不存在的 align）
    (
        "backend/app/api/peptide_structure_routes.py",
        r"analyzer\.align_sequences\(seq_list\[0\], seq_list\[1\]\)",
        "evolution/align：路由必须调用 align_sequences(seq1, seq2)",
    ),
    # quantitative/predict 路由修正（必须调用 predict_ace_ic50 + predict_antioxidant_activity）
    (
        "backend/app/api/peptide_structure_routes.py",
        r"predictor\.predict_ace_ic50\(sequence\)",
        "quantitative/predict：路由必须调用 predict_ace_ic50",
    ),
    # 前端 service 必须用查询参数（非 JSON body）调用三个高级端点
    (
        "frontend/src/services/professional/peptideStructureService.ts",
        r"hydrolysis/simulate\?\$\{params\}",
        "前端 service：hydrolysis/simulate 必须用查询参数",
    ),
    (
        "frontend/src/services/professional/peptideStructureService.ts",
        r"evolution/align\?\$\{params\}",
        "前端 service：evolution/align 必须用查询参数",
    ),
    (
        "frontend/src/services/professional/peptideStructureService.ts",
        r"quantitative/predict\?\$\{params\}",
        "前端 service：quantitative/predict 必须用查询参数",
    ),
    # 前端高级工具 Tab 必须注册
    (
        "frontend/src/pages/database/tabs/PeptideStructureAnalyzer.tsx",
        r"key: 'advanced', label: '高级工具'",
        "前端：高级工具 Tab 必须注册（水解/比对/定量三工具入口）",
    ),
    # 协同 Tab 字段契约（synergy_matrix 而非 synergies）
    (
        "frontend/src/pages/database/tabs/PeptideStructureAnalyzer.tsx",
        r"result\.synergy_matrix \|\| \[\]\)\.flat\(\)",
        "前端：协同 Tab 必须用 result.synergy_matrix（后端真实字段）",
    ),
    (
        "frontend/src/pages/database/tabs/PeptideStructureAnalyzer.tsx",
        r"result\.top_combinations",
        "前端：协同 Tab 必须用 result.top_combinations（非 ranked_herbs）",
    ),
    # 高级工具 Tab 六个子工具入口
    (
        "frontend/src/pages/database/tabs/PeptideStructureAnalyzer.tsx",
        r"SolubilityPredictorView",
        "前端：溶解度预测子工具必须注册",
    ),
    (
        "frontend/src/pages/database/tabs/PeptideStructureAnalyzer.tsx",
        r"VariantGeneratorView",
        "前端：变体生成子工具必须注册",
    ),
    (
        "frontend/src/pages/database/tabs/PeptideStructureAnalyzer.tsx",
        r"CustomOptimizerView",
        "前端：自定义优化子工具必须注册",
    ),
    # service 自定义优化方法
    (
        "frontend/src/services/professional/peptideStructureService.ts",
        r"customOptimize",
        "前端 service：customOptimize 方法必须存在",
    ),
]


def main() -> int:
    failures = []
    for rel, pattern, desc in CHECKS:
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            failures.append(f"[MISSING FILE] {rel}\n    说明：{desc}")
            continue
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        if re.search(pattern, content):
            print(f"  OK   {rel}  ::  {desc}")
        else:
            failures.append(f"[REVERTED] {rel}\n    说明：{desc}\n    期望匹配：{pattern}")

    if failures:
        print("\n" + "=" * 60)
        print(f"  防还原门禁失败：{len(failures)} 项缺失/被还原")
        print("=" * 60)
        for f in failures:
            print(f)
            print()
        print("  处理：重新提交这些文件的修复（参考 8b5bb5f / fe8cdb0 提交）")
        return 1

    print(f"\n  全部 {len(CHECKS)} 项检查通过，核心修复在位。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
