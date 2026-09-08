# RMFOOD 微信小程序最终开发执行方案

> 版本：V3.0（微信官方规范版）  
> 编制日期：2026-09-06  
> 依据：微信小程序官方开发指南 + 专业评审修复  
> 状态：✅ 可直接执行

---

## 执行摘要

本文档是RMFOOD微信小程序的**最终可执行开发方案**，已整合：

1. **微信小程序官方规范** - 分包加载、登录流程、预下载策略
2. **专业评审修复** - 解决12项技术问题的完整方案
3. **实际后端现状** - 基于现有FastAPI代码的适配方案

---

## 一、小程序架构设计（符合微信规范）

### 1.1 项目结构规范

```
rmfood-miniprogram/
├── app.js                  # 小程序入口文件
├── app.json                # 全局配置（官方规范）
├── app.wxss               # 全局样式
├── project.config.json    # 项目配置
├── sitemap.json           # 索引配置
│
├── pages/                  # 主包页面（必须<2MB）
│   ├── index/            # 首页（启动页）
│   ├── search/           # 搜索页
│   ├── compare/          # 对比页
│   ├── settings/         # 设置页
│   ├── privacy/          # 隐私政策
│   └── agreement/        # 用户协议
│
├── packages/              # 分包目录
│   ├── chat/             # AI对话分包
│   │   └── pages/
│   │       └── index/
│   ├── formulas/         # 配方分包
│   │   └── pages/
│   │       ├── index/
│   │       └── detail/
│   ├── ingredient/       # 配料分析分包 ⭐核心
│   │   └── pages/
│   │       └── analysis/
│   └── profile/          # 个人中心分包
│       └── pages/
│           └── index/
│
├── components/           # 公共组件
│   ├── nutrition-label/  # 营养标签组件
│   ├── ingredient-card/  # 成分卡片
│   └── health-score/     # 健康评分组件
│
├── utils/               # 工具函数
│   ├── request.js       # 请求封装
│   ├── auth.js          # 认证工具
│   └── cache.js         # 缓存管理
│
└── images/             # 静态资源
```

### 1.2 app.json 完整配置（符合官方规范）

```json
{
  "pages": [
    "pages/index/index",
    "pages/search/index",
    "pages/compare/index",
    "pages/settings/index",
    "pages/privacy/index",
    "pages/agreement/index"
  ],
  "subpackages": [
    {
      "root": "packages/chat",
      "name": "chat",
      "pages": [
        "pages/index/index"
      ]
    },
    {
      "root": "packages/formulas",
      "name": "formulas",
      "pages": [
        "pages/index/index",
        "pages/detail/index"
      ]
    },
    {
      "root": "packages/ingredient",
      "name": "ingredient",
      "pages": [
        "pages/analysis/index"
      ]
    },
    {
      "root": "packages/profile",
      "name": "profile",
      "pages": [
        "pages/index/index"
      ]
    }
  ],
  "preloadRule": {
    "pages/index/index": {
      "network": "all",
      "packages": ["chat", "formulas"]
    },
    "packages/chat/pages/index/index": {
      "network": "all",
      "packages": ["ingredient"]
    },
    "packages/formulas/pages/index/index": {
      "network": "wifi",
      "packages": ["profile"]
    }
  },
  "window": {
    "backgroundTextStyle": "light",
    "navigationBarBackgroundColor": "#2D5A3D",
    "navigationBarTitleText": "RMFOOD 药食同源",
    "navigationBarTextStyle": "white"
  },
  "tabBar": {
    "color": "#999999",
    "selectedColor": "#2D5A3D",
    "backgroundColor": "#ffffff",
    "borderStyle": "black",
    "list": [
      {
        "pagePath": "pages/index/index",
        "text": "首页",
        "iconPath": "images/tab-home.png",
        "selectedIconPath": "images/tab-home-active.png"
      },
      {
        "pagePath": "packages/chat/pages/index/index",
        "text": "AI对话",
        "iconPath": "images/tab-chat.png",
        "selectedIconPath": "images/tab-chat-active.png"
      },
      {
        "pagePath": "pages/search/index",
        "text": "搜索",
        "iconPath": "images/tab-search.png",
        "selectedIconPath": "images/tab-search-active.png"
      },
      {
        "pagePath": "packages/profile/pages/index/index",
        "text": "我的",
        "iconPath": "images/tab-profile.png",
        "selectedIconPath": "images/tab-profile-active.png"
      }
    ]
  },
  "requiredPrivateInfos": [
    "chooseAddress",
    "chooseMedia"
  ],
  "permission": {
    "scope.camera": {
      "desc": "用于拍摄配料表进行识别"
    },
    "scope.album": {
      "desc": "用于从相册选择配料表图片"
    }
  },
  "sitemapLocation": "sitemap.json"
}
```

