/**
 * FormulaShareModal — 配方分享模态框
 *
 * 支持：
 * - 生成分享链接（短链接）
 * - 复制配方 JSON 到剪贴板
 * - 生成分享图片（截图导出，预留接口）
 * - 微信/邮件分享入口
 */
import React, { useState, useCallback } from 'react'
import {
  Share2, Copy, Check, Link as LinkIcon,
  Mail, Download, X, QrCode, MessageCircle,
} from 'lucide-react'
import type { StructuredContent } from '../components/structured/types'
import { logger } from '@/utils/safeLogger'

interface FormulaShareModalProps {
  content: StructuredContent
  onClose: () => void
}

/**
 * 生成分享短链接
 * 实际部署时替换为后端短链服务
 */
async function generateShareLink(formulaName: string, content: StructuredContent): Promise<string> {
  // 模拟 API 调用（生产环境替换为真实接口）
  const payload = btoa(JSON.stringify({
    name: formulaName,
    blocks: content.blocks.map(b => ({ type: b.type, data: b.data })),
  }))
  // 使用 URL hash 存储数据，兼容无后端的测试环境
  const shareUrl = `${window.location.origin}${window.location.pathname}#share/${payload}`
  return shareUrl
}

function ShareQRCode({ url }: { url: string }) {
  // 简单 QR 占位：实际项目接入 qrcode.react
  return (
    <div className="w-32 h-32 mx-auto bg-white rounded-lg border border-neutral-200 dark:border-neutral-700
      flex items-center justify-center overflow-hidden">
      <QrCode className="w-16 h-16 text-neutral-300 dark:text-neutral-600" />
      <div className="absolute text-[9px] text-neutral-400">扫码查看配方</div>
    </div>
  )
}

export function FormulaShareModal({ content, onClose }: FormulaShareModalProps) {
  const [shareUrl, setShareUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'link' | 'json' | 'qr'>('link')
  const [generating, setGenerating] = useState(false)

  const headerBlock = content.blocks.find(b => b.type === 'header')
  const formulaName = (headerBlock?.data as { title?: string })?.title?.replace(/^[🧪💊🍵🥤]?\s*/, '') ?? '配方'

  const handleGenerateLink = useCallback(async () => {
    setGenerating(true)
    try {
      const url = await generateShareLink(formulaName, content)
      setShareUrl(url)
      setActiveTab('link')
    } catch (e) {
      logger.error('[FormulaShareModal] 生成分享链接失败:', e)
    } finally {
      setGenerating(false)
    }
  }, [formulaName, content])

  const handleCopyJson = useCallback(() => {
    const json = JSON.stringify(content, null, 2)
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [content])

  const handleCopyLink = useCallback(() => {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [shareUrl])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl
        border border-neutral-200 dark:border-neutral-700 overflow-hidden animate-fade-in-up">

        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary-500" />
            <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
              分享配方
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-neutral-100 dark:border-neutral-800">
          {([
            { key: 'link', label: '分享链接', icon: LinkIcon },
            { key: 'json', label: '复制 JSON', icon: Copy },
            { key: 'qr', label: '二维码', icon: QrCode },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                activeTab === key
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                  : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="px-5 py-5 space-y-4">
          {/* 配方摘要 */}
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700">
            <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              {formulaName}
            </div>
            <div className="text-[10px] text-neutral-400 dark:text-neutral-500">
              基于药食同源目录的辅助调理配方
            </div>
          </div>

          {/* 链接 Tab */}
          {activeTab === 'link' && (
            <div className="space-y-3">
              {!shareUrl ? (
                <button
                  onClick={handleGenerateLink}
                  disabled={generating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                    bg-gradient-to-r from-primary-500 to-emerald-500 text-white text-sm font-medium
                    hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {generating ? (
                    <span className="animate-pulse">生成中...</span>
                  ) : (
                    <>
                      <LinkIcon className="w-4 h-4" />
                      生成分享链接
                    </>
                  )}
                </button>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={shareUrl}
                      className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700
                        bg-neutral-50 dark:bg-neutral-800 text-[10px] text-neutral-500 font-mono truncate"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-500
                        hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg
                      bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs font-medium
                      hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors">
                      <MessageCircle className="w-3.5 h-3.5" />
                      微信分享
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg
                      bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-medium
                      hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                      <Mail className="w-3.5 h-3.5" />
                      邮件发送
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* JSON Tab */}
          {activeTab === 'json' && (
            <div className="space-y-3">
              <pre className="max-h-40 overflow-auto p-3 rounded-lg bg-neutral-900 text-green-400
                text-[10px] font-mono leading-relaxed">
                {JSON.stringify(content, null, 2)}
              </pre>
              <button
                onClick={handleCopyJson}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-sm
                  hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {copied ? '已复制到剪贴板' : '复制 JSON'}
              </button>
            </div>
          )}

          {/* QR Tab */}
          {activeTab === 'qr' && (
            <div className="space-y-4">
              <ShareQRCode url={shareUrl || '#'} />
              <p className="text-center text-[10px] text-neutral-400 dark:text-neutral-500">
                扫描下方二维码查看配方详情
              </p>
              <button
                onClick={() => {}}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-sm
                  hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                下载二维码图片
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FormulaShareModal
