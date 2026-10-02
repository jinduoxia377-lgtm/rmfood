/**
 * 主题令牌安全校验测试（T-D2 / D-33）
 *
 * 背景：主题可经三条不可信路径进入（JSON 导入 / 文件上传 / URL 分享）。
 * 原实现把这些值拼接进 root.style.cssText，攻击者在 value 中放入 ';'
 * 即可越界注入任意 CSS 声明到 <html>。
 *
 * 本测试锁定 isSafeToken 的白名单边界，防止注入向量回归。
 */
import { describe, it, expect } from 'vitest';
import { isSafeToken } from '../theme.presets';

describe('isSafeToken — 令牌名校验', () => {
  it('接受合法的小写 kebab-case 自定义属性名', () => {
    for (const n of [
      '--color-primary',
      '--color-primary-500',
      '--text-primary',
      '--bg-surface-container-low',
      '--badge-draft-text-dark',
      '--z-modal-backdrop',
    ]) {
      expect(isSafeToken(n, '#10b981'), n).toBe(true);
    }
  });

  it('拒绝非自定义属性名与畸形命名', () => {
    for (const n of [
      'color',                 // 缺少 --
      '--',                    // 空名
      '--Color-Primary',       // 大写
      '--color_primary',       // 下划线
      '--color--primary',      // 连续连字符
      '-color-primary',        // 单连字符
      '--color primary',       // 含空格
      '--color-primary;',      // 含分隔符
      'background',            // 标准属性（越界目标）
      'position',
    ]) {
      expect(isSafeToken(n, '#10b981'), n).toBe(false);
    }
  });
});

describe('isSafeToken — 令牌值白名单', () => {
  it('接受合法颜色值', () => {
    for (const v of [
      '#10b981', '#10B981', '#fff', '#ffff', '#10b981ff',
      'rgb(16, 185, 129)', 'rgba(16, 185, 129, 0.15)',
      'rgb(16 185 129)', 'hsl(160, 84%, 39%)', 'hsla(160, 84%, 39%, 0.5)',
      'var(--color-primary-500)', 'var(--color-primary-500, #10b981)',
      'linear-gradient(135deg, #10b981, #34d399)',
      'radial-gradient(circle, rgba(148,163,184,.12) 1px, transparent 1px)',
      '#0f172a', 'none', 'auto', 'transparent', 'currentColor',
    ]) {
      expect(isSafeToken('--x', v), v).toBe(true);
    }
  });

  it('接受数值与单位', () => {
    for (const v of ['4px', '0.5rem', '200ms', '1.5', '100%', '50vh', '-1px']) {
      expect(isSafeToken('--x', v), v).toBe(true);
    }
  });

  it('拒绝所有 CSS 注入形态（D-33 回归锁）', () => {
    for (const v of [
      '#10b981; position: fixed',                       // 越界声明
      '#10b981;inset:0',
      'red; background-image: url(https://evil/x.png)', // 外部资源
      'var(--x); position: absolute',
      '#fff} body { display: none',
      '#fff { color: red }',
      'url(https://evil.example/x.png)',
      'expression(alert(1))',
      '#fff\\; color: red',
      '#fff; }',
      'red; @import "https://evil/x.css"',
    ]) {
      expect(isSafeToken('--color-primary', v), v).toBe(false);
    }
  });

  it('拒绝空值、超长值与不可打印内容', () => {
    expect(isSafeToken('--x', '')).toBe(false);
    expect(isSafeToken('--x', '   ')).toBe(false);
    expect(isSafeToken('--x', 'a'.repeat(400))).toBe(false);
    expect(isSafeToken('--x', '<script>alert(1)</script>')).toBe(false);
  });

  it('拒绝非字符串输入（防止对象/数组被字符串化后注入）', () => {
    expect(isSafeToken('--x', undefined as unknown as string)).toBe(false);
    expect(isSafeToken('--x', null as unknown as string)).toBe(false);
    expect(isSafeToken('--x', 123 as unknown as string)).toBe(false);
    expect(isSafeToken('--x', { toString: () => '#fff' } as unknown as string)).toBe(false);
    expect(isSafeToken(undefined as unknown as string, '#fff')).toBe(false);
  });
});
