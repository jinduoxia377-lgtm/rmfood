import { useThemeStore, type PresetThemeId } from '@/theme';

export const parseThemeFromUrl = (): {
  theme?: string;
} | null => {
  const params = new URLSearchParams(window.location.search);
  
  const theme = params.get('theme') || undefined;

  if (!theme) {
    return null;
  }

  return { theme };
};

export const useThemeFromUrl = () => {
  const { setPresetTheme } = useThemeStore();

  const applyThemeFromUrl = () => {
    const params = parseThemeFromUrl();
    if (!params) return;

    if (params.theme) {
      setPresetTheme(params.theme as PresetThemeId);
    }
  };

  return { applyThemeFromUrl };
};
