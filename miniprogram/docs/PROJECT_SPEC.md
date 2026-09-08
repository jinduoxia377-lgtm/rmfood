# RMFOOD 小程序项目开发规范

## 一、文件编码规范（严格执行）

### UTF-8 without BOM

**所有项目文件必须使用 UTF-8 without BOM 编码**

#### 为什么需要这个规范？

微信小程序编译器对BOM非常敏感，会导致以下错误：
- `SyntaxError: Unexpected token '﻿'`
- `ENOENT: no such file or directory`
- JSON/WXML编译失败

#### PowerShell脚本规范

**❌ 错误方式（会产生BOM）：**
```powershell
# 不要使用这种方式
Set-Content "file.json" -Value '{...}' -Encoding UTF8
Out-File "file.json" -InputObject '{...}' -Encoding UTF8
```

**✅ 正确方式（无BOM）：**
```powershell
# 方式1：使用WriteAllText
$content = '{...}'
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText("file.json", $content, $utf8NoBom)

# 方式2：使用OutputEncoding
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
'{...}' | Out-File "file.json" -Encoding UTF8 -NoNewline
```

#### VS Code配置

1. 右下角状态栏显示 `UTF-8 with BOM` → 点击 → `Save with Encoding` → 选择 `UTF-8`
2. 永久设置：`文件` → `首选项` → `设置` → 搜索 `files.encoding` → 设置为 `utf8`

#### 批量检查和修复BOM

```powershell
# 检查所有文件
$files = Get-ChildItem . -Recurse -Include "*.json","*.js","*.wxml","*.wxss" -File |
    Where-Object { $_.FullName -notmatch 'node_modules|weui-miniprogram|.venv|miniprogram_npm' }

foreach ($file in $files) {
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        Write-Host "有BOM: $($file.FullName)" -ForegroundColor Yellow
        # 修复
        $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
        Write-Host "  ✅ 已修复" -ForegroundColor Green
    }
}
```

---

## 二、npm依赖管理

### weui-miniprogram配置

1. **安装依赖：**
   ```bash
   npm install weui-miniprogram --save
   ```

2. **复制依赖：**
   ```powershell
   # 手动复制到miniprogram_npm
   Copy-Item node_modules\weui-miniprogram -Destination miniprogram_npm\weui-miniprogram -Recurse
   ```

3. **project.config.json配置：**
   ```json
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

---

## 三、组件使用规范

### 禁止使用emoji作为图标

**❌ 错误：**
```xml
<text>🏠 首页</text>
<view>✅ 成功</view>
```

**✅ 正确：**
```xml
<icon name="home" size="md" color="var(--color-primary)" />
<text>首页</text>
<icon name="check" size="md" color="var(--color-success)" />
<text>成功</text>
```

### 使用统一的SVG图标系统

所有图标必须通过GlobalIcons组件使用：
```xml
<icon name="图标名称" size="尺寸" color="颜色" />
```

---

## 四、代码提交规范

### 提交前检查清单

- [ ] 所有JSON文件无BOM
- [ ] 所有JS文件无BOM
- [ ] 所有WXML文件无BOM
- [ ] 所有WXSS文件无BOM
- [ ] npm依赖已正确安装
- [ ] miniprogram_npm目录存在
- [ ] 编译无错误

---

## 五、常见问题

### Q: 编译报错 "Unexpected token '﻿'"
**A:** 文件有BOM，使用上面提供的脚本修复

### Q: 编译报错 "ENOENT: no such file or directory"
**A:** npm依赖未安装或miniprogram_npm目录缺失

### Q: 编译报错 "__route__ is not defined"
**A:** weui-miniprogram版本不兼容，升级weui-miniprogram到最新版本

---

## 七、微信小程序环境限制

### 禁止使用浏览器API

以下API在小程序环境中**不存在**，禁止使用：

```javascript
// ❌ 错误 - 小程序环境不存在document
document.addEventListener('touchstart', handler)
document.removeEventListener('touchstart', handler)
window.addEventListener('resize', handler)
window.location.href = '...'
```

**正确做法：**
```javascript
// ✅ 正确 - 使用小程序API
Page({
  onLoad() {
    // 页面级事件监听
    this.handleTouchStart = this.handleTouchStart.bind(this)
  },
  
  handleTouchStart(e) {
    // 处理触摸事件
  }
})
```

### 系统信息API更新

```javascript
// ❌ 废弃API
wx.getSystemInfoSync()

// ✅ 新API（推荐）
wx.getWindowInfo()      // 窗口信息
wx.getDeviceInfo()      // 设备信息
wx.getAppBaseInfo()     // 应用基础信息
wx.getSystemSetting()   // 系统设置
```

---

## 八、开发规范（严格执行）

- 微信开发者工具最新版本
- Node.js 16+
- npm 8+
- PowerShell 7+

---

**最后更新：** 2026-01-15