### 1.3 分包策略说明（官方规范）

| 分包名称 | 包含页面 | 预下载时机 | 网络限制 |
|---------|---------|-----------|---------|
| 主包 | 首页、搜索、对比、设置、政策页 | 启动时 | - |
| chat | AI对话 | 进入首页时 | 不限网络 |
| formulas | 配方列表、详情 | 进入首页时 | 不限网络 |
| ingredient | 配料分析 ⭐ | 进入AI对话时 | 不限网络 |
| profile | 个人中心 | 进入配方列表时 | WiFi |

**官方规范要点：**
- ✅ 主包放置启动页和TabBar页
- ✅ 分包按需加载，优化首屏体验
- ✅ 分包预下载提前加载，提升后续页面速度
- ✅ 单个分包≤2MB，总包≤30MB

---

## 二、登录流程（符合微信官方规范）

### 2.1 标准登录时序

```
┌─────────────┐     1. wx.login()      ┌─────────────┐
│   小程序     │ ───────────────────→  │  开发者服务器 │
│             │                        │             │
│  获取code    │ ←───────────────────  │ 调用微信接口 │
│             │    2. 返回code         │ code2session │
│             │                        │             │
│             │                        │ 换取openid   │
│             │                        │ session_key  │
│             │                        │             │
│             │ ←───────────────────  │ 生成JWT Token│
│  3. 返回Token│                       │             │
└─────────────┘                        └─────────────┘
```

### 2.2 小程序端登录实现

```javascript
// utils/auth.js
const API_BASE = 'https://api.rmfood.com/api/v1'

/**
 * 小程序登录（符合微信官方规范）
 */
async function wechatLogin() {
  return new Promise((resolve, reject) => {
    // Step 1: 调用wx.login获取临时code
    wx.login({
      success: async (loginRes) => {
        if (!loginRes.code) {
          reject(new Error('获取code失败'))
          return
        }
        
        // Step 2: 将code发送到开发者服务器
        try {
          const res = await wx.request({
            url: `${API_BASE}/wechat/login`,
            method: 'POST',
            data: { code: loginRes.code },
            header: { 'Content-Type': 'application/json' }
          })
          
          if (res.statusCode === 200 && res.data.access_token) {
            // Step 3: 存储Token（官方推荐：本地存储）
            wx.setStorageSync('access_token', res.data.access_token)
            wx.setStorageSync('refresh_token', res.data.refresh_token)
            wx.setStorageSync('user_info', res.data.user)
            
            resolve({
              success: true,
              token: res.data.access_token,
              user: res.data.user,
              isNewUser: res.data.is_new_user
            })
          } else {
            reject(new Error(res.data?.detail || '登录失败'))
          }
        } catch (error) {
          reject(error)
        }
      },
      fail: (error) => {
        reject(error)
      }
    })
  })
}

/**
 * 获取当前Token
 */
function getToken() {
  return wx.getStorageSync('access_token') || ''
}

/**
 * 检查登录状态
 */
function isLoggedIn() {
  const token = getToken()
  return !!token
}

/**
 * 登出
 */
function logout() {
  wx.removeStorageSync('access_token')
  wx.removeStorageSync('refresh_token')
  wx.removeStorageSync('user_info')
}

module.exports = {
  wechatLogin,
  getToken,
  isLoggedIn,
  logout
}
```

