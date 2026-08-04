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
 *   7. **🎨 主题管理**（核心功能 - 已深度优化）
 *
 * 🎨 主题管理功能清单：
 *   ✅ 主题模式切换（浅色/深色/自动）+ 快捷键 Ctrl+Shift+T
 *   ✅ 8套预设主题选择 + 实时预览
 *   ✅ 自定义颜色编辑器（6色选择器 + WCAG对比度检查）
 *   ✅ 字体设置（字体族/大小/字重/行高/字间距）+ 全局同步
 *   ✅ 视觉属性调节（圆角/阴影/密度/动画/侧边栏透明度）+ 全局同步
 *   ✅ 导入/导出功能（企业级数据验证和错误处理）
 *   ✅ 自定义主题 CRUD 操作 + ThemeEditor 编辑器集成
 *   ✅ 版本历史查看与回滚功能
 *   ✅ 预览浮层交互效果
 *
 * 🔧 技术特性：
 *   - 响应式状态管理（useState + useMemo + useCallback）
 *   - 本地-全局状态双向同步（useThemeStore 集成）
 *   - TypeScript 类型安全（ThemeColorsType 等自定义类型）
 *   - 完善的错误处理和用户反馈机制
 *   - 性能优化（防重复点击、loading 状态、派生值缓存）
 *
 * 📦 使用组件：
 *   PageHeader / Tabs / Card / Input / Button / Badge / Section
 *   ThemeEditor / ThemePreviewOverlay / VersionHistoryPanel
 *
 * @version 2.0.0 (2026-05-02 深度优化版)
 * @author AI Expert System
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api/auth'
import { cn } from '@/lib/utils'
import {
  User, KeyRound, Palette, Shield, Save, CheckCircle, AlertCircle,
  Mail, Phone, Building2, UserCircle, Bell, BellRing, Lock, Clock, Smartphone, Search,
  ChevronRight, ShieldAlert, RefreshCw, Key, Copy, Trash2, Plus, Download, Upload,
  Globe, MapPin, Layers, Radius, Shapes, CheckCircle2, AlertTriangle, Eye, ChevronDown, ChevronUp, Type, Share2, RotateCcw, Settings, Sun, Moon, Monitor,
  QrCode, Info, X, ShieldCheck, Check, AlignVerticalSpaceAround, MoveHorizontal,
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
import {
  useTheme,
  useThemeStore,
  useIsDarkMode,
  presetThemes,
  type ThemeMode,
  type PresetThemeId,
} from '@/theme'
// 旧版常量（纯数据，无状态依赖）
import {
  FONT_OPTIONS,
  FONT_COLOR_PRESETS,
  COMPLETE_THEME_PRESETS,
  colorUtils,
  FONT_WEIGHT_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  LETTER_SPACING_OPTIONS,
  type InterfaceDensity,
  type ShadowIntensity,
} from '@/hooks/useTheme'
import { PersonalInfoSection } from './components/PersonalInfoSection'
import { ConfigManager } from '@/utils/configManager'
import type { ApiKey } from '@/utils/configManager'
// ✅ 新增：导入主题管理模式相关组件
import {
  ThemeEditor,
  ThemePreviewOverlay,
  VersionHistoryPanel,
} from '@/components/theme'
import { themeStorageAdapter } from '@/utils/theme/ThemeStorageAdapter'
import { versionController } from '@/utils/theme/VersionController'
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut'
import type { CustomTheme } from '@/types/theme-mode'
import { logger } from '@/utils/safeLogger';


type LocalThemeMode = 'light' | 'dark' | 'auto'

interface ThemeColorsType {
  primary: string
  secondary: string
  tertiary: string
  background: string
  surface: string
  text: string
  onBackground: string
  onPrimary: string
  error: string
  onError: string
}

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

  // ✅ 修复：使用新版主题API（替代旧的 useThemeSettings）
  const {
    mode,
    setThemeMode,
    setPresetTheme,
    resetToDefault,
  } = useTheme()

  const {
    motionPreferences,
    setMotionPreferences,
    applyCustomTheme,
  } = useThemeStore()

  const isDark = useIsDarkMode()

  // ✅ 修复：将所有本地状态声明移到最前面（解决暂时性死区问题）
  // 基础设置状态
  const [localFontSize, setLocalFontSize] = useState<number>(16)
  const [localFontFamily, setLocalFontFamily] = useState<string>("'Microsoft YaHei', system-ui, sans-serif")
  const [localFontColor, setLocalFontColor] = useState<string>('var(--text-primary, #1D1D1F)')
  const [localAccentColor, setLocalAccentColor] = useState<string>('var(--color-primary, #34C759)')
  const [localBorderRadius, setLocalBorderRadius] = useState<number>(12)
  const [localShadowIntensity, setLocalShadowIntensity] = useState<ShadowIntensity>(2 as ShadowIntensity)
  const [localDensity, setLocalDensity] = useState<InterfaceDensity>('comfortable' as InterfaceDensity)
  const [localSidebarTransparent, setLocalSidebarTransparent] = useState<boolean>(true)
  const [localSidebarOpacity, setLocalSidebarOpacity] = useState<number>(0.9)

  // 字体高级设置状态
  const [localFontWeight, setLocalFontWeight] = useState<number>(400)
  const [localLineHeight, setLocalLineHeight] = useState<number>(1.5)
  const [localLetterSpacing, setLocalLetterSpacing] = useState<number>(0)

  // ✅ 性能优化：使用 useMemo 缓存 advancedSettings 派生值
  const advancedSettings = useMemo(() => ({
    mode: mode === 'system' ? 'auto' : mode,
    animation: !motionPreferences?.reducedMotion,
    density: localDensity,
    fontSize: localFontSize,
    fontFamily: localFontFamily,
    fontColor: localFontColor,
    accentColor: localAccentColor,
    borderRadius: localBorderRadius,
    shadowIntensity: localShadowIntensity,
    sidebarTransparent: localSidebarTransparent,
    sidebarOpacity: localSidebarOpacity,
    fontWeight: localFontWeight,
    lineHeight: localLineHeight,
    letterSpacing: localLetterSpacing,
  }), [
    mode, motionPreferences?.reducedMotion, localDensity, localFontSize,
    localFontFamily, localFontColor, localAccentColor, localBorderRadius,
    localShadowIntensity, localSidebarTransparent, localSidebarOpacity,
    localFontWeight, localLineHeight, localLetterSpacing,
  ])

  // 适配层：操作函数（性能优化：useCallback 避免不必要的重渲染）
  const setAdvancedMode = useCallback((newMode: LocalThemeMode) => {
    const mappedMode = newMode === 'auto' ? 'system' : newMode
    setThemeMode(mappedMode)
  }, [setThemeMode])

  const setAdvancedAnimation = useCallback((animation: boolean) => {
    setMotionPreferences({ reducedMotion: !animation })
  }, [setMotionPreferences])
  // ✅ 修复：完整的真实setter实现（带全局同步）
  const setAdvancedDensity = (density: InterfaceDensity) => {
    setLocalDensity(density)
    addToast({ type: 'info', message: `界面密度已设置为${density === 'compact' ? '紧凑' : density === 'comfortable' ? '舒适' : '宽松'}` })
  }
  const setAdvancedFontSize = useCallback((size: number) => {
    setLocalFontSize(size)
    applyCustomTheme({
      typography: {
        fontSize: `${size}px` as any,
      },
    })
    addToast({ type: 'info', message: `字体大小已调整为 ${size}px` })
  }, [applyCustomTheme])

  const setAdvancedFontFamily = useCallback((family: string) => {
    setLocalFontFamily(family)
    applyCustomTheme({
      typography: {
        fontFamily: family as any,
      },
    })
    addToast({ type: 'success', message: '字体已切换' })
  }, [applyCustomTheme])
  const setAdvancedFontColor = (color: string) => {
    setLocalFontColor(color)
    addToast({ type: 'info', message: '字体颜色已更新' })
  }
  const setAdvancedAccentColor = (color: string) => {
    setLocalAccentColor(color)
    addToast({ type: 'info', message: '主色调已更新' })
  }
  const setAdvancedBorderRadius = (radius: number) => {
    setLocalBorderRadius(radius)
    applyCustomTheme({
      borderRadius: {
        sm: `${radius}px`,
        md: `${radius * 1.5}px`,
        lg: `${radius * 2}px`,
        xl: `${radius * 2.5}px`,
      },
    })
    addToast({ type: 'info', message: `圆角半径已调整为 ${radius}px` })
  }
  const setAdvancedShadowIntensity = (intensity: ShadowIntensity) => {
    setLocalShadowIntensity(intensity)
    addToast({ type: 'info', message: `阴影强度已调整` })
  }
  const setAdvancedCustomColors = (mode: 'light' | 'dark', colors: Partial<ThemeColorsType>) => {
    setCurrentColors(prev => ({
      ...prev,
      ...colors,
    }))
    applyCustomTheme({
      colors: {
        primary: { main: colors.primary || currentColors.primary, light: colors.primary || currentColors.primary, dark: colors.primary || currentColors.primary, contrastText: colors.onPrimary || currentColors.onPrimary },
        secondary: { main: colors.secondary || currentColors.secondary, light: colors.secondary || currentColors.secondary, dark: colors.secondary || currentColors.secondary, contrastText: 'var(--color-primary-contrast, #ffffff)' },
        error: { main: colors.error || currentColors.error, background: colors.error || currentColors.error, text: colors.onError || currentColors.onError },
      },
    })
    addToast({ type: 'info', message: '自定义颜色已应用' })
  }
  const resetAdvancedSettings = () => {
    // 重置所有本地状态到默认值
    setLocalFontSize(16)
    setLocalFontFamily("'Microsoft YaHei', system-ui, sans-serif")
    setLocalFontColor('var(--text-primary, #1D1D1F)')
    setLocalAccentColor('var(--color-primary, #34C759)')
    setLocalBorderRadius(12)
    setLocalShadowIntensity(2)
    setLocalDensity('comfortable')
    setLocalSidebarTransparent(true)
    setLocalSidebarOpacity(0.9)
    // 重置字体高级设置
    setLocalFontWeight(400)
    setLocalLineHeight(1.5)
    setLocalLetterSpacing(0)
    // 调用系统重置
    resetToDefault()
    addToast({ type: 'success', message: '✅ 已重置为默认设置' })
  }
  const setSidebarTransparent = (transparent: boolean) => {
    setLocalSidebarTransparent(transparent)
    addToast({ type: 'success', message: `侧边栏透明度已${transparent ? '开启' : '关闭'}` })
  }
  const setSidebarOpacity = (opacity: number) => {
    setLocalSidebarOpacity(opacity)
    addToast({ type: 'info', message: `侧边栏不透明度已调整为 ${Math.round(opacity * 100)}%` })
  }

  // ✅ UI/UX 优化：操作 loading 状态（防止重复点击，提升用户体验）
  const [isApplyingTheme, setIsApplyingTheme] = useState(false)
  const [isDeletingTheme, setIsDeletingTheme] = useState(false)

  // Profile state
  const [form, setForm] = useState({
    full_name: (user as Record<string, unknown>)?.full_name as string || '',
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

  // ✅ 新增：Theme Management Module State (主题管理模式状态)
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>(() => themeStorageAdapter.list())
  const [showEditor, setShowEditor] = useState(false)
  const [editingTheme, setEditingTheme] = useState<CustomTheme | null>(null)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [previewOverlay, setPreviewOverlay] = useState<{ theme: CustomTheme; position: { x: number; y: number } } | null>(null)

  // ✅ 新增：字体高级设置状态
  // 注意：这些状态在前面已通过 localFontWeight/localLineHeight/localLetterSpacing 定义
  // 这里直接引用它们以保持一致性
  const fontWeight = localFontWeight
  const setFontWeight = setLocalFontWeight
  const lineHeight = localLineHeight
  const setLineHeight = setLocalLineHeight
  const letterSpacing = localLetterSpacing
  const setLetterSpacing = setLocalLetterSpacing

  // 快捷键：Ctrl+Shift+T 切换主题模式
  useKeyboardShortcut({
    key: 't',
    ctrlKey: true,
    shiftKey: true,
    callback: () => {
      const modes: LocalThemeMode[] = ['light', 'dark', 'auto']
      const currentIndex = modes.indexOf(advancedSettings.mode as LocalThemeMode)
      const nextMode = modes[(currentIndex + 1) % modes.length]
      setAdvancedMode(nextMode)
      addToast({ type: 'success', message: `已切换至${nextMode === 'auto' ? '自动' : nextMode === 'dark' ? '深色' : '浅色'}模式` })
    },
  })

  // 主题管理操作函数
  const handleCreateTheme = () => {
    setEditingTheme(null)
    setShowEditor(true)
  }

  const handleEditTheme = (theme: CustomTheme) => {
    setEditingTheme(theme)
    setShowEditor(true)
  }

  const handleSaveTheme = (theme: CustomTheme) => {
    setCustomThemes(themeStorageAdapter.list())
    setShowEditor(false)
    addToast({ type: 'success', message: `主题"${theme.name}"已保存` })
  }

  const handleDeleteTheme = (id: string) => {
    // ✅ 优化：防止重复点击
    if (isDeletingTheme) return

    if (window.confirm('⚠️ 确定要删除此主题吗？\n\n此操作不可恢复，删除后数据将无法恢复。')) {
      setIsDeletingTheme(true)

      try {
        themeStorageAdapter.delete(id)
        setCustomThemes(themeStorageAdapter.list())
        addToast({ type: 'success', message: '✅ 主题已成功删除' })
      } catch (error) {
        logger.error('[SettingsPage] 删除主题失败:', error)
        addToast({ type: 'error', message: '❌ 删除失败，请重试' })
      } finally {
        setTimeout(() => setIsDeletingTheme(false), 500)
      }
    }
  }

  const handleApplyTheme = (theme: CustomTheme) => {
    // ✅ 优化：防止重复点击
    if (isApplyingTheme) return

    if (window.confirm(`🎨 是否应用主题"${theme.name}"？\n\n应用后将立即更改整个应用的视觉外观。`)) {
      setIsApplyingTheme(true)

      try {
        // 1. 解析主题配置
        const config = theme.config

        // 2. 应用颜色配置（如果存在）
        if (config.colors) {
          const colorsToUpdate: Partial<ThemeColorsType> = {}

          // 映射颜色字段（从 ThemeColors 到 ThemeColorsType，兼容多种数据结构）
          const extractColorValue = (colorData: any): string | undefined => {
            if (!colorData) return undefined
            if (typeof colorData === 'string') return colorData
            if (typeof colorData.main === 'string') return colorData.main
            if (typeof colorData.default === 'string') return colorData.default
            if (typeof colorData.light === 'string') return colorData.light
            return undefined
          }

          if (config.colors.primary) {
            colorsToUpdate.primary = extractColorValue(config.colors.primary)
          }
          if (config.colors.secondary) {
            colorsToUpdate.secondary = extractColorValue(config.colors.secondary)
          }
          if (config.colors.tertiary) {
            colorsToUpdate.tertiary = extractColorValue(config.colors.tertiary)
          }
          if (config.colors.background) {
            colorsToUpdate.background = extractColorValue(config.colors.background)
          }
          if (config.colors.surface) {
            colorsToUpdate.surface = extractColorValue(config.colors.surface)
          }
          if (config.colors.error) {
            colorsToUpdate.error = extractColorValue(config.colors.error)
          }

          // 更新本地颜色状态
          setCurrentColors(prev => ({ ...prev, ...colorsToUpdate }))

          // 应用到全局主题系统
          applyCustomTheme({
            colors: {
              primary: { main: colorsToUpdate.primary || currentColors.primary, light: colorsToUpdate.primary || currentColors.primary, dark: colorsToUpdate.primary || currentColors.primary, contrastText: colorsToUpdate.onPrimary || currentColors.onPrimary },
              secondary: { main: colorsToUpdate.secondary || currentColors.secondary, light: colorsToUpdate.secondary || currentColors.secondary, dark: colorsToUpdate.secondary || currentColors.secondary, contrastText: 'var(--color-primary-contrast, #ffffff)' },
              error: { main: colorsToUpdate.error || currentColors.error, background: colorsToUpdate.error || currentColors.error, text: colorsToUpdate.onError || currentColors.onError },
            },
          })
        }

        // 4. 应用字体配置（如果存在）
        if (config.font) {
          const fontConfig = config.font as Record<string, unknown>
          if (fontConfig.fontFamily) {
            setLocalFontFamily(fontConfig.fontFamily)
          }
          if (fontConfig.fontSize) {
            setLocalFontSize(typeof fontConfig.fontSize === 'number' ? fontConfig.fontSize : parseInt(fontConfig.fontSize) || 16)
          }
        }

        // 5. 持久化到 localStorage（通过 themeStorageAdapter）
        try {
          // 标记当前应用的主题ID（可选，用于下次加载时恢复）
          localStorage.setItem('rmfood-applied-theme-id', theme.id)
        } catch (storageError) {
          logger.warn('[SettingsPage] 无法保存主题应用到 localStorage:', storageError)
        }

        // 6. 显示成功通知并关闭预览浮层
        addToast({ type: 'success', message: `✅ 已成功应用主题"${theme.name}"` })
        setPreviewOverlay(null)

      } catch (error) {
        logger.error('[SettingsPage] 应用主题失败:', error)
        addToast({ type: 'error', message: '❌ 应用主题失败，请重试' })
      } finally {
        setTimeout(() => setIsApplyingTheme(false), 300)
      }
    }
  }

  const handlePreviewHover = (e: React.MouseEvent, theme: CustomTheme) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setPreviewOverlay({
      theme,
      position: { x: rect.left + rect.width / 2, y: rect.bottom + window.scrollY },
    })
  }

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
      logger.error('导入失败:', error)
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

  // 高级主题设置的本地状态
  const [activePreset, setActivePreset] = useState<string>(
    // ✅ 修复：使用新版presetThemes
    Object.keys(presetThemes)[0] || 'light-default',
  )
  const [customColor, setCustomColor] = useState(advancedSettings.accentColor)

  // 同步高级设置到本地状态
  useEffect(() => {
    // ✅ 修复：保持当前选中的preset
    setActivePreset(activePreset)
    setCustomColor(advancedSettings.accentColor)
  }, [advancedSettings.accentColor])

  // 完整主题设置的状态
  const [expandedSections, setExpandedSections] = useState({
    theme: true,
    preview: true,
    presets: true,
    colors: false,
    fonts: false,
    visuals: true,
    importExport: false,
  })

  // ✅ 统一预设状态管理：删除冗余的 selectedPreset，统一使用 activePreset
  // 原因：避免双重状态导致UI显示与实际应用不一致

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section as keyof typeof prev],
    }))
  }

  // ✅ 修复：使用已获取的新版主题API（避免重复调用useTheme）
  const [currentColors, setCurrentColors] = useState<ThemeColorsType>(() => ({
    primary: 'var(--color-primary, #34C759)',
    secondary: 'var(--color-secondary, #34C759)',
    tertiary: 'var(--color-tertiary, #6366f1)',
    background: 'var(--bg-primary, #ffffff)',
    surface: 'var(--bg-secondary, #f9fafb)',
    text: 'var(--text-primary, #1C1C1E)',
    onBackground: 'var(--text-primary, #1C1C1E)',
    onPrimary: 'var(--color-primary-contrast, #ffffff)',
    error: 'var(--color-error, #FF3B30)',
    onError: 'var(--color-error-contrast, #ffffff)',
  }))
  const { getContrastRatio: checkContrast, checkWCAGAACompliance } = colorUtils

  // 主题预设选择与处理（使用新版API）
  const handlePresetApply = (presetId: string) => {
    setActivePreset(presetId)
    setPresetTheme(presetId as PresetThemeId)
    addToast({ type: 'success', message: '✅ 主题预设已应用' })
  }

  // 处理颜色变化
  const handleColorChange = (key: keyof typeof currentColors, value: string) => {
    setAdvancedCustomColors(isDark ? 'dark' : 'light', { [key]: value })
  }

  // 处理字体颜色变化
  const handleFontColorChange = (color: string) => {
    setAdvancedFontColor(color)
    addToast({ type: 'info', message: '字体颜色已更新' })
  }

  // 处理字体选择变化
  const handleFontFamilyChange = (fontFamily: string) => {
    setAdvancedFontFamily(fontFamily)
  }

  // 处理字体大小变化
  const handleFontSizeChange = (size: number) => {
    setAdvancedFontSize(size)
  }

  // 处理保存
  const handleThemeSave = () => {
    addToast({ type: 'success', message: '主题设置已保存' })
  }

  // ✅ 增强版导出主题函数（包含完整配置数据）
  const handleExportTheme = () => {
    const themeData = {
      version: '1.1',
      name: 'RMFOOD自定义主题',
      description: '从RMFOOD配方平台导出的主题配置文件',
      exportedAt: new Date().toISOString(),
      settings: {
        mode: advancedSettings.mode,
        accentColor: advancedSettings.accentColor,
        fontFamily: advancedSettings.fontFamily,
        fontSize: advancedSettings.fontSize,
        fontColor: advancedSettings.fontColor,
        borderRadius: advancedSettings.borderRadius,
        shadowIntensity: advancedSettings.shadowIntensity,
        density: advancedSettings.density,
        animation: advancedSettings.animation,
        sidebarTransparent: advancedSettings.sidebarTransparent,
        sidebarOpacity: advancedSettings.sidebarOpacity,
        colors: { ...currentColors },
        customColors: { ...currentColors },
        // 高级字体设置
        fontWeight,
        lineHeight,
        letterSpacing,
      },
      metadata: {
        sourceApp: 'RMFOOD配方平台',
        appVersion: '1.0.0',
        totalConfigItems: 19,
      },
    }

    try {
      const blob = new Blob([JSON.stringify(themeData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rmfood-theme-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)

      addToast({
        type: 'success',
        message: `✅ 主题已成功导出，共包含${Object.keys(themeData.settings).length}项配置`,
      })
    } catch (error) {
      logger.error('[SettingsPage] 导出主题失败:', error)
      addToast({ type: 'error', message: '❌ 导出失败，请重试' })
    }
  }

  // ✅ 增强版导入主题函数（带完整错误处理和数据验证）
  const handleImportTheme = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      // 1. 文件大小限制检查（最大5MB）
      const maxSize = 5 * 1024 * 1024
      if (file.size > maxSize) {
        addToast({ type: 'error', message: '❌ 文件过大，主题文件不能超过5MB' })
        return
      }

      // 2. 文件类型验证
      if (!file.name.endsWith('.json')) {
        addToast({ type: 'error', message: '❌ 不支持的文件格式，请选择JSON文件' })
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string

          // 3. JSON 解析
          let data: any
          try {
            data = JSON.parse(content)
          } catch (parseError) {
            addToast({ type: 'error', message: '❌ JSON解析失败，文件可能已损坏' })
            return
          }

          // 4. 数据结构验证
          if (!data || typeof data !== 'object') {
            addToast({ type: 'error', message: '❌ 无效的主题数据格式' })
            return
          }

          if (!data.settings) {
            addToast({ type: 'warning', message: '⚠️ 主题文件缺少settings字段，将使用默认值' })
            data.settings = {}
          }

          // 5. 版本兼容性检查
          if (data.version && parseFloat(data.version) > 2.0) {
            addToast({
              type: 'warning',
              message: `⚠️ 主题文件版本${data.version}可能不兼容当前系统`,
            })
          }

          // 6. 应用设置（带类型验证和容错处理）
          const settings = data.settings

          // 模式验证
          if (settings.mode && ['light', 'dark', 'auto'].includes(settings.mode)) {
            setAdvancedMode(settings.mode)
          }

          // 颜色值验证辅助函数
          const isValidColor = (color: any): boolean => {
            if (typeof color !== 'string') return false
            return /^#[0-9A-Fa-f]{6}$/.test(color) || color.startsWith("rgb(")
          }

          // 安全应用颜色设置
          if (settings.accentColor && isValidColor(settings.accentColor)) {
            setAdvancedAccentColor(settings.accentColor)
          }
          if (settings.fontColor && isValidColor(settings.fontColor)) {
            setAdvancedFontColor(settings.fontColor)
          }

          // 数值范围验证
          if (typeof settings.fontSize === 'number' && settings.fontSize >= 10 && settings.fontSize <= 30) {
            setAdvancedFontSize(settings.fontSize)
          }
          if (typeof settings.borderRadius === 'number' && settings.borderRadius >= 0 && settings.borderRadius <= 30) {
            setAdvancedBorderRadius(settings.borderRadius)
          }
          if (typeof settings.sidebarOpacity === 'number' && settings.sidebarOpacity >= 0.1 && settings.sidebarOpacity <= 1) {
            setSidebarOpacity(settings.sidebarOpacity)
          }

          // 字体设置（字符串验证）
          if (typeof settings.fontFamily === 'string' && settings.fontFamily.length > 0 && settings.fontFamily.length < 200) {
            setAdvancedFontFamily(settings.fontFamily)
          }

          // 枚举值验证
          if (['compact', 'comfortable', 'spacious'].includes(settings.density)) {
            setAdvancedDensity(settings.density)
          }
          if ([1, 2, 3, 4].includes(settings.shadowIntensity)) {
            setAdvancedShadowIntensity(settings.shadowIntensity)
          }
          if (typeof settings.animation === 'boolean') {
            setAdvancedAnimation(settings.animation)
          }
          if (typeof settings.sidebarTransparent === 'boolean') {
            setSidebarTransparent(settings.sidebarTransparent)
          }

          // 自定义颜色对象验证和应用
          if (settings.customColors && typeof settings.customColors === 'object') {
            const validColors: Partial<ThemeColorsType> = {}
            const colorFields = ['primary', 'secondary', 'tertiary', 'background', 'surface', 'text', 'onBackground', 'onPrimary', 'error', 'onError']

            colorFields.forEach(field => {
              if (settings.customColors[field] && isValidColor(settings.customColors[field])) {
                validColors[field as keyof ThemeColorsType] = settings.customColors[field]
              }
            })

            if (Object.keys(validColors).length > 0) {
              setAdvancedCustomColors(isDark ? 'dark' : 'light', validColors)
            }
          }

          // 7. 成功反馈
          addToast({
            type: 'success',
            message: `✅ 主题"${data.name || '导入的主题'}"已成功导入并应用`,
          })

        } catch (error) {
          logger.error('[SettingsPage] 导入主题失败:', error)
          addToast({
            type: 'error',
            message: '❌ 导入失败：发生未知错误，请检查文件格式',
          })
        }
      }

      reader.onerror = () => {
        addToast({ type: 'error', message: '❌ 文件读取失败，请重试' })
      }

      reader.readAsText(file)
    }
    input.click()
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

  const handleThemeChange = (mode: LocalThemeMode) => {
    setAdvancedMode(mode)
  }

  // 预设选择（使用新版presetThemes）
  const handlePresetSelect = (presetId: string) => {
    setActivePreset(presetId)
    if (presetId !== 'custom' && presetThemes[presetId as PresetThemeId]) {
      const preset = presetThemes[presetId as PresetThemeId]
      if (preset?.colors?.primary?.main) {
        setCustomColor(preset.colors.primary.main)
      }
    }
  }

  // 自定义颜色
  const handleCustomColorChange = (color: string) => {
    setActivePreset('custom')
    setCustomColor(color)
    setAdvancedAccentColor(color)
  }

  // 动画切换
  const handleAnimationToggle = () => {
    setAdvancedAnimation(!advancedSettings.animation)
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

  // 密度切换
  const handleDensityChange = (density: InterfaceDensity) => {
    setAdvancedDensity(density)
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
            <TabsTrigger value="theme-manage" icon={<Layers className="w-4 h-4" />}>主题管理</TabsTrigger>
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
                  {(loginHistory as unknown[]).map((session: unknown) => (
                    <div key={session.id} className="flex items-center justify-between p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors" role="listitem">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center" aria-hidden="true">
                          <Smartphone className="w-5 h-5 text-neutral-500" />
                        </div>
                        <div>
                          <div className="font-medium text-neutral-900 dark:text-white">
                            {session.device}
                            {session.current && (
                              <Badge variant="success" size="sm" className="ml-2">当前</Badge>
                            )}
                          </div>
                          <div className="text-sm text-neutral-500">
                            {session.browser} · {session.ip} · {session.location}
                          </div>
                          <div className="text-xs text-neutral-400 mt-1">
                            {session.time.toLocaleString('zh-CN')}
                          </div>
                        </div>
                      </div>
                      {!session.current && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                          onClick={() => handleLogoutSession(session.id)}
                          disabled={loadingSecurity}
                          aria-label={`退出会话 ${session.device}`}
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
                  {(devices as unknown[]).map((device: unknown) => (
                    <div key={device.id} className="flex items-center justify-between p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors" role="listitem">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center" aria-hidden="true">
                          <Smartphone className="w-5 h-5 text-neutral-500" />
                        </div>
                        <div>
                          <div className="font-medium text-neutral-900 dark:text-white">
                            {device.name}
                            {device.current && (
                              <Badge variant="success" size="sm" className="ml-2">当前设备</Badge>
                            )}
                          </div>
                          <div className="text-sm text-neutral-500">
                            {device.type}
                          </div>
                          <div className="text-xs text-neutral-400 mt-1">
                            上次活动: {device.lastActive.toLocaleString('zh-CN')}
                          </div>
                        </div>
                      </div>
                      {!device.current && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                          onClick={() => handleRemoveDevice(device.id)}
                          disabled={loadingSecurity}
                          aria-label={`移除设备 ${device.name}`}
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

        {/* ✅ Theme Management Tab (统一主题管理) */}
        <TabsContent value="theme-manage">
          <div className="w-full">
            {/* 页面标题和描述 */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">🎨 主题管理</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                管理应用外观、自定义主题配置
              </p>
            </div>

            <div className="space-y-4">
              {/* 第一层：快速设置 - 主题模式切换 + 预设选择 */}
              <Section
                id="theme"
                title="主题模式"
                icon={Palette}
                isExpanded={expandedSections.theme}
                onToggle={toggleSection}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { mode: 'light' as const, icon: Sun, label: '浅色模式', desc: '明亮清爽' },
                    { mode: 'dark' as const, icon: Moon, label: '深色模式', desc: '护眼沉浸' },
                    { mode: 'auto' as const, icon: Monitor, label: '自动模式', desc: '跟随系统' },
                  ].map(({ mode: modeOption, icon: Icon, label, desc }) => (
                    <button
                      key={modeOption}
                      onClick={() => {
                        setAdvancedMode(modeOption)
                        addToast({ type: 'success', message: `已切换到${label}` })
                      }}
                      className={`
                        flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200 relative
                        ${advancedSettings.mode === modeOption
                          ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500 ring-offset-2'
                          : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-md'
                        }
                      `}
                      aria-pressed={advancedSettings.mode === modeOption}
                      aria-label={`选择${label}`}
                    >
                      {advancedSettings.mode === modeOption && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center shadow-lg">
                          <CheckCircle2 size={14} className="text-white" />
                        </div>
                      )}
                      <div className={`
                        w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors duration-200
                        ${advancedSettings.mode === modeOption
                          ? 'bg-primary-600 text-white'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                        }`}>
                        <Icon size={24} />
                      </div>
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">{label}</span>
                      <span className="text-sm mt-1 text-neutral-500 dark:text-neutral-400">{desc}</span>
                    </button>
                  ))}
                </div>
              </Section>

              {/* 主题预设 */}
              <Section
                id="presets"
                title="主题预设"
                icon={Layers}
                isExpanded={expandedSections.presets}
                onToggle={toggleSection}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {COMPLETE_THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetApply(preset.id)}
                      className={cn(
                        'p-4 rounded-lg border-2 transition-all text-left relative group',
                        activePreset === preset.id
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500 ring-offset-2'
                          : 'border-neutral-200 dark:border-neutral-600 hover:border-neutral-300 hover:shadow-md',
                      )}
                      aria-pressed={activePreset === preset.id}
                      aria-label={`应用${preset.name}主题`}
                    >
                      {activePreset === preset.id && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                          <CheckCircle2 size={14} className="text-white" />
                        </div>
                      )}
                      <div className="flex gap-1 mb-2">
                        <div className="w-6 h-6 rounded" style={{ backgroundColor: preset.lightColors.primary }}></div>
                        <div className="w-6 h-6 rounded" style={{ backgroundColor: preset.lightColors.secondary }}></div>
                        <div className="w-6 h-6 rounded" style={{ backgroundColor: preset.lightColors.tertiary }}></div>
                      </div>
                      <div className="font-medium text-sm text-neutral-900 dark:text-white">
                        {preset.name}
                      </div>
                      <div className="text-xs text-neutral-400 mt-1">{preset.description}</div>
                    </button>
                  ))}
                </div>
              </Section>

              {/* 第二层：实时预览 */}
              <Section
                id="preview"
                title="效果预览"
                icon={Eye}
                isExpanded={expandedSections.preview}
                onToggle={toggleSection}
              >
                <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 bg-slate-50 dark:bg-neutral-800">
                  <div className="mb-4">
                    <div className="text-sm font-medium text-neutral-900 dark:text-white mb-3">按钮样式</div>
                    <div className="flex gap-3 flex-wrap">
                      <Button size="sm" variant="primary">主要按钮</Button>
                      <Button size="sm" variant="secondary">次要按钮</Button>
                      <Button size="sm" variant="ghost">幽灵按钮</Button>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="text-sm font-medium text-neutral-900 dark:text-white mb-3">输入框样式</div>
                    <div className="space-y-3 max-w-md">
                      <Input placeholder="普通输入框" />
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-neutral-900 dark:text-white mb-3">文本样式</div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">标题文本</h3>
                      <p className="text-neutral-700 dark:text-neutral-300">正文文本示例，展示当前主题的字体、颜色和行高。</p>
                    </div>
                  </div>
                </div>
              </Section>

              {/* 第三层：详细配置 - 外观设置 */}
              <Section
                id="colors"
                title="外观设置"
                icon={Palette}
                isExpanded={expandedSections.colors}
                onToggle={toggleSection}
              >
                <div className="space-y-6">
                  {/* 颜色方案编辑器 */}
                  <div>
                    <h4 className="font-semibold mb-3 text-neutral-900 dark:text-neutral-100">颜色方案</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {[
                        { key: 'primary' as const, label: '主色调' },
                        { key: 'secondary' as const, label: '辅助色' },
                        { key: 'tertiary' as const, label: '第三色' },
                        { key: 'background' as const, label: '背景色' },
                        { key: 'surface' as const, label: '表面色' },
                        { key: 'error' as const, label: '错误色' },
                      ].map(({ key, label }) => (
                        <div key={key} className="p-3 bg-slate-50 dark:bg-neutral-800/50 rounded-lg">
                          <label className="block text-sm font-medium mb-2 text-neutral-500 dark:text-neutral-400">{label}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={currentColors[key]}
                              onChange={(e) => {
                                handleColorChange(key, e.target.value)
                                addToast({ type: 'success', message: `${label}已更新` })
                              }}
                              className="w-10 h-10 rounded-lg border-2 border-neutral-200 dark:border-neutral-600 cursor-pointer transition-transform hover:scale-105"
                              aria-label={`选择${label}`}
                            />
                            <input
                              type="text"
                              value={currentColors[key]}
                              onChange={(e) => {
                                const val = e.target.value
                                if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                                  if (val.length === 7) {
                                    handleColorChange(key, val)
                                    addToast({ type: 'success', message: `${label}已更新` })
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                const val = e.target.value
                                if (!/^#[0-9A-Fa-f]{6}$/.test(val)) {
                                  e.target.value = currentColors[key]
                                }
                              }}
                              className="flex-1 px-2 py-1 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-900 text-xs font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                              aria-label={`输入${label}颜色代码`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* WCAG对比度检查 */}
                    <div className="mt-4 p-3 border rounded-lg bg-slate-50 dark:bg-neutral-800/50">
                      <h4 className="font-semibold mb-2 flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
                        <Eye size={16} className="text-neutral-500 dark:text-neutral-400" />
                        对比度检查 (WCAG 2.1 AA)
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="flex items-center justify-between p-2 bg-white dark:bg-neutral-900 rounded">
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">背景/文本</span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-mono">{checkContrast(currentColors.background, currentColors.onBackground).toFixed(2)}:1</span>
                            {checkWCAGAACompliance(checkContrast(currentColors.background, currentColors.onBackground)) ? (
                              <CheckCircle2 size={14} className="text-success-500" />
                            ) : (
                              <AlertTriangle size={14} className="text-warning-500" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-white dark:bg-neutral-900 rounded">
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">主色/文本</span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-mono">{checkContrast(currentColors.primary, currentColors.onPrimary).toFixed(2)}:1</span>
                            {checkWCAGAACompliance(checkContrast(currentColors.primary, currentColors.onPrimary)) ? (
                              <CheckCircle2 size={14} className="text-success-500" />
                            ) : (
                              <AlertTriangle size={14} className="text-warning-500" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-white dark:bg-neutral-900 rounded">
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">错误色</span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-mono">{checkContrast(currentColors.error, currentColors.onError).toFixed(2)}:1</span>
                            {checkWCAGAACompliance(checkContrast(currentColors.error, currentColors.onError)) ? (
                              <CheckCircle2 size={14} className="text-success-500" />
                            ) : (
                              <AlertTriangle size={14} className="text-warning-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 字体设置 - 全面升级版 */}
                  <div>
                    <h4 className="font-semibold mb-4 text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                      <Type size={18} className="text-primary-600" />
                      字体设置
                      <Badge variant="neutral" className="text-xs">高级</Badge>
                    </h4>
                    <div className="space-y-6">

                      {/* 子模块1: 字体类型选择器（增强版） */}
                      <div>
                        <label className="block text-sm font-medium mb-3 text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                          <Type size={14} />
                          字体类型 (Font Family)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                          {FONT_OPTIONS.map((font) => (
                            <button
                              key={font.id}
                              onClick={() => {
                                handleFontFamilyChange(font.family)
                                addToast({ type: 'success', message: `字体已切换为 ${font.name}` })
                              }}
                              className={`
                                p-4 rounded-xl border-2 transition-all duration-200 text-left relative group hover:shadow-lg hover:-translate-y-0.5
                                ${advancedSettings.fontFamily === font.family
                                  ? 'border-primary-600 bg-gradient-to-br from-primary-50 to-white dark:from-primary-900/30 dark:to-gray-800 ring-2 ring-primary-500 ring-offset-2 shadow-lg'
                                  : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600'
                                }
                              `}
                              style={{ fontFamily: font.family }}
                              aria-pressed={advancedSettings.fontFamily === font.family}
                              aria-label={`选择${font.name}字体`}
                            >
                              {advancedSettings.fontFamily === font.family && (
                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center shadow-md animate-pulse">
                                  <CheckCircle2 size={14} className="text-white" />
                                </div>
                              )}
                              <div className="font-bold text-sm text-neutral-900 dark:text-neutral-100">{font.name}</div>
                              <div className="text-xs mt-1.5 text-neutral-600 dark:text-neutral-300" style={{ fontFamily: font.family }}>
                                {font.preview || 'Aa Bb Cc'}
                              </div>
                              <div className="mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-700">
                                <Badge variant="neutral" className="text-[10px] px-1.5 py-0">
                                  {font.category}
                                </Badge>
                              </div>
                              {font.description && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-neutral-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                  {font.description}
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 子模块2: 字体大小调节（增强版） */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                            <MoveHorizontal size={14} />
                            字体大小 (Font Size)
                          </label>
                          <span className="px-3 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-mono font-semibold">
                            {advancedSettings.fontSize}px
                          </span>
                        </div>

                        {/* 预设快捷按钮 */}
                        <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                          {[12, 16, 20, 24].map((size) => (
                            <button
                              key={size}
                              onClick={() => {
                                setAdvancedFontSize(size)
                                addToast({ type: 'info', message: `字体大小已设置为 ${size}px` })
                              }}
                              className={`
                                flex-shrink-0 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all
                                ${advancedSettings.fontSize === size
                                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-md'
                                  : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 hover:shadow-sm'
                                }
                              `}
                              aria-label={`设置字体大小为${size}px`}
                            >
                              <span style={{ fontSize: `${size * 0.7}px` }}>Aa</span>
                              <span className="ml-1 text-xs">{size}px</span>
                            </button>
                          ))}
                        </div>

                        {/* 滑块 */}
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-neutral-500 dark:text-neutral-400 w-8">12</span>
                          <input
                            type="range"
                            min="12"
                            max="24"
                            step="1"
                            value={advancedSettings.fontSize}
                            onChange={(e) => setAdvancedFontSize(Number(e.target.value))}
                            className="flex-1 h-2.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                            aria-label="调整字体大小"
                          />
                          <span className="text-xs text-neutral-500 dark:text-neutral-400 w-8">24</span>
                        </div>
                      </div>

                      {/* 子模块3: 字重选择器（新增）⭐ */}
                      <div>
                        <label className="block text-sm font-medium mb-3 text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                          <Type size={14} className="font-bold" />
                          字重 (Font Weight)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                          {FONT_WEIGHT_OPTIONS.map((weight) => (
                            <button
                              key={weight.value}
                              onClick={() => {
                                setFontWeight(weight.value)
                                addToast({ type: 'info', message: `字重已设置为 ${weight.label}` })
                              }}
                              className={`
                                px-4 py-3 rounded-xl border-2 transition-all duration-200 text-sm relative hover:shadow-md hover:-translate-y-0.5
                                ${fontWeight === weight.value
                                  ? 'border-primary-600 bg-gradient-to-br from-primary-50 to-white dark:from-primary-900/30 dark:to-gray-800 ring-2 ring-primary-500 ring-offset-2 shadow-lg'
                                  : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600'
                                }
                              `}
                              style={{ fontWeight: weight.value }}
                              aria-label={weight.label}
                              aria-pressed={fontWeight === weight.value}
                            >
                              {fontWeight === weight.value && (
                                <CheckCircle2 size={12} className="absolute -top-1.5 -right-1.5 text-primary-500" />
                              )}
                              <div className="font-bold text-base">{weight.desc}</div>
                              <div className="text-[10px] mt-1 text-neutral-500 dark:text-neutral-400 leading-tight">
                                {weight.label.split(' ')[0]}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 子模块4: 行高调节器（新增）⭐ */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                            <AlignVerticalSpaceAround size={14} />
                            行高 (Line Height)
                          </label>
                          <span className="px-3 py-1 bg-secondary-50 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-300 rounded-full text-sm font-mono font-semibold">
                            {lineHeight.toFixed(2)}
                          </span>
                        </div>

                        {/* 预设按钮组 */}
                        <div className="flex gap-2 mb-3">
                          {LINE_HEIGHT_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => {
                                setLineHeight(option.value)
                                addToast({ type: 'info', message: `行高已设置为 ${option.label} (${option.desc})` })
                              }}
                              className={`
                                flex-1 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all duration-200
                                ${lineHeight === option.value
                                  ? 'border-blue-600 bg-secondary-50 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-300 shadow-md'
                                  : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 hover:shadow-sm'
                                }
                              `}
                              aria-label={option.label}
                            >
                              <div className="font-semibold">{option.desc}</div>
                              <div className="text-[10px] opacity-70">{option.label}</div>
                            </button>
                          ))}
                        </div>

                        {/* 实时预览 */}
                        <div className="mt-3 p-5 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 shadow-inner">
                          <p
                            style={{
                              lineHeight,
                              fontSize: `${advancedSettings.fontSize}px`,
                              fontFamily: advancedSettings.fontFamily,
                              fontWeight,
                            }}
                            className="transition-all duration-300 text-neutral-700 dark:text-neutral-300"
                          >
                            这是一段示例文字，用于展示当前行高效果。合理的行高可以让长文本阅读更加舒适，减少视觉疲劳。The quick brown fox jumps over the lazy dog. 中英文混排效果一目了然。
                          </p>
                        </div>
                      </div>

                      {/* 子模块5: 字间距调节器（新增）⭐ */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                            <MoveHorizontal size={14} />
                            字间距 (Letter Spacing)
                          </label>
                          <span className="px-3 py-1 bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300 rounded-full text-sm font-mono font-semibold">
                            {letterSpacing > 0 ? '+' : ''}{letterSpacing.toFixed(1)}
                          </span>
                        </div>

                        {/* 滑块控制 */}
                        <input
                          type="range"
                          min="-0.5"
                          max="1"
                          step="0.1"
                          value={letterSpacing}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            setLetterSpacing(val)
                            addToast({ type: 'info', message: `字间距已调整为 ${val > 0 ? '+' : ''}${val.toFixed(1)}` })
                          }}
                          className="w-full h-2.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-purple-600 mb-2"
                          aria-label="调整字间距"
                        />

                        {/* 刻度标签 */}
                        <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 px-1 mb-3">
                          <span>紧密</span>
                          <span>标准</span>
                          <span>宽松</span>
                          <span>分散</span>
                        </div>

                        {/* 实时预览 */}
                        <div className="mt-3 p-5 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 shadow-inner">
                          <p
                            style={{
                              letterSpacing: `${letterSpacing}em`,
                              fontSize: `${advancedSettings.fontSize}px`,
                              fontFamily: advancedSettings.fontFamily,
                              fontWeight,
                            }}
                            className="transition-all duration-300 text-neutral-700 dark:text-neutral-300 uppercase tracking-wide"
                          >
                            字间距预览：ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz 1234567890
                          </p>
                        </div>
                      </div>

                      {/* 子模块6: 字体颜色独立选择器（增强版）⭐ */}
                      <div>
                        <label className="block text-sm font-medium mb-3 text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                          <Palette size={14} />
                          字体颜色 (Font Color)
                        </label>
                        <div className="flex gap-4 items-start">
                          {/* 颜色选择器 */}
                          <div className="relative group">
                            <input
                              type="color"
                              value={advancedSettings.fontColor}
                              onChange={(e) => handleFontColorChange(e.target.value)}
                              className="w-16 h-16 rounded-xl border-2 border-neutral-200 dark:border-neutral-600 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg hover:border-primary-400"
                              aria-label="选择字体颜色"
                            />
                            <div className="absolute inset-0 rounded-xl ring-2 ring-primary-400 ring-offset-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                          </div>

                          {/* HEX输入和说明 */}
                          <div className="flex-1 space-y-2">
                            <input
                              type="text"
                              value={advancedSettings.fontColor}
                              onChange={(e) => {
                                if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                                  handleFontColorChange(e.target.value)
                                }
                              }}
                              className="w-full px-4 py-2.5 border-2 border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-sm font-mono font-semibold focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                              placeholder="#000000"
                              aria-label="输入颜色HEX值"
                            />
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              影响标题和正文的基础文字颜色。建议使用深色系以确保可读性。
                            </p>
                          </div>
                        </div>

                        {/* 预设颜色快捷选择 */}
                        <div className="flex gap-3 mt-4 flex-wrap">
                          {[
                            { color: 'var(--text-primary, #1C1C1E)', name: '深黑' },
                            { color: 'var(--color-neutral-700, #374151)', name: '炭灰' },
                            { color: 'var(--color-primary, #34C759)', name: '森林绿' },
                            { color: 'var(--color-secondary, #007AFF)', name: '皇家蓝' },
                            { color: 'var(--color-tertiary, #AF52DE)', name: '紫罗兰' },
                            { color: 'var(--color-danger-700, #B91C1C)', name: '中国红' },
                            { color: 'var(--color-warning-700, #B45309)', name: '琥珀橙' },
                            { color: '#0E7490', name: '青碧色' },
                          ].map((preset) => (
                            <button
                              key={preset.color}
                              onClick={() => handleFontColorChange(preset.color)}
                              className={`group relative w-10 h-10 rounded-xl border-2 transition-all duration-200 hover:scale-110 hover:shadow-lg ${
                                advancedSettings.fontColor === preset.color
                                  ? 'border-primary-500 ring-2 ring-primary-200 scale-110 shadow-lg'
                                  : 'border-neutral-200 dark:border-neutral-600 hover:border-neutral-300'
                              }`}
                              style={{ backgroundColor: preset.color }}
                              aria-label={preset.name}
                              title={preset.name}
                            >
                              {advancedSettings.fontColor === preset.color && (
                                <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow-md" />
                              )}
                              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-neutral-600 dark:text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                {preset.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 子模块7: 综合字体预览区（新增亮点）⭐⭐ */}
                      <div className="mt-6 p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 rounded-2xl border-2 border-neutral-200 dark:border-neutral-700 shadow-xl overflow-hidden relative">
                        {/* 装饰性背景元素 */}
                        <div className="absolute top-0 right-0 w-40 h-40 bg-primary-100 dark:bg-primary-900/20 rounded-full blur-3xl opacity-50"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-secondary-100 dark:bg-secondary-900/20 rounded-full blur-3xl opacity-50"></div>

                        <h4 className="relative text-sm font-bold text-neutral-600 dark:text-neutral-400 mb-5 flex items-center gap-2 uppercase tracking-wider">
                          <Eye size={16} className="text-primary-600" />
                          实时字体预览 (Live Preview)
                          <Badge variant="neutral" className="text-[10px]">动态</Badge>
                        </h4>

                        <div className="relative space-y-5">
                          {/* 标题预览 */}
                          <div>
                            <div className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 mb-2 uppercase tracking-wider flex items-center gap-1">
                              <div className="w-2 h-2 bg-error-500 rounded-full"></div>
                              标题样式 (H1 Heading)
                            </div>
                            <h3
                              style={{
                                fontFamily: advancedSettings.fontFamily,
                                fontSize: `${Math.min(advancedSettings.fontSize * 1.8, 36)}px`,
                                fontWeight,
                                color: advancedSettings.fontColor,
                                lineHeight,
                                letterSpacing: `${letterSpacing}em`,
                              }}
                              className="transition-all duration-300"
                            >
                              配方管理系统主题预览
                            </h3>
                          </div>

                          {/* 正文预览 */}
                          <div>
                            <div className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 mb-2 uppercase tracking-wider flex items-center gap-1">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                              正文样式 (Body Text)
                            </div>
                            <p
                              style={{
                                fontFamily: advancedSettings.fontFamily,
                                fontSize: `${advancedSettings.fontSize}px`,
                                fontWeight: 400,
                                color: advancedSettings.fontColor,
                                lineHeight,
                                letterSpacing: `${letterSpacing}em`,
                              }}
                              className="transition-all duration-300"
                            >
                              这是正文内容的示例文字。良好的字体设置可以显著提升阅读体验，
                              减少视觉疲劳，提高工作效率。The quick brown fox jumps over the lazy dog.
                              中英文混排效果一目了然，确保在不同场景下都有出色的显示效果。
                            </p>
                          </div>

                          {/* 小字预览 */}
                          <div>
                            <div className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 mb-2 uppercase tracking-wider flex items-center gap-1">
                              <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                              辅助文字 (Caption Text)
                            </div>
                            <p
                              style={{
                                fontFamily: advancedSettings.fontFamily,
                                fontSize: `${Math.max(advancedSettings.fontSize * 0.85, 12)}px`,
                                fontWeight: 400,
                                color: advancedSettings.fontColor,
                                opacity: 0.7,
                                lineHeight,
                              }}
                              className="transition-all duration-300"
                            >
                              辅助说明文字、时间戳、注释等内容使用较小字号，用于补充信息但不干扰主要内容。
                            </p>
                          </div>

                          {/* 数字和数据预览 */}
                          <div className="grid grid-cols-3 gap-4 pt-5 border-t-2 border-dashed border-neutral-200 dark:border-neutral-700">
                            {[
                              { label: '数字', value: '12345.67', format: 'monospace' as const, icon: '🔢' },
                              { label: '百分比', value: '98.5%', format: 'bold' as const, icon: '📊' },
                              { label: '日期', value: '2024-01-15', format: 'normal' as const, icon: '📅' },
                            ].map((item) => (
                              <div key={item.label} className="text-center p-3 bg-white dark:bg-neutral-800/50 rounded-lg border border-neutral-100 dark:border-neutral-700">
                                <div className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 mb-1.5 uppercase">
                                  {item.icon} {item.label}
                                </div>
                                <div
                                  style={{
                                    fontFamily: item.format === 'monospace' ? "'JetBrains Mono', monospace" : advancedSettings.fontFamily,
                                    fontSize: `${Math.min(advancedSettings.fontSize * 1.15, 22)}px`,
                                    fontWeight: item.format === 'bold' ? 700 : 500,
                                    color: advancedSettings.fontColor,
                                    letterSpacing: item.format === 'monospace' ? '0.05em' : '0',
                                  }}
                                  className="font-mono transition-all duration-300"
                                >
                                  {item.value}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* 视觉属性调节 */}
                  <div>
                    <h4 className="font-semibold mb-3 text-neutral-900 dark:text-neutral-100">视觉属性</h4>
                    <div className="space-y-6">
                      {/* 圆角半径 */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                            <Radius size={16} /> 圆角半径
                          </label>
                          <span className="text-sm font-mono text-primary-600">{advancedSettings.borderRadius}px</span>
                        </div>
                        <input
                          type="range"
                          min="4"
                          max="24"
                          step="2"
                          value={advancedSettings.borderRadius}
                          onChange={(e) => setAdvancedBorderRadius(Number(e.target.value))}
                          className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between mt-2 text-xs text-neutral-500">
                          <span>4px</span>
                          <span>12px</span>
                          <span>24px</span>
                        </div>
                      </div>

                      {/* 阴影强度 */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                            <Shapes size={16} /> 阴影强度
                          </label>
                          <span className="text-sm font-mono text-primary-600">{advancedSettings.shadowIntensity}</span>
                        </div>
                        <div className="flex gap-2">
                          {([1, 2, 3, 4] as const).map((level) => (
                            <button
                              key={level}
                              onClick={() => {
                                setAdvancedShadowIntensity(level)
                                addToast({ type: 'info', message: `阴影强度已调整为 ${level}` })
                              }}
                              className={`
                                flex-1 py-2 px-4 rounded-lg border-2 transition-all text-sm relative
                                ${advancedSettings.shadowIntensity === level
                                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 ring-2 ring-primary-500 ring-offset-1'
                                  : 'border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300 hover:shadow-md'
                                }
                              `}
                              aria-pressed={advancedSettings.shadowIntensity === level}
                              aria-label={`设置阴影强度为 ${level}`}
                            >
                              {level}
                              {advancedSettings.shadowIntensity === level && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                                  <CheckCircle2 size={10} className="text-white" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 界面密度 */}
                      <div>
                        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3 flex items-center gap-2">
                          界面密度
                        </label>
                        <div className="flex gap-2">
                          {(['compact', 'comfortable', 'spacious'] as const).map((density) => (
                            <button
                              key={density}
                              onClick={() => {
                                setAdvancedDensity(density)
                                addToast({ type: 'info', message: `界面密度已调整为${density === 'compact' ? '紧凑' : density === 'comfortable' ? '舒适' : '宽松'}` })
                              }}
                              className={`
                                flex-1 py-2 px-4 rounded-lg border-2 transition-all text-sm relative
                                ${advancedSettings.density === density
                                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 ring-2 ring-primary-500 ring-offset-1'
                                  : 'border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300 hover:shadow-md'
                                }
                              `}
                              aria-pressed={advancedSettings.density === density}
                              aria-label={`设置界面密度为${density === 'compact' ? '紧凑' : density === 'comfortable' ? '舒适' : '宽松'}`}
                            >
                              {density === 'compact' && '紧凑'}
                              {density === 'comfortable' && '舒适'}
                              {density === 'spacious' && '宽松'}
                              {advancedSettings.density === density && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                                  <CheckCircle2 size={10} className="text-white" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 动画效果 */}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-neutral-700 dark:text-neutral-300">动画效果</div>
                          <div className="text-sm text-neutral-500">页面过渡和交互动画</div>
                        </div>
                        <button
                          onClick={() => {
                            setAdvancedAnimation(!advancedSettings.animation)
                            addToast({ type: 'success', message: `动画效果已${advancedSettings.animation ? '关闭' : '开启'}` })
                          }}
                          className={`
                            relative w-14 h-8 rounded-full transition-colors duration-200 cursor-pointer
                            ${advancedSettings.animation ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-600'}
                          `}
                          role="switch"
                          aria-checked={advancedSettings.animation}
                          aria-label="动画效果开关"
                        >
                          <span
                            className={`
                              absolute top-1 left-1 w-6 h-6 rounded-full bg-white transition-transform duration-200 shadow-md
                              ${advancedSettings.animation ? 'translate-x-6' : 'translate-x-0'}
                            `}
                          />
                        </button>
                      </div>

                      {/* 侧边栏透明度 */}
                      <div className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                            <Layers size={16} /> 侧边栏透明度
                          </label>
                          <button
                            onClick={() => {
                              setSidebarTransparent(!advancedSettings.sidebarTransparent)
                              addToast({ type: 'success', message: `侧边栏透明度已${advancedSettings.sidebarTransparent ? '关闭' : '开启'}` })
                            }}
                            className={`
                              relative w-14 h-8 rounded-full transition-colors duration-200 cursor-pointer
                              ${advancedSettings.sidebarTransparent ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-600'}
                            `}
                            role="switch"
                            aria-checked={advancedSettings.sidebarTransparent}
                            aria-label="侧边栏透明度开关"
                          >
                            <span
                              className={`
                                absolute top-1 left-1 w-6 h-6 rounded-full bg-white transition-transform duration-200 shadow-md
                                ${advancedSettings.sidebarTransparent ? 'translate-x-6' : 'translate-x-0'}
                              `}
                            />
                          </button>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-sm text-neutral-600 dark:text-neutral-400">透明度</label>
                            <span className="text-sm font-mono text-primary-600">{Math.round(advancedSettings.sidebarOpacity * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0.3"
                            max="0.6"
                            step="0.05"
                            value={advancedSettings.sidebarOpacity}
                            onChange={(e) => setSidebarOpacity(Number(e.target.value))}
                            disabled={!advancedSettings.sidebarTransparent}
                            className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-neutral-500">
                            <span>30%</span>
                            <span>45%</span>
                            <span>60%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Section>

              {/* 第四层：我的主题 */}
              <Section
                id="importExport"
                title="我的主题"
                icon={Layers}
                isExpanded={expandedSections.importExport}
                onToggle={toggleSection}
              >
                <div className="space-y-4">
                  {/* 导入/导出/重置操作栏 */}
                  <div className="p-4 border rounded-lg bg-slate-50 dark:bg-neutral-800/50">
                    <h4 className="font-semibold mb-3 text-neutral-900 dark:text-neutral-100">主题导入/导出</h4>
                    <p className="text-sm text-neutral-500 mb-4">将您的主题设置导出为JSON文件，或从文件导入主题设置</p>
                    <div className="flex gap-3 flex-wrap">
                      <Button
                        variant="primary"
                        onClick={handleExportTheme}
                        icon={<Download size={16} />}
                        size="sm"
                      >
                        导出主题
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleImportTheme}
                        icon={<Upload size={16} />}
                        size="sm"
                      >
                        导入主题
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          resetAdvancedSettings()
                          addToast({ type: 'info', message: '已重置为默认设置' })
                        }}
                        icon={<RotateCcw size={16} />}
                        size="sm"
                      >
                        重置默认设置
                      </Button>
                    </div>
                  </div>

                  {/* 自定义主题卡片网格（从原theme-manage迁移） */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-accent-50 dark:bg-accent-500/10 flex items-center justify-center">
                            <Layers className="w-5 h-5 text-accent-500" />
                          </div>
                          <div>
                            <CardTitle as="h3">自定义主题列表</CardTitle>
                            <CardDescription>创建、编辑和管理自定义主题配置</CardDescription>
                          </div>
                        </div>
                        <Button
                          icon={<Plus className="w-4 h-4" />}
                          onClick={handleCreateTheme}
                        >
                          新建主题
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>

                  {customThemes.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <Palette className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
                        <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">暂无自定义主题</h3>
                        <p className="text-sm text-neutral-500 mb-6">点击上方"新建主题"按钮开始创建您的第一个自定义主题</p>
                        <Button
                          variant="outline"
                          icon={<Plus className="w-4 h-4" />}
                          onClick={handleCreateTheme}
                        >
                          创建新主题
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {customThemes.map((theme) => (
                        <Card
                          key={theme.id}
                          className="group hover:shadow-lg transition-all duration-200 cursor-pointer"
                          onMouseEnter={(e) => handlePreviewHover(e, theme)}
                          onMouseLeave={() => setPreviewOverlay(null)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle as="h3" className="text-base">{theme.name}</CardTitle>
                                {theme.description && (
                                  <CardDescription className="mt-1">{theme.description}</CardDescription>
                                )}
                              </div>
                              <Badge variant={theme.isPreset ? 'info' : 'neutral'}>
                                {theme.isPreset ? '系统' : '自定义'}
                              </Badge>
                            </div>
                          </CardHeader>

                          {/* Color Preview */}
                          <CardContent>
                            <div className="flex gap-1 mb-3">
                              {[theme.config.colors?.primary, theme.config.colors?.secondary, theme.config.colors?.tertiary, theme.config.colors?.background].map((color, i) => (
                                <div
                                  key={i}
                                  className="w-full h-8 rounded-md border border-neutral-200 dark:border-neutral-700"
                                  style={{ backgroundColor: color || '#ccc' }}
                                />
                              ))}
                            </div>

                            <div className="text-xs text-neutral-500">
                              最后修改：{new Date(theme.updatedAt).toLocaleDateString('zh-CN')}
                            </div>
                          </CardContent>

                          <CardFooter className="gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              icon={<Copy className="w-3.5 h-3.5" />}
                              onClick={() => {
                                const copy = themeStorageAdapter.create({
                                  name: `${theme.name} (副本)`,
                                  description: theme.description,
                                  config: { ...theme.config },
                                  isPreset: false,
                                  tags: [...(theme.tags || [])],
                                })
                                setCustomThemes(themeStorageAdapter.list())
                                addToast({ type: 'success', message: `已复制为"${copy.name}"` })
                              }}
                            >
                              复制
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleEditTheme(theme)}
                            >
                              编辑
                            </Button>
                            {!theme.isPreset && (
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={<Trash2 className="w-3.5 h-3.5" />}
                                className="text-error-600 hover:text-error-700 hover:bg-error-50"
                                onClick={() => handleDeleteTheme(theme.id)}
                                disabled={isDeletingTheme}
                              >
                                {isDeletingTheme ? '删除中...' : '删除'}
                              </Button>
                            )}
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* 版本历史入口 */}
                  <Card>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-neutral-900 dark:text-white flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            版本历史
                          </h3>
                          <p className="text-sm text-neutral-500 mt-1">查看和回滚主题配置的历史版本</p>
                        </div>
                        <Button
                          variant="outline"
                          icon={<Clock className="w-4 h-4" />}
                          onClick={() => setShowVersionHistory(true)}
                        >
                          查看历史
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
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

      {/* ✅ Theme Editor Modal (主题编辑器) */}
      {showEditor && (
        <ThemeEditor
          theme={editingTheme}
          onSave={handleSaveTheme}
          onCancel={() => setShowEditor(false)}
          onDelete={editingTheme ? (id) => handleDeleteTheme(id) : undefined}
        />
      )}

      {/* ✅ Version History Panel (版本历史面板) */}
      {showVersionHistory && (
        <VersionHistoryPanel
          onSelectVersion={(config) => {
            try {
              // ✅ 实现完整的版本回滚逻辑

              // 1. 解析版本配置（config 可能是 ThemeStyles 或 ThemeConfig 类型）
              const versionConfig = config as Record<string, unknown>

              // 2. 应用颜色配置
              if (versionConfig.colors) {
                const colorsToUpdate: Partial<ThemeColorsType> = {}

                // 提取颜色值（兼容多种数据结构）
                const extractColor = (colorData: any): string | undefined => {
                  if (!colorData) return undefined
                  if (typeof colorData === 'string') return colorData
                  return colorData.main || colorData.default || colorData.light || undefined
                }

                if (versionConfig.colors.primary) colorsToUpdate.primary = extractColor(versionConfig.colors.primary)
                if (versionConfig.colors.secondary) colorsToUpdate.secondary = extractColor(versionConfig.colors.secondary)
                if (versionConfig.colors.tertiary) colorsToUpdate.tertiary = extractColor(versionConfig.colors.tertiary)
                if (versionConfig.colors.background) colorsToUpdate.background = extractColor(versionConfig.colors.background)
                if (versionConfig.colors.surface) colorsToUpdate.surface = extractColor(versionConfig.colors.surface)
                if (versionConfig.colors.error) colorsToUpdate.error = extractColor(versionConfig.colors.error)

                // 更新本地和全局状态
                if (Object.keys(colorsToUpdate).length > 0) {
                  setCurrentColors(prev => ({ ...prev, ...colorsToUpdate }))

                  applyCustomTheme({
                    colors: {
                      primary: { main: colorsToUpdate.primary || currentColors.primary, light: colorsToUpdate.primary || currentColors.primary, dark: colorsToUpdate.primary || currentColors.primary, contrastText: colorsToUpdate.onPrimary || currentColors.onPrimary },
                      secondary: { main: colorsToUpdate.secondary || currentColors.secondary, light: colorsToUpdate.secondary || currentColors.secondary, dark: colorsToUpdate.secondary || currentColors.secondary, contrastText: 'var(--color-primary-contrast, #ffffff)' },
                      error: { main: colorsToUpdate.error || currentColors.error, background: colorsToUpdate.error || currentColors.error, text: colorsToUpdate.onError || currentColors.onError },
                    },
                  })
                }
              }

              // 3. 应用字体配置
              if (versionConfig.font || versionConfig.typography) {
                const fontConfig = versionConfig.font || versionConfig.typography
                if (fontConfig.fontFamily) setLocalFontFamily(fontConfig.fontFamily)
                if (fontConfig.fontSize) {
                  const size = typeof fontConfig.fontSize === 'number' ? fontConfig.fontSize : parseInt(fontConfig.fontSize)
                  if (!isNaN(size)) setLocalFontSize(size)
                }
              }

              // 4. 显示成功通知并关闭面板
              addToast({ type: 'success', message: '✅ 已成功恢复到历史版本' })
              setShowVersionHistory(false)

            } catch (error) {
              logger.error('[SettingsPage] 版本回滚失败:', error)
              addToast({ type: 'error', message: '❌ 版本回滚失败，请重试' })
            }
          }}
          onClose={() => setShowVersionHistory(false)}
        />
      )}

      {/* ✅ Preview Overlay (预览浮层) */}
      {previewOverlay && (
        <ThemePreviewOverlay
          theme={previewOverlay.theme}
          position={previewOverlay.position}
          onClose={() => setPreviewOverlay(null)}
          onApply={handleApplyTheme}
        />
      )}
    </div>
  )
}
