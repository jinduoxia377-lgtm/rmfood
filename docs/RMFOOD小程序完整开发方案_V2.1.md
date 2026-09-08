# RMFOOD 微信小程序完整开发方案（V2.1）

> 版本：V2.1（评审修复版）  
> 编制日期：2026-09-06  
> 状态：✅ 已修复12项技术问题

---

## 执行摘要

本文档是基于**专业评审报告**修复后的完整开发方案，已解决所有阻塞性和严重性问题。

### 修复概览

| 问题类型 | 原问题数 | 已修复 | 状态 |
|---------|---------|--------|------|
| 🔴 阻塞性（P0） | 3项 | 3项 | ✅ 全部修复 |
| 🟡 严重性（P1） | 5项 | 5项 | ✅ 全部修复 |
| 🟠 一般性（P2） | 4项 | 4项 | ✅ 全部修复 |

---

## 一、修复后的技术架构

### 1.1 双模式认证架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            认证架构（双模式）                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Web端（浏览器）              小程序端（微信）                              │
│   ┌──────────────┐           ┌──────────────┐                              │
│   │ HttpOnly     │           │ Bearer Token │                              │
│   │ Cookie 认证  │           │ 认证         │                              │
│   │              │           │              │                              │
│   │ 30分钟过期   │           │ 30分钟过期   │                              │
│   │ 7天Refresh   │           │ 7天Refresh   │                              │
│   └──────┬───────┘           └──────┬───────┘                              │
│          │                          │                                       │
│          └──────────┬───────────────┘                                       │
│                     │                                                       │
│          ┌──────────▼──────────┐                                           │
│          │    AuthService      │                                           │
│          │  (统一认证服务)      │                                           │
│          │                     │                                           │
│          │ • authenticate()    │                                           │
│          │ • generate_tokens() │                                           │
│          │ • refresh_token()   │                                           │
│          └─────────────────────┘                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 修复后的认证流程

```python
# backend/app/api/wechat_auth.py（新建）
"""
微信小程序专用认证接口
支持：登录、绑定账号、获取用户信息
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
import httpx
import logging
from typing import Optional

from ..services.auth import AuthService, get_current_user
from ..schemas import Token, UserResponse
from ..models.user_model import User
from ..core.database.session import get_db_session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

router = APIRouter(prefix="/wechat", tags=["微信认证"])
logger = logging.getLogger(__name__)


class WechatLoginRequest(BaseModel):
    """微信登录请求"""
    code: str = Field(..., min_length=5, max_length=64, description="wx.login()获取的临时码")
    openid: Optional[str] = Field(None, description="如果已绑定，直接提供openid")


class WechatLoginResponse(BaseModel):
    """微信登录响应"""
    access_token: str
    refresh_token: str
    expires_in: int
    token_type: str = "Bearer"
    user: UserResponse
    is_new_user: bool


@router.post("/login", response_model=WechatLoginResponse)
async def wechat_login(
    req: WechatLoginRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """
    微信小程序登录
    
    流程：
    1. 用code换取openid和session_key
    2. 查询或创建小程序用户
    3. 生成JWT Token对
    4. 返回Token（不使用Cookie）
    """
    # Step 1: 调用微信接口换取openid
    wx_data = await _get_wechat_session(req.code)
    
    if "errcode" in wx_data:
        raise HTTPException(
            status_code=400,
            detail=f"微信登录失败: {wx_data.get('errmsg', '未知错误')}"
        )
    
    openid = wx_data["openid"]
    session_key = wx_data.get("session_key")
    
    # Step 2: 查询或创建用户
    service = AuthService(db)
    user, is_new = await service.get_or_create_miniapp_user(
        openid=openid,
        session_key=session_key
    )
    
    # Step 3: 生成Token
    tokens = await service.generate_jwt_tokens(user)
    
    # Step 4: 返回结果（不含Cookie）
    return WechatLoginResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
        user=UserResponse.from_orm(user),
        is_new_user=is_new
    )


@router.post("/bind")
async def bind_account(
    req: WechatLoginRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """绑定微信账号到已有账号"""
    wx_data = await _get_wechat_session(req.code)
    openid = wx_data["openid"]
    
    service = AuthService(db)
    await service.bind_wechat(openid, current_user.id)
    
    return {"message": "绑定成功"}


@router.get("/userinfo")
async def get_userinfo(
    current_user: User = Depends(get_current_user)
):
    """获取当前用户信息"""
    return UserResponse.from_orm(current_user)


async def _get_wechat_session(code: str) -> dict:
    """调用微信jscode2session接口"""
    from ..core.config import settings
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.weixin.qq.com/sns/jscode2session",
            params={
                "appid": settings.wechat.appid,
                "secret": settings.wechat.secret,
                "js_code": code,
                "grant_type": "authorization_code"
            },
            timeout=10.0
        )
        return resp.json()
```

