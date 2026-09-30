/**
 * RMFOOD 小程序 - API配置
 * 基于环境配置的API设置
 */

const envConfig = require('./env')

module.exports = {
  // API基础地址
  baseUrl: envConfig.baseUrl,
  
  // 文件上传地址
  uploadUrl: envConfig.uploadUrl,
  
  // WebSocket地址
  wsUrl: envConfig.wsUrl,
  
  // 请求超时时间（毫秒）
  timeout: envConfig.timeout,
  
  // 是否开启调试模式
  debug: envConfig.debug,
  
  // Token存储键名
  tokenKey: 'rmfood_token',
  userInfoKey: 'rmfood_user_info',
  
  // 请求重试次数
  retryCount: envConfig.retryCount,
  
  // 重试延迟（毫秒）
  retryDelay: 1000,
  
  // 日志级别
  logLevel: envConfig.logLevel,
  
  // 环境信息
  env: envConfig.env
}
