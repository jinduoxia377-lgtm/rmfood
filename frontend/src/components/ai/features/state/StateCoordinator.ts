import { logger } from '@/utils/safeLogger';
import {
  type GlobalState,
  type StateKey,
  type StateChangeListener,
  type StateUpdate,
  type MiddlewareFunction,
  type MiddlewareContext,
  DEFAULT_GLOBAL_STATE,
} from './types';

type ListenerMap = {
  [K in StateKey]?: Set<StateChangeListener<K>>;
};

interface MiddlewareMap {
  beforeSet: Map<StateKey, Set<MiddlewareFunction<StateKey>>>;
  afterSet: Map<StateKey, Set<MiddlewareFunction<StateKey>>>;
}

class StateCoordinator {
  private state: GlobalState = { ...DEFAULT_GLOBAL_STATE };
  private listeners: ListenerMap = {};
  private middlewares: MiddlewareMap = {
    beforeSet: new Map(),
    afterSet: new Map(),
  };
  private isBatching = false;
  private batchQueue: StateUpdate<StateKey>[] = [];
  private listenerCounts = new Map<string, number>();

  getState<K extends StateKey>(key: K): GlobalState[K] {
    return this.state[key];
  }

  getFullState(): GlobalState {
    return { ...this.state };
  }

  setState<K extends StateKey>(key: K, value: GlobalState[K]): void {
    const oldValue = this.state[key];

    const context: MiddlewareContext<K> = {
      key,
      newValue: value,
      oldValue,
      timestamp: Date.now(),
    };

    this.executeBeforeSetMiddlewares(context);

    if (this.isBatching) {
      this.batchQueue.push({ key, value });
      return;
    }

    this.state[key] = value;

    this.executeAfterSetMiddlewares(context);
    this.notifyListeners(key, value, oldValue);
  }

  batchUpdate(updates: StateUpdate<StateKey>[]): void {
    if (updates.length === 0) return;

    this.isBatching = true;
    this.batchQueue = [];

    for (const update of updates) {
      this.setState(update.key, update.value);
    }

    this.isBatching = false;

    for (const update of this.batchQueue) {
      const oldValue = this.state[update.key];
      this.setState(update.key, update.value);
    }

    this.batchQueue = [];
  }

  subscribe<K extends StateKey>(key: K, listener: StateChangeListener<K>): () => void {
    if (!this.listeners[key]) {
      this.listeners[key] = new Set<StateChangeListener<K>>() as any;
    }

    const listeners = this.listeners[key]!;
    listeners.add(listener);

    const subscriptionId = `${key}-${Date.now()}-${Math.random()}`;
    const currentCount = this.listenerCounts.get(key) || 0;
    this.listenerCounts.set(key, currentCount + 1);

    return () => {
      listeners.delete(listener);
      const newCount = (this.listenerCounts.get(key) || 0) - 1;
      this.listenerCounts.set(key, Math.max(0, newCount));

      if (listeners.size === 0) {
        delete this.listeners[key];
        this.listenerCounts.delete(key);
      }
    };
  }

  addMiddleware<K extends StateKey>(
    phase: 'beforeSet' | 'afterSet',
    key: K,
    middleware: MiddlewareFunction<K>,
  ): () => void {
    const middlewareMap = this.middlewares[phase];

    if (!middlewareMap.has(key)) {
      middlewareMap.set(key, new Set());
    }

    const middlewares = middlewareMap.get(key)!;
    middlewares.add(middleware as MiddlewareFunction<StateKey>);

    return () => {
      middlewares.delete(middleware as MiddlewareFunction<StateKey>);
      if (middlewares.size === 0) {
        middlewareMap.delete(key);
      }
    };
  }

  clearAllListeners(): void {
    Object.keys(this.listeners).forEach((key) => {
      const listeners = this.listeners[key as StateKey];
      if (listeners) {
        listeners.clear();
      }
    });
    this.listeners = {};
    this.listenerCounts.clear();
  }

  clearAllMiddlewares(): void {
    this.middlewares.beforeSet.clear();
    this.middlewares.afterSet.clear();
  }

  getListenerCount(key?: StateKey): number {
    if (key) {
      return this.listenerCounts.get(key) || 0;
    }
    let total = 0;
    this.listenerCounts.forEach((count) => {
      total += count;
    });
    return total;
  }

  resetState(partial?: Partial<GlobalState>): void {
    this.state = { ...DEFAULT_GLOBAL_STATE, ...partial };
  }

  private notifyListeners<K extends StateKey>(key: K, newValue: GlobalState[K], oldValue: unknown): void {
    const listeners = this.listeners[key];
    if (!listeners) return;

    listeners.forEach((listener) => {
      try {
        listener(newValue, oldValue as GlobalState[K]);
      } catch (error) {
        logger.error(`Error in listener for ${key}:`, error);
      }
    });
  }

  private executeBeforeSetMiddlewares<K extends StateKey>(context: MiddlewareContext<K>): void {
    const middlewares = this.middlewares.beforeSet.get(context.key);
    if (!middlewares || middlewares.size === 0) return;

    let index = 0;
    const middlewareArray = Array.from(middlewares);

    const executeNext = (): void => {
      if (index < middlewareArray.length) {
        const middleware = middlewareArray[index++];
        try {
          (middleware as MiddlewareFunction<K>)(context, executeNext);
        } catch (error) {
          logger.error(`Error in beforeSet middleware for ${context.key}:`, error);
          executeNext();
        }
      }
    };

    executeNext();
  }

  private executeAfterSetMiddlewares<K extends StateKey>(context: MiddlewareContext<K>): void {
    const middlewares = this.middlewares.afterSet.get(context.key);
    if (!middlewares || middlewares.size === 0) return;

    middlewares.forEach((middleware) => {
      try {
        (middleware as MiddlewareFunction<K>)(context, () => {});
      } catch (error) {
        logger.error(`Error in afterSet middleware for ${context.key}:`, error);
      }
    });
  }
}

export const stateCoordinator = new StateCoordinator();

export { StateCoordinator };
export default stateCoordinator;
