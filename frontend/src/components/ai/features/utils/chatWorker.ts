type WorkerMessageType =
  | 'export:start'
  | 'export:progress'
  | 'export:complete'
  | 'export:error'
  | 'process:text'
  | 'process:complete'

interface WorkerMessage<T = any> {
  type: WorkerMessageType
  payload: T
  id?: string
}

interface ExportTask {
  data: any[]
  format: 'json' | 'csv' | 'txt' | 'html' | 'markdown'
  options?: {
    includeHeaders?: boolean
    delimiter?: string
    prettyPrint?: boolean
  }
}

interface ProcessTextTask {
  content: string
  operation: 'markdown-to-html' | 'sanitize' | 'truncate' | 'extract-keywords'
  options?: Record<string, any>
}

class ChatWorkerManager {
  private worker: Worker | null = null
  private taskQueue = new Map<string, { resolve: Function; reject: Function }>()
  private isInitialized = false

  async init(): Promise<void> {
    if (this.isInitialized) return

    try {
      const workerCode = this.getWorkerCode()
      const blob = new Blob([workerCode], { type: 'application/javascript' })
      const workerUrl = URL.createObjectURL(blob)

      this.worker = new Worker(workerUrl)
      this.worker.onmessage = this.handleMessage.bind(this)
      this.worker.onerror = this.handleError.bind(this)

      this.isInitialized = true
    } catch (error) {
      throw error
    }
  }

  async exportData(task: ExportTask): Promise<string> {
    await this.init()

    return new Promise((resolve, reject) => {
      const taskId = crypto.randomUUID()
      this.taskQueue.set(taskId, { resolve, reject })

      this.worker!.postMessage({
        type: 'export:start',
        payload: task,
        id: taskId,
      })
    })
  }

  async processText(task: ProcessTextTask): Promise<string> {
    await this.init()

    return new Promise((resolve, reject) => {
      const taskId = crypto.randomUUID()
      this.taskQueue.set(taskId, { resolve, reject })

      this.worker!.postMessage({
        type: 'process:text',
        payload: task,
        id: taskId,
      })
    })
  }

