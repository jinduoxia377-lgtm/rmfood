/**
 * pdfPrintExporter.ts — 中文 PDF 导出工具（浏览器打印方案）
 *
 * 背景：jsPDF 内置字体不含 CJK 字形，直接 setFont('SimSun') 会抛
 * "Unknown font" 异常；打包中文字体体积大且需要字体文件。
 * 本工具统一采用「生成 HTML → 新窗口打开 → window.print()」的方式，
 * 由浏览器原生渲染中文（无乱码），用户在打印对话框中选择「另存为 PDF」。
 */

export interface PdfPrintOptions {
  /** 打印窗口标题（可选） */
  title?: string;
  /** 导出成功回调 */
  onSuccess?: () => void;
  /** 导出失败回调（message 为可读错误信息） */
  onError?: (message: string) => void;
}

/**
 * 将 HTML 内容通过浏览器打印为 PDF。
 * 若浏览器阻止弹出窗口，会回调 onError 提示用户。
 */
export function exportHtmlAsPdf(html: string, options: PdfPrintOptions = {}): void {
  try {
    const printWindow = window.open('', '_blank', 'width=860,height=1100');
    if (!printWindow) {
      options.onError?.('浏览器阻止了打印窗口，请允许弹出窗口后重试');
      return;
    }

    if (options.title) {
      printWindow.document.title = options.title;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    // 等待渲染完成后调用打印
    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        options.onError?.('调用系统打印失败，请手动使用浏览器打印功能');
      }
    }, 300);

    options.onSuccess?.();
  } catch (error) {
    options.onError?.(error instanceof Error ? error.message : 'PDF 导出失败');
  }
}

/**
 * 将 HTML 内容转换为适合打印的完整 HTML 文档（含打印样式）。
 */
export function wrapPrintHtml(contentHtml: string, title = '学术报告'): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: SimSun, "Songti SC", "Noto Serif SC", serif; font-size: 12pt; line-height: 1.8; color: #1f2937; background: #f3f4f6; padding: 20px; }
    .report-container { max-width: 210mm; margin: 0 auto; background: #fff; padding: 25mm 25mm 25mm 30mm; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    h1 { font-size: 22pt; text-align: center; margin-bottom: 0.8em; }
    h2 { font-size: 16pt; margin: 1.2em 0 0.6em; color: #003E87; border-bottom: 2px solid #003E87; padding-bottom: 0.3em; }
    h3 { font-size: 14pt; margin: 1em 0 0.5em; }
    p { margin-bottom: 0.8em; text-align: justify; }
    table { width: 100%; border-collapse: collapse; margin: 1em 0; }
    th, td { border: 1px solid #ccc; padding: 6px 10px; font-size: 10pt; }
    th { background: #f0f4f8; }
    @media print {
      body { background: #fff; padding: 0; }
      .report-container { max-width: none; box-shadow: none; }
      @page { size: A4; margin: 20mm; }
    }
  </style>
</head>
<body>
  <div class="report-container">${contentHtml}</div>
</body>
</html>`;
}