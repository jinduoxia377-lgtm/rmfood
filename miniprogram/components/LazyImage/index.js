/**
 * 图片懒加载组件
 */
Component({
  options: {
    multipleSlots: true
  },
  
  properties: {
    src: {
      type: String,
      value: ''
    },
    mode: {
      type: String,
      value: 'aspectFill'
    },
    lazy: {
      type: Boolean,
      value: true
    },
    placeholder: {
      type: String,
      value: ''
    }
  },
  
  data: {
    actualSrc: '',
    loaded: false
  },
  
  lifetimes: {
    attached() {
      if (!this.data.lazy) {
        this.setData({ actualSrc: this.data.src });
        return;
      }
      
      // 使用 IntersectionObserver
      const observer = wx.createIntersectionObserver(this);
      observer.relativeToViewport({ top: 100, bottom: 100 });
      
      observer.observe('.lazy-image', (res) => {
        if (res.intersectionRatio > 0) {
          observer.disconnect();
          this.loadImage();
        }
      });
    }
  },
  
  methods: {
    loadImage() {
      const { src } = this.data;
      if (!src) return;
      
      this.setData({ actualSrc: src });
    },
    
    onLoad(e) {
      this.setData({ loaded: true });
      this.triggerEvent('load', e.detail);
    },
    
    onError(e) {
      this.triggerEvent('error', e.detail);
    }
  }
});