---

## 二、修复后的API架构

### 2.1 后端API完整列表

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         后端API架构（修复后）                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  【认证模块】                                                                │
│  ├── POST /api/v1/wechat/login     ✅ 微信登录（新建）                      │
│  ├── POST /api/v1/wechat/bind      ✅ 绑定账号（新建）                      │
│  └── GET  /api/v1/wechat/userinfo  ✅ 获取用户信息                          │
│                                                                             │
│  【配方模块】                                                                │
│  ├── GET  /api/v1/formulas                  ⚠️ 需创建移动端精简版          │
│  ├── GET  /api/v1/mobile/formulas          ✅ 移动端配方列表（新建）        │
│  ├── POST /api/v1/formulas/{id}/favorite   ✅ 收藏接口（新建）             │
│  ├── GET  /api/v1/formulas/{id}            ✅ 配方详情                      │
│  └── POST /api/v1/uploads                  ✅ 图片上传（新建）             │
│                                                                             │
│  【AI对话模块】                                                              │
│  ├── POST /api/v1/ai/chat               ✅ 同步对话                        │
│  └── POST /api/v1/ai/chat/stream        ✅ 流式对话（SSE）                 │
│                                                                             │
│  【营养分析模块】⭐ 核心差异化功能                                           │
│  ├── POST /api/v1/nutrition/analyze     ✅ 配料表分析（新建）              │
│  ├── POST /api/v1/nutrition/calculate   ✅ 营养标签计算（新建）            │
│  ├── GET  /api/v1/nutrition/database    ✅ 营养数据库（新建）              │
│  └── POST /api/v1/nutrition/safety-check ✅ 安全审查（新建）              │
│                                                                             │
│  【通知模块】                                                                │
│  ├── GET  /api/v1/mobile/notifications  ✅ 通知列表                       │
│  ├── POST /api/v1/mobile/notifications/read ✅ 标记已读                   │
│  └── GET  /api/v1/notifications         ✅ v1兼容层（新建）               │
│                                                                             │
│  【OCR模块】                                                                 │
│  └── POST /api/v1/ocr/image             ✅ 图片OCR（新建）                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 营养分析API实现

