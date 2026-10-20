// 测试用的 mock 服务

export function createMockChatService() {
  return {
    sendMessage: jest.fn().mockResolvedValue({
      id: 'resp-1',
      content: 'Mock response',
      reasoning: null,
      formulaIds: [],
      metadata: {},
    }),
    sendStreamMessage: jest.fn().mockReturnValue({
      subscribe: jest.fn(),
      cancel: jest.fn(),
    }),
    abort: jest.fn(),
    getHistory: jest.fn().mockResolvedValue([]),
    clearHistory: jest.fn().mockResolvedValue(undefined),
    updateHistory: jest.fn().mockResolvedValue(undefined),
  };
}

export function createMockStorageService() {
  const storage = new Map();
  
  return {
    get: jest.fn().mockImplementation((key: string) => {
      const value = storage.get(key);
      return value ? JSON.parse(value) : null;
    }),
    set: jest.fn().mockImplementation((key: string, value: any) => {
      storage.set(key, JSON.stringify(value));
    }),
    remove: jest.fn().mockImplementation((key: string) => {
      storage.delete(key);
    }),
    exists: jest.fn().mockImplementation((key: string) => storage.has(key)),
    keys: jest.fn().mockReturnValue(Array.from(storage.keys())),
    clear: jest.fn().mockImplementation(() => storage.clear()),
    getStats: jest.fn().mockReturnValue({
      used: 0,
      total: 5 * 1024 * 1024,
      itemCount: storage.size,
    }),
    _getRawStorage: () => storage,
  };
}

export function createMockEventBus() {
  const listeners = new Map();
  
  return {
    subscribe: jest.fn().mockImplementation((event: string, callback: (...args: any[]) => void) => {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event).push(callback);
      
      return () => {
        const eventListeners = listeners.get(event);
        const index = eventListeners.indexOf(callback);
        if (index > -1) {
          eventListeners.splice(index, 1);
        }
      };
    }),
    publish: jest.fn().mockImplementation((event: string, data: any) => {
      const eventListeners = listeners.get(event) || [];
      eventListeners.forEach(callback => callback(data));
    }),
    unsubscribe: jest.fn().mockImplementation((event: string, callback: (...args: any[]) => void) => {
      const eventListeners = listeners.get(event) || [];
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }),
    clear: jest.fn().mockImplementation(() => listeners.clear()),
    _getListeners: () => listeners,
  };
}

export function createMockWebSocket() {
  return {
    connect: jest.fn(),
    disconnect: jest.fn(),
    send: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    isConnected: jest.fn().mockReturnValue(true),
  };
}

export function createMockAPI() {
  return {
    get: jest.fn().mockResolvedValue({ data: null }),
    post: jest.fn().mockResolvedValue({ data: null }),
    put: jest.fn().mockResolvedValue({ data: null }),
    delete: jest.fn().mockResolvedValue({ data: null }),
  };
}
