// 动态后端地址配置
// 自动根据访问地址配置后端 URL

/**
 * 获取后端 URL（支持多 IP 访问）
 * 
 * 规则：
 * 1. 如果是 localhost/127.0.0.1：使用代理 /api
 * 2. 如果是其他 IP：使用绝对 URL（同 IP 的 8000 端口）
 */
export const getBackendUrl = () => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  // 本地访问：使用 Vite 代理
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return '/api';
  }

  // 局域网访问：使用 IP + 端口
  return `${protocol}//${hostname}:8000`;
};

/**
 * 获取完整的 API 地址
 */
export const getApiUrl = (path: string = '') => {
  const baseUrl = getBackendUrl();
  
  // 如果是相对路径（使用代理），需要加上 /api 前缀
  if (baseUrl === '/api') {
    return `/api${path}`;
  }
  
  // 如果是绝对 URL
  return `${baseUrl}/api${path}`;
};

/**
 * 创建 API 客户端配置
 */
export const apiConfig = {
  baseURL: getBackendUrl(),
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
};

/**
 * WebSocket URL
 */
export const getWebSocketUrl = () => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}://localhost:8000`;
  }

  return `${protocol}://${hostname}:8000`;
};

// 日志输出（开发环境）
if (process.env.NODE_ENV === 'development') {
  console.log('[API Config]');
  console.log('  Host:', window.location.hostname);
  console.log('  Backend URL:', getBackendUrl());
  console.log('  API Base URL:', getApiUrl());
  console.log('  WebSocket URL:', getWebSocketUrl());
}
