"""
AI 智能服务 API 入口 - 重组版

原 ai.py (1843行) 已拆分为 7 个子模块:
- generation.py: /health, /generate/advanced, /safety-check, /synergy-analysis
- chat.py: /chat, /chat/stream
- models_and_tools.py: /taste-predict, /stability, /peptide-score, /models/status, /models/config
- recommendations.py: /analyze/formula, /recommendations
- versions.py: /formula/versions/{id}, /formula/versions/{id}/rollback, /share/{code}, /share/{code}/track
- optimization.py: /optimize/suggestions, /recommend/formulas, /predict/trends
- experiment.py: /analyze/experiment

所有子模块共享同一个 router 实例（来自 ai_modules/__init__.py）。
"""
from .ai_modules import generation  # noqa: F401
from .ai_modules import chat  # noqa: F401
from .ai_modules import models_and_tools  # noqa: F401
from .ai_modules import recommendations  # noqa: F401
from .ai_modules import versions  # noqa: F401
from .ai_modules import optimization  # noqa: F401
from .ai_modules import experiment  # noqa: F401

# Re-export the shared router for main.py to include
from .ai_modules import router  # noqa: F401
