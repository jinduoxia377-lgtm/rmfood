import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ExportFormat, ExportOptions, ExportProgress } from '@/types/academic-report';

interface ExportState {
  // 导出格式和选项
  format: ExportFormat;
  options: ExportOptions;

  // 导出进度
  progress: ExportProgress;

  // 操作
  setFormat: (format: ExportFormat) => void;
  setOptions: (options: Partial<ExportOptions>) => void;
  exportPDF: () => void;
  exportWord: () => void;
  exportLaTeX: () => void;
  exportMarkdown: () => void;
  exportHTML: () => void;
  cancelExport: () => void;
}

export const useExportStore = create<ExportState>()(
  persist(
    (set) => ({
      format: 'pdf',
      options: {
        format: 'pdf',
        paperSize: 'a4',
        margin: { top: 25, right: 25, bottom: 25, left: 25 },
        includeReferences: true,
      },
      progress: {
        status: 'idle',
        percentage: 0,
        currentStep: 0,
        totalSteps: 5,
      },

      setFormat: (format) => {
        set({ format });
      },

      setOptions: (options) => {
        set(state => ({
          options: { ...state.options, ...options },
        }));
      },

      exportPDF: async () => {
        set({ progress: { status: 'exporting', percentage: 0, currentStep: 1, totalSteps: 5 } });

        // 模拟导出进度
        await new Promise(resolve => setTimeout(resolve, 500));
        set({ progress: { status: 'exporting', percentage: 20, currentStep: 2, totalSteps: 5 } });

        await new Promise(resolve => setTimeout(resolve, 500));
        set({ progress: { status: 'exporting', percentage: 40, currentStep: 3, totalSteps: 5 } });

        await new Promise(resolve => setTimeout(resolve, 500));
        set({ progress: { status: 'exporting', percentage: 70, currentStep: 4, totalSteps: 5 } });

        await new Promise(resolve => setTimeout(resolve, 500));
        set({ progress: { status: 'exporting', percentage: 90, currentStep: 5, totalSteps: 5 } });

        await new Promise(resolve => setTimeout(resolve, 300));
        set({ progress: { status: 'completed', percentage: 100, currentStep: 5, totalSteps: 5 } });

        // 模拟下载
        const blob = new Blob(['PDF content'], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setTimeout(() => {
          set({ progress: { status: 'idle', percentage: 0, currentStep: 0, totalSteps: 5 } });
        }, 2000);
      },

      exportWord: async () => {
        set({ progress: { status: 'exporting', percentage: 0, currentStep: 1, totalSteps: 4 } });

        await new Promise(resolve => setTimeout(resolve, 400));
        set({ progress: { status: 'exporting', percentage: 25, currentStep: 2, totalSteps: 4 } });

        await new Promise(resolve => setTimeout(resolve, 400));
        set({ progress: { status: 'exporting', percentage: 50, currentStep: 3, totalSteps: 4 } });

        await new Promise(resolve => setTimeout(resolve, 400));
        set({ progress: { status: 'exporting', percentage: 75, currentStep: 4, totalSteps: 4 } });

        await new Promise(resolve => setTimeout(resolve, 300));
        set({ progress: { status: 'completed', percentage: 100, currentStep: 4, totalSteps: 4 } });

        const blob = new Blob(['Word content'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${Date.now()}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setTimeout(() => {
          set({ progress: { status: 'idle', percentage: 0, currentStep: 0, totalSteps: 4 } });
        }, 2000);
      },

      exportLaTeX: async () => {
        set({ progress: { status: 'exporting', percentage: 0, currentStep: 1, totalSteps: 3 } });

        await new Promise(resolve => setTimeout(resolve, 300));
        set({ progress: { status: 'exporting', percentage: 33, currentStep: 2, totalSteps: 3 } });

        await new Promise(resolve => setTimeout(resolve, 300));
        set({ progress: { status: 'exporting', percentage: 66, currentStep: 3, totalSteps: 3 } });

        await new Promise(resolve => setTimeout(resolve, 200));
        set({ progress: { status: 'completed', percentage: 100, currentStep: 3, totalSteps: 3 } });

        const latexContent = `\\documentclass{article}
\\usepackage{ctex}
\\title{学术报告标题}
\\author{作者}
\\date{\\today}
\\begin{document}
\\maketitle
\\tableofcontents
\\section{引言}
这是学术报告的内容。
\\end{document}`;

        const blob = new Blob([latexContent], { type: 'text/x-latex' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${Date.now()}.tex`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setTimeout(() => {
          set({ progress: { status: 'idle', percentage: 0, currentStep: 0, totalSteps: 3 } });
        }, 2000);
      },

      exportMarkdown: async () => {
        set({ progress: { status: 'exporting', percentage: 0, currentStep: 1, totalSteps: 2 } });

        await new Promise(resolve => setTimeout(resolve, 200));
        set({ progress: { status: 'exporting', percentage: 50, currentStep: 2, totalSteps: 2 } });

        await new Promise(resolve => setTimeout(resolve, 200));
        set({ progress: { status: 'completed', percentage: 100, currentStep: 2, totalSteps: 2 } });

        const mdContent = `# 学术报告标题

**作者**：作者姓名
**日期**：${new Date().toLocaleDateString()}

## 摘要

这是摘要内容。

## 引言

这是引言内容。`;

        const blob = new Blob([mdContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setTimeout(() => {
          set({ progress: { status: 'idle', percentage: 0, currentStep: 0, totalSteps: 2 } });
        }, 2000);
      },

      exportHTML: async () => {
        set({ progress: { status: 'exporting', percentage: 0, currentStep: 1, totalSteps: 3 } });

        await new Promise(resolve => setTimeout(resolve, 300));
        set({ progress: { status: 'exporting', percentage: 33, currentStep: 2, totalSteps: 3 } });

        await new Promise(resolve => setTimeout(resolve, 300));
        set({ progress: { status: 'exporting', percentage: 66, currentStep: 3, totalSteps: 3 } });

        await new Promise(resolve => setTimeout(resolve, 200));
        set({ progress: { status: 'completed', percentage: 100, currentStep: 3, totalSteps: 3 } });

        const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>学术报告</title>
</head>
<body>
  <h1>学术报告标题</h1>
  <p>报告内容...</p>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${Date.now()}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setTimeout(() => {
          set({ progress: { status: 'idle', percentage: 0, currentStep: 0, totalSteps: 3 } });
        }, 2000);
      },

      cancelExport: () => {
        set({ progress: { status: 'idle', percentage: 0, currentStep: 0, totalSteps: 5 } });
      },
    }),
    {
      name: 'export-storage',
    },
  ),
);