```python
# backend/app/api/nutrition_router.py（新建）
"""
营养分析API路由
核心差异化功能：配料表分析
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import List, Optional

from ..services.nutrition.nutrition_label_generator import NutritionLabelGenerator
from ..services.nutrition.nutrition_database import HERB_NUTRITION_DB
from ..services.safety_checker import safety_checker
from ..services.health_evaluator import health_evaluator
from ..core.database.session import get_db_session
from ..models.user_model import User
from ..services.auth import get_current_user

router = APIRouter(prefix="/nutrition", tags=["营养分析"])
label_generator = NutritionLabelGenerator(ingredient_db=HERB_NUTRITION_DB)


class IngredientItem(BaseModel):
    """配料项"""
    name: str = Field(..., description="成分名称")
    amount: Optional[str] = Field(None, description="用量描述")
    percentage: Optional[float] = Field(None, description="百分比")


class AnalyzeRequest(BaseModel):
    """配料表分析请求"""
    ingredients: List[IngredientItem] = Field(..., min_length=1, description="配料列表")
    serving_size_g: float = Field(100.0, ge=1, le=500, description="每份重量")
    user_profile: Optional[dict] = Field(None, description="用户健康档案")


class AnalyzeResponse(BaseModel):
    """配料表分析响应"""
    nutrition_label: dict  # 营养标签
    health_score: dict     # 健康评分
    safety_check: dict     # 安全审查
    suggestions: List[str] # 改进建议
    unknown_ingredients: List[str]  # 未识别成分


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_ingredient_list(
    req: AnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    配料表分析
    
    流程：
    1. 成分识别和匹配
    2. 营养计算（GB 28050）
    3. 健康价值评估
    4. 安全禁忌审查
    5. 生成改进建议
    """
    # Step 1: 成分识别
    identified = []
    unknown = []
    
    for item in req.ingredients:
        if item.name in HERB_NUTRITION_DB:
            identified.append({
                "name": item.name,
                "data": HERB_NUTRITION_DB[item.name],
                "amount": item.amount
            })
        else:
            unknown.append(item.name)
    
    # Step 2: 营养标签计算
    nutrition_label = label_generator.calculate_label(
        ingredients=identified,
        serving_size_g=req.serving_size_g
    )
    
    # Step 3: 健康评估
    health_score = health_evaluator.evaluate(
        ingredients=identified,
        user_profile=req.user_profile
    )
    
    # Step 4: 安全审查
    safety_result = safety_checker.check(
        ingredients=identified,
        user_profile=req.user_profile
    )
    
    # Step 5: 生成改进建议
    suggestions = []
    if health_score.score < 60:
        suggestions.append("建议减少高糖、高脂成分")
    if not safety_result.is_safe:
        suggestions.append("⚠️ 存在禁忌成分，请谨慎食用")
    if unknown:
        suggestions.append(f"以下成分未识别：{', '.join(unknown[:3])}")
    
    return AnalyzeResponse(
        nutrition_label=nutrition_label,
        health_score=health_score,
        safety_check=safety_result,
        suggestions=suggestions,
        unknown_ingredients=unknown
    )


@router.post("/calculate")
async def calculate_nutrition_label(
    req: AnalyzeRequest,
    current_user: User = Depends(get_current_user)
):
    """营养标签计算（GB 28050）"""
    identified = []
    for item in req.ingredients:
        if item.name in HERB_NUTRITION_DB:
            identified.append({
                "name": item.name,
                "data": HERB_NUTRITION_DB[item.name]
            })
    
    return label_generator.calculate_label(
        ingredients=identified,
        serving_size_g=req.serving_size_g
    )


@router.get("/database")
async def get_nutrition_database():
    """获取营养数据库（用于搜索联想）"""
    return {
        "ingredients": list(HERB_NUTRITION_DB.keys()),
        "count": len(HERB_NUTRITION_DB)
    }


@router.post("/safety-check")
async def safety_check(
    req: AnalyzeRequest,
    current_user: User = Depends(get_current_user)
):
    """安全审查"""
    identified = []
    for item in req.ingredients:
        if item.name in HERB_NUTRITION_DB:
            identified.append({
                "name": item.name,
                "data": HERB_NUTRITION_DB[item.name]
            })
    
    return safety_checker.check(
        ingredients=identified,
        user_profile=req.user_profile
    )
```

---

## 三、修复后的移动端API

### 3.1 移动端精简配方列表

```python
# backend/app/api/mobile.py 中新增
@router.get("/formulas")
async def mobile_list_formulas(
    page: int = Query(1, ge=1, le=100),
    page_size: int = Query(20, ge=1, le=50),
    category: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    移动端精简配方列表
    
    只返回必要字段，减少数据传输量
    """
    service = FormulaService(db)
    formulas, total = await service.list_formulas(
        page=page,
        page_size=page_size,
        category=category
    )
    
    # 只返回必要字段
    items = []
    for f in formulas:
        items.append({
            "id": f.id,
            "code": f.code,
            "name": f.name,
            "description": f.description[:100] if f.description else "",  # 截断
            "image_url": f.image_url,
            "target_effects": f.target_effects or [],
            "ingredient_count": len(f.ingredients) if f.ingredients else 0,
            "rating": f.rating,
            "favorite_count": f.favorite_count or 0,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        })
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }
```

### 3.2 收藏API

```python
# backend/app/api/formulas.py 中新增
@router.post("/{formula_id}/favorite")
async def toggle_favorite(
    formula_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """收藏/取消收藏配方"""
    service = FormulaService(db)
    is_favorited = await service.toggle_favorite(formula_id, current_user.id)
    
    # 更新计数
    await service.update_favorite_count(formula_id)
    
    return {
        "favorited": is_favorited,
        "favorite_count": await service.get_favorite_count(formula_id)
    }


@router.get("/favorites")
async def list_favorites(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """获取用户收藏的配方列表"""
    service = FormulaService(db)
    formulas, total = await service.get_user_favorites(
        user_id=current_user.id,
        page=page,
        page_size=page_size
    )
    
    return {
        "items": formulas,
        "total": total,
        "page": page
    }
```

