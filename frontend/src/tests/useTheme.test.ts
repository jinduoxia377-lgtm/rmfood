import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useTheme, ThemeMode, ThemeProvider } from '../hooks/useTheme';

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)',
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })),
});

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(ThemeProvider, null, children);
}

describe('useTheme', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  test('should initialize with system theme when no saved theme', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.isDark).toBe(false);
  });

  test('should update theme when updateSettings is called', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.isDark).toBe(false);

    act(() => {
      result.current.updateSettings({ mode: 'dark' as ThemeMode });
    });
    expect(result.current.isDark).toBe(true);

    act(() => {
      result.current.updateSettings({ mode: 'light' as ThemeMode });
    });
    expect(result.current.isDark).toBe(false);
  });

  test('should update document class when theme changes', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    act(() => {
      result.current.updateSettings({ mode: 'dark' as ThemeMode });
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => {
      result.current.updateSettings({ mode: 'light' as ThemeMode });
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  test('should update custom colors when updateSettings is called with colors', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.updateSettings({
        customColors: {
          primary: '#ff0000',
          secondary: '#00ff00',
        },
      });
    });

    const root = document.documentElement;
    expect(getComputedStyle(root).getPropertyValue('--primary').trim()).toBe('#ff0000');
  });

  test('should toggle dark mode with toggleTheme function', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.isDark).toBe(false);

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.isDark).toBe(true);

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.isDark).toBe(false);
  });

  test('should reset to default settings', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.updateSettings({
        mode: 'dark',
        customColors: { primary: '#ff0000' },
        fontSize: 18,
      });
    });
    expect(result.current.isDark).toBe(true);

    act(() => {
      result.current.resetSettings();
    });
    expect(result.current.isDark).toBe(false);
    expect(result.current.settings.fontSize).toBe(16);
  });

  test('should apply visualSettings correctly', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.updateSettings({
        visualSettings: {
          borderRadius: 16,
          shadowIntensity: 0.8,
          spacing: 1.2,
        },
      });
    });

    const root = document.documentElement;
    expect(getComputedStyle(root).getPropertyValue('--radius').trim()).toBe('16px');
  });
});