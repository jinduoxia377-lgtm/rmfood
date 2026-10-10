#!/usr/bin/env node
/**
 * 带 ECONNRESET 兜底的 Vite 开发服务器启动器。
 *
 * 背景：无头 Chrome（.local/score-probe.cjs 的评测量具）在页面加载完成前会主动
 * 断开连接。Vite 的 HTTP server 在 socket 上收到 ECONNRESET 时，这个 'error' 事件
 * 没有任何监听器，Node 会把它升级成 uncaughtException 并直接终止进程 ——
 * 于是每采一两个页面 dev server 就崩一次，采到的正好是重启窗口里的空壳页
 * （bodyLen=114、只有 "加载中..."）。这一个 crash 同时解释了：
 *   · 为什么 /analytics 反复被判成空壳而代码其实没问题
 *   · 为什么 measure-batch.sh 的重试逻辑要写三层
 *   · 为什么 frontend-dev.log 里有一长串 "[supervisor] vite exited"
 *
 * 做法：显式注册 uncaughtException / unhandledRejection，把"客户端单方面断开"
 * 这一类（ECONNRESET / EPIPE / ECONNABORTED）吞掉，其余照常抛。
 * 这是开发期工具的容错，不改变任何产物行为。
 *
 * 用法：node scripts/dev-server.mjs        （等价于 vite，监听 127.0.0.1:3000）
 */
const IGNORE = new Set(['ECONNRESET', 'EPIPE', 'ECONNABORTED', 'ERR_STREAM_WRITE_AFTER_END']);

const swallow = (err) => {
  if (err && IGNORE.has(err.code)) return true;
  // socket 上抛出的错误有时挂在 errno 而不是 code 上
  if (err && IGNORE.has(err.errno)) return true;
  return false;
};

process.on('uncaughtException', (err) => {
  if (swallow(err)) {
    console.warn('[dev-server] 忽略客户端断开：', err.code || err.errno || err.message);
    return;
  }
  console.error('[dev-server] 未捕获异常：', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  if (swallow(err)) return;
  console.error('[dev-server] 未处理的 Promise 拒绝：', err);
  process.exit(1);
});

const { createServer } = await import('vite');

const server = await createServer({
  configFile: process.argv[2] || undefined,
  server: { host: '127.0.0.1', port: 3000 },
});
await server.listen();
server.printUrls();

// 让 http server 上的连接级错误也不至于把进程带走
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await server.close().catch(() => {});
    process.exit(0);
  });
}
