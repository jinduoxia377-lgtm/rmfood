/**
 * 性能监控工具
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.startTimes = new Map();
  }

  start(name) {
    this.startTimes.set(name, Date.now());
  }

  end(name) {
    const start = this.startTimes.get(name);
    if (!start) return;
    
    const duration = Date.now() - start;
    this.metrics.set(name, duration);
    return duration;
  }

  recordPagePerformance(pageName) {
    const perf = wx.getPerformance();
    const entries = perf.getEntries();
    
    const pageEntry = entries.find(e => e.name.includes(pageName) || e.entryType === 'navigation');
    if (pageEntry) {
      this.metrics.set('page_' + pageName, {
        domContentLoaded: pageEntry.domContentLoaded,
        loadComplete: pageEntry.loadEventEnd
      });
    }
  }

  getMetrics() {
    return Object.fromEntries(this.metrics);
  }

  clearMetrics() {
    this.metrics.clear();
    this.startTimes.clear();
  }
}

module.exports = new PerformanceMonitor();
