# RMFOOD 微信小程序开发方案 — 可行性分析与实施指南 V4.0

> 文档版本：V4.0  
> 评审版本：V3.0 → V4.0  
> 评审日期：2026-09-05  
> 编制：RMFOOD架构组 + 资深小程序专家组  
> 状态：✅ 可行性确认通过

---

## 执行摘要

经深度评审，**V3.0方案技术上完全可行**，但需补充以下关键实施细节：

| 维度 | 可行性评估 | 关键行动项 |
|------|-----------|-----------|
| **技术可行性** | ✅ 通过 | 修正SSE消费代码，适配Zustand持久化 |
| **后端对接** | ✅ 通过 | 新增微信登录接口，复用现有AI/SSE端点 |
| **合规风险** | ⚠️ 需关注 | 补充隐私政策、免责声明、健康数据保护 |
| **工程化** | ⚠️ 需补充 | 添加CI/CD、测试、监控方案 |
| **时间估算** | ⚠️ 建议延长 | 8周→10周（预留合规和调试buffer） |
| **预算估算** | ⚠️ 需补充 | 云开发、CDN、审核费用约¥5,000/年 |

**结论**：方案可行，建议按V4.0实施指南推进。

---

## 一、技术可行性深度验证

### 1.1 后端SSE端点验证

**✅ 已确认后端支持：**

```python
# backend/app/api/ai_modules/chat.py:225
@router.post("/chat/stream", summary="AI 智能对话（流式）")
async def chat_stream(req: ChatRequest, ...):
    # 支持SSE流式输出
    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

**后端SSE格式（已验证）：**
```
event: content
data: {"content": "部分文本..."}

event: content
data: {"content": "更多文本..."}

event: done
data: {}
```

**结论**：后端SSE端点完整，小程序只需正确消费即可。

### 1.2 前端SSE消费方案验证

**✅ 推荐方案：fetch API（基础库2.15.0+）**

```typescript
// miniprogram/src/api/stream.ts
export async function streamChat(
  question: string,
  callbacks: StreamCallbacks,
  token: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/ai/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ question, stream: true }),
  })
  
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6))
        if (data.content) callbacks.onChunk(data.content)
        else if (data.error) throw new Error(data.message)
      }
    }
  }
}
```

**✅ 兼容方案：轮询降级（基础库<2.15.0）**

```typescript
// 降级方案：使用已有异步任务接口
const { task_id } = await postToTaskQueue({
  task_type: 'ai_chat',
  payload: { question }
})

// 轮询结果
const poll = async () => {
  const result = await getTaskStatus(task_id)
  if (result.status === 'success') {
    callbacks.onDone(result.result.content)
  } else if (result.status === 'failed') {
    callbacks.onError(new Error(result.error))
  } else {
    setTimeout(poll, 500)
  }
}
poll()
```

### 1.3 小程序环境API兼容性验证

| API | 小程序支持 | 备注 |
|-----|-----------|------|
| `fetch` | ✅ 基础库2.15.0+ | 推荐方案 |
| `ReadableStream` | ✅ fetch返回 | 流式消费 |
| `TextDecoder` | ✅ 基础库2.15.0+ | UTF-8解码 |
| `wx.request` | ✅ 全版本 | 备选方案（不支持流式） |
| `wx.connectSocket` | ✅ 全版本 | WebSocket备选（有域名限制） |
| `localStorage` | ❌ | 必须用wx.setStorageSync |
| `document.cookie` | ❌ | 必须用Token Header |

**结论**：技术路线可行，需做好版本兼容性处理。

---

## 二、实施路径规划

### 2.1 项目初始化（第1-3天）

```bash
# 步骤1：创建Taro项目
npx @tarojs/cli init miniprogram \
  --template react \
  --typescript \
  --sass \
  --name RMFOOD

# 步骤2：安装核心依赖
cd miniprogram
npm install @tarojs/taro @tarojs/components @tarojs/runtime
npm install @nutui/nutui-taro@4
npm install zustand
npm install crypto-js
npm install axios  # 备用方案

