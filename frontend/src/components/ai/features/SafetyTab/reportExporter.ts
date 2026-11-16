/**
 * SafetyReportExporter - PDF export for safety check reports
 *
 * 采用仓库既定的「方案C：生成 HTML → 浏览器打印」范式（见 src/utils/pdfPrintExporter.ts），
 * 由浏览器原生渲染中文，避免纯文本绘制内置字体缺少 CJK 字形导致的中文乱码。
 * 所有文案均走 i18n（ai.safety.report.*），无英文硬编码。
 */
import i18n from '@/i18n';
import { exportHtmlAsPdf, wrapPrintHtml } from '@/utils/pdfPrintExporter';
import { feedbackService } from '@/services/feedbackService';
import type { SafetyCheckResult } from '@/types';

interface ExportOptions {
  ingredients: string[];
  result: SafetyCheckResult;
  complianceRate: number;
}

/** 品牌色（Forest Green），替代原先的非品牌蓝色带 */
const BRAND_GREEN = '#10B981';
const SUCCESS = '#22c55e';
const DANGER = '#dc2626';
const DARK = '#0f172a';
const GRAY = '#64748b';

/** 局部 t：统一取 ai.safety.report.* 命名空间文案 */
const t = (key: string, opts?: Record<string, unknown>): string =>
  i18n.t(`ai.safety.report.${key}`, opts) as string;

/** 转义用户数据，避免破坏 HTML 结构 / 注入 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function exportSafetyReport(options: ExportOptions): void {
  const { ingredients, result, complianceRate } = options;

  const passed = (result as Partial<SafetyCheckResult>).passed ?? true;
  const badgeColor = passed ? SUCCESS : DANGER;
  const badgeText = passed ? t('pass') : t('fail');

  const warnings = (result as Partial<SafetyCheckResult>).warnings || [];
  const errors = result.errors || [];
  const details: Record<string, unknown> =
    (result as unknown as { details?: Record<string, unknown> }).details || {};

  const dangerCount = warnings.filter((w: { level?: string }) =>
    ['danger', 'critical', 'contraindicated'].includes(w.level ?? ''),
  ).length;
  const warningCount = warnings.filter((w: { level?: string }) =>
    ['warning', 'caution'].includes(w.level ?? ''),
  ).length;

  // ===== 头部品牌横幅（Forest Green）=====
  const banner = `
    <div style="background:${BRAND_GREEN};color:#fff;padding:18px 20px;border-radius:6px;margin-bottom:18px;">
      <div style="font-size:20pt;font-weight:bold;">${escapeHtml(t('title'))}</div>
      <div style="font-size:10pt;margin-top:4px;">${escapeHtml(t('subtitle'))}</div>
      <div style="font-size:9pt;margin-top:6px;">${escapeHtml(new Date().toLocaleString('zh-CN'))}</div>
    </div>`;

  // ===== Overview =====
  const overview = `
    <h2>${escapeHtml(t('overview'))}</h2>
    <p style="color:${GRAY};font-size:9pt;">${escapeHtml(t('ingredients'))}</p>
    <p style="color:${DARK};font-size:10pt;">${escapeHtml(ingredients.join(', '))}</p>
    <p style="margin-top:8px;">
      <span style="display:inline-block;background:${badgeColor};color:#fff;font-weight:bold;font-size:9pt;padding:3px 10px;border-radius:4px;">${escapeHtml(badgeText)}</span>
      <span style="color:${DARK};font-size:11pt;font-weight:bold;margin-left:12px;">${escapeHtml(t('compliance', { rate: complianceRate.toFixed(1) }))}</span>
    </p>`;

  // ===== Risks =====
  const risks =
    dangerCount > 0 || warningCount > 0
      ? `<p style="color:${GRAY};font-size:9pt;margin-top:6px;">${escapeHtml(
          t('risks', { danger: dangerCount, warning: warningCount }),
        )}</p>`
      : '';

  // ===== Issues 表 =====
  const allIssues = [
    ...warnings.map((w) => ({
      type: w.level === 'danger' ? 'DANGER' : 'WARNING',
      ingredient: w.ingredient || (w as { name?: string }).name || '-',
      message: (w.message || (w as { reason?: string }).reason || String(w)).slice(0, 80),
    })),
    ...errors.map((e) => ({
      type: 'ERROR',
      ingredient: '-',
      message: (typeof e === 'string' ? e : (e as { message?: string }).message || String(e)).slice(0, 80),
    })),
  ];

  const issuesSection =
    allIssues.length > 0
      ? `
    <h2>${escapeHtml(t('issues'))}</h2>
    <table>
      <thead>
        <tr><th style="width:18%;">${escapeHtml(t('type'))}</th><th style="width:22%;">${escapeHtml(t('ingredient'))}</th><th>${escapeHtml(t('detail'))}</th></tr>
      </thead>
      <tbody>
        ${allIssues
          .map(
            (issue) =>
              `<tr><td style="font-weight:bold;">${escapeHtml(issue.type)}</td><td>${escapeHtml(issue.ingredient)}</td><td>${escapeHtml(issue.message)}</td></tr>`,
          )
          .join('')}
      </tbody>
    </table>`
      : '';

  // ===== Check Items 表 =====
  const checkKeys = Object.keys(details);
  const checkSection =
    checkKeys.length > 0
      ? `
    <h2>${escapeHtml(t('checkItems'))}</h2>
    <table>
      <thead>
        <tr><th style="width:30%;">${escapeHtml(t('item'))}</th><th style="width:18%;">${escapeHtml(t('result'))}</th><th>${escapeHtml(t('note'))}</th></tr>
      </thead>
      <tbody>
        ${checkKeys
          .map((key) => {
            const val = details[key] as { passed?: boolean; message?: string } | undefined;
            const isPassed = val?.passed ?? true;
            return `<tr><td style="font-weight:bold;">${escapeHtml(key.replace(/_/g, ' '))}</td><td>${escapeHtml(
              isPassed ? t('pass') : t('fail'),
            )}</td><td>${escapeHtml(val?.message || '')}</td></tr>`;
          })
          .join('')}
      </tbody>
    </table>`
      : '';

  // ===== 页脚 =====
  const footer = `<p style="color:${GRAY};font-size:8pt;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px;">${escapeHtml(
    t('footer'),
  )}</p>`;

  const contentHtml = `
    <style>
      .report-container h2 { color: ${BRAND_GREEN}; border-bottom-color: ${BRAND_GREEN}; }
    </style>
    ${banner}
    ${overview}
    ${risks}
    ${issuesSection}
    ${checkSection}
    ${footer}`;

  // 文件名逻辑保留：作为打印文档标题 / 用户「另存为 PDF」的默认命名
  const dateStr = new Date().toISOString().slice(0, 10);
  const title = 'safety_report_' + ingredients.slice(0, 3).join('-') + '_' + dateStr;

  exportHtmlAsPdf(wrapPrintHtml(contentHtml, title), {
    title,
    onError: (message) => {
      feedbackService.showError(i18n.t('ai.safety.notice') as string, message);
    },
  });
}