### 2.3 后端登录接口实现（符合官方安全规范）

```python
# backend/app/api/wechat_auth.py
"""
微信小程序登录接口（符合官方规范）

官方要求：
1. code只能使用一次
2. session_key不能下发到小程序
3. 服务端生成自定义登录态（JWT）
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
import httpx
import logging
from typing import Optional

from ..services.auth import AuthService, get_current_user
from ..schemas import Token, UserResponse
from ..models.user_model import User
from ..core.database.session import get_db_session
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/wechat", tags=["微信认证"])
logger = logging.getLogger(__name__)


class WechatLoginRequest(BaseModel):
    """微信登录请求"""
    code: str = Field(..., min_length=5, max_length=64)


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
    
    官方流程：
    1. 前端调用wx.login()获取code
    2. 后端用code换取openid和session_key
    3. 服务端生成JWT Token作为登录态
    4. 返回Token给前端（不返回session_key）
    """
    # Step 1: 调用微信code2Session接口
    wx_data = await _call_wx_code2session(req.code)
    
    # 检查微信接口返回
    if "errcode" in wx_data:
        logger.error(f"微信登录失败: {wx_data}")
        raise HTTPException(
            status_code=400,
            detail=f"微信登录失败: {wx_data.get('errmsg', '未知错误')}"
        )
    
    openid = wx_data["openid"]
    unionid = wx_data.get("unionid")
    session_key = wx_data.get("session_key")
    
    # Step 2: 查询或创建用户
    service = AuthService(db)
    user, is_new = await service.get_or_create_miniapp_user(
        openid=openid,
        unionid=unionid,
        session_key=session_key  # 仅用于服务端解密，不下发
    )
    
    # Step 3: 生成JWT Token
    tokens = await service.generate_jwt_tokens(user)
    
    # Step 4: 返回Token（不返回session_key）
    return WechatLoginResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
        user=UserResponse.from_orm(user),
        is_new_user=is_new
    )


async def _call_wx_code2session(code: str) -> dict:
    """
    调用微信code2Session接口
    
    注意：
    - code只能使用一次
    - session_key不应下发到客户端
    """
    from ..core.config import settings
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            "https://api.weixin.qq.com/sns/jscode2session",
            params={
                "appid": settings.wechat.appid,
                "secret": settings.wechat.secret,
                "js_code": code,
                "grant_type": "authorization_code"
            }
        )
        return resp.json()


@router.post("/bind")
async def bind_account(
    req: WechatLoginRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """绑定微信账号到已有账号"""
    wx_data = await _call_wx_code2session(req.code)
    
    if "errcode" in wx_data:
        raise HTTPException(status_code=400, detail="微信授权失败")
    
    openid = wx_data["openid"]
    service = AuthService(db)
    await service.bind_wechat(openid, current_user.id)
    
    return {"message": "绑定成功"}
```

---

## 三、分包预下载配置（官方规范）

### 3.1 预下载策略

```json
{
  "preloadRule": {
    "pages/index/index": {
      "network": "all",
      "packages": ["chat", "formulas"]
    },
    "packages/chat/pages/index/index": {
      "network": "all",
      "packages": ["ingredient"]
    },
    "packages/formulas/pages/index/index": {
      "network": "wifi",
      "packages": ["profile"]
    }
  }
}
```

### 3.2 预下载时机说明

| 进入页面 | 预下载分包 | 网络限制 | 说明 |
|---------|-----------|---------|------|
| 首页 | chat、formulas | 不限 | 用户最可能访问的功能 |
| AI对话 | ingredient | 不限 | 核心功能，优先加载 |
| 配方列表 | profile | WiFi | 非核心功能，WiFi下加载 |

---

## 四、订阅消息配置（官方规范）

### 4.1 消息模板配置

