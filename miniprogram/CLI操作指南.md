# RMFOOD 小程序自动化操作指南

## 微信开发者工具 CLI 配置

### 启用 CLI 服务端口（必须手动操作）

由于安全限制，CLI 服务端口无法通过脚本自动开启，需要手动在 IDE 中设置：

**操作步骤：**
1. 打开 **微信开发者工具**
2. 点击右上角 **设置 (⚙️)** → **安全设置**
3. 找到 **服务端口**，点击 **开启**
4. 输入授权码（如果提示）
5. 记住显示的端口号（默认 9221）

---

## CLI 命令参考

### 打开项目
```bash
"C:\Program Files (x86)\Tencent\微信web开发者工具\wechatidecli.cmd" open `
  --project "D:\RMFOODFP\miniprogram" `
  --port 9221 `
  --lang zh
```

### 编译 NPM 依赖
```bash
"C:\Program Files (x86)\Tencent\微信web开发者工具\wechatidecli.cmd" build-npm `
  --project "D:\RMFOODFP\miniprogram" `
  --port 9221
```

### 预览
```bash
"C:\Program Files (x86)\Tencent\微信web开发者工具\wechatidecli.cmd" preview `
  --project "D:\RMFOODFP\miniprogram" `
  --port 9221
```

### 上传小程序
```bash
"C:\Program Files (x86)\Tencent\微信web开发者工具\wechatidecli.cmd" upload `
  --project "D:\RMFOODFP\miniprogram" `
  --port 9221 `
  --version "1.0.0" `
  --remark "版本说明"
```

### 关闭项目
```bash
"C:\Program Files (x86)\Tencent\微信web开发者工具\wechatidecli.cmd" close `
  --project "D:\RMFOODFP\miniprogram" `
  --port 9221
```

### 退出 IDE
```bash
"C:\Program Files (x86)\Tencent\微信web开发者工具\wechatidecli.cmd" quit
```

### 清理缓存
```bash
"C:\Program Files (x86)\Tencent\微信web开发者工具\wechatidecli.cmd" cache clean
```

---

## 项目状态

| 项目 | 状态 |
|:-----|:----:|
| 后端 API (port 8000) | ✅ 运行中 |
| 前端页面 (72个JS文件) | ✅ 语法正确 |
| app.json 配置 | ✅ 已修复 |
| 配方详情页 | ✅ 已完成 |
| 药材详情页 | ✅ 已完成 |
| CSRF 保护 | ✅ 已修复 |
| 配料分析 API | ✅ 可用 |
| 微信开发者工具 CLI | ⚠️ 需手动开启服务端口 |

---

## 当前已知问题

1. **CLI 服务端口未开启** - 需手动在 IDE 设置中开启
2. **部分路由模块加载失败**（非致命）:
   - celery 模块未安装（影响 import_router）
   - plugin_registry 循环导入（影响 plugin_router）
   - API version router 初始化失败

以上问题不影响核心功能使用。
