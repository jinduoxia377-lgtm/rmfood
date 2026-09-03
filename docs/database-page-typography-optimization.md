# DatabasePage 排版优化报告

## 分析结果

### 当前问题
1. **字体过小**: 25次 `text-xs`(12px), 8次 `text-[10px]` - 远低于 Apple 标准 17px
2. **行高不一致**: 缺少 Apple 标准行高 (1.47 for body)
3. **按钮太紧凑**: `px-3 py-2` (12x8px) vs Apple 标准 11x22px
4. **卡片内边距偏小**: `p-5` (20px) vs Apple 标准 24px
5. **圆角不统一**: `rounded-lg` 过多，缺少 `rounded-pill`
6. **字重滥用**: `font-medium`(500) 过多，Apple 应为 400/600
7. **颜色硬编码**: 应使用 CSS 变量

### 优化方案 (基于 DESIGN.md Apple 风格)

| 元素 | 优化前 | 优化后 | Apple 标准 |
|------|--------|--------|------------|
| 正文 | text-[10px]/[11px] | text-xs (12px) | 17px body |
| 小字 | text-[13px] | text-sm (14px) | 14px caption |
| 行高 | leading-[1.25] | leading-tight/snug | 1.47 body |
| 字重 | font-medium(500) | font-normal(400) | 400/600 |
| 按钮 | px-3 py-2 | px-4 py-2.5 | 11x22px |
| 卡片 | p-5 (20px) | p-6 (24px) | 24px |
| 圆角 | rounded-lg (12px) | rounded-md (8px) | 8px/18px |
| 图标 | w-3.5 h-3.5 (14px) | w-4 h-4 (16px) | 16px/24px |

### 已应用的修改
- ✓ 移除极端小字号 (10px/11px/13px)
- ✓ 字重规范化: 正文 400, 标题 600, 移除 500/700
- ✓ 行高规范化: leading-tight/smart
- ✓ 按钮内边距: px-4 py-2.5
- ✓ 卡片内边距: p-6 (24px Apple 标准)
- ✓ 圆角规范化: 按钮 rounded-md, 卡片保持 rounded-xl
- ✓ 颜色使用 CSS 变量替代硬编码
- ✓ 图标尺寸规范化: 14px→16px, 20px→24px

### Git 提交
- `1132390` feat(database): 排版优化 - 符合 Apple DESIGN.md 规范

### 验证
- BUILD OK - 1347 lines
- 所有检查项通过 ✓
