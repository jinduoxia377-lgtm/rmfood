# PepINVERT 肽设计引擎 - 集成指南

## 概述

PepINVERT 是基于 [MolecularAI/PepINVENT](https://github.com/MolecularAI/PepINVENT) 库的增强型肽序列生成与优化服务，已集成到 RMFOOD 配方平台的 AI 助手系统中。

### 核心能力

- **智能肽生成**: 基于目标功效（ACE抑制、抗氧化等）自动生成优化的肽候选
- **RL 优化**: 使用强化学习对种子肽进行多目标优化
- **探索性采样**: 发现高多样性的新颖肽结构空间
- **性质预测**: 计算分子量、LogP、TPSA 等理化性质
- **多样性评估**: Tanimoto/Jaccard 相似度矩阵分析

---

## 快速开始

### 1. 安装依赖（可选）

```bash
# 进入后端目录
cd backend

# 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 安装基础依赖
pip install -r requirements.txt

# 安装 PepINVERT 可选依赖组
pip install torch>=2.0.0 rdkit-pypi>=2023.9.6 transformers>=4.35.0

# 或从源码安装 PepINVERT（可选）
# pip install git+https://github.com/MolecularAI/PepINVENT.git@master#egg=pepinvent
```

### 2. 配置环境变量

在 `backend/.env` 文件中添加：

```bash
# ══════════════════════════════════════
# PepINVERT 配置（可选）
# ══════════════════════════════════════
PEPINVENT_GENERATIVE_MODEL_PATH=./models/pepinvent_generative.pt
PEPINVENT_PREDICTOR_MODEL_PATH=./models/pepinvent_predictor.pt
PEPINVENT_DEVICE=auto          # auto|cuda|cpu
PEPINVENT_TEMPERATURE=1.0      # 采样温度 (0.1-5.0)
PEPINVENT_TOP_K=50             # Top-K 采样参数
```

> **注意**: 如果不配置或依赖未安装，系统将自动使用**模拟模式**运行，功能正常但使用规则算法替代深度学习模型。

### 3. 启动服务

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

访问 http://localhost:8000/docs 查看 Swagger UI 文档。

---

## API 接口说明

### 基础路径: `/api/v1/ai/peptide`

#### 1. 基于功效生成肽候选

```http
POST /api/v1/ai/peptide/generate
Authorization: Bearer <your_token>
Content-Type: application/json
```

**请求体**:
```json
{
  "target_effects": ["ACE抑制", "抗氧化"],
  "max_candidates": 5,
  "constraints": {
    "min_length": 3,
    "max_length": 15,
    "temperature": 1.2,
    "top_k": 50
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "peptides": [
      {
        "sequence": "VLGYT",
        "molecular_weight": 563.64,
        "logp": -0.4,
        "tpsa": 245.8,
        "activity_scores": {
          "ACE_inhibitory": 0.78,
          "antioxidant": 0.65
        },
        "composite_score": 0.74,
        "smiles": "CC(C)N.CC(C)C[C@@H](N).SC[C@@H](N).c1ccc(O)cc1",
        "amino_acid_count": 5,
        "properties": {
          "hbd": 4,
          "hba": 7,
          "rotatable_bonds": 4,
          "is_valid": true
        }
      }
    ],
    "total": 5,
    "generation_method": "pepinvent_sampling",
    "target_effects": ["ACE抑制", "抗氧化"],
    "diversity_metrics": {
      "diversity_score": 0.85,
      "unique_count": 5,
      "average_similarity": 0.25
    },
    "generated_at": "2026-05-03T12:00:00Z",
    "processing_time_ms": 1250
  }
}
```

#### 2. RL 优化肽序列

```http
POST /api/v1/ai/peptide/optimize
Authorization: Bearer <your_token>
Content-Type: application/json
```

**请求体**:
```json
{
  "seed_sequence": "VLGYT",
  "optimization_goals": {
    "ACE_inhibitory": 0.6,
    "permeability": 0.4
  },
  "iterations": 10
}
```

**支持的优化目标**:
| 目标名称 | 说明 | 典型应用 |
|---------|------|---------|
| `ACE_inhibitory` | ACE 抑制活性 | 降血压配方 |
| `antioxidant` | 抗氧化能力 | 抗衰老配方 |
| `DPP_IV_inhibitory` | DPP-IV 抑制活性 | 降血糖配方 |
| `permeability` | 细胞膜渗透性 | 提高生物利用度 |
| `stability` | 结构稳定性 | 延长保质期 |
| `solubility` | 水溶性 | 改善口感 |

**权重约束**:
- 所有权重必须 > 0 且 ≤ 1.0
- 权重总和应接近 1.0（允许 ±0.01 误差）

#### 3. 探索性多样化采样

```http
POST /api/v1/ai/peptide/sample
Authorization: Bearer <your_token>
Content-Type: application/json
```

**请求体**:
```json
{
  "sample_size": 20,
  "temperature": 1.5,
  "top_k": 80,
  "diversity_metric": "tanimoto"
}
```

**多样性度量方法**:
- `tanimoto`: Tanimoto 系数（默认）
- `jaccard`: Jaccard 相似度
- `overlap`: 重叠系数

#### 4. 查看服务状态

```http
GET /api/v1/ai/peptide/status
Authorization: Bearer <your_token>
```

**响应示例**:
```json
{
  "service_name": "PepinventService",
  "version": "1.0.0",
  "available": true,
  "initialized": true,
  "simulation_mode": false,
  "device": "cpu",
  "dependencies": {
    "available": true,
    "missing": [],
    "version_info": {
      "torch": "2.1.0",
      "rdkit": "2023.9.6",
      "transformers": "4.36.0"
    }
  },
  "cache_stats": {
    "cache_size": 12,
    "cache_enabled": true
  }
}
```

---

## 扩展现有 AI 管线

在现有的 `/api/v1/ai/generate` 和 `/api/v1/ai/generate/neural` 端点中添加 `use_pepinvent: true` 参数即可启用 PepINVERT 增强：

### 示例：标准配方生成 + PepINVERT

```bash
curl -X POST http://localhost:8000/api/v1/ai/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_effects": ["降血压", "抗氧化"],
    "use_llm": false,
    "use_pepinvent": true,
    "constraints": {
      "max_candidates": 5
    }
  }'
```

**返回差异**:
- `generated_by`: `"pepinvent"` （而非 `"rule_engine"`）
- `peptide_candidates` 中的肽来自 PepINVERT 生成（含详细属性）
- 自动匹配药食同源药材组合

---

## 前端集成示例

### React 组件使用

```tsx
import { AdvancedPeptideDesign } from '@/components/ai'
import { aiApi, type PeptideResult } from '@/api/ai'

function MyComponent() {
  const handlePeptidesGenerated = (peptides: PeptideResult[]) => {
    console.log('生成的肽:', peptides)
  }

  return (
    <AdvancedPeptideDesign 
      onPeptidesGenerated={handlePeptidesGenerated}
      className="w-full max-w-4xl"
    />
  )
}
```

### 直接调用 API

```typescript
// 生成肽
const response = await aiApi.generatePeptides(
  ['ACE抑制', '抗氧化'],
  10, // maxCandidates
  { min_length: 5, max_length: 12 }
)

console.log(response.data.peptides)

// RL 优化
const optimized = await aiApi.optimizePeptide(
  'VLGYT',
  { ACE_inhibitory: 0.7, antioxidant: 0.3 },
  15 // iterations
)

console.log(optimized.data.optimized_peptides)

// 探索性采样
const samples = await aiApi.sampleDiversePeptides(30, 1.5, undefined, 'tanimoto')

console.log(samples.data.diversity_metrics)
```

---

## Python 客户端示例

```python
import requests
import json

BASE_URL = "http://localhost:8000/api/v1"
TOKEN = "your_access_token"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

# 1. 生成肽候选
def generate_peptides():
    url = f"{BASE_URL}/ai/peptide/generate"
    payload = {
        "target_effects": ["ACE抑制", "抗氧化"],
        "max_candidates": 5
    }
    
    resp = requests.post(url, headers=headers, json=payload)
    data = resp.json()
    
    if data["success"]:
        for i, peptide in enumerate(data["data"]["peptides"], 1):
            print(f"\n#{i}: {peptide['sequence']}")
            print(f"   MW: {peptide['molecular_weight']:.1f} Da")
            print(f"   Score: {peptide['composite_score']:.2%}")
            print(f"   Activity: {peptide['activity_scores']}")

# 2. RL 优化
def optimize_peptide():
    url = f"{BASE_URL}/ai/peptide/optimize"
    payload = {
        "seed_sequence": "VLGYT",
        "optimization_goals": {"ACE_inhibitory": 0.6, "permeability": 0.4},
        "iterations": 10
    }
    
    resp = requests.post(url, headers=headers, json=payload)
    data = resp.json()
    
    if data["success"]:
        best = data["data"]["optimized_peptides"][0]
        print(f"最优序列: {best['sequence']}")
        print(f"得分: {best['weighted_score']:.2%}")
        print(f"改进幅度: {best['improvement_over_seed']:+.2%}")

# 3. 服务状态检查
def check_status():
    url = f"{BASE_URL}/ai/peptide/status"
    resp = requests.get(url, headers=headers)
    status = resp.json()
    
    print(f"服务状态: {'✅ 可用' if status['available'] else '❌ 不可用'}")
    print(f"模式: {'模拟' if status['simulation_mode'] else '实际'}")
    print(f"设备: {status['device']}")

if __name__ == "__main__":
    check_status()
    generate_peptides()
    optimize_peptide()
```

---

## 故障排查

### 常见问题

#### Q1: 返回 503 Service Unavailable
**原因**: PepINVERT 依赖未安装或配置错误  
**解决**:
```bash
# 检查依赖
python -c "import torch; import rdkit; print('OK')"

# 如果失败，请安装：
pip install torch rdkit-pypi transformers
```

#### Q2: 生成的肽质量不高
**原因**: 当前处于模拟模式（依赖未完全安装）  
**解决**:
1. 安装完整依赖（见上方）
2. 下载预训练模型到 `models/` 目录
3. 重启服务

#### Q3: GPU 内存不足
**原因**: 模型加载超出显存限制  
**解决**:
```bash
# 设置环境变量强制使用 CPU
export PEPINVENT_DEVICE=cpu
# Windows: set PEPINVENT_DEVICE=cpu
```

#### Q4: 响应时间过长
**原因**: 复杂计算或网络延迟  
**建议**:
- 减小 `max_candidates` 或 `sample_size`
- 降低 `iterations` 数量
- 使用异步调用模式

#### Q5: 缓存导致结果不更新
**解决**: 调用清除缓存接口
```bash
curl -X DELETE http://localhost:8000/api/v1/ai/peptide/cache \
  -H "Authorization: Bearer TOKEN"
```

---

## 架构说明

### 模块层次

```
前端 (React)
  └─ AdvancedPeptideDesign.tsx
       └─ aiApi.generatePeptides() [frontend/src/api/ai.ts]

API 层 (FastAPI)
  └─ /api/v1/ai/peptide/* [backend/app/api/pepinvent.py]

服务层 (Business Logic)
  └─ PepinventService [backend/app/services/ai_models/pepinvent_service.py]
       ├─ 功效映射
       ├─ 结果格式化
       └─ 缓存管理

适配器层 (Adapter)
  └─ PepinventAdapter [backend/app/services/ai_models/pepinvent_adapter.py]
       ├─ 模型管理（懒加载）
       ├─ 采样/优化/性质计算
       └─ 模拟模式回退

配置层 (Config)
  └─ PepinventConfig [backend/config/pepinvent_config.py]
       └─ 环境变量 → 参数解析
```

### 设计原则

1. **优雅降级**: 依赖不可用时自动切换到模拟模式
2. **向后兼容**: 新增参数不影响现有功能
3. **模块化**: 各层职责清晰，易于替换和扩展
4. **可观测性**: 详细日志和状态端点便于调试

---

## 更新日志

### v1.0.0 (2026-05-03)
- ✅ 初始版本发布
- ✅ 肽序列生成、RL 优化、探索性采样
- ✅ 理化性质计算和多样性评估
- ✅ 前端组件集成
- ✅ 完整的单元测试覆盖
- ✅ Swagger/OpenAPI 文档

---

## 许可证

本项目遵循 RMFOOD 平台主许可证。
PepINVERT 核心算法遵循 Apache 2.0 许可证（[MolecularAI/PepINVENT](https://github.com/MolecularAI/PepINVENT)）。
