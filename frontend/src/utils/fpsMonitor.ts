export class FPSMonitor {
  private frames = 0;
  private lastTime = 0;
  private fpsHistory: number[] = [];
  private minFPS = 60;
  private maxHistorySize = 60;
  private rafId: number | null = null;
  private onFPSUpdate?: (fps: number, minFPS: number, avgFPS: number) => void;

  constructor(options: { minFPS?: number; onFPSUpdate?: (fps: number, minFPS: number, avgFPS: number) => void } = {}) {
    this.minFPS = options.minFPS || 30;
    this.onFPSUpdate = options.onFPSUpdate;
  }

  start() {
    this.frames = 0;
    this.lastTime = performance.now();
    this.fpsHistory = [];

    const loop = () => {
      this.frames++;
      const now = performance.now();

      if (now - this.lastTime >= 1000) {
        const fps = Math.round((this.frames * 1000) / (now - this.lastTime));

        this.fpsHistory.push(fps);
        if (this.fpsHistory.length > this.maxHistorySize) {
          this.fpsHistory.shift();
        }

        const minFPS = Math.min(...this.fpsHistory);
        const avgFPS = Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length);

        this.onFPSUpdate?.(fps, minFPS, avgFPS);

        this.frames = 0;
        this.lastTime = now;
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  getStats() {
    const minFPS = this.fpsHistory.length > 0 ? Math.min(...this.fpsHistory) : 0;
    const avgFPS = this.fpsHistory.length > 0
      ? Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length)
      : 0;
    const isGood = minFPS >= this.minFPS;

    return {
      currentFPS: this.fpsHistory[this.fpsHistory.length - 1] || 0,
      minFPS,
      avgFPS,
      isGood,
      history: [...this.fpsHistory],
    };
  }

  reset() {
    this.fpsHistory = [];
  }
}

export const validateFPS = async (durationSeconds = 10): Promise<{
  passed: boolean;
  minFPS: number;
  avgFPS: number;
  history: number[];
}> => {
  return new Promise((resolve) => {
    const monitor = new FPSMonitor({ minFPS: 30 });

    monitor.start();

    setTimeout(() => {
      monitor.stop();
      const stats = monitor.getStats();

      resolve({
        passed: stats.isGood,
        minFPS: stats.minFPS,
        avgFPS: stats.avgFPS,
        history: stats.history,
      });
    }, durationSeconds * 1000);
  });
};
