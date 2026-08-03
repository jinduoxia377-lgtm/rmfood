import { logger } from '@/utils/safeLogger';
import type { StateKey, GlobalState, MiddlewareContext, MiddlewareFunction } from './types';
import { stateCoordinator } from './StateCoordinator';

interface LoggerOptions {
  enabled?: boolean;
  includeTimestamp?: boolean;
  includeStackTrace?: boolean;
  maxLogEntries?: number;
}

const defaultLoggerOptions: Required<LoggerOptions> = {
  enabled: true,
  includeTimestamp: true,
  includeStackTrace: false,
  maxLogEntries: 1000,
};

let logEntries: {
  timestamp: number;
  key: StateKey;
  oldValue: unknown;
  newValue: unknown;
}[] = [];

export function loggerMiddleware(options: LoggerOptions = {}): void {
  const config = { ...defaultLoggerOptions, ...options };

  const middleware: MiddlewareFunction<StateKey> = (context, next) => {
    if (!config.enabled) {
      next();
      return;
    }

    const logEntry = {
      timestamp: context.timestamp,
      key: context.key,
      oldValue: context.oldValue,
      newValue: context.newValue,
    };

    logEntries.push(logEntry);

    if (logEntries.length > config.maxLogEntries) {
      logEntries = logEntries.slice(-config.maxLogEntries);
    }

    const logData = {
      key: context.key,
      ...(config.includeTimestamp && { timestamp: new Date(context.timestamp).toISOString() }),
      oldValue: context.oldValue,
      newValue: context.newValue,
    };

    logger.log('[State Change] %s', context.key);
    logger.log('Previous:', context.oldValue);
    logger.log('Current:', context.newValue);
    if (config.includeStackTrace) {
      logger.log('Stack trace');
    }

    next();
  };

  (
    Object.keys({
      auth: true,
      aiConfig: true,
      workspace: true,
      notifications: true,
      theme: true,
    }) as StateKey[]
  ).forEach((key) => {
    stateCoordinator.addMiddleware('afterSet', key, middleware);
  });
}

export function getLogEntries(): typeof logEntries {
  return [...logEntries];
}

export function clearLogEntries(): void {
  logEntries = [];
}

interface ValidationRule<K extends StateKey> {
  key: K;
  validate: (value: GlobalState[K]) => boolean | string;
  errorMessage?: string;
}

const validationRules = new Map<StateKey, ValidationRule<StateKey>[]>();

export function addValidationRule<K extends StateKey>(rule: ValidationRule<K>): () => void {
  const rules = validationRules.get(rule.key) || [];
  rules.push(rule as unknown as ValidationRule<StateKey>);
  validationRules.set(rule.key, rules);

  return () => {
    const currentRules = validationRules.get(rule.key) || [];
    const index = currentRules.indexOf(rule as unknown as ValidationRule<StateKey>);
    if (index > -1) {
      currentRules.splice(index, 1);
    }
  };
}

export function validationMiddleware(): void {
  const middleware: MiddlewareFunction<StateKey> = (context, next) => {
    const rules = validationRules.get(context.key);

    if (!rules || rules.length === 0) {
      next();
      return;
    }

    for (const rule of rules) {
      const result = rule.validate(context.newValue);
      if (result !== true) {
        const message =
          (typeof result === 'string' ? result : rule.errorMessage) || `Validation failed for ${context.key}`;
        logger.warn(`[Validation] ${message}`, {
          key: context.key,
          value: context.newValue,
        });
        throw new Error(message);
      }
    }

    next();
  };

  (
    Object.keys({
      auth: true,
      aiConfig: true,
      workspace: true,
      notifications: true,
      theme: true,
    }) as StateKey[]
  ).forEach((key) => {
    stateCoordinator.addMiddleware('beforeSet', key, middleware);
  });
}

interface PersistenceOptions {
  storageKey?: string;
  debounceMs?: number;
  serialize?: (state: Partial<GlobalState>) => string;
  deserialize?: (value: string) => Partial<GlobalState>;
}

let persistenceTimeout: ReturnType<typeof setTimeout> | null = null;