# 步骤3：配置Taro
# taro.config.ts
export default defineConfig({
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: { selectorUnitName: 'rpx' }
      }
    },
    subpackages: [
      { root: 'pages/chat', name: 'chat' },
      { root: 'pages/formulas', name: 'formulas' },
    ]
  },
  h5: {
    devServer: { port: 3001 }
  }
})
```

### 2.2 核心功能开发（第4-35天）

#### Phase 1：基建+认证（第4-10天）

| 任务 | 产出 | 验收标准 |
|------|------|---------|
| 请求层封装 | `src/api/request.ts` | 支持Token注入、错误处理 |
| 流式输出封装 | `src/api/stream.ts` | SSE消费+轮询降级 |
| 状态管理 | `src/stores/` | Zustand+持久化适配器 |
| 微信登录 | `src/pages/login/` | 登录流程跑通 |
| 后端对接 | `backend/app/api/wechat_auth.py` | wechat-login接口可用 |

#### Phase 2：核心功能（第11-24天）

| 任务 | 产出 | 验收标准 |
|------|------|---------|
| AI对话页 | `src/pages/chat/` | 流式输出+打字机效果 |
| 配方列表 | `src/pages/formulas/` | 分页+搜索+收藏 |
| 配方详情 | `src/pages/formula-detail/` | Markdown渲染+分享 |
| 个人中心 | `src/pages/profile/` | 历史+设置 |

#### Phase 3：完善功能（第25-35天）

| 任务 | 产出 | 验收标准 |
|------|------|---------|
| 体质诊断 | `src/pages/health-check/` | 问卷+AI推荐 |
| RAG问答 | `src/pages/knowledge/` | 知识库问答 |
| 配方对比 | `src/pages/compare/` | 多方案对比 |
| 隐私合规 | `src/pages/privacy/` | 弹窗+协议页面 |

### 2.3 优化与测试（第36-49天）

| 任务 | 产出 | 验收标准 |
|------|------|---------|
| 性能优化 | - | 首屏<2s，包体积<1.8MB |
| 真机测试 | - | iOS/Android各3款机型 |
| 微信审核 | - | 一次性通过 |
| 上线发布 | - | 正式发布 |

---

## 三、关键风险与缓解方案

### 3.1 技术风险

| 风险 | 影响 | 概率 | 缓解方案 |
|------|------|------|---------|
| SSE消费不稳定 | 高 | 中 | 实现轮询降级，双策略切换 |
| 包体积超限 | 高 | 中 | 按需引入NutUI，图片压缩 |
| Token存储安全 | 中 | 低 | 加密存储+定期刷新 |
| 流式输出断连 | 中 | 低 | 断线重连+本地缓存草稿 |

### 3.2 合规风险

| 风险 | 影响 | 概率 | 缓解方案 |
|------|------|------|---------|
| 健康内容审核 | 高 | 中 | 添加免责声明+资质准备 |
| 隐私政策缺失 | 高 | 中 | 首次启动弹窗+协议页面 |
| 敏感数据收集 | 中 | 低 | 明示同意+数据最小化 |

### 3.3 进度风险

| 风险 | 影响 | 概率 | 缓解方案 |
|------|------|------|---------|
| 微信登录接口延迟 | 中 | 中 | Phase 1优先开发 |
| 审核拒审 | 高 | 低 | 提前准备资质材料 |
| 人员变动 | 中 | 低 | 文档完整+代码规范 |

---

## 四、后端对接详细方案

### 4.1 需新增的后端接口

```python
# backend/app/api/wechat_auth.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import httpx

router = APIRouter(prefix="/wechat", tags=["微信认证"])

class WechatLoginRequest(BaseModel):
    code: str  # wx.login()获取的临时码

class WechatLoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: UserResponse

@router.post("/login", response_model=WechatLoginResponse)
async def wechat_login(req: WechatLoginRequest, db: AsyncSession = Depends(get_db_session)):
    """
    微信授权登录
    1. 使用code换取openid
    2. 查询或创建用户
    3. 生成JWT Token
    """
    # 调用微信接口
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
        raise HTTPException(status_code=400, detail="微信登录失败")
    
    openid = wx_data["openid"]
    
    # 查询或创建用户
    user = await get_or_create_user(db, openid)
    
    # 生成Token
    tokens = await generate_tokens(user)
    
    return WechatLoginResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        user=UserResponse.from_orm(user)
    )
```

### 4.2 环境变量配置

```bash
# miniprogram/.env.development
TARO_ENV=development
TARO_APP_ID=wx_your_appid_here
VITE_API_BASE_URL=http://localhost:8000/api/v1

