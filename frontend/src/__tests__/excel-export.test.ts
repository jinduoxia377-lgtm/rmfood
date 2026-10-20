import { describe, it, expect } from 'vitest'
import { exportService, exportToExcel, generateTestData } from '../services/exportService'
import { validateExcelCompatibility } from '../utils/excelUtils'

describe('Excel Export Integration Tests', () => {
  describe('Basic Excel Export', () => {
    // 首次调用 exportToExcel 会触发底层 Excel 库懒加载与 JIT 预热，耗时可能超过默认 5s
    it('should export simple data to Excel', async () => {
      const testData = [
        { 序号: 1, 名称: '测试一', 分类: 'A' },
        { 序号: 2, 名称: '测试二', 分类: 'B' }
      ]

      // 当前 exportToExcel 返回 Promise<void>（直接触发下载），空数据会抛错
      await expect(exportToExcel(testData, 'test-export')).resolves.toBeUndefined()
    }, 60000)

    it('should export data with Chinese characters', async () => {
      const testData = [
        {
          序号: 1,
          配方名称: '中式配方测试',
          主料: '面粉',
          辅料: '水、糖、盐',
          备注: '这是一个中文测试配方，包含多种中文字符和数据信息'
        },
        {
          序号: 2,
          配方名称: '混合配方',
          主料: '大米',
          辅料: '蔬菜、肉类',
          备注: '测试备注信息'
        }
      ]

      await expect(exportToExcel(testData, 'chinese-test')).resolves.toBeUndefined()
    })

    it('should reject empty data (当前行为：空数据抛错)', async () => {
      const emptyData: any[] = []

      await expect(exportToExcel(emptyData, 'empty-test')).rejects.toThrow()
    })
  })

  describe('Excel Export with Styles', () => {
    it('should export with custom header styles', async () => {
      const testData = [
        { 名称: '测试1', 数值: 100 },
        { 名称: '测试2', 数值: 200 }
      ]

      await expect(
        exportService.exportWithStyles(testData, 'styled-test', {
          headerStyle: {
            fontName: '微软雅黑',
            fontSize: 12,
            bold: true,
            bgColor: 'FFD9E1F2'
          }
        }),
      ).resolves.toBeUndefined()
    })

    it('should export with alternating row colors', async () => {
      const testData = Array.from({ length: 100 }, (_, i) => ({
        序号: i + 1,
        内容: `测试内容${i + 1}`
      }))

      await expect(
        exportService.exportWithStyles(testData, 'alternating-test', {
          alternateRowColors: true,
          alternateRowColor: 'FFF2F2F2'
        }),
      ).resolves.toBeUndefined()
    })
  })

  describe('Large Data Export', () => {
    it('should export 10000 rows of test data', async () => {
      const testData = generateTestData(10000)

      const startTime = performance.now()
      await exportToExcel(testData, 'large-export')
      const duration = (performance.now() - startTime) / 1000

      expect(duration).toBeLessThan(15)
    }, 20000)

    it('should export 10000 rows with styles', async () => {
      const testData = generateTestData(10000)

      const startTime = performance.now()
      await exportService.exportWithStyles(testData, 'large-styled-export', {
        headerStyle: {
          fontName: '微软雅黑',
          bold: true,
          bgColor: 'FFD9E1F2'
        },
        alternateRowColors: true
      })
      const duration = (performance.now() - startTime) / 1000

      expect(duration).toBeLessThan(15)
    }, 20000)
  })

  describe('Edge Cases', () => {
    it('should handle special characters in data', async () => {
      const testData = [
        { 内容: '特殊字符: <>&"\\' },
        { 内容: '换行符:\n制表符:\t' },
        { 内容: '中文标点：，。、；：？！' }
      ]

      await expect(exportToExcel(testData, 'special-chars-test')).resolves.toBeUndefined()
    })

    it('should handle very long text in cells', async () => {
      const testData = [
        { 内容: 'a'.repeat(50000) },
        { 内容: '中'.repeat(20000) },
        { 内容: '混合' + 'a'.repeat(30000) }
      ]

      await expect(exportToExcel(testData, 'long-text-test')).resolves.toBeUndefined()
    })

    it('should handle null and undefined values', async () => {
      const testData = [
        { 有值: '数据', 空值: null, 未定义: undefined },
        { 有值: null, 空值: '', 未定义: '数据' }
      ]

      await expect(exportToExcel(testData, 'null-test')).resolves.toBeUndefined()
    })
  })

  describe('Compatibility', () => {
    it('should provide compatibility information', () => {
      const result = validateExcelCompatibility()

      expect(result.isSupported !== undefined).toBe(true)
      expect(Array.isArray(result.suggestions)).toBe(true)
    })
  })
})