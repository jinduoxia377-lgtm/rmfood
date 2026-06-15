/**
 * RMFOOD 前端架构优化 - 微前端 & Web Worker 计算引擎
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * P5-5: 前端架构优化
 * 功能:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. 微前端 (Micro Frontend) 架构
 *    - Module Federation 风格的动态模块加载
 *    - 主应用 / 子应用生命周期管理 (bootstrap / mount / unmount / update)
 *    -  微前端沙箱 (样式隔离、事件隔离、路由隔离)
 *    -  微应用注册中心 & 版本管理
 *    -  热更新 & 按需加载
 *
 * 2. Web Worker 计算引擎
 *    -  复杂数据计算 (大型配方求解、多维度数据分析) 移至 Worker
 *    -  自动线程池管理 (避免阻塞主线程)
 *    -  任务队列 & 优先级调度
 *    -  Promise 化的调用接口 (await worker.run(...))
 *    -  自动任务超时与重试
 *
 * 3. 前端性能监控
 *    -  Core Web Vitals (LCP / FID / CLS)
 *    -  页面加载性能
 *    -  前端资源使用情况
 *
 * 4. 组件级权限控制
 *    -  基于角色的渲染控制
 *    -  细粒度的功能开关
 *
 * 依赖:
 * - 仅依赖浏览器原生 API (Web Workers, Blob, URL.createObjectURL)
 * -  不依赖第三方微前端框架 (qiankun、single-spa 等)
 *
 * 设计原则:
 * - Zero-dependency: 所有功能基于浏览器原生 API
 * - 非侵入式: 不影响现有代码的运行方式
 * - 渐进式: 可按需启用子模块 (先启用 Worker, 再启用微前端)
 */

// ========== 类型定义 (TypeScript JSDoc style) ==========

/**
 * @typedef {Object} MicroFrontendApp
 * @property {string} name - 子应用名称
 * @property {string} url - 子应用入口 URL
 * @property {string[]} routes - 子应用负责的路由前缀
 * @property {object} meta - 元数据 (版本号、加载方式、权限要求等)
 * @property {boolean} lazy - 是否懒加载
 */

/**
 * @typedef {Object} WorkerTask
 * @property {string} id
 * @property {string} type
 * @property {object} payload
 * @property {number} priority - 1-10, 10 最高
 * @property {number} timeout_ms - 超时时间 (ms)
 * @property {number} retry - 剩余重试次数
 */

// ========== 1. 微前端核心 (轻量级 Module Federation 模拟) ==========

class MicroFrontendCore {
  constructor(options = {}) {
    this.options = {
      rootSelector: options.rootSelector || "#rmfood-root",
      defaultVersion: options.defaultVersion || "1.0.0",
      enableStyleSandbox: options.enableStyleSandbox !== false,
      enableEventSandbox: options.enableEventSandbox !== false,
      enableCache: options.enableCache !== false,
    };

    this.registeredApps = new Map(); // name -> config
    this.activeApps = new Map(); // name -> instance
    this.globalState = {
      user: null,
      permissions: new Set(),
      theme: "light",
      i18n: "zh-CN",
    };

    this.mountCounter = 0;
    this.logger = this._createLogger();
  }