# miniprogram/.env.production
TARO_ENV=production
TARO_APP_ID=wx_your_production_appid
VITE_API_BASE_URL=https://api.rmfood.com/api/v1
```

```bash
# backend/.env（新增）
WECHAT_APPID=wx_your_appid
WECHAT_SECRET=your_secret
WECHAT_MINIPROGRAM_APPID=wx_your_miniprogram_appid
```

---

## 五、前端代码结构（最终版）

```
miniprogram/
├── src/
│   ├── api/
│   │   ├── request.ts       # wx.request封装（降级方案）
│   │   ├── stream.ts        # fetch API流式请求（推荐）
│   │   ├── auth.ts          # 认证API
│   │   ├── chat.ts          # 对话API
│   │   ├── formula.ts       # 配方API
│   │   └── types.ts         # 类型定义
│   │
│   ├── stores/
│   │   ├── storage.ts       # 自定义storage适配器
│   │   ├── auth.store.ts    # 认证状态
│   │   ├── chat.store.ts    # 对话状态
│   │   └── formula.store.ts # 配方状态
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useStreaming.ts  # 流式输出Hook
│   │   └── useVoice.ts      # 语音输入Hook
│   │
│   ├── pages/
│   │   ├── index/           # 首页
│   │   ├── chat/            # AI对话
│   │   ├── formulas/        # 配方列表
│   │   ├── formula-detail/  # 配方详情
│   │   ├── health-check/    # 体质诊断
│   │   ├── profile/         # 个人中心
│   │   ├── search/          # 搜索
│   │   ├── compare/         # 配方对比
│   │   ├── privacy/         # 隐私政策
│   │   └── agreement/       # 用户协议
│   │
│   ├── components/
│   │   ├── FormulaCard/
│   │   ├── ChatBubble/
│   │   ├── HamburgerMenu/   # 汉堡菜单
│   │   ├── Disclaimer/      # 免责声明
│   │   └── SharePoster/     # 分享海报
│   │
│   ├── utils/
│   │   ├── crypto.ts        # 加密工具
│   │   ├── cache.ts         # 缓存管理
│   │   └── performance.ts   # 性能监控
│   │
│   ├── types/
│   │   ├── api.types.ts
│   │   └── formula.types.ts
│   │
│   ├── app.config.ts        # 小程序配置
│   ├── app.ts               # 入口
│   └── app.scss             # 全局样式
│
├── config/
│   ├── dev.ts
│   ├── prod.ts
│   └── index.ts
│
├── .github/workflows/
│   └── miniprogram.yml      # CI/CD
│
├── package.json
├── tsconfig.json
└── taro.config.ts
```

---

## 六、合规要求清单

### 6.1 微信小程序审核要求

| 项目 | 要求 | 状态 |
|------|------|------|
| 隐私政策 | 必须有独立页面 | ⚠️ 需开发 |
| 用户协议 | 必须有独立页面 | ⚠️ 需开发 |
| 首次启动弹窗 | 明示收集信息用途 | ⚠️ 需开发 |
| 健康类资质 | 如涉及医疗需资质 | ⚠️ 提前准备 |
| 免责声明 | AI建议需标注仅供参考 | ⚠️ 需开发 |

### 6.2 必要页面

```
/pages/privacy/index     # 隐私政策
/pages/agreement/index   # 用户协议
/pages/disclaimer/index  # 免责声明（可选，可合并到隐私页）
```

### 6.3 弹窗时机

```typescript
// app.ts onLaunch
async onLaunch() {
  const accepted = Taro.getStorageSync('privacy_accepted')
  if (!accepted) {
    await this.showPrivacyModal()
  }
}

async showPrivacyModal() {
  return new Promise<void>((resolve) => {
    Taro.showModal({
      title: '隐私政策声明',
      content: '本小程序将收集您的健康数据用于提供个性化配方建议...\n\n' +
               '请阅读并同意《隐私政策》和《用户协议》后继续使用。',
      confirmText: '同意并继续',
      cancelText: '退出',
      success: (res) => {
        if (res.confirm) {
          Taro.setStorageSync('privacy_accepted', true)
          Taro.navigateTo({ url: '/pages/privacy/index' })
          resolve()
        } else {
          Taro.exitMiniProgram()
        }
      }
    })
  })
}
```

---

## 七、预算估算

### 7.1 开发成本

| 项目 | 预算 | 说明 |
|------|------|------|
| 人力成本 | ¥50,000 | 2人×8周（前端+后端） |
| 云服务 | ¥3,000/年 | 服务器+数据库+CDN |
| 微信认证 | ¥300/年 | 企业主体认证 |
| 域名+SSL | ¥500/年 | HTTPS required |
| 云开发（可选） | ¥2,000/年 | 云函数+云数据库 |
| **总计** | **¥56,000** | 首年 |

### 7.2 运营成本

| 项目 | 预算 | 说明 |
|------|------|------|
| AI API调用 | ¥2,000/月 | 按量计费 |
| 服务器维护 | ¥500/月 | 日常运维 |
| 审核续费 | ¥300/年 | 企业认证年费 |
| **月度运营** | **¥2,500** | |

---

## 八、下一步行动

### 立即行动（本周）

1. ✅ 确认V4.0方案
2. ⏳ 申请微信小程序账号
3. ⏳ 配置微信开发者工具
4. ⏳ 初始化Taro项目脚手架

### 近期行动（第1周）

1. 搭建项目结构
2. 实现请求层和流式输出
3. 开发微信登录接口（后端）
4. 设计隐私政策页面

### 中期行动（第2-4周）

1. 开发核心功能（AI对话、配方浏览）
2. 实现Zustand状态管理
3. 添加隐私合规弹窗
4. 真机调试

### 远期行动（第5-8周）

1. 性能优化
2. 微信审核提交
3. 上线发布
4. 数据监控部署

---

## 九、总结

**V3.0方案技术可行，建议按V4.0实施指南推进。**

核心要点：
1. ✅ 后端SSE端点已完整，前端只需正确消费
2. ✅ Zustand需自定义storage适配器
3. ⚠️ 必须补充隐私合规页面和弹窗
4. ⚠️ 建议延长至10周（含审核buffer）
5. 💰 首年预算约¥56,000

---

*文档版本：V4.0 | 编制：RMFOOD架构组 | 日期：2026-09-05*
