# 未使用 AI 模块清单

**生成日期**: 2026-08-03
**扫描范围**: `backend/app/services/ai/`
**扫描方法**: 静态分析所有 `from ... import` 和 `import ...` 语句

---

## 摘要

| 类别 | 数量 |
|------|------|
| 总 Python 文件 | 68 (排除 `__init__.py` 和 `test_*`) |
| 被引用模块 | 67 |
| 未使用模块 | **1** |

---

## 未被引用的模块

### `inject/di_config.py`

**路径**: `backend/app/services/ai/inject/di_config.py`

**状态**: 未被任何模块 import

**原因分析**:
- 该模块实现了基于 SQLAlchemy 的依赖注入配置
- 代码中包含硬编码的连接字符串: `postgresql+asyncpg://user:password@localhost/rmfood`
- 项目中已有更完善的依赖注入体系（`AdapterRegistry`、`get_adapter_instance`）
- `__init__.py` 未将其加入 `__all__` 导出

**建议**:
- 如确认无用，可删除整个 `inject/` 目录
- 如需保留作为参考，添加 `# DEPRECATED` 注释标记

---

## 已被引用的核心模块

以下模块在项目中被实际调用，**不应删除**:

### 核心编排层
| 模块 | 用途 | 引用位置 |
|------|------|---------|
| `orchestration/generation_service.py` | AI 配方生成 | API 层 |
| `orchestration/optimization_service.py` | 多目标优化 | API 层 |
| `orchestration/chat_engine.py` | 学术顾问聊天引擎 | API 层 |
| `orchestration/react_chain.py` | ReAct 推理链 | 内部引用 |
| `orchestration/multimodal_engine.py` | 多模态输出引擎 | `__init__.py` 导出 |
| `orchestration/super_intelligence_ensembler.py` | 超级智能集成 | `__init__.py` 导出 |

### 算法层
| 模块 | 用途 | 引用位置 |
|------|------|---------|
| `algorithms/unified_optimizer.py` | 统一优化器 | API 层 |
| `algorithms/bayesian_formula_optimizer.py` | 贝叶斯优化 | 内部引用 |
| `algorithms/genetic_formula_optimizer.py` | 遗传算法优化 | 内部引用 |
| `algorithms/neural_formula_network.py` | 神经网络配方 | 内部引用 |
| `algorithms/nsga3_optimizer.py` | NSGA-III 多目标 | 内部引用 |
| `algorithms/herb_knowledge_service.py` | 中药材知识库 | 启动时初始化 |

### 服务层
| 模块 | 用途 | 引用位置 |
|------|------|---------|
| `rag/rag_service.py` | RAG 检索服务 | `rag_router.py` |
| `shared/recommendation_engine.py` | 推荐引擎 | `__init__.py` 导出 |
| `shared/template_service.py` | 模板服务 | `__init__.py` 导出 |
| `shared/observability.py` | 可观测性 | API 层 |
| `shared/response_cache.py` | 响应缓存 | API 层 |
| `agent/orchestrator.py` | Agent 编排 | `agent_router.py` |

### 共享组件
| 模块 | 用途 | 状态 |
|------|------|------|
| `shared/ab_test.py` | A/B 测试框架 | 定义但未活跃引用，可考虑清理 |
| `shared/alerting.py` | 告警系统 | 内部引用 |
| `shared/diagnostic_engine.py` | 诊断引擎 | 内部引用 |
| `shared/metrics_collector.py` | 指标收集 | 内部引用 |
| `shared/request_queue.py` | 请求队列 | 内部引用 |

---

## 建议清理项

### P0 - 安全清理（建议立即执行）
1. **删除 `inject/di_config.py`** - 未使用且含硬编码凭证
2. **检查 `shared/ab_test.py`** - 确认是否可删除

### P1 - 技术债务
1. 清理未使用的导入路径
2. 标准化模块导出（确保 `__all__` 与实际使用一致）

---

## 扫描脚本

```python
import re
from pathlib import Path

SEARCH_ROOT = Path('backend')
AI_DIR = Path('backend/app/services/ai')

def get_all_imports():
    imports = set()
    for f in SEARCH_ROOT.rglob('*.py'):
        content = f.read_text(encoding='utf-8', errors='ignore')
        for match in re.finditer(r'from\s+([\w.]+)\s+import', content):
            imports.add(match.group(1))
        for match in re.finditer(r'import\s+([\w.]+)', content):
            imports.add(match.group(1))
    return imports

all_imports = get_all_imports()

ai_files = [f for f in AI_DIR.rglob('*.py')
            if f.is_file()
            and not f.name.startswith('__init__')
            and not f.name.startswith('test_')]

unused = []
for f in ai_files:
    rel = f.relative_to(SEARCH_ROOT)
    parts = rel.with_suffix('').parts[1:]  # remove 'backend'
    is_used = any(p in imp for p in parts for imp in all_imports)
    if not is_used:
        unused.append(str(rel))

print(f'Unused modules: {unused}')
```
