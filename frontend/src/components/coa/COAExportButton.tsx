/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * COA 导出按钮组件 — 支持 Word/PDF 下载
 */
import { useState } from 'react';
import { coaService } from '@/services/professional/coaService';
import { Download, FileText, File } from 'lucide-react';
import { Button } from '@/components/ui';
import type { PeptideBatchCOA } from '@/services/professional/coaService';

interface COAExportButtonProps {
  coa: PeptideBatchCOA;
  className?: string;
}

export function COAExportButton({ coa, className = '' }: COAExportButtonProps) {
  const [loading, setLoading] = useState<'word' | 'pdf' | null>(null);

  const download = async (format: 'word' | 'pdf') => {
    setLoading(format);
    try {
      const blob = format === 'word'
        ? await coaService.generateWord(coa.id)
        : await coaService.generatePdf(coa.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `COA_${coa.batch_no}.${format === 'word' ? 'docx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => download('word')}
        disabled={loading !== null}
        className="gap-1 text-xs"
      >
        {loading === 'word'
          ? <span className="animate-spin">⟳</span>
          : <Download className="w-3.5 h-3.5" />}
        Word
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => download('pdf')}
        disabled={loading !== null}
        className="gap-1 text-xs"
      >
        {loading === 'pdf'
          ? <span className="animate-spin">⟳</span>
          : <Download className="w-3.5 h-3.5" />}
        PDF
      </Button>
      {coa.coa_word_url && (
        <a
          href={coa.coa_word_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1"
        >
          <FileText className="w-3.5 h-3.5" /> 原文Word
        </a>
      )}
      {coa.coa_pdf_url && (
        <a
          href={coa.coa_pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1"
        >
          <File className="w-3.5 h-3.5" /> 原PDF
        </a>
      )}
    </div>
  );
}