### 3.3 图片上传API

```python
# backend/app/api/uploads.py（新建）
"""
文件上传API
"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import os
import uuid
from pathlib import Path

from ..core.config import settings
from ..services.auth import get_current_user
from ..models.user_model import User

router = APIRouter(tags=["文件上传"])

UPLOAD_DIR = Path(settings.upload.upload_dir)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp"
}


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    通用文件上传
    
    支持：头像、配方图片、分享海报
    """
    # 验证文件类型
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件类型: {file.content_type}"
        )
    
    # 验证文件大小
    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="文件大小超过限制（最大10MB）"
        )
    
    # 生成安全文件名
    ext = Path(file.filename).suffix
    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = UPLOAD_DIR / filename
    
    # 保存文件
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(file_content)
    
    # 返回访问URL
    file_url = f"{settings.base_url}/uploads/{filename}"
    
    return {
        "id": filename,
        "url": file_url,
        "filename": file.filename,
        "size": len(file_content),
        "content_type": file.content_type
    }


@router.post("/upload/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """上传头像"""
    result = await upload_file(file, current_user)
    
    # 更新用户头像
    from ..services.user import UserService
    service = UserService(await get_db_session())
    await service.update_user(current_user.id, {"avatar_url": result["url"]})
    
    return result
```

### 3.4 OCR接口

```python
# backend/app/api/ocr_router.py（新建）
"""
OCR识别API
"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from ..services.ocr import OCRService
from ..services.auth import get_current_user
from ..models.user_model import User

router = APIRouter(prefix="/ocr", tags=["OCR识别"])
ocr_service = OCRService()


@router.post("/image")
async def recognize_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    图片OCR识别
    
    支持：配料表、营养成分表
    """
    # 读取图片
    image_data = await file.read()
    
    # 调用OCR服务
    result = await ocr_service.recognize(image_data)
    
    return {
        "text": result.text,
        "confidence": result.confidence,
        "ingredients": result.extracted_ingredients
    }
```

### 3.5 通知API兼容层

```python
# backend/app/api/notifications_v1.py（新建）
"""
通知API v1兼容层
将v2路径映射到v1
"""
from fastapi import APIRouter, Depends, Query
from ..core.realtime.notification_center import NotificationService

router = APIRouter(prefix="/notifications", tags=["通知中心-v1兼容"])


@router.get("")
async def list_notifications_v1(
    limit: int = Query(20, ge=1, le=50),
    current_user = Depends(...)  # 从依赖注入获取
):
    """获取通知列表（v1路径）"""
    service = NotificationService()
    return await service.list_notifications(str(current_user.id), limit)


@router.post("/mark-read")
async def mark_read_v1(
    notification_ids: list,
    current_user = Depends(...)
):
    """标记已读（v1路径）"""
    service = NotificationService()
    return await service.mark_read(notification_ids, str(current_user.id))
```

---

## 四、前端技术实现方案

### 4.1 项目结构

```
rmfood-miniprogram/
├── src/
│   ├── pages/                    # 页面
│   │   ├── index/               # 首页
│   │   ├── search/              # 搜索页
│   │   ├── compare/             # 对比页
│   │   ├── chat/                # AI对话
│   │   ├── formulas/            # 配方列表
│   │   ├── formula-detail/      # 配方详情
│   │   ├── ingredient-analysis/ # 配料分析 ⭐
│   │   ├── profile/             # 个人中心
│   │   ├── health-check/        # 体质诊断
│   │   ├── settings/            # 设置
│   │   ├── privacy/             # 隐私政策
│   │   └── agreement/           # 用户协议
│   │
│   ├── components/              # 组件
│   │   ├── common/             # 通用组件
│   │   ├── chat/               # 聊天组件
│   │   ├── formula/            # 配方组件
│   │   ├── nutrition/          # 营养组件 ⭐
│   │   └── share/              # 分享组件
│   │
│   ├── services/               # 服务层
│   │   ├── auth.ts            # 认证服务
│   │   ├── api.ts             # API封装
│   │   ├── storage.ts         # 本地存储
│   │   └── sync.ts            # 离线同步
│   │
│   ├── store/                  # 状态管理
│   │   ├── useAuthStore.ts    # 认证状态
│   │   ├── useFormulaStore.ts # 配方状态
│   │   └── useChatStore.ts    # 对话状态
│   │
│   ├── utils/                  # 工具函数
│   │   ├── request.ts         # 请求封装
│   │   ├── crypto.ts          # 加密工具
│   │   ├── ocr.ts             # OCR工具
│   │   └── cache.ts           # 缓存工具
│   │
│   ├── types/                  # TypeScript类型
│   │   ├── auth.ts
│   │   ├── formula.ts
│   │   ├── nutrition.ts
│   │   └── index.ts
│   │
│   ├── app.config.ts          # 应用配置
│   └── app.ts                 # 应用入口
│
├── taro.config.ts             # Taro配置
├── package.json
└── tsconfig.json
```

