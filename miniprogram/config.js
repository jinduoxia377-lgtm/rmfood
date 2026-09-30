/**
 * RMFOOD 小程序 - API配置
 * 统一管理API地址和请求配置
 */

module.exports = {
  // 后端API基础地址 - 开发环境使用localhost
  baseUrl: 'http://localhost:8000/api/v1',
  
  // 文件上传地址
  uploadUrl: 'http://localhost:8000/api/v1',
  
  // 请求超时时间（毫秒）
  timeout: 10000,
  
  // 是否开启调试模式
  debug: true,
  
  // Token存储键名
  tokenKey: 'access_token',
  userInfoKey: 'user_info',
  
  // 请求重试次数
  retryCount: 3,
  
  // 重试延迟（毫秒）
  retryDelay: 1000
}
