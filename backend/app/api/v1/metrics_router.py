from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/metrics", tags=["metrics"])

class ClientPerfReport(BaseModel):
    """客户端性能报告 — 与前端 utils/performance.ts buildReportPayload 对齐"""
    # 允许前端传入额外字段（device/env 等），避免 422
    model_config = ConfigDict(extra="allow")

    timestamp: str
    sessionId: str
    userIdentifier: Optional[str] = None
    pageUrl: Optional[str] = None
    pagePath: Optional[str] = None
    pageLoadTime: Optional[float] = None
    # 前端实际为数组；保留为 List 以兼容
    metrics: List[Any] = []
    customMetrics: Optional[Dict[str, Any]] = None
    device: Optional[Dict[str, Any]] = None
    performance: Optional[Dict[str, Any]] = None
    env: Optional[Dict[str, Any]] = None
    # 兼容旧字段
    page: Optional[str] = None
    navigation: Optional[Dict[str, Any]] = None
    memory: Optional[Dict[str, Any]] = None

@router.post("/client-perf", summary="客户端性能指标上报")
async def client_perf_report(request: Request, report: ClientPerfReport):
    """
    接收客户端性能指标上报
    """
    try:
        page = report.pagePath or report.page or "unknown"
        session = (report.sessionId or "anon")[:8]
        logger.info(f"[Perf] 收到客户端性能报告: page={page}, session={session}, metrics={len(report.metrics or [])}")

        return {"status": "success", "message": "指标已接收"}
    except Exception as e:
        logger.error(f"[Perf] 处理性能报告失败: {e}")
        return {"status": "error", "message": "处理失败"}