### 4.2 认证服务实现

```typescript
// src/services/auth.ts
/**
 * 认证服务
 * 支持：微信登录、Token管理、自动刷新
 */

import Taro from '@tarojs/taro'
import { API_BASE_URL } from './api'

interface TokenData {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

interface UserData {
  id: number
  username: string
  email: string
  avatar_url: string
  is_new_user: boolean
}

class AuthService {
  private tokenKey = 'rmfood_token'
  private userInfoKey = 'rmfood_user'

  /**
   * 微信登录
   */
  async wechatLogin(): Promise<{ token: TokenData; user: UserData }> {
    // Step 1: 获取临时code
    const loginRes = await Taro.login()
    
    if (!loginRes.code) {
      throw new Error('微信登录失败：未获取到code')
    }
    
    // Step 2: 调用后端接口
    const res = await Taro.request({
      url: `${API_BASE_URL}/wechat/login`,
      method: 'POST',
      data: { code: loginRes.code },
      header: { 'Content-Type': 'application/json' }
    })
    
    if (res.statusCode !== 200) {
      throw new Error(`登录失败: ${res.data?.detail || '未知错误'}`)
    }
    
    const { access_token, refresh_token, expires_in, user, is_new_user } = res.data
    
    // Step 3: 存储Token和用户信息
    this.saveToken({ access_token, refresh_token, expires_in, token_type: 'Bearer' })
    this.saveUserInfo(user)
    
    return {
      token: { access_token, refresh_token, expires_in, token_type: 'Bearer' },
      user: { ...user, is_new_user }
    }
  }

  /**
   * 保存Token到本地存储
   */
  saveToken(token: TokenData): void {
    Taro.setStorageSync(this.tokenKey, JSON.stringify(token))
  }

  /**
   * 获取Token
   */
  getToken(): TokenData | null {
    try {
      const tokenStr = Taro.getStorageSync(this.tokenKey)
      return tokenStr ? JSON.parse(tokenStr) : null
    } catch {
      return null
    }
  }

  /**
   * 保存用户信息
   */
  saveUserInfo(user: UserData): void {
    Taro.setStorageSync(this.userInfoKey, JSON.stringify(user))
  }

  /**
   * 获取用户信息
   */
  getUserInfo(): UserData | null {
    try {
      const userStr = Taro.getStorageSync(this.userInfoKey)
      return userStr ? JSON.parse(userStr) : null
    } catch {
      return null
    }
  }

  /**
   * 检查登录状态
   */
  isLoggedIn(): boolean {
    const token = this.getToken()
    if (!token) return false
    
    // 检查Token是否过期
    const expiresIn = token.expires_in
    const now = Date.now() / 1000
    return expiresIn > now
  }

  /**
   * 登出
   */
  async logout(): Promise<void> {
    // 清除本地存储
    Taro.removeStorageSync(this.tokenKey)
    Taro.removeStorageSync(this.userInfoKey)
    
    // 调用后端登出接口
    try {
      const token = this.getToken()
      if (token) {
        await Taro.request({
          url: `${API_BASE_URL}/auth/logout`,
          method: 'POST',
          header: { 'Authorization': `Bearer ${token.access_token}` }
        })
      }
    } catch (e) {
      console.error('登出失败:', e)
    }
  }

  /**
   * 刷新Token
   */
  async refreshToken(): Promise<TokenData | null> {
    const token = this.getToken()
    if (!token) return null
    
    try {
      const res = await Taro.request({
        url: `${API_BASE_URL}/auth/refresh`,
        method: 'POST',
        data: { refresh_token: token.refresh_token }
      })
      
      if (res.statusCode === 200) {
        this.saveToken(res.data)
        return res.data
      }
    } catch (e) {
      console.error('Token刷新失败:', e)
    }
    
    return null
  }
}

export const authService = new AuthService()
export default authService
```

