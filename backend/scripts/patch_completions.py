# -*- coding: utf-8 -*-
"""专业完善：补全 /peptide-structure 三处字段闲置问题
1. 完整分析 Tab：DPP4 抑制 + 来源/证据 + 安全警告
2. 深度分析 Tab：聚集倾向 + 主导结构 + 蛋白酶切割位点 + 储存条件
3. 历史记录 Tab：抗菌评分 + 毒性列 + 消化性列
"""
import io

P = r'D:\RMFOODFP\frontend\src\pages\database\tabs\PeptideStructureAnalyzer.tsx'
src = io.open(P, encoding='utf-8').read()

# ════════ 1. 完整分析 Tab：活性预测卡片增加 DPP4 ════════
old1 = '''                <div className="space-y-3">
                  <ScoreProgress label="ACE抑制活性" score={result.ace_inhibition.score} />
                  <ScoreProgress label="抗氧化活性" score={result.antioxidant.score} />
                  <ScoreProgress label="抗菌活性" score={result.antimicrobial.score} />
                </div>
                <div className="mt-3 flex gap-2 flex-wrap">
                  <Badge variant={getActivityBadge(result.ace_inhibition.level)}>ACE抑制: {result.ace_inhibition.level}</Badge>
                  <Badge variant={getActivityBadge(result.antioxidant.level)}>抗氧化: {result.antioxidant.level}</Badge>
                  <Badge variant={getActivityBadge(result.antimicrobial.level)}>抗菌: {result.antimicrobial.level}</Badge>
                </div>'''
new1 = '''                <div className="space-y-3">
                  <ScoreProgress label="ACE抑制活性" score={result.ace_inhibition.score} />
                  <ScoreProgress label="抗氧化活性" score={result.antioxidant.score} />
                  <ScoreProgress label="抗菌活性" score={result.antimicrobial.score} />
                  <ScoreProgress label="DPP-IV抑制活性" score={result.dpp4_inhibition.score} />
                </div>
                <div className="mt-3 flex gap-2 flex-wrap">
                  <Badge variant={getActivityBadge(result.ace_inhibition.level)}>ACE抑制: {result.ace_inhibition.level}</Badge>
                  <Badge variant={getActivityBadge(result.antioxidant.level)}>抗氧化: {result.antioxidant.level}</Badge>
                  <Badge variant={getActivityBadge(result.antimicrobial.level)}>抗菌: {result.antimicrobial.level}</Badge>
                  <Badge variant={getActivityBadge(result.dpp4_inhibition.level)}>DPP-IV: {result.dpp4_inhibition.level}</Badge>
                </div>'''
assert old1 in src, 'old1 (activity card) not found'
src = src.replace(old1, new1)

# ════════ 2. 完整分析 Tab：安全性评估卡片后增加"来源与证据"卡片 ════════
old2 = '''              <div className="text-xs text-[var(--text-muted,#9A9A9F)] text-right">
                分析时间: {new Date(result.analysis_time).toLocaleString()}
              </div>'''
new2 = '''              {/* 来源与证据 */}
              {(result.source?.food || result.source?.database || (result.source?.references?.length > 0) || result.safety?.warnings?.length > 0) && (
                <Card className="p-4">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    来源与证据
                  </h3>
                  <div className="space-y-2 text-xs">
                    {result.source?.food && (
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted,#9A9A9F)]">食物来源</span>
                        <span className="font-medium">{result.source.food}</span>
                      </div>
                    )}
                    {result.source?.database && (
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted,#9A9A9F)]">数据库</span>
                        <span className="font-medium">{result.source.database}</span>
                      </div>
                    )}
                    {result.source?.references?.length > 0 && (
                      <div>
                        <div className="text-[var(--text-muted,#9A9A9F)] mb-1">文献参考</div>
                        <ul className="list-disc list-inside space-y-0.5">
                          {result.source.references.map((ref: string, i: number) => (
                            <li key={i} className="text-[var(--text-secondary,#6B7280)]">{ref}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {result.safety?.warnings?.length > 0 && (
                      <div>
                        <div className="text-warning-600 dark:text-warning-500 mb-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />安全警告
                        </div>
                        <ul className="list-disc list-inside space-y-0.5">
                          {result.safety.warnings.map((w: string, i: number) => (
                            <li key={i} className="text-[var(--text-secondary,#6B7280)]">{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              <div className="text-xs text-[var(--text-muted,#9A9A9F)] text-right">
                分析时间: {new Date(result.analysis_time).toLocaleString()}
              </div>'''
