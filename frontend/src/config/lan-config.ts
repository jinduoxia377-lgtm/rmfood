// RMFOOD 局域网访问配置
// 支持多 IP 地址访问

// 获取当前访问的主机名和端口
const hostname = window.location.hostname;
const port = window.location.port;

// 根据访问 IP 动态配置 API 基地址
export const getApiBaseUrl = () => {
  // 如果是 localhost，使用相对路径
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return '/api';
  }
  
  // 否则使用绝对路径（使用当前访问地址的 IP）
  return `http://${hostname}:8000/api`;
};

// 支持的 IP 列表和主机名
export const SUPPORTED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '192.168.137.1',
  '172.28.128.1',
  '172.31.80.1',
  '172.20.3.152',
  '172.20.3.153',
  '172.20.3.154',
  'localhost:3000',
  '127.0.0.1:3000',
  '192.168.137.1:3000',
  '172.28.128.1:3000',
  '172.31.80.1:3000',
  '172.20.3.122:3000',
  '172.20.3.152:3000',
  '172.20.3.153:3000',
  '172.20.3.154:3000',
];

// 验证当前访问地址是否被允许
export const isHostAllowed = (currentHost: string) => {
  return SUPPORTED_HOSTS.some(host => currentHost.includes(host));
};

// 获取 WebSocket URL
export const getWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}://${hostname}:8000`;
  }
  
  return `${protocol}://${hostname}:8000`;
};

// 日志输出（仅开发环境）
if (import.meta.env.DEV) {
  console.log('[RMFOOD 局域网配置]');
  console.log('当前访问主机:', hostname);
  console.log('API 基地址:', getApiBaseUrl());
  console.log('WebSocket URL:', getWebSocketUrl());
}
