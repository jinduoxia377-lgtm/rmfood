/**
 * NotFoundPage v2.1 — 嵌入 MainLayout 的 404 页面
 * 增强版：常用入口快捷卡片
 */
import { Link } from 'react-router-dom'
import { Home, ArrowLeft, FileQuestion, FlaskConical, TestTubes, Sparkles, Database } from 'lucide-react'
import { Button } from '@/components/ui'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-[var(--space-apple-lg)]">
      <div className="max-w-lg w-full text-center space-y-6 animate-fade-in">
        {/* 装饰 */}
        <div className="relative inline-block">
          <div className="text-[120px] sm:text-[150px] font-black text-neutral-200 dark:text-neutral-800 leading-none select-none">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-xl shadow-primary-500/20">
              <FileQuestion className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>

        {/* 文字 */}
        <div className="space-y-2">
          <h1 className="h1 text-[var(--text-primary)]">页面未找到</h1>
          <p className="text-[var(--text-muted)] text-sm leading-relaxed">
            你访问的页面不存在或已被移除。
            <br />请检查地址是否正确，或从下方快捷入口前往。
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-center gap-[var(--space-apple-sm)] pt-2">
          <Button
            variant="secondary"
            icon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => window.history.back()}
          >
            返回上页
          </Button>
          <Link to="/dashboard">
            <Button variant="primary" icon={<Home className="w-4 h-4" />}>
              回到工作台
            </Button>
          </Link>
        </div>

        {/* 常用入口 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-[var(--space-apple-sm)] max-w-sm mx-auto pt-2">
          {[
            { to: '/formulas', icon: FlaskConical, label: '配方', color: 'text-[var(--color-primary-text)]0 hover:bg-[var(--color-primary-container)] dark:hover:bg-[var(--color-primary-container)]/20' },
            { to: '/experiments', icon: TestTubes, label: '实验', color: 'text-[var(--color-accent-text)]0 hover:bg-[var(--color-accent-container)] dark:hover:bg-[var(--color-accent-container)]/20' },
            { to: '/ai', icon: Sparkles, label: 'AI', color: 'text-[var(--color-warning-text)]0 hover:bg-[var(--color-warning-container)] dark:hover:bg-[var(--color-warning-container)]/20' },
            { to: '/databases', icon: Database, label: '数据库', color: 'text-[var(--color-secondary-text)]0 hover:bg-[var(--color-secondary-container)] dark:hover:bg-[var(--color-secondary-container)]/20' },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-1.5 p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-md)] transition-colors ${item.color}`}
            >
              <item.icon size={18} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
