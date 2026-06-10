#!/usr/bin/env node

import { execSync, spawn } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

const ROOT_DIR = resolve(import.meta.dirname, '..');
const BENCHMARKS_DIR = join(ROOT_DIR, 'benchmarks');
const REPORTS_DIR = join(BENCHMARKS_DIR, 'reports');

const PERFORMANCE_TARGETS = {
  lighthouse: {
    performance: 95,
    accessibility: 90,
    'best-practices': 90,
    seo: 85,
  },
  bundle: {
    maxSize: 500 * 1024,
    maxChunkSize: 300 * 1024,
  },
  runtime: {
    fps: 55,
    renderTime: 16,
    memoryGrowth: 50 * 1024 * 1024,
  },
};

function log(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warning: '\x1b[33m',
    error: '\x1b[31m',
  };
  console.log(`${colors[type]}${message}\x1b[0m`);
}

function ensureDirectory(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

async function runLighthouseCI() {
  log('\n🔍 Running Lighthouse CI...', 'info');

  ensureDirectory(REPORTS_DIR);

  const lighthouseConfig = {
    extends: 'lighthouse:default',
    settings: {
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      formFactor: 'desktop',
      screenEmulation: { disabled: true },
      throttling: {
        rttMs: 40,
        throughputKbps: 10240,
        cpuSlowdownMultiplier: 1,
      },
      output: ['json', 'html'],
    },
  };

  const configPath = join(BENCHMARKS_DIR, '.lighthouserc.json');
  writeFileSync(configPath, JSON.stringify(lighthouseConfig, null, 2));

  try {
    const result = execSync(
      `npx lighthouse http://localhost:3000 --output=json --output-path=${join(REPORTS_DIR, 'lighthouse.json')} --config-path=${configPath}`,
      { cwd: ROOT_DIR, stdio: 'pipe' }
    ).toString();

    const report = JSON.parse(readFileSync(join(REPORTS_DIR, 'lighthouse.json'), 'utf-8'));
    const scores = report.categories;

    let allPassed = true;
    for (const [category, target] of Object.entries(PERFORMANCE_TARGETS.lighthouse)) {
      const score = (scores[category]?.score || 0) * 100;
      const passed = score >= (target as number);
      const status = passed ? '✅' : '❌';

      log(`  ${status} ${category}: ${score.toFixed(1)} / ${(target as number)}`, passed ? 'success' : 'error');

      if (!passed) allPassed = false;
    }

    return allPassed;
  } catch (error) {
    log('  ❌ Lighthouse CI failed to run', 'error');
    log(`     Error: ${error instanceof Error ? error.message : String(error)}`, 'error');
    return false;
  }
}

async function analyzeBundleSize() {
  log('\n📦 Analyzing bundle size...', 'info');

  try {
    execSync('npm run build', { cwd: ROOT_DIR, stdio: 'pipe' });

    const distDir = join(ROOT_DIR, 'dist');
    const assetsDir = join(distDir, 'assets');

    if (!existsSync(assetsDir)) {
      log('  ⚠️  No build output found. Run `npm run build` first.', 'warning');
      return false;
    }

    const stats = await import(join(distDir, 'stats.json')).catch(() => null);

    const bundleReport = {
      timestamp: new Date().toISOString(),
      totalSize: 0,
      chunks: [],
      warnings: [],
      errors: [],
    };

    function scanDirectory(dir: string, baseName = '') {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          scanDirectory(fullPath, entry);
        } else {
          const size = stat.size;
          bundleReport.totalSize += size;

          const chunkInfo = {
            name: entry,
            path: fullPath.replace(distDir, ''),
            size,
            sizeFormatted: formatBytes(size),
            percentage: 0,
            isOverLimit: size > PERFORMANCE_TARGETS.bundle.maxChunkSize,
          };

          bundleReport.chunks.push(chunkInfo);

          if (size > PERFORMANCE_TARGETS.bundle.maxChunkSize) {
            bundleReport.warnings.push(`Chunk "${entry}" exceeds limit: ${formatBytes(size)} > ${formatBytes(PERFORMANCE_TARGETS.bundle.maxChunkSize)}`);
          }

          if (entry.endsWith('.js') && size > PERFORMANCE_TARGETS.bundle.maxSize) {
            bundleReport.errors.push(`JS chunk too large: ${formatBytes(size)}`);
          }
        }
      }
    }

    import { readdirSync, statSync } from 'fs';
    scanDirectory(assetsDir);

    bundleReport.chunks.forEach((chunk) => {
      chunk.percentage = (chunk.size / bundleReport.totalSize) * 100;
    });

    bundleReport.chunks.sort((a, b) => b.size - a.size);

    const reportPath = join(REPORTS_DIR, 'bundle-analysis.json');
    writeFileSync(reportPath, JSON.stringify(bundleReport, null, 2));

    log(`  📊 Total bundle size: ${formatBytes(bundleReport.totalSize)}`, 'info');
    log(`  📦 Total chunks: ${bundleReport.chunks.length}`, 'info');
    log('  Top 5 largest chunks:', 'info');

    bundleReport.chunks.slice(0, 5).forEach((chunk, i) => {
      const icon = chunk.isOverLimit ? '⚠️' : '  ';
      log(`    ${icon} ${i + 1}. ${chunk.name}: ${chunk.sizeFormatted} (${chunk.percentage.toFixed(1)}%)`, chunk.isOverLimit ? 'warning' : 'info');
    });

    if (bundleReport.warnings.length > 0) {
      log(`\n  ⚠️  Warnings (${bundleReport.warnings.length}):`, 'warning');
      bundleReport.warnings.forEach((w) => log(`    - ${w}`, 'warning'));
    }

    return bundleReport.errors.length === 0;
  } catch (error) {
    log('  ❌ Bundle analysis failed', 'error');
    log(`     Error: ${error instanceof Error ? error.message : String(error)}`, 'error');
    return false;
  }
}

