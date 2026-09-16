/**
 * 主题事件总线
 * 用于跨组件主题协调和响应式更新
 */

type ThemeEventType = 
  | 'theme_change'
  | 'mode_change'
  | 'transition_start'
  | 'transition_end'
  | 'custom_theme_update';

interface ThemeEvent {
  type: ThemeEventType;
  payload?: any;
  timestamp: number;
}

class ThemeEventBus {
  private static instance: ThemeEventBus;
  private listeners: Map<string, Set<(event: ThemeEvent) => void>>;
  private history: ThemeEvent[];
  private readonly maxHistorySize = 50;

  private constructor() {
    this.listeners = new Map();
    this.history = [];
  }

  static getInstance(): ThemeEventBus {
    if (!ThemeEventBus.instance) {
      ThemeEventBus.instance = new ThemeEventBus();
    }
    return ThemeEventBus.instance;
  }

  subscribe(type: ThemeEventType, callback: (event: ThemeEvent) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
    
    return () => {
      this.listeners.get(type)?.delete(callback);
    };
  }

  subscribeAll(callback: (event: ThemeEvent) => void): () => void {
    const types: ThemeEventType[] = ['theme_change', 'mode_change', 'transition_start', 'transition_end', 'custom_theme_update'];
    const unsubscribes = types.map(type => this.subscribe(type, callback));
    
    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }

  publish(type: ThemeEventType, payload?: any): void {
    const event: ThemeEvent = {
      type,
      payload,
      timestamp: Date.now(),
    };

    this.history.push(event);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    const callbacks = this.listeners.get(type);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`[ThemeEventBus] Error in listener for ${type}:`, error);
        }
      });
    }
  }

  publishThemeChange(themeId: string, mode: 'light' | 'dark'): void {
    this.publish('theme_change', { themeId, mode });
  }

  publishModeChange(mode: 'light' | 'dark'): void {
    this.publish('mode_change', { mode });
  }

  publishTransitionStart(type: string): void {
    this.publish('transition_start', { type });
  }

  publishTransitionEnd(type: string): void {
    this.publish('transition_end', { type });
  }

  getHistory(): ThemeEvent[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  clearAll(): void {
    this.listeners.clear();
    this.clearHistory();
  }

  getListenerCount(type?: ThemeEventType): number {
    if (type) {
      return this.listeners.get(type)?.size || 0;
    }
    return Array.from(this.listeners.values())
      .reduce((sum, set) => sum + set.size, 0);
  }
}

export const themeEventBus = ThemeEventBus.getInstance();
export type { ThemeEventType, ThemeEvent };
export default themeEventBus;
