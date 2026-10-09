import { logger } from '@/utils/safeLogger'
import React, { Component } from 'react';
import type { ReactNode } from 'react';

interface ExportManagerProps {
  data: any;
  filename: string;
  onExport?: (format: string) => void;
  formats?: ('json' | 'csv' | 'txt' | 'pdf' | 'excel')[];
}

interface ExportManagerState {
  selectedFormat: 'json' | 'csv' | 'txt' | 'pdf' | 'excel';
  customFilename: string;
  showAdvanced: boolean;
  exportOptions: {
    includeMetadata: boolean;
    includeTimestamp: boolean;
    prettyPrint: boolean;
  };
}

class ExportManager extends Component<ExportManagerProps, ExportManagerState> {
  constructor(props: ExportManagerProps) {
    super(props);
    this.state = {
      selectedFormat: 'json',
      customFilename: props.filename || 'export',
      showAdvanced: false,
      exportOptions: {
        includeMetadata: true,
        includeTimestamp: true,
        prettyPrint: true,
      },
    };
  }

  private handleFormatChange = (format: 'json' | 'csv' | 'txt' | 'pdf' | 'excel'): void => {
    this.setState({ selectedFormat: format });
  };

  private handleExport = (): void => {
    const { data } = this.props;
    const { selectedFormat, customFilename, exportOptions } = this.state;

    const exportData = {
      ...data,
      ...(exportOptions.includeMetadata && {
        metadata: {
          exportedAt: exportOptions.includeTimestamp ? new Date().toISOString() : null,
          version: '1.0',
          source: 'RMFOOD Professional Analysis',
        },
      }),
    };

    switch (selectedFormat) {
      case 'json':
        this.exportAsJSON(exportData, customFilename);
        break;
      case 'csv':
        this.exportAsCSV(exportData, customFilename);
        break;
      case 'txt':
        this.exportAsTXT(exportData, customFilename);
        break;
      case 'pdf':
        this.exportAsPDF(exportData, customFilename);
        break;
      case 'excel':
        this.exportAsExcel(exportData, customFilename);
        break;
    }

    if (this.props.onExport) {
      this.props.onExport(selectedFormat);
    }
  };

  private exportAsJSON(data: any, filename: string): void {
    const jsonStr = this.state.exportOptions.prettyPrint
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    this.downloadFile(blob, `${filename}.json`);
  }

  private exportAsCSV(data: any, filename: string): void {
    const csvRows: string[][] = [];

    if (Array.isArray(data)) {
      if (data.length > 0) {
        csvRows.push(Object.keys(data[0]));
        data.forEach((row: any) => {
          csvRows.push(Object.values(row).map((val: any) =>
            typeof val === 'object' ? JSON.stringify(val) : String(val),
          ));
        });
      }
    } else {
      csvRows.push(['Key', 'Value']);
      Object.entries(data).forEach(([key, value]) => {
        csvRows.push([key, typeof value === 'object' ? JSON.stringify(value) : String(value)]);
      });
    }

    const csvContent = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    this.downloadFile(blob, `${filename}.csv`);
  }

  private exportAsTXT(data: any, filename: string): void {
    let content = 'RMFOOD Professional Analysis Export\n';
    content += '='.repeat(60) + '\n\n';
    content += this.formatDataAsText(data);

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    this.downloadFile(blob, `${filename}.txt`);
  }

  private formatDataAsText(data: any, indent = 0): string {
    const spaces = '  '.repeat(indent);
    let content = '';

    if (Array.isArray(data)) {
      data.forEach((item, idx) => {
        content += `${spaces}[${idx}]: ${this.formatDataAsText(item, indent + 1)}\n`;
      });
    } else if (typeof data === 'object' && data !== null) {
      Object.entries(data).forEach(([key, value]) => {
        if (typeof value === 'object') {
          content += `${spaces}${key}:\n${this.formatDataAsText(value, indent + 1)}`;
        } else {
          content += `${spaces}${key}: ${value}\n`;
        }
      });
    } else {
      content += `${spaces}${data}\n`;
    }

    return content;
  }

