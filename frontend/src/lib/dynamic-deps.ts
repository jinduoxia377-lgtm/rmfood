/**
 * 重型依赖动态导入
 *
 * 按需加载重型库，减少初始 bundle 大小。
 * 使用方式:
 * const { BarChart, LineChart } = await loadRecharts()
 * const pdf = await loadJsPDF()
 */

/** Recharts 图表库 (按需加载) */
export const loadRecharts = () => import('recharts')

/** D3 可视化库 (按需加载) */
export const loadD3 = () => import('d3')

/** docx 文档生成 (按需加载) */
export const loadDocx = () => import('docx')

/** jsPDF PDF 生成 (按需加载) */
export const loadJsPDF = () => import('jspdf')

/** ExcelJS Excel 处理 (按需加载) */
export const loadExcelJS = () => import('exceljs')

/** html2canvas 截图 (按需加载) */
export const loadHtml2Canvas = () => import('html2canvas')

/**
 * 预加载指定依赖（在空闲时加载）
 */
export type HeavyDep ='recharts' |'d3' |'docx' |'jspdf' |'exceljs' |'html2canvas'

const loaders: Record<HeavyDep, () => Promise<any>> = {
 recharts: loadRecharts,
 d3: loadD3,
 docx: loadDocx,
 jspdf: loadJsPDF,
 exceljs: loadExcelJS,
 html2canvas: loadHtml2Canvas,
}

const loaded = new Set<string>()

export function preloadOnIdle(dep: HeavyDep): void {
 if (loaded.has(dep)) return
 if ('requestIdleCallback' in window) {
 requestIdleCallback(() => {
 loaders[dep]().then(() => loaded.add(dep))
 })
 } else {
 setTimeout(() => {
 loaders[dep]().then(() => loaded.add(dep))
 }, 1000)
 }
}

export function isDepLoaded(dep: HeavyDep): boolean {
 return loaded.has(dep)
}
