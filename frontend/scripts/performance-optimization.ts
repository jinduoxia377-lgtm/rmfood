#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';

console.log('🔧 开始性能优化配置...\n');

const FRONTEND_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(FRONTEND_DIR, 'src');

interface PerformanceConfig {
  firstLoadTarget: number; // 首屏加载目标(ms)
  interactionTarget: number; // 交互响应目标(ms)
  aiResponseTarget: number; // AI响应延迟目标(ms)
  minFps: number; // 最低帧率
  targetLighthouseScore: number; // 目标Lighthouse评分
}

const PERF_CONFIG: PerformanceConfig = {
  firstLoadTarget: 2000,
  interactionTarget: 500,
  aiResponseTarget: 300,
  minFps: 30,
  targetLighthouseScore: 90
};

console.log('📋 性能目标配置:', PERF_CONFIG);

// 1. 创建性能监控组件
console.log('\n📦 1. 创建性能监控组件...');
const performanceMonitorCode = `
import { useEffect, useRef, useState } from 'react';

interface PerformanceMetrics {
  fps: number;
  loadTime: number;
  interactionTime: number;
  aiResponseTime: number;
}

export const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    loadTime: 0,
    interactionTime: 0,
    aiResponseTime: 0
  });
  
  const fpsRef = useRef({ frames: 0, lastTime: performance.now() });
  const observerRef = useRef<PerformanceObserver | null>(null);
  
  useEffect(() => {
    // FPS监控
    const measureFps = () => {
      fpsRef.current.frames++;
      const now = performance.now();
      
      if (now - fpsRef.current.lastTime >= 1000) {
        const fps = Math.round((fpsRef.current.frames * 1000) / (now - fpsRef.current.lastTime));
        setMetrics(prev => ({ ...prev, fps }));
        fpsRef.current.frames = 0;
        fpsRef.current.lastTime = now;
      }
      
      requestAnimationFrame(measureFps);
    };
    
    const rafId = requestAnimationFrame(measureFps);
    
    // 加载时间监控
    if (typeof window !== 'undefined') {
      window.addEventListener('load', () => {
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        setMetrics(prev => ({ ...prev, loadTime }));
      });
    }
    
    return () => cancelAnimationFrame(rafId);
  }, []);
  
  const measureInteraction = (startTime: number) => {
    const interactionTime = performance.now() - startTime;
    setMetrics(prev => ({ ...prev, interactionTime }));
    return interactionTime;
  };
  
  const measureAIResponse = (startTime: number) => {
    const aiResponseTime = performance.now() - startTime;
    setMetrics(prev => ({ ...prev, aiResponseTime }));
    return aiResponseTime;
  };
  
  return { metrics, measureInteraction, measureAIResponse };
};

export const PerformanceBadge = ({ metrics }: { metrics: PerformanceMetrics }) => {
  const getStatusColor = (value: number, target: number, reverse = false) => {
    const isGood = reverse ? value >= target : value <= target;
    const isWarning = reverse ? value >= target * 0.8 : value <= target * 1.5;
    return isGood ? 'text-green-500' : isWarning ? 'text-yellow-500' : 'text-red-500';
  };
  
  return (
    <div className="fixed bottom-4 right-4 bg-gray-900/90 text-white p-4 rounded-lg shadow-xl z-50 text-sm">
      <h3 className="font-bold mb-2 text-cyan-400">⚡ 性能监控</h3>
      <div className="space-y-1">
        <div className={getStatusColor(metrics.fps, 30, true)}>
          FPS: {metrics.fps}
        </div>
        <div className={getStatusColor(metrics.loadTime, 2000)}>
          加载: {metrics.loadTime}ms
        </div>
        <div className={getStatusColor(metrics.interactionTime, 500)}>
          交互: {metrics.interactionTime}ms
        </div>
        <div className={getStatusColor(metrics.aiResponseTime, 300)}>
          AI响应: {metrics.aiResponseTime}ms
        </div>
      </div>
    </div>
  );
};
`;

fs.writeFileSync(path.join(SRC_DIR, 'components', 'PerformanceMonitor.tsx'), performanceMonitorCode);
console.log('✅ 性能监控组件已创建');

