/**
 * M6 导出 — 客户端生成 Markdown / JSON 报告并触发下载
 *
 * 报告话术严格遵守合规红线：仅做信息比对参考，不含绝对化合规判定与功效声称。
 */
import type { LabelCheckResult, LabelIngredient } from '@/api/labelCheck';

/** 触发浏览器下载（Blob + a[download]） */
function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function timestampSlug(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function exportJson(result: LabelCheckResult): void {
  const payload = {
    report_id: result.report_id,
    generated_at: new Date().toISOString(),
    summary: result.summary,
    risk_score: result.risk_score ?? null,
    needs_review_count: result.needs_review_count ?? null,
    stats: result.stats ?? null,
    category_counts: result.category_counts,
    unknown_count: result.unknown_count,
    warning_count: result.warning_count,
    parse_warnings: result.parse_warnings ?? [],
    allergen_ingredients: result.allergen_ingredients,
    ingredients: result.ingredients,
    disclaimer: result.disclaimer,
  };
  downloadBlob(
    JSON.stringify(payload, null, 2),
    `label-check-${result.report_id || timestampSlug()}.json`,
    'application/json',
  );
}

function levelLabel(level: LabelIngredient['level']): string {
  switch (level) {
    case 'warning': return '警示';
    case 'note': return '注意';
    default: return '提示';
  }
}

export function exportMarkdown(result: LabelCheckResult): void {
  const L: string[] = [];
  L.push(`# 配料表核查报告`);
  L.push('');
  L.push(`- 报告编号：${result.report_id}`);
  L.push(`- 生成时间：${new Date().toLocaleString()}`);
  if (result.risk_score != null) {
    L.push(`- 目录比对提示分：${result.risk_score}/100（内部参考，非安全评分）`);
  }
  if (result.needs_review_count != null) {
    L.push(`- 需人工核实项：${result.needs_review_count}`);
  }
  L.push('');
  L.push(`## 摘要`);
  L.push('');
  L.push(result.summary);
  L.push('');

  // 分类分布
  const counts = Object.entries(result.category_counts ?? {});
  if (counts.length) {
    L.push(`## 分类分布`);
    L.push('');
    for (const [k, v] of counts) L.push(`- ${k}：${v}`);
    L.push('');
  }

  // 统计
  if (result.stats) {
    L.push(`## 统计`);
    L.push('');
    L.push(`- 识别成分：${result.stats.total}`);
    L.push(`- 命中目录：${result.stats.matched}`);
    L.push(`- 未收录：${result.stats.unmatched}`);
    L.push(`- 致敏项：${result.stats.allergen_count}`);
    L.push(`- 复合配料展开：${result.stats.compound_expanded}`);
    L.push('');
  }

  // 解析告警
  if (result.parse_warnings?.length) {
    L.push(`## 解析告警`);
    L.push('');
    for (const w of result.parse_warnings) L.push(`- ${w}`);
    L.push('');
  }

  // 致敏分组
  if (result.allergen_ingredients?.length) {
    L.push(`## 致敏物质`);
    L.push('');
    for (const a of result.allergen_ingredients) L.push(`- ${a.name}（${a.group}）`);
    L.push('');
  }

  // 成分明细
  L.push(`## 成分明细`);
  L.push('');
  for (const ing of result.ingredients) {
    L.push(`### ${ing.name}`);
    L.push('');
    L.push(`- 分类：${ing.category_label}`);
    L.push(`- 级别：${levelLabel(ing.level)}`);
    if (ing.caution) L.push(`- 人群禁忌：${ing.caution}`);
    if (ing.raw_name && ing.raw_name !== ing.name) L.push(`- 原始片段：${ing.raw_name}`);
    if (ing.match_method) L.push(`- 匹配方式：${ing.match_method}`);
    if (ing.match_confidence != null) L.push(`- 置信度：${Math.round(ing.match_confidence * 100)}%`);
    if (ing.aliases?.length) L.push(`- 别名链：${ing.aliases.join(' → ')}`);
    if (ing.max_dosage_mg_per_day != null) L.push(`- 每日限量：${ing.max_dosage_mg_per_day} mg`);
    if (ing.function) L.push(`- 功能：${ing.function}`);
    if (ing.max_usage) L.push(`- 最大使用量：${ing.max_usage}`);
    if (ing.source) L.push(`- 依据：${ing.source}`);
    if (ing.risk_contribution != null) L.push(`- 风险贡献：${ing.risk_contribution}`);
    if (ing.is_compound) L.push(`- 复合配料`);
    if (ing.sub_ingredients?.length) L.push(`- 子成分：${ing.sub_ingredients.join('、')}`);
    if (ing.allergen) L.push(`- 致敏：是${ing.allergen_group ? `（${ing.allergen_group}）` : ''}`);
    L.push(`- 说明：${ing.message}`);
    L.push('');
  }

  L.push(`---`);
  L.push('');
  L.push(`> ${result.disclaimer}`);

  downloadBlob(L.join('\n'), `label-check-${result.report_id || timestampSlug()}.md`, 'text/markdown');
}
