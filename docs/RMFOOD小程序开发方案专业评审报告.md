# RMFOOD 小程序开发方案专业评审报告

> 版本：V1.0  
> 评审日期：2026-09-06  
> 评审人：RMFOOD架构组 + 资深技术专家  
> 状态：⚠️ 存在重大技术问题，需修复后方可开发

---

## 执行摘要

本文档对RMFOOD微信小程序开发方案进行**专业技术评审**，发现**12项重要问题**，其中**3项为阻塞性问题**，必须在开发前解决。

| 问题级别 | 数量 | 说明 |
|---------|------|------|
| 🔴 阻塞性（P0） | 3项 | 无法开发，必须修复 |
| 🟡 严重性（P1） | 5项 | 功能将失败，需优先修复 |
| 🟠 一般性（P2） | 4项 | 建议修复，影响用户体验 |

---

## 一、阻塞性问题（P0）— 必须在开发前解决

### 🔴 问题1：认证架构不匹配（致命）

**问题描述**：

后端当前使用 **HttpOnly Cookie 认证**，而微信小程序**无法访问 HttpOnly Cookie**。这是根本性的架构冲突。

```python
# 后端认证代码（backend/app/api/auth.py）
ACCESS_TOKEN_COOKIE = "rmfood_access_token"
REFRESH_TOKEN_COOKIE = "rmfood_refresh_token"

# 设置 Cookie（HttpOnly，小程序无法读取）
response.set_cookie(
    key=ACCESS_TOKEN_COOKIE,
    value=token_data.access_token,
    httponly=True,      # ← 小程序无法访问！
    secure=True,
    samesite='strict',
)
```

**影响**：
- 用户登录后 Token 存储在 HttpOnly Cookie 中
- 小程序无法读取 Cookie，无法获取 Token
- 所有需要认证的 API 调用都会失败
- **整个认证体系完全失效**

**解决方案**（三选一）：

```python
# 方案A：新增小程序专用认证接口（推荐）
# backend/app/api/wechat_auth.py
@router.post("/wechat/login")
async def wechat_login(req: WechatLoginRequest, db: AsyncSession):
    """小程序专用登录接口，返回Token（不使用Cookie）"""
    # 1. 用code换取openid
    # 2. 查询或创建用户
    # 3. 生成JWT Token
    # 4. 直接在响应体返回Token（非Cookie）
    return {
        "access_token": token,
        "refresh_token": refresh_token,
        "expires_in": 1800,
        "user": user_data
    }

# 方案B：双模式认证
# - Web端继续使用Cookie
# - 小程序使用Bearer Token
# 修改get_current_user依赖，支持两种认证方式

# 方案C：创建专用MiniProgramUser模型
# - 小程序用户与Web用户分离
# - 独立的Token管理
```

---

### 🔴 问题2：缺少微信登录接口

**问题描述**：

开发方案假设存在 `/api/v1/wechat/login` 接口，但**后端完全没有此接口**。

**影响**：
- 用户无法通过微信登录
- 无法获取openid绑定账号
- 整个用户体系无法建立

**解决方案**：

```python
# 需要新建 backend/app/api/wechat_auth.py
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/wechat", tags=["微信认证"])

class WechatLoginRequest(BaseModel):
    code: str  # wx.login()获取的临时码

class WechatLoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    user: dict

@router.post("/login", response_model=WechatLoginResponse)
async def wechat_login(req: WechatLoginRequest, db: AsyncSession):
    # Step 1: 调用微信接口换取openid
    wx_response = await httpx.AsyncClient().get(
        "https://api.weixin.qq.com/sns/jscode2session",
        params={
            "appid": settings.wechat.appid,
            "secret": settings.wechat.secret,
            "js_code": req.code,
            "grant_type": "authorization_code"
        }
    )
    
    wx_data = wx_response.json()
    if "errcode" in wx_data:
        raise HTTPException(status_code=400, detail=wx_data.get("errmsg"))
    
    openid = wx_data["openid"]
    session_key = wx_data.get("session_key")
    
    # Step 2: 查询或创建用户
    user = await get_or_create_user(db, openid, session_key)
    
    # Step 3: 生成JWT Token
    tokens = await generate_jwt_tokens(user)
    
    return WechatLoginResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
        user=UserResponse.from_orm(user)
    )
```

**前置条件**：
- 需要申请微信小程序 AppID 和 AppSecret
- 需要在 `.env` 中配置：
  ```
  WECHAT_APPID=your_appid
  WECHAT_APPSECRET=your_secret
  ```

---

### 🔴 问题3：缺少营养分析REST API

**问题描述**：

后端已有营养分析服务代码，但**没有暴露为REST API**。

**现有代码**：
```
✅ backend/app/services/nutrition/
   ├── nutrition_database.py    # 营养数据库（50+味药材）
   ├── nutrition_label_generator.py  # 营养标签生成器
   └── nutrition_export.py      # 导出服务

✅ backend/app/schemas/nutrition_label.py  # Pydantic模型已定义

❌ backend/app/api/nutrition_router.py     # 路由不存在！
```