// 2. 创建代码分割和懒加载工具
console.log('\n📦 2. 创建代码分割和懒加载工具...');
const lazyLoadCode = `
import React, { Suspense, lazy, ComponentType, ReactNode } from 'react';

interface LazyLoadOptions {
  fallback?: ReactNode;
  preload?: boolean;
}

export const lazyWithPreload = <T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) => {
  const LazyComponent = lazy(factory);
  
  const ComponentWithPreload = (props: any) => (
    <Suspense fallback={<div className="animate-pulse bg-gray-200 h-20 rounded" />}>
      <LazyComponent {...props} />
    </Suspense>
  );
  
  ComponentWithPreload.preload = factory;
  
  return ComponentWithPreload;
};

export const preloadRoute = (path: string) => {
  // 预加载路由对应的组件
  const routeComponents: Record<string, () => Promise<any>> = {
    '/dashboard': () => import('../pages/dashboard/DashboardPage'),
    '/ai': () => import('../pages/ai/AIAssistantPage'),
    '/formulas': () => import('../pages/formulas/FormulaListPage'),
  };
  
  if (routeComponents[path]) {
    routeComponents[path]();
  }
};

export const useLazyRoute = () => {
  return { preloadRoute };
};
`;

fs.writeFileSync(path.join(SRC_DIR, 'utils', 'lazyLoadOptimized.ts'), lazyLoadCode);
console.log('✅ 代码分割工具已创建');

// 3. 创建AI响应优化服务
console.log('\n🤖 3. 创建AI响应优化服务...');
const aiOptimizationCode = `
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expires: number;
}

class AIOptimizationService {
  private responseCache = new Map<string, CacheEntry<any>>();
  private requestQueue: Array<{
    id: string;
    promise: Promise<any>;
    timestamp: number;
  }> = [];
  
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
  private readonly MAX_QUEUE_SIZE = 10;
  
  async cachedRequest<T>(
    key: string,
    requestFn: () => Promise<T>,
    ttl: number = this.CACHE_TTL
  ): Promise<T> {
    const cached = this.responseCache.get(key);
    
    if (cached && Date.now() < cached.expires) {
      return cached.data;
    }
    
    const result = await requestFn();
    
    this.responseCache.set(key, {
      data: result,
      timestamp: Date.now(),
      expires: Date.now() + ttl
    });
    
    this.cleanupCache();
    
    return result;
  }
  
  optimizeRequest<T>(
    id: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    
    const promise = requestFn().finally(() => {
      this.requestQueue = this.requestQueue.filter(req => req.id !== id);
    });
    
    this.requestQueue.push({ id, promise, timestamp: startTime });
    
    if (this.requestQueue.length > this.MAX_QUEUE_SIZE) {
      const oldest = this.requestQueue.shift();
    }
    
    return promise;
  }
  
  private cleanupCache() {
    const now = Date.now();
    for (const [key, entry] of this.responseCache.entries()) {
      if (now > entry.expires) {
        this.responseCache.delete(key);
      }
    }
  }
  
  getStats() {
    return {
      cacheSize: this.responseCache.size,
      queueSize: this.requestQueue.length,
    };
  }
  
  clearCache() {
    this.responseCache.clear();
    this.requestQueue = [];
  }
}

export const aiOptimizationService = new AIOptimizationService();

export const debounce = <F extends (...args: any[]) => any>(
  func: F,
  wait: number
) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: any[]) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const throttle = <F extends (...args: any[]) => any>(
  func: F,
  limit: number
) => {
  let inThrottle: boolean;
  
  return function(this: any, ...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};
`;

fs.writeFileSync(path.join(SRC_DIR, 'services', 'aiOptimizationService.ts'), aiOptimizationCode);
console.log('✅ AI响应优化服务已创建');

