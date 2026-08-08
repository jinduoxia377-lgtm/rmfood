/**
 * 性能指标 Hook
 * 提供实时性能监控能力，包括帧率、Web Vitals、资源加载等
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { webVitalsMonitor, type PerformanceReport, type WebVitalsMetrics, DEFAULT_THRESHOLDS } from '@/utils/webVitals';

export interface PerformanceState {
  report: PerformanceReport | null;
  metrics: WebVitalsMetrics;
  fps: number;
  isHealthy: boolean;
  alerts: PerformanceAlert[];
}

export interface PerformanceAlert {
  id: string;
  type: 'fps' | 'lcp' | 'fid' | 'cls' | 'inp' | 'resource';
  message: string;
  severity: 'warning' | 'error';
  threshold: number;
  current: number;
}

export function usePerformanceMetrics() {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [metrics, setMetrics] = useState<WebVitalsMetrics>({});
  const [fps, setFps] = useState(60);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const alertIdsRef = useRef<Set<string>>(new Set());

  const checkAlerts = useCallback((currentReport: PerformanceReport) => {
    const newAlerts: PerformanceAlert[] = [];

    if (currentReport.fps.average < DEFAULT_THRESHOLDS.fps.min && !alertIdsRef.current.has('fps')) {
      newAlerts.push({
        id: 'fps',
        type: 'fps',
        message: `帧率低于 ${DEFAULT_THRESHOLDS.fps.min}fps，当前: ${currentReport.fps.average}fps`,
        severity: 'error',
        threshold: DEFAULT_THRESHOLDS.fps.min,
        current: currentReport.fps.average,
      });
      alertIdsRef.current.add('fps');
    } else if (currentReport.fps.average >= DEFAULT_THRESHOLDS.fps.min) {
      alertIdsRef.current.delete('fps');
    }

    if (currentReport.lcp.value > DEFAULT_THRESHOLDS.lcp.poor && !alertIdsRef.current.has('lcp')) {
      newAlerts.push({
        id: 'lcp',
        type: 'lcp',
        message: `LCP 超过阈值，当前: ${currentReport.lcp.label}`,
        severity: 'error',
        threshold: DEFAULT_THRESHOLDS.lcp.poor,
        current: currentReport.lcp.value,
      });
      alertIdsRef.current.add('lcp');
    } else if (currentReport.lcp.value <= DEFAULT_THRESHOLDS.lcp.poor) {
      alertIdsRef.current.delete('lcp');
    }

    if (
      currentReport.lcp.value > DEFAULT_THRESHOLDS.lcp.good &&
      currentReport.lcp.value <= DEFAULT_THRESHOLDS.lcp.poor &&
      !alertIdsRef.current.has('lcp-warning')
    ) {
      newAlerts.push({
        id: 'lcp-warning',
        type: 'lcp',
        message: `LCP 需要优化，当前: ${currentReport.lcp.label}`,
        severity: 'warning',
        threshold: DEFAULT_THRESHOLDS.lcp.good,
        current: currentReport.lcp.value,
      });
      alertIdsRef.current.add('lcp-warning');
    } else if (currentReport.lcp.value <= DEFAULT_THRESHOLDS.lcp.good) {
      alertIdsRef.current.delete('lcp-warning');
    }

    if (currentReport.inp.value > DEFAULT_THRESHOLDS.inp.poor && !alertIdsRef.current.has('inp')) {
      newAlerts.push({
        id: 'inp',
        type: 'inp',
        message: `INP 超过阈值，当前: ${currentReport.inp.label}`,
        severity: 'error',
        threshold: DEFAULT_THRESHOLDS.inp.poor,
        current: currentReport.inp.value,
      });
      alertIdsRef.current.add('inp');
    } else if (currentReport.inp.value <= DEFAULT_THRESHOLDS.inp.poor) {
      alertIdsRef.current.delete('inp');
    }

    if (currentReport.cls.value > DEFAULT_THRESHOLDS.cls.poor && !alertIdsRef.current.has('cls')) {
      newAlerts.push({
        id: 'cls',
        type: 'cls',
        message: `CLS 超过阈值，当前: ${currentReport.cls.label}`,
        severity: 'error',
        threshold: DEFAULT_THRESHOLDS.cls.poor,
        current: currentReport.cls.value,
      });
      alertIdsRef.current.add('cls');
    } else if (currentReport.cls.value <= DEFAULT_THRESHOLDS.cls.poor) {
      alertIdsRef.current.delete('cls');
    }

    if (currentReport.inp.value > DEFAULT_THRESHOLDS.inp.poor && !alertIdsRef.current.has('inp')) {
      newAlerts.push({
        id: 'inp',
        type: 'inp',
        message: `INP 超过阈值，当前: ${currentReport.inp.label}`,
        severity: 'error',
        threshold: DEFAULT_THRESHOLDS.inp.poor,
        current: currentReport.inp.value,
      });
      alertIdsRef.current.add('inp');
    } else if (currentReport.inp.value <= DEFAULT_THRESHOLDS.inp.poor) {
      alertIdsRef.current.delete('inp');
    }

    if (currentReport.resourceLoadTime > DEFAULT_THRESHOLDS.resourceLoad && !alertIdsRef.current.has('resource')) {
      newAlerts.push({
        id: 'resource',
        type: 'resource',
        message: `资源加载时间超过 2秒，当前: ${currentReport.resourceLoadTime.toFixed(0)}ms`,
        severity: 'warning',
        threshold: DEFAULT_THRESHOLDS.resourceLoad,
        current: currentReport.resourceLoadTime,
      });
      alertIdsRef.current.add('resource');
    } else if (currentReport.resourceLoadTime <= DEFAULT_THRESHOLDS.resourceLoad) {
      alertIdsRef.current.delete('resource');
    }

    setAlerts(newAlerts);
  }, []);

  useEffect(() => {
    const unsubscribeReport = webVitalsMonitor.addReportListener((newReport) => {
      setReport(newReport);
      setFps(newReport.fps.average);
      checkAlerts(newReport);
    });

    const unsubscribeMetrics = webVitalsMonitor.addListener((newMetrics) => {
      setMetrics(newMetrics);
    });

    const interval = setInterval(() => {
      const latestReport = webVitalsMonitor.getPerformanceReport();
      setReport(latestReport);
      setFps(latestReport.fps.average);
      checkAlerts(latestReport);
    }, 1000);

    return () => {
      unsubscribeReport();
      unsubscribeMetrics();
      clearInterval(interval);
    };
  }, [checkAlerts]);

  const isHealthy =
    fps >= DEFAULT_THRESHOLDS.fps.min &&
    (report?.lcp.status === 'good' || report?.lcp.value === 0) &&
    (report?.inp.status === 'good' || report?.inp.value === 0) &&
    (report?.cls.status === 'good' || report?.cls.value === 0);

  const logReport = useCallback(() => {
    webVitalsMonitor.logReport();
  }, []);

  return {
    report,
    metrics,
    fps,
    isHealthy,
    alerts,
    logReport,
  };
}

export function useFPSMonitor() {
  const [fps, setFps] = useState(60);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafIdRef = useRef<number>(0);

  useEffect(() => {
    const measureFPS = () => {
      frameCountRef.current++;
      const now = performance.now();

      if (now - lastTimeRef.current >= 1000) {
        const currentFPS = Math.round((frameCountRef.current * 1000) / (now - lastTimeRef.current));
        setFps(currentFPS);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      rafIdRef.current = requestAnimationFrame(measureFPS);
    };

    rafIdRef.current = requestAnimationFrame(measureFPS);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const isHealthy = fps >= DEFAULT_THRESHOLDS.fps.min;
  const isWarning = fps < DEFAULT_THRESHOLDS.fps.min;

  return {
    fps,
    isHealthy,
    isWarning,
  };
}

export function useResourceTiming() {
  const [loadTime, setLoadTime] = useState(0);
  const [resources, setResources] = useState<PerformanceResourceTiming[]>([]);

  useEffect(() => {
    const handleLoad = () => {
      const resourceEntries = performance.getEntriesByType('resource');
      setResources(resourceEntries);

      const totalLoadTime = resourceEntries.reduce((sum, resource) => {
        return sum + (resource.responseEnd - resource.requestStart);
      }, 0);
      setLoadTime(totalLoadTime);
    };

    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad);
      return () => window.removeEventListener('load', handleLoad);
    }
    return;
  }, []);

  const isFast = loadTime <= DEFAULT_THRESHOLDS.resourceLoad;

  return {
    loadTime,
    resources,
    isFast,
    resourceCount: resources.length,
  };
}