assert old2 in src, 'old2 (analysis time) not found'
src = src.replace(old2, new2)

# ════════ 3. 深度分析 Tab：安全性评估卡片增加 蛋白酶切割位点 + 储存条件 ════════
old3 = '''              ['综合得分', (os.composite ?? 0).toFixed(2)],
              ['稳定性得分', (os.stability ?? 0).toFixed(2)],
              ['安全得分', (os.safety ?? 0).toFixed(2)],
              ['类药性得分', (os.druglikeness ?? 0).toFixed(2)],
              ['风险等级', sa?.risk_level ?? 'N/A'],
              ['过敏风险', `${((sa?.allergenicity_risk ?? 0) * 100).toFixed(0)}%`],
              ['免疫原性风险', `${((sa?.immunogenicity_risk ?? 0) * 100).toFixed(0)}%`],
            ].map(([label, val]: any) => (
              <div key={label} className="flex justify-between">
                <span className="text-[var(--text-muted)]">{label}</span>
                <span className="font-mono font-medium">{String(val)}</span>
              </div>
            ))}'''
new3 = '''              ['综合得分', (os.composite ?? 0).toFixed(2)],
              ['稳定性得分', (os.stability ?? 0).toFixed(2)],
              ['安全得分', (os.safety ?? 0).toFixed(2)],
              ['类药性得分', (os.druglikeness ?? 0).toFixed(2)],
              ['风险等级', sa?.risk_level ?? 'N/A'],
              ['过敏风险', `${((sa?.allergenicity_risk ?? 0) * 100).toFixed(0)}%`],
              ['免疫原性风险', `${((sa?.immunogenicity_risk ?? 0) * 100).toFixed(0)}%`],
              ['聚集倾向', ss?.aggregation_potential ?? 'N/A'],
            ].map(([label, val]: any) => (
              <div key={label} className="flex justify-between">
                <span className="text-[var(--text-muted)]">{label}</span>
                <span className="font-mono font-medium">{String(val)}</span>
              </div>
            ))}
            {sa?.protease_cleavage_sites?.length > 0 && (
              <div className="mt-3 p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                <div className="text-xs text-[var(--text-muted)] mb-1">蛋白酶切割位点</div>
                <div className="flex flex-wrap gap-1">
                  {sa.protease_cleavage_sites.map((site: any, i: number) => (
                    <Badge key={i} variant="outline" size="sm">
                      {typeof site === 'object' ? `${site.bond ?? site.position ?? i} (${site.enzyme ?? 'protease'})` : String(site)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {sa?.recommended_storage_conditions && (
              <div className="mt-2 p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg text-xs">
                <span className="text-[var(--text-muted)]">推荐储存： </span>
                <span className="font-medium">{Array.isArray(sa.recommended_storage_conditions) ? sa.recommended_storage_conditions.join(', ') : String(sa.recommended_storage_conditions)}</span>
              </div>
            )}'''
assert old3 in src, 'old3 (deep safety card) not found'
src = src.replace(old3, new3)

# ════════ 4. 深度分析 Tab：二级结构卡片增加主导结构 ════════
old4 = '''        <div className="grid grid-cols-3 gap-3">
          {[
            ['α-螺旋 (%)', ss?.alpha_helix ?? 0, '#3b82f6'],
            ['β-折叠 (%)', ss?.beta_sheet ?? 0, 'var(--color-primary-500)'],
            ['无规卷曲 (%)', ss?.random_coil ?? 0, '#f59e0b'],
          ].map(([label, val, color]: any) => ('''
