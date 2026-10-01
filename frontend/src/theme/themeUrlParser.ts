import { useThemeStore, type PresetThemeId } from '@/theme';
import { decodeThemeFromUrl } from '@/utils/theme/ThemeShare';

/**
 * D-35 修复：`?theme=` 曾被**两套不兼容协议**同时占用 ——
 *   · 本文件原读 `?theme=<预设ID>`（如 `dark-default`）
 *   · `ThemeShare.generateShareLink` 写 `?theme=<base64(JSON)>`
 * 结果：分享链接的 base64 被当成预设 ID 传给 `setPresetTheme()`，
 * 无效 ID 静默回退到默认主题，用户看不到任何报错。
 *
 * 现拆分：
 *   · `?preset=<预设ID>`  → 切换内置预设
 *   · `?theme=<base64>`   → 导入完整主题配置（与 ThemeShare 一致）
 * 并保留对旧链接（预设 ID 写在 `?theme=`）的向后兼容。
 */

export interface ParsedThemeUrl {
  /** 内置预设 ID */
  preset?: string;
  /** base64 编码的主题配置（原始字符串） */
  themePayload?: string;
}

export const parseThemeFromUrl = (): ParsedThemeUrl | null => {
  const params = new URLSearchParams(window.location.search);

  const presetParam = params.get('preset') || undefined;
  const themeParam = params.get('theme') || undefined;

  let preset = presetParam;
  let themePayload: string | undefined;

  if (themeParam) {
    // `?theme=` 的**权威语义是 base64 主题配置**（与 ThemeShare 对齐）。
    // 先尝试按 base64 解码；解不出 JSON 且形如预设 ID 时，按旧协议当预设处理。
    const decoded = decodeThemeFromUrl(themeParam);
    if (decoded) {
      themePayload = themeParam;
    } else if (/^[a-z][a-z0-9-]{2,40}$/.test(themeParam)) {
      // 向后兼容：旧链接 `?theme=light-default`
      preset = preset || themeParam;
    } else {
      themePayload = themeParam;
    }
  }

  if (!preset && !themePayload) return null;
  return { preset, themePayload };
};

export const useThemeFromUrl = () => {
  const { setPresetTheme, importTheme } = useThemeStore();

  const applyThemeFromUrl = () => {
    const parsed = parseThemeFromUrl();
    if (!parsed) return;

    if (parsed.preset) {
      setPresetTheme(parsed.preset as PresetThemeId);
    }

    if (parsed.themePayload) {
      // 解码后交给 store 的 importTheme（内部走 mergeThemeOverrides 与白名单校验）
      const decoded = decodeThemeFromUrl(parsed.themePayload);
      if (decoded) {
        importTheme(JSON.stringify(decoded));
      }
    }
  };

  return { applyThemeFromUrl };
};
