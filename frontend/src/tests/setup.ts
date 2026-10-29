import '@testing-library/jest-dom';
import { vi } from 'vitest';
import '../components/ai/features/__tests__/matchers/customMatchers';
// 初始化 i18n（zh-CN 默认），使组件内 useTranslation 的文案断言在测试中解析为真实翻译而非 key
import '@/i18n';

// jsdom 原生不支持 IndexedDB，而 operationLogger / localStorageService / persistentStore
// 等模块在加载或调用时会访问 indexedDB。引入 fake-indexeddb（真实的内存实现，行业标准做法），
// 避免“indexedDB is not defined”导致的未处理 rejection 与测试挂起。
import 'fake-indexeddb/auto';

// 定义全局变量
const globalAny = globalThis as any;
globalAny.window = globalAny.window || {};
globalAny.navigator = globalAny.navigator || {};
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
globalAny.requestAnimationFrame = (callback: Function) => setTimeout(callback, 0);
globalAny.cancelAnimationFrame = (id: number) => clearTimeout(id);
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
globalAny.requestIdleCallback = (callback: Function) => setTimeout(callback, 0);
globalAny.cancelIdleCallback = (id: number) => clearTimeout(id);

// 直接在 window 对象上定义，确保 axe-core 能找到
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  (window as any).requestIdleCallback = (callback: Function) => setTimeout(callback, 0);
  (window as any).cancelIdleCallback = (id: number) => clearTimeout(id);
}

// 添加 TextEncoder 定义
if (typeof TextEncoder === 'undefined') {
  globalAny.TextEncoder = class {
    encode(input: string) {
      const result = new Uint8Array(input.length);
      for (let i = 0; i < input.length; i++) {
        result[i] = input.charCodeAt(i);
      }
      return result;
    }
  };
  globalAny.TextDecoder = class {
    decode(input: Uint8Array) {
      return String.fromCharCode(...input);
    }
  };
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

window.alert = vi.fn();
window.confirm = vi.fn(() => true);

// Mock URL.createObjectURL and URL.revokeObjectURL for testing
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = vi.fn().mockReturnValue('blob://test-url');
  URL.revokeObjectURL = vi.fn();
} else {
  vi.mocked(URL.createObjectURL).mockReturnValue('blob://test-url');
  vi.mocked(URL.revokeObjectURL).mockImplementation(() => {});
}

// recharts 的 ResponsiveContainer 依赖 ResizeObserver，jsdom 未实现，需全局 mock
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverMock {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}

// jsdom 未实现 scrollIntoView，消息列表等组件会调用它，提供空实现避免测试报错
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {};
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
    Link: ({ children }: { children: React.ReactNode }) => children,
  };
});

vi.mock('@use-gesture/react', () => ({
  useSwipeable: () => () => ({}),
  useLongPress: () => () => ({}),
}));