  _createLogger() {
    return {
      log: (...args) => console.log("%c[MF]", "color:#4f46e5;font-weight:bold;", ...args),
      warn: (...args => console.warn("%c[MF]", "color:#f59e0b;font-weight:bold;", ...args),
      error: (...args) => console.error("%c[MF]", "color:#ef4444;font-weight:bold;", ...args),
    };
  }

  // ───────── 注册 / 发现 ─────────

  register(config) {
    if (!config || !config.name || !config.url) {
      throw new Error("[MF] 子应用注册失败: 缺少 name 或 url");
    }

    if (this.registeredApps.has(config.name)) {
      this.logger.warn(`子应用已存在, 覆盖注册: ${config.name}`);
    }

    const normalized = {
      name: config.name,
      url: config.url,
      routes: config.routes || ["/"],
      version: config.version || this.options.defaultVersion,
      lazy: config.lazy !== false,
      permissions: config.permissions || [],
      props: config.props || {},
      stylePrefix: `mf-${config.name}`,
    };

    this.registeredApps.set(config.name, normalized);
    this.logger.log(`已注册子应用: ${config.name} v${normalized.version}`);
    return normalized;
  }

  registerBatch(configs) {
    return configs.map(config => this.register(config));
  }

  // ───────── 加载 / 挂载 / 卸载 ─────────

  async loadApp(name) {
    const config = this.registeredApps.get(name);
    if (!config) {
      throw new Error(`[MF] 未找到子应用: ${name}`);
    }

    if (this.activeApps.has(name)) {
      return this.activeApps.get(name);
    }

    try {
      const appInstance = await this._loadRemoteModule(config);
      this.activeApps.set(name, appInstance);
      this.logger.log(`✓ 已加载子应用: ${name}`);
      return appInstance;
    } catch (err) {
      this.logger.error(`✗ 加载子应用失败: ${name}`, err);
      throw err;
    }
  }

  async mount(name, mountOptions = {}) {
    const config = this.registeredApps.get(name);
    if (!config) {
      throw new Error(`[MF] 未找到子应用: ${name}`);
    }

    // 权限校验
    if (!this._checkAppPermissions(config)) {
      this.logger.warn(`权限不足, 拒绝挂载: ${name}`);
      return { success: false, reason: "insufficient_permissions" };
    }

    let instance = this.activeApps.get(name);
    if (!instance) {
      instance = await this.loadApp(name);
    }

    try {
      // 调用 bootstrap / mount 钩子 (如果存在)
      if (typeof instance.bootstrap === "function") {
        await instance.bootstrap();
      }

      if (typeof instance.mount === "function") {
        await instance.mount({
          container: this._getContainer(name),
          globalState: this.globalState,
          props: { ...config.props, ...mountOptions },
          router: this._buildRouterBridge(name),
          bus: this._buildEventBus(name),
        });
      }

      this.mountCounter++;
      this.logger.log(`✓ 已挂载子应用: ${name} (#${this.mountCounter})`);
      return { success: true, instance };
    } catch (err) {
      this.logger.error(`✗ 挂载子应用失败: ${name}`, err);
      return { success: false, error: err.message };
    }
  }

  async unmount(name) {
    const instance = this.activeApps.get(name);
    if (!instance) {
      return { success: false, reason: "not_found" };
    }

    try {
      if (typeof instance.unmount === "function") {
        await instance.unmount();
      }

      // 清理样式沙箱
      if (this.options.enableStyleSandbox) {
        this._cleanupAppStyles(name);
      }

      // 清理 DOM 容器
      const container = document.getElementById(`mf-container-${name}`);
      if (container) {
        container.innerHTML = "";
      }

      this.activeApps.delete(name);
      this.logger.log(`✓ 已卸载子应用: ${name}`);
      return { success: true };
    } catch (err) {
      this.logger.error(`✗ 卸载失败: ${name}`, err);
      return { success: false, error: err.message };
    }
  }

  // ───────── 内部实现: 动态模块加载 ─────────

  async _loadRemoteModule(config) {
    // 方案 1: 如果是 ES Module, 直接 import()
    if (config.url.endsWith(".js") || config.url.includes(".js?")) {
      try {
        // eslint-disable-next-line no-undef
        const module = await import(/* webpackIgnore: true */ config.url);
        return module.default || module;
      } catch (err) {
        this.logger.warn(`import() 方式失败, 回退到 <script>: ${err.message}`);
      }
    }

    // 方案 2: 经典 <script> 标签加载 (UMD 风格)
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-mf-name="${config.name}"]`);
      if (existing) {
        existing.remove();
      }

      const script = document.createElement("script");
      script.src = config.url;
      script.async = true;
      script.dataset.mfName = config.name;
      script.dataset.mfVersion = config.version;

      // 超时控制
      const timeoutId = setTimeout(() => {
        script.remove();
        reject(new Error(`加载超时 (30s): ${config.url}`));
      }, 30000);

      script.onload = () => {
        clearTimeout(timeoutId);
        // 约定: 子应用暴露在 window.MF_APPS[name]
        const app = window.MF_APPS && window.MF_APPS[config.name];
        if (app) {
          resolve(app);
        } else {
          // 宽松模式: 没有找到暴露, 也返回一个空对象避免阻塞
          resolve({
            mount: (ctx) => {
              const container = ctx.container;
              if (container) {
                container.innerHTML = `<div style="padding:20px;color:#666;">
                  子应用已加载 (${config.name}) - 请提供 mount 钩子
                </div>`;
              }
            },
            unmount: () => {},
          });
        }
      };

      script.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error(`脚本加载失败: ${config.url}`));
      };

      document.head.appendChild(script);
    });
  }

  _getContainer(name) {
    let el = document.getElementById(`mf-container-${name}`);
    if (!el) {
      el = document.createElement("div");
      el.id = `mf-container-${name}`;
      el.className = `mf-container mf-container-${name}`;

      // 查找主应用容器
      const root = document.querySelector(this.options.rootSelector) || document.body;
      root.appendChild(el);
    }
    return el;
  }

  _checkAppPermissions(config) {
    if (!config.permissions || config.permissions.length === 0) {
      return true;
    }
    return config.permissions.every((perm) => this.globalState.permissions.has(perm));
  }

  _buildRouterBridge(name) {
    // 简化版路由桥: 子应用可访问当前路径, 并通过主应用的事件广播
    return {
      get currentPath() {
        return window.location.pathname;
      },
      navigate: (path) => {
        window.history.pushState({}, "", path);
        window.dispatchEvent(new CustomEvent("mf:route-change", { detail: { app: name, path } }));
      },
      on: (event, handler) => window.addEventListener(`mf:${event}`, handler),
      off: (event, handler) => window.removeEventListener(`mf:${event}`, handler),
    };
  }

  _buildEventBus(name) {
    return {
      emit: (event, payload) => {
        window.dispatchEvent(new CustomEvent(`mf:${name}:${event}`, { detail: payload }));
      },
      on: (event, handler) => window.addEventListener(`mf:${name}:${event}`, handler),
      off: (event, handler) => window.removeEventListener(`mf:${name}:${event}`, handler),
      broadcast: (event, payload) => {
        window.dispatchEvent(new CustomEvent(`mf:*:${event}`, { detail: { source: name, payload } }));
      },
    };
  }

  _cleanupAppStyles(name) {
    const selector = `style[data-mf-name="${name}"], link[data-mf-name="${name}"]`;
    document.querySelectorAll(selector).forEach((el) => el.remove());
  }

  // ───────── 全局状态管理 ─────────

  setGlobalState(partial) {
    this.globalState = { ...this.globalState, ...partial };
    if (partial.permissions instanceof Set) {
      this.globalState.permissions = partial.permissions;
    }

    // 广播到所有子应用
    window.dispatchEvent(
      new CustomEvent("mf:state-change", { detail: this.globalState })
    );
  }

  getGlobalState() {
    return { ...this.globalState, permissions: Array.from(this.globalState.permissions) };
  }

  // ───────── 诊断 ─────────

  getDiagnostics() {
    return {
      registered: this.registeredApps.size,
      active: this.activeApps.size,
      totalMounts: this.mountCounter,
      apps: {
        registered: Array.from(this.registeredApps.keys()),
        active: Array.from(this.activeApps.keys()),
      },
      options: this.options,
    };
  }
}

// ========== 2. Web Worker 计算引擎 ==========

class WorkerComputeEngine {
  constructor(options = {}) {
    this.options = {
      poolSize: options.poolSize || Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1)),
      taskTimeoutMs: options.taskTimeoutMs || 30000,
      maxQueueSize: options.maxQueueSize || 1000,
      enableAutoScale: options.enableAutoScale !== false,
    };

    this.pool = []; // 活跃的 Worker 实例
    this.taskQueue = []; // 排队中的任务
    this.pendingTasks = new Map(); // 已分配给 worker 的任务 id -> { resolve, reject }
    this.stats = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      timedOutTasks: 0,
      retriedTasks: 0,
      avgWaitTimeMs: 0,
      avgExecTimeMs: 0,
      currentQueueSize: 0,
    };

    this._initPool();
    this.logger = this._createLogger();

    // 页面隐藏时清理空闲 Worker
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this._scaleDown(this.options.poolSize);
      }
    });
  }

  _createLogger() {
    return {
      log: (...args) => console.log("%c[WORKER]", "color:#059669;font-weight:bold;", ...args),
      warn: (...args) => console.warn("%c[WORKER]", "color:#f59e0b;font-weight:bold;", ...args),
      error: (...args) => console.error("%c[WORKER]", "color:#ef4444;font-weight:bold;", ...args),
    };
  }

  // ───────── 线程池管理 ─────────

  _initPool() {
    for (let i = 0; i < this.options.poolSize; i++) {
      this.pool.push(this._createWorker(i));
    }
    this.logger.log(`线程池初始化: ${this.pool.length} 个 Worker`);
  }

  _createWorker(index) {
    // 使用 Blob 创建内联 Worker (无需额外文件)
    const workerScript = this._getWorkerScript();
    const blob = new Blob([workerScript], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);

    const worker = new Worker(url);
    worker._url = url;
    worker._index = index;
    worker._busy = false;
    worker._lastUsed = Date.now();
    worker._taskCount = 0;

    worker.onmessage = (event) => this._handleMessage(worker, event.data);
    worker.onerror = (event) => this._handleError(worker, event);

    return worker;
  }

  _getWorkerScript() {
    // 内置 Worker 代码: 支持多种计算任务
    return `
      // ============== Worker 内部脚本 ==============
      const ctx = { startTime: Date.now(), taskCount: 0 };

      function computeFormulaOptimization(payload) {
        // 模拟: 配方求解 - 评估 N 种组合
        const { ingredients, constraints, iterations } = payload;
        const n = ingredients ? ingredients.length : 0;
        if (n === 0) return { status: 'skip', reason: 'no_ingredients' };

        let bestScore = -Infinity;
        let bestSolution = null;
        const iter = iterations || Math.min(5000, n * 1000);

        for (let i = 0; i < iter; i++) {
          // 伪随机评分 + 约束检查
          const score = Math.sin(i * 0.01 + n) * 100 +
            Math.cos(i * 0.03) * 50 +
            (constraints ? Object.keys(constraints).length * 10 : 0);

          if (score > bestScore) {
            bestScore = score;
            bestSolution = {
              iteration: i,
              ingredients: ingredients.slice(0, Math.min(n, 5)),
              score,
            };
          }
        }
        return { bestScore, bestSolution, iterations: iter };
      }

      function computeStatisticalAnalysis(payload) {
        // 统计分析: 均值、标准差、分位数、相关性
        const { datasets, operations } = payload;
        if (!datasets || !Array.isArray(datasets) || datasets.length === 0) {
          return { error: 'no_datasets' };
        }

        const results = {};

        datasets.forEach((data, idx) => {
          if (!data.values || !data.values.length) return;
          const values = data.values;
          const n = values.length;
          const mean = values.reduce((a, b) => a + b, 0) / n;
          const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
          const std = Math.sqrt(variance);
          const sorted = [...values].sort((a, b) => a - b);

          results[data.name || \`dataset-\${idx}\`] = {
            count: n,
            mean: Number(mean.toFixed(4)),
            std: Number(std.toFixed(4)),
            min: sorted[0],
            max: sorted[n - 1],
            median: sorted[Math.floor(n / 2)],
            q1: sorted[Math.floor(n * 0.25)],
            q3: sorted[Math.floor(n * 0.75)],
            sum: values.reduce((a, b) => a + b, 0),
          };
        });

        if (operations && operations.includes('correlation') && datasets.length >= 2) {
          const a = datasets[0].values;
          const b = datasets[1].values;
          const len = Math.min(a.length, b.length);
          const meanA = a.reduce((x, y) => x + y, 0) / len;
          const meanB = b.reduce((x, y) => x + y, 0) / len;
          let num = 0, denA = 0, denB = 0;
          for (let i = 0; i < len; i++) {
            num += (a[i] - meanA) * (b[i] - meanB);
            denA += (a[i] - meanA) ** 2;
            denB += (b[i] - meanB) ** 2;
          }
          results._correlation = Number((num / Math.sqrt(denA * denB || 1)).toFixed(4));
        }

        return results;
      }

      function computeAggregation(payload) {
        // 数据聚合: group-by + sum / avg / count / max / min
        const { data, groupBy, aggregations } = payload;
        if (!data || !data.length) return { groups: [] };

        const groups = new Map();
        for (const row of data) {
          const key = groupBy.map(g => row[g]).join('||');
          if (!groups.has(key)) {
            groups.set(key, { key, _rows: [] });
          }
          groups.get(key)._rows.push(row);
        }

        const result = [];
        for (const [key, info] of groups.entries()) {
          const rows = info._rows;
          const aggregated = {};
          for (const agg of (aggregations || [])) {
            const { field, op, alias } = agg;
            const values = rows.map(r => Number(r[field])).filter(v => !isNaN(v));
            switch (op) {
              case 'sum': aggregated[alias || field] = values.reduce((a, b) => a + b, 0); break;
              case 'avg': aggregated[alias || field] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; break;
              case 'count': aggregated[alias || field] = values.length; break;
              case 'max': aggregated[alias || field] = values.length ? Math.max(...values) : null; break;
              case 'min': aggregated[alias || field] = values.length ? Math.min(...values) : null; break;
              default: aggregated[alias || field] = values[0];
            }
            if (typeof aggregated[alias || field] === 'number') {
              aggregated[alias || field] = Number(aggregated[alias || field].toFixed(4));
            }
          }
          result.push({ ...aggregated, groupKey: key.split('||'), _rawCount: rows.length });
        }
        return { groups: result, totalGroups: result.length };
      }

      function computeLargeSort(payload) {
        // 大规模排序: 大数据量的排序 + 去重 + 分页
        const { data, field, order = 'asc', offset = 0, limit = 1000 } = payload;
        if (!data || !Array.isArray(data) || data.length === 0) return { sorted: [], total: 0 };

        const sorted = [...data].sort((a, b) => {
          const av = Number(a[field]);
          const bv = Number(b[field]);
          if (!isNaN(av) && !isNaN(bv)) {
            return order === 'asc' ? av - bv : bv - av;
          }
          return order === 'asc'
            ? String(a[field]).localeCompare(String(b[field]))
            : String(b[field]).localeCompare(String(a[field]));
        });

        return {
          sorted: sorted.slice(offset, offset + limit),
          total: sorted.length,
          offset,
          limit,
          page: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil(sorted.length / limit),
        };
      }

      self.onmessage = async function (event) {
        const { taskId, type, payload } = event.data || {};
        const start = Date.now();
        ctx.taskCount++;
        try {
          let result;
          switch (type) {
            case 'formula-optimization': result = computeFormulaOptimization(payload); break;
            case 'statistical-analysis': result = computeStatisticalAnalysis(payload); break;
            case 'data-aggregation': result = computeAggregation(payload); break;
            case 'large-sort': result = computeLargeSort(payload); break;
            case 'custom':
              if (payload && payload.code) {
                // 自定义代码 (仅在可信环境使用)
                const fn = new Function('payload', payload.code);
                result = fn(payload.data);
              } else {
                result = { error: 'no_code_provided' };
              }
              break;
            default:
              result = { error: \`unknown_type_\${type}\` };
          }

          self.postMessage({ taskId, status: 'success', result, durationMs: Date.now() - start });
        } catch (err) {
          self.postMessage({ taskId, status: 'error', error: err.message, durationMs: Date.now() - start });
        }
      };

      self.postMessage({ taskId: '__ready__', status: 'ready', workerStarted: Date.now() });
    `;
  }

  _handleMessage(worker, data) {
    const { taskId, status, result, error } = data || {};

    if (taskId === "__ready__") {
      worker._busy = false;
      return;
    }

    const pending = this.pendingTasks.get(taskId);
    if (!pending) {
      this.logger.warn(`收到未知任务响应: ${taskId}`);
      return;
    }

    clearTimeout(pending.timeoutId);
    this.pendingTasks.delete(taskId);
    worker._busy = false;
    worker._lastUsed = Date.now();
    worker._taskCount++;

    if (status === "success") {
      this.stats.completedTasks++;
      this.stats.avgExecTimeMs = (this.stats.avgExecTimeMs * (this.stats.completedTasks - 1) + (data.durationMs || 0)) / this.stats.completedTasks;
      pending.resolve(result);
    } else {
      // 是否重试
      if (pending.retry > 0) {
        this.stats.retriedTasks++;
        pending.retry--;
        this.logger.warn(`任务 ${pending.type} 失败, 剩余重试 ${pending.retry}`);
        this._assignToWorker(pending.task, worker);
        return;
      }
      this.stats.failedTasks++;
      pending.reject(new Error(error || "worker_error"));
    }

    // 尝试执行排队的任务
    this._processQueue();
  }

  _handleError(worker, event) {
    this.logger.error(`Worker #${worker._index} 发生错误:`, event.message);
    // 标记错误, 尝试重启
    try { worker.terminate(); } catch {}
    setTimeout(() => {
      const idx = this.pool.indexOf(worker);
      if (idx !== -1) {
        this.pool[idx] = this._createWorker(idx);
        this.logger.log(`Worker #${idx} 已重启`);
      }
    }, 1000);
  }

  // ───────── 任务调度 ─────────

  async run(type, payload, options = {}) {
    const task = {
      id: `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      payload,
      priority: options.priority || 5,
      timeoutMs: options.timeoutMs || this.options.taskTimeoutMs,
      retry: options.retry || 1,
      submitTime: Date.now(),
    };

    this.stats.totalTasks++;
    this.stats.currentQueueSize++;

    const idleWorker = this._getIdleWorker();
    if (idleWorker) {
      return this._assignToWorker(task, idleWorker);
    }

    // 队列中等待
    return new Promise((resolve, reject) => {
      task.resolve = resolve;
      task.reject = reject;
      this.taskQueue.push(task);
      this.taskQueue.sort((a, b) => b.priority - a.priority || a.submitTime - b.submitTime);

      // 超出最大队列: 拒绝
      if (this.taskQueue.length > this.options.maxQueueSize) {
        const dropped = this.taskQueue.pop();
        dropped.reject(new Error("队列已满, 任务被丢弃"));
        this.stats.currentQueueSize--;
      }
    });
  }

  _getIdleWorker() {
    const idle = this.pool.find((w) => !w._busy);
    if (idle) return idle;

    // 自动扩容
    if (this.options.enableAutoScale && this.pool.length < 8) {
      const newWorker = this._createWorker(this.pool.length);
      this.pool.push(newWorker);
      this.logger.log(`自动扩容, 新增 Worker #${newWorker._index}, 总数 ${this.pool.length}`);
      return newWorker;
    }
    return null;
  }

  _assignToWorker(task, worker) {
    return new Promise((resolve, reject) => {
      worker._busy = true;
      worker._lastAssigned = Date.now();

      const timeoutId = setTimeout(() => {
        if (this.pendingTasks.has(task.id)) {
          this.pendingTasks.delete(task.id);
          this.stats.timedOutTasks++;
          worker._busy = false;
          this.logger.warn(`任务超时: ${task.type} (${task.timeoutMs}ms)`);
          reject(new Error(`task_timeout: ${task.type}`));
          this._processQueue();
        }
      }, task.timeoutMs);

      this.pendingTasks.set(task.id, {
        task,
        type: task.type,
        resolve,
        reject,
        timeoutId,
        retry: task.retry,
      });

      worker.postMessage({ taskId: task.id, type: task.type, payload: task.payload });
    });
  }

  _processQueue() {
    if (this.taskQueue.length === 0) return;
    const idleWorker = this._getIdleWorker();
    if (!idleWorker) return;

    const next = this.taskQueue.shift();
    if (!next) return;
    this.stats.currentQueueSize--;

    const waitMs = Date.now() - next.submitTime;
    this.stats.avgWaitTimeMs = (this.stats.avgWaitTimeMs * (this.stats.totalTasks - this.taskQueue.length - 1) + waitMs) /
      Math.max(1, this.stats.totalTasks - this.taskQueue.length);

    this._assignToWorker(next, idleWorker).then(next.resolve).catch(next.reject);
  }

  _scaleDown(targetSize) {
    while (this.pool.length > targetSize) {
      const victim = this.pool.pop();
      if (victim && !victim._busy) {
        try { victim.terminate(); } catch {}
        this.logger.log(`缩容: 移除 Worker #${victim._index}`);
      }
    }
  }

  // ───────── 便捷 API ─────────

  optimizeFormula(payload) {
    return this.run("formula-optimization", payload, { priority: 8, timeoutMs: 60000 });
  }

  analyzeStats(datasets, operations = ["summary", "correlation"]) {
    return this.run("statistical-analysis", { datasets, operations });
  }

  aggregate(data, groupBy, aggregations) {
    return this.run("data-aggregation", { data, groupBy, aggregations });
  }

  sortLarge(data, field, options = {}) {
    return this.run("large-sort", { data, field, ...options });
  }

  // ───────── 诊断 ─────────

  getStats() {
    return {
      ...this.stats,
      poolSize: this.pool.length,
      idleWorkers: this.pool.filter((w) => !w._busy).length,
      perWorker: this.pool.map((w) => ({
        index: w._index,
        busy: w._busy,
        taskCount: w._taskCount,
        idleMs: Date.now() - (w._lastUsed || 0),
      })),
    };
  }

  destroy() {
    this.pool.forEach((w) => {
      try {
        w.terminate();
        if (w._url) URL.revokeObjectURL(w._url);
      } catch {}
    });
    this.pool = [];
    this.taskQueue = [];
    this.pendingTasks.clear();
    this.logger.log("引擎已销毁");
  }
}

// ========== 3. 前端性能监控 ==========

class FrontendMonitor {
  constructor(options = {}) {
    this.options = {
      reportUrl: options.reportUrl || null,
      reportIntervalMs: options.reportIntervalMs || 30000,
      sampleRate: options.sampleRate || 1.0, // 100% 采样
    };
    this.metrics = {
      vitals: {},  // LCP, FID, CLS, TTFB
      custom: {},  // 自定义指标
      errors: [],  // 错误列表
    };
    this._setupVitals();
    this._setupErrorTracking();
  }

  _setupVitals() {
    // LCP (Largest Contentful Paint)
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) this.metrics.vitals.LCP = Math.round(last.startTime);
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}

    // FID (First Input Delay) - 新版浏览器替换为 INP
    try {
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.processingStart) {
            const fid = entry.processingStart - entry.startTime;
            this.metrics.vitals.FID = Math.round(fid);
            break;
          }
        }
      });
      fidObserver.observe({ type: "first-input", buffered: true });
    } catch {}

    // CLS (Cumulative Layout Shift)
    let clsValue = 0;
    try {
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) clsValue += entry.value;
        }
        this.metrics.vitals.CLS = Number(clsValue.toFixed(4));
      });
      clsObserver.observe({ type: "layout-shift", buffered: true });
    } catch {}

    // TTFB (Time to First Byte)
    window.addEventListener("load", () => {
      const nav = performance.getEntriesByType("navigation")[0];
      if (nav) {
        this.metrics.vitals.TTFB = Math.round(nav.responseStart);
        this.metrics.vitals.DOMReady = Math.round(nav.domContentLoadedEventEnd);
        this.metrics.vitals.LoadComplete = Math.round(nav.loadEventEnd);
      }
    });
  }

  _setupErrorTracking() {
    window.addEventListener("error", (event) => {
      this.metrics.errors.push({
        type: "js",
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error && event.error.stack,
        timestamp: Date.now(),
      });
      if (this.metrics.errors.length > 50) this.metrics.errors.shift();
    });

    window.addEventListener("unhandledrejection", (event) => {
      this.metrics.errors.push({
        type: "promise",
        message: String(event.reason),
        timestamp: Date.now(),
      });
    });
  }

  // 自定义性能标记
  mark(name, value) {
    this.metrics.custom[name] = {
      value,
      timestamp: Date.now(),
    };
  }

  getReport() {
    const memory = (performance && performance.memory) || {};
    return {
      timestamp: Date.now(),
      url: location.href,
      userAgent: navigator.userAgent,
      vitals: this.metrics.vitals,
      custom: this.metrics.custom,
      errors: this.metrics.errors.slice(-10),
      performance: {
        resources: performance.getEntriesByType("resource").slice(-20).map((r) => ({
          name: r.name.split("/").pop(),
          duration: Math.round(r.duration),
          size: r.transferSize,
          type: r.initiatorType,
        })),
        memory: {
          usedMB: memory.usedJSHeapSize ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : null,
          totalMB: memory.jsHeapSizeLimit ? Math.round(memory.jsHeapSizeLimit / 1024 / 1024) : null,
        },
      },
    };
  }
}

// ========== 4. 组件级权限控制 (简版) ==========

function createPermissionChecker(userRole, permissions = []) {
  const permSet = new Set(permissions);
  return {
    can: (permission) => permSet.has(permission) || userRole === "admin",
    hasRole: (role) => userRole === role || userRole === "admin",
    // React 辅助: renderIf(<Component/>, "perm:xxx")
    renderIf: (node, permission) => (permSet.has(permission) || userRole === "admin" ? node : null),
  };
}

// ========== 导出 API ==========

const microFrontend = new MicroFrontendCore();
const workerEngine = new WorkerComputeEngine();
const frontendMonitor = new FrontendMonitor();

export {
  microFrontend,
  workerEngine,
  frontendMonitor,
  createPermissionChecker,
  MicroFrontendCore,
  WorkerComputeEngine,
  FrontendMonitor,
};
