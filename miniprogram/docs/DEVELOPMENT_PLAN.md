# RMFOOD 小程序专业开发方案

## 当前状态分析

### ✅ 已完成
- 基础页面框架（12个页面）
- 分包架构（chat/formulas/ingredient/profile）
- Icon组件系统（SVG实现）
- API层封装（database/compliance）
- 首页快捷功能区

### ⚠️ 需要优化
1. **TabBar国际化** - 使用英文标签
2. **首页视觉打磨** - 卡片样式、间距、动画
3. **数据绑定验证** - 确保所有WXML变量存在
4. **组件复用规范** - 统一使用Icon组件
5. **加载状态优化** - 骨架屏完善

---

## 开发计划

### Phase 1: TabBar 中文化
- [x] 修改 app.json TabBar 文本为中文
- [ ] 添加中文标签图标（如有需要）

### Phase 2: 首页视觉升级
- [x] 快捷功能区 2行3列布局
- [ ] 健康提示卡片优化
- [ ] 配方卡片样式统一
- [ ] 热门原料横向滚动优化

### Phase 3: 数据层完善
- [x] API封装（database.js, compliance.js）
- [ ] 首页数据加载逻辑优化
- [ ] 缓存策略实施

### Phase 4: 组件系统升级
- [x] Icon SVG组件
- [ ] GlobalIcons 完善
- [ ] 公共组件测试

### Phase 5: 测试与调试
- [ ] 编译错误修复
- [ ] 真机测试准备

---

## 设计规范

### 颜色体系
| 用途 | 颜色值 | 说明 |
|------|--------|------|
| 主色 | #2D5A3D | 草本绿 |
| 辅助绿 | #4A7C5C | 浅绿 |
| 强调蓝 | #1976D2 | AI/科技 |
| 强调橙 | #E65100 | 配方/活力 |
| 强调紫 | #7B1FA2 | 历史/数据 |
| 强调青 | #00838F | 检索/数据库 |
| 强调红 | #C62828 | 合规/警告 |

### 间距系统
- 大间距: 48rpx
- 中标距: 32rpx
- 小间距: 16rpx
- 极小: 8rpx

### 字体系统
- 页面标题: 40rpx bold
- 区块标题: 32rpx semibold
- 正文: 28rpx normal
- 辅助: 24rpx muted
- 说明: 22rpx tiny

---

## 文件清单

### 已创建
- pages/database/index.* (4 files)
- pages/compliance/index.* (4 files)
- utils/database.js
- utils/compliance.js
- components/GlobalIcons/index.wxml (51 SVG icons)
- components/Icon/index.wxml (SVG实现)

### 已修改
- app.json (注册新页面)
- utils/api.js (添加服务导出)
- pages/index/index.wxml (快捷功能区)
- pages/index/index.wxss (样式更新)
- README.md (文档更新)
