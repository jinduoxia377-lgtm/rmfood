# RMCHM 药食同源图片问题 - 最终深度诊断报告

**诊断日期**: 2026-09-08
**问题状态**: 技术层已修复，需用户操作验证

---

## 一、问题描述

用户在前端 http://localhost:3000/databases 页面的「药食同源」标签页中，
点击药材卡片时看不到图片，甚至没有图片位置。

---

## 二、根本原因分析

### 2.1 字段不匹配问题（已修复）

API返回的字段名与前端代码引用不一致：

| 原代码引用 | API实际返回 | 问题 | 修复后 |
|-----------|------------|------|--------|
| `item.effects` | (不存在) | API无此字段 | `item.function_cn` |
| `item.compound_count` | `compounds_count` | 单复数不一致 | `item.compounds_count` |
| `item.category` | `category_cn` | 缺少后缀 | `item.category_cn` |
| `item.nameLatin` | `name_latin` | camelCase vs snake_case | 已有fallback |

### 2.2 浏览器缓存问题（需用户操作）

- 本地文件修改时间: 20:08
- Vite进程启动时间: 20:35
- 浏览器可能缓存了修改前的JS bundle

---

## 三、技术验证结果

### 3.1 后端验证

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 数据库记录 | ✅ | 127条药食同源，105条有image_path |
| API响应 | ✅ | 正常返回，含image_path字段 |
| 图片文件 | ✅ | 107张JPG存在于 backend/static/data/106FAM/ |
| 图片URL | ✅ | `http://localhost:3000/static/data/106FAM/八角.jpg` → 200 OK, image/jpeg |

### 3.2 前端验证

| 检查项 | 状态 | 详情 |
|--------|------|------|
| HomologyTab源码 | ✅ | 包含完整图片渲染逻辑 |
| 编译代码 | ✅ | 包含 `item.image_path ? <img> : <div>🌿</div>` |
| Vite代理 | ✅ | `/static` → `localhost:8000` 已配置并生效 |
| API调用 | ✅ | `searchRmchmHerbs({ food_homology_only: true })` |

---

## 四、卡片渲染结构确认

```
<Card className="p-4 hover:shadow-md ...">
  <div className="flex items-start gap-3">
    ├── [图片区域] w-10 h-10 rounded-xl flex-shrink-0
    │   └── item.image_path ? <img src="/static/..."> : <div>🌿</div>
    └── [内容区域] flex-1 min-w-0
        ├── 名称 + 药食同源Badge
        ├── 拉丁名 (name_latin)
        ├── 拼音 (name_pinyin)
        ├── 分类Badge (category_cn)
        ├── 性味 (nature_cn)
        └── OB% · 化合物数 (compounds_count)
  </div>
</Card>
```

---

## 五、修复清单

| 项目 | 文件 | 状态 |
|------|------|------|
| 图片文件迁移 | `backend/static/data/106FAM/` | ✅ 完成 |
| HomologyTab API切换 | `HomologyTab.tsx:71` | ✅ 完成 |
| HomologyTab图片渲染 | `HomologyTab.tsx:294-305` | ✅ 完成 |
| 字段修复: effects→function_cn | `HomologyTab.tsx:284` | ✅ 完成 |
| 字段修复: compound_count→compounds_count | `HomologyTab.tsx:332` | ✅ 完成 |
| 字段修复: category→category_cn | `HomologyTab.tsx:385` | ✅ 完成 |
| Vite代理配置 | `vite.config.ts:190-194` | ✅ 完成 |

---

## 六、用户验证步骤

### 步骤1: 直接测试图片URL ⭐ 最重要

在浏览器地址栏输入：
```
http://localhost:3000/static/data/106FAM/八角.jpg
```
- 如果能看见图片 → 代理正常，问题是浏览器缓存
- 如果看不见 → 代理配置有问题

### 步骤2: 强制刷新页面

按 `Ctrl+Shift+R` 强制刷新（清除浏览器缓存）

### 步骤3: 检查Network请求

1. 按 F12 打开开发者工具
2. 切换到 Network 标签
3. 勾选 "Disable cache"
4. 刷新页面（F5）
5. 点击「药食同源」Tab
6. 在 Filter 中输入 "img" 筛选图片请求
7. 查看 `/static/data/106FAM/*.jpg` 的请求状态

### 步骤4: 根据结果判断

| 状态码 | Content-Type | 含义 | 下一步 |
|--------|-------------|------|--------|
| 200 | image/jpeg | 图片加载成功 | 检查CSS样式 |
| 404 | text/html | 路径错误 | 检查image_path字段 |
| 0 | - | 网络问题 | 检查代理配置 |
| CORS错误 | - | 跨域问题 | 检查后端CORS配置 |

---

## 七、数据统计

### 7.1 药食同源图片覆盖

| 指标 | 数值 |
|------|------|
| 药食同源药材总数 | 127 |
| 有图片药材数 | 105 |
| 图片覆盖率 | 82.7% |
| 图片文件数 | 107 |

### 7.2 有图片的药食同源药材（部分）

| 药材名称 | 类别 | 化合物数 | 图片大小 |
|---------|------|---------|---------|
| 八角茴香 | 温里药 | 49 | 110KB |
| 白扁豆 | 补气药 | 14 | 81KB |
| 白果 | 止咳平喘药 | 50 | 87KB |
| 白芷 | 解表药 | 15 | - |
| 百合 | 润肺止咳药 | 10 | - |
| 薄荷 | 解表药 | 20 | - |

---

## 八、总结

**技术诊断结论**: 所有技术环节均正常工作。图片URL可正常访问，前端代码已正确修复字段不匹配问题。

**最可能的原因**: 浏览器缓存了旧的JS bundle。

**建议操作**: 按 `Ctrl+Shift+R` 强制刷新页面，然后查看药材卡片左侧是否有图片显示。

---

**报告完成！请按照上述验证步骤操作。**
