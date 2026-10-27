import { describe, it, expect, beforeAll } from 'vitest'
import i18n from '../../../../../i18n'

const REQUIRED_KEYS = [
  'ai.knowledge.docPreview',
  'ai.knowledge.relevanceScore',
  'ai.knowledge.chars',
  'ai.knowledge.copied',
  'ai.knowledge.copyContent',
  'ai.knowledge.totalChunks',
  'ai.knowledge.systemStatus',
  'ai.knowledge.chunks',
  'ai.knowledge.noSearchResults',
  'ai.knowledge.nodes',
  'ai.knowledge.relatedChunks',
  'ai.knowledge.edgeRelations',
  'ai.markdown.toc',
  'ai.markdown.emptyData',
  'ai.markdown.collapse',
  'ai.markdown.expand',
  'ai.markdown.copyCode',
  'ai.markdown.copied',
  'ai.markdown.expandAll',
  'ai.markdown.formula',
  'ai.markdown.info',
  'ai.markdown.warning',
  'ai.markdown.success',
  'ai.markdown.error',
  'ai.markdown.tip',
  'ai.markdown.note',
  'ai.markdown.lines',
]

describe('RAG 新增翻译 key 三语完整性', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('zh-CN')
  })

  it('zh-CN 所有 key 均可解析且非 key 本身', () => {
    for (const key of REQUIRED_KEYS) {
      const value = i18n.t(key)
      expect(value, `zh-CN missing: ${key}`).not.toBe(key)
      expect(value, `zh-CN empty: ${key}`).not.toBe('')
    }
  })

  it('en-US 所有 key 均可解析且非 key 本身', async () => {
    await i18n.changeLanguage('en-US')
    for (const key of REQUIRED_KEYS) {
      const value = i18n.t(key)
      expect(value, `en-US missing: ${key}`).not.toBe(key)
      expect(value, `en-US empty: ${key}`).not.toBe('')
    }
  })

  it('de-DE 所有 key 均可解析且非 key 本身', async () => {
    await i18n.changeLanguage('de-DE')
    for (const key of REQUIRED_KEYS) {
      const value = i18n.t(key)
      expect(value, `de-DE missing: ${key}`).not.toBe(key)
      expect(value, `de-DE empty: ${key}`).not.toBe('')
    }
  })

  it('切换到中文后恢复默认语言', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('ai.markdown.toc')).toBe('目录')
    expect(i18n.t('ai.knowledge.docPreview')).toBe('文档预览')
  })
})