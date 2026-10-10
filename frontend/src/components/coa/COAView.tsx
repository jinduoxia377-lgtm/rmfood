/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * COA出厂检验报告查看组件
 *
 * 类Word文档布局，展示完整的COA报告内容
 * 对标鱼胶原蛋白肽出厂报告模板结构
 */
import React, { useMemo, useState } from 'react';
import { Download, Printer, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { PeptideBatchCOA, COATestItem } from '@/services/professional/coaService';
import { getCategoryLabel, isCOAQualified, formatDate, groupTestItemsByCategory } from '@/services/professional/coaService';
import { useToast } from '@/components/ui';

// ─── 组件 Props ─────────────────────────────────────────────

interface COAViewProps {
  coa: PeptideBatchCOA;
  onDownloadPdf?: () => void;
  onPrint?: () => void;
  compact?: boolean;
  showExport?: boolean;
}

// ─── COA 报告头部 ───────────────────────────────────────────

const COAHeader: React.FC<{ companyName: string; companyNameEn: string }> = ({
  companyName, companyNameEn,
}) => (
  <div className="text-center mb-6 pb-4 border-b-2 border-[var(--color-primary, #1a56db)]">
    <h1 className="text-2xl font-bold text-[var(--color-primary, #1a56db)] mb-1">
      {companyName}
    </h1>
    <p className="text-sm text-[var(--text-muted, #64748b)] uppercase tracking-wider">
      {companyNameEn}
    </p>
  </div>
);

// ─── COA 标题 ───────────────────────────────────────────────

const COATitle: React.FC = () => (
  <div className="text-center mb-6">
    <h2 className="text-xl font-bold text-[var(--text-primary, #1e293b)]">
      成品检测报告
    </h2>
    <p className="text-sm text-[var(--text-muted, #64748b)] uppercase tracking-widest mt-1">
      CERTIFICATE OF ANALYSIS
    </p>
  </div>
);

// ─── 基础信息表 ──────────────────────────────────────────────

const COABasicInfoTable: React.FC<{ coa: PeptideBatchCOA }> = ({ coa }) => {
  const fields = [
    { label: '产品名称', labelEn: 'Product Name', value: coa.product_name_cn, enValue: coa.product_name_en },
    { label: '产品类型', labelEn: 'Product Type', value: coa.product_type },
    { label: '型号', labelEn: 'Code', value: coa.product_code },
    { label: '规格', labelEn: 'Spec', value: coa.spec },
    { label: '生产日期', labelEn: 'Mfg. Date', value: formatDate(coa.mfg_date) },
    { label: '生产批号', labelEn: 'Batch No.', value: coa.batch_no },
    ...(coa.expiry_date ? [{ label: '有效期', labelEn: 'Expiry Date', value: formatDate(coa.expiry_date) }] : []),
    ...(coa.enterprise_standard ? [{ label: '企业标准', labelEn: 'Enterprise Std.', value: coa.enterprise_standard }] : []),
  ];

  return (
    <table className="w-full text-sm mb-6 border-collapse">
      <tbody>
        {fields.map((field, idx) => (
          <tr key={idx} className={idx % 2 === 0 ? 'bg-neutral-50 dark:bg-neutral-800' : ''}>
            <td className="border border-[var(--border-subtle, #e2e8f0)] px-3 py-2 font-semibold text-[var(--text-primary, #1e293b)] w-28 text-center align-middle">
              <div>{field.label}</div>
              <div className="text-xs text-[var(--text-muted, #94a3b8)] font-normal">{field.labelEn}</div>
            </td>
            <td className="border border-[var(--border-subtle, #e2e8f0)] px-3 py-2 text-[var(--text-primary, #1e293b)]">
              {field.value || '-'}
              {field.enValue && (
                <div className="text-xs text-[var(--text-muted, #94a3b8)] mt-0.5">{field.enValue}</div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ─── 检验结果表格 ────────────────────────────────────────────

const COATestResultTable: React.FC<{
  items: COATestItem[];
  standard?: string;
}> = ({ items, standard }) => {
  const grouped = useMemo(() => groupTestItemsByCategory(items), [items]);

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-muted, #94a3b8)]">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>暂无检验数据</p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      {/* 检验依据 */}
      {standard && (
        <div className="mb-3 text-sm text-[var(--text-primary, #1e293b)] bg-secondary-50 border-l-4 border-secondary-500 px-3 py-2 rounded">
          <span className="font-semibold">检测、判定依据：</span>
          {standard}
        </div>
      )}

      {/* 分类标签 */}
      {Object.entries(grouped).filter(([, v]) => v.length > 0).map(([category, categoryItems]) => (
        <div key={category} className="mb-4">
          <h4 className="text-sm font-semibold text-[var(--color-primary, #1a56db)] mb-2 px-1">
            {getCategoryLabel(category)}
          </h4>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800">
                <th className="border border-[var(--border-subtle, #e2e8f0)] px-3 py-2 text-left font-semibold text-[var(--text-primary, #1e293b)] w-1/4">
                  项目
                </th>
                <th className="border border-[var(--border-subtle, #e2e8f0)] px-3 py-2 text-left font-semibold text-[var(--text-primary, #1e293b)] w-1/4">
                  标准
                </th>
                <th className="border border-[var(--border-subtle, #e2e8f0)] px-3 py-2 text-center font-semibold text-[var(--text-primary, #1e293b)] w-1/4">
                  检测结果
                </th>
                <th className="border border-[var(--border-subtle, #e2e8f0)] px-3 py-2 text-center font-semibold text-[var(--text-primary, #1e293b)] w-1/6">
                  单项判定
                </th>
              </tr>
            </thead>
            <tbody>
              {categoryItems.map((item, idx) => (
                <tr key={item.id ?? idx} className={idx % 2 === 0 ? 'bg-white dark:bg-neutral-900' : 'bg-neutral-50 dark:bg-neutral-800'}>
                  <td className="border border-[var(--border-subtle, #e2e8f0)] px-3 py-2">
                    <div className="font-medium text-[var(--text-primary, #1e293b)]">{item.item_name}</div>
                    {item.item_name_en && (
                      <div className="text-xs text-[var(--text-muted, #94a3b8)]">{item.item_name_en}</div>
                    )}
                  </td>
                  <td className="border border-[var(--border-subtle, #e2e8f0)] px-3 py-2 text-[var(--text-primary, #1e293b)]">
                    {item.standard}
                    {item.unit && <span className="text-xs text-[var(--text-muted, #94a3b8)] ml-1">({item.unit})</span>}
                  </td>
                  <td className="border border-[var(--border-subtle, #e2e8f0)] px-3 py-2 text-center font-mono text-[var(--text-primary, #1e293b)]">
                    {item.result || '-'}
                  </td>
                  <td className="border border-[var(--border-subtle, #e2e8f0)] px-3 py-2 text-center">
                    {item.judgment === '符合' ? (
                      <span className="inline-flex items-center gap-1 text-success-600 font-semibold text-xs">
                        <CheckCircle className="w-3 h-3" /> 符合 Conform
                      </span>
                    ) : item.judgment === '不符合' ? (
                      <span className="inline-flex items-center gap-1 text-error-600 font-semibold text-xs">
                        <XCircle className="w-3 h-3" /> 不符合
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted, #94a3b8)] text-xs">待判定</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

// ─── COA 结论区 ──────────────────────────────────────────────

const COAConclusion: React.FC<{
  coa: PeptideBatchCOA;
  basis?: string;
}> = ({ coa, basis }) => (
  <div className="mt-6 pt-4 border-t border-[var(--border-subtle, #e2e8f0)]">
    <div className="flex items-start gap-4 mb-4">
      <div className="flex-1">
        <div className="text-sm font-semibold text-[var(--text-primary, #1e293b)] mb-1">结论 Conclusion</div>
        <div className={`text-sm px-3 py-2 rounded-lg ${
          coa.qualified
            ? 'bg-success-50 text-success-700 border border-success-200'
            : 'bg-error-50 text-error-700 border border-error-200'
        }`}>
          {basis || `该批产品符合 ${coa.gb_standard || '相关标准'} 出厂检验要求，${coa.test_conclusion}`}
        </div>
      </div>
    </div>

    {/* 签名区 */}
    <div className="grid grid-cols-3 gap-4 mt-4">
      <div className="text-sm">
        <div className="text-[var(--text-muted, #64748b)] mb-1">检测 Tested By</div>
        <div className="font-semibold text-[var(--text-primary, #1e293b)]">{coa.tested_by || '-'}</div>
        <div className="text-xs text-[var(--text-muted, #94a3b8)] mt-1">
          时间: {formatDate(coa.mfg_date)}
        </div>
      </div>
      <div className="text-sm">
        <div className="text-[var(--text-muted, #64748b)] mb-1">校对人 Checked By</div>
        <div className="font-semibold text-[var(--text-primary, #1e293b)]">{coa.checked_by || '-'}</div>
        <div className="text-xs text-[var(--text-muted, #94a3b8)] mt-1">
          时间: {formatDate(coa.mfg_date)}
        </div>
      </div>
      <div className="text-sm">
        <div className="text-[var(--text-muted, #64748b)] mb-1">批准人 Approved By</div>
        <div className="font-semibold text-[var(--text-primary, #1e293b)]">{coa.approved_by || '-'}</div>
        <div className="text-xs text-[var(--text-muted, #94a3b8)] mt-1">
          时间: {formatDate(coa.mfg_date)}
        </div>
      </div>
    </div>
  </div>
);

// ─── 主组件 ──────────────────────────────────────────────────

export const COAView: React.FC<COAViewProps> = ({
  coa,
  onDownloadPdf,
  onPrint,
  compact = false,
  showExport = true,
}) => {
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const [downloading, setDownloading] = useState<'word' | 'pdf' | null>(null);
  const [showAllItems, setShowAllItems] = useState(false);

  const handleGenerateWord = async () => {
    try {
      setDownloading('word');
      const { coaService } = await import('@/services/professional/coaService');
      const blob = await coaService.generateWord(coa.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `COA_${coa.batch_no}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toastSuccess('COA Word 已生成并下载');
    } catch {
      toastError('Word 文档生成失败');
    } finally {
      setDownloading(null);
    }
  };

  const handleGeneratePdf = async () => {
    try {
      setDownloading('pdf');
      const { coaService } = await import('@/services/professional/coaService');
      const blob = await coaService.generatePdf(coa.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `COA_${coa.batch_no}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toastSuccess('COA PDF 已生成并下载');
    } catch {
      toastError('PDF 文档生成失败');
    } finally {
      setDownloading(null);
    }
  };

  // 限制卡片中显示的测试项数量
  const displayItems: COATestItem[] = showAllItems ? (coa.test_items ?? []) : ((coa.test_items?.slice(0, 5)) || []);
  const hasMoreItems = ((coa.test_items ?? []).length) > 5;

  return (
    <div className={`bg-white dark:bg-neutral-900 rounded-xl border border-[var(--border-subtle, #e2e8f0)] overflow-hidden ${compact ? '' : 'shadow-sm'}`}>
      {/* 操作栏 */}
      {!compact && (
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border-b border-[var(--border-subtle, #e2e8f0)]">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              coa.qualified
                ? 'bg-success-100 text-success-700'
                : coa.test_conclusion === '不合格'
                  ? 'bg-error-100 text-error-700'
                  : 'bg-warning-100 text-warning-700'
            }`}>
              {coa.qualified ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {coa.test_conclusion}
            </span>
            {coa.gb_standard && (
              <span className="text-xs text-[var(--text-muted, #94a3b8)]">
                {coa.gb_standard}
              </span>
            )}
            {displayItems.length > 0 && (
              <span className="text-xs text-[var(--text-muted, #94a3b8)]">
                {displayItems.filter(i => i.judgment === '符合').length}/{displayItems.length} 项检测
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showExport && (
              <>
                <button
                  onClick={handleGenerateWord}
                  disabled={downloading !== null}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--text-muted, #64748b)] hover:text-[var(--color-primary, #1a56db)] hover:bg-secondary-50 rounded-lg transition-colors disabled:opacity-50"
                  title="生成并下载 Word 文档"
                >
                  {downloading === 'word'
                    ? <span className="animate-spin">⟳</span>
                    : <Download className="w-3.5 h-3.5" />}
                  Word
                </button>
                <button
                  onClick={handleGeneratePdf}
                  disabled={downloading !== null}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--text-muted, #64748b)] hover:text-[var(--color-primary, #1a56db)] hover:bg-secondary-50 rounded-lg transition-colors disabled:opacity-50"
                  title="生成并下载 PDF 文档"
                >
                  {downloading === 'pdf'
                    ? <span className="animate-spin">⟳</span>
                    : <Download className="w-3.5 h-3.5" />}
                  PDF
                </button>
              </>
            )}
            {onDownloadPdf && (
              <button
                onClick={onDownloadPdf}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--text-muted, #64748b)] hover:text-[var(--color-primary, #1a56db)] hover:bg-secondary-50 rounded-lg transition-colors"
                title="打开原PDF"
              >
                <Download className="w-3.5 h-3.5" />
                原PDF
              </button>
            )}
            {onPrint && (
              <button
                onClick={onPrint}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--text-muted, #64748b)] hover:text-[var(--color-primary, #1a56db)] hover:bg-secondary-50 rounded-lg transition-colors"
                title="打印"
              >
                <Printer className="w-3.5 h-3.5" />
                打印
              </button>
            )}
          </div>
        </div>
      )}

      {/* COA 报告内容 */}
      <div className="p-6">
        <COAHeader
          companyName="莱茵（厦门）分子生物科技有限公司"
          companyNameEn="RHEIN (XIAMEN) MOLEKÜL BIOTECH INC"
        />
        <COATitle />
        <COABasicInfoTable coa={coa} />

        {/* 检验结果 - 卡片模式下可折叠 */}
        <COATestResultTable items={displayItems} standard={coa.gb_standard ?? undefined} />

        {hasMoreItems && !compact && (
          <button
            onClick={() => setShowAllItems(v => !v)}
            className="mb-4 text-xs text-[var(--color-primary)] hover:underline"
          >
            {showAllItems ? '收起 ▲' : `显示全部 ${coa.test_items!.length} 项检测 ▼`}
          </button>
        )}

        <COAConclusion coa={coa} basis={coa.inspection_basis} />
      </div>
    </div>
  );
};

// ─── COA 列表卡片 ────────────────────────────────────────────

export const COACard: React.FC<{
  coa: PeptideBatchCOA;
  onClick?: () => void;
}> = ({ coa, onClick }) => (
  <div
     role="button" tabIndex={0} onClick={onClick}
    className="bg-white dark:bg-neutral-900 rounded-xl border border-[var(--border-subtle, #e2e8f0)] p-4 cursor-pointer hover:shadow-md hover:border-[var(--color-primary, #1a56db)]/30 transition-all"
  >
    <div className="flex items-start justify-between mb-3">
      <div>
        <h3 className="font-semibold text-[var(--text-primary, #1e293b)]">{coa.product_name_cn}</h3>
        <p className="text-xs text-[var(--text-muted, #94a3b8)] mt-0.5">{coa.product_name_en}</p>
      </div>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        coa.qualified
          ? 'bg-success-100 text-success-700'
          : coa.test_conclusion === '不合格'
            ? 'bg-error-100 text-error-700'
            : 'bg-warning-100 text-warning-700'
      }`}>
        {coa.test_conclusion}
      </span>
    </div>

    <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-muted, #64748b)] mb-3">
      <div>
        <span className="font-medium text-[var(--text-primary, #1e293b)]">批号：</span>
        {coa.batch_no}
      </div>
      <div>
        <span className="font-medium text-[var(--text-primary, #1e293b)]">日期：</span>
        {formatDate(coa.mfg_date)}
      </div>
      {coa.gb_standard && (
        <div className="col-span-2">
          <span className="font-medium text-[var(--text-primary, #1e293b)]">标准：</span>
          {coa.gb_standard}
        </div>
      )}
    </div>

    {coa.test_items && coa.test_items.length > 0 && (
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs text-[var(--text-muted, #94a3b8)]">
          {coa.test_items.filter(i => i.judgment === '符合').length}/{coa.test_items.length} 项符合
        </span>
        {coa.test_items.some(i => i.judgment === '不符合') && (
          <span className="text-xs text-error-500 font-medium">⚠ 含不合格项</span>
        )}
      </div>
    )}
  </div>
);

// ─── COA 统计面板 ────────────────────────────────────────────

export const COAStatsPanel: React.FC<{ stats: { total: number; qualified: number; unqualified: number; pending: number; qualified_rate: number; peptide_types?: number; total_batches?: number } }>
= ({ stats }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-[var(--border-subtle, #e2e8f0)] p-4">
      <div className="text-2xl font-bold text-[var(--text-primary, #1e293b)]">{stats.total}</div>
      <div className="text-xs text-[var(--text-muted, #94a3b8)] mt-1">总批次</div>
    </div>
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-success-200 p-4">
      <div className="text-2xl font-bold text-success-600">{stats.qualified}</div>
      <div className="text-xs text-[var(--text-muted, #94a3b8)] mt-1">合格</div>
    </div>
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-error-200 p-4">
      <div className="text-2xl font-bold text-error-600">{stats.unqualified}</div>
      <div className="text-xs text-[var(--text-muted, #94a3b8)] mt-1">不合格</div>
    </div>
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-warning-200 p-4">
      <div className="text-2xl font-bold text-warning-600">{stats.pending}</div>
      <div className="text-xs text-[var(--text-muted, #94a3b8)] mt-1">待检</div>
    </div>
    <div className="col-span-2 md:col-span-4 bg-gradient-to-r from-secondary-50 to-accent-50 rounded-xl border border-secondary-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-[var(--text-muted, #64748b)]">合格率</div>
          <div className="text-3xl font-bold text-secondary-600">{stats.qualified_rate}%</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-[var(--text-muted, #64748b)]">产品种类</div>
          <div className="text-xl font-semibold text-[var(--text-primary, #1e293b)]">{stats.peptide_types ?? stats.total}</div>
        </div>
      </div>
    </div>
  </div>
);