async function detectMemoryLeaks() {
  log('\n💾 Detecting memory leaks...', 'info');

  const testScript = `
    const puppeteer = require('puppeteer');

    async function runMemoryTest() {
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();

      await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

      const snapshots = [];

      for (let i = 0; i < 10; i++) {
        const metrics = await page.metrics();
        snapshots.push({
          iteration: i,
          jsHeapSizeUsed: metrics.JSHeapUsedSize,
          jsHeapTotalSize: metrics.JSHeapTotalSize,
          timestamp: Date.now(),
        });

        // Simulate user interaction
        await page.evaluate(() => {
          window.location.hash = i % 2 === 0 ? '#/ai/chat' : '#/ai/generate';
        });

        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      await browser.close();

      return snapshots;
    }

    runMemoryTest()
      .then(data => console.log(JSON.stringify(data)))
      .catch(err => { console.error(err); process.exit(1); });
  `;

  const testScriptPath = join(BENCHMARKS_DIR, 'memory-test.cjs');
  writeFileSync(testScriptPath, testScript);

  try {
    const result = execSync(`node ${testScriptPath}`, {
      cwd: ROOT_DIR,
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    const snapshots = JSON.parse(result);
    const initialMemory = snapshots[0].jsHeapSizeUsed;
    const finalMemory = snapshots[snapshots.length - 1].jsHeapSizeUsed;
    const memoryGrowth = finalMemory - initialMemory;

    log(`  Initial memory: ${formatBytes(initialMemory)}`, 'info');
    log(`  Final memory: ${formatBytes(finalMemory)}`, 'info');
    log(`  Memory growth: ${formatBytes(memoryGrowth)}`, memoryGrowth > PERFORMANCE_TARGETS.runtime.memoryGrowth ? 'error' : 'success');

    const isLeaking = memoryGrowth > PERFORMANCE_TARGETS.runtime.memoryGrowth;

    if (isLeaking) {
      log('  ❌ Potential memory leak detected!', 'error');
      log('     Memory growth exceeds threshold of:', 'error');
      log(`     ${formatBytes(PERFORMANCE_TARGETS.runtime.memoryGrowth)}`, 'error');
    } else {
      log('  ✅ No significant memory leak detected', 'success');
    }

    const reportPath = join(REPORTS_DIR, 'memory-leak-report.json');
    writeFileSync(reportPath, JSON.stringify({ snapshots, memoryGrowth, isLeaking }, null, 2));

    return !isLeaking;
  } catch (error) {
    log('  ❌ Memory leak detection failed', 'error');
    log(`     Error: ${error instanceof Error ? error.message : String(error)}`, 'error');
    return false;
  }
}

async function recordCriticalUserJourneys() {
  log('\n🎬 Recording critical user journeys...', 'info');

  const journeys = [
    {
      name: 'Chat - Send Message',
      url: 'http://localhost:3000/#/ai/chat',
      actions: [
        { type: 'type', selector: 'textarea[data-testid="chat-input"]', text: 'Hello, AI!' },
        { type: 'click', selector: 'button[type="submit"]' },
        { type: 'wait', time: 2000 },
      ],
    },
    {
      name: 'Generate - Create Formula',
      url: 'http://localhost:3000/#/ai/generate',
      actions: [
        { type: 'click', selector: 'button[data-testid="generate-btn"]' },
        { type: 'wait', time: 3000 },
      ],
    },
    {
      name: 'Dashboard - Load Page',
      url: 'http://localhost:3000/#/dashboard',
      actions: [
        { type: 'wait', time: 2000 },
      ],
    },
  ];

  const results = [];

  for (const journey of journeys) {
    log(`\n  Testing: ${journey.name}`, 'info');

    try {
      const startTime = performance.now();

      const perfData = await runJourneyPerformance(journey);
      const duration = performance.now() - startTime;

      results.push({
        name: journey.name,
        duration,
        ...perfData,
        passed: perfData.fps >= PERFORMANCE_TARGETS.runtime.fps &&
                perfData.renderTime <= PERFORMANCE_TARGETS.runtime.renderTime,
      });

      const status = results[results.length - 1].passed ? '✅' : '❌';
      log(`    ${status} Duration: ${duration.toFixed(0)}ms`, results[results.length - 1].passed ? 'success' : 'error');
      log(`       FPS: ${perfData.fps}, Render Time: ${perfData.renderTime.toFixed(1)}ms`, 'info');
    } catch (error) {
      results.push({
        name: journey.name,
        duration: 0,
        fps: 0,
        renderTime: 0,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      });

      log(`    ❌ Journey failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }

  const reportPath = join(REPORTS_DIR, 'user-journey-performance.json');
  writeFileSync(reportPath, JSON.stringify(results, null, 2));

  const allPassed = results.every((r) => r.passed);
  log(`\n  Overall: ${allPassed ? '✅ All journeys passed' : '❌ Some journeys failed'}`, allPassed ? 'success' : 'error');

  return allPassed;
}

async function runJourneyPerformance(journey: any): Promise<{ fps: number; renderTime: number }> {
  return new Promise((resolve, reject) => {
    const testProcess = spawn('node', ['-e', `
      const puppeteer = require('puppeteer');

      async function run() {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        await page.goto('${journey.url}', { waitUntil: 'networkidle0' });

        const fpsSamples = [];
        const renderTimes = [];
        let lastFrameTime = performance.now();

        await page.evaluateOnNewDocument(() => {
          window.__PERF_DATA__ = { fps: [], renderTimes: [] };

          let frameCount = 0;
          let lastTime = performance.now();

          function measureFPS(now) {
            frameCount++;
            if (now - lastTime >= 1000) {
              window.__PERF_DATA__.fps.push(frameCount);
              frameCount = 0;
              lastTime = now;
            }
            requestAnimationFrame(measureFPS);
          }

          requestAnimationFrame(measureFPS);

          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === 'measure') {
                window.__PERF_DATA__.renderTimes.push(entry.duration);
              }
            }
          });
          observer.observe({ entryTypes: ['measure'] });
        });

        for (const action of ${JSON.stringify(journey.actions)}) {
          switch (action.type) {
            case 'type':
              await page.type(action.selector, action.text);
              break;
            case 'click':
              await page.click(action.selector);
              break;
            case 'wait':
              await new Promise(r => setTimeout(r, action.time));
              break;
          }
        }

        const data = await page.evaluate(() => window.__PERF_DATA__);
        await browser.close();

        console.log(JSON.stringify({
          fps: Math.round(data.fps.reduce((a, b) => a + b, 0) / (data.fps.length || 1)),
          renderTime: data.renderTimes.reduce((a, b) => a + b, 0) / (data.renderTimes.length || 1),
        }));
      }

      run().catch(err => { console.error(err); process.exit(1); });
    `], { cwd: ROOT_DIR, stdio: ['pipe', 'pipe', 'pipe'] });

    let output = '';
    testProcess.stdout.on('data', (data) => { output += data; });
    testProcess.stderr.on('data', (data) => {});

    testProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(output));
      } catch (e) {
        reject(new Error('Failed to parse performance data'));
      }
    });

    testProcess.on('error', reject);
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

async function generateFinalReport(results: Record<string, boolean>) {
  log('\n' + '='.repeat(60), 'info');
  log('📋 FINAL PERFORMANCE REPORT', 'info');
  log('='.repeat(60), 'info');

  const allPassed = Object.values(results).every(Boolean);

  for (const [test, passed] of Object.entries(results)) {
    const status = passed ? '✅ PASSED' : '❌ FAILED';
    const color = passed ? 'success' : 'error';
    log(`  ${status}: ${test}`, color);
  }

  log('='.repeat(60), allPassed ? 'success' : 'error');
  log(allPassed
    ? '🎉 All performance tests passed! Your app meets the targets.'
    : '⚠️  Some tests failed. Review the reports in benchmarks/reports/', allPassed ? 'success' : 'warning'
  );

  const summary = {
    timestamp: new Date().toISOString(),
    targets: PERFORMANCE_TARGETS,
    results,
    overall: allPassed ? 'PASS' : 'FAIL',
  };

  const reportPath = join(REPORTS_DIR, 'summary.json');
  writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  log(`\n  Full report saved to: ${reportPath}`, 'info');

  process.exit(allPassed ? 0 : 1);
}

async function main() {
  log('🚀 RMFOOD Performance Benchmark Suite', 'info');
  log('=' .repeat(40), 'info');
  log(`Targets:`, 'info');
  log(`  - Lighthouse Performance: ≥${PERFORMANCE_TARGETS.lighthouse.performance}%`, 'info');
  log(`  - Max Chunk Size: ${formatBytes(PERFORMANCE_TARGETS.bundle.maxChunkSize)}`, 'info');
  log(`  - FPS: ≥${PERFORMANCE_TARGETS.runtime.fps}`, 'info');
  log(`  - Render Time: ≤${PERFORMANCE_TARGETS.runtime.renderTime}ms`, 'info');
  log(`  - Memory Growth: <${formatBytes(PERFORMANCE_TARGETS.runtime.memoryGrowth)}`, 'info');

  ensureDirectory(BENCHMARKS_DIR);
  ensureDirectory(REPORTS_DIR);

  const results: Record<string, boolean> = {};

  results['Lighthouse CI'] = await runLighthouseCI();
  results['Bundle Size Analysis'] = await analyzeBundleSize();
  results['Memory Leak Detection'] = await detectMemoryLeaks();
  results['Critical User Journeys'] = await recordCriticalUserJourneys();

  await generateFinalReport(results);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});