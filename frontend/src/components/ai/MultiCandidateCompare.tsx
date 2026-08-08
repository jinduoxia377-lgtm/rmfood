import { useState } from 'react';
import { Card, Badge, Button } from '@/components/ui';
import { Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, ArrowUpDown } from 'lucide-react';
import type { AICandidate } from '@/api/ai';

interface MultiCandidateCompareProps {
  candidates: AICandidate[];
  onSelectCandidate?: (candidate: AICandidate) => void;
  selectedIndex?: number;
}

interface CompareResult {
  dimension: string;
  values: number[];
  bestIndex: number;
  differences: ('up' | 'down' | 'same')[];
}

export function MultiCandidateCompare({ candidates, onSelectCandidate, selectedIndex }: MultiCandidateCompareProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  if (!candidates || candidates.length < 2) {
    return (
      <Card className="p-6 text-center text-neutral-500">
        <p className="text-sm">需要至少2个候选方案才能进行对比分析</p>
      </Card>
    );
  }

  const scoreDimensions: { key: keyof AICandidate; label: string; format?: (v: any) => string }[] = [
    { key: 'overall_score', label: '综合评分', format: (v) => (v != null ? (v as number).toFixed(3) : '-') },
    { key: 'synergy_score', label: '协同评分', format: (v) => (v != null ? (v as number).toFixed(3) : '-') },
    { key: 'taste_score', label: '口感评分', format: (v) => (v != null ? (v as number).toFixed(3) : '-') },
    { key: 'stability_score', label: '稳定性', format: (v) => (v != null ? (v as number).toFixed(3) : '-') },
  ];

  const safetyOk = candidates.map((c) => c.safety_passed);
  const herbCounts = candidates.map((c) => c.herb_combination?.length ?? 0);
  const peptideCounts = candidates.map((c) => c.peptide_candidates?.length || 0);

  const compareValues = (values: number[]): CompareResult => {
    const bestIndex = values.reduce((bestIdx, val, idx, arr) => (val > arr[bestIdx] ? idx : bestIdx), 0);
    const differences = values.map((v) => (v > values[bestIndex] ? 'down' : v < values[bestIndex] ? 'up' : 'same'));
    return {
      dimension: '',
      values,
      bestIndex,
      differences,
    };
  };

  const overallScores = candidates.map((c) => c.overall_score ?? 0);
  const synergyScores = candidates.map((c) => c.synergy_score ?? 0);
  const tasteScores = candidates.map((c) => c.taste_score ?? 0);
  const stabilityScores = candidates.map((c) => c.stability_score ?? 0);

  const overallCompare = compareValues(overallScores);
  const synergyCompare = compareValues(synergyScores);
  const tasteCompare = compareValues(tasteScores);
  const stabilityCompare = compareValues(stabilityScores);

  const getDifferenceIcon = (diff: 'up' | 'down' | 'same') => {
    switch (diff) {
      case 'up':
        return <TrendingUp className="w-3 h-3 text-danger-500" />;
      case 'down':
        return <TrendingDown className="w-3 h-3 text-neutral-400" />;
      default:
        return <Minus className="w-3 h-3 text-neutral-300" />;
    }
  };

  const getCellClass = (diff: 'up' | 'down' | 'same', isBest: boolean) => {
    const baseClass = 'text-center px-3 py-2 text-sm';
    if (isBest && diff === 'same') {
      return `${baseClass} bg-success-50/50 dark:bg-success-900/20 font-semibold text-success-600`;
    }
    if (diff === 'up') {
      return `${baseClass} bg-danger-50/30 dark:bg-danger-900/10 text-danger-600 dark:text-danger-400`;
    }
    if (diff === 'down') {
      return `${baseClass} text-neutral-400`;
    }
    return `${baseClass} text-neutral-600 dark:text-neutral-400`;
  };

  const getHerbRoleSet = (candidate: AICandidate) => {
    const roles: Record<string, Set<string>> = { 君: new Set(), 臣: new Set(), 佐: new Set(), 使: new Set() };
    candidate.herb_combination?.forEach((h) => {
      const role = typeof h.role === 'string' ? h.role : '';
      const name = typeof h.name === 'string' ? h.name : '未知药材';
      if (/君/i.test(role)) roles['君'].add(name);
      else if (/臣/i.test(role)) roles['臣'].add(name);
      else if (/佐/i.test(role)) roles['佐'].add(name);
      else if (/使/i.test(role)) roles['使'].add(name);
    });
    return roles;
  };

  const candidate1Roles = getHerbRoleSet(candidates[0]);
  const candidate2Roles = getHerbRoleSet(candidates[1]);

  const getRoleDifferences = () => {
    const diffs: { type: 'added' | 'removed' | 'changed'; herb?: string; role?: string; text: string }[] = [];
    ['君', '臣', '佐', '使'].forEach((role) => {
      const set1 =
        role === '君'
          ? candidate1Roles['君']
          : role === '臣'
            ? candidate1Roles['臣']
            : role === '佐'
              ? candidate1Roles['佐']
              : candidate1Roles['使'];
      const set2 =
        role === '君'
          ? candidate2Roles['君']
          : role === '臣'
            ? candidate2Roles['臣']
            : role === '佐'
              ? candidate2Roles['佐']
              : candidate2Roles['使'];

      const added = [...set2].filter((x) => !set1.has(x));
      const removed = [...set1].filter((x) => !set2.has(x));

      added.forEach((h) => diffs.push({ type: 'added', herb: h, role, text: `方案二增加${role}药 ${h}` }));
      removed.forEach((h) => diffs.push({ type: 'removed', herb: h, role, text: `方案一独有${role}药 ${h}` }));
    });
    return diffs;
  };

  const roleDiffs = candidates.length === 2 ? getRoleDifferences() : [];

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary-500" />
          <h3 className="font-semibold">候选方案对比</h3>
        </div>
        <Badge variant="neutral" size="sm">
          {candidates.length} 套方案
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-primary-50 to-primary-100/50 dark:from-primary-900/20 dark:to-primary-800/10">
              <th className="px-4 py-3 text-left text-xs font-bold text-primary-800 dark:text-primary-200 border-b-2 border-primary-300 dark:border-primary-600">
                指标
              </th>
              {candidates.map((c, i) => (
                <th
                  key={i}
                  className={`px-4 py-3 text-center text-xs font-bold border-b-2 border-primary-300 dark:border-primary-600 ${
                    selectedIndex === i
                      ? 'bg-primary-100/50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'text-primary-800 dark:text-primary-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-1">
                      <Brain className="w-3 h-3" />
                      <span>方案 {i + 1}</span>
                    </div>
                    <div className="text-sm font-semibold">
                      {typeof c.formula_name === 'string' ? c.formula_name : '未知配方'}
                    </div>
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-bold text-primary-800 dark:text-primary-200 border-b-2 border-primary-300 dark:border-primary-600">
                <div className="flex items-center justify-center gap-1">
                  <ArrowUpDown className="w-3 h-3" />
                  差异分析
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {scoreDimensions.map((dim, dimIdx) => {
              const compare =
                dimIdx === 0
                  ? overallCompare
                  : dimIdx === 1
                    ? synergyCompare
                    : dimIdx === 2
                      ? tasteCompare
                      : stabilityCompare;
              const values =
                dimIdx === 0
                  ? overallScores
                  : dimIdx === 1
                    ? synergyScores
                    : dimIdx === 2
                      ? tasteScores
                      : stabilityScores;

              return (
                <tr
                  key={dim.key}
                  className={`${dimIdx % 2 === 0 ? 'bg-white dark:bg-neutral-800' : 'bg-slate-50/50 dark:bg-neutral-900/30'} hover:bg-primary-50/20 transition-colors`}
                >
                  <td className="px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300 border-r border-neutral-100 dark:border-neutral-700">
                    {dim.label}
                  </td>
                  {values.map((val, i) => (
                    <td
                      key={i}
                      className={`${getCellClass(compare.differences[i], i === compare.bestIndex)} border-r border-neutral-100 dark:border-neutral-700`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {getDifferenceIcon(compare.differences[i])}
                        <span>{dim.format ? dim.format(val) : val}</span>
                      </div>
                    </td>
                  ))}
                  <td className="px-4 py-3 text-xs text-neutral-500 text-center">
                    {compare.differences.filter((d) => d === 'up').length > 0 && (
                      <span className="text-danger-500">
                        方案 {compare.differences.findIndex((d) => d === 'up') + 1} 更优
                      </span>
                    )}
                    {compare.differences.every((d) => d === 'same') && <span className="text-neutral-400">持平</span>}
                  </td>
                </tr>
              );
            })}

            <tr className={`bg-white dark:bg-neutral-800 hover:bg-primary-50/20 transition-colors`}>
              <td className="px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300 border-r border-neutral-100 dark:border-neutral-700">
                安全状态
              </td>
              {safetyOk.map((ok, i) => (
                <td key={i} className="px-4 py-3 text-center border-r border-neutral-100 dark:border-neutral-700">
                  {ok ? (
                    <span className="inline-flex items-center gap-1 text-success-600 text-sm">
                      <CheckCircle className="w-4 h-4" /> 安全
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-warning-600 text-sm">
                      <AlertTriangle className="w-4 h-4" /> 预警
                    </span>
                  )}
                </td>
              ))}
              <td className="px-4 py-3 text-xs text-neutral-500 text-center">
                {safetyOk[0] !== safetyOk[1] && (
                  <Badge variant="warning" size="sm">
                    安全状态不同
                  </Badge>
                )}
                {safetyOk[0] === safetyOk[1] && <span className="text-neutral-400">状态一致</span>}
              </td>
            </tr>

            <tr className={`bg-slate-50/50 dark:bg-neutral-900/30 hover:bg-primary-50/20 transition-colors`}>
              <td className="px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300 border-r border-neutral-100 dark:border-neutral-700">
                药材数量
              </td>
              {herbCounts.map((count, i) => (
                <td
                  key={i}
                  className="px-4 py-3 text-center text-sm text-neutral-600 dark:text-neutral-400 border-r border-neutral-100 dark:border-neutral-700"
                >
                  {count} 味
                </td>
              ))}
              <td className="px-4 py-3 text-xs text-center">
                {herbCounts[0] !== herbCounts[1] && (
                  <span className="text-neutral-500">相差 {Math.abs(herbCounts[0] - herbCounts[1])} 味</span>
                )}
                {herbCounts[0] === herbCounts[1] && <span className="text-neutral-400">数量相同</span>}
              </td>
            </tr>

            <tr className={`bg-white dark:bg-neutral-800 hover:bg-primary-50/20 transition-colors`}>
              <td className="px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300 border-r border-neutral-100 dark:border-neutral-700">
                活性肽
              </td>
              {peptideCounts.map((count, i) => (
                <td
                  key={i}
                  className="px-4 py-3 text-center text-sm text-neutral-600 dark:text-neutral-400 border-r border-neutral-100 dark:border-neutral-700"
                >
                  {count} 个
                </td>
              ))}
              <td className="px-4 py-3 text-xs text-center">
                {peptideCounts[0] !== peptideCounts[1] && (
                  <span className="text-neutral-500">相差 {Math.abs(peptideCounts[0] - peptideCounts[1])} 个</span>
                )}
                {peptideCounts[0] === peptideCounts[1] && <span className="text-neutral-400">数量相同</span>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {roleDiffs.length > 0 && (
        <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
          <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning-500" />
            配方组成差异分析
          </h4>
          <div className="space-y-2">
            {roleDiffs.map((diff, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                  diff.type === 'added'
                    ? 'bg-success-50/50 dark:bg-success-900/20 text-success-600 dark:text-success-400'
                    : 'bg-danger-50/50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400'
                }`}
              >
                {diff.type === 'added' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{diff.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {candidates.length > 2 && (
        <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
          <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">药材组成</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {candidates.map((c, i) => (
              <div key={i} className="bg-slate-50/50 dark:bg-neutral-800/50 rounded-lg p-3">
                <div className="text-xs font-medium text-neutral-500 mb-2">
                  方案 {i + 1}: {typeof c.formula_name === 'string' ? c.formula_name : '未知配方'}
                </div>
                <div className="space-y-1">
                  {(c.herb_combination ?? []).map((h, j) => (
                    <div key={j} className="flex items-center justify-between text-xs">
                      <span className="text-neutral-600 dark:text-neutral-400">
                        {typeof h.name === 'string' ? h.name : '未知药材'}
                      </span>
                      <Badge variant="neutral" size="sm">
                        {typeof h.role === 'string' ? h.role : '其他'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center gap-3 pt-2">
        {candidates.map((c, i) => (
          <Button
            key={i}
            variant={selectedIndex === i ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onSelectCandidate?.(c)}
          >
            选择方案 {i + 1}
          </Button>
        ))}
      </div>
    </Card>
  );
}

export default MultiCandidateCompare;
