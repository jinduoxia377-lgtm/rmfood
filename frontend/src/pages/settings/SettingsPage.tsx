/**
 * 设置页面 — v4.0 专业重构版
 *
 * 设计改进：
 *   - 左侧分组导航替代横排Tab，提升信息层级
 *   - 统一卡片头部规范（图标色块 + 标题 + 描述）
 *   - 替换自定义Toggle/Select为 shadcn Switch/Select 组件
 *   - 使用 Dialog 组件标准化模态框
 *   - API 密钥掩码展示，提升安全性与专业感
 *   - 通知设置合并为单一卡片，减少视觉碎片
 *   - 去除 emoji，统一专业语气
 */
import { useState, useEffect, useRef } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api/auth'
import { cn } from '@/lib/utils'
import {
  User, KeyRound, Shield, CheckCircle, AlertCircle,
  Mail, Bell, Clock, Smartphone,
  ChevronRight, ShieldAlert, RefreshCw, Key, Copy, Plus, Download, Upload,
  Globe, MapPin, CheckCircle2, Eye,
  QrCode, Info, ShieldCheck, Sun, Moon, BellRing,
  LogOut, SmartphoneIcon, Trash, Palette, Keyboard,
} from 'lucide-react'
import {
  Button, Input,
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Switch, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui'
import { Badge } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import {
  use2FAStatus, useEnable2FA, useDisable2FA, useVerify2FA,
  useDevices, useRemoveDevice,
  usePreferences, useUpdatePreferences,
  useExportData, useImportData,
  useLoginHistory, useClearUserData,
} from '@/hooks/useUserSettings'
import { useTheme, type ThemeMode } from '@/theme'
import { PersonalInfoSection } from './components/PersonalInfoSection'
import { ConfigManager } from '@/utils/configManager'
import type { ApiKey } from '@/utils/configManager'

// ─── 导航分组定义 ────────────────────────────────────────────────
type NavGroup = 'account' | 'security' | 'api' | 'data' | 'locale' | 'theme' | 'notifications'

const NAV_GROUPS: { id: NavGroup; label: string; icon: typeof User; desc: string }[] = [
  { id: 'account', label: '账户设置', icon: User, desc: '个人资料、密码修改' },
  { id: 'security', label: '安全中心', icon: Shield, desc: '两步验证、登录记录、设备管理' },
  { id: 'api', label: 'API 密钥', icon: Key, desc: '创建与管理 API 访问凭证' },
  { id: 'data', label: '数据管理', icon: Download, desc: '导入、导出与数据清理' },
  { id: 'locale', label: '语言与时区', icon: Globe, desc: '界面语言、时区与时间格式' },
  { id: 'theme', label: '外观主题', icon: Palette, desc: '明暗主题与视觉偏好' },
  { id: 'notifications', label: '通知设置', icon: Bell, desc: '消息推送渠道与频率偏好' },
]

// ─── 辅助：密码掩码显示 ──────────────────────────────────────────
const maskKey = (key: string, visible = false) => {
  if (visible || key.length <= 8) return key
  return `${key.slice(0, 8)}••••${key.slice(-4)}`
}

// ─── 辅助：日期格式化 ────────────────────────────────────────────
const fmtDate = (d: string | Date) => {
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function SettingsPage() {
  const { user, fetchUser } = useAuthStore()
  const { addToast } = useToast()

  // ─── Hooks ────────────────────────────────────────────────────
  const { data: twoFaStatus } = use2FAStatus()
  const enable2FAMutation = useEnable2FA()
  const disable2FAMutation = useDisable2FA()
  const verify2FAMutation = useVerify2FA()
  const { data: devicesData } = useDevices()
  const removeDeviceMutation = useRemoveDevice()
  const { data: prefsData } = usePreferences()
  const updatePrefsMutation = useUpdatePreferences()
  const exportDataMutation = useExportData()
  const importDataMutation = useImportData()
  const { data: loginHistoryData } = useLoginHistory()
  const clearDataMutation = useClearUserData()

  // ─── 主题模式 ─────────────────────────────────────────────────
  const { mode, setThemeMode } = useTheme()
  const setThemeModeLocal = (newMode: 'light' | 'dark') => setThemeMode(newMode as ThemeMode)

  // ─── 导航状态 ─────────────────────────────────────────────────
  const [activeNav, setActiveNav] = useState<NavGroup>('account')

  // ─── Profile state ────────────────────────────────────────────
  const [form, setForm] = useState({
    full_name: (user as unknown as Record<string, unknown>)?.full_name as string || '',
    email: user?.email || '',
    phone: user?.phone || '',
    department: user?.department || '',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // ─── Password state ───────────────────────────────────────────
  const [pw, setPw] = useState({ old_password: '', new_password: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak')

  // ─── Security state ───────────────────────────────────────────
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(!!twoFaStatus?.enabled)
  useEffect(() => { if (twoFaStatus) setTwoFactorEnabled(!!twoFaStatus.enabled) }, [twoFaStatus])
  const [show2FAModal, setShow2FAModal] = useState(false)
  const [loadingSecurity, setLoadingSecurity] = useState(false)
  const modal2FARef = useRef<HTMLDivElement>(null)
  useFocusTrap(modal2FARef, show2FAModal, () => setShow2FAModal(false))

  // ─── Device & Login state ─────────────────────────────────────
  const [devices] = useState(devicesData?.devices || [
    { id: 1, name: '当前设备', type: 'Windows 11', lastActive: new Date(), current: true },
  ])
  const [loginHistory] = useState(loginHistoryData?.history || [
    { id: 1, device: '当前会话', browser: 'Chrome on Windows', ip: '192.168.1.100', location: '厦门', time: new Date(), current: true },
  ])

  // ─── API Keys state ───────────────────────────────────────────
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [isCreatingKey, setIsCreatingKey] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(['read', 'write'])
  const [expirationDays, setExpirationDays] = useState(30)
  const [revealKeyIds, setRevealKeyIds] = useState<Set<string>>(new Set())
  const createKeyDialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(createKeyDialogRef, isCreatingKey, () => setIsCreatingKey(false))

  useEffect(() => { loadApiKeys() }, [])
  const loadApiKeys = () => setApiKeys(ConfigManager.getApiKeys())

  // ─── Data Management state ────────────────────────────────────
  const [exportOptions, setExportOptions] = useState({
    profile: true, formulas: true, experiments: false, preferences: false,
    format: 'json' as 'json' | 'csv' | 'excel',
  })
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearConfirmText, setClearConfirmText] = useState('')
  const [loadingData, setLoadingData] = useState(false)
  const clearConfirmRef = useRef<HTMLDivElement>(null)
  useFocusTrap(clearConfirmRef, showClearConfirm, () => setShowClearConfirm(false))

  // ─── Locale state ─────────────────────────────────────────────
  const [selectedLanguage, setSelectedLanguage] = useState('zh-CN')
  const [selectedTimezone, setSelectedTimezone] = useState('Asia/Shanghai')
  const [loadingLocale, setLoadingLocale] = useState(false)

  // ─── Notification state ───────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState(() => {
    const saved = localStorage.getItem('notif-prefs')
    return saved ? JSON.parse(saved) : {
      formula_review: true, experiment_complete: true,
      ai_task_done: false, system_updates: false,
      email_notifications: false, browser_push: true,
      notification_frequency: 'realtime' as 'realtime' | 'daily' | 'weekly',
      notification_priority: 'high' as 'high' | 'medium' | 'low',
    }
  })

  // ─── Handlers ─────────────────────────────────────────────────

  const saveNotifPrefs = (prefs: typeof notifPrefs) => {
    setNotifPrefs(prefs)
    localStorage.setItem('notif-prefs', JSON.stringify(prefs))
    addToast({ type: 'success', message: '通知偏好已保存' })
  }

  const toggleNotifPref = (key: keyof typeof notifPrefs) => {
    saveNotifPrefs({ ...notifPrefs, [key]: !notifPrefs[key] })
  }

  const handleProfileSave = async () => {
    setSaving(true)
    setSaveMsg(null)
    try {
      await authApi.updateMe(form)
      await fetchUser()
      setSaveMsg({ type: 'success', msg: '个人信息已更新' })
      addToast({ type: 'success', message: '个人信息已更新' })
    } catch {
      setSaveMsg({ type: 'error', msg: '更新失败，请稍后重试' })
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    if (pw.new_password.length < 8) { setPwMsg({ type: 'error', msg: '新密码至少 8 位' }); return }
    if (passwordStrength === 'weak') { setPwMsg({ type: 'error', msg: '密码强度不足，请使用更复杂的密码' }); return }
    if (pw.new_password !== pw.confirm) { setPwMsg({ type: 'error', msg: '两次输入的新密码不一致' }); return }
    setPwSaving(true); setPwMsg(null)
    try {
      await authApi.changePassword(pw.old_password, pw.new_password)
      setPwMsg({ type: 'success', msg: '密码修改成功' })
      setPw({ old_password: '', new_password: '', confirm: '' })
      addToast({ type: 'success', message: '密码修改成功' })
    } catch {
      setPwMsg({ type: 'error', msg: '旧密码错误或修改失败' })
    } finally {
      setPwSaving(false)
    }
  }

  const checkPasswordStrength = (password: string) => {
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[a-z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    if (score <= 2) return 'weak'
    if (score <= 4) return 'medium'
    return 'strong'
  }

  useEffect(() => {
    if (pw.new_password) setPasswordStrength(checkPasswordStrength(pw.new_password))
    else setPasswordStrength('weak')
  }, [pw.new_password])

  const handleToggle2FA = async () => {
    if (!twoFactorEnabled) { setShow2FAModal(true) }
    else {
      setLoadingSecurity(true)
      try { await disable2FAMutation.mutateAsync(); setTwoFactorEnabled(false); addToast({ type: 'success', message: '两步验证已禁用' }) }
      catch (e: any) { addToast({ type: 'error', message: e?.response?.data?.detail || '操作失败' }) }
      finally { setLoadingSecurity(false) }
    }
  }

  const handleEnable2FA = async () => {
    setLoadingSecurity(true)
    try {
      await enable2FAMutation.mutateAsync()
      setTwoFactorEnabled(true); setShow2FAModal(false)
      addToast({ type: 'success', message: '两步验证已启用，请妥善保存备用验证码' })
    } catch (e: any) { addToast({ type: 'error', message: e?.response?.data?.detail || '启用失败' }) }
    finally { setLoadingSecurity(false) }
  }

  const handleRemoveDevice = async (deviceId: number) => {
    setLoadingSecurity(true)
    try {
      await removeDeviceMutation.mutateAsync(deviceId)
      addToast({ type: 'success', message: '设备已移除' })
    } catch (e: any) { addToast({ type: 'error', message: e?.response?.data?.detail || '移除失败' }) }
    finally { setLoadingSecurity(false) }
  }

  const handleLogoutSession = async () => {
    setLoadingSecurity(true)
    try {
      await new Promise(r => setTimeout(r, 600))
      addToast({ type: 'success', message: '会话已退出' })
    } catch { addToast({ type: 'error', message: '操作失败' }) }
    finally { setLoadingSecurity(false) }
  }

  const handleCreateApiKey = () => {
    if (!newKeyName.trim()) { addToast({ type: 'error', message: '请输入密钥名称' }); return }
    try {
      const newKey = ConfigManager.addApiKey({
        name: newKeyName,
        key: `sk_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`,
        status: 'active',
        expires_at: new Date(Date.now() + expirationDays * 86400000).toISOString(),
        permissions: newKeyPermissions,
      })
      setApiKeys(prev => [...prev, newKey])
      setNewKeyName(''); setNewKeyPermissions(['read', 'write']); setExpirationDays(30)
      setIsCreatingKey(false)
      addToast({ type: 'success', message: 'API密钥创建成功' })
    } catch { addToast({ type: 'error', message: '创建API密钥失败' }) }
  }

  const handleDeleteApiKey = (id: string) => {
    try {
      ConfigManager.deleteApiKey(id)
      setApiKeys(prev => prev.filter(k => k.id !== id))
      addToast({ type: 'success', message: 'API密钥删除成功' })
    } catch { addToast({ type: 'error', message: '删除API密钥失败' }) }
  }

  const handleCopyApiKey = (key: string) => {
    navigator.clipboard.writeText(key)
    addToast({ type: 'success', message: 'API密钥已复制到剪贴板' })
  }

  const toggleRevealKey = (id: string) => {
    setRevealKeyIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleExportData = async () => {
    setLoadingData(true)
    try {
      const blob = await exportDataMutation.mutateAsync()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `rmfood_export_${new Date().toISOString().split('T')[0]}.zip`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      addToast({ type: 'success', message: '数据导出成功' })
    } catch (e: any) { addToast({ type: 'error', message: e?.response?.data?.detail || '导出失败' }) }
    finally { setLoadingData(false) }
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) processImportFile(files[0])
  }
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) processImportFile(e.target.files[0])
  }
  const processImportFile = (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!['.json', '.csv', '.xls', '.xlsx'].includes(ext)) {
      addToast({ type: 'error', message: '不支持的文件格式，请选择 JSON, CSV 或 Excel 文件' }); return
    }
    if (file.size > 10 * 1024 * 1024) {
      addToast({ type: 'error', message: '文件过大，最大支持 10MB' }); return
    }
    setImportFile(file)
    addToast({ type: 'info', message: `已选择: ${file.name} (${(file.size / 1024).toFixed(1)} KB)` })
  }

  const handleImportData = async () => {
    if (!importFile) { addToast({ type: 'error', message: '请先选择要导入的文件' }); return }
    setLoadingData(true)
    try {
      await importDataMutation.mutateAsync(importFile)
      setImportFile(null)
      addToast({ type: 'success', message: '数据导入成功！页面将刷新以应用更改...' })
      setTimeout(() => window.location.reload(), 1500)
    } catch { addToast({ type: 'error', message: '导入过程出错，请重试' }) }
    finally { setLoadingData(false) }
  }

  const handleClearAllData = async () => {
    setLoadingData(true)
    try {
      await clearDataMutation.mutateAsync('CLEAR ALL')
      setShowClearConfirm(false)
      addToast({ type: 'success', message: '所有数据已清除' })
    } catch (e: any) { addToast({ type: 'error', message: e?.response?.data?.detail || '操作失败' }) }
    finally { setLoadingData(false) }
  }

  const handleLanguageChange = async (lang: string) => {
    setLoadingLocale(true)
    try {
      setSelectedLanguage(lang)
      await updatePrefsMutation.mutateAsync({ language: lang, timezone: selectedTimezone })
      addToast({ type: 'success', message: `语言已切换` })
    } catch (e: any) { addToast({ type: 'error', message: '切换失败' }) }
    finally { setLoadingLocale(false) }
  }

  const handleTimezoneChange = async (tz: string) => {
    setLoadingLocale(true)
    try {
      setSelectedTimezone(tz)
      await updatePrefsMutation.mutateAsync({ language: selectedLanguage, timezone: tz })
      addToast({ type: 'success', message: '时区已更新' })
    } catch (e: any) { addToast({ type: 'error', message: '更新失败' }) }
    finally { setLoadingLocale(false) }
  }

  // ─── 渲染：导航侧栏 ───────────────────────────────────────────
  const renderNavSidebar = () => (
    <aside className="w-56 shrink-0 hidden md:block">
      <nav className="space-y-1" aria-label="设置导航">
        {NAV_GROUPS.map(({ id, label, icon: Icon, desc }) => {
          const isActive = activeNav === id
          return (
            <button
              key={id}
              onClick={() => setActiveNav(id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150',
                isActive
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 hover:text-neutral-900 dark:hover:text-neutral-200',
              )}
              aria-current={isActive ? 'true' : undefined}
            >
              <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-400 dark:text-neutral-500')} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{label}</div>
                <div className={cn('text-xs truncate', isActive ? 'text-primary-500/70 dark:text-primary-400/70' : 'text-neutral-400 dark:text-neutral-500')}>{desc}</div>
              </div>
              {isActive && <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-60" />}
            </button>
          )
        })}
      </nav>

      {/* 快捷入口 */}
      <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-700/60">
        <p className="px-3 text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2">快捷操作</p>
        <div className="space-y-1">
          <Button
            variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 text-xs"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => setActiveNav('data')}
          >
            导出所有数据
          </Button>
          <Button
            variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            icon={<ShieldAlert className="w-3.5 h-3.5" />}
            onClick={() => setActiveNav('security')}
          >
            安全诊断
          </Button>
        </div>
      </div>
    </aside>
  )

  // ─── 渲染：账户设置面板 ───────────────────────────────────────
  const renderAccountPanel = () => (
    <div className="space-y-5">
      {/* 个人资料 */}
      <PersonalInfoSection />

      {/* 密码修改 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
              <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-500" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">修改密码</CardTitle>
              <CardDescription>定期更换密码有助于保护账户安全</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 max-w-sm">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">当前密码</label>
            <Input type="password" value={pw.old_password}
              onChange={e => setPw(p => ({ ...p, old_password: e.target.value }))}
              placeholder="请输入当前密码" prefix={<KeyRound className="w-4 h-4 text-neutral-400" />} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">新密码</label>
            <Input type="password" value={pw.new_password}
              onChange={e => setPw(p => ({ ...p, new_password: e.target.value }))}
              placeholder="至少 8 位，包含大小写字母、数字和特殊字符" prefix={<KeyRound className="w-4 h-4 text-neutral-400" />} />
            {pw.new_password && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-neutral-500">密码强度</span>
                  <span className={cn('text-xs font-medium',
                    passwordStrength === 'weak' ? 'text-rose-500' :
                    passwordStrength === 'medium' ? 'text-amber-500' : 'text-emerald-500')}
                  >
                    {passwordStrength === 'weak' ? '弱' : passwordStrength === 'medium' ? '中等' : '强'}
                  </span>
                </div>
                <div className="h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all duration-300',
                    passwordStrength === 'weak' ? 'bg-rose-500 w-1/3' :
                    passwordStrength === 'medium' ? 'bg-amber-500 w-2/3' : 'bg-emerald-500 w-full')} />
                </div>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">确认新密码</label>
            <Input type="password" value={pw.confirm}
              onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
              placeholder="再次输入新密码" prefix={<KeyRound className="w-4 h-4 text-neutral-400" />} />
          </div>
          {pwMsg && (
            <div className={cn('flex items-center gap-2 text-sm px-3 py-2 rounded-lg',
              pwMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400')}>
              {pwMsg.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {pwMsg.msg}
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end pt-0">
          <Button variant="amber" loading={pwSaving} disabled={!pw.old_password || !pw.new_password}
            icon={<KeyRound className="w-4 h-4" />} onClick={handlePasswordChange}>
            更新密码
          </Button>
        </CardFooter>
      </Card>
    </div>
  )

  // ─── 渲染：安全中心面板 ───────────────────────────────────────
  const renderSecurityPanel = () => (
    <div className="space-y-5">
      {/* 两步验证 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
              </div>
              <div>
                <CardTitle as="h2" className="text-base font-semibold tracking-tight">两步验证</CardTitle>
                <CardDescription>{twoFactorEnabled ? '已启用 · 登录时需要额外验证' : '尚未启用 · 建议开启以提升账户安全'}</CardDescription>
              </div>
            </div>
            <Switch
              checked={twoFactorEnabled}
              onCheckedChange={handleToggle2FA}
              disabled={loadingSecurity}
              label={twoFactorEnabled ? '已启用' : '未启用'}
            />
          </div>
        </CardHeader>
        {twoFactorEnabled && (
          <CardContent>
            <div className="flex items-start gap-3 p-3.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-500 mt-0.5 shrink-0" />
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                两步验证已生效。每次登录需输入密码及手机验证码，有效防止未经授权的访问。
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 登录历史 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <CardTitle as="h2" className="text-base font-semibold tracking-tight">登录历史</CardTitle>
                <CardDescription>最近的登录会话记录</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => addToast({ type: 'info', message: '列表已刷新' })}>
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2" role="list">
            {loginHistory.map((session: any) => (
              <div key={String(session.id)} role="listitem"
                className={cn('flex items-center justify-between p-3 rounded-lg border transition-colors',
                  session.current
                    ? 'border-primary-200 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/10'
                    : 'border-neutral-200 dark:border-neutral-700/60 hover:bg-neutral-50 dark:hover:bg-neutral-800/40')}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                    session.current ? 'bg-primary-100 dark:bg-primary-800/40' : 'bg-neutral-100 dark:bg-neutral-700/60')}>
                    <Smartphone className={cn('w-4 h-4', session.current ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-500')} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{session.device}</span>
                      {session.current && <Badge variant="success" size="sm">当前</Badge>}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {session.browser} · {session.ip} · {session.location}
                    </p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                      {new Date(session.time).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
                {!session.current && (
                  <Button variant="ghost" size="sm" className="text-neutral-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 h-7 text-xs"
                    disabled={loadingSecurity} onClick={() => handleLogoutSession()}>
                    <LogOut className="w-3.5 h-3.5 mr-1" />
                    退出
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 设备管理 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center shrink-0">
              <SmartphoneIcon className="w-4 h-4 text-violet-600 dark:text-violet-500" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">设备管理</CardTitle>
              <CardDescription>已在用的登录设备</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2" role="list">
            {devices.map((device: any) => (
              <div key={String(device.id)} role="listitem"
                className={cn('flex items-center justify-between p-3 rounded-lg border transition-colors',
                  device.current
                    ? 'border-primary-200 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/10'
                    : 'border-neutral-200 dark:border-neutral-700/60 hover:bg-neutral-50 dark:hover:bg-neutral-800/40')}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                    device.current ? 'bg-primary-100 dark:bg-primary-800/40' : 'bg-neutral-100 dark:bg-neutral-700/60')}>
                    <Smartphone className={cn('w-4 h-4', device.current ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-500')} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{device.name}</span>
                      {device.current && <Badge variant="success" size="sm">本机</Badge>}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{device.type}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                      上次活跃：{new Date(device.lastActive).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
                {!device.current && (
                  <Button variant="ghost" size="sm" className="text-neutral-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 h-7 text-xs"
                    disabled={loadingSecurity} onClick={() => handleRemoveDevice(Number(device.id))}>
                    <Trash className="w-3.5 h-3.5 mr-1" />
                    移除
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // ─── 渲染：API 密钥面板 ────────────────────────────────────────
  const renderApiPanel = () => (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                <Key className="w-4 h-4 text-indigo-600 dark:text-indigo-500" />
              </div>
              <div>
                <CardTitle as="h2" className="text-base font-semibold tracking-tight">API 密钥</CardTitle>
                <CardDescription>用于程序化访问系统的凭证</CardDescription>
              </div>
            </div>
            <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setIsCreatingKey(true)}>
              创建密钥
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3">
                <Key className="w-5 h-5 text-neutral-400" />
              </div>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">暂无 API 密钥</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">点击右上角按钮创建第一个密钥</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map(key => {
                const isRevealed = revealKeyIds.has(key.id)
                return (
                  <div key={key.id} className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700/60 bg-neutral-50/50 dark:bg-neutral-800/30">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{key.name}</span>
                          <Badge variant={key.status === 'active' ? 'success' : key.status === 'expiring' ? 'warning' : 'danger'} size="sm">
                            {key.status === 'active' ? '活跃' : key.status === 'expiring' ? '即将过期' : '已过期'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                          <span>创建于 {fmtDate(key.created_at)}</span>
                          <span>·</span>
                          <span>过期于 {fmtDate(key.expires_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title={isRevealed ? '隐藏密钥' : '显示密钥'} onClick={() => toggleRevealKey(key.id)}>
                          <Eye className={cn('w-3.5 h-3.5', isRevealed ? 'text-primary-500' : 'text-neutral-400')} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="复制密钥" onClick={() => handleCopyApiKey(key.key)}>
                          <Copy className="w-3.5 h-3.5 text-neutral-400" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30" title="删除密钥" onClick={() => handleDeleteApiKey(key.id)}>
                          <Trash className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className={cn('text-xs font-mono px-3 py-1.5 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 flex-1 truncate',
                        isRevealed ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-400 dark:text-neutral-500')}>
                        {maskKey(key.key, isRevealed)}
                      </code>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
        <CardFooter className="pt-0">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            <Info className="w-3 h-3 inline mr-1" />
            密钥仅在创建时完整展示一次，请妥善保存。建议使用独立的密钥管理工具。
          </p>
        </CardFooter>
      </Card>

      {/* 创建密钥 Dialog */}
      <Dialog open={isCreatingKey} onOpenChange={setIsCreatingKey}>
        <DialogContent ref={createKeyDialogRef} size="sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-500" />
              创建新 API 密钥
            </DialogTitle>
            <DialogDescription>为应用程序生成访问凭证</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">密钥名称</label>
              <Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="例如：生产环境、测试工具" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">过期天数</label>
              <Input type="number" min={1} max={365} value={expirationDays}
                onChange={e => setExpirationDays(parseInt(e.target.value) || 30)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">权限</label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newKeyPermissions.includes('read')}
                    onChange={e => setNewKeyPermissions(p => e.target.checked ? [...p, 'read'] : p.filter(x => x !== 'read'))}
                    className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500" />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">读取</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newKeyPermissions.includes('write')}
                    onChange={e => setNewKeyPermissions(p => e.target.checked ? [...p, 'write'] : p.filter(x => x !== 'write'))}
                    className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500" />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">写入</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreatingKey(false)}>取消</Button>
            <Button variant="primary" onClick={handleCreateApiKey} loading={false}>创建密钥</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

  // ─── 渲染：数据管理面板 ────────────────────────────────────────
  const renderDataPanel = () => (
    <div className="space-y-5">
      {/* 数据导出 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center shrink-0">
              <Download className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">数据导出</CardTitle>
              <CardDescription>将您的账户数据打包下载</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60">
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-3">选择导出数据范围</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: 'profile' as const, label: '个人资料', desc: '账号与个人信息' },
                { key: 'formulas' as const, label: '配方数据', desc: '所有配方及相关数据' },
                { key: 'experiments' as const, label: '实验数据', desc: '实验记录与结果' },
                { key: 'preferences' as const, label: '偏好设置', desc: '界面与通知配置' },
              ]).map(item => (
                <label key={item.key}
                  className={cn('flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    exportOptions[item.key]
                      ? 'border-primary-300 dark:border-primary-700 bg-primary-50/60 dark:bg-primary-900/20'
                      : 'border-neutral-200 dark:border-neutral-700/60 hover:border-neutral-300 dark:hover:border-neutral-600')}>
                  <input type="checkbox" checked={exportOptions[item.key]}
                    onChange={e => setExportOptions(p => ({ ...p, [item.key]: e.target.checked }))}
                    className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500" />
                  <div>
                    <p className={cn('text-sm font-medium', exportOptions[item.key] ? 'text-primary-800 dark:text-primary-300' : 'text-neutral-700 dark:text-neutral-300')}>{item.label}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">{item.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">导出格式</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="导出格式">
              {(['json', 'csv', 'excel'] as const).map(format => (
                <button key={format} onClick={() => setExportOptions(p => ({ ...p, format }))}
                  role="radio" aria-checked={exportOptions.format === format}
                  className={cn('p-3 rounded-lg border text-center transition-all',
                    exportOptions.format === format
                      ? 'border-primary-400 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-neutral-200 dark:border-neutral-700/60 hover:border-neutral-300 dark:hover:border-neutral-600')}>
                  <p className={cn('text-sm font-medium', exportOptions.format === format ? 'text-primary-700 dark:text-primary-400' : 'text-neutral-700 dark:text-neutral-300')}>
                    {format === 'json' ? 'JSON' : format === 'csv' ? 'CSV' : 'Excel'}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">{format === 'json' ? '结构化数据' : format === 'csv' ? '表格格式' : '电子表格'}</p>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end pt-0">
          <Button variant="primary" icon={<Download className="w-4 h-4" />} loading={loadingData}
            disabled={loadingData || (!exportOptions.profile && !exportOptions.formulas && !exportOptions.experiments && !exportOptions.preferences)}
            onClick={handleExportData}>
            {loadingData ? '导出中...' : '导出数据'}
          </Button>
        </CardFooter>
      </Card>

      {/* 数据导入 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">数据导入</CardTitle>
              <CardDescription>从备份文件或他处导入数据</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={cn('relative p-6 border-2 border-dashed rounded-xl text-center transition-all cursor-pointer',
              isDragging ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'border-neutral-300 dark:border-neutral-600 hover:border-primary-300 dark:hover:border-primary-700')}
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            onClick={() => document.getElementById('import-file-input')?.click()}
            role="button" tabIndex={0} aria-label="拖放文件或点击选择导入文件"
            onKeyDown={e => e.key === 'Enter' && document.getElementById('import-file-input')?.click()}>
            <input id="import-file-input" type="file" accept=".json,.csv,.xls,.xlsx"
              onChange={handleFileSelect} className="hidden" aria-hidden="true" />
            {importFile ? (
              <div>
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{importFile.name}</p>
                <p className="text-xs text-neutral-500 mt-1">{(importFile.size / 1024).toFixed(1)} KB</p>
                <Button variant="ghost" size="sm" className="mt-3 text-xs"
                  onClick={e => { e.stopPropagation(); setImportFile(null) }}>更换文件</Button>
              </div>
            ) : (
              <div>
                <Upload className="w-8 h-8 text-neutral-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">拖放文件到此处</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">或点击选择文件</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">支持 JSON、CSV、Excel，最大 10MB</p>
              </div>
            )}
          </div>

          <div className="flex items-start gap-3 p-3.5 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-200 dark:border-amber-500/20">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              导入操作将覆盖现有数据，建议先导出当前数据作为备份。
            </p>
          </div>
        </CardContent>
        <CardFooter className="justify-end pt-0">
          <Button variant="primary" icon={<Upload className="w-4 h-4" />} loading={loadingData}
            disabled={loadingData || !importFile} onClick={handleImportData}>
            {loadingData ? '导入中...' : '导入数据'}
          </Button>
        </CardFooter>
      </Card>

      {/* 数据清除 */}
      <Card className="border-rose-200 dark:border-rose-800/40">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-500" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight text-rose-800 dark:text-rose-300">危险操作区</CardTitle>
              <CardDescription className="text-rose-600/70 dark:text-rose-400/70">以下操作不可撤销，请谨慎执行</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-rose-800 dark:text-rose-300 mb-1">清除所有账户数据</p>
                <p className="text-xs text-rose-700/80 dark:text-rose-400/80 leading-relaxed">
                  永久删除您的全部配方、实验记录、个人资料及界面配置，此操作无法恢复。
                </p>
              </div>
            </div>
            <Button variant="danger" size="sm" className="mt-4" icon={<Trash className="w-4 h-4" />}
              disabled={loadingData} onClick={() => setShowClearConfirm(true)}>
              清除所有数据
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // ─── 渲染：语言与时区面板 ─────────────────────────────────────
  const renderLocalePanel = () => (
    <div className="space-y-5">
      {/* 语言 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-sky-600 dark:text-sky-500" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">界面语言</CardTitle>
              <CardDescription>选择应用的显示语言</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
              { code: 'en-US', name: 'English', flag: '🇺🇸' },
              { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
            ]).map(lang => (
              <button key={lang.code} onClick={() => handleLanguageChange(lang.code)} disabled={loadingLocale}
                aria-checked={selectedLanguage === lang.code} role="radio"
                className={cn('flex items-center gap-3 p-4 rounded-lg border text-left transition-all',
                  selectedLanguage === lang.code
                    ? 'border-primary-400 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/20 shadow-sm'
                    : 'border-neutral-200 dark:border-neutral-700/60 hover:border-neutral-300 dark:hover:border-neutral-600')}>
                <span className="text-xl" aria-hidden="true">{lang.flag}</span>
                <span className={cn('text-sm font-medium', selectedLanguage === lang.code ? 'text-primary-700 dark:text-primary-400' : 'text-neutral-700 dark:text-neutral-300')}>
                  {lang.name}
                </span>
                {selectedLanguage === lang.code && <CheckCircle2 className="w-4 h-4 text-primary-500 ml-auto shrink-0" />}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            语言切换即时生效，部分翻译内容可能仍在完善中。
          </p>
        </CardContent>
      </Card>

      {/* 时区 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-violet-600 dark:text-violet-500" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">时区设置</CardTitle>
              <CardDescription>设置时间显示所使用的时区</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Select value={selectedTimezone} onValueChange={handleTimezoneChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择时区" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Shanghai">中国标准时间 (UTC+8)</SelectItem>
                  <SelectItem value="Asia/Tokyo">日本标准时间 (UTC+9)</SelectItem>
                  <SelectItem value="America/New_York">美国东部时间 (UTC-5)</SelectItem>
                  <SelectItem value="Europe/London">格林威治标准时间 (UTC+0)</SelectItem>
                  <SelectItem value="Europe/Berlin">欧洲中部时间 (UTC+1)</SelectItem>
                  <SelectItem value="Australia/Sydney">澳大利亚东部时间 (UTC+10)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700/60 shrink-0">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">当前时间</p>
              <p className="text-sm font-mono font-medium text-neutral-900 dark:text-neutral-100">
                {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 日期格式 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-700/50 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">日期时间格式</CardTitle>
              <CardDescription>自定义日期与时间的显示方式</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2.5">日期格式</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { format: 'YYYY-MM-DD', example: '2024-12-31' },
                { format: 'DD/MM/YYYY', example: '31/12/2024' },
                { format: 'MM/DD/YYYY', example: '12/31/2024' },
              ] as const).map(item => (
                <div key={item.format} className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-700/60 text-center hover:border-neutral-300 dark:hover:border-neutral-600 cursor-pointer transition-colors">
                  <p className="text-sm font-mono font-medium text-neutral-700 dark:text-neutral-300">{item.format}</p>
                  <p className="text-xs text-neutral-500 mt-1">{item.example}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2.5">时间格式</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { format: '24h' as const, example: '13:45', label: '24小时制' },
                { format: '12h' as const, example: '1:45 PM', label: '12小时制' },
              ]).map(item => (
                <div key={item.format} className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-700/60 text-center hover:border-neutral-300 dark:hover:border-neutral-600 cursor-pointer transition-colors">
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{item.label}</p>
                  <p className="text-xs text-neutral-500 mt-1 font-mono">{item.example}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // ─── 渲染：外观主题面板 ────────────────────────────────────────
  const renderThemePanel = () => (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center shrink-0">
              <Palette className="w-4 h-4 text-purple-600 dark:text-purple-500" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">外观主题</CardTitle>
              <CardDescription>选择浅色或深色主题，切换快捷键 Ctrl+Shift+T</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { mode: 'light' as const, icon: Sun, label: '浅色模式', desc: '明亮清爽，适合白天使用' },
              { mode: 'dark' as const, icon: Moon, label: '深色模式', desc: '护眼沉浸，适合夜间使用' },
            ].map(({ mode: m, icon: Icon, label, desc }) => (
              <button key={m} onClick={() => { setThemeModeLocal(m); addToast({ type: 'success', message: `已切换到${label}` }) }}
                className={cn('flex flex-col items-center p-6 rounded-xl border-2 transition-all duration-200 relative text-center',
                  mode === m
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-sm'
                    : 'border-neutral-200 dark:border-neutral-700/60 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-md')}
                aria-pressed={mode === m}>
                {mode === m && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center shadow">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div className={cn('w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors',
                  mode === m ? 'bg-primary-500 text-white' : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400')}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{label}</span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">{desc}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 快捷键提示 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-700/50 flex items-center justify-center shrink-0">
              <Keyboard className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">快捷键</CardTitle>
              <CardDescription>常用操作键盘快捷方式</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-neutral-50 dark:bg-neutral-800/40 rounded-lg">
            <div className="flex items-center gap-3 flex-wrap">
              {['Ctrl', 'Shift', 'T'].map((k, i) => (
                <div key={k} className="flex items-center gap-2">
                  {i > 0 && <span className="text-neutral-400 text-xs">+</span>}
                  <kbd className="px-2.5 py-1 bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-xs font-mono font-medium text-neutral-700 dark:text-neutral-300 shadow-sm">
                    {k}
                  </kbd>
                </div>
              ))}
              <span className="text-sm text-neutral-600 dark:text-neutral-400">快速切换明暗主题</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // ─── 渲染：通知设置面板 ────────────────────────────────────────
  const renderNotificationsPanel = () => (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
              <BellRing className="w-4 h-4 text-amber-600 dark:text-amber-500" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">通知偏好</CardTitle>
              <CardDescription>管理消息推送渠道与触发规则</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 事件通知 */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">触发事件</p>
            <div className="space-y-3">
              {([
                { key: 'formula_review' as const, label: '配方审核', desc: '配方提交审核、审核通过或驳回时' },
                { key: 'experiment_complete' as const, label: '实验完成', desc: '关联实验完成或失败时' },
                { key: 'ai_task_done' as const, label: 'AI 任务完成', desc: '配方生成、分析任务结束时' },
                { key: 'system_updates' as const, label: '系统更新', desc: '维护公告、版本发布等' },
              ]).map(item => (
                <div key={item.key} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-3">
                    <Bell className="w-4 h-4 text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{item.label}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{item.desc}</p>
                    </div>
                  </div>
                  <Switch checked={notifPrefs[item.key]} onCheckedChange={() => toggleNotifPref(item.key)} />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-neutral-200 dark:border-neutral-700/60 pt-5">
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">推送渠道</p>
            <div className="space-y-3">
              {([
                { key: 'browser_push' as const, label: '浏览器推送', desc: '在浏览器中接收实时通知', icon: BellRing },
                { key: 'email_notifications' as const, label: '邮件通知', desc: '将重要消息发送到邮箱', icon: Mail },
              ]).map(item => (
                <div key={item.key} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4 text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{item.label}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{item.desc}</p>
                    </div>
                  </div>
                  <Switch checked={notifPrefs[item.key]} onCheckedChange={() => toggleNotifPref(item.key)} />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-neutral-200 dark:border-neutral-700/60 pt-5">
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">频率与优先级</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">发送频率</p>
                <Select value={notifPrefs.notification_frequency} onValueChange={(v: any) => saveNotifPrefs({ ...notifPrefs, notification_frequency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">实时推送</SelectItem>
                    <SelectItem value="daily">每日摘要</SelectItem>
                    <SelectItem value="weekly">每周摘要</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">消息优先级</p>
                <Select value={notifPrefs.notification_priority} onValueChange={(v: any) => saveNotifPrefs({ ...notifPrefs, notification_priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">高 — 全部显示</SelectItem>
                    <SelectItem value="medium">中 — 仅重要消息</SelectItem>
                    <SelectItem value="low">低 — 仅紧急消息</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // ─── 渲染：2FA 启用 Dialog ─────────────────────────────────────
  const render2FADialog = () => (
    <Dialog open={show2FAModal} onOpenChange={setShow2FAModal}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            启用两步验证
          </DialogTitle>
          <DialogDescription>按以下步骤完成身份验证器绑定</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3.5 bg-sky-50 dark:bg-sky-500/10 rounded-lg border border-sky-200 dark:border-sky-500/20">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-sky-600 dark:text-sky-500 mt-0.5 shrink-0" />
              <ol className="text-sm text-sky-800 dark:text-sky-300 space-y-1 list-decimal list-inside">
                <li>下载验证器应用（Google Authenticator 或 Microsoft Authenticator）</li>
                <li>扫描下方二维码或手动输入密钥</li>
                <li>输入 6 位验证码完成绑定</li>
              </ol>
            </div>
          </div>

          <div className="flex justify-center p-5 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border-2 border-dashed border-neutral-200 dark:border-neutral-700">
            <div className="text-center">
              <QrCode className="w-24 h-24 mx-auto text-neutral-300 dark:text-neutral-600 mb-2" />
              <p className="text-xs text-neutral-500 dark:text-neutral-400">二维码区域（生产环境对接真实密钥）</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">备用密钥（请妥善保存）</p>
            <code className="block text-xs font-mono px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 select-all text-neutral-700 dark:text-neutral-300">
              ABCD-EFGH-IJKL-MNOP-QRST-UVWX
            </code>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShow2FAModal(false)} disabled={loadingSecurity}>取消</Button>
          <Button variant="primary" onClick={handleEnable2FA} loading={loadingSecurity} icon={<ShieldCheck className="w-4 h-4" />}>
            {loadingSecurity ? '启用中...' : '确认启用'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // ─── 渲染：清除数据确认 Dialog ─────────────────────────────────
  const renderClearConfirmDialog = () => (
    <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
            <ShieldAlert className="w-4 h-4" />
            确认清除所有数据？
          </DialogTitle>
          <DialogDescription>此操作不可撤销，请仔细阅读以下说明</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ul className="space-y-1.5 text-sm text-neutral-600 dark:text-neutral-400 list-disc list-inside">
            <li>所有配方数据和实验记录</li>
            <li>个人资料和账户设置</li>
            <li>界面偏好与通知配置</li>
            <li>API 密钥与访问令牌</li>
          </ul>
          <div className="p-3 bg-rose-50 dark:bg-rose-500/10 rounded-lg border border-rose-200 dark:border-rose-500/20">
            <p className="text-xs text-rose-700 dark:text-rose-400 mb-2">
              请输入 <strong className="font-mono">DELETE ALL</strong> 以确认：
            </p>
            <Input value={clearConfirmText} onChange={e => setClearConfirmText(e.target.value)}
              placeholder="输入 DELETE ALL 确认"
              className="font-mono text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShowClearConfirm(false)} disabled={loadingData}>取消</Button>
          <Button variant="danger" onClick={handleClearAllData} loading={loadingData}
            disabled={clearConfirmText !== 'DELETE ALL'} icon={<Trash className="w-4 h-4" />}>
            确认清除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // ─── 渲染：面板映射 ────────────────────────────────────────────
  const PANELS: Record<NavGroup, () => React.ReactNode> = {
    account: renderAccountPanel,
    security: renderSecurityPanel,
    api: renderApiPanel,
    data: renderDataPanel,
    locale: renderLocalePanel,
    theme: renderThemePanel,
    notifications: renderNotificationsPanel,
  }

  // ─── 主布局 ────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-page-enter">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">设置</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">管理账户信息、安全策略与个性化偏好</p>
        </div>
        {/* 移动端 Tab 切换 */}
        <div className="md:hidden">
          <Select value={activeNav} onValueChange={(v) => setActiveNav(v as NavGroup)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NAV_GROUPS.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 主体：侧边栏 + 内容 */}
      <div className="flex gap-6">
        {renderNavSidebar()}
        <main className="flex-1 min-w-0">
          {PANELS[activeNav]?.()}
        </main>
      </div>

      {render2FADialog()}
      {renderClearConfirmDialog()}
    </div>
  )
}
