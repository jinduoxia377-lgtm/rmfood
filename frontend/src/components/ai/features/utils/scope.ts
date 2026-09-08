/**
 * Scope 作用域隔离 - 基于 DeepSeek Harness 的 Scope Shadowing
 *
 * 实现：
 * - 全局注册 vs 作用域注册
 * - 作用域优先解析
 * - 自动清理
 */

import { logger } from '@/utils/safeLogger';

// ── 类型定义 ────────────────────────────────────────────────

export type ScopeKey = symbol | string;

export interface Registration<T = unknown> {
  value: T;
  disposed: boolean;
}

export interface Disposable {
  dispose(): void;
}

export interface Scope {
  /** 注册值 */
  register<T>(key: ScopeKey, value: T): Disposable;
  /** 获取值 */
  get<T>(key: ScopeKey): T | undefined;
  /** 批量注册 */
  registerMany<Map extends Record<ScopeKey, unknown>>(map: Map): () => void;
  /** 检查是否已disposed */
  isDisposed(): boolean;
  /** 释放所有注册 */
  dispose(): void;
}

// ── Scope 实现 ──────────────────────────────────────────────

export function createScope(): Scope {
  const registrations = new Map<ScopeKey, Registration>();
  let disposed = false;

  return {
    register<T>(key: ScopeKey, value: T): Disposable {
      if (disposed) {
        throw new Error('Scope already disposed');
      }

      registrations.set(key, { value, disposed: false });

      return {
        dispose: () => {
          if (!disposed) {
            const reg = registrations.get(key);
            if (reg) {
              reg.disposed = true;
              registrations.delete(key);
            }
          }
        },
      };
    },

    get<T>(key: ScopeKey): T | undefined {
      const reg = registrations.get(key);
      return reg?.value as T | undefined;
    },

    registerMany<Map extends Record<ScopeKey, unknown>>(map: Map): () => void {
      const disposables: Disposable[] = [];
      
      for (const [key, value] of Object.entries(map)) {
        disposables.push(this.register(key as ScopeKey, value));
      }

      return () => {
        for (const d of disposables) {
          d.dispose();
        }
      };
    },

    isDisposed(): boolean {
      return disposed;
    },

    dispose(): void {
      disposed = true;
      registrations.clear();
      logger.debug('[Scope] Disposed');
    },
  };
}

// ── 作用域解析器 ────────────────────────────────────────────

export interface ScopedResolver<T> {
  /** 获取最具体的值 (作用域优先) */
  resolve(key: ScopeKey): T | undefined;
  /** 设置作用域值 */
  setScoped(agentId: string, key: ScopeKey, value: T): void;
  /** 清除作用域值 */
  clearScoped(agentId: string, key: ScopeKey): void;
  /** 获取所有作用域 */
  getAllScopes(): Map<string, Map<ScopeKey, T>>;
}

export function createScopedResolver<T>(): ScopedResolver<T> {
  // 全局注册
  const global = new Map<ScopeKey, T>();
  // 作用域注册: agentId -> Map<key, value>
  const scoped = new Map<string, Map<ScopeKey, T>>();

  return {
    resolve(key: ScopeKey): T | undefined {
      // 优先查找作用域
      for (const [, agentMap] of scoped) {
        const value = agentMap.get(key);
        if (value !== undefined) {
          return value;
        }
      }
      // 回退到全局
      return global.get(key);
    },

    setScoped(agentId: string, key: ScopeKey, value: T): void {
      let agentMap = scoped.get(agentId);
      if (!agentMap) {
        agentMap = new Map();
        scoped.set(agentId, agentMap);
      }
      agentMap.set(key, value);
      logger.debug(`[ScopedResolver] Set scoped value for agent ${agentId}, key ${String(key)}`);
    },

    clearScoped(agentId: string, key: ScopeKey): void {
      const agentMap = scoped.get(agentId);
      if (agentMap) {
        agentMap.delete(key);
        if (agentMap.size === 0) {
          scoped.delete(agentId);
        }
      }
    },

    getAllScopes(): Map<string, Map<ScopeKey, T>> {
      return scoped;
    },
  };
}

// ── Agent Scope ─────────────────────────────────────────────

export interface AgentScope extends Scope {
  /** Agent ID */
  readonly agentId: string;
}

export function createAgentScope(agentId: string): AgentScope {
  const scope = createScope();
  
  return Object.assign(scope, {
    agentId,
  });
}

// ── 便捷函数 ────────────────────────────────────────────────

/**
 * 创建带自动清理的作用域
 */
export function withScope<T>(fn: (scope: Scope) => T): T {
  const scope = createScope();
  let result: T;
  
  try {
    result = fn(scope);
  } finally {
    scope.dispose();
  }
  
  return result!;
}

/**
 * 批量解析 (全局 + 多个作用域)
 */
export function resolveScoped<T>(
  global: Map<ScopeKey, T>,
  scoped: Map<string, Map<ScopeKey, T>>,
  key: ScopeKey,
): T | undefined {
  // 作用域优先
  for (const [, agentMap] of scoped) {
    const value = agentMap.get(key);
    if (value !== undefined) {
      return value;
    }
  }
  // 回退到全局
  return global.get(key);
}