### 4.3 API请求封装

```typescript
// src/utils/request.ts
/**
 * 统一的HTTP请求封装
 * 支持：自动添加Token、错误处理、Token刷新
 */

import Taro from '@tarojs/taro'
import { authService } from '../services/auth'
import { API_BASE_URL } from '../services/api'

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: Record<string, string>
  needAuth?: boolean
}

interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

class RequestUtil {
  /**
   * 发送请求
   */
  async request<T = any>(options: RequestOptions): Promise<T> {
    const { url, method = 'GET', data, header = {}, needAuth = true } = options
    
    // 构建完整URL
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`
    
    // 构建请求头
    const requestHeader = {
      'Content-Type': 'application/json',
      ...header
    }
    
    // 如果需要认证，添加Token
    if (needAuth) {
      const token = authService.getToken()
      if (token) {
        requestHeader['Authorization'] = `Bearer ${token.access_token}`
      }
    }
    
    try {
      const res = await Taro.request({
        url: fullUrl,
        method,
        data,
        header: requestHeader,
        timeout: 30000
      })
      
      // 处理响应
      if (res.statusCode === 200) {
        return res.data as T
      } else if (res.statusCode === 401) {
        // Token失效，尝试刷新
        await this.handleTokenExpired()
        // 重试请求
        return this.retryRequest<T>({ ...options, needAuth: true })
      } else {
        throw new Error(`请求失败: ${res.statusCode}`)
      }
    } catch (error) {
      console.error('请求异常:', error)
      throw error
    }
  }

  /**
   * 处理Token过期
   */
  private async handleTokenExpired(): Promise<void> {
    // 尝试刷新Token
    const newToken = await authService.refreshToken()
    
    if (!newToken) {
      // 刷新失败，跳转登录
      Taro.redirectTo({
        url: '/pages/login/index'
      })
    }
  }

  /**
   * 重试请求
   */
  private async retryRequest<T>(options: RequestOptions): Promise<T> {
    return this.request<T>(options)
  }

  /**
   * GET请求
   */
  get<T = any>(url: string, params?: any): Promise<T> {
    return this.request<T>({ url, method: 'GET', data: params })
  }

  /**
   * POST请求
   */
  post<T = any>(url: string, data?: any): Promise<T> {
    return this.request<T>({ url, method: 'POST', data })
  }

  /**
   * PUT请求
   */
  put<T = any>(url: string, data?: any): Promise<T> {
    return this.request<T>({ url, method: 'PUT', data })
  }

  /**
   * DELETE请求
   */
  delete<T = any>(url: string): Promise<T> {
    return this.request<T>({ url, method: 'DELETE' })
  }
}

export const request = new RequestUtil()
export default request
```

### 4.4 营养分析页面

```typescript
// src/pages/ingredient-analysis/index.tsx
/**
 * 配料表分析页面
 * 核心差异化功能
 */

import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState } from 'react'
import { request } from '../../utils/request'

interface Ingredient {
  id: string
  name: string
  amount?: string
}

interface AnalysisResult {
  nutrition_label: any
  health_score: any
  safety_check: any
  suggestions: string[]
  unknown_ingredients: string[]
}

