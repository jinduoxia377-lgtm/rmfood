# -*- coding: utf-8 -*-
"""专业完善第二轮：DPP4 缺失守卫 + 逐残基概率表 + 门禁探针扩展"""
import io, re

P = r'D:\RMFOODFP\frontend\src\pages\database\tabs\PeptideStructureAnalyzer.tsx'
G = r'D:\RMFOODFP\backend\scripts\peptide_structure_guard.py'
src = io.open(P, encoding='utf-8').read()

# 1) 完整分析：DPP4 进度条加 ?? 0 守卫
old1 = '''<ScoreProgress label="DPP-IV抑制活性" score={result.dpp4_inhibition?.score ?? 0} />'''
assert old1 in src
# 已经是守卫形式，无需改

# 2) 深度分析：逐残基概率表
old2 = '''        {ss?.predicted_sequence && (
          <div className="mt-3 p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
            <div className="text-xs text-[var(--text-muted)] mb-1">结构序列 (H=螺旋 E=折叠 C=卷曲)</div>
            <div className="font-mono text-xs break-all">{ss.predicted_sequence}</div>
          </div>
        )}'''
new2 = '''        {ss?.predicted_sequence && (
          <div className="mt-3 p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
            <div className="text-xs text-[var(--text-muted)] mb-1">结构序列 (H=螺旋 E=折叠 C=卷曲)</div>
            <div className="font-mono text-xs break-all">{ss.predicted_sequence}</div>
          </div>
        )}
        {ss?.residue_probabilities && ss.residue_probabilities.length > 0 && (
          <div className="mt-3">
            <div className="text-xs text-[var(--text-muted)] mb-1">逐残基结构概率</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="px-2 py-1 text-left">位置</th>
                  <th className="px-2 py-1 text-left">氨基酸</th>
                  <th className="px-2 py-1 text-right">螺旋</th>
                  <th className="px-2 py-1 text-right">折叠</th>
                  <th className="px-2 py-1 text-right">卷曲</th>
                </tr></thead>
                <tbody>
                  {ss.residue_probabilities.map((rp: any) => (
                    <tr key={rp.position} className="border-b border-neutral-100 dark:border-neutral-800">
                      <td className="px-2 py-1 font-mono">{rp.position}</td>
                      <td className="px-2 py-1 font-mono font-medium">{rp.amino_acid}</td>
                      <td className="px-2 py-1 text-right font-mono">{(rp.helix * 100).toFixed(0)}%</td>
                      <td className="px-2 py-1 text-right font-mono">{(rp.sheet * 100).toFixed(0)}%</td>
                      <td className="px-2 py-1 text-right font-mono">{(rp.coil * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}'''
assert old2 in src, 'old2 not found'
src = src.replace(old2, new2)

io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('analyzer patched')

# 3) 门禁探针扩展
gsrc = io.open(G, encoding='utf-8').read()
marker = '''    # 前端高级工具 Tab 必须注册'''
addition = '''    # 完整分析 Tab：DPP4 + 来源证据 + 安全警告
    (
        "frontend/src/pages/database/tabs/PeptideStructureAnalyzer.tsx",
        r"result\.dpp4_inhibition\?",
        "完整分析 Tab：DPP4 抑制必须渲染（带缺失守卫）",
    ),
    (
        "frontend/src/pages/database/tabs/PeptideStructureAnalyzer.tsx",
        r"来源与证据",
        "完整分析 Tab：来源与证据卡片必须注册",
    ),
    # 深度分析 Tab：逐残基概率 + 聚集倾向 + 蛋白酶位点 + 储存条件
    (
        "frontend/src/pages/database/tabs/PeptideStructureAnalyzer.tsx",
        r"residue_probabilities",
        "深度分析 Tab：逐残基结构概率表必须渲染",
    ),
    (
        "frontend/src/pages/database/tabs/PeptideStructureAnalyzer.tsx",
        r"aggregation_potential",
        "深度分析 Tab：聚集倾向必须展示",
    ),
    (
        "frontend/src/pages/database/tabs/PeptideStructureAnalyzer.tsx",
        r"protease_cleavage_sites",
        "深度分析 Tab：蛋白酶切割位点必须渲染",
    ),
    (
        "frontend/src/pages/database/tabs/PeptideStructureAnalyzer.tsx",
        r"recommended_storage_conditions",
        "深度分析 Tab：推荐储存条件必须渲染",
    ),
    # 历史记录 Tab：抗菌/毒性/消化性三列
    (
        "frontend/src/pages/database/tabs/PeptideStructureAnalyzer.tsx",
        r"antimicrobial_score \?\? 0",
        "历史 Tab：抗菌评分列必须渲染（带缺失守卫）",
    ),
    (
        "frontend/src/pages/database/tabs/PeptideStructureAnalyzer.tsx",
        r"r\.is_toxic",
        "历史 Tab：毒性列必须渲染",
    ),
    (
        "frontend/src/pages/database/tabs/PeptideStructureAnalyzer.tsx",
        r"r\.digestibility",
        "历史 Tab：消化性列必须渲染",
    ),

    # 前端高级工具 Tab 必须注册'''
assert marker in gsrc, 'marker not found'
gsrc = gsrc.replace(marker, addition)
io.open(G, 'w', encoding='utf-8', newline='').write(gsrc)
print('guard patched')
print('ALL OK')
