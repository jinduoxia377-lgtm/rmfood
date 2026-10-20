// experimentData API - stub (original file was untracked)
import React from 'react'

export interface ParseResult {
  success: boolean
  data?: {
    metadata: { rowCount: number; columnCount: number; headers: string[] }
    rows: Record<string, unknown>[]
    peaks?: Array<{ retentionTime: number; intensity: number }>
  }
}

export interface ParseOptions {
  formatType: 'auto' | 'csv' | 'tsv' | 'xlsx'
  recognizePeaks: boolean
}

export interface ParseResultDisplayProps {
  result: ParseResult
  loading: boolean
  error: string | undefined
}

export const experimentDataApi = {
  parse: async (_file: File, _options?: ParseOptions): Promise<ParseResult> => {
    void _file;
    void _options;
    return {
      success: false,
      data: undefined,
    };
  },
}

export function ParseResultDisplay(_props: ParseResultDisplayProps): React.ReactElement {
  void _props;
  return React.createElement('div', null, 'Parse Result')
}
