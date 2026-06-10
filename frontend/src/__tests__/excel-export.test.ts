import { describe, it, expect } from 'vitest'
import { exportToExcel, exportToExcelWithStyles, generateTestData } from '../services/exportService'
import { validateExcelCompatibility } from '../utils/excelUtils'

describe('Excel Export Integration Tests', () => {
  describe('Basic Excel Export', () => {
    it('should export simple data to Excel', async () => {
      const testData = [
        { 序号: 1, 名称: '测试一', 分类: 'A' },
        { 序号: 2, 名称: '测试二', 分类: 'B' }
      ]

      const blob = await exportToExcel(testData, 'test-export')
      
      expect(blob).toBeDefined()
      expect(blob instanceof Blob).toBe(true)
      expect(blob.type).toContain('spreadsheetml')
    })

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

      const blob = await exportToExcel(testData, 'chinese-test')
      
      expect(blob).toBeDefined()
      expect(blob.size).toBeGreaterThan(0)
    })

    it('should handle empty data gracefully', async () => {
      const emptyData: any[] = []
      
      await expect(exportToExcel(emptyData, 'empty-test')).resolves.not.toThrow()
    })
  })

  describe('Excel Export with Styles', () => {
    it('should export with custom header styles', async () => {
      const testData = [
        { 名称: '测试1', 数值: 100 },
        { 名称: '测试2', 数值: 200 }
      ]

      const blob = await exportToExcelWithStyles(testData, 'styled-test', {
        headerStyle: {
          fontName: '微软雅黑',
          fontSize: 12,
          bold: true,
          bgColor: 'FFD9E1F2'
        }
      })

      expect(blob).toBeDefined()
      expect(blob.type).toContain('spreadsheetml')
    })

    it('should export with alternating row colors', async () => {
      const testData = Array.from({ length: 100 }, (_, i) => ({
        序号: i + 1,
        内容: `测试内容${i + 1}`
      }))

      const blob = await exportToExcelWithStyles(testData, 'alternating-test', {
        alternateRowColors: true,
        alternateRowColor: 'FFF2F2F2'
      })

      expect(blob).toBeDefined()
    })
  })

  describe('Large Data Export', () => {
    it('should export 10000 rows of test data', async () => {
      const testData = generateTestData(10000)
      
      const startTime = performance.now()
      const blob = await exportToExcel(testData, 'large-export')
      const endTime = performance.now()
      
      const duration = (endTime - startTime) / 1000

      expect(blob).toBeDefined()
      expect(blob.size).toBeGreaterThan(0)
      
      console.log(`Exported 10000 rows in ${duration.toFixed(2)} seconds`)
      
      expect(duration).toBeLessThan(5)
    }, 10000)

    it('should export 10000 rows with styles', async () => {
      const testData = generateTestData(10000)
      
      const startTime = performance.now()
      const blob = await exportToExcelWithStyles(testData, 'large-styled-export', {
        headerStyle: {
          fontName: '微软雅黑',
          bold: true,
          bgColor: 'FFD9E1F2'
        },
        alternateRowColors: true
      })
      const endTime = performance.now()
      
      const duration = (endTime - startTime) / 1000

      expect(blob).toBeDefined()
      
      console.log(`Exported 10000 styled rows in ${duration.toFixed(2)} seconds`)
      
      expect(duration).toBeLessThan(5)
    }, 10000)
  })

  describe('Edge Cases', () => {
    it('should handle special characters in data', async () => {
      const testData = [
        { 内容: '特殊字符: <>&"\\' },
        { 内容: '换行符:\n制表符:\t' },
        { 内容: '中文标点：，。、；：？！' }
      ]

      const blob = await exportToExcel(testData, 'special-chars-test')
      
      expect(blob).toBeDefined()
    })

    it('should handle very long text in cells', async () => {
      const testData = [
        { 内容: 'a'.repeat(50000) },
        { 内容: '中'.repeat(20000) },
        { 内容: '混合' + 'a'.repeat(30000) }
      ]

      const blob = await exportToExcel(testData, 'long-text-test')
      
      expect(blob).toBeDefined()
    })

    it('should handle null and undefined values', async () => {
      const testData = [
        { 有值: '数据', 空值: null, 未定义: undefined },
        { 有值: null, 空值: '', 未定义: '数据' }
      ]

      const blob = await exportToExcel(testData, 'null-test')
      
      expect(blob).toBeDefined()
    })
  })

  describe('Compatibility', () => {
    it('should provide compatibility information', () => {
      const result = validateExcelCompatibility()
      
      expect(result.isSupported !== undefined).toBe(true)
      expect(Array.isArray(result.suggestions)).toBe(true)
      
      console.log('Office compatibility:', result)
    })
  })
})