  private exportAsPDF(data: any, filename: string): void {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const html = `
      <!DOCTYPE html><html><head><title>${filename}</title>
      <style>body{font-family:'Microsoft YaHei',sans-serif;padding:40px}
      table{width:100%;border-collapse:collapse;margin-top:20px}
      th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}
      th{background:#f5f5f5}</style></head>
      <body><h1>${filename}</h1><p>导出时间: ${new Date().toLocaleString('zh-CN')}</p>
      <pre>${JSON.stringify(data, null, 2)}</pre></body></html>
    `
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print(); printWindow.close() }, 500)
  }

  private exportAsExcel(data: any, filename: string): void {
    const flatten = (obj: any, prefix = ''): string[] => {
      const rows: string[] = []
      const keys = Object.keys(obj)
      rows.push(keys.join(','))
      if (Array.isArray(obj)) {
        obj.forEach(item => rows.push(Object.values(item).join(',')))
      } else {
        Object.values(obj).forEach(v => {
          if (typeof v === 'object' && v !== null) {
            rows.push(...flatten(v, prefix))
          } else {
            rows.push(String(v))
          }
        })
      }
      return rows
    }

    const csvContent = '﻿' + flatten(data).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    this.downloadFile(blob, `${filename}.csv`)
  }

  private downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private renderFormatSelector(): ReactNode {
    const { selectedFormat } = this.state;
    const formats = this.props.formats || ['json', 'csv', 'txt', 'pdf'];

    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          选择导出格式
        </label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {formats.map((format) => (
            <button
              key={format}
              onClick={() => this.handleFormatChange(format)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedFormat === format
                  ? 'bg-secondary-container text-secondary-main'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {format.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    );
  }

  private renderAdvancedOptions(): ReactNode {
    const { showAdvanced, exportOptions } = this.state;

    return (
      <div className="mt-4">
        <button
          onClick={() => this.setState({ showAdvanced: !showAdvanced })}
          className="flex items-center gap-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 mb-2"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          高级选项
        </button>

        {showAdvanced && (
          <div className="bg-slate-50 dark:bg-neutral-800 rounded-lg p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={exportOptions.includeMetadata}
                onChange={(e) => this.setState({
                  exportOptions: { ...exportOptions, includeMetadata: e.target.checked },
                })}
                className="w-4 h-4 text-secondary-600 rounded"
              />
              <span className="text-sm text-neutral-700">包含元数据</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={exportOptions.includeTimestamp}
                onChange={(e) => this.setState({
                  exportOptions: { ...exportOptions, includeTimestamp: e.target.checked },
                })}
                className="w-4 h-4 text-secondary-600 rounded"
              />
              <span className="text-sm text-neutral-700">包含时间戳</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={exportOptions.prettyPrint}
                onChange={(e) => this.setState({
                  exportOptions: { ...exportOptions, prettyPrint: e.target.checked },
                })}
                className="w-4 h-4 text-secondary-600 rounded"
              />
              <span className="text-sm text-neutral-700">格式化输出</span>
            </label>
          </div>
        )}
      </div>
    );
  }

  public render(): ReactNode {
    const { customFilename } = this.state;

    return (
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-neutral-900">导出数据</h3>

        {this.renderFormatSelector()}

        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            文件名
          </label>
          <input
            type="text"
            value={customFilename}
            onChange={(e) => this.setState({ customFilename: e.target.value })}
            className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="输入文件名"
          />
        </div>

        {this.renderAdvancedOptions()}

        <button
          onClick={this.handleExport}
          className="w-full mt-4 px-6 py-3 bg-secondary-container text-secondary-main rounded-lg hover:bg-secondary-container transition-colors font-medium"
        >
          导出
        </button>
      </div>
    );
  }
}

export default ExportManager;