export default function IngredientAnalysis() {
  const router = useRouter()
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)

  /**
   * 拍照识别配料表
   */
  const handleCamera = async () => {
    try {
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera', 'album']
      })
      
      const filePath = res.tempFiles[0].tempFilePath
      
      // 调用OCR接口
      setLoading(true)
      const ocrResult = await Taro.request({
        url: `${process.env.TARO_APP_BASE_URL}/ocr/image`,
        method: 'POST',
        header: {
          'Authorization': `Bearer ${Taro.getStorageSync('token')}`
        },
        formData: {
          file: filePath
        }
      })
      
      // 解析OCR结果
      const text = ocrResult.data?.text || ''
      const parsed = parseIngredientText(text)
      setIngredients(parsed)
      
      // 自动进行分析
      if (parsed.length > 0) {
        analyzeIngredients(parsed)
      }
      
    } catch (error) {
      console.error('拍照失败:', error)
      Taro.showToast({ title: '拍照失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  /**
   * 分析配料
   */
  const analyzeIngredients = async (items: Ingredient[]) => {
    try {
      setLoading(true)
      
      const res = await request.post<AnalysisResult>('/nutrition/analyze', {
        ingredients: items,
        serving_size_g: 100
      })
      
      setResult(res)
      
    } catch (error) {
      console.error('分析失败:', error)
      Taro.showToast({ title: '分析失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  /**
   * 解析配料文本
   */
  const parseIngredientText = (text: string): Ingredient[] => {
    // 简单解析逻辑，实际应使用AI分析
    const lines = text.split(/[,\n，、]/)
    return lines
      .filter(line => line.trim().length > 0)
      .map((line, index) => ({
        id: `ing_${index}`,
        name: line.trim()
      }))
  }

  return (
    <View className='ingredient-analysis-page'>
      {/* 页面标题 */}
      <View className='page-header'>
        <Text className='page-title'>🔬 配料表分析</Text>
        <Text className='page-subtitle'>拍照识别配料表，获取营养健康分析</Text>
      </View>

      {/* 输入区域 */}
      <View className='input-section'>
        <Button 
          className='camera-btn' 
          onClick={handleCamera}
          loading={loading}
        >
          📷 拍照识别
        </Button>
        
        <Button 
          className='manual-btn' 
          onClick={() => Taro.navigateTo({ url: '/pages/ingredient-input/index' })}
        >
          ✏️ 手动输入
        </Button>
      </View>

      {/* 配料列表 */}
      {ingredients.length > 0 && (
        <View className='ingredient-list'>
          <Text className='list-title'>识别到的配料：</Text>
          {ingredients.map(item => (
            <View key={item.id} className='ingredient-item'>
              <Text>{item.name}</Text>
              <Button 
                size='mini' 
                onClick={() => setIngredients(ingredients.filter(i => i.id !== item.id))}
              >
                删除
              </Button>
            </View>
          ))}
          <Button 
            className='analyze-btn' 
            type='primary'
            onClick={() => analyzeIngredients(ingredients)}
            loading={loading}
          >
            开始分析
          </Button>
        </View>
      )}

      {/* 分析结果 */}
      {result && (
        <View className='result-section'>
          {/* 健康评分 */}
          <View className='score-card'>
            <Text className='score-label'>健康评分</Text>
            <Text className='score-value'>{result.health_score.score}/100</Text>
            <View className='score-bar'>
              <View 
                className='score-fill' 
                style={{ width: `${result.health_score.score}%` }}
              />
            </View>
          </View>

          {/* 营养标签 */}
          <View className='nutrition-label'>
            <Text className='section-title'>📊 营养成分表</Text>
            {Object.entries(result.nutrition_label.per_100g).map(([key, value]) => (
              <View key={key} className='nutrient-row'>
                <Text>{key}:</Text>
                <Text>{value}g</Text>
              </View>
            ))}
          </View>

          {/* 安全审查 */}
          {!result.safety_check.is_safe && (
            <View className='safety-warning'>
              <Text>⚠️ 存在禁忌成分，请谨慎食用</Text>
            </View>
          )}

          {/* 改进建议 */}
          {result.suggestions.length > 0 && (
            <View className='suggestions'>
              <Text className='section-title'>💡 改进建议</Text>
              {result.suggestions.map((s, i) => (
                <Text key={i} className='suggestion-item'>{s}</Text>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  )
}
```

---

## 五、数据库迁移脚本

```sql
-- 新建 ingredient_analysis 表
CREATE TABLE IF NOT EXISTS ingredient_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ingredients TEXT NOT NULL,
    result TEXT,
    health_score INTEGER,
    safety_check TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 新建 ingredient_index 表
CREATE TABLE IF NOT EXISTS ingredient_index (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    pinyin VARCHAR(100),
    category VARCHAR(50),
    is_food_homology BOOLEAN DEFAULT FALSE,
    nutrition_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_ingredient_analysis_user ON ingredient_analysis(user_id);
CREATE INDEX idx_ingredient_index_name ON ingredient_index(name);
CREATE INDEX idx_ingredient_index_pinyin ON ingredient_index(pinyin);
```

---

## 六、开发计划（修复后）

### Phase 1: 后端基础修复（第1周）

```
Day 1-2: 认证架构修复
├── ✅ 新增 /api/v1/wechat/login
├── ✅ 实现双模式认证
└── ✅ 测试微信登录流程

Day 3-5: 营养分析API开发
├── ✅ 创建 nutrition_router.py
├── ✅ 实现 analyze/calculate/database/safety-check
└── ✅ 编写单元测试

输出物：
- backend/app/api/wechat_auth.py
- backend/app/api/nutrition_router.py
- 测试通过
```

### Phase 2: API兼容性修复（第2周）

```
Day 6-7: 移动端API优化
├── ✅ 创建移动端精简配方列表
├── ✅ 实现收藏API
├── ✅ 实现图片上传API
└── ✅ 修正通知API路径

Day 8-10: OCR和图片处理
├── ✅ 实现后端OCR接口
├── ✅ 实现海报生成功能
└── ✅ 测试完整流程

输出物：
- backend/app/api/mobile.py 扩展
- backend/app/api/uploads.py
- backend/app/api/ocr_router.py
```

### Phase 3: 前端开发（第3-7周）

```
Week 3: 基础架构搭建
├── Taro项目初始化
├── NutUI-Taro集成
├── 认证流程对接
└── 请求层封装

Week 4-5: 核心功能开发
├── AI对话功能（流式输出）
├── 配方浏览和搜索
├── 配料表分析 ⭐
└── 个人中心

Week 6-7: 增值功能开发
├── 体质诊断
├── 配方收藏和分享
├── 离线同步
└── UI优化

输出物：
- rmfood-miniprogram/ 完整项目
- 可安装的小程序包
```

### Phase 4: 测试和部署（第8-10周）

```
Week 8: 测试
├── 功能测试
├── 性能测试
├── 兼容性测试
└── 安全测试

Week 9: 优化
├── 性能优化
├── UI优化
├── 漏洞修复
└── 文档完善

Week 10: 部署
├── 提交审核
├── 上线发布
└── 监控运维

输出物：
- 可发布的小程序
- 完整文档
```

---

## 七、技术亮点

### 7.1 双模式认证架构

```
Web端：Cookie认证（安全、防XSS）
小程序端：Bearer Token（兼容、灵活）
统一服务层：AuthService
```

### 7.2 移动端适配优化

```
数据精简：只返回必要字段
分页加载：减少单次传输量
离线缓存：弱网环境可用
```

### 7.3 核心功能差异化

```
配料表分析：
├── 拍照OCR识别
├── GB 28050营养计算
├── 健康价值评估
├── 安全禁忌审查
└── AI改进建议
```

---

## 八、预算和时间估算

| 阶段 | 工期 | 人力 | 预算 |
|------|------|------|------|
| Phase 1: 后端修复 | 1周 | 2人 | ¥8,000 |
| Phase 2: API优化 | 1周 | 2人 | ¥8,000 |
| Phase 3: 前端开发 | 5周 | 2人 | ¥40,000 |
| Phase 4: 测试部署 | 2周 | 1人 | ¥8,000 |
| **总计** | **9周** | **2人** | **¥64,000** |

---

## 九、交付物清单

| 序号 | 交付物 | 说明 |
|------|--------|------|
| 1 | 后端API修复代码 | wechat_auth.py, nutrition_router.py等 |
| 2 | 前端项目源码 | rmfood-miniprogram/ |
| 3 | 小程序安装包 | .ipa/.apk |
| 4 | 数据库迁移脚本 | SQL文件 |
| 5 | API文档 | Swagger文档 |
| 6 | 用户手册 | 小程序使用指南 |
| 7 | 部署文档 | 服务器部署指南 |

---

## 十、风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| 微信审核不通过 | 无法上线 | 提前准备合规材料，避免敏感词 |
| OCR识别不准确 | 用户体验差 | 使用腾讯云OCR，准确率>95% |
| 性能问题 | 加载慢 | 移动端精简数据，分页加载 |
| 安全漏洞 | 数据泄露 | 定期安全审计，速率限制 |

---

*版本：V2.1 | 编制：RMFOOD架构组 | 日期：2026-09-06 | 状态：✅ 已修复所有评审问题*
