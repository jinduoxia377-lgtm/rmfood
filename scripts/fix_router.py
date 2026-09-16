#!/usr/bin/env python3
"""Write compliance_router.py with correct UTF-8 encoding."""
import sys
path = "D:/RMFOODFP/backend/app/api/v1/compliance_router.py"
content = (
    '"""\n'
    '实时合规检查 API\n'
    '\n'
    '提供配方合规性实时检查和自动修复功能，\n'
    '供前端在配方编辑时即时反馈。\n'
    '"""\n'
    'import logging\n'
    'from typing import List, Optional\n'
    "\n"
    'from fastapi import APIRouter, Depends, Query\n'
    'from pydantic import BaseModel, Field\n'
    'from sqlalchemy.ext.asyncio import AsyncSession\n'
    "\n"
    'from app.services.compliance import get_compliance_service\n'
    'from app.services.food_homology_service import get_food_homology_service\n'
    'from app.api.deps import get_db_session\n'
    'from app.api.deps import get_current_user\n'
    "\n"
    '# 新增：查询类端点数据提供者\n'
    'from app.services.compliance.data_providers import (\n'
    "    get_limits_data,\n"
    "    get_prohibited_data,\n"
    "    get_gb2760_data,\n"
    "    get_gb14880_data,\n"
    "    get_gb_prohibited_data,\n"
    "    get_standards_data,\n"
    ")\n"
    "\n"
    "logger = logging.getLogger(__name__)\n"
    "\n"
    "router = APIRouter(prefix='/compliance', tags=['合规检查'])\n"
    "\n"
    "\n"
    "class IngredientInput(BaseModel):\n"
    "    name: str = Field(..., description='成分名称')\n"
    "    dosage_mg: float = Field(..., ge=0, description='用量（mg/天）')\n"
    "\n"
    "\n"
    "class RealtimeCheckRequest(BaseModel):\n"
    "    current_ingredients: List[IngredientInput] = Field(\n"
    "        ..., description='当前配方成分列表'\n"
    "    )\n"
    "    new_ingredient: Optional[IngredientInput] = Field(\n"
    "        None, description='即将变更的成分（用于增量检查）'\n"
    "    )\n"
    "    population: str = Field('adults', pattern='^(adults|children|elderly)$')\n"
    "\n"
    "\n"
    "class BulkCheckRequest(BaseModel):\n"
    "    ingredients: List[IngredientInput]\n"
    "    population: str = 'adults'\n"
    "\n"
    "\n"
    "@router.get('/food-homology', summary='查询药食同源目录完整信息')\n"
    "async def get_food_homology(\n"
    "    name: Optional[str] = Query(default=None, description='按名称搜索'),\n"
    "    db: AsyncSession = Depends(get_db_session),\n"
    "    current_user = Depends(get_current_user),\n"
    "):\n"
    "    service = get_food_homology_service()\n"
    "    materials = await service.get_materials(db, name=name)\n"
    "    return {'success': True, 'data': materials}\n"
    "\n"
    "\n"
    "@router.get('/food-homology/search', summary='搜索药食同源药材')\n"
    "async def search_food_homology(\n"
    "    keyword: str = Query(..., description='搜索关键词'),\n"
    "    db: AsyncSession = Depends(get_db_session),\n"
    "    current_user = Depends(get_current_user),\n"
    "):\n"
    "    service = get_food_homology_service()\n"
    "    result = await service.get_materials(db, name=keyword)\n"
    "    return {'success': True, 'data': result}\n"
    "\n"
    "\n"
    "@router.get('/limits', summary='查询药食同源目录日用量上限')\n"
    "async def get_limits(current_user = Depends(get_current_user)):\n"
    "    data = get_limits_data()\n"
    "    return {'success': True, 'data': data}\n"
    "\n"
    "\n"
    "@router.get('/prohibited', summary='查询十八反十九畏禁忌搭配')\n"
    "async def get_prohibited(current_user = Depends(get_current_user)):\n"
    "    data = get_prohibited_data()\n"
    "    return {'success': True, 'data': data}\n"
    "\n"
    "\n"
    "@router.get('/gb2760', summary='查询 GB 2760 食品添加剂使用标准')\n"
    "async def get_gb2760(current_user = Depends(get_current_user)):\n"
    "    data = get_gb2760_data()\n"
    "    return {'success': True, 'data': data}\n"
    "\n"
    "\n"
    "@router.get('/gb14880', summary='查询 GB 14880 营养强化剂使用标准')\n"
    "async def get_gb14880(current_user = Depends(get_current_user)):\n"
    "    data = get_gb14880_data()\n"
    "    return {'success': True, 'data': data}\n"
    "\n"
    "\n"
    "@router.get('/gb-prohibited', summary='查询中国食品安全法规禁用品清单')\n"
    "async def get_gb_prohibited(current_user = Depends(get_current_user)):\n"
    "    data = get_gb_prohibited_data()\n"
    "    return {'success': True, 'data': data}\n"
    "\n"
    "\n"
    "@router.get('/standards', summary='查询食品安全国家标准目录')\n"
    "async def get_standards(\n"
    "    category: Optional[str] = Query(default=None, description='按类别筛选'),\n"
    "    current_user = Depends(get_current_user),\n"
    "):\n"
    "    data = get_standards_data(category)\n"
    "    return {'success': True, 'data': data}\n"
)
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print(f'Written {len(content)} bytes to {path}')
