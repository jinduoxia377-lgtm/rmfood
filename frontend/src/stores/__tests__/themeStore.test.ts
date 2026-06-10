/**
 * Theme Store - 单元测试
 * 测试覆盖：初始状态、主题切换、自定义主题、无障碍模式、运动偏好
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/utils/safeLogger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}));

import { useThemeStore } from '../themeStore';

describe('themeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({
      activeThemeId: 'light-default',
      mode: 'system',
      accessibilityMode: 'normal',
      customThemes: [],
      isInitialized: false,
      transitionType: 'fade',
      isTransitioning: false,
      motionPreferences: { reducedMotion: false, disableAnimations: false, scaleDownTransitions: false },
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have activeThemeId as light-default', () => {
      expect(useThemeStore.getState().activeThemeId).toBe('light-default');
    });
    it('should have mode as system', () => {
      expect(useThemeStore.getState().mode).toBe('system');
    });
    it('should have accessibilityMode as normal', () => {
      expect(useThemeStore.getState().accessibilityMode).toBe('normal');
    });
    it('should have empty customThemes', () => {
      expect(useThemeStore.getState().customThemes).toEqual([]);
    });
  });

  describe('setThemeMode', () => {
    it('should switch to light mode', () => {
      useThemeStore.getState().setThemeMode('light');
      expect(useThemeStore.getState().mode).toBe('light');
    });
    it('should switch to dark mode', () => {
      useThemeStore.getState().setThemeMode('dark');
      expect(useThemeStore.getState().mode).toBe('dark');
    });
    it('should switch to system mode', () => {
      useThemeStore.setState({ mode: 'light' });
      useThemeStore.getState().setThemeMode('system');
      expect(useThemeStore.getState().mode).toBe('system');
    });
  });

  describe('setPresetTheme', () => {
    it('should set the active theme to a preset', () => {
      useThemeStore.getState().setPresetTheme('dark-default');
      expect(useThemeStore.getState().activeThemeId).toBe('dark-default');
    });
    it('should infer dark mode from dark preset', () => {
      useThemeStore.getState().setPresetTheme('dark-default');
      expect(useThemeStore.getState().mode).toBe('dark');
    });
  });

  describe('setAccessibilityMode', () => {
    it('should set to high-contrast', () => {
      useThemeStore.getState().setAccessibilityMode('high-contrast');
      expect(useThemeStore.getState().accessibilityMode).toBe('high-contrast');
    });
    it('should set to reading', () => {
      useThemeStore.getState().setAccessibilityMode('reading');
      expect(useThemeStore.getState().accessibilityMode).toBe('reading');
    });
    it('should reset to normal', () => {
      useThemeStore.setState({ accessibilityMode: 'high-contrast' });
      useThemeStore.getState().setAccessibilityMode('normal');
      expect(useThemeStore.getState().accessibilityMode).toBe('normal');
    });
  });

  describe('setMotionPreferences', () => {
    it('should update reducedMotion', () => {
      useThemeStore.getState().setMotionPreferences({ reducedMotion: true });
      expect(useThemeStore.getState().motionPreferences.reducedMotion).toBe(true);
    });
    it('should merge with existing preferences', () => {
      useThemeStore.getState().setMotionPreferences({ reducedMotion: true });
      useThemeStore.getState().setMotionPreferences({ scaleDownTransitions: true });
      const prefs = useThemeStore.getState().motionPreferences;
      expect(prefs.reducedMotion).toBe(true);
      expect(prefs.scaleDownTransitions).toBe(true);
    });
  });

  describe('setTransitionType', () => {
    it('should set transition type to slide', () => {
      useThemeStore.getState().setTransitionType('slide');
      expect(useThemeStore.getState().transitionType).toBe('slide');
    });
    it('should set transition type to none', () => {
      useThemeStore.getState().setTransitionType('none');
      expect(useThemeStore.getState().transitionType).toBe('none');
    });
  });

  describe('saveCustomTheme', () => {
    it('should add a new custom theme', () => {
      const theme = { id: 'custom-1', name: 'My Theme', isPreset: false, colors: {} } as any;
      useThemeStore.getState().saveCustomTheme(theme);
      expect(useThemeStore.getState().customThemes).toHaveLength(1);
    });
    it('should update an existing custom theme', () => {
      const theme = { id: 'custom-1', name: 'My Theme', isPreset: false, colors: {} } as any;
      useThemeStore.setState({ customThemes: [theme] });
      useThemeStore.getState().saveCustomTheme({ ...theme, name: 'Updated' });
      expect(useThemeStore.getState().customThemes[0].name).toBe('Updated');
    });
  });

  describe('deleteCustomTheme', () => {
    it('should remove the custom theme', () => {
      const theme = { id: 'custom-1', name: 'My Theme', isPreset: false, colors: {} } as any;
      useThemeStore.setState({ customThemes: [theme] });
      useThemeStore.getState().deleteCustomTheme('custom-1');
      expect(useThemeStore.getState().customThemes).toHaveLength(0);
    });
    it('should fall back to light-default if deleted theme was active', () => {
      const theme = { id: 'custom-1', name: 'My Theme', isPreset: false, colors: {} } as any;
      useThemeStore.setState({ customThemes: [theme], activeThemeId: 'custom-1', mode: 'light' });
      useThemeStore.getState().deleteCustomTheme('custom-1');
      expect(useThemeStore.getState().activeThemeId).toBe('light-default');
    });
  });

  describe('resetToDefault', () => {
    it('should reset state to initial values', () => {
      useThemeStore.setState({ mode: 'dark', accessibilityMode: 'high-contrast' });
      useThemeStore.getState().resetToDefault();
      expect(useThemeStore.getState().mode).toBe('system');
      expect(useThemeStore.getState().accessibilityMode).toBe('normal');
    });
  });
});
