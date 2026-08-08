import '@testing-library/jest-dom';
import { vi } from 'vitest';
import '../components/ai/features/__tests__/matchers/customMatchers';

// 定义全局变量
const globalAny = globalThis as any;
globalAny.window = globalAny.window || {};
globalAny.navigator = globalAny.navigator || {};
globalAny.requestAnimationFrame = (callback: Function) => setTimeout(callback, 0);
globalAny.cancelAnimationFrame = (id: number) => clearTimeout(id);
globalAny.requestIdleCallback = (callback: Function) => setTimeout(callback, 0);
globalAny.cancelIdleCallback = (id: number) => clearTimeout(id);

// 直接在 window 对象上定义，确保 axe-core 能找到
if (typeof window !== 'undefined') {
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
