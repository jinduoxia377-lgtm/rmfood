/**
 * 全局错误处理工具
 */

class ErrorHandler {
  constructor() {
    this.handlers = [];
  }

  on(handler) {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  handle(error, context = '') {
    const errorInfo = {
      type: error.type || 'Unknown',
      message: error.message || String(error),
      context,
      timestamp: Date.now()
    };

    this.handlers.forEach(handler => {
      try {
        handler(errorInfo);
      } catch (e) {
        // 静默失败
      }
    });
  }

  wrap(promise, context) {
    return promise.catch(error => {
      this.handle(error, context);
      throw error;
    });
  }

  wrapAsync(asyncFn, context) {
    return async (...args) => {
      try {
        return await asyncFn(...args);
      } catch (error) {
        this.handle(error, context);
        throw error;
      }
    };
  }
}

function setupGlobalErrorHandler() {
  const errorHandler = new ErrorHandler();
  globalThis.handleError = errorHandler.handle.bind(errorHandler);
  globalThis.errorHandler = errorHandler;
  return errorHandler;
}

module.exports = { ErrorHandler, setupGlobalErrorHandler };
