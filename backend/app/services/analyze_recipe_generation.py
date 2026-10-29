"""
配方生成模块 - 深度分析报告生成脚本
用于系统梳理当前模块状态、问题和改进方向
"""
import asyncio
import json
import sys

sys.path.insert(0, "D:\\RMFOODFP\\backend")

from pathlib import Path


async def generate_analysis_report():
    """生成完整的模块分析报告"""

    report = {
        "module": "配方生成",
        "version": "v2.5",
        "analyzed_at": "2026-09-27",
        "summary": {
            "total_features": 0,
            "implemented": 0,
            "partially_implemented": 0,
            "not_implemented": 0,
            "critical_issues": 0,
            "pending_fixes": 0
        },
        "backend": {},
        "frontend": {},
        "data_layer": {},
        "improvement_plan": {}
    }

    # 1. 后端API端点分析
    api_files = list(Path("D:/RMFOODFP/backend/app/api/ai_modules").glob("*.py"))
    endpoints = []
    for f in api_files:
        if "generation" in f.name.lower():
            content = f.read_text(encoding="utf-8")
            lines = content.split("\n")
            for i, line in enumerate(lines):
                if "@router." in line and "/generate" in line:
                    # 找到路由定义
                    line.split('"')[1] if '"' in line else "unknown"
                    path_line = lines[i+1] if i+1 < len(lines) else ""
                    summary = path_line.split('"')[1] if '"' in path_line else ""
                    endpoints.append({
                        "path": path_line.strip(),
                        "summary": summary,
                        "file": f.name
                    })
    report["backend"]["endpoints"] = endpoints

    # 2. 前端组件分析
    frontend_files = list(Path("D:/RMFOODFP/frontend/src/components/ai/features/GenerateTab").rglob("*.tsx"))
    frontend_files += list(Path("D:/RMFOODFP/frontend/src/components/ai/features/GenerateTab").rglob("*.ts"))
    report["frontend"]["components"] = [str(f.relative_to("D:/RMFOODFP/frontend/src")) for f in frontend_files]

    # 3. 算法模块分析
    algo_dir = Path("D:/RMFOODFP/backend/app/services/ai/algorithms")
    algo_files = list(algo_dir.glob("*.py"))
    algorithms = []
    for f in algo_files:
        content = f.read_text(encoding="utf-8")
        classes = [line.strip() for line in content.split("\n") if "class " in line and "Optimizer" in line or "class " in line and "Engine" in line]
        algorithms.append({
            "file": f.name,
            "classes": classes[:5],
            "line_count": len(content.split("\n"))
        })
    report["backend"]["algorithms"] = algorithms

    # 4. 数据层分析
    db_dir = Path("D:/RMFOODFP/backend/app/models")
    models = list(db_dir.glob("*.py"))
    report["data_layer"]["models"] = [m.name for m in models]

    # 5. 问题清单

    # 检查关键问题
    # 问题1: API端点不一致
    report["issues"] = {
        "api_endpoint_inconsistency": {
            "severity": "high",
            "description": "多个API端点返回不同的generator值，前端类型定义不匹配",
            "affected_endpoints": [
                {"path": "/ai/generate", "returns": "rule_engine"},
                {"path": "/ai/generate/advanced", "returns": "ga_optimizer (统一 GA 服务)"},
                {"path": "/ai/generate/v2", "returns": "unified_engine_v2"},
                {"path": "/ai/generate/seven-step", "returns": "seven_step_engine"}
            ]
        },
        "data_completeness": {
            "severity": "critical",
            "description": "配方生成依赖数据库完整性，需要确保数据补全脚本已运行",
            "status": "resolved",
            "resolution": "已创建recipe_generation_data_completer_v2.py，已从effects字段提取功效数据"
        },
        "type_consistency": {
            "severity": "medium",
            "description": "前端GeneratorType定义与后端返回值不完全匹配",
            "affected_types": {
                "frontend": ["rule_engine", "llm", "neural_network"],
                "backend_returns": ["rule_engine", "neural_engine", "unified_engine_v2", "seven_step_engine"]
            }
        }
    }

    return report


if __name__ == "__main__":
    report = asyncio.run(generate_analysis_report())
    print(json.dumps(report, ensure_ascii=False, indent=2))
