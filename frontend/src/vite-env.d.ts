/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// ── Window global declarations ──
// These replace `(window as any).__XXX__` casts throughout the codebase.

interface Window {
  /** Development-only: current AI scenario mode (e.g. 'academician', 'professor') */
  __SCENARIO_MODE__?: string;
  /** Development-only: performance monitoring registry */
  __RMFOOD_PERF__?: Record<string, unknown>;
  /** Development-only: V8 garbage collection (chrome://inspect) */
  gc?: () => void;
  /** Polyfilled in tests */
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (id: number) => void;
  /** Prism.js syntax highlighter (injected by prismjs) */
  Prism?: {
    highlightElement(el: HTMLElement): void;
  };
  /** Sentry JS SDK (injected via script tag) */
  Sentry?: {
    captureException(error: unknown, info?: { componentStack?: string; tags?: Record<string, string> }): void;
  };
}