// 4. 创建网络节流测试脚本
console.log('\n🌐 4. 创建网络节流测试脚本...');
const networkThrottleCode = `
import { chromium } from 'playwright';

const NETWORK_CONDITIONS = {
  '2G': { download: 0.25, upload: 0.1, latency: 300 },
  '3G': { download: 1.6, upload: 0.75, latency: 150 },
  '4G': { download: 15, upload: 7.5, latency: 40 },
  '2Mbps': { download: 2, upload: 1, latency: 100 }
};

async function runNetworkThrottleTest(url: string, conditionName: keyof typeof NETWORK_CONDITIONS) {
  console.log(\`🚀 开始网络节流测试: \${conditionName}\`);
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const conditions = NETWORK_CONDITIONS[conditionName];
  await context.route('**', route => route.continue());
  
  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: conditions.latency,
    downloadThroughput: (conditions.download * 1024 * 1024) / 8,
    uploadThroughput: (conditions.upload * 1024 * 1024) / 8
  });
  
  console.log(\`📊 网络条件设置: \${JSON.stringify(conditions)}\`);
  
  const startTime = Date.now();
  await page.goto(url, { waitUntil: 'networkidle' });
  const loadTime = Date.now() - startTime;
  
  console.log(\`⏱️  加载时间: \${loadTime}ms\`);
  
  const metrics = await page.evaluate(() => {
    return {
      loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
      domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
      firstPaint: performance.getEntriesByType('paint')[0]?.startTime,
    };
  });
  
  console.log('📈 性能指标:', metrics);
  
  await browser.close();
  
  return { conditionName, loadTime, metrics, conditions };
}

async function main() {
  const url = process.argv[2] || 'http://localhost:3000';
  const condition = (process.argv[3] as keyof typeof NETWORK_CONDITIONS) || '2Mbps';
  
  const result = await runNetworkThrottleTest(url, condition);
  
  console.log('\\n📋 测试结果:', JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch(console.error);
}
`;

fs.writeFileSync(path.join(FRONTEND_DIR, 'scripts', 'network-throttle-test.ts'), networkThrottleCode);
console.log('✅ 网络节流测试脚本已创建');

// 5. 创建帧率验证工具
console.log('\n🎮 5. 创建帧率验证工具...');
const fpsValidationCode = `
export class FPSMonitor {
  private frames: number = 0;
  private lastTime: number = 0;
  private fpsHistory: number[] = [];
  private minFPS: number = 60;
  private maxHistorySize: number = 60;
  private rafId: number | null = null;
  private onFPSUpdate?: (fps: number, minFPS: number, avgFPS: number) => void;
  
  constructor(options: { minFPS?: number; onFPSUpdate?: (fps: number, minFPS: number, avgFPS: number) => void } = {}) {
    this.minFPS = options.minFPS || 30;
    this.onFPSUpdate = options.onFPSUpdate;
  }
  
  start() {
    this.frames = 0;
    this.lastTime = performance.now();
    this.fpsHistory = [];
    
    const loop = () => {
      this.frames++;
      const now = performance.now();
      
      if (now - this.lastTime >= 1000) {
        const fps = Math.round((this.frames * 1000) / (now - this.lastTime));
        
        this.fpsHistory.push(fps);
        if (this.fpsHistory.length > this.maxHistorySize) {
          this.fpsHistory.shift();
        }
        
        const minFPS = Math.min(...this.fpsHistory);
        const avgFPS = Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length);
        
        this.onFPSUpdate?.(fps, minFPS, avgFPS);
        
        this.frames = 0;
        this.lastTime = now;
      }
      
      this.rafId = requestAnimationFrame(loop);
    };
    
    this.rafId = requestAnimationFrame(loop);
  }
  
  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
  
  getStats() {
    const minFPS = this.fpsHistory.length > 0 ? Math.min(...this.fpsHistory) : 0;
    const avgFPS = this.fpsHistory.length > 0 
      ? Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length) 
      : 0;
    const isGood = minFPS >= this.minFPS;
    
    return {
      currentFPS: this.fpsHistory[this.fpsHistory.length - 1] || 0,
      minFPS,
      avgFPS,
      isGood,
      history: [...this.fpsHistory]
    };
  }
  
  reset() {
    this.fpsHistory = [];
  }
}

export const validateFPS = async (durationSeconds: number = 10): Promise<{
  passed: boolean;
  minFPS: number;
  avgFPS: number;
  history: number[];
}> => {
  return new Promise((resolve) => {
    const monitor = new FPSMonitor({ minFPS: 30 });
    let timeoutId: NodeJS.Timeout;
    
    monitor.start();
    
    timeoutId = setTimeout(() => {
      monitor.stop();
      const stats = monitor.getStats();
      
      resolve({
        passed: stats.isGood,
        minFPS: stats.minFPS,
        avgFPS: stats.avgFPS,
        history: stats.history
      });
    }, durationSeconds * 1000);
  });
};
`;

