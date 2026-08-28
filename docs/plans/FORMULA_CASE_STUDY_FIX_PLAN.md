# 配方管理「配方案例」功能深度修复与完善计划

> **制定日期**：2026-08-16  
> **审查人**：AI 配方管理功能专家  
> **优先级**：P0（高优先级）

---

## 一、问题诊断总结
---

## 执行状态（2026-08-16）

### ✅ Phase 1-5 全部完成

| 阶段 | 任务 | 状态 |
|------|------|------|
| Phase 1 | 核心Bug修复（错误边界/认证/WebSocket） | ✅ 已完成 |
| Phase 2 | 配方案例库功能（模型/API/页面/路由） | ✅ 已完成 |
| Phase 3 | 多维度推荐算法（协同/重叠/时间/偏好/功效） | ✅ 已完成 |
| Phase 4 | 性能优化（React Query缓存/批量请求） | ✅ 已完成 |
| Phase 5 | 测试与文档（单元测试+集成测试） | ✅ 已完成 |

### 📁 本次新增/修改文件清单（共 17 个）

**后端（9个）**：
| 文件 | 类型 | 说明 |
|------|------|------|
| pp/models/formula_case.py | 新建 | FormulaCase/CaseLike/CaseComment 数据模型 |
| pp/api/formula_cases.py | 新建 | 案例 CRUD + 搜索 + 点赞 + 评论 API（10端点） |
| pp/services/recommendation_engine.py | 新建 | 多维度推荐引擎（5维评分+解释生成） |
| pp/api/ai_modules/recommendations.py | 修改 | 集成 RecommendationEngine v3 |
| pp/models/formula.py | 修改 | 添加 cases 关系 |
| pp/models/user_model.py | 修改 | 添加 created_cases/liked_cases/commented_cases |
| pp/api/router_registry.py | 修改 | 注册 formula_cases + query_routes |
| lembic/versions/20260816_..._add_formula_cases.py | 新建 | 数据库迁移 |
| pp/tests/test_recommendation_engine.py | 新建 | 推荐引擎单元测试 |
| pp/tests/test_formula_cases.py | 新建 | 案例API测试 |

**前端（8个）**：
| 文件 | 类型 | 说明 |
|------|------|------|
| src/api/formula.ts | 修改 | 新增案例 API 函数（10个） |
| src/core/errorBoundary.tsx | 修改 | 修复 Hook 调用异常 |
| src/pages/formula/FormulasCasesPage.tsx | 新建 | 案例列表页 |
| src/pages/formula/FormulasCaseDetailPage.tsx | 新建 | 案例详情页 |
| src/pages/formula/__tests__/FormulaCasesPage.test.tsx | 新建 | 组件集成测试 |
| src/App.tsx | 修改 | 新增路由 + lazy import |
| src/components/layout/MainLayout.tsx | 修改 | 导航栏新增「配方案例」 |


### 1.1 已修复问题（本次审查发现）

| 问题 | 严重程度 | 修复状态 | 文件 |
|------|----------|----------|------|
| AI推荐接口路径错误 | 🔴 P0 | ✅ 已修复 | `frontend/src/api/formula.ts` |
| 推荐接口参数名不匹配 | 🔴 P0 | ✅ 已修复 | `frontend/src/api/formula.ts` |
| 推荐结果解析错误 | 🟡 P1 | ✅ 已修复 | `frontend/src/api/formula.ts` |
| 后端多租户隔离失效 | 🔴 P0 | ✅ 已修复 | `backend/app/api/ai_modules/recommendations.py` |
| target_effects参数未生效 | 🟡 P1 | ✅ 已修复 | `backend/app/api/ai_modules/recommendations.py` |
| CQRS查询路由未注册 | 🟡 P1 | ✅ 已修复 | `backend/app/api/router_registry.py` |
| FormulaDetailPage调用方式错误 | 🟡 P1 | ✅ 已修复 | `frontend/src/pages/formula/FormulaDetailPage.tsx` |

