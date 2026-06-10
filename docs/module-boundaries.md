# RMFOOD 项目模块边界定义

## 前端模块体系

```
@/components/ai/               # AI 功能总入口
├── ChatTab/                   # 智能对话 (第1优先级)
│   ├── ChatTab.tsx
│   ├── hooks/                 # 对话专属 hooks
│   ├── services/              # 对话专属 services
│   └── components/            # 对话专属 UI
│
├── Generate/                  # 配方生成 (第2优先级)
│   ├── GenerateTab.tsx
│   ├── NeuralGeneratePanel.tsx
│   └── ...
│
├── Safety/                    # 安全检查
│   ├── SafetyTab.tsx
│   └── ...
│
├── Peptide/                   # 肽分析
│   ├── AdvancedPeptideAnalyzer.tsx
│   ├── AdvancedPeptideDesign.tsx
│   └── ...
│
├── shared/                    # 共享组件
│   ├── charts/                # 图表库
│   │   ├── RadarChart.tsx
│   │   ├── BarChart.tsx
│   │   └── ScoreCards.tsx
│   ├── ui/                    # UI 基础组件
│   │   ├── PageHeader.tsx
│   │   ├── Badge.tsx
│   │   └── Tabs.tsx
│   └── utils/                 # 工具函数
│
└── engines/                   # AI 引擎 (纯逻辑)
    ├── chatService.ts
    ├── hybridNLPEngineV2.ts
    ├── promptEngineeringFramework.ts
    └── ...
```

## 后端模块体系

```
backend/app/services/ai/       # AI 服务层
├── chat_engine.py             # 对话引擎 (入口)
├── provider_factory.py        # LLM 提供商工厂
├── generation_service.py      # 旧生成服务 (保留兼容)
├── algorithms/                # 算法库
│   ├── bayesian_formula_optimizer.py
│   ├── genetic_formula_optimizer.py
│   ├── neural_formula_network.py
│   ├── knowledge_graph_service.py
│   ├── multimodal_engine.py
│   └── super_intelligence_ensembler.py
└── prompts/                   # 提示词模板
```

## 已识别的清理项 (不破坏功能)

| 项目 | 说明 | 风险 |
|------|------|------|
| `api/ai.py` ↗ `ai_router.py` | 两个AI路由，保留完整功能 | 🟢 无风险 |
| `services/peptide_analysis_service.py` + `_optimized` | 保留优化版 | 🟢 无风险 |
| `features/services/` 43文件 | 保留不动，仅文档标记 | 🟢 无风险 |