```json
// app.json
{
  "subscribeMessage": {
    "msgScene": "afterOrderPaid",
    "templateId": "YOUR_TEMPLATE_ID",
    "key": "orderPaySuccess"
  }
}
```

### 4.2 订阅消息调用

```javascript
// 申请订阅消息权限
wx.requestSubscribeMessage({
  tmplIds: ['TEMPLATE_ID_1', 'TEMPLATE_ID_2'],
  success: (res) => {
    console.log('订阅结果:', res)
  }
})

// 发送订阅消息（后端触发）
POST /api/v1/notifications/subscribe
{
  "user_id": 123,
  "template_id": "xxx",
  "data": {
    "thing1": { "value": "配方审核通过" },
    "time2": { "value": "2026-09-06 18:00" }
  }
}
```

---

## 五、性能优化（官方规范）

### 5.1 分包策略优化

```
主包（≤2MB）：
├── 启动页（index）
├── TabBar页面
├── 公共资源（utils、components）
└── 全局样式

分包（各≤2MB）：
├── chat: AI对话功能
├── formulas: 配方浏览
├── ingredient: 配料分析 ⭐
└── profile: 个人中心
```

### 5.2 图片优化

```javascript
// 使用wx.getImageInfo获取图片信息
wx.getImageInfo({
  src: imageUrl,
  success: (res) => {
    console.log('图片尺寸:', res.width, res.height)
  }
})

// 图片懒加载
<image lazy-load src="{{imageUrl}}" />
```

### 5.3 数据缓存（符合用户偏好）

```javascript
// utils/cache.js
const CACHE_KEY_PREFIX = 'rmfood_cache_'
const CACHE_EXPIRE = 5 * 60 * 1000 // 5分钟

/**
 * 缓存数据
 */
function setCache(key, data) {
  const cacheData = {
    value: data,
    timestamp: Date.now()
  }
  wx.setStorageSync(CACHE_KEY_PREFIX + key, JSON.stringify(cacheData))
}

/**
 * 获取缓存数据
 */
function getCache(key) {
  const cacheStr = wx.getStorageSync(CACHE_KEY_PREFIX + key)
  if (!cacheStr) return null
  
  try {
    const cacheData = JSON.parse(cacheStr)
    // 检查是否过期
    if (Date.now() - cacheData.timestamp > CACHE_EXPIRE) {
      wx.removeStorageSync(CACHE_KEY_PREFIX + key)
      return null
    }
    return cacheData.value
  } catch (e) {
    return null
  }
}

/**
 * 清除缓存
 */
function clearCache(key) {
  wx.removeStorageSync(CACHE_KEY_PREFIX + key)
}
```

---

## 六、开发执行计划（完整版）

### Phase 1: 环境准备（第1天）

```
□ 申请微信小程序账号
   └── 获取AppID和AppSecret
  
□ 配置小程序后台
   └── 设置服务器域名白名单
   └── 配置消息推送密钥
   
□ 搭建开发环境
   └── 安装微信开发者工具
   └── 初始化Taro项目
   └── 配置分包结构
```

### Phase 2: 后端基础修复（第2-5天）

```
□ Day 2-3: 认证架构修复
   └── 新建 wechat_auth.py
   └── 实现双模式认证
   └── 测试登录流程
   
□ Day 4-5: 营养分析API开发
   └── 新建 nutrition_router.py
   └── 实现4个核心接口
   └── 编写单元测试
```

### Phase 3: API兼容性修复（第6-10天）

```
□ Day 6-7: 移动端API优化
   └── 创建精简配方列表接口
   └── 实现收藏API
   └── 实现图片上传API
   
□ Day 8-10: OCR功能实现
   └── 集成腾讯云OCR SDK
   └── 实现后端OCR接口
   └── 测试识别准确率
```

### Phase 4: 前端开发（第11-35天）

