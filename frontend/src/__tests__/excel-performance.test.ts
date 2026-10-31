import { describe, it, expect, beforeAll } from 'vitest'
import {
  generateTestData,
  calculateStringWidth,
  calculateColumnWidths,
  prepareExcelCellValue,
  truncateText,
  sortByChinesePinyin,
  validateExcelCompatibility
} from '../utils/excelUtils'

describe('Excel Export Performance Tests', () => {
  const TEST_DATA_SIZES = [100, 1000, 5000, 10000]
  
  describe('String Width Calculation', () => {
    it('should calculate Chinese character width correctly', () => {
      expect(calculateStringWidth('测试')).toBe(4)
      expect(calculateStringWidth('中')).toBe(2)
      expect(calculateStringWidth('a')).toBe(1)
      expect(calculateStringWidth('ABC')).toBe(3)
      expect(calculateStringWidth('测试ABC')).toBe(7)
      expect(calculateStringWidth('')).toBe(0)
    })

    it('should handle mixed characters', () => {
      const result = calculateStringWidth('配方编号：RM001')
      expect(result).toBeGreaterThan(0)
      expect(result).toBeGreaterThanOrEqual('配方编号：RM001'.length)
      expect(result).toBeLessThanOrEqual('配方编号：RM001'.length * 2)
    })
  })

  describe('Column Width Calculation', () => {
    it('should calculate optimal column widths for Chinese data', () => {
      const headers = ['序号', '配方名称', '分类', '备注']
      const data = [
        { 序号: 1, 配方名称: '测试配方一', 分类: '主料', 备注: '中文测试备注' },
        { 序号: 2, 配方名称: '测试配方二', 分类: '辅料', 备注: '长备注信息测试' }
      ]

      const widths = calculateColumnWidths(headers, data, { mode: 'auto' })
      
      expect(widths).toHaveLength(4)
      widths.forEach(w => {
        expect(w.wch).toBeGreaterThanOrEqual(8)
        expect(w.wch).toBeLessThanOrEqual(50)
      })
    })

    it('should use fixed width mode', () => {
      const headers = ['A', 'B', 'C']
      const widths = calculateColumnWidths(headers, [], { mode: 'fixed' })
      
      expect(widths).toHaveLength(3)
      widths.forEach(w => {
        expect(w.wch).toBe(16)
      })
    })
  })

  describe('Text Truncation', () => {
    it('should truncate text exceeding max length', () => {
      const longText = 'a'.repeat(40000)
      const truncated = truncateText(longText, 32767)
      
      expect(truncated.length).toBeLessThanOrEqual(32767)
      expect(truncated.endsWith('...')).toBe(true)
    })

    it('should not truncate short text', () => {
      const shortText = '中文测试'
      const result = truncateText(shortText, 32767)
      
      expect(result).toBe(shortText)
    })
  })

  describe('Cell Value Preparation', () => {
    it('should handle null and undefined values', () => {
      expect(prepareExcelCellValue(null)).toBe('')
      expect(prepareExcelCellValue(undefined)).toBe('')
    })

    it('should convert objects to JSON string', () => {
      const obj = { name: 'test', value: 123 }
      const result = prepareExcelCellValue(obj)
      
      expect(typeof result).toBe('string')
      expect(result).toContain('test')
    })

    it('should truncate long strings', () => {
      const longString = '中文测试数据' + 'a'.repeat(40000)
      const result = prepareExcelCellValue(longString)
      
      expect(result.length).toBeLessThanOrEqual(32767)
    })
  })

  describe('Chinese Pinyin Sort', () => {
    it('should sort Chinese strings correctly', () => {
      const data = [
        { name: '张三' },
        { name: '李四' },
        { name: '王五' },
        { name: '赵六' }
      ]

      const sorted = sortByChinesePinyin(data, 'name')
      
      expect(sorted[0].name).toBe('李四')
      expect(sorted[1].name).toBe('王五')
      expect(sorted[2].name).toBe('张三')
      expect(sorted[3].name).toBe('赵六')
    })

    it('should handle mixed Chinese and English', () => {
      const data = [
        { name: '测试ABC' },
        { name: '测试XYZ' },
        { name: '测试123' }
      ]

      const sorted = sortByChinesePinyin(data, 'name')
      
      expect(sorted).toHaveLength(3)
    })
  })

  describe('Excel Compatibility Check', () => {
    it('should validate Excel compatibility', () => {
      const result = validateExcelCompatibility()
      
      expect(result).toHaveProperty('isSupported')
      expect(result).toHaveProperty('suggestions')
      expect(Array.isArray(result.suggestions)).toBe(true)
    })
  })

  describe('Performance Tests', () => {
    let testData: any[]

    beforeAll(() => {
      console.log('Generating test data...')
      const startTime = performance.now()
      testData = generateTestData(10000)
      const endTime = performance.now()
      console.log(`Test data generation took ${(endTime - startTime).toFixed(2)}ms`)
    })

    it('should generate 10000 rows of test data quickly', () => {
      const startTime = performance.now()
      const data = generateTestData(10000)
      const endTime = performance.now()
      const duration = endTime - startTime

      expect(data).toHaveLength(10000)
      expect(duration).toBeLessThan(1000)
      console.log(`Generated 10000 rows in ${duration.toFixed(2)}ms`)
    })

    it('should calculate column widths for 10000 rows efficiently', () => {
      const headers = ['序号', '样品名称', '分类', '剂量', '单位', '含量', '备注', '创建时间', '状态', '批次号']
      
      const startTime = performance.now()
      const widths = calculateColumnWidths(headers, testData, { mode: 'auto' })
      const endTime = performance.now()
      const duration = endTime - startTime

      expect(widths).toHaveLength(10)
      expect(duration).toBeLessThan(500)
      console.log(`Column width calculation for 10000 rows took ${duration.toFixed(2)}ms`)
    })

    it('should process cell values for 10000 rows efficiently', () => {
      const startTime = performance.now()
      const processedData = testData.map(row => ({
        ...row,
        备注: prepareExcelCellValue(row.备注),
        样品名称: prepareExcelCellValue(row.样品名称)
      }))
      const endTime = performance.now()
      const duration = endTime - startTime

      expect(processedData).toHaveLength(10000)
      expect(duration).toBeLessThan(1000)
      console.log(`Cell value processing for 10000 rows took ${duration.toFixed(2)}ms`)
    })

    it('should perform Chinese sorting on 1000 items efficiently', () => {
      const data = generateTestData(1000)
      
      const startTime = performance.now()
      const sorted = sortByChinesePinyin(data, '样品名称')
      const endTime = performance.now()
      const duration = endTime - startTime

      expect(sorted).toHaveLength(1000)
      expect(duration).toBeLessThan(1000)
      console.log(`Chinese sorting for 1000 items took ${duration.toFixed(2)}ms`)
    })
  })

  describe('Data Size Performance', () => {
    TEST_DATA_SIZES.forEach(size => {
      it(`should handle ${size} rows efficiently`, () => {
        const data = generateTestData(size)
        const headers = Object.keys(data[0])
        
        const startTime = performance.now()
        
        calculateColumnWidths(headers, data, { mode: 'auto' })
        
        data.forEach(row => {
          headers.forEach(header => {
            prepareExcelCellValue(row[header])
            calculateStringWidth(String(row[header]))
          })
        })
        
        const endTime = performance.now()
        const duration = endTime - startTime

        console.log(`Processing ${size} rows took ${duration.toFixed(2)}ms (${(size / (duration / 1000)).toFixed(0)} rows/sec)`)
        
        expect(duration).toBeLessThan(5000)
      })
    })
  })
})
