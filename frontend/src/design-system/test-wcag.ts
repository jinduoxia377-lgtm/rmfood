/**
 * WCAG 2.1 AA 对比度验证测试
 *
 * 验证设计系统中的颜色组合是否符合 WCAG 2.1 AA 标准
 */

import {
  LIGHT_COLOR_TOKENS,
  DARK_COLOR_TOKENS,
  getContrastRatio,
  meetsWCAGAA,
  COLOR_CONTRAST_TESTS,
} from './tokens/color';

// 运行所有对比度测试
export function runContrastTests(): void {
  console.log('=== WCAG 2.1 AA 对比度验证测试 ===\n');

  // 测试预设的颜色组合
  COLOR_CONTRAST_TESTS.forEach((test) => {
    const status = test.meetsAA ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} - ${test.label}: ${test.ratio.toFixed(2)}:1`);
  });

  console.log('\n=== 扩展颜色组合测试 ===\n');

  // 测试浅色主题的文本颜色
  const lightTextTests = [
    { label: 'text.primary on background.default', fg: LIGHT_COLOR_TOKENS.text.primary, bg: LIGHT_COLOR_TOKENS.background.default },
    { label: 'text.secondary on background.default', fg: LIGHT_COLOR_TOKENS.text.secondary, bg: LIGHT_COLOR_TOKENS.background.default },
    { label: 'text.tertiary on background.default', fg: LIGHT_COLOR_TOKENS.text.tertiary, bg: LIGHT_COLOR_TOKENS.background.default },
    { label: 'text.disabled on background.default', fg: LIGHT_COLOR_TOKENS.text.disabled, bg: LIGHT_COLOR_TOKENS.background.default },
    { label: 'text.primary on surface.default', fg: LIGHT_COLOR_TOKENS.text.primary, bg: LIGHT_COLOR_TOKENS.surface.default },
    { label: 'text.secondary on surface.default', fg: LIGHT_COLOR_TOKENS.text.secondary, bg: LIGHT_COLOR_TOKENS.surface.default },
  ];

  lightTextTests.forEach((test) => {
    const ratio = getContrastRatio(test.fg, test.bg);
    const meetsAA = meetsWCAGAA(test.fg, test.bg);
    const status = meetsAA ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} (浅色) - ${test.label}: ${ratio.toFixed(2)}:1`);
  });

  console.log('\n=== 深色主题文本颜色测试 ===\n');

  // 测试深色主题的文本颜色
  const darkTextTests = [
    { label: 'text.primary on background.default', fg: DARK_COLOR_TOKENS.text.primary, bg: DARK_COLOR_TOKENS.background.default },
    { label: 'text.secondary on background.default', fg: DARK_COLOR_TOKENS.text.secondary, bg: DARK_COLOR_TOKENS.background.default },
    { label: 'text.tertiary on background.default', fg: DARK_COLOR_TOKENS.text.tertiary, bg: DARK_COLOR_TOKENS.background.default },
    { label: 'text.disabled on background.default', fg: DARK_COLOR_TOKENS.text.disabled, bg: DARK_COLOR_TOKENS.background.default },
    { label: 'text.primary on surface.default', fg: DARK_COLOR_TOKENS.text.primary, bg: DARK_COLOR_TOKENS.surface.default },
    { label: 'text.secondary on surface.default', fg: DARK_COLOR_TOKENS.text.secondary, bg: DARK_COLOR_TOKENS.surface.default },
  ];

  darkTextTests.forEach((test) => {
    const ratio = getContrastRatio(test.fg, test.bg);
    const meetsAA = meetsWCAGAA(test.fg, test.bg);
    const status = meetsAA ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} (深色) - ${test.label}: ${ratio.toFixed(2)}:1`);
  });

  console.log('\n=== 功能色测试 ===\n');

  // 测试功能色
  const functionalTests = [
    { label: 'error.on on error.main', fg: LIGHT_COLOR_TOKENS.error.on, bg: LIGHT_COLOR_TOKENS.error.main },
    { label: 'error.onContainer on error.container', fg: LIGHT_COLOR_TOKENS.error.onContainer, bg: LIGHT_COLOR_TOKENS.error.container },
    { label: 'success.on on success.main', fg: LIGHT_COLOR_TOKENS.success.on, bg: LIGHT_COLOR_TOKENS.success.main },
    { label: 'warning.on on warning.main', fg: LIGHT_COLOR_TOKENS.warning.on, bg: LIGHT_COLOR_TOKENS.warning.main },
    { label: 'info.on on info.main', fg: LIGHT_COLOR_TOKENS.info.on, bg: LIGHT_COLOR_TOKENS.info.main },
  ];

  functionalTests.forEach((test) => {
    const ratio = getContrastRatio(test.fg, test.bg);
    const meetsAA = meetsWCAGAA(test.fg, test.bg);
    const status = meetsAA ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} - ${test.label}: ${ratio.toFixed(2)}:1`);
  });

  // 总结
  const allTests = [
    ...COLOR_CONTRAST_TESTS,
    ...lightTextTests.map(t => ({ ...t, ratio: getContrastRatio(t.fg, t.bg), meetsAA: meetsWCAGAA(t.fg, t.bg) })),
    ...darkTextTests.map(t => ({ ...t, ratio: getContrastRatio(t.fg, t.bg), meetsAA: meetsWCAGAA(t.fg, t.bg) })),
    ...functionalTests.map(t => ({ ...t, ratio: getContrastRatio(t.fg, t.bg), meetsAA: meetsWCAGAA(t.fg, t.bg) })),
  ];

  const passed = allTests.filter(t => t.meetsAA).length;
  const total = allTests.length;

  console.log(`\n=== 测试总结 ===`);
  console.log(`通过: ${passed}/${total}`);
  console.log(`通过率: ${((passed / total) * 100).toFixed(1)}%`);

  if (passed === total) {
    console.log('\n✓ 所有颜色组合均符合 WCAG 2.1 AA 标准！');
  } else {
    console.log('\n✗ 部分颜色组合未通过 WCAG 2.1 AA 标准');
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  runContrastTests();
}

export {
  getContrastRatio,
  meetsWCAGAA,
};
