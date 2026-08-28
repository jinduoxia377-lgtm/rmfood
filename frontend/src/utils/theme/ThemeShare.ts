/**
 * ThemeShare - 主题分享链接工具
 */
import type { ThemeStyles } from '@/types/theme-mode'

const MAX_URL_LENGTH = 2000

export interface ShareResult {
 url: string
 copied: boolean
 error?: string
}

export function encodeThemeToUrl(config: ThemeStyles): string {
 const json = JSON.stringify(config)
 const base64 = btoa(unescape(encodeURIComponent(json)))
 .replace(/\+/g, '-')
 .replace(/\//g, '_')
 .replace(/=/g, '')
 return base64
}

export function decodeThemeFromUrl(encoded: string): ThemeStyles | null {
 try {
 let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
 while (base64.length % 4) base64 += '='
 const json = decodeURIComponent(escape(atob(base64)))
 return JSON.parse(json) as ThemeStyles
 } catch {
 return null
 }
}

export function generateShareLink(config: ThemeStyles, baseUrl?: string): ShareResult {
 const base = baseUrl || window.location.href.split('?')[0]
 const encoded = encodeThemeToUrl(config)
 const separator = base.includes('?') ? '&' : '?'
 const url = base + separator + 'theme=' + encoded
 if (url.length > MAX_URL_LENGTH) {
 return { url: '', copied: false, error: '主题配置过大，请使用JSON文件导出' }
 }
 return { url, copied: false }
}

export function extractThemeFromUrl(): ThemeStyles | null {
 const params = new URLSearchParams(window.location.search)
 const encoded = params.get('theme')
 if (!encoded) return null
 return decodeThemeFromUrl(encoded)
}

export async function copyShareLink(url: string): Promise<boolean> {
 try {
 await navigator.clipboard.writeText(url)
 return true
 } catch {
 const ta = document.createElement('textarea')
 ta.value = url
 ta.style.position = 'fixed'
 ta.style.opacity = '0'
 document.body.appendChild(ta)
 ta.select()
 const ok = document.execCommand('copy')
 document.body.removeChild(ta)
 return ok
 }
}

export function decodeThemeFromLink(link: string): ThemeStyles | null {
 const match = link.match(/[?&]theme=([^&]+)/)
 if (!match) return null
 return decodeThemeFromUrl(match[1])
}