**影响**：
- 配料表分析功能无法调用后端服务
- 前端调用 `/api/v1/nutrition/*` 全部返回404
- **核心差异化功能完全失效**

**解决方案**：

```python
# 新建 backend/app/api/nutrition_router.py
from fastapi import APIRouter, Depends
from ..services.nutrition.nutrition_label_generator import NutritionLabelGenerator
from ..services.nutrition.nutrition_database import HERB_NUTRITION_DB
from ..services.safety_checker import safety_checker
from ..services.health_evaluator import health_evaluator

router = APIRouter(prefix="/nutrition", tags=["营养分析"])
label_generator = NutritionLabelGenerator(ingredient_db=HERB_NUTRITION_DB)

@router.post("/analyze")
async def analyze_ingredient_list(req: AnalyzeRequest):
    """配料表分析"""
    # 实现分析逻辑...

@router.post("/calculate")
async def calculate_nutrition_label(req: CalculateRequest):
    """营养标签计算"""
    return label_generator.calculate_label(**req.dict())

@router.get("/database")
async def get_nutrition_database():
    """获取营养数据库（用于搜索联想）"""
    return {"ingredients": list(HERB_NUTRITION_DB.keys())}
```

---

## 二、严重性问题（P1）— 功能将失败

### 🟡 问题4：公式API返回数据过大

**问题描述**：

当前 `/api/v1/formulas` 接口返回完整数据，包括：
- 所有成分详情（含化合物、靶点、疾病）
- 所有肽段信息
- 协同分析结果
- 版本历史

**影响**：
- 移动端加载慢（单次响应可能>1MB）
- 流量费用高
- 用户体验差

**解决方案**：

```python
# 创建移动端精简版接口
@router.get("/mobile/list")
async def list_formulas_mobile(
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db_session),
):
    """移动端精简配方列表"""
    formulas, total = await service.list_formulas(...)
    
    # 只返回必要字段
    result = []
    for f in formulas:
        result.append({
            "id": f.id,
            "name": f.name,
            "description": f.description[:100],  # 截断描述
            "target_effects": f.target_effects,
            "image_url": f.image_url,
            "ingredient_count": len(f.ingredients),
            "created_at": f.created_at,
        })
    return {"items": result, "total": total}
```

---

### 🟡 问题5：OCR实现方案错误

**问题描述**：

开发方案使用 `Taro.requirePlugin('WechatSI')` 进行OCR识别，但该插件**不是标准Taro插件**。

**影响**：
- 拍照识别功能无法实现
- 需要重新设计OCR方案

**正确方案**：

```typescript
// 方案1：使用微信内置OCR（推荐）
const res = await Taro.chooseMedia({
  count: 1,
  mediaType: ['image'],
  sourceType: ['camera', 'album'],
})

// 调用微信OCR服务（需要通过后端代理）
const ocrResult = await Taro.request({
  url: `${API_BASE}/ocr/image`,
  method: 'POST',
  header: { 'Authorization': `Bearer ${token}` },
  data: { image: res.tempFiles[0].tempFilePath }
})

// 方案2：使用腾讯云OCR（更准确）
// 需要后端集成腾讯云OCR SDK
```

**后端OCR接口**：
```python
# backend/app/api/ocr_router.py
@router.post("/ocr/image")
async def recognize_image(file: UploadFile = File(...)):
    """图片OCR识别"""
    # 调用微信OCR或腾讯云OCR
    text = await ocr_service.recognize(file)
    return {"text": text}
```

---

### 🟡 问题6：收藏API不存在

**问题描述**：

开发方案假设存在 `POST /api/v1/formulas/favorite` 接口，但后端**没有此接口**。

**解决方案**：

```python
# 在 backend/app/api/formulas.py 中添加
@router.post("/{formula_id}/favorite")
async def toggle_favorite(
    formula_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """收藏/取消收藏配方"""
    service = FormulaService(db)
    is_favorited = await service.toggle_favorite(formula_id, current_user.id)
    return {"favorited": is_favorited}
```

---

### 🟡 问题7：图片上传API缺失

**问题描述**：

分享海报生成需要上传图片，但后端只有头像上传，没有通用图片上传接口。

**解决方案**：

```python
# backend/app/api/uploads.py
@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """通用文件上传"""
    # 验证文件类型
    # 生成安全文件名
    # 保存到MinIO/OSS
    # 返回访问URL
    return {"url": file_url}
```

---

### 🟡 问题8：通知API路径错误

**问题描述**：

开发方案使用 `/api/v1/notifications`，但实际后端路径是 `/api/mobile/notifications`。

**影响**：
- 通知功能全部失效
- 消息推送无法工作

**解决方案**：

```typescript
// 修正前端API调用
// 错误：/api/v1/notifications
// 正确：/api/mobile/notifications

// 或者创建v1兼容层
@router.get("/v1/notifications")
async def notifications_v1(current_user):
    """v1兼容层"""
    return await list_notifications(current_user, limit=20)
```

---

## 三、一般性问题（P2）— 建议修复

