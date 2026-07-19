"""
databases 模块共享路由器
"""
from fastapi import APIRouter

# 共享 router 实例，所有子模块向此 router 注册端点
router = APIRouter(prefix="/databases", tags=["数据库检索"])
