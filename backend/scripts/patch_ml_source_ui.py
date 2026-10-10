# -*- coding: utf-8 -*-
"""PeptideStructureAnalyzer 增加真实 ML 模型卡片 + 高亮 NCBI 在线文献证据"""
import io, sys

P = r'D:\RMFOODFP\frontend\src\pages\database\tabs\PeptideStructureAnalyzer.tsx'
src = io.open(P, encoding='utf-8').read()

if 'result.ml_model ? (' in src and 'isOnline' in src:
    print('ALREADY APPLIED, skipping')
    sys.exit(0)

# 1) 在「活性预测」卡片后插入「真实 ML 模型」卡片（缩进：内层 18 空格 / 卡片 14 空格）
anchor1 = '''                    <Badge variant={getActivityBadge(result.dpp4_inhibition.level)}>DPP-IV: {result.dpp4_inhibition.level}</Badge>
                  )}
                </div>
              </Card>

              {/* 安全性评估 */}'''
new1 = '''                    <Badge variant={getActivityBadge(result.dpp4_inhibition.level)}>DPP-IV: {result.dpp4_inhibition.level}</Badge>
                  )}
                </div>
              </Card>

              {/* 真实 ML 模型（与 QSAR 规则分并列） */}
              <Card className="p-4">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  真实 ML 模型（PeptideRanker-Mini）
                  <span className="text-xs font-normal text-[var(--text-muted,#9A9A9F)]">并列于 QSAR 规则分</span>
                </h3>
                {result.ml_model ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded">
                        <div className="text-lg font-bold text-primary">
                          {result.ml_model.ace_score != null ? (result.ml_model.ace_score * 100).toFixed(1) + '%' : '-'}
                        </div>
                        <div className="text-xs text-[var(--text-muted,#9A9A9F)]">ML 模型 ACE 分</div>
                      </div>
                      <div className="p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded">
                        <div className="text-lg font-bold text-primary">
                          {result.ace_inhibition ? (result.ace_inhibition.score * 100).toFixed(1) + '%' : '-'}
                        </div>
                        <div className="text-xs text-[var(--text-muted,#9A9A9F)]">QSAR 规则 ACE 分</div>
                      </div>
                      <div className="p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded">
                        <div className="text-lg font-bold">
                          <Badge variant={result.ml_model.method === 'ml' ? 'success' : 'neutral'} size="sm">
                            {result.ml_model.method}
                          </Badge>
                        </div>
                        <div className="text-xs text-[var(--text-muted,#9A9A9F)]">方法（ml=真实权重）</div>
                      </div>
                      <div className="p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded">
                        <div className="text-lg font-bold">
                          {result.ml_model.validation_accuracy != null ? (result.ml_model.validation_accuracy * 100).toFixed(1) + '%' : '-'}
                        </div>
                        <div className="text-xs text-[var(--text-muted,#9A9A9F)]">验证准确率</div>
                      </div>
                    </div>
                    <div className="text-xs text-[var(--text-muted,#9A9A9F)]">
                      训练样本 {result.ml_model.training_samples} 条（DFBP 真实库）· 模型 {result.ml_model.name}
                      {result.ml_model.honest_note ? ` · ${result.ml_model.honest_note}` : ''}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-muted,#9A9A9F)]">ML 模型不可用（本次分析未启用真实模型预测）</p>
                )}
              </Card>

              {/* 安全性评估 */}'''
assert anchor1 in src, 'anchor1 not found'
src = src.replace(anchor1, new1, 1)

# 2) 来源证据卡：高亮 NCBI 在线文献（带 PMID 的 ref 用绿色 + 可点击链接）
anchor2 = '''                        <ul className="list-disc list-inside space-y-0.5">
                          {result.source.references.map((ref: string, i: number) => (
                            <li key={i} className="text-[var(--text-secondary,#6B7280)]">{ref}</li>
                          ))}
                        </ul>'''
new2 = '''                        <ul className="list-disc list-inside space-y-0.5">
                          {result.source.references.map((ref: string, i: number) => {
                            const isOnline = ref.includes('PubMed') || ref.includes('PMID');
                            const pmidMatch = ref.match(/PMID:(\\d+)/);
                            return (
                              <li key={i} className={`text-xs ${isOnline ? 'text-success-600 dark:text-success-500' : 'text-[var(--text-secondary,#6B7280)]'}`}>
                                {isOnline && pmidMatch ? (
                                  <a href={`https://www.ncbi.nlm.nih.gov/pubmed/${pmidMatch[1]}/`} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted">
                                    {ref}
                                  </a>
                                ) : (
                                  ref
                                )}
                              </li>
                            );
                          })}
                        </ul>'''
assert anchor2 in src, 'anchor2 not found'
src = src.replace(anchor2, new2, 1)

io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('ML + SOURCE UI PATCH OK')