### 🟠 问题9：缺少速率限制

**问题描述**：

营养分析、AI对话等接口没有速率限制，可能被滥用。

**解决方案**：

```python
# 使用fastapi-limiter或自定义中间件
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter

@router.post("/nutrition/analyze", dependencies=[Depends(RateLimiter(times=10, seconds=60))])
async def analyze(req: AnalyzeRequest):
    pass
```

---

### 🟠 问题10：数据库迁移缺失

**问题描述**：

方案中新增了 `ingredient_analysis` 和 `ingredient_index` 表，但没有提供Alembic迁移脚本。

**解决方案**：

```bash
# 创建迁移脚本
alembic revision --autogenerate -m "add ingredient analysis tables"

# 执行迁移
alembic upgrade head
```

---

### 🟠 问题11：健康数据安全不足

**问题描述**：

用户健康数据（体质诊断、分析结果）敏感，但方案中没有详细说明加密和访问控制。

**建议措施**：
- 敏感数据加密存储（AES-256）
- 访问日志审计
- 数据脱敏展示
- 符合GDPR/个人信息保护法要求

---

### 🟠 问题12：离线同步冲突处理不完整

**问题描述**：

方案提到离线队列，但没有详细说明冲突解决策略。

**建议**：
- 定义冲突检测算法（最后写入 wins？手动合并？）
- 提供冲突解决UI
- 记录同步历史

---

## 四、技术问题汇总

| 编号 | 问题 | 级别 | 影响范围 | 预计修复时间 |
|------|------|------|---------|-------------|
| 1 | 认证架构不匹配 | 🔴 P0 | 全部API | 2天 |
| 2 | 缺少微信登录接口 | 🔴 P0 | 用户体系 | 1天 |
| 3 | 缺少营养分析API | 🔴 P0 | 核心功能 | 3天 |
| 4 | 公式API数据过大 | 🟡 P1 | 性能 | 1天 |
| 5 | OCR方案错误 | 🟡 P1 | 输入功能 | 1天 |
| 6 | 收藏API缺失 | 🟡 P1 | 用户功能 | 0.5天 |
| 7 | 图片上传缺失 | 🟡 P1 | 分享功能 | 0.5天 |
| 8 | 通知API路径错误 | 🟡 P1 | 消息功能 | 0.5天 |
| 9 | 缺少速率限制 | 🟠 P2 | 安全性 | 0.5天 |
| 10 | 数据库迁移缺失 | 🟠 P2 | 数据持久化 | 0.5天 |
| 11 | 健康数据安全不足 | 🟠 P2 | 合规性 | 2天 |
| 12 | 离线同步不完整 | 🟠 P2 | 用户体验 | 1天 |

**总计**：
- 阻塞性问题：3项（需立即修复）
- 严重问题：5项（优先修复）
- 一般问题：4项（建议修复）
- **预计总修复时间：11.5人天**

---

## 五、修复优先级建议

### 第一阶段：阻塞性问题（第1周）

```
Day 1-2: 修复认证架构
  - 新增小程序专用登录接口
  - 实现双模式认证（Cookie + Bearer）
  - 测试微信登录流程

Day 3-5: 开发营养分析API
  - 创建 nutrition_router.py
  - 实现 analyze/calculate/database/safety-check 四个接口
  - 编写单元测试
```

### 第二阶段：严重性问题（第2周）

```
Day 6-7: 修复API兼容性问题
  - 添加移动端精简配方列表接口
  - 实现收藏API
  - 实现图片上传API
  - 修正通知API路径

Day 8-10: 修复OCR和图片处理
  - 实现后端OCR接口
  - 修正前端OCR调用
  - 实现海报生成功能
```

### 第三阶段：一般性问题（第3周）

```
Day 11-12: 安全性和合规性
  - 添加速率限制
  - 完善健康数据安全
  - 创建数据库迁移脚本

Day 13-14: 离线同步优化
  - 完善冲突解决策略
  - 实现离线队列
```

---

## 六、总结

### 核心结论

1. **认证架构存在根本性冲突**：Cookie认证无法在小程序中使用，必须重新设计

2. **核心功能API缺失**：微信登录、营养分析API均未实现，是最大阻碍

3. **现有API不兼容移动端**：返回数据过大、路径错误等问题需要适配

### 开发建议

**建议按以下顺序推进**：

```
1. 先解决认证问题（2天）
   └─> 没有认证，其他都是空谈

2. 再实现营养分析API（3天）
   └─> 这是核心差异化功能

3. 修复API兼容性问题（3天）
   └─> 确保现有功能可用

4. 优化安全和性能（3天）
   └─> 提升用户体验

5. 开始前端开发（剩余时间）
```

### 风险提示

- ⚠️ **不要在没有解决认证问题的情况下开始前端开发**
- ⚠️ **营养分析API是核心功能，必须优先实现**
- ⚠️ **建议先搭建后端基础，再进行前端开发**

---

*评审版本：V1.0 | 编制：RMFOOD架构组 | 日期：2026-09-06*
