/**
 * sourceDisplay 专有名称展示逻辑测试
 *
 * 覆盖三层展示策略：
 * 1. 后端 display_name 优先
 * 2. 本地 SEED_DISPLAY_NAMES 映射命中
 * 3. 友好化文件名兜底（去扩展名 / 分隔符转空格 / 英文单词首字母大写 / 中文原样）
 */
import { describe, it, expect } from 'vitest'
import {
  SEED_DISPLAY_NAMES,
  getSourceDisplayName,
  toFriendlyFileName,
} from '../sourceDisplay'

describe('getSourceDisplayName', () => {
  it('后端 display_name 非空时优先返回', () => {
    expect(getSourceDisplayName('food_homology_catalog.md', '后端权威名称')).toBe('后端权威名称')
    expect(getSourceDisplayName('unknown_file.txt', '自定义名称')).toBe('自定义名称')
  })

  it('display_name 为空白字符串时视为缺失，继续走本地映射', () => {
    expect(getSourceDisplayName('tcm_herb_encyclopedia.md', '')).toBe('药食同源药材百科（2024版）')
    expect(getSourceDisplayName('tcm_herb_encyclopedia.md', '   ')).toBe('药食同源药材百科（2024版）')
  })

  it('无 display_name 但命中 SEED_DISPLAY_NAMES 时返回专有名称', () => {
    expect(getSourceDisplayName('tcm_herb_encyclopedia.md')).toBe('药食同源药材百科（2024版）')
    expect(getSourceDisplayName('food_homology_catalog.md')).toBe('药食同源目录（2024版·106种）')
    expect(getSourceDisplayName('food_safety_regulations.md')).toBe('食品安全法规与标准汇编')
  })

  it('未命中映射时友好化文件名兜底（英文）', () => {
    // .txt 不在映射表（映射表键为 .md），应走友好化兜底
    expect(getSourceDisplayName('food_safety_regulations.txt')).toBe('Food Safety Regulations')
    expect(getSourceDisplayName('some_report.pdf')).toBe('Some Report')
    expect(getSourceDisplayName('unknown_doc.docx')).toBe('Unknown Doc')
  })

  it('未命中映射时友好化文件名兜底（中文原样）', () => {
    expect(getSourceDisplayName('药食同源目录.txt')).toBe('药食同源目录')
    expect(getSourceDisplayName('营养-成分_手册.pdf')).toBe('营养 成分 手册')
  })
})

describe('SEED_DISPLAY_NAMES', () => {
  it('内置三大权威种子文档映射齐全', () => {
    expect(SEED_DISPLAY_NAMES['tcm_herb_encyclopedia.md']).toBe('药食同源药材百科（2024版）')
    expect(SEED_DISPLAY_NAMES['food_homology_catalog.md']).toBe('药食同源目录（2024版·106种）')
    expect(SEED_DISPLAY_NAMES['food_safety_regulations.md']).toBe('食品安全法规与标准汇编')
  })
})

describe('toFriendlyFileName', () => {
  it('去除常见扩展名', () => {
    expect(toFriendlyFileName('food_homology_catalog.md')).toBe('Food Homology Catalog')
    expect(toFriendlyFileName('report.pdf')).toBe('Report')
    expect(toFriendlyFileName('notes.docx')).toBe('Notes')
  })

  it('下划线/连字符转空格并合并连续空白', () => {
    expect(toFriendlyFileName('herb_dose_limits.md')).toBe('Herb Dose Limits')
    expect(toFriendlyFileName('GB_2760-2024_标准.pdf')).toBe('GB 2760 2024 标准')
    expect(toFriendlyFileName('a--b__c.txt')).toBe('A B C')
  })

  it('空字符串原样返回', () => {
    expect(toFriendlyFileName('')).toBe('')
  })
})