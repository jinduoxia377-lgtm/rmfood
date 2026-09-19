/**
 * 扩展 Performance / Navigator API 类型，类型声明扩展
 */

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

// CLS entry extension
interface PerformanceLayoutShiftEntry extends PerformanceEntry {
  hadRecentInput: boolean;
  value: number;
  sources: Array<{ node?: Node; hadRecentInput: boolean }>;
}

// FID entry extension
interface PerformanceInputDelayEntry extends PerformanceEntry {
  processingStart: number;
}

interface PerformanceExtensions {
  memory?: PerformanceMemory;
}

declare global {
  interface Performance extends PerformanceExtensions {}
  interface NetworkInformation {
    effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
    rtt: number;
    downlink: number;
    downlinkMax: number;
    saveData: boolean;
    onchange?: EventListener;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  }
  interface Navigator {
    connection?: NetworkInformation;
    deviceMemory?: number;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
}

export {};
