import { useEffect, useRef, useState } from 'react';

interface PerformanceMetrics {
  fps: number;
  loadTime: number;
  interactionTime: number;
  aiResponseTime: number;
}

export const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    loadTime: 0,
    interactionTime: 0,
    aiResponseTime: 0,
  });

  const fpsRef = useRef({ frames: 0, lastTime: performance.now() });

  useEffect(() => {
    const measureFps = () => {
      fpsRef.current.frames++;
      const now = performance.now();

      if (now - fpsRef.current.lastTime >= 1000) {
        const fps = Math.round((fpsRef.current.frames * 1000) / (now - fpsRef.current.lastTime));
        setMetrics(prev => ({ ...prev, fps }));
        fpsRef.current.frames = 0;
        fpsRef.current.lastTime = now;
      }

      requestAnimationFrame(measureFps);
    };

    const rafId = requestAnimationFrame(measureFps);

    if (typeof window !== 'undefined') {
      window.addEventListener('load', () => {
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        setMetrics(prev => ({ ...prev, loadTime }));
      });
    }

    return () => cancelAnimationFrame(rafId);
  }, []);

  const measureInteraction = (startTime: number) => {
    const interactionTime = performance.now() - startTime;
    setMetrics(prev => ({ ...prev, interactionTime }));
    return interactionTime;
  };

  const measureAIResponse = (startTime: number) => {
    const aiResponseTime = performance.now() - startTime;
    setMetrics(prev => ({ ...prev, aiResponseTime }));
    return aiResponseTime;
  };

  return { metrics, measureInteraction, measureAIResponse };
};

export const PerformanceBadge = ({ metrics }: { metrics: PerformanceMetrics }) => {
  const getStatusColor = (value: number, target: number, reverse = false) => {
    const isGood = reverse ? value >= target : value <= target;
    const isWarning = reverse ? value >= target * 0.8 : value <= target * 1.5;
    return isGood ? 'text-success-500' : isWarning ? 'text-warning-500' : 'text-error-500';
  };

  return (
    <div className="fixed bottom-4 right-4 bg-neutral-900/90 text-white p-4 rounded-lg shadow-xl z-50 text-sm">
      <h3 className="font-bold mb-2 text-info-400">⚡ 性能监控</h3>
      <div className="space-y-1">
        <div className={getStatusColor(metrics.fps, 30, true)}>
          FPS: {metrics.fps}
        </div>
        <div className={getStatusColor(metrics.loadTime, 2000)}>
          加载: {metrics.loadTime}ms
        </div>
        <div className={getStatusColor(metrics.interactionTime, 500)}>
          交互: {metrics.interactionTime}ms
        </div>
        <div className={getStatusColor(metrics.aiResponseTime, 300)}>
          AI响应: {metrics.aiResponseTime}ms
        </div>
      </div>
    </div>
  );
};
