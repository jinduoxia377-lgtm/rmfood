/**
 * 统一日志工具
 * 生产环境禁用 console 输出
 */

const Logger = {
  log: function() {
    // 生产环境禁用日志
  },
  
  warn: function() {
    // 生产环境禁用警告
  },
  
  error: function(msg, err) {
    // 错误日志保留
    console.error(msg, err || '');
    
    // 上报错误
    if (typeof reportError === 'function') {
      reportError(msg, err);
    }
  }
};

module.exports = Logger;
