/**
 * 实验数据上传面板
 *
 * 支持拖拽上传 AnIML/JCAMP-DX/CSV 文件，
 * 实时显示解析结果和峰识别信息。
 */
'use client';

import React, { useState, useRef } from 'react';
import { experimentDataApi, type ParseResult } from '@/api/experimentData';
import { ParseResultDisplay } from '@/api/experimentData';
import { logger } from '@/utils/safeLogger';

interface Props {
  onParseComplete?: (result: ParseResult) => void;
}

export function DataUploadPanel({ onParseComplete }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (f: File) => {
    setFile(f);
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const resp = await experimentDataApi.parse(f, { formatType: 'auto', recognizePeaks: true });
      if (resp.success && resp.data) {
        setResult(resp);
        onParseComplete?.({ success: true, data: resp.data! });
      } else {
        setError('解析结果为空');
      }
    } catch (err) {
      logger.error('上传解析失败:', err);
      setError(err instanceof Error ? err.message : '上传解析失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileChange(f);
  };

  const supportedFormats = ['AnIML (.animl)', 'JCAMP-DX (.dx)', 'CSV/TSV (.csv, .tsv)'];

  return (
    <div className="space-y-4">
      {/* 上传区域 */}
      <div
        className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragOver
            ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
            : 'border-gray-200 dark:border-gray-700 hover:border-violet-400'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".animl,.dx,.csv,.tsv,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileChange(f);
          }}
        />

        {file ? (
          <div className="space-y-2">
            <div className="text-3xl">📄</div>
            <div className="font-medium text-gray-900 dark:text-gray-100">{file.name}</div>
            <div className="text-sm text-gray-500">
              {(file.size / 1024).toFixed(1)} KB
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-violet-600 hover:text-violet-700 underline"
            >
              更换文件
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-4xl">🧪</div>
            <div>
              <span
                className="text-violet-600 font-medium cursor-pointer hover:underline"
                 role="button" tabIndex={0} onClick={() => fileInputRef.current?.click()}
              >
                点击上传
              </span>
              {' 或拖拽文件到此处'}
            </div>
            <div className="text-xs text-gray-400 space-y-1">
              {supportedFormats.map((f) => (
                <div key={f}>{f}</div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
            <span className="inline-block w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            解析中...
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* 解析结果 */}
      {result && (
        <ParseResultDisplay result={result!} loading={loading} error={error ?? undefined} />
      )}
    </div>
  );
}
