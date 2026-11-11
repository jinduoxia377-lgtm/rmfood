/**
 * CSS 绫诲悕鍚堝苟宸ュ叿
 */
import { clsx, type ClassValue } from'clsx'
import { twMerge } from'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
 return twMerge(clsx(inputs))
}

// 鈹€鈹€ 瀹夊叏鏃ユ湡鏍煎紡鍖?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
/**
 * 瀹夊叏鍦板皢鏃ユ湡瀛楃涓叉牸寮忓寲涓轰腑鏂囨湰鍦板寲瀛楃涓层€?
 * 杈撳叆涓虹┖ / undefined / null / 闈炴硶鍊兼椂杩斿洖 "-"锛屼笉鎶涘嚭寮傚父銆?
 */
export function formatDate(
 dateInput: string | number | Date | null | undefined,
 locale = 'zh-CN',
 options?: Intl.DateTimeFormatOptions,
): string {
 if (dateInput == null) return '-'
 const d = new Date(dateInput)
 if (Number.isNaN(d.getTime())) return '-'
 try {
  return d.toLocaleString(locale, options)
 } catch {
  return String(dateInput)
 }
}

/**
 * 浠呮牸寮忓寲鏃ユ湡閮ㄥ垎锛堜笉鍚椂闂达級
 */
export function formatDateShort(
 dateInput: string | number | Date | null | undefined,
): string {
 return formatDate(dateInput, 'zh-CN', {
  year:'numeric',
  month:'2-digit',
  day:'2-digit',
 })
}

/**
 * 浠呮牸寮忓寲鏃堕棿閮ㄥ垎锛堜笉鍚棩鏈燂級
 */
export function formatTime(
 dateInput: string | number | Date | null | undefined,
): string {
 return formatDate(dateInput, 'zh-CN', {
  hour:'2-digit',
  minute:'2-digit',
 })
}
