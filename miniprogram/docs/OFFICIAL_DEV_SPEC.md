# RMFOOD 小程序官方开发规范

> 基于微信小程序官方文档整理  
> 版本：V1.0 | 更新日期：2026-01-15 | 状态：✅ 已生效

---

## 一、项目结构（官方规范）

```
miniprogram/
├── app.js                    # 小程序逻辑入口
├── app.json                  # 全局配置（不含 usingComponents）
├── app.wxss                  # 全局样式
├── project.config.json       # 项目配置
├── package.json              # npm 依赖
├── sitemap.json              # 搜索配置
│
├── pages/                    # 主包页面
│   ├── index/
│   │   ├── index.js
│   │   ├── index.json        # 页面级 usingComponents
│   │   ├── index.wxml
│   │   └── index.wxss
│   ├── search/
│   ├── profile/
│   └── ...
│
├── components/               # 自定义组件
│   ├── Button/
│   │   ├── button.js
│   │   ├── button.json       # {"component": true, "usingComponents": {}}
│   │   ├── button.wxml
│   │   └── button.wxss
│   └── ...
│
├── packages/                 # 分包目录
│   ├── chat/
│   ├── formulas/
│   └── ingredient/
│
├── utils/                    # 工具函数
├── assets/                   # 静态资源
└── miniprogram_npm/          # npm 构建输出（自动生成）
```

**重要说明：**
- ❌ app.json 中**不定义** `usingComponents`，这是官方不推荐的做法
- ✅ 每个页面/组件在各自的 json 文件中定义 `usingComponents`
- ✅ 组件必须包含 `"component": true`

---

## 二、配置规范

### 2.1 app.json（全局配置）

```json
{
  "pages": [...],           // 主包页面列表
  "subpackages": [...],     // 分包配置
  "window": {...},          // 窗口样式
  "tabBar": {...},          // TabBar 配置
  "style": "v2",            // 使用新版样式
  "sitemapLocation": "sitemap.json"
}
```

**重要：** app.json 中**不定义** `usingComponents`。

### 2.2 页面 JSON（页面级配置）

```json
{
  "navigationBarTitleText": "页面标题",
  "navigationBarBackgroundColor": "#2D5A3D",
  "navigationBarTextStyle": "white",
  "usingComponents": {
    "icon": "../../components/Icon/index",
    "card": "../../components/Card/index"
  }
}
```

**路径规则：**
- 主包页面引用组件：`../../components/xxx/index`
- 子包页面引用主包组件：`../../../../components/xxx/index`
- 子包页面引用同包子组件：`../../../components/xxx/index`

### 2.3 组件 JSON（组件级配置）

```json
{
  "component": true,
  "usingComponents": {
    "icon": "../Icon/index"
  }
}
```

**必须包含：** `"component": true`

---

## 三、分包配置规范

### 3.1 app.json 分包配置

```json
{
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
    }
  ]
}
```

### 3.2 子包页面路径

| 类型 | 路径示例 |
|------|----------|
| 主包页面 | `pages/index/index` |
| 子包页面（app.json） | `packages/chat/pages/index/index` |
| 子包内部跳转 | `/packages/chat/pages/index/index` |
| tabBar 子包 | `packages/chat/pages/index/index` |

---

## 四、npm 依赖规范

### 4.1 package.json

```json
{
  "dependencies": {
    "weui-wxss": "^2.6.26"
  }
}
```

### 4.2 project.config.json

```json
{
  "setting": {
    "packNpmManually": true,
    "nodeModules": true,
    "packNpmRelationList": [
      {
        "packageJsonPath": "./package.json",
        "miniprogramNpmDistDir": "./miniprogram_npm/"
      }
    ]
  }
}
```

### 4.3 样式引入

```css
/* app.wxss */
@import 'miniprogram_npm/weui-wxss/dist/style/weui.wxss';
```

---

## 五、文件编码规范

### 5.1 UTF-8 without BOM

所有 `.js`、`.json`、`.wxml`、`.wxss` 文件必须使用 **UTF-8 without BOM** 编码。

**PowerShell 写入规范：**
```powershell
$content = '{...}'
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText("file.json", $content, $utf8NoBom)
```

**禁止使用：**
```powershell
# ❌ 会产生 BOM
Set-Content "file.json" -Value '{...}' -Encoding UTF8
```

---

## 六、组件命名规范

### 6.1 组件目录命名

- 使用 PascalCase：`Button/`、`Avatar/`、`NavBar/`
- 文件与目录同名：`Button/index.js`、`Button/index.json`

### 6.2 组件引用命名

- 使用 kebab-case：`<button>`, `<avatar>`, `<nav-bar>`
- 或使用 PascalCase：`<Button>`, `<Avatar>`

---

## 七、开发流程

### 7.1 新建页面

```bash
# 1. 创建目录和文件
mkdir pages/new-page
cd pages/new-page
touch new-page.js new-page.json new-page.wxml new-page.wxss

# 2. 在 app.json 添加页面路径
# "pages": [..., "pages/new-page/new-page"]
```

### 7.2 新建组件

```bash
# 1. 创建目录和文件
mkdir components/NewComponent
cd components/NewComponent
touch index.js index.json index.wxml index.wxss

# 2. 编辑 index.json
# {
#   "component": true,
#   "usingComponents": {}
# }

# 3. 在页面 json 中引用
# "usingComponents": {
#   "new-component": "../../components/NewComponent/index"
# }
```

### 7.3 新建分包

```bash
# 1. 创建分包目录结构
mkdir -p packages/new-package/pages/index

# 2. 在 app.json 添加分包配置
# "subpackages": [
#   {
#     "root": "packages/new-package",
#     "name": "new-package",
#     "pages": ["pages/index/index"]
#   }
# ]
```

---

## 八、常见错误及解决

### 8.1 ENOENT 文件不存在

**原因：** 组件路径错误
**解决：** 检查 relative path，确保路径正确

### 8.2 SyntaxError Unexpected token

**原因：** JSON 文件有 BOM
**解决：** 用无 BOM 的 UTF-8 编码重新保存

### 8.3 __route__ is not defined

**原因：** npm 包未正确构建
**解决：** 
1. 删除 miniprogram_npm 目录
2. 微信开发者工具 → 工具 → 构建 npm

### 8.4 组件样式不生效

**原因：** 样式隔离设置问题
**解决：** 在组件 json 中添加 `"styleIsolation": "apply-shared"`

---

## 九、性能优化建议

1. **分包加载：** 将非核心功能放入分包
2. **预下载：** 使用 `preloadRule` 预下载分包
3. **按需注入：** 使用 `lazyCodeLoading`
4. **图片优化：** 使用 WebP 格式，压缩图片
5. **懒加载：** 使用 `lazy-load` 属性

---

## 十、参考文档

- [小程序框架](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [目录结构](https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html)
- [小程序配置](https://developers.weixin.qq.com/miniprogram/dev/framework/config.html)
- [分包加载](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages.html)
- [自定义组件](https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/)
- [npm 支持](https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/npm-support.html)

---

**制定时间：** 2026-01-15
**版本：** V1.0
**状态：** 已生效
