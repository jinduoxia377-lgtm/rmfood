/**
 * 无障碍工具
 * 提供ARIA属性和焦点管理
 */

class AccessibilityManager {
  /**
   * 设置ARIA标签
   */
  static setAriaLabel(element, label, desc = '') {
    element.setAttribute('aria-label', label)
    if (desc) {
      element.setAttribute('aria-describedby', desc)
    }
  }

  /**
   * 焦点管理
   */
  static focus(element) {
    if (element) {
      element.focus()
      element.setAttribute('tabindex', '0')
    }
  }

  /**
   * 焦点陷阱（用于弹窗）
   */
  static trapFocus(container) {
    const focusable = container.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    
    if (focusable.length === 0) return
    
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    
    const handler = (e) => {
      if (e.key !== 'Tab') return
      
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    
    container.addEventListener('keydown', handler)
    
    // 返回清理函数
    return () => {
      container.removeEventListener('keydown', handler)
    }
  }

  /**
   * 返回焦点
   */
  static returnFocus(trigger) {
    if (trigger) {
      trigger.focus()
    }
  }

  /**
   * 检查颜色对比度
   */
  static checkContrast(bgColor, textColor) {
    const bg = this.hexToRgb(bgColor)
    const text = this.hexToRgb(textColor)
    
    const bgLum = this.getLuminance(bg)
    const textLum = this.getLuminance(text)
    
    const contrast = (Math.max(bgLum, textLum) + 0.05) / (Math.min(bgLum, textLum) + 0.05)
    
    return {
      contrast,
      passesAA: contrast >= 4.5,
      passesAAA: contrast >= 7
    }
  }

  /**
   * HEX转RGB
   */
  static hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 }
  }

  /**
   * 计算相对亮度
   */
  static getLuminance(rgb) {
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(v => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  /**
   * 获取对比度足够的前景色
   */
  static getAccessibleColor(bgColor) {
    const bg = this.hexToRgb(bgColor)
    const bgLum = this.getLuminance(bg)
    
    // 如果背景较暗，使用白色文字
    return bgLum < 0.5 ? '#FFFFFF' : '#000000'
  }
}

module.exports = AccessibilityManager