new4 = '''        <div className="flex items-center justify-between mb-3 text-xs">
          <span className="text-[var(--text-muted)]">主导结构： <span className="font-medium text-neutral-700 dark:text-neutral-300">{ss?.dominant_structure ?? 'N/A'}</span></span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ['α-螺旋 (%)', ss?.alpha_helix ?? 0, '#3b82f6'],
            ['β-折叠 (%)', ss?.beta_sheet ?? 0, 'var(--color-primary-500)'],
            ['无规卷曲 (%)', ss?.random_coil ?? 0, '#f59e0b'],
          ].map(([label, val, color]: any) => ('''
assert old4 in src, 'old4 (deep secondary structure) not found'
src = src.replace(old4, new4)

# ════════ 5. 历史记录 Tab：表头增加 抗菌/毒性/消化性 列 ════════
old5 = '''              <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted,#9A9A9F)]">ACE</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted,#9A9A9F)]">抗氧化</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-[var(--text-muted,#9A9A9F)]">过敏</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-[var(--text-muted,#9A9A9F)]">时间</th>'''
new5 = '''              <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted,#9A9A9F)]">ACE</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted,#9A9A9F)]">抗氧化</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted,#9A9A9F)]">抗菌</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-[var(--text-muted,#9A9A9F)]">过敏</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-[var(--text-muted,#9A9A9F)]">毒性</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-[var(--text-muted,#9A9A9F)]">消化性</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-[var(--text-muted,#9A9A9F)]">时间</th>'''
assert old5 in src, 'old5 (history header) not found'
src = src.replace(old5, new5)

# ════════ 6. 历史记录 Tab：表格行增加 抗菌/毒性/消化性 单元格 ════════
old6 = '''                <td className="px-3 py-2 text-right">{(r.antioxidant_score * 100).toFixed(1)}%</td>
                <td className="px-3 py-2 text-center">
                  {r.is_allergen ? (
                    <span className="text-error-500">是</span>
                  ) : (
                    <span className="text-success-500">否</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-[var(--text-muted,#9A9A9F)]">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>'''
new6 = '''                <td className="px-3 py-2 text-right">{(r.antioxidant_score * 100).toFixed(1)}%</td>
                <td className="px-3 py-2 text-right">{((r.antimicrobial_score ?? 0) * 100).toFixed(1)}%</td>
                <td className="px-3 py-2 text-center">
                  {r.is_allergen ? (
                    <span className="text-error-500">是</span>
                  ) : (
                    <span className="text-success-500">否</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {r.is_toxic ? (
                    <span className="text-error-500">是</span>
                  ) : (
                    <span className="text-success-500">否</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center capitalize">{r.digestibility || '未知'}</td>
                <td className="px-3 py-2 text-xs text-[var(--text-muted,#9A9A9F)]">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>'''
assert old6 in src, 'old6 (history row) not found'
src = src.replace(old6, new6)

# ════════ 7. HistoryRecord 类型增加 antimicrobial_score / is_toxic / digestibility ════════
# 找 interface HistoryRecord
m = None
import re
m = re.search(r'(interface HistoryRecord \{.*?\n\})', src, re.DOTALL)
if m:
    blk = m.group(1)
    if 'antimicrobial_score' not in blk:
        new_blk = blk.replace('\n}', '\n  antimicrobial_score?: number;\n  is_toxic?: boolean;\n  digestibility?: string;\n}')
        src = src.replace(blk, new_blk)
        print('HistoryRecord interface extended')
    else:
        print('HistoryRecord already has antimicrobial_score')
else:
    # fallback: HistoryRecord 可能不是 interface
    print('WARN: HistoryRecord interface block not found, skip type extension')

io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('ALL PATCHES OK')
