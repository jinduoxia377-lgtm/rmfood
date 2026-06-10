/**
 * Analytics 页面稳定性保障配置
 * 解决 Vite HMR 动态导入失败问题
 */

// ─── 问题诊断记录 ───
/**
 * 【已解决的问题】net::ERR_ABORTED 动态导入失败
 * 
 * 根因分析:
 * 1. Vite HMR (Hot Module Replacement) 缓存不一致
 *    - 浏览器缓存了旧版本的模块（ReportsTab.tsx?t=old_timestamp）
 *    - 服务端已重新编译新版本（AnalyticsPage.tsx?t=new_timestamp）
 *    - 时间戳不匹配导致模块校验失败
 *
 * 2. 模块依赖图损坏
 *    - Vite 的模块依赖图在频繁修改后可能出现不一致
 *    - 导致动态 import() 无法正确解析模块链
 *
 * 3. TypeScript 编译缓存冲突
 *    - .vite-cache 中缓存的 AST（抽象语法树）与源码不同步
 *    - 导致增量编译产生错误的输出
 *
 * 触发条件:
 * - 频繁修改 analytics 相关文件
 * - 快速保存多个文件
 * - Vite 开发服务器长时间运行未重启
 * - 浏览器标签页长时间未刷新
 */

// ─── 预防措施 ───

/**
 * 措施1: 强制清除浏览器缓存
 * 
 * 使用方法:
 * 1. Chrome/Edge: Ctrl + Shift + Delete 打开"清除浏览数据"
 * 2. 选择"缓存的图片和文件"
 * 3. 时间范围选择"全部"
 * 4. 点击"清除数据"
 * 
 * 或使用快捷键:
 * - Chrome: Ctrl + Shift + R (强制刷新)
 * - Firefox: Ctrl + F5 (忽略缓存刷新)
 */
const BROWSER_CACHE_CLEAR_STEPS = [
  '关闭所有 localhost:3000 标签页',
  '打开开发者工具 (F12)',
  '右键点击刷新按钮 → 选择"清空缓存并硬性重新加载"',
  '或在Console中执行: location.reload(true)'
]

/**
 * 措施2: Vite 开发服务器维护
 * 
 * 建议频率: 每次大规模代码修改后
 * 
 * 操作命令:
 * # 停止当前运行的 dev server
 * Ctrl+C
 * 
 * # 清理缓存
 * rm -rf .vite-cache node_modules/.vite dist
 * 
 * # 重启开发服务器
 * npm run dev
 */
const VITE_SERVER_MAINTENANCE = {
  cacheDirs: ['.vite-cache', 'node_modules/.vite', 'dist'],
  restartCommand: 'npm run dev',
  recommendedInterval: '每次修改超过3个文件后'
}

/**
 * 措施3: 代码层面防护
 * 
 * 在 vite.config.ts 中添加以下配置可预防此类问题:
 */
const RECOMMENDED_VITE_CONFIG = {
  server: {
    fs: {
      strict: false // 允许文件系统访问
    },
    watch: {
      usePolling: true, // 使用轮询代替文件监听（更稳定）
      interval: 1000     // 轮询间隔(ms)
    }
  },
  build: {
    target: 'esnext',   // 构建目标
    sourcemap: true,     // 生成source map便于调试
  },
  optimizeDeps: {
    include: []          // 强制预构建的依赖列表
  }
}

// ─── 应急修复脚本 ───

/**
 * 紧急修复流程（当再次遇到 ERR_ABORTED 时）
 */
export const EMERGENCY_FIX_SCRIPT = `
=== Analytics 页面紧急修复流程 ===

步骤 1: 停止开发服务器
  - 在运行 dev server 的终端按 Ctrl+C
  
步骤 2: 清除所有缓存
  PowerShell:
    cd frontend
    Remove-Item -Recurse -Force .vite-cache,node_modules/.vite,dist -ErrorAction SilentlyContinue
    
  Bash/Linux:
    cd frontend && rm -rf .vite-cache node_modules/.vite dist
  
步骤 3: 清除浏览器缓存
  - 按 Ctrl+Shift+Delete
  - 选择 "缓存的图片和文件"
  - 时间范围: "全部"
  - 点击 "清除数据"
  
步骤 4: 重启开发服务器
  npm run dev
  
步骤 5: 强制刷新页面
  - 打开 http://localhost:3000/analytics
  - 按 Ctrl+Shift+R (Windows) 或 Cmd+Shift+R (Mac)
  
步骤 6: 验证修复
  - 打开浏览器控制台 (F12)
  - 确认无红色 [error] 日志
  - 确认页面正常渲染
`

// ─── 监控指标 ───

export const STABILITY_METRICS = {
  pageLoadTime: '< 2s',           // 首屏加载时间
  consoleErrors: 0,               // 控制台错误数
  moduleLoadSuccess: true,         // 模块加载成功率
  hmrUpdateLatency: '< 500ms',    // HMR更新延迟
  memoryUsage: '< 200MB',          // 内存占用
}

// ─── 长期优化建议 ───

export const LONG_TERM_OPTIMIZATIONS = [
  {
    priority: 'P0',
    item: '启用 Vite 文件轮询模式',
    config: 'server.watch.usePolling = true',
    reason: '避免文件系统事件监听的不一致问题'
  },
  {
    priority: 'P0', 
    item: '增加构建超时时间',
    config: 'build.timeout = 120000',
    reason: '防止大型项目编译超时'
  },
  {
    priority: 'P1',
    item: '定期清理缓存',
    frequency: '每天至少一次或每次大改动后',
    reason: '防止缓存累积导致的不一致'
  },
  {
    priority: 'P2',
    item: '考虑升级到 Vite 5.x',
    currentVersion: '检查 package.json',
    reason: '新版改进了HMR稳定性和错误恢复能力'
  }
]

export default {
  BROWSER_CACHE_CLEAR_STEPS,
  VITE_SERVER_MAINTENANCE,
  RECOMMENDED_VITE_CONFIG,
  EMERGENCY_FIX_SCRIPT,
  STABILITY_METRICS,
  LONG_TERM_OPTIMIZATIONS
}
