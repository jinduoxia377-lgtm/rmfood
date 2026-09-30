# 图片懒加载使用示例


// 在页面中使用懒加载
const { ImageLazyLoader } = require('./image_lazy_loader');

Page({
  data: {
    images: [
      { id: 1, src: '/assets/images/hero.jpg', lazy: true },
      { id: 2, src: '/assets/images/product1.jpg', lazy: true },
      // ...
    ]
  },
  
  onLoad() {
    // 初始化懒加载
    this.lazyLoader = new ImageLazyLoader();
    this.lazyLoader.init('image[data-lazy]', (src) => {
      // 加载完成回调
    });
    
    // 预加载关键图片
    this.lazyLoader.preload('/assets/images/hero.jpg');
  },
  
  onUnload() {
    // 清理观察者
    this.lazyLoader.observers.forEach(observer => {
      observer.disconnect();
    });
  }
});