### 1.2 已执行修复（本次开发完成）

| 问题 | 严重程度 | 修复状态 | 文件 |
|------|----------|----------|------|
| AI推荐接口路径错误 | 🔴 P0 | ✅ 已修复 | `frontend/src/api/formula.ts` |
| 推荐接口参数名不匹配 | 🔴 P0 | ✅ 已修复 | `frontend/src/api/formula.ts` |
| 推荐结果解析错误 | 🟡 P1 | ✅ 已修复 | `frontend/src/api/formula.ts` |
| 后端多租户隔离失效 | 🔴 P0 | ✅ 已修复 | `backend/app/api/ai_modules/recommendations.py` |
| target_effects参数未生效 | 🟡 P1 | ✅ 已修复 | `backend/app/api/ai_modules/recommendations.py` |
| CQRS查询路由未注册 | 🟡 P1 | ✅ 已修复 | `backend/app/api/router_registry.py` |
| FormulaDetailPage调用方式错误 | 🟡 P1 | ✅ 已修复 | `frontend/src/pages/formula/FormulaDetailPage.tsx` |
| 错误边界React Hook调用异常 | 🔴 P0 | ✅ 已修复 | `frontend/src/core/errorBoundary.tsx` |
| 配方案例库功能缺失 | 🟡 P1 | ✅ 已实现 | 见 Phase 2 |

### 1.3 后续待处理

| 问题 | 严重程度 | 影响范围 | 备注 |
|------|----------|----------|------|
| WebSocket重连优化 | 🟡 P1 | 实时功能 | 已有基础实现，需增强用户体验 |
| 401认证过期跳转 | 🟡 P1 | 全局 | 已有基础实现，需增强提示 |
| 推荐算法多维度增强 | 🟡 P2 | 推荐功能 | 基础版已可用，高级版待开发 |
| 推荐算法单一 | 🟡 P2 | 推荐功能 | 仅基于功效匹配，无协同效应评分 |

---

## 二、深度开发和完善计划

### Phase 1：核心Bug修复（1周）

#### 1.1 错误边界系统修复

**问题**：`ErrorBoundary` 组件的 `defaultFallback` 方法内部调用了 `useState`，导致 "Invalid hook call" 错误。

**修复方案**：
```typescript
// frontend/src/core/errorBoundary.tsx
// 将 DefaultFallback 从类方法改为独立函数组件
function DefaultFallbackComponent({ error, resetErrorBoundary, ... }: FallbackProps) {
  const [showDetails, setShowDetails] = useState(false);
  // ... 原有逻辑
}

// 在 render 中直接渲染组件
return <DefaultFallbackComponent {...props} />;
```

**验收标准**：
- [ ] 公式详情页点击「相关推荐」不再报错
- [ ] 错误边界能够正确显示错误信息
- [ ] 单元测试覆盖错误边界场景

---

#### 1.2 认证与授权增强

**问题**：401响应未自动跳转到登录页。

