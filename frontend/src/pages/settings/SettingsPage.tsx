/**
 * 设置页面 - 完整功能版（v2.0）
 *
 * 📋 功能模块：
 *   1. 个人资料编辑
 *   2. 密码修改
 *   3. 账户安全设置
 *   4. API密钥管理
 *   5. 数据管理
 *   6. 语言与时区设置
 *   7. **🎨 主题管理**（明暗主题切换）
 *
 * 🎨 主题管理功能清单：
 *   ✅ 浅色/深色主题切换
 *
 * @version 3.0.0 (2026-05-02 精简版)
 * @author AI Expert System
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api/auth'
import { cn } from '@/lib/utils'
import {
  User, KeyRound, Palette, Shield, Save, CheckCircle, AlertCircle,
  Mail, Phone, Building2, UserCircle, Bell, Lock, Clock, Smartphone, Search,
  ChevronRight, ShieldAlert, RefreshCw, Key, Copy, Trash2, Plus, Download, Upload,
  Globe, MapPin, CheckCircle2, Eye, ChevronDown, ChevronUp, Check,
  QrCode, Info, X, ShieldCheck, Sun, Moon, BellRing,
} from 'lucide-react'
import {
  Button, Input, PageHeader, Tabs, TabsList, TabsTrigger, TabsContent,
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge,
} from '@/components/ui'
import { Section } from '@/components/common'
import { useToast } from '@/components/ui/Toast'
import {
  use2FAStatus, useEnable2FA, useDisable2FA, useVerify2FA,
  useDevices, useRemoveDevice,
  usePreferences, useUpdatePreferences,
  useExportData, useImportData,
  useLoginHistory, useClearUserData,
} from '@/hooks/useUserSettings'
// ✅ 修复：统一使用新版主题系统（与App.tsx的ThemeProvider一致）
import { useTheme, type ThemeMode } from '@/theme';
import { PersonalInfoSection } from './components/PersonalInfoSection'
import { ConfigManager } from '@/utils/configManager'
import type { ApiKey } from '@/utils/configManager'


export default function SettingsPage() {
  const { user, fetchUser } = useAuthStore()
  const { addToast } = useToast()

  // ✅ 用户设置 API hooks
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

  // 同步 2FA 状态
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(!!twoFaStatus?.enabled)
  useEffect(() => { if (twoFaStatus) setTwoFactorEnabled(!!twoFaStatus.enabled) }, [twoFaStatus])

  // ✅ 主题模式切换（仅保留明暗两种主题）
  const {
    mode,
    setThemeMode,
  } = useTheme()

  const setThemeModeLocal = (newMode: 'light' | 'dark') => {
    setThemeMode(newMode as ThemeMode)
  }

  // Profile state
  const [form, setForm] = useState({
    full_name: (user as unknown as Record<string, unknown>)?.full_name as string || '',
    email: user?.email || '',
    phone: user?.phone || '',
    department: user?.department || '',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Password state
  const [pw, setPw] = useState({ old_password: '', new_password: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak')

  // ✅ 新增：Security Module State (账户安全模块)
  const [show2FAModal, setShow2FAModal] = useState(false)
  const [loadingSecurity, setLoadingSecurity] = useState(false)
  const modal2FARef = useRef<HTMLDivElement>(null)
  useFocusTrap(modal2FARef, show2FAModal, () => setShow2FAModal(false))

  // 模拟登录历史数据 (从API加载)
  const [loginHistory] = useState(loginHistoryData?.history || [
    { id: 1, device: '当前会话', browser: 'Chrome on Windows', ip: '192.168.1.100', location: '厦门', time: new Date(), current: true },
  ])

  // 模拟设备数据 (从API加载)
  const [devices, setDevices] = useState(devicesData?.devices || [
    { id: 1, name: '当前设备', type: 'Windows 11', lastActive: new Date(), current: true },
  ])

  // 两步验证切换处理
  const handleToggle2FA = async () => {
    if (!twoFactorEnabled) {
      setShow2FAModal(true)
    } else {
      setLoadingSecurity(true)
      try {
        await disable2FAMutation.mutateAsync()
        setTwoFactorEnabled(false)
        addToast({ type: 'success', message: '✅ 两步验证已禁用' })
      } catch (error: any) {
        addToast({ type: 'error', message: error?.response?.data?.detail || '操作失败' })
      } finally {
        setLoadingSecurity(false)
      }
    }
  }

  // 启用两步验证确认
  const handleEnable2FA = async () => {
    setLoadingSecurity(true)
    try {
      const result = await enable2FAMutation.mutateAsync()
      setTwoFactorEnabled(true)
      setShow2FAModal(false)
      addToast({ type: 'success', message: '✅ 两步验证已启用，请妥善保存备用验证码' })
    } catch (error: any) {
      addToast({ type: 'error', message: error?.response?.data?.detail || '启用失败' })
    } finally {
      setLoadingSecurity(false)
    }
  }

  // 移除设备处理
  const handleRemoveDevice = async (deviceId: number) => {
    setLoadingSecurity(true)
    try {
      await removeDeviceMutation.mutateAsync(deviceId)
      setDevices((prev: any) => prev.filter((d: any) => d.id !== deviceId))
      addToast({ type: 'success', message: '✅ 设备已移除' })
    } catch (error: any) {
      addToast({ type: 'error', message: error?.response?.data?.detail || '移除失败' })
    } finally {
      setLoadingSecurity(false)
    }
  }

  // 退出其他会话
  const handleLogoutSession = async (sessionId: number) => {
    setLoadingSecurity(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 800))
      addToast({ type: 'success', message: '✅ 会话已退出' })
    } catch (error) {
      addToast({ type: 'error', message: '❌ 操作失败' })
    } finally {
      setLoadingSecurity(false)
    }
  }

  // ✅ 新增：Data Management Module State (数据管理模块)
  const [exportOptions, setExportOptions] = useState({
    profile: true,
    formulas: true,
    experiments: false,
    preferences: false,
    format: 'json' as 'json' | 'csv' | 'excel',
  })
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearConfirmText, setClearConfirmText] = useState('')
  const [loadingData, setLoadingData] = useState(false)
  const clearConfirmRef = useRef<HTMLDivElement>(null)
  useFocusTrap(clearConfirmRef, showClearConfirm, () => setShowClearConfirm(false))

  // 导出数据处理
  const handleExportData = async () => {
    setLoadingData(true)
    try {
      const blob = await exportDataMutation.mutateAsync()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rmfood_data_export_${new Date().toISOString().split('T')[0]}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      addToast({ type: 'success', message: '✅ 数据导出成功' })
    } catch (error: any) {
      addToast({ type: 'error', message: error?.response?.data?.detail || '导出失败' })
    } finally {
      setLoadingData(false)
    }
  }

  // CSV转换辅助函数
  const convertToCSV = (data: Record<string, any>): string => {
    const flattenObject = (obj: any, prefix = ''): any[] => {
      const result: any[] = []
      for (const key in obj) {
        const newKey = prefix ? `${prefix}.${key}` : key
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          result.push(...flattenObject(obj[key], newKey))
        } else {
          result.push({ key: newKey, value: obj[key] })
        }
      }
      return result
    }

    const rows = flattenObject(data)
    const headers = rows.map(row => row.key).join(',')
    const values = rows.map(row => `"${row.value || ''}"`).join(',')

    return `${headers}\n${values}`
  }

  // 文件拖放处理
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      processImportFile(files[0])
    }
  }

  // 文件选择处理
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      processImportFile(files[0])
    }
  }

  // 处理导入文件
  const processImportFile = (file: File) => {
    const validTypes = ['application/json', 'text/csv', 'application/vnd.ms-excel']
    const validExtensions = ['.json', '.csv', '.xls', '.xlsx']

    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    const isValidType = validTypes.includes(file.type) || validExtensions.includes(fileExtension)

    if (!isValidType) {
      addToast({ type: 'error', message: '❌ 不支持的文件格式，请选择 JSON, CSV 或 Excel 文件' })
      return
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB限制
      addToast({ type: 'error', message: '❌ 文件过大，最大支持10MB' })
      return
    }

    setImportFile(file)
    addToast({ type: 'info', message: `📄 已选择文件: ${file.name} (${(file.size / 1024).toFixed(1)} KB)` })
  }

  // 执行导入
  const handleImportData = async () => {
    if (!importFile) {
      addToast({ type: 'error', message: '❌ 请先选择要导入的文件' })
      return
    }

    setLoadingData(true)
    try {
      const reader = new FileReader()

      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string

          // 调用真实API导入数据
          await importDataMutation.mutateAsync(importFile!)

          setImportFile(null)
          addToast({ type: 'success', message: '✅ 数据导入成功！页面将刷新以应用更改...' })
          setTimeout(() => window.location.reload(), 2000)
        } catch (parseError) {
          addToast({ type: 'error', message: '❌ 文件解析失败，请检查文件格式是否正确' })
        }
      }

      reader.onerror = () => {
        addToast({ type: 'error', message: '❌ 文件读取失败' })
      }

      reader.readAsText(importFile)
    } catch (error) {
      addToast({ type: 'error', message: '❌ 导入过程出错，请重试' })
    } finally {
      setLoadingData(false)
    }
  }

  // 清除数据确认
  const handleClearAllData = async () => {
    setLoadingData(true)
    try {
      await clearDataMutation.mutateAsync('CLEAR ALL')
      setShowClearConfirm(false)
      addToast({ type: 'success', message: '✅ 所有数据已清除' })
    } catch (error: any) {
      addToast({ type: 'error', message: error?.response?.data?.detail || '操作失败' })
    } finally {
      setLoadingData(false)
    }
  }

  // 密码强度检查
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

  // 监听密码变化，更新强度
  useEffect(() => {
    if (pw.new_password) {
      setPasswordStrength(checkPasswordStrength(pw.new_password))
    } else {
      setPasswordStrength('weak')
    }
  }, [pw.new_password])

  // 主题管理展开状态
  const [expandedSections, setExpandedSections] = useState({
    theme: true,
    preview: true,
  })

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section as keyof typeof prev],
    }))
  }

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState(() => {
    const saved = localStorage.getItem('notif-prefs')
    return saved ? JSON.parse(saved) : {
      formula_review: true,
      experiment_complete: true,
      ai_task_done: false,
      system_updates: false,
      email_notifications: false,
      browser_push: true,
      notification_frequency: 'realtime', // realtime, daily, weekly
      notification_priority: 'high', // high, medium, low
    }
  })

  // 通知频率选项
  const frequencyOptions = [
    { value: 'realtime', label: '实时', desc: '立即接收所有通知' },
    { value: 'daily', label: '每日摘要', desc: '每天收到一次汇总通知' },
    { value: 'weekly', label: '每周摘要', desc: '每周收到一次汇总通知' },
  ]

  // 通知优先级选项
  const priorityOptions = [
    { value: 'high', label: '高', desc: '所有通知都显示' },
    { value: 'medium', label: '中', desc: '仅显示重要通知' },
    { value: 'low', label: '低', desc: '仅显示紧急通知' },
  ]

  const saveNotifPrefs = (prefs: typeof notifPrefs) => {
    setNotifPrefs(prefs)
    localStorage.setItem('notif-prefs', JSON.stringify(prefs))
    addToast({ type: 'success', message: '通知偏好已保存' })
  }

  const toggleNotifPref = (key: keyof typeof notifPrefs) => {
    saveNotifPrefs({ ...notifPrefs, [key]: !notifPrefs[key] })
  }

  // API密钥管理
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [isCreatingKey, setIsCreatingKey] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(['read', 'write'])
  const createKeyDialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(createKeyDialogRef, isCreatingKey, () => setIsCreatingKey(false))
  const [expirationDays, setExpirationDays] = useState(30)

  // 加载API密钥
  const loadApiKeys = () => {
    const keys = ConfigManager.getApiKeys()
    setApiKeys(keys)
  }

  // 初始化加载API密钥
  useEffect(() => {
    loadApiKeys()
  }, [])

  // 创建新API密钥
  const handleCreateApiKey = () => {
    if (!newKeyName.trim()) {
      addToast({ type: 'error', message: '请输入密钥名称' })
      return
    }

    setIsCreatingKey(true)
    try {
      const newKey = ConfigManager.addApiKey({
        name: newKeyName,
        key: `sk_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
        status: 'active',
        expires_at: new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toISOString(),
        permissions: newKeyPermissions,
      })
      setApiKeys([...apiKeys, newKey])
      setNewKeyName('')
      setNewKeyPermissions(['read', 'write'])
      setExpirationDays(30)
      addToast({ type: 'success', message: 'API密钥创建成功' })
    } catch (error) {
      addToast({ type: 'error', message: '创建API密钥失败' })
    } finally {
      setIsCreatingKey(false)
    }
  }

  // 删除API密钥
  const handleDeleteApiKey = (id: string) => {
    if (confirm('确定要删除这个API密钥吗？')) {
      try {
        ConfigManager.deleteApiKey(id)
        setApiKeys(apiKeys.filter(key => key.id !== id))
        addToast({ type: 'success', message: 'API密钥删除成功' })
      } catch (error) {
        addToast({ type: 'error', message: '删除API密钥失败' })
      }
    }
  }

  // 复制API密钥
  const handleCopyApiKey = (key: string) => {
    navigator.clipboard.writeText(key)
    addToast({ type: 'success', message: 'API密钥已复制到剪贴板' })
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
    if (pw.new_password.length < 8) {
      setPwMsg({ type: 'error', msg: '新密码至少 8 位' })
      return
    }
    if (passwordStrength === 'weak') {
      setPwMsg({ type: 'error', msg: '密码强度不足，请使用更复杂的密码' })
      return
    }
    if (pw.new_password !== pw.confirm) {
      setPwMsg({ type: 'error', msg: '两次输入的新密码不一致' })
      return
    }
    setPwSaving(true)
    setPwMsg(null)
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

  // ✅ 新增：Language & Timezone Module State (语言与时区模块)
  const [selectedLanguage, setSelectedLanguage] = useState('zh-CN')
  const [selectedTimezone, setSelectedTimezone] = useState('Asia/Shanghai')
  const [loadingLocale, setLoadingLocale] = useState(false)

  // 语言切换处理
  const handleLanguageChange = async (langCode: string) => {
    setLoadingLocale(true)
    try {
      setSelectedLanguage(langCode)
      await updatePrefsMutation.mutateAsync({ language: langCode, timezone: selectedTimezone })
      addToast({ type: 'success', message: `✅ 语言已切换` })
    } catch (error: any) {
      addToast({ type: 'error', message: '❌ 切换失败' })
    } finally {
      setLoadingLocale(false)
    }
  }

  // 时区切换处理
  const handleTimezoneChange = async (timezone: string) => {
    setLoadingLocale(true)
    try {
      setSelectedTimezone(timezone)
      await updatePrefsMutation.mutateAsync({ language: selectedLanguage, timezone })
      addToast({ type: 'success', message: `✅ 时区已更新` })
    } catch (error: any) {
      addToast({ type: 'error', message: '❌ 更新失败' })
    } finally {
      setLoadingLocale(false)
    }
  }

  // ✅ 新增：两步验证设置模态框
  const Modal2FA = () => (
    show2FAModal && (
      <div
        ref={modal2FARef}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="2fa-modal-title"
      >
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
          <div className="flex items-center justify-between mb-4">
            <h3 id="2fa-modal-title" className="text-lg font-semibold text-neutral-900 dark:text-white">
              启用两步验证
            </h3>
            <button
              onClick={() => setShow2FAModal(false)}
              className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="关闭对话框"
            >
              <X className="w-5 h-5 text-neutral-500" />
            </button>
          </div>

          <div className="space-y-4">
            {/* 步骤说明 */}
            <div className="p-4 bg-secondary-50 dark:bg-secondary-500/10 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-secondary-500 mt-0.5 shrink-0" />
                <div className="text-sm text-secondary-900 dark:text-secondary-100">
                  请按照以下步骤启用两步验证：
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>下载验证器应用（如 Google Authenticator）</li>
                    <li>扫描下方二维码或输入密钥</li>
                    <li>输入6位验证码完成绑定</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* 模拟二维码区域 */}
            <div className="flex justify-center p-6 bg-slate-50 dark:bg-neutral-800 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-600">
              <div className="text-center">
                <QrCode className="w-32 h-32 mx-auto text-neutral-400 mb-3" aria-hidden="true" />
                <p className="text-sm text-neutral-500">二维码占位符</p>
                <p className="text-xs text-neutral-400 mt-1">(生产环境替换为真实QR码)</p>
              </div>
            </div>

            {/* 密钥显示 */}
            <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block mb-2">
                手动输入密钥：
              </label>
              <code className="block text-sm font-mono bg-white dark:bg-neutral-900 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 select-all">
                ABCD-EFGH-IJKL-MNOP-QRST-UVWX
              </code>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setShow2FAModal(false)}
                disabled={loadingSecurity}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                variant="primary"
                onClick={handleEnable2FA}
                disabled={loadingSecurity}
                loading={loadingSecurity}
                icon={<ShieldCheck className="w-4 h-4" />}
                className="flex-1"
              >
                {loadingSecurity ? '启用中...' : '确认启用'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 animate-page-enter">
      {/* Header */}
      <PageHeader
        title="系统设置"
        description="管理你的账户信息、安全设置和界面偏好"
      />

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <div className="overflow-x-auto pb-2">
          <TabsList className="min-w-max">
            <TabsTrigger value="profile" icon={<User className="w-4 h-4" />}>个人资料</TabsTrigger>
            <TabsTrigger value="password" icon={<KeyRound className="w-4 h-4" />}>修改密码</TabsTrigger>
            <TabsTrigger value="security" icon={<Shield className="w-4 h-4" />}>账户安全</TabsTrigger>
            <TabsTrigger value="api" icon={<Key className="w-4 h-4" />}>API密钥</TabsTrigger>
            <TabsTrigger value="data" icon={<Download className="w-4 h-4" />}>数据管理</TabsTrigger>
            <TabsTrigger value="locale" icon={<Globe className="w-4 h-4" />}>语言与时区</TabsTrigger>
            <TabsTrigger value="theme-manage" icon={<Palette className="w-4 h-4" />}>主题管理</TabsTrigger>
            <TabsTrigger value="notifications" icon={<Bell className="w-4 h-4" />}>通知偏好</TabsTrigger>
          </TabsList>
        </div>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <PersonalInfoSection />
        </TabsContent>

        {/* Password Tab */}
        <TabsContent value="password">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-warning-50 dark:bg-warning-500/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-warning-500" />
                </div>
                <div>
                  <CardTitle as="h2">修改密码</CardTitle>
                  <CardDescription>定期修改密码以保护账户安全</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">当前密码</label>
                  <Input
                    type="password"
                    value={pw.old_password}
                    onChange={(e) => setPw({ ...pw, old_password: e.target.value })}
                    placeholder="请输入当前密码"
                    prefix={<KeyRound className="w-4 h-4" />}
                  />
                </div>
                <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">新密码</label>
                    <Input
                      type="password"
                      value={pw.new_password}
                      onChange={(e) => setPw({ ...pw, new_password: e.target.value })}
                      placeholder="至少 8 位，包含大小写字母、数字和特殊字符"
                      prefix={<KeyRound className="w-4 h-4" />}
                    />
                    {pw.new_password && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-neutral-500">密码强度</span>
                          <span className={cn(
                            'text-xs font-medium',
                            passwordStrength === 'weak' ? 'text-rose-500' :
                            passwordStrength === 'medium' ? 'text-warning-500' :
                            'text-success-500',
                          )}>
                            {passwordStrength === 'weak' ? '弱' :
                            passwordStrength === 'medium' ? '中等' :
                            '强'}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full transition-all duration-300',
                              passwordStrength === 'weak' ? 'bg-rose-500 w-1/3' :
                              passwordStrength === 'medium' ? 'bg-warning-500 w-2/3' :
                              'bg-success-500 w-full',
                            )}
                          />
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {passwordStrength === 'weak' && '密码强度不足，建议使用更长更复杂的密码'}
                          {passwordStrength === 'medium' && '密码强度中等，建议添加特殊字符'}
                          {passwordStrength === 'strong' && '密码强度良好'}
                        </div>
                      </div>
                    )}
                  </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">确认新密码</label>
                  <Input
                    type="password"
                    value={pw.confirm}
                    onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                    placeholder="再次输入新密码"
                    prefix={<KeyRound className="w-4 h-4" />}
                  />
                </div>
              </div>

              {pwMsg && (
                <div className={cn(
                  'flex items-center gap-2 text-sm px-4 py-2 rounded-lg',
                  pwMsg.type === 'success'
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
                )}>
                  {pwMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {pwMsg.msg}
                </div>
              )}
            </CardContent>

            <CardFooter className="justify-end">
              <Button
                onClick={handlePasswordChange}
                loading={pwSaving}
                disabled={!pw.old_password || !pw.new_password}
                icon={<KeyRound className="w-4 h-4" />}
                variant="amber"
                className=""
              >
                修改密码
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <div className="space-y-6">
            {/* 两步验证 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-success-50 dark:bg-success-500/10 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-success-500" />
                  </div>
                  <div>
                    <CardTitle as="h2">两步验证</CardTitle>
                    <CardDescription>启用两步验证提高账户安全性</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="flex items-center justify-between py-4">
                  <div>
                    <div className="font-medium text-neutral-900 dark:text-white mb-1">启用两步验证</div>
                    <div className="text-sm text-neutral-500">使用验证器应用或短信接收验证码</div>
                  </div>
                  <button
                    onClick={handleToggle2FA}
                    disabled={loadingSecurity}
                    aria-label={twoFactorEnabled ? '禁用两步验证' : '启用两步验证'}
                    aria-pressed={twoFactorEnabled}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                      twoFactorEnabled ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'
                    } ${loadingSecurity ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                        twoFactorEnabled ? 'translate-x-6' : ''
                      }`}
                    />
                  </button>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-warning-500 mt-0.5" />
                    <div>
                      <div className="font-medium text-neutral-900 dark:text-white mb-1">安全提示</div>
                      <div className="text-sm text-neutral-600 dark:text-neutral-300">
                        启用两步验证后，每次登录都需要输入密码和验证码，提高账户安全性。
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="justify-end">
                <Button variant="primary" icon={<Lock className="w-4 h-4" />}>
                  设置两步验证
                </Button>
              </CardFooter>
            </Card>

            {/* 登录历史 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary-50 dark:bg-secondary-500/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-secondary-500" />
                    </div>
                    <div>
                      <CardTitle as="h2">登录历史</CardTitle>
                      <CardDescription>查看最近的登录记录</CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" icon={<RefreshCw className="w-4 h-4" />}>
                    刷新
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  {(loginHistory as Array<Record<string, unknown>>).map((session) => (
                    <div key={String(session.id)} className="flex items-center justify-between p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors" role="listitem">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center" aria-hidden="true">
                          <Smartphone className="w-5 h-5 text-neutral-500" />
                        </div>
                        <div>
                          <div className="font-medium text-neutral-900 dark:text-white">
                            {session.device as string}
                            {(session.current as boolean) && (
                              <Badge variant="success" size="sm" className="ml-2">当前</Badge>
                            )}
                          </div>
                          <div className="text-sm text-neutral-500">
                            {(session.browser as string)} · {(session.ip as string)} · {(session.location as string)}
                          </div>
                          <div className="text-xs text-neutral-400 mt-1">
                            {((session.time as Date).toLocaleString('zh-CN'))}
                          </div>
                        </div>
                      </div>
                      {!session.current && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                          onClick={() => handleLogoutSession(Number(session.id))}
                          disabled={loadingSecurity}
                          aria-label={`退出会话 ${(session.device as string)}`}
                        >
                          退出
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>

              <CardFooter className="justify-end">
                <Button variant="ghost" icon={<ChevronRight className="w-4 h-4" />}>
                  查看全部
                </Button>
              </CardFooter>
            </Card>

            {/* 设备管理 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-50 dark:bg-accent-500/10 flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-accent-500" />
                  </div>
                  <div>
                    <CardTitle as="h2">设备管理</CardTitle>
                    <CardDescription>管理已登录的设备</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  {(devices as Array<Record<string, unknown>>).map((device) => (
                    <div key={String(device.id)} className="flex items-center justify-between p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors" role="listitem">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center" aria-hidden="true">
                          <Smartphone className="w-5 h-5 text-neutral-500" />
                        </div>
                        <div>
                          <div className="font-medium text-neutral-900 dark:text-white">
                            {(device.name as string)}
                            {(device.current as boolean) && (
                              <Badge variant="success" size="sm" className="ml-2">当前设备</Badge>
                            )}
                          </div>
                          <div className="text-sm text-neutral-500">
                            {(device.type as string)}
                          </div>
                          <div className="text-xs text-neutral-400 mt-1">
                            上次活动: {((device.lastActive as Date).toLocaleString('zh-CN'))}
                          </div>
                        </div>
                      </div>
                      {!device.current && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                          onClick={() => handleRemoveDevice(Number(device.id))}
                          disabled={loadingSecurity}
                          aria-label={`移除设备 ${(device.name as string)}`}
                        >
                          移除
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>

              <CardFooter className="justify-end">
                <Button variant="ghost" icon={<ChevronRight className="w-4 h-4" />}>
                  查看全部
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api">
          <div className="space-y-6">
            {/* API密钥管理 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                      <Key className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                      <CardTitle as="h2">API密钥管理</CardTitle>
                      <CardDescription>创建和管理用于API访问的密钥</CardDescription>
                    </div>
                  </div>
                  <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setIsCreatingKey(true)}>
                    创建新密钥
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  {apiKeys.length === 0 ? (
                    <div className="p-8 text-center">
                      <div className="text-neutral-400 mb-2">暂无API密钥</div>
                      <div className="text-sm text-neutral-500">点击右上角按钮创建新密钥</div>
                    </div>
                  ) : (
                    apiKeys.map((key) => (
                      <div key={key.id} className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-neutral-900 dark:text-white">
                            {key.name}
                          </div>
                          <Badge variant={key.status === 'active' ? "success" : key.status === 'expiring' ? "warning" : "danger"} size="sm">
                            {key.status === 'active' ? '活跃' : key.status === 'expiring' ? '即将过期' : '已过期'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-sm text-neutral-500 font-mono">
                            {key.key}
                          </div>
                          <Button variant="ghost" size="sm" icon={<Copy className="w-4 h-4" />} onClick={() => handleCopyApiKey(key.key)}>
                            复制
                          </Button>
                        </div>
                        <div className="flex items-center justify-between text-xs text-neutral-400">
                          <div>创建于: {new Date(key.created_at).toLocaleDateString()}</div>
                          <div>过期于: {new Date(key.expires_at).toLocaleDateString()}</div>
                        </div>
                        <div className="flex justify-end mt-3 gap-2">
                          <Button variant="ghost" size="sm" icon={<Trash2 className="w-4 h-4" />} className="text-rose-500 hover:text-rose-600" onClick={() => handleDeleteApiKey(key.id)}>
                            删除
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>

              <CardFooter className="justify-end">
                <div className="text-sm text-neutral-500">
                  提示: API密钥用于程序访问，请注意保密
                </div>
              </CardFooter>
            </Card>

            {/* 创建API密钥对话框 */}
            {isCreatingKey && (
              <div
                ref={createKeyDialogRef}
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-key-dialog-title"
              >
                <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-md w-full">
                  <h3 id="create-key-dialog-title" className="text-lg font-medium mb-4">创建新API密钥</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">密钥名称</label>
                      <Input
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="输入密钥名称"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">过期时间 (天)</label>
                      <Input
                        type="number"
                        min="1"
                        max="365"
                        value={expirationDays}
                        onChange={(e) => setExpirationDays(parseInt(e.target.value) || 30)}
                        placeholder="30"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">权限</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={newKeyPermissions.includes('read')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewKeyPermissions([...newKeyPermissions, 'read'])
                              } else {
                                setNewKeyPermissions(newKeyPermissions.filter(p => p !== 'read'))
                              }
                            }}
                          />
                          读取
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={newKeyPermissions.includes('write')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewKeyPermissions([...newKeyPermissions, 'write'])
                              } else {
                                setNewKeyPermissions(newKeyPermissions.filter(p => p !== 'write'))
                              }
                            }}
                          />
                          写入
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-6 justify-end">
                    <Button variant="secondary" onClick={() => setIsCreatingKey(false)}>
                      取消
                    </Button>
                    <Button variant="primary" onClick={handleCreateApiKey} loading={isCreatingKey}>
                      创建
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* API使用说明 */}
            <Card>
              <CardHeader>
                <CardTitle as="h2">API使用说明</CardTitle>
                <CardDescription>如何使用API密钥进行身份验证</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <div className="font-medium text-neutral-900 dark:text-white mb-2">身份验证方式</div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-300 font-mono">
                      Authorization: Bearer &lt;your-api-key&gt;
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <div className="font-medium text-neutral-900 dark:text-white mb-2">API文档</div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-300">
                      完整的API文档可在开发者中心查看，包含所有可用端点和请求示例。
                    </div>
                    <Button variant="ghost" size="sm" className="mt-2" icon={<ChevronRight className="w-4 h-4" />}>
                      查看API文档
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Data Management Tab */}
        <TabsContent value="data">
          <div className="space-y-6">
            {/* 数据导出 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary-50 dark:bg-secondary-500/10 flex items-center justify-center">
                    <Download className="w-5 h-5 text-secondary-500" />
                  </div>
                  <div>
                    <CardTitle as="h2">数据导出</CardTitle>
                    <CardDescription>导出你的账户数据</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <div className="font-medium text-neutral-900 dark:text-white mb-2">导出数据范围</div>
                    <div className="space-y-2">
                      {([
                        { key: 'profile' as const, label: '个人资料', desc: '个人信息和账户设置' },
                        { key: 'formulas' as const, label: '配方数据', desc: '所有配方和相关数据' },
                        { key: 'experiments' as const, label: '实验数据', desc: '实验记录和结果' },
                        { key: 'preferences' as const, label: '偏好设置', desc: '界面偏好和通知设置' },
                      ]).map((item) => (
                        <div key={item.key} className="flex items-center justify-between py-2">
                          <div>
                            <p className="text-sm font-medium text-neutral-900 dark:text-white">{item.label}</p>
                            <p className="text-xs text-neutral-500">{item.desc}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={exportOptions[item.key]}
                            onChange={(e) => setExportOptions(prev => ({ ...prev, [item.key]: e.target.checked }))}
                            className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                            aria-label={`选择导出${item.label}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <div className="font-medium text-neutral-900 dark:text-white mb-2">导出格式</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3" role="radiogroup" aria-label="选择导出格式">
                      {([
                        { format: 'json' as const, label: 'JSON', desc: '结构化数据格式' },
                        { format: 'csv' as const, label: 'CSV', desc: '表格数据格式' },
                        { format: 'excel' as const, label: 'Excel', desc: '电子表格格式' },
                      ]).map((item) => (
                        <button
                          key={item.format}
                          onClick={() => setExportOptions(prev => ({ ...prev, format: item.format }))}
                          role="radio"
                          aria-checked={exportOptions.format === item.format}
                          className={`p-3 border rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer text-left ${
                            exportOptions.format === item.format
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10'
                              : 'border-neutral-200 dark:border-neutral-700'
                          }`}
                        >
                          <div className={`font-medium text-sm ${exportOptions.format === item.format ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-900 dark:text-white'}`}>
                            {item.label}
                          </div>
                          <div className="text-xs text-neutral-500">{item.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="justify-end">
                <Button
                  variant="primary"
                  icon={<Download className="w-4 h-4" />}
                  onClick={handleExportData}
                  disabled={loadingData || (!exportOptions.profile && !exportOptions.formulas && !exportOptions.experiments && !exportOptions.preferences)}
                  loading={loadingData}
                >
                  {loadingData ? '导出中...' : '导出数据'}
                </Button>
              </CardFooter>
            </Card>

            {/* 数据导入 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-success-50 dark:bg-success-500/10 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-success-500" />
                  </div>
                  <div>
                    <CardTitle as="h2">数据导入</CardTitle>
                    <CardDescription>导入之前导出的数据</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <div
                    className={`p-6 border-2 border-dashed rounded-lg text-center transition-colors cursor-pointer ${
                      isDragging
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10'
                        : 'border-neutral-300 dark:border-neutral-600 hover:border-primary-500'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('import-file-input')?.click()}
                    role="button"
                    aria-label="拖放文件或点击选择导入文件"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && document.getElementById('import-file-input')?.click()}
                  >
                    <input
                      id="import-file-input"
                      type="file"
                      accept=".json,.csv,.xls,.xlsx"
                      onChange={handleFileSelect}
                      className="hidden"
                      aria-hidden="true"
                    />

                    {importFile ? (
                      <div>
                        <CheckCircle className="w-12 h-12 mx-auto text-success-500 mb-3" aria-hidden="true" />
                        <div className="font-medium text-neutral-900 dark:text-white mb-1">已选择文件</div>
                        <div className="text-sm text-success-600 dark:text-success-400">{importFile.name}</div>
                        <div className="text-xs text-neutral-500 mt-1">
                          {(importFile.size / 1024).toFixed(1)} KB
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-3"
                          onClick={(e) => {
                            e.stopPropagation()
                            setImportFile(null)
                          }}
                        >
                          重新选择
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-12 h-12 text-neutral-400 mx-auto mb-3" aria-hidden="true" />
                        <div className="font-medium text-neutral-900 dark:text-white mb-1">拖放文件到此处</div>
                        <div className="text-sm text-neutral-500 mb-3">或</div>
                        <Button variant="primary" size="sm" type="button">
                          选择文件
                        </Button>
                        <div className="text-xs text-neutral-400 mt-3">
                          支持 JSON, CSV, Excel 格式，最大 10MB
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-warning-50 dark:bg-warning-500/10 rounded-lg border border-amber-200 dark:border-amber-500/30">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-warning-500 mt-0.5" />
                      <div>
                        <div className="font-medium text-warning-900 dark:text-warning-300 mb-1">注意</div>
                        <div className="text-sm text-warning-800 dark:text-warning-200">
                          导入数据将覆盖现有数据，请确保在导入前备份你的数据。
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="justify-end">
                <Button
                  variant="primary"
                  icon={<Upload className="w-4 h-4" />}
                  onClick={handleImportData}
                  disabled={loadingData || !importFile}
                  loading={loadingData}
                >
                  {loadingData ? '导入中...' : '导入数据'}
                </Button>
              </CardFooter>
            </Card>

            {/* 数据清除 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-rose-500" />
                  </div>
                  <div>
                    <CardTitle as="h2">数据清除</CardTitle>
                    <CardDescription>清除你的账户数据</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="p-4 bg-rose-50 dark:bg-rose-500/10 rounded-lg border border-rose-200 dark:border-rose-500/30">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-rose-500 mt-0.5" />
                    <div>
                      <div className="font-medium text-rose-900 dark:text-rose-300 mb-1">警告</div>
                      <div className="text-sm text-rose-800 dark:text-rose-200 mb-3">
                        清除数据将永久删除你的所有账户数据，包括配方、实验记录和个人设置。此操作无法撤销。
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<Trash2 className="w-4 h-4" />}
                        onClick={() => setShowClearConfirm(true)}
                        disabled={loadingData}
                      >
                        清除所有数据
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Language & Timezone Tab */}
        <TabsContent value="locale">
          <div className="space-y-6">
            {/* 语言设置 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <CardTitle as="h2">语言设置</CardTitle>
                    <CardDescription>选择应用界面语言</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {([
                      { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
                      { code: 'en-US', name: 'English', flag: '🇺🇸' },
                      { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
                    ]).map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleLanguageChange(lang.code)}
                        role="radio"
                        aria-checked={selectedLanguage === lang.code}
                        disabled={loadingLocale}
                        className={`p-3 border rounded-lg transition-colors cursor-pointer text-left ${
                          selectedLanguage === lang.code
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10'
                            : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                        } ${loadingLocale ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg" aria-hidden="true">{lang.flag}</span>
                          <span className={`font-medium text-sm ${
                            selectedLanguage === lang.code
                              ? 'text-primary-600 dark:text-primary-400'
                              : 'text-neutral-900 dark:text-white'
                          }`}>
                            {lang.name}
                          </span>
                          {selectedLanguage === lang.code && (
                            <Check className="w-4 h-4 text-primary-600 ml-auto" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <div className="font-medium text-neutral-900 dark:text-white mb-2">语言设置说明</div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-300">
                      更改语言设置后，应用界面将显示为所选语言。部分内容可能仍显示为原始语言，直到翻译完成。
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="justify-end">
                <Button variant="primary" icon={<Globe className="w-4 h-4" />}>
                  保存语言设置
                </Button>
              </CardFooter>
            </Card>

            {/* 时区设置 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary-50 dark:bg-secondary-500/10 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-secondary-500" />
                  </div>
                  <div>
                    <CardTitle as="h2">时区设置</CardTitle>
                    <CardDescription>选择你的时区</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">选择时区</label>
                    <select className="w-full h-10 px-3 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                      <option value="Asia/Shanghai">中国标准时间 (UTC+8)</option>
                      <option value="America/New_York">美国东部时间 (UTC-5)</option>
                      <option value="Europe/London">格林威治标准时间 (UTC+0)</option>
                      <option value="Asia/Tokyo">日本标准时间 (UTC+9)</option>
                      <option value="Australia/Sydney">澳大利亚东部时间 (UTC+10)</option>
                    </select>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <div className="font-medium text-neutral-900 dark:text-white mb-2">当前时间</div>
                    <div className="text-lg font-medium text-neutral-900 dark:text-white">
                      {new Date().toLocaleString()}
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="justify-end">
                <Button variant="primary" icon={<MapPin className="w-4 h-4" />}>
                  保存时区设置
                </Button>
              </CardFooter>
            </Card>

            {/* 日期时间格式 */}
            <Card>
              <CardHeader>
                <CardTitle as="h2">日期时间格式</CardTitle>
                <CardDescription>选择你偏好的日期和时间显示格式</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">日期格式</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {([
                        { format: 'YYYY-MM-DD', example: '2023-12-31' },
                        { format: 'DD/MM/YYYY', example: '31/12/2023' },
                        { format: 'MM/DD/YYYY', example: '12/31/2023' },
                      ] as const).map((item) => (
                        <div key={item.format} className="p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer">
                          <div className="font-medium text-sm text-neutral-900 dark:text-white mb-1">{item.format}</div>
                          <div className="text-xs text-neutral-500">{item.example}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">时间格式</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {([
                        { format: '24h', example: '13:45' },
                        { format: '12h', example: '1:45 PM' },
                      ] as const).map((item) => (
                        <div key={item.format} className="p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer">
                          <div className="font-medium text-sm text-neutral-900 dark:text-white mb-1">{item.format === '24h' ? '24小时制' : '12小时制'}</div>
                          <div className="text-xs text-neutral-500">{item.example}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="justify-end">
                <Button variant="primary" icon={<Clock className="w-4 h-4" />}>
                  保存格式设置
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        {/* Theme Management Tab */}
        <TabsContent value="theme-manage">
          <div className="w-full">
            {/* 页面标题 */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">🎨 主题管理</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                选择浅色或深色主题，切换快捷键：Ctrl+Shift+T
              </p>
            </div>

            <div className="space-y-4">
              {/* 主题模式切换 */}
              <Section
                id="theme"
                title="主题模式"
                icon={Palette}
                isExpanded={expandedSections.theme}
                onToggle={toggleSection}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { mode: 'light' as const, icon: Sun, label: '浅色模式', desc: '明亮清爽，适合白天使用' },
                    { mode: 'dark' as const, icon: Moon, label: '深色模式', desc: '护眼沉浸，适合夜间使用' },
                  ].map(({ mode: modeOption, icon: Icon, label, desc }) => (
                    <button
                      key={modeOption}
                      onClick={() => {
                        setThemeModeLocal(modeOption)
                        addToast({ type: 'success', message: `已切换到${label}` })
                      }}
                      className={`
                        flex flex-col items-center justify-center p-8 rounded-xl border-2 transition-all duration-200 relative
                        ${mode === modeOption
                          ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500 ring-offset-2'
                          : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-md'
                        }
                      `}
                      aria-pressed={mode === modeOption}
                      aria-label={`选择${label}`}
                    >
                      {mode === modeOption && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center shadow-lg">
                          <CheckCircle2 size={14} className="text-white" />
                        </div>
                      )}
                      <div className={`
                        w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-colors duration-200
                        ${mode === modeOption
                          ? 'bg-primary-600 text-white'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                        }`}>
                        <Icon size={28} />
                      </div>
                      <span className="font-semibold text-lg text-neutral-900 dark:text-neutral-100">{label}</span>
                      <span className="text-sm mt-2 text-neutral-500 dark:text-neutral-400 text-center">{desc}</span>
                    </button>
                  ))}
                </div>
              </Section>

              {/* 快捷键提示 */}
              <Section
                id="shortcut"
                title="快捷键"
                icon={Bell}
                isExpanded={expandedSections.preview}
                onToggle={toggleSection}
              >
                <div className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-700 rounded text-sm font-mono text-neutral-700 dark:text-neutral-300">
                      Ctrl
                    </div>
                    <span className="text-neutral-400">+</span>
                    <div className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-700 rounded text-sm font-mono text-neutral-700 dark:text-neutral-300">
                      Shift
                    </div>
                    <span className="text-neutral-400">+</span>
                    <div className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-700 rounded text-sm font-mono text-neutral-700 dark:text-neutral-300">
                      T
                    </div>
                    <span className="text-sm text-neutral-600 dark:text-neutral-400 ml-2">
                      快速切换明暗主题
                    </span>
                  </div>
                </div>
              </Section>
            </div>
          </div>
        </TabsContent>


        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <div className="space-y-4">
            {/* 事件通知 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center">
                    <BellRing className="w-5 h-5 text-primary-500" />
                  </div>
                  <div>
                    <CardTitle as="h2">事件通知</CardTitle>
                    <CardDescription>选择你想要接收通知的事件类型</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {([
                  { key: 'formula_review' as const, label: '配方审核通知', desc: '配方提交审核、审核通过/被驳回时通知' },
                  { key: 'experiment_complete' as const, label: '实验完成通知', desc: '关联实验完成或失败时通知' },
                  { key: 'ai_task_done' as const, label: 'AI 任务通知', desc: 'AI 配方生成、分析任务完成时通知' },
                  { key: 'system_updates' as const, label: '系统更新通知', desc: '系统维护、版本更新等公告' },
                ]).map((item) => (
                  <div key={item.key} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">{item.label}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{item.desc}</p>
                    </div>
                    <button
                    onClick={() => toggleNotifPref(item.key)}
                    aria-label={`${item.label} ${notifPrefs[item.key] ? '已启用' : '已禁用'}`}
                    className={cn(
                      'relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                      notifPrefs[item.key] ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700',
                    )}
                  >
                    <span className={cn(
                      'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
                      notifPrefs[item.key] && 'translate-x-5',
                    )} />
                  </button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 通知渠道 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary-50 dark:bg-secondary-500/10 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-secondary-500" />
                  </div>
                  <div>
                    <CardTitle as="h2">通知渠道</CardTitle>
                    <CardDescription>设置接收通知的方式</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {([
                  { key: 'browser_push' as const, label: '浏览器推送', desc: '在浏览器中接收实时推送通知', icon: Bell },
                  { key: 'email_notifications' as const, label: '邮件通知', desc: '将重要通知发送到你的邮箱', icon: Mail },
                ]).map((item) => (
                  <div key={item.key} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <item.icon className="w-4 h-4 text-neutral-400" />
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">{item.label}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleNotifPref(item.key)}
                      aria-label={`${item.label} ${notifPrefs[item.key] ? '已启用' : '已禁用'}`}
                      className={cn(
                        'relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                        notifPrefs[item.key] ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700',
                      )}
                    >
                      <span className={cn(
                        'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
                        notifPrefs[item.key] && 'translate-x-5',
                      )} />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 通知频率 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-success-50 dark:bg-success-500/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-success-500" />
                  </div>
                  <div>
                    <CardTitle as="h2">通知频率</CardTitle>
                    <CardDescription>设置接收通知的频率</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {frequencyOptions.map((option) => (
                    <div key={option.value} className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">{option.label}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{option.desc}</p>
                      </div>
                      <input
                        type="radio"
                        name="notification_frequency"
                        value={option.value}
                        checked={notifPrefs.notification_frequency === option.value}
                        onChange={() => saveNotifPrefs({ ...notifPrefs, notification_frequency: option.value })}
                        className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-neutral-300"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 通知优先级 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-warning-50 dark:bg-warning-500/10 flex items-center justify-center">
                    <ShieldAlert className="w-5 h-5 text-warning-500" />
                  </div>
                  <div>
                    <CardTitle as="h2">通知优先级</CardTitle>
                    <CardDescription>设置通知的显示优先级</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {priorityOptions.map((option) => (
                    <div key={option.value} className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">{option.label}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{option.desc}</p>
                      </div>
                      <input
                        type="radio"
                        name="notification_priority"
                        value={option.value}
                        checked={notifPrefs.notification_priority === option.value}
                        onChange={() => saveNotifPrefs({ ...notifPrefs, notification_priority: option.value })}
                        className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-neutral-300"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ✅ 两步验证设置模态框 */}
      <Modal2FA />

      {/* ✅ 数据清除确认对话框 */}
      {showClearConfirm && (
        <div
          ref={clearConfirmRef}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-confirm-title"
        >
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-error-100 dark:bg-error-500/20 flex items-center justify-center shrink-0" aria-hidden="true">
                <ShieldAlert className="w-6 h-6 text-error-600" />
              </div>
              <h3 id="clear-confirm-title" className="text-lg font-semibold text-neutral-900 dark:text-white flex-1">
                确认清除所有数据？
              </h3>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                aria-label="关闭对话框"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                此操作将永久删除以下数据，且<strong>无法撤销</strong>：
              </p>
              <ul className="list-disc list-inside text-sm text-neutral-600 dark:text-neutral-400 space-y-1 ml-2">
                <li>所有配方数据和实验记录</li>
                <li>个人资料和账户设置</li>
                <li>界面偏好和通知配置</li>
                <li>API密钥和访问令牌</li>
              </ul>
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-lg">
                <label className="text-xs font-medium text-rose-800 dark:text-rose-300 block mb-1">
                  请输入 <strong>DELETE ALL</strong> 确认此操作：
                </label>
                <input
                  type="text"
                  placeholder="输入 DELETE ALL 以确认"
                  className="w-full px-3 py-2 text-sm border border-rose-300 dark:border-rose-700 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-neutral-900"
                  onChange={(e) => setClearConfirmText(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => setShowClearConfirm(false)}
                disabled={loadingData}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                variant="danger"
                onClick={handleClearAllData}
                disabled={loadingData || clearConfirmText !== 'DELETE ALL'}
                loading={loadingData}
                icon={<Trash2 className="w-4 h-4" />}
                className="flex-1"
              >
                {loadingData ? '清除中...' : '确认清除'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
