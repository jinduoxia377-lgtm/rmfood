/**
 * Theme Pro Plugin — Entry Point
 * RMFOOD 专业主题分析插件
 *
 * 功能:
 * - Host: 提供 themePro service + theme_pro_analyze 动态工具
 * - Client: 注入 Settings 面板的 Theme Pro 分析标签页
 *
 * 使用方式:
 * 1. 通过 cordis_run 加载此 Package
 * 2. 在 DSH 设置侧栏找到 "Theme Pro" 标签
 * 3. 或使用 theme_pro_analyze 工具执行分析
 */

// Host half
const hostPlugin = require('./host/plugin.js');

// Client half
const clientPlugin = require('./client/plugin.js');

/**
 * Cordis 插件入口
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
function apply(ctx) {
  const result = {};

  // Apply host half
  if (ctx.get('harness')) {
    Object.assign(result, hostPlugin.apply(ctx));
  }

  // Apply client half (slots available in browser)
  const slots = ctx.get('slots');
  if (slots) {
    Object.assign(result, clientPlugin.apply(ctx));
  }

  return result;
}

module.exports = {
  name: 'theme-pro',
  inject: [],
  apply,
};
