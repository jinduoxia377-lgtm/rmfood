/**
 * 应用初始化
 */

const { setupGlobalErrorHandler } = require('./error_handler');

// 设置全局错误处理
setupGlobalErrorHandler();

// 页面生命周期监控
const originalOnLoad = Page;
Page = function(pageObj) {
  const onLoad = pageObj.onLoad;
  const onShow = pageObj.onShow;
  
  if (onLoad) {
    pageObj.onLoad = function(options) {
      const startTime = Date.now();
      const result = onLoad.call(this, options);
      if (result && result.then) {
        result.then(() => {
        });
      } else {
        setTimeout(() => {
        }, 100);
      }
      return result;
    };
  }
  
  if (onShow) {
    pageObj.onShow = function() {
      this._showTime = Date.now();
      const result = onShow.call(this);
      return result;
    };
  }
  
  return originalOnLoad(pageObj);
};

module.exports = {};
