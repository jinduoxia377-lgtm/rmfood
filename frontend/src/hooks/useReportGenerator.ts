import { useState, useCallback, useRef } from 'react';
import {
  GenerationStage,
  OutputFormat,
  DetailLevel,
} from '../types/report.types';
import type {
  ReportGenerationOptions,
  GeneratedReport,
  GenerationProgress,
  ReportData,
} from '../types/report.types';

export interface UseReportGeneratorReturn {
  generate: (options: ReportGenerationOptions) => Promise<GeneratedReport>;
  cancelGeneration: () => void;
  currentReport: GeneratedReport | null;
  isGenerating: boolean;
  progress: GenerationProgress | null;
  getTemplatePreview: (templateId: string) => string;
}

export function useReportGenerator(): UseReportGeneratorReturn {
  const [currentReport, setCurrentReport] = useState<GeneratedReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const abortRef = useRef(false);

  const updateProgress = useCallback((
    stage: GenerationStage,
    current: number,
    total: number,
    message: string,
  ) => {
    const progressData: GenerationProgress = {
      stage,
      progress: current,
      total,
      message,
    };
    setProgress(progressData);
  }, []);

  const generate = useCallback(async (
    options: ReportGenerationOptions,
  ): Promise<GeneratedReport> => {
    abortRef.current = false;
    setIsGenerating(true);

    const reportId = `report-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    try {
      updateProgress(GenerationStage.INITIALIZING, 0, 8, '正在初始化报告生成...');
      await simulateDelay(200);

      if (abortRef.current) throw new Error('生成已取消');

      updateProgress(GenerationStage.LOADING_TEMPLATE, 1, 8, '加载报告模板...');
      await simulateDelay(300);

      if (abortRef.current) throw new Error('生成已取消');

      updateProgress(GenerationStage.PROCESSING_DATA, 2, 8, '处理输入数据...');
      const processedData = processReportData(options.data);
      await simulateDelay(400);

      if (abortRef.current) throw new Error('生成已取消');

      updateProgress(GenerationStage.GENERATING_SECTIONS, 3, 8, '生成报告章节...');
      const sectionsContent = generateSections(options.templateId, processedData, options.detailLevel);
      await simulateDelay(500);

      if (abortRef.current) throw new Error('生成已取消');

      updateProgress(GenerationStage.RENDERING_CHARTS, 4, 8, '渲染图表和可视化内容...');
      await simulateDelay(400);

      if (abortRef.current) throw new Error('生成已取消');

      updateProgress(GenerationStage.FORMATTING_TABLES, 5, 8, '格式化表格数据...');
      await simulateDelay(300);

      if (abortRef.current) throw new Error('生成已取消');

      updateProgress(GenerationStage.COMPILING_DOCUMENT, 6, 8, '编译文档结构...');
      const documentContent = compileDocument(sectionsContent, options);
      await simulateDelay(400);

      if (abortRef.current) throw new Error('生成已取消');

      updateProgress(GenerationStage.EXPORTING, 7, 8, `导出为${options.outputFormat}格式...`);
      const outputBlob = await exportDocument(documentContent, options.outputFormat, options.fileName);
      await simulateDelay(300);

      if (abortRef.current) throw new Error('生成已取消');

      updateProgress(GenerationStage.COMPLETED, 8, 8, '报告生成完成！');

      const generatedReport: GeneratedReport = {
        id: reportId,
        templateId: options.templateId,
        options,
        status: 'completed',
        progress: {
          stage: GenerationStage.COMPLETED,
          progress: 8,
          total: 8,
          message: '完成',
        },
        outputFile: outputBlob,
        generatedAt: new Date().toISOString(),
        pageCount: estimatePageCount(documentContent),
        fileSize: outputBlob.size,
      };

      setCurrentReport(generatedReport);
      setIsGenerating(false);

      return generatedReport;

    } catch (error) {
      setIsGenerating(false);

      return {
        id: reportId,
        templateId: options.templateId,
        options,
        status: 'failed',
        progress: {
          stage: GenerationStage.ERROR,
          progress: progress?.progress || 0,
          total: progress?.total || 0,
          message: error instanceof Error ? error.message : '未知错误',
        },
        error: error instanceof Error ? error.message : '报告生成失败',
        generatedAt: new Date().toISOString(),
      };
    }
  }, [updateProgress]);

  const cancelGeneration = useCallback(() => {
    abortRef.current = true;
  }, []);

  const getTemplatePreview = useCallback((templateId: string): string => {
    const templatePreviews: Record<string, string> = {
      'academic-research-v1': `
        <div style="font-family: serif; padding: 20px;">
          <h1 style="text-align: center; font-size: 24px; margin-bottom: 20px;">学术论文预览</h1>
          <h2 style="font-size: 18px; color: #003E87;">摘要</h2>
          <p style="line-height: 1.6;">[摘要内容将显示在此处...]</p>
          <h2 style="font-size: 18px; color: #003E87; margin-top: 16px;">引言</h2>
          <p style="line-height: 1.6;">[研究背景和目的说明...]</p>
          <h2 style="font-size: 18px; color: #003E87; margin-top: 16px;">方法</h2>
          <p style="line-height: 1.6;">[实验设计和分析方法描述...]</p>
        </div>
      `,
      'business-proposal-v1': `
        <div style="font-family: sans-serif; padding: 20px;">
          <h1 style="text-align: center; font-size: 24px; color: var(--color-primary-500); margin-bottom: 20px;">商业提案预览</h1>
          <h2 style="font-size: 18px; color: var(--color-primary-500);">执行摘要</h2>
          <p style="line-height: 1.6;">[项目概述和价值主张...]</p>
          <h2 style="font-size: 18px; color: var(--color-primary-500); margin-top: 16px;">市场分析</h2>
          <p style="line-height: 1.6;">[市场规模和竞争格局...]</p>
          <h2 style="font-size: 18px; color: var(--color-primary-500); margin-top: 16px;">财务预测</h2>
          <p style="line-height: 1.6;">[收入和成本预测模型...]</p>
        </div>
      `,
      'experiment-record-v1': `
        <div style="font-family: monospace; padding: 20px;">
          <h1 style="text-align: center; font-size: 24px; color: var(--color-accent-500); margin-bottom: 20px;">实验记录预览</h1>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="border: 1px solid #ddd; padding: 8px;"><strong>实验编号:</strong></td><td style="border: 1px solid #ddd; padding: 8px;">EXP-2024-001</td></tr>
            <tr><td style="border: 1px solid #ddd; padding: 8px;"><strong>实验日期:</strong></td><td style="border: 1px solid #ddd; padding: 8px;">${new Date().toLocaleDateString()}</td></tr>
            <tr><td style="border: 1px solid #ddd; padding: 8px;"><strong>实验人员:</strong></td><td style="border: 1px solid #ddd; padding: 8px;">[待填写]</td></tr>
          </table>
          <h2 style="font-size: 18px; color: var(--color-accent-500); margin-top: 16px;">实验步骤</h2>
          <ol style="line-height: 1.8;">
            <li>准备实验材料和设备...</li>
            <li>按照标准操作程序执行...</li>
            <li>记录观察数据和现象...</li>
          </ol>
        </div>
      `,
      'patent-application-v1': `
        <div style="font-family: serif; padding: 20px;">
          <h1 style="text-align: center; font-size: 24px; color: #B91C1C; margin-bottom: 20px;">专利申请文档预览</h1>
          <h2 style="font-size: 18px; color: #B91C1C;">技术领域</h2>
          <p style="line-height: 1.6;">[本发明涉及的技术领域说明...]</p>
          <h2 style="font-size: 18px; color: #B91C1C; margin-top: 16px;">背景技术</h2>
          <p style="line-height: 1.6;">[现有技术的不足和待解决问题...]</p>
          <h2 style="font-size: 18px; color: #B91C1C; margin-top: 16px;">发明内容</h2>
          <p style="line-height: 1.6;">[本发明的技术方案和有益效果...]</p>
        </div>
      `,
      'regulatory-filing-v1': `
        <div style="font-family: sans-serif; padding: 20px;">
          <h1 style="text-align: center; font-size: 24px; color: #0E7490; margin-bottom: 20px;">监管申报文档预览</h1>
          <h2 style="font-size: 18px; color: #0E7490;">法规合规性声明</h2>
          <p style="line-height: 1.6;">[符合相关监管要求的声明...]</p>
          <h2 style="font-size: 18px; color: #0E7490; margin-top: 16px;">产品描述</h2>
          <p style="line-height: 1.6;">[产品的详细规格和特性...]</p>
          <h2 style="font-size: 18px; color: #0E7490; margin-top: 16px;">质量控制数据</h2>
          <p style="line-height: 1.6;">[质量检验结果和合规性证明...]</p>
        </div>
      `,
    };

    return templatePreviews[templateId] || '<p>暂无预览</p>';
  }, []);

  return {
    generate,
    cancelGeneration,
    currentReport,
    isGenerating,
    progress,
    getTemplatePreview,
  };
}

function simulateDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function processReportData(data: ReportData): ReportData {
  return {
    ...data,
    authors: data.authors.map(author => ({
      name: author.name || '未指定',
      email: author.email,
      affiliation: author.affiliation || 'RMFOOD配方平台',
    })),
    date: (data.date || new Date().toISOString().split('T')[0]) ?? '',
    keywords: data.keywords || [],
    tables: data.tables || [],
    charts: data.charts || [],
    images: data.images || [],
  };
}

function generateSections(
  templateId: string,
  data: ReportData,
  detailLevel: DetailLevel,
): Record<string, any> {
  return {
    title: data.title,
    metadata: {
      authors: data.authors,
      date: data.date,
      language: 'zh-CN',
    },
    sections: generateSectionContent(templateId, data, detailLevel),
  };
}

function generateSectionContent(
  _templateId: string,
  data: ReportData,
  _detailLevel: DetailLevel,
): {id: string, title: string, content: string}[] {
  const baseSections = [
    { id: 'title', title: '标题', content: data.title },
    { id: 'abstract', title: '摘要', content: data.abstract || '' },
    { id: 'content', title: '正文', content: JSON.stringify(data.content, null, 2) },
  ];

  if (data.tables && data.tables.length > 0) {
    baseSections.push({
      id: 'tables',
      title: '表格数据',
      content: `共 ${data.tables.length} 个表格`,
    });
  }

  if (data.charts && data.charts.length > 0) {
    baseSections.push({
      id: 'charts',
      title: '图表',
      content: `共 ${data.charts.length} 个图表`,
    });
  }

  return baseSections;
}

function compileDocument(
  sectionsContent: Record<string, any>,
  options: ReportGenerationOptions,
): string {
  const formatLabels: Record<OutputFormat, string> = {
    [OutputFormat.PDF]: 'PDF',
    [OutputFormat.DOCX]: 'Word',
    [OutputFormat.HTML]: 'HTML',
    [OutputFormat.MARKDOWN]: 'Markdown',
  };

  return JSON.stringify({
    format: formatLabels[options.outputFormat],
    templateId: options.templateId,
    language: options.language,
    detailLevel: options.detailLevel,
    generatedAt: new Date().toISOString(),
    content: sectionsContent,
  }, null, 2);
}

async function exportDocument(
  content: string,
  format: OutputFormat,
  fileName?: string,
): Promise<Blob> {
  let mimeType: string;
  let extension: string;

  switch (format) {
    case OutputFormat.PDF:
      mimeType = 'application/pdf';
      extension = '.pdf';
      break;
    case OutputFormat.DOCX:
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      extension = '.docx';
      break;
    case OutputFormat.HTML:
      mimeType = 'text/html';
      extension = '.html';
      break;
    case OutputFormat.MARKDOWN:
      mimeType = 'text/markdown';
      extension = '.md';
      break;
    default:
      mimeType = 'application/octet-stream';
      extension = '.txt';
  }

  const finalFileName = fileName || `report_${new Date().toISOString().slice(0, 10)}${extension}`;

  if (format === OutputFormat.HTML) {
    const htmlContent = generateHTMLDocument(content);
    return new Blob([htmlContent], { type: mimeType });
  } else if (format === OutputFormat.MARKDOWN) {
    const mdContent = generateMarkdownDocument(content);
    return new Blob([mdContent], { type: mimeType });
  } else {
    const textContent = `${finalFileName}\n${'='.repeat(finalFileName.length)}\n\n${content}`;
    return new Blob([textContent], { type: 'application/octet-stream' });
  }
}

function generateHTMLDocument(content: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>生成的报告</title>
  <style>
    body { font-family: "SimSun", "Times New Roman", serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #003E87; text-align: center; border-bottom: 3px solid #003E87; padding-bottom: 10px; }
    h2 { color: var(--color-secondary-500); margin-top: 24px; border-left: 4px solid var(--color-secondary-500); padding-left: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
    th { background-color: #f3f4f6; font-weight: bold; }
    .metadata { background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0; }
  </style>
</head>
<body>
  <pre style="white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(content)}</pre>
</body>
</html>`;
}

function generateMarkdownDocument(content: string): string {
  return `# 生成的报告\n\n---\n\n${content}\n\n---\n\n*由 RMFOOD配方平台自动生成*`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function estimatePageCount(content: string): number {
  const wordsPerPage = 500;
  const wordCount = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerPage));
}
