# RMFOOD 小程序重构方案
## —— 遵循微信小程序官方开发规范

---

## 一、问题分析

### 1.1 当前存在的问题

| 问题类型 | 具体问题 | 影响 |
|---------|---------|------|
| **项目结构混乱** | 根目录存在 `app.wxml`、`app.miniapp.json`、`project.miniapp.json` 等非标准文件 | 编译混淆 |
| **npm 配置不当** | weui-miniprogram 组件库配置复杂，导致路径错误 | 编译失败 |
| **usingComponents 重复** | app.json 和页面 json 同时定义 usingComponents | 可能冲突 |
| **子包结构不规范** | packages 目录结构不够清晰 | 维护困难 |
| **样式引入方式** | weui-wxss 导入路径可能不正确 | 样式缺失 |

### 1.2 官方规范要求

根据微信小程序官方文档 [目录结构](https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html)：

```
├── app.js                  # 小程序逻辑
├── app.json                # 小程序公共配置
├── app.wxss                # 小程序公共样式表
├── project.config.json     # 项目配置（工具生成）
├── sitemap.json            # 小程序搜索配置
├── pages/                  # 页面文件夹
│   └── index/
│       ├── index.js
│       ├── index.json
│       ├── index.wxml
│       └── index.wxss
├── components/             # 自定义组件目录
│   └── my-component/
│       ├── my-component.js
│       ├── my-component.json
│       ├── my-component.wxml
│       └── my-component.wxss
├── utils/                  # 工具函数目录
├── assets/                 # 资源文件目录
└── miniprogram_npm/        # npm 构建输出目录（自动）
```

---

## 二、重构方案

### 2.1 清理非标准文件

**删除以下文件：**
- `app.wxml` - 小程序没有全局 WXML
- `app.miniapp.json` - 非标准配置文件
- `project.miniapp.json` - 非标准配置文件
- `ARCHITECTURE.md`, `CHANGELOG.md`, `DEVELOPMENT_*.md` 等文档移到 docs/ 目录

### 2.2 规范 app.json 配置

```json
{
  "pages": [
    "pages/index/index",
    "pages/search/index",
    "pages/profile/index/index",
    "packages/chat/pages/index/index",
    "packages/formulas/pages/index/index",
    "packages/ingredient/pages/analysis/index"
  ],
  "subpackages": [
    {
      "root": "packages/chat",
      "name": "chat",
      "pages": ["pages/index/index"]
    },
    {
      "root": "packages/formulas",
      "name": "formulas",
      "pages": ["pages/index/index", "pages/detail/index"]
    },
    {
      "root": "packages/ingredient",
      "name": "ingredient",
      "pages": ["pages/analysis/index"]
    }
  ],
  "window": {
    "backgroundTextStyle": "light",
    "navigationBarBackgroundColor": "#2D5A3D",
    "navigationBarTitleText": "RMFOOD",
    "navigationBarTextStyle": "white"
  },
  "tabBar": {
    "color": "#999999",
    "selectedColor": "#2D5A3D",
    "backgroundColor": "#ffffff",
    "list": [
      {
        "pagePath": "pages/index/index",
        "text": "首页",
        "iconPath": "assets/icons/home.png",
        "selectedIconPath": "assets/icons/home-active.png"
      },
      {
        "pagePath": "packages/chat/pages/index/index",
        "text": "AI顾问",
        "iconPath": "assets/icons/chat.png",
        "selectedIconPath": "assets/icons/chat-active.png"
      },
      {
        "pagePath": "pages/search/index",
        "text": "搜索",
        "iconPath": "assets/icons/search.png",
        "selectedIconPath": "assets/icons/search-active.png"
      },
      {
        "pagePath": "pages/profile/index/index",
        "text": "我的",
        "iconPath": "assets/icons/profile.png",
        "selectedIconPath": "assets/icons/profile-active.png"
      }
    ]
  },
  "networkTimeout": {
    "request": 10000,
    "downloadFile": 10000
  },
  "style": "v2",
  "sitemapLocation": "sitemap.json"
}
```

**重要说明：**
- ❌ **不在 app.json 中定义 usingComponents** - 这是官方不推荐的做法
- ✅ 每个页面/组件在各自的 json 文件中定义 usingComponents
- ✅ 使用 `pages` 数组正确配置主包页面
- ✅ 使用 `subpackages` 正确配置分包

### 2.3 规范子包结构

```
packages/
├── chat/
│   ├── pages/
│   │   └── index/
│   │       ├── index.js
│   │       ├── index.json      ← 定义 usingComponents
│   │       ├── index.wxml
│   │       └── index.wxss
│   └── package.json            ← 子包配置（可选）
├── formulas/
│   ├── pages/
│   │   ├── index/
│   │   │   ├── index.js
│   │   │   ├── index.json
│   │   │   ├── index.wxml
│   │   │   └── index.wxss
│   │   └── detail/
│   │       ├── detail.js
│   │       ├── detail.json
│   │       ├── detail.wxml
│   │       └── detail.wxss
│   └── components/
└── ingredient/
    ├── pages/
    │   └── analysis/
    │       ├── analysis.js
    │       ├── analysis.json
    │       ├── analysis.wxml
    │       └── analysis.wxss
    └── components/
```

### 2.4 规范组件结构

```
components/
├── Button/
│   ├── button.js
│   ├── button.json           ← {"component": true, "usingComponents": {...}}
│   ├── button.wxml
│   └── button.wxss
├── Avatar/
│   ├── avatar.js
│   ├── avatar.json
│   ├── avatar.wxml
│   └── avatar.wxss
└── ...
```

**注意：**
- 组件文件名应与目录名一致（button.js 对应 Button/button.js）
- 组件的 json 文件必须包含 `"component": true`
- 组件的 usingComponents 只引用自身需要的子组件

### 2.5 npm 依赖配置

**方案：移除 weui-miniprogram，使用纯 CSS 方案**

```json
// package.json
{
  "dependencies": {
    "weui-wxss": "^2.6.26"
  }
}
```

```javascript
// project.config.json
{
  "setting": {
    "packNpmManually": true,
    "packNpmRelationList": [
      {
        "packageJsonPath": "./package.json",
        "miniprogramNpmDistDir": "./miniprogram_npm/"
      }
    ]
  }
}
```

**使用方式：**
```css
/* app.wxss */
@import 'miniprogram_npm/weui-wxss/dist/style/weui.wxss';
```

---

## 三、执行步骤

### Phase 1: 清理工作（Day 1）

1. 删除非标准文件
2. 整理文档到 docs/ 目录
3. 清理 package.json 中的无用依赖

### Phase 2: 规范配置（Day 2）

1. 重写 app.json
2. 配置正确的分包结构
3. 清理各页面的 json 配置

### Phase 3: 组件规范化（Day 3-4）

1. 检查所有组件的 json 配置
2. 确保组件文件名规范
3. 统一组件引用路径

### Phase 4: 测试验证（Day 5）

1. 编译测试
2. 功能测试
3. 性能测试

---

## 四、官方文档参考

- [小程序框架](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [目录结构](https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html)
- [小程序配置](https://developers.weixin.qq.com/miniprogram/dev/framework/config.html)
- [分包加载](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages.html)
- [自定义组件](https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/)
- [npm 支持](https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/npm-support.html)

---

**制定时间：** 2026-01-15
**状态：** 待执行
