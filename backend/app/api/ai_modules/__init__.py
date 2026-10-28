"""
AI 智能服务 API
配方生成、协同分析、安全检查、口感预测、稳定性预测、智能对话
"""
import datetime
import logging
import os
import time
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


from ...models import FormulaStatus, User
from ...services.ai import ai_service
from ..deps import get_current_active_user, get_current_user, get_db_session, require_role

# 延迟导入 LLM 服务（避免初始化阻塞）
_llm_service_instance = None
def _get_llm_service():
    global _llm_service_instance
    if _llm_service_instance is None:
        from ...services.llm_service import llm_service as _ls
        _llm_service_instance = _ls
    return _llm_service_instance

router = APIRouter(prefix="/ai", tags=["AI智能服务"])

# Sub-routers
from .chat import sub_router as chat_router
from .demo import router as demo_router
from .experiment import sub_router as experiment_router
from .formula_intelligence import sub_router as formula_intelligence_router
from .generation_v2 import router as generation_router
from .genetic import sub_router as genetic_router
from .models_and_tools import sub_router as models_router
from .optimization import sub_router as optimization_router
from .recommendations import sub_router as recommendations_router
from .utility_endpoints import sub_router as utility_router
from .versions import sub_router as versions_router

router.include_router(generation_router)
router.include_router(chat_router)
router.include_router(models_router)
router.include_router(recommendations_router)
router.include_router(optimization_router)
router.include_router(versions_router)
router.include_router(experiment_router)
router.include_router(genetic_router)
router.include_router(demo_router)
router.include_router(utility_router)
router.include_router(formula_intelligence_router)