export function persistenceMiddleware(options: PersistenceOptions = {}): void {
  const storageKey = options.storageKey || 'ai-state-persistence';
  const debounceMs = options.debounceMs || 300;
  const serialize = options.serialize || ((state: Partial<GlobalState>) => JSON.stringify(state));
  const deserialize = options.deserialize || ((value: string) => JSON.parse(value));

  const saveToStorage = (): void => {
    const state = stateCoordinator.getFullState();
    try {
      const serialized = serialize({
        auth: state.auth,
        aiConfig: state.aiConfig,
        theme: state.theme,
      });
      localStorage.setItem(storageKey, serialized);
    } catch (error) {
      logger.error('[Persistence] Failed to save state:', error);
    }
  };

  const middleware: MiddlewareFunction<StateKey> = (_context, next) => {
    next();

    if (persistenceTimeout) {
      clearTimeout(persistenceTimeout);
    }

    persistenceTimeout = setTimeout(saveToStorage, debounceMs);
  };

  const persistableKeys: StateKey[] = ['auth', 'aiConfig', 'theme'];
  persistableKeys.forEach((key) => {
    stateCoordinator.addMiddleware('afterSet', key, middleware);
  });

  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const restored = deserialize(stored);
      Object.entries(restored).forEach(([key, value]) => {
        if (key in stateCoordinator.getFullState()) {
          stateCoordinator.setState(key as StateKey, value as never);
        }
      });
    }
  } catch (error) {
    logger.error('[Persistence] Failed to restore state:', error);
  }
}

export function clearPersistedState(storageKey?: string): void {
  const key = storageKey || 'ai-state-persistence';
  localStorage.removeItem(key);
}

interface PerformanceMetrics {
  updateCount: number;
  totalUpdateTime: number;
  averageUpdateTime: number;
  slowUpdates: { key: StateKey; duration: number; timestamp: number }[];
}

const performanceMetrics: PerformanceMetrics = {
  updateCount: 0,
  totalUpdateTime: 0,
  averageUpdateTime: 0,
  slowUpdates: [],
};

const SLOW_UPDATE_THRESHOLD = 100;

export function performanceMiddleware(): void {
  const middleware: MiddlewareFunction<StateKey> = (context, next) => {
    const startTime = performance.now();

    next();

    const duration = performance.now() - startTime;
    performanceMetrics.updateCount++;
    performanceMetrics.totalUpdateTime += duration;
    performanceMetrics.averageUpdateTime = performanceMetrics.totalUpdateTime / performanceMetrics.updateCount;

    if (duration > SLOW_UPDATE_THRESHOLD) {
      const slowUpdate = {
        key: context.key,
        duration,
        timestamp: context.timestamp,
      };
      performanceMetrics.slowUpdates.push(slowUpdate);

      logger.warn(
        `[Performance] Slow state update detected for ${context.key}: ${duration.toFixed(2)}ms (threshold: ${SLOW_UPDATE_THRESHOLD}ms)`,
      );

      if (performanceMetrics.slowUpdates.length > 100) {
        performanceMetrics.slowUpdates = performanceMetrics.slowUpdates.slice(-50);
      }
    }
  };

  (
    Object.keys({
      auth: true,
      aiConfig: true,
      workspace: true,
      notifications: true,
      theme: true,
    }) as StateKey[]
  ).forEach((key) => {
    stateCoordinator.addMiddleware('afterSet', key, middleware);
  });
}

export function getPerformanceMetrics(): PerformanceMetrics {
  return { ...performanceMetrics };
}

export function resetPerformanceMetrics(): void {
  performanceMetrics.updateCount = 0;
  performanceMetrics.totalUpdateTime = 0;
  performanceMetrics.averageUpdateTime = 0;
  performanceMetrics.slowUpdates = [];
}

export function setupDefaultMiddlewares(): void {
  loggerMiddleware();
  validationMiddleware();
  persistenceMiddleware();
  performanceMiddleware();

  addValidationRule({
    key: 'auth',
    validate: (value) => {
      if (value.isLoggedIn && !value.token) {
        return 'Cannot set isLoggedIn to true without a token';
      }
      return true;
    },
  });

  addValidationRule({
    key: 'aiConfig',
    validate: (value) => {
      if (value.temperature < 0 || value.temperature > 2) {
        return 'Temperature must be between 0 and 2';
      }
      return true;
    },
  });

  addValidationRule({
    key: 'notifications',
    validate: (value) => {
      if (value.queue.length > value.maxNotifications) {
        return 'Notification queue exceeds maximum limit';
      }
      return true;
    },
  });

  addValidationRule({
    key: 'theme',
    validate: (value) => {
      const validModes = ['light', 'dark', 'system'];
      if (!validModes.includes(value.mode)) {
        return `Invalid theme mode: ${value.mode}`;
      }
      return true;
    },
  });
}
