/**
 * RMFOOD 小程序 - 环境配置
 * 统一管理不同环境的配置
 */

// ⚠️ 真机调试时必须修改此IP为电脑局域网IP
// 获取方法: PowerShell执行 `ipconfig`，使用 WLAN 网卡的IPv4地址
// 常见IP示例: 192.168.1.x 或 172.20.x.x
const DEVELOPMENT_IP = '172.20.6.83'

// 检测当前环境
const getEnv = () => {
  // 强制使用开发环境
  return 'development'
}

const env = getEnv()

// 配置映射
const configMap = {
  development: {
    baseUrl: `http://${DEVELOPMENT_IP}:8000/api/v1`,
    uploadUrl: `http://${DEVELOPMENT_IP}:8000/api/v1`,
    debug: true,
    wsUrl: `ws://${DEVELOPMENT_IP}:8000/ws`,
    timeout: 10000,
    retryCount: 3,
    logLevel: 'debug'
  },
  production: {
    baseUrl: 'https://api.rmfood.com/api/v1',
    uploadUrl: 'https://api.rmfood.com/api/v1',
    debug: false,
    wsUrl: 'wss://api.rmfood.com/ws',
    timeout: 10000,
    retryCount: 3,
    logLevel: 'error'
  }
}

// 当前环境配置
const config = configMap[env] || configMap.development

module.exports = {
  env,
  ...config
}