  cancelTask(taskId?: string): void {
    if (!this.worker) return
    if (taskId) {
      this.taskQueue.delete(taskId)
    } else {
      this.taskQueue.clear()
    }
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
      this.isInitialized = false
      this.taskQueue.clear()
    }
  }

  private handleMessage(event: MessageEvent<WorkerMessage>): void {
    const { type, payload, id } = event.data

    switch (type) {
      case 'export:complete':
      case 'process:complete': {
        const resolver = this.taskQueue.get(id!)
        if (resolver) {
          resolver.resolve(payload as string)
          this.taskQueue.delete(id!)
        }
        break
      }
      case 'export:error':
      case 'error': {
        const rejecter = this.taskQueue.get(id!)
        if (rejecter) {
          rejecter.reject(new Error(payload as string))
          this.taskQueue.delete(id!)
        }
        break
      }
    }
  }

  private handleError(error: ErrorEvent): void {
    this.taskQueue.forEach(({ reject }) => {
      reject(new Error('Worker error: ' + error.message))
    })
    this.taskQueue.clear()
  }

  private getWorkerCode(): string {
    return `
      self.onmessage = function(event) {
        var data = event.data;
        var type = data.type;
        var payload = data.payload;
        var id = data.id;
        
        switch (type) {
          case 'export:start':
            handleExport(payload, id);
            break;
          case 'process:text':
            handleProcessText(payload, id);
            break;
        }
      };

      function handleExport(task, taskId) {
        try {
          var data = task.data;
          var format = task.format;
          var options = task.options || {};
          var result = '';
          
          switch (format) {
            case 'json':
              result = JSON.stringify(data, null, options.prettyPrint ? 2 : void 0);
              break;
            case 'csv':
              result = convertToCSV(data, options.delimiter || ',');
              break;
            case 'txt':
              result = convertToTXT(data);
              break;
            case 'html':
              result = convertToHTML(data, options.includeHeaders !== false);
              break;
            case 'markdown':
              result = convertToMarkdown(data);
              break;
          }
          
          for (var i = 0; i <= 10; i++) {
            setTimeout(function(idx, res) {
              return function() {
                self.postMessage({
                  type: 'export:progress',
                  payload: { percentage: idx * 10 },
                  id: taskId
                });
                
                if (idx === 10) {
                  self.postMessage({
                    type: 'export:complete',
                    payload: res,
                    id: taskId
                  });
                }
              };
            }(i, result), i * 50);
          }
        } catch (error) {
          self.postMessage({
            type: 'export:error',
            payload: error.message,
            id: taskId
          });
        }
      }

      function handleProcessText(task, taskId) {
        try {
          var content = task.content;
          var operation = task.operation;
          var options = task.options || {};
          var result = '';
          
          switch (operation) {
            case 'markdown-to-html':
              result = simpleMarkdownToHTML(content);
              break;
            case 'sanitize':
              result = sanitizeHTML(content);
              break;
            case 'truncate':
              var maxLength = options.maxLength || 200;
              result = content.length > maxLength ? content.slice(0, maxLength) + '...' : content;
              break;
            case 'extract-keywords':
              result = extractKeywords(content, options.count || 5);
              break;
          }
          
          self.postMessage({
            type: 'process:complete',
            payload: result,
            id: taskId
          });
        } catch (error) {
          self.postMessage({
            type: 'error',
            payload: error.message,
            id: taskId
          });
        }
      }

      function convertToCSV(data, delimiter) {
        if (!data.length) return '';
        var headers = Object.keys(data[0]);
        var csvRows = [headers.join(delimiter)];
        
        for (var i = 0; i < data.length; i++) {
          var row = data[i];
          var values = [];
          for (var j = 0; j < headers.length; j++) {
            var header = headers[j];
            var value = row[header];
            var stringValue = String(value !== void 0 && value !== null ? value : '');
            if (stringValue.indexOf(delimiter) !== -1 || stringValue.indexOf('\"') !== -1) {
              values.push('\"' + stringValue.replace(/\"/g, '\"\"') + '\"');
            } else {
              values.push(stringValue);
            }
          }
          csvRows.push(values.join(delimiter));
        }
        
        return csvRows.join('\\n');
      }

      function convertToTXT(data) {
        var lines = [];
        for (var i = 0; i < data.length; i++) {
          lines.push(JSON.stringify(data[i]));
        }
        return lines.join('\\n');
      }

      function convertToHTML(data, includeHeaders) {
        var html = '<table>\\n';
        
        if (includeHeaders && data.length > 0) {
          html += '  <tr>\\n';
          var headers = Object.keys(data[0]);
          for (var i = 0; i < headers.length; i++) {
            html += '    <th>' + headers[i] + '</th>\\n';
          }
          html += '  </tr>\\n';
        }
        
        for (var j = 0; j < data.length; j++) {
          html += '  <tr>\\n';
          var row = data[j];
          var values = Object.values(row);
          for (var k = 0; k < values.length; k++) {
            html += '    <td>' + (values[k] !== void 0 && values[k] !== null ? values[k] : '') + '</td>\\n';
          }
          html += '  </tr>\\n';
        }
        
        html += '</table>';
        return html;
      }

      function convertToMarkdown(data) {
        if (!data.length) return '';
        var headers = Object.keys(data[0]);
        var md = '| ' + headers.join(' | ') + ' |\\n';
        var separators = [];
        for (var i = 0; i < headers.length; i++) {
          separators.push('---');
        }
        md += '| ' + separators.join(' | ') + ' |\\n';
        
        for (var j = 0; j < data.length; j++) {
          var row = data[j];
          var values = [];
          for (var k = 0; k < headers.length; k++) {
            var val = row[headers[k]];
            values.push(val !== void 0 && val !== null ? val : '');
          }
          md += '| ' + values.join(' | ') + ' |\\n';
        }
        
        return md;
      }

      function simpleMarkdownToHTML(markdown) {
        return markdown
          .replace(/^### (.+)$/gm, '<h3>$1</h3>')
          .replace(/^## (.+)$/gm, '<h2>$1</h2>')
          .replace(/^# (.+)$/gm, '<h1>$1</h1>')
          .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
          .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
          .replace(/\\n/g, '<br>');
      }

      function sanitizeHTML(html) {
        var div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
      }

      function extractKeywords(text, count) {
        var words = text.toLowerCase().match(/\\b[a-z\\u4e00-\\u9fa5]+\\b/g) || [];
        var frequency = {};
        
        for (var i = 0; i < words.length; i++) {
          var word = words[i];
          frequency[word] = (frequency[word] || 0) + 1;
        }
        
        var entries = Object.entries(frequency);
        entries.sort(function(a, b) { return b[1] - a[1]; });
        var topWords = entries.slice(0, count);
        var result = [];
        for (var j = 0; j < topWords.length; j++) {
          result.push(topWords[j][0]);
        }
        return result.join(', ');
      }
    `
  }
}

import { useEffect, useRef, useState, useCallback } from 'react'

interface UseWorkerOptions {
  autoInit?: boolean
}

interface UseWorkerReturn {
  isReady: boolean
  isProcessing: boolean

  exportData: (task: ExportTask) => Promise<string>
  processText: (task: ProcessTextTask) => Promise<string>
  cancelCurrentTask: () => void
  terminate: () => void
}

export function useChatWorker(options: UseWorkerOptions = {}): UseWorkerReturn {
  const { autoInit = true } = options

  const workerRef = useRef<ChatWorkerManager | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (autoInit) {
      initWorker()
    }

    return () => {
      workerRef.current?.terminate()
    }
  }, [autoInit])

  const initWorker = useCallback(async () => {
    try {
      workerRef.current = new ChatWorkerManager()
      await workerRef.current.init()
      setIsReady(true)
    } catch (error) {
      setIsReady(false)
    }
  }, [])

  const exportData = useCallback(async (task: ExportTask): Promise<string> => {
    if (!workerRef.current) throw new Error('Worker not initialized')
    setIsProcessing(true)
    try {
      return await workerRef.current.exportData(task)
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const processText = useCallback(async (task: ProcessTextTask): Promise<string> => {
    if (!workerRef.current) throw new Error('Worker not initialized')
    setIsProcessing(true)
    try {
      return await workerRef.current.processText(task)
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const cancelCurrentTask = useCallback(() => {
    workerRef.current?.cancelTask()
    setIsProcessing(false)
  }, [])

  const terminate = useCallback(() => {
    workerRef.current?.terminate()
    setIsReady(false)
    setIsProcessing(false)
  }, [])

  return {
    isReady,
    isProcessing,
    exportData,
    processText,
    cancelCurrentTask,
    terminate,
  }
}

export { ChatWorkerManager, type ExportTask, type ProcessTextTask }
export default ChatWorkerManager
