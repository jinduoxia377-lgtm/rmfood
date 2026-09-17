/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * COA 管理页面 Tab
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { coaService } from '@/services/professional/coaService';
import { COATable } from '@/components/coa/COATable';
import { COAView, COAStatsPanel } from '@/components/coa/COAView';
import type { PeptideBatchCOA } from '@/services/professional/coaService';
import { Badge } from '@/components/ui';
import { FileText, ChevronRight } from 'lucide-react';

interface COAsTabProps {
  peptideId?: number;
  peptideName?: string;
}

// ─── COA 统计视图 ─────────────────────────────────────────
function CoaStatsView() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['coa-stats'],
    queryFn: async () => {
      const resp = await coaService.getStats();
      // ApiResponse 结构：{ data: { ...stats } }
      return (resp as { data?: unknown } | null)?.data ?? resp;
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-3 mb-6 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border p-4 h-20" />
        ))}
        <div className="col-span-4 bg-white rounded-xl border p-4 h-16" />
      </div>
    );
  }

  if (error) return null; // 静默失败，不影响列表展示
  if (!data) return null;

  return <COAStatsPanel stats={data} />;
}

export function COAsTab({ peptideId, peptideName }: COAsTabProps) {
  const [selectedCOA, setSelectedCOA] = useState<PeptideBatchCOA | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-[var(--color-primary)]" />
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          出厂检验报告 (COA)
        </h2>
        {peptideName && (
          <Badge className="text-xs">
            {peptideName}
            <ChevronRight className="w-3 h-3 ml-1" />
          </Badge>
        )}
      </div>

      {/* 统计面板 */}
      {viewMode === 'list' && <CoaStatsView />}

      {viewMode === 'list' ? (
        <COATable
          peptideId={peptideId}
          showStats={false}  // 统计已在上层展示
          showBatchExport
          onCOAClick={(coa) => {
            setSelectedCOA(coa);
            setViewMode('detail');
          }}
        />
      ) : selectedCOA ? (
        <div className="space-y-4">
          <button
            onClick={() => setViewMode('list')}
            className="text-sm text-[var(--color-primary)] hover:underline flex items-center gap-1"
          >
            ← 返回列表
          </button>
          <COAView
            coa={selectedCOA}
            showExport
            onDownloadPdf={() => {
              if (selectedCOA.coa_pdf_url) {
                window.open(selectedCOA.coa_pdf_url, '_blank');
              }
            }}
            onPrint={() => window.print()}
          />
        </div>
      ) : (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <p>请选择一个COA查看详情</p>
        </div>
      )}
    </div>
  );
}
