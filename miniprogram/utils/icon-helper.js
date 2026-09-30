// Icon 工具类 - 提供静态方法获取图标数据
const { IconMap } = require('../utils/icons.js')

/**
 * IconHelper - 图标工具类
 * 提供图标的查询、验证、转换等功能
 */
class IconHelper {
  /**
   * 检查图标是否存在
   */
  static isValid(name) {
    return name && IconMap[name] !== undefined
  }

  /**
   * 获取图标路径数据
   */
  static getPath(name) {
    return IconMap[name] || IconMap['info']
  }

  /**
   * 获取图标类别
   */
  static getCategory(name) {
    const categories = require('../utils/icons.js').IconCategory
    for (const [category, icons] of Object.entries(categories)) {
      if (icons.includes(name)) {
        return category
      }
    }
    return 'unknown'
  }

  /**
   * 批量验证图标
   */
  static validateBatch(names) {
    return names.map(name => ({
      name,
      valid: this.isValid(name),
      category: this.getCategory(name)
    }))
  }

  /**
   * 获取所有图标列表
   */
  static getAllIcons() {
    return Object.keys(IconMap)
  }

  /**
   * 获取图标的 SVG 数据（用于调试）
   */
  static getSVGData(name) {
    const path = this.getPath(name)
    return {
      viewBox: '0 0 24 24',
      path: path
    }
  }
}

module.exports = IconHelper