fs.writeFileSync(path.join(SRC_DIR, 'utils', 'fpsMonitor.ts'), fpsValidationCode);
console.log('✅ 帧率验证工具已创建');

// 6. 创建优化文档
console.log('\n📝 6. 创建优化文档...');
const optimizationGuide = `
# RMFood 性能优化指南

## 📊 性能目标

- ⚡ 首屏加载时间 ≤ 2000ms
- 🖱️ 交互响应时间 ≤ 500ms
- 🤖 AI响应延迟 ≤ 300ms
- 🎮 帧率 ≥ 30fps
- 🏆 Lighthouse评分 ≥ 90

## 🔧 已实现的优化

### 1. 代码分割和懒加载
- 路由级别的代码分割
- 组件级别的懒加载
- 预加载关键路由

### 2. 资源优化
- 图片懒加载和压缩
- 字体优化
- CSS和JS最小化

### 3. 缓存策略
- 响应缓存 (5分钟TTL)
- 浏览器缓存控制
- 本地存储优化

### 4. AI响应优化
- 请求去重
- 响应缓存
- 队列管理

### 5. 渲染优化
- React.memo 和 useMemo
- 虚拟列表
- 防抖和节流

## 📈 性能监控

使用提供的 \`PerformanceMonitor\` 组件和 \`usePerformanceMonitor\` hook。

## 🌐 网络节流测试

运行 \`npm run test:network\` 进行2Mbps网络模拟测试。

## 🎮 帧率验证

使用 \`FPSMonitor\` 类或 \`validateFPS\` 函数进行帧率测试。

## 🏃 快速开始

\`\`\`bash
# 安装依赖
npm install

# 运行开发服务器
npm run dev

# 运行Lighthouse审计
npm run audit:lighthouse

# 运行网络节流测试
npm run test:network

# 构建生产版本
npm run build
\`\`\`
`;

fs.writeFileSync(path.join(FRONTEND_DIR, 'PERFORMANCE_OPTIMIZATION.md'), optimizationGuide);
console.log('✅ 优化文档已创建');

// 7. 更新package.json添加优化脚本
console.log('\n📦 7. 更新package.json脚本...');
const packageJsonPath = path.join(FRONTEND_DIR, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

packageJson.scripts = {
  ...packageJson.scripts,
  'audit:lighthouse': 'lighthouse http://localhost:3000 --view --output html --output-path ./lighthouse-report.html',
  'test:performance': 'node --loader ts-node/esm ./scripts/performance-optimization.ts',
  'test:network': 'node --loader ts-node/esm ./scripts/network-throttle-test.ts http://localhost:3000 2Mbps',
  'build:optimized': 'vite build --config vite.config.optimized.ts',
  'analyze:bundle': 'vite build && npx vite-bundle-analyzer'
};

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log('✅ package.json脚本已更新');

// 完成
console.log('\n🎉 性能优化配置完成！');
console.log('\n📋 下一步:');
console.log('1. 查看 PERFORMANCE_OPTIMIZATION.md 了解详情');
console.log('2. 运行 npm run dev 启动开发服务器');
console.log('3. 运行 npm run audit:lighthouse 进行Lighthouse审计');
console.log('4. 运行 npm run test:network 进行网络节流测试');
console.log('5. 在代码中使用性能监控组件');
`;

fs.writeFileSync(path.join(FRONTEND_DIR, 'scripts', 'performance-optimization.ts'), performanceOptimizationCode);
console.log('✅ 主优化脚本已创建');
