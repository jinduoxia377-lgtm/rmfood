import React, { useState, useEffect, useCallback } from 'react'
import { logger } from '@/utils/safeLogger'
import type { PluginSettingItem, PluginSettingsSchema } from './pluginTypes'

interface PluginSettingsProps {
  pluginId: string
  schema: PluginSettingsSchema
  settings: Record<string, unknown>
  onSettingsChange?: (settings: Record<string, unknown>) => void
  readOnly?: boolean
}

interface SettingChangeEvent {
  key: string
  value: unknown
  previousValue: unknown
}

export const PluginSettings: React.FC<PluginSettingsProps> = ({
  pluginId,
  schema,
  settings,
  onSettingsChange,
  readOnly = false,
}) => {
  const [currentSettings, setCurrentSettings] = useState<Record<string, unknown>>(settings)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Set<string>>(new Set())

  useEffect(() => {
    setCurrentSettings(settings)
    setErrors({})
    setTouched(new Set())
  }, [pluginId, settings])

  useEffect(() => {
    saveToLocalStorage()
  }, [currentSettings])

  const validateSetting = useCallback((item: PluginSettingItem, value: unknown): string | null => {
    if (!item.validation) return null

    if (item.validation.required && (value === undefined || value === null || value === '')) {
      return item.label + ' 为必填项'
    }

    if (typeof value === 'number') {
      if (item.validation.min !== undefined && value < item.validation.min) {
        return '值不能小于 ' + item.validation.min
      }
      if (item.validation.max !== undefined && value > item.validation.max) {
        return '值不能大于 ' + item.validation.max
      }
    }

    if (item.validation.pattern && typeof value === 'string') {
      const regex = new RegExp(item.validation.pattern)
      if (!regex.test(value)) {
        return '格式不匹配要求'
      }
    }

    return null
  }, [])

  const handleSettingChange = useCallback(
    (key: string, value: unknown) => {
      const item = schema[key]
      if (!item) return

      const previousValue = currentSettings[key]

      const newSettings = { ...currentSettings, [key]: value }
      setCurrentSettings(newSettings)

      setTouched((prev) => new Set(prev).add(key))

      if (item) {
        const error = validateSetting(item, value)
        setErrors((prev) => ({
          ...prev,
          [key]: error || '',
        }))
      }

      const event: SettingChangeEvent = { key, value, previousValue }
      logger.debug('[PluginSettings] 配置变更:', event)

      if (onSettingsChange) {
        onSettingsChange(newSettings)
      }
    },
    [currentSettings, schema, validateSetting, onSettingsChange],
  )

  const saveToLocalStorage = useCallback(() => {
    try {
      const storageKey = 'plugin_settings_' + pluginId
      localStorage.setItem(storageKey, JSON.stringify(currentSettings))
      logger.debug('[PluginSettings] 配置已持久化到 localStorage [key: ' + storageKey + ']')
    } catch (error) {
      logger.error('[PluginSettings] 配置保存失败:', { error })
    }
  }, [pluginId, currentSettings])

  const resetToDefaults = useCallback(() => {
    const defaults: Record<string, unknown> = {}
    Object.entries(schema).forEach(([key, item]) => {
      defaults[key] = item.defaultValue
    })
    setCurrentSettings(defaults)
    setErrors({})
    setTouched(new Set())

    if (onSettingsChange) {
      onSettingsChange(defaults)
    }

    logger.info('[PluginSettings] 已重置为默认配置 [pluginId: ' + pluginId + ']')
  }, [schema, pluginId, onSettingsChange])

  const renderSettingItem = (key: string, item: PluginSettingItem): React.ReactNode => {
    const value = currentSettings[key] ?? item.defaultValue
    const hasError = !!errors[key]
    const isTouched = touched.has(key)

    const baseClassName =
      'w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-secondary-500' +
      (readOnly ? ' bg-neutral-100 dark:bg-neutral-800 cursor-not-allowed' : '') +
      (hasError && isTouched ? ' border-error-500' : ' border-neutral-300 dark:border-neutral-700')

    switch (item.type) {
      case 'string':
        return (
          <input
            type="text"
            className={baseClassName}
            value={value as string}
            onChange={(e) => handleSettingChange(key, e.target.value)}
            disabled={readOnly}
            placeholder={'请输入' + item.label}
          />
        )

      case 'number':
        return (
          <input
            type="number"
            className={baseClassName}
            value={value as number}
            onChange={(e) => handleSettingChange(key, Number(e.target.value))}
            disabled={readOnly}
            min={item.validation?.min}
            max={item.validation?.max}
            step="any"
        aria-label={item.label}
      />
        )

      case 'boolean':
        return (
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 text-secondary-600 rounded focus:ring-secondary-500"
              checked={value as boolean}
              onChange={(e) => handleSettingChange(key, e.target.checked)}
              disabled={readOnly}
            />
            <span className="text-sm text-neutral-700">{value ? '启用' : '禁用'}</span>
          </label>
        )

      case 'select':
        return (
          <select
            className={baseClassName}
            value={value as string}
            onChange={(e) => handleSettingChange(key, e.target.value)}
            disabled={readOnly}
          >
            {(item.options || []).map((option) => (
              <option key={String(option.value)} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )

      default:
        return (
          <div className="text-error-500 text-sm">不支持的配置类型: {item.type}</div>
        )
    }
  }

  if (!schema || Object.keys(schema).length === 0) {
    return (
      <div className="p-4 text-center text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
        该插件没有可配置的选项
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-800">插件配置</h3>
        {!readOnly && (
          <button
            onClick={resetToDefaults}
            className="px-3 py-1 text-sm text-secondary-600 hover:text-secondary-800 transition-colors"
          >
            恢复默认
          </button>
        )}
      </div>

      <div className="space-y-4">
        {Object.entries(schema).map(([key, item]) => (
          <div key={key} className="space-y-2">
            <label className="block text-sm font-medium text-neutral-700">
              {item.label}
              {item.validation?.required && <span className="text-error-500 ml-1">*</span>}
            </label>

            {renderSettingItem(key, item)}

            {item.description && (
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{item.description}</p>
            )}

            {errors[key] && touched.has(key) && (
              <p className="text-xs text-error-500 mt-1">{errors[key]}</p>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">配置将自动保存到本地存储</p>
        </div>
      )}
    </div>
  )
}

export default PluginSettings