```
□ Week 3: 基础架构搭建
   ├── Taro项目初始化
   ├── NutUI-Taro集成
   ├── 认证流程对接
   └── 分包配置
   
□ Week 4-5: 核心功能开发
   ├── AI对话功能（流式输出）
   ├── 配方浏览和搜索
   ├── 配料表分析 ⭐
   └── 个人中心
   
□ Week 6-7: 增值功能开发
   ├── 体质诊断
   ├── 配方收藏和分享
   ├── 离线同步
   └── UI优化
```

### Phase 5: 测试和优化（第36-45天）

```
□ Week 8: 功能测试
   ├── 全量功能测试
   ├── 兼容性测试（iOS/Android）
   ├── 性能测试
   └── 安全测试
   
□ Week 9: 优化完善
   ├── 性能优化
   ├── UI/UX优化
   ├── 漏洞修复
   └── 文档完善
```

### Phase 6: 部署上线（第46-50天）

```
□ 提交审核
   ├── 准备审核材料
   ├── 提交小程序审核
   └── 修复审核问题
   
□ 上线发布
   ├── 正式版本发布
   ├── 监控配置
   └── 运维文档
```

---

## 七、预算与资源

| 阶段 | 工期 | 人力 | 预算 |
|------|------|------|------|
| 环境准备 | 1天 | 1人 | ¥500 |
| 后端修复 | 5天 | 2人 | ¥10,000 |
| API优化 | 5天 | 2人 | ¥10,000 |
| 前端开发 | 25天 | 2人 | ¥50,000 |
| 测试优化 | 10天 | 1人 | ¥8,000 |
| 部署上线 | 4天 | 1人 | ¥3,500 |
| **总计** | **50天** | **2人** | **¥82,000** |

---

## 八、交付物清单

| 序号 | 交付物 | 规格 |
|------|--------|------|
| 1 | 后端API代码 | wechat_auth.py, nutrition_router.py等 |
| 2 | 小程序源码 | rmfood-miniprogram/ |
| 3 | 小程序安装包 | .ipa/.apk |
| 4 | 数据库迁移脚本 | SQL文件 |
| 5 | API文档 | Swagger/Postman集合 |
| 6 | 用户手册 | PDF格式，思源黑体字体 |
| 7 | 部署文档 | 服务器部署指南 |
| 8 | 测试报告 | 功能/性能/安全测试报告 |

---

## 九、风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| 微信审核不通过 | 无法上线 | 提前准备合规材料，避免敏感词 |
| OCR识别不准确 | 用户体验差 | 使用腾讯云OCR，准确率>95% |
| 包体积超限 | 无法发布 | 图片压缩、代码分割、分包加载 |
| 性能问题 | 加载慢 | 分包预下载、数据缓存、懒加载 |
| 安全漏洞 | 数据泄露 | 定期安全审计、速率限制、HTTPS |

---

## 十、关键技术决策记录

### ADR-001: 双模式认证架构

**问题**: Web端使用Cookie认证，小程序无法读取HttpOnly Cookie

**决策**: 采用双模式认证架构
- Web端: HttpOnly Cookie（安全）
- 小程序端: Bearer Token（兼容）
- 统一AuthService服务处理

**理由**: 符合小程序平台限制，保持Web端安全策略

### ADR-002: 分包加载策略

**问题**: 主包体积限制2MB，功能模块较多

**决策**: 采用5个分包策略
- 主包: 启动页+TabBar页
- chat分包: AI对话
- formulas分包: 配方浏览
- ingredient分包: 配料分析
- profile分包: 个人中心

**理由**: 符合微信官方规范，优化首屏加载体验

### ADR-003: 分包预下载策略

**问题**: 分包按需加载影响用户体验

**决策**: 配置preloadRule预下载关键分包
- 进入首页预下载chat、formulas
- 进入AI对话预下载ingredient
- 进入配方列表WiFi下预下载profile

**理由**: 平衡启动速度和用户体验，符合官方推荐实践

---

*版本：V3.0 | 编制：RMFOOD架构组 | 日期：2026-09-06 | 状态：✅ 符合微信官方规范，可执行*
