/**
 * 全局 TypeScript 类型扩展声明
 *
 * 解决浏览器 API 和第三方库的类型缺失问题
 */

// ── 性能 API 扩展 ──
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceExtensions {
  memory?: PerformanceMemory;
  hadRecentInput?: boolean;
  value?: number;
}

declare global {
  interface Performance extends PerformanceExtensions {}
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
  interface Error {
    userMessage?: string;
  }
}

// ── 网络信息 API ──
interface NetworkInformation {
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
  rtt: number;
  downlink: number;
  downlinkMax: number;
  saveData: boolean;
  onchange?: EventListener;
}

// ── 缺失的第三方模块 ──
declare module 'react-sankey' {
  import React from 'react';
  interface SankeyProps {
    data: { nodes: any[]; links: any[] };
    nodePadding?: number;
    nodeWidth?: number;
    height?: number;
    nodeColor?: (node: any) => string;
    margin?: { top: number; right: number; bottom: number; left: number };
  }
  export const Sankey: React.FC<SankeyProps>;
}