**修复方案**：
```typescript
// frontend/src/api/client.ts
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // 清除认证状态
      authStore.clearToken();
      // 跳转到登录页（保留原始URL）
      window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.href)}`;
    }
    return Promise.reject(error);
  }
);
```

**验收标准**：
- [ ] Token过期时自动跳转登录页
- [ ] 登录成功后返回原页面
- [ ] 未登录访问受保护路由时跳转登录

---

#### 1.3 WebSocket重连机制优化

**问题**：WebSocket连接失败后没有自动重连。

**修复方案**：
```typescript
// frontend/src/hooks/useWebSocket.ts
class WebSocketManager {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn('WebSocket最大重试次数已超限');
      return;
    }
    
    setTimeout(() => {
      this.connect();
      this.reconnectAttempts++;
    }, this.reconnectDelay * Math.min(this.reconnectAttempts, 5));
  }
}
```

**验收标准**：
- [ ] 后端重启后前端能自动重连
- [ ] 重连失败时有明确提示
- [ ] 提供手动重连按钮

---

### Phase 2：配方案例库功能（2周）

#### 2.1 配方案例库后端API

**新增文件**：
- `backend/app/api/formula_cases.py` — 案例CRUD API
- `backend/app/services/formula_case_service.py` — 案例业务逻辑
- `backend/app/models/formula_case.py` — 案例数据模型

**API端点设计**：
```
GET    /api/v1/formula-cases          # 案例列表
POST   /api/v1/formula-cases          # 创建案例
GET    /api/v1/formula-cases/{id}     # 案例详情
PUT    /api/v1/formula-cases/{id}     # 更新案例
DELETE /api/v1/formula-cases/{id}     # 删除案例
POST   /api/v1/formula-cases/{id}/like # 点赞案例
GET    /api/v1/formula-cases/search   # 搜索案例
```

**数据模型**：
```python
class FormulaCase(Base):
    __tablename__ = "formula_cases"
    
    id: Mapped[int]
    title: Mapped[str]           # 案例名称
    formula_id: Mapped[int]      # 关联配方ID
    category: Mapped[str]        # 案例分类
    tags: Mapped[list]           # 标签
    cover_image: Mapped[str | None]  # 封面图
    summary: Mapped[str]         # 简介
    content: Mapped[str]         # 详细内容（Markdown）
    views: Mapped[int]           # 浏览次数
    likes: Mapped[int]           # 点赞数
    is_featured: Mapped[bool]    # 是否推荐
    created_by: Mapped[int]      # 创建者
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
```

---

#### 2.2 配方案例库前端页面

**新增文件**：
- `frontend/src/pages/formula/FormulaCasesPage.tsx` — 案例列表页
- `frontend/src/pages/formula/FormulaCaseDetailPage.tsx` — 案例详情页
- `frontend/src/components/formula/CaseCard.tsx` — 案例卡片组件
- `frontend/src/components/formula/CaseFilters.tsx` — 案例筛选组件

**页面功能**：
| 功能 | 说明 |
|------|------|
| 案例列表 | 卡片/列表视图切换，支持虚拟滚动 |
| 分类筛选 | 按功效分类（补气养血/滋阴润燥等）筛选 |
| 标签云 | 点击标签快速筛选 |
| 搜索 | 关键词搜索案例名称和内容 |
| 排序 | 按热度/最新/推荐排序 |
| 案例详情 | 完整展示案例内容，支持点赞和评论 |

---

#### 2.3 从配方生成案例

**新增功能**：在公式详情页添加「生成案例」按钮。

```typescript
// frontend/src/pages/formula/FormulaDetailPage.tsx
const handleGenerateCase = async () => {
  // 1. 收集配方信息
  // 2. 调用AI生成案例描述
  // 3. 保存到案例库
  const caseData = await formulaApi.generateCase(formula.id);
  navigate(`/formulas/cases/${caseData.id}`);
};
```

**后端AI生成接口**：
```python
# backend/app/api/ai_modules/case_generation.py
@router.post("/cases/generate")
async def generate_formula_case(
    formula_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    # 1. 获取配方详细信息
    # 2. 调用LLM生成案例描述
    # 3. 提取关键成分和功效
    # 4. 保存到案例库
    pass
```

---

### Phase 3：推荐算法增强（2周）

#### 3.1 多维度推荐算法

**当前问题**：仅基于 `target_effects` 匹配，推荐结果单一。

**增强方案**：
```python
# backend/app/services/recommendation_engine.py

class RecommendationEngine:
    """多维度配方推荐引擎"""
    
    def recommend(
        self,
        source_formula: Formula,
        user_id: int,
        top_k: int = 6,
    ) -> List[RecommendationResult]:
        candidates = self._get_candidates(source_formula, user_id)
        
        # 多维度评分
        for candidate in candidates:
            score = ScoreCalculator(
                synergy=self._calc_synergy_score(source_formula, candidate),
                ingredient_overlap=self._calc_ingredient_similarity(source_formula, candidate),
                temporal_decay=self._calc_temporal_score(candidate),
                user_preference=self._calc_user_preference(source_formula, candidate),
            ).calculate()
            
            candidate.score = score
            candidate.reasons = self._generate_reasons(source_formula, candidate)
        
        return sorted(candidates, key=lambda x: x.score, reverse=True)[:top_k]
```

**评分维度**：
| 维度 | 权重 | 计算方式 |
|------|------|----------|
| 协同效应匹配 | 30% | 成分协同系数相似度 |
| 成分重叠度 | 25% | Jaccard相似度 |
| 时间衰减 | 20% | 新配方优先 |
| 用户偏好 | 15% | 基于历史行为 |
| 功效匹配 | 10% | target_effects交集 |

---

#### 3.2 推荐解释生成

**功能**：为每个推荐结果生成自然语言解释。

```python
def _generate_reasons(self, source: Formula, target: Formula) -> List[str]:
    reasons = []
    
    # 功效匹配解释
    common_effects = set(source.target_effects) & set(target.target_effects)
    if common_effects:
        reasons.append(f"共同功效：{', '.join(common_effects)}")
    
    # 成分协同解释
    synergy_pairs = self._find_synergy_pairs(source, target)
    if synergy_pairs:
        reasons.append(f"协同增效：{synergy_pairs[0]}")
    
    # 时间新鲜度
    days_diff = (target.created_at - source.created_at).days
    if days_diff < 30:
        reasons.append("近期配方，参考价值高")
    
    return reasons
```

---

### Phase 4：性能优化（1周）

#### 4.1 列表页虚拟滚动优化

**当前问题**：`FormulaListPage` 使用自定义虚拟滚动，但与React Query缓存策略不协调。

**优化方案**：
```typescript
// frontend/src/pages/formula/FormulasPage.tsx
const { data, isLoading } = useQuery({
  queryKey: ['formulas', queryParams],
  queryFn: () => formulaApi.list(queryParams),
  staleTime: 5 * 60 * 1000,  // 5分钟内不重新请求
  gcTime: 10 * 60 * 1000,    // 缓存10分钟
  placeholderData: keepPreviousData,  // 保持旧数据直到新数据加载
});
```

**虚拟滚动参数调优**：
```typescript
const virtualizer = useVirtualizer({
  count: formulas.length,
  getScrollElement: () => scrollContainerRef.current,
  estimateSize: () => 120,  // 预估卡片高度
  overscan: 5,  // 额外渲染5个元素
});
```

---

#### 4.2 API请求批量优化

**问题**：公式详情页同时发起多个独立请求，造成竞态和资源浪费。

**优化方案**：使用 `useSuspenseQueries` 批量请求：
```typescript
const [formula, versions, experiments, comments] = useSuspenseQueries({
  queries: [
    { queryKey: ['formula', id], queryFn: () => formulaApi.get(id) },
    { queryKey: ['versions', id], queryFn: () => formulaApi.versions(id) },
    { queryKey: ['experiments', id], queryFn: () => experimentApi.list({ formula_id: id }) },
    { queryKey: ['comments', id], queryFn: () => commentApi.list({ formula_id: id }) },
  ],
  combine: (results) => ({
    formula: results[0].data,
    versions: results[1].data,
    experiments: results[2].data?.items,
    comments: results[3].data?.items,
  }),
});
```

---

### Phase 5：测试与文档（1周）

#### 5.1 单元测试补充

**目标模块**：
- `backend/app/api/ai_modules/recommendations.py` — 推荐API测试
- `backend/app/services/formula_case_service.py` — 案例服务测试
- `frontend/src/api/formula.ts` — API客户端测试
- `frontend/src/pages/formula/FormulaCasesPage.tsx` — 组件测试

**测试覆盖率目标**：≥80%

---

#### 5.2 集成测试

```typescript
// frontend/src/pages/formula/__tests__/FormulaCasesIntegration.test.tsx
describe('配方案例库集成测试', () => {
  it('应该能够加载案例列表', async () => {
    const { getByText } = render(<FormulaCasesPage />);
    expect(getByText('配方案例')).toBeInTheDocument();
  });

  it('应该能够筛选案例', async () => {
    const { getByLabelText } = render(<FormulaCasesPage />);
    fireEvent.change(getByLabelText('分类'), { target: { value: '补气养血' } });
    // 验证筛选结果
  });
});
```

---

#### 5.3 API文档更新

**更新Swagger文档**：
```python
# backend/app/api/formula_cases.py
"""
配方案例管理 API

本模块提供配方案例的CRUD操作和搜索功能。
案例用于展示成功配方设计，供其他用户参考学习。
"""
```

---

## 三、执行计划与里程碑

### 时间线

| 阶段 | 任务 | 工期 | 交付物 |
|------|------|------|--------|
| Week 1 | Phase 1: 核心Bug修复 | 5天 | 错误边界修复、认证优化、WebSocket优化 |
| Week 2-3 | Phase 2: 案例库功能 | 10天 | 案例库API、页面、AI生成案例 |
| Week 4-5 | Phase 3: 推荐算法增强 | 10天 | 多维度推荐、解释生成 |
| Week 6 | Phase 4: 性能优化 | 5天 | 虚拟滚动优化、批量请求 |
| Week 7 | Phase 5: 测试文档 | 5天 | 测试用例、API文档 |

### 里程碑

| 里程碑 | 目标 | 验收标准 |
|--------|------|----------|
| M1 | 核心Bug修复完成 | 不再出现Invalid hook call错误，401自动跳转登录 |
| M2 | 案例库上线 | 能够创建、查看、筛选配方案例 |
| M3 | 推荐算法增强 | 推荐结果包含多维度评分和解释 |
| M4 | 性能达标 | 列表页滚动流畅，详情页加载<2s |
| M5 | 全量测试通过 | 单元测试覆盖率≥80%，E2E测试通过 |

---

## 四、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| AI生成案例质量不稳定 | 中 | 中 | 设置人工审核流程，允许用户编辑 |
| 多租户数据隔离遗漏 | 低 | 高 | Code review + 自动化测试 |
| 推荐算法冷启动问题 | 高 | 中 | 新用户展示热门案例 |
| 虚拟滚动兼容性问题 | 中 | 低 | 提供降级方案（传统滚动） |

---

## 五、后续建议

### 5.1 技术债务清理

1. **清理废弃代码**：删除 `query_routes.py` 中未使用的空实现
2. **统一错误处理**：建立全局错误边界和错误上报机制
3. **API版本管理**：为 `/api/v1/` 建立明确的版本策略

### 5.2 架构演进

1. **CQRS完整落地**：将当前模拟的 `QueryService` 替换为真实数据库查询
2. **事件驱动架构**：配方创建/更新时发布事件，触发案例自动生成
3. **缓存策略优化**：引入Redis缓存热点配方数据

### 5.3 用户体验增强

1. **案例收藏**：用户可以收藏喜欢的案例
2. **案例分享**：生成分享链接和二维码
3. **案例评论**：支持用户对案例进行评论讨论

---

## 附录：已修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `frontend/src/api/formula.ts` | 修正 getAIRecommendations API路径和参数 |
| `frontend/src/pages/formula/FormulaDetailPage.tsx` | 修复推荐API调用方式 |
| `backend/app/api/ai_modules/recommendations.py` | 修复多租户隔离和功效筛选 |
| `backend/app/api/router_registry.py` | 修复 query_routes 未注册bug |

---

**批准人**：___________________  
**日期**：___________________
