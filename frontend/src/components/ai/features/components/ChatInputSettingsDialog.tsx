/**
 * ChatInputSettingsDialog - 输入框设置对话框
 *
 * 功能特性：
 * ✅ 输入框行为配置（自动聚焦、自动调整高度、Enter发送等）
 * ✅ 快捷键自定义（发送消息、换行、深度思考、智能搜索等）
 * ✅ 个性化偏好设置
 * ✅ 与 UserPreferencesService 集成
 * ✅ 实时预览快捷键配置
 * ✅ 支持重置为默认值
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-21
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Keyboard, MessageSquare, RotateCcw, Check, X, AlertCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import {
  userPreferencesService,
  type HotkeyAction,
  type HotkeyConfig,
  type InputBehaviorConfig,
} from '../services/userPreferencesService';

export interface ChatInputSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const HOTKEY_ACTION_LABELS: Record<HotkeyAction, { label: string; description: string }> = {
  sendMessage: { label: '发送消息', description: '发送当前输入的消息' },
  newLine: { label: '插入换行', description: '在输入框中插入换行符' },
  toggleDeepThinking: { label: '深度思考', description: '切换深度思考模式' },
  toggleSmartSearch: { label: '智能搜索', description: '切换智能搜索功能' },
  clearInput: { label: '清空输入', description: '清空输入框内容' },
};

const ChatInputSettingsDialog: React.FC<ChatInputSettingsDialogProps> = ({ open, onClose }) => {
  const [inputBehavior, setInputBehavior] = useState<InputBehaviorConfig>(userPreferencesService.getInputBehavior());

  const [hotkeys, setHotkeys] = useState<Partial<Record<HotkeyAction, HotkeyConfig>>>(
    userPreferencesService.getPreferences().hotkeys,
  );

  const [editingHotkey, setEditingHotkey] = useState<HotkeyAction | null>(null);
  const [recordingKey, setRecordingKey] = useState<HotkeyAction | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInputBehavior(userPreferencesService.getInputBehavior());
       
      setHotkeys(userPreferencesService.getPreferences().hotkeys);
       
      setErrors({});
    }
  }, [open]);

  const handleInputBehaviorChange = useCallback((key: keyof InputBehaviorConfig, value: boolean | number) => {
    setInputBehavior((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleHotkeyChange = useCallback((action: HotkeyAction, field: keyof HotkeyConfig, value: string | boolean) => {
    setHotkeys((prev) => ({
      ...prev,
      [action]: {
        ...prev[action],
        [field]: value,
      },
    }));
    // eslint-disable-next-line react-hooks/immutability
    delete errors[action];
  }, []);

  const handleRecordHotkey = useCallback((action: HotkeyAction) => {
    setRecordingKey(action);
    setEditingHotkey(action);
    setHotkeys((prev) => ({
      ...prev,
      [action]: { key: '', ctrl: false, shift: false, alt: false, meta: false },
    }));
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!recordingKey) return;

      e.preventDefault();
      e.stopPropagation();

      const key = e.key === ' ' ? 'Space' : e.key;

      if (key === 'Escape') {
        setRecordingKey(null);
        const defaultConfig = userPreferencesService.getHotkey(recordingKey);
        if (defaultConfig) {
          setHotkeys((prev) => ({ ...prev, [recordingKey]: defaultConfig }));
        }
        return;
      }

      // 忽略修饰键单独按下
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
        return;
      }

      setHotkeys((prev) => ({
        ...prev,
        [recordingKey]: {
          key,
          ctrl: e.ctrlKey || e.metaKey,
          shift: e.shiftKey,
          alt: e.altKey,
          meta: e.metaKey,
        },
      }));

      setRecordingKey(null);
    },
    [recordingKey],
  );

  useEffect(() => {
    if (recordingKey) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    return;
  }, [recordingKey, handleKeyDown]);

  const validateHotkey = useCallback(
    (action: HotkeyAction): string | null => {
      const config = hotkeys[action];
      if (!config?.key || config.key.trim() === '') {
        return `${HOTKEY_ACTION_LABELS[action].label} 的快捷键不能为空`;
      }
      return null;
    },
    [hotkeys],
  );

  const formatHotkey = (config: HotkeyConfig | undefined): string => {
    if (!config?.key) return '-';
    const parts: string[] = [];
    if (config.ctrl || config.meta) parts.push('Ctrl');
    if (config.alt) parts.push('Alt');
    if (config.shift) parts.push('Shift');
    parts.push(config.key.toUpperCase());
    return parts.join(' + ');
  };

  const handleResetHotkey = useCallback((action: HotkeyAction) => {
    const defaultConfig = userPreferencesService.getHotkey(action);
    if (defaultConfig) {
      setHotkeys((prev) => ({ ...prev, [action]: defaultConfig }));
      // eslint-disable-next-line react-hooks/immutability
      delete errors[action];
    }
  }, []);

  const handleResetAllHotkeys = useCallback(() => {
    userPreferencesService.resetAllHotkeys();
    setHotkeys(userPreferencesService.getPreferences().hotkeys);
    setErrors({});
  }, []);

  const handleSave = useCallback(() => {
    // 验证所有快捷键
    const newErrors: Record<string, string> = {};
    (['sendMessage', 'newLine', 'toggleDeepThinking', 'toggleSmartSearch', 'clearInput'] as HotkeyAction[]).forEach(
      (action) => {
        const error = validateHotkey(action);
        if (error) {
          newErrors[action] = error;
        }
      },
    );

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // 保存输入行为配置
    userPreferencesService.setInputBehavior(inputBehavior);

    // 保存快捷键配置
    Object.entries(hotkeys).forEach(([action, config]) => {
      if (config) {
        userPreferencesService.setHotkey(action as HotkeyAction, config);
      }
    });

    onClose();
  }, [inputBehavior, hotkeys, validateHotkey, onClose]);

  const handleResetAll = useCallback(() => {
    userPreferencesService.resetAll();
    setInputBehavior(userPreferencesService.getInputBehavior());
    setHotkeys(userPreferencesService.getPreferences().hotkeys);
    setErrors({});
  }, []);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="输入框设置"
      description="自定义输入框行为、快捷键及个性化偏好"
      size="xl"
    >
      <div className="space-y-6">
        {/* 标签页切换 */}
        <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-700">
          <button className="px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 border-primary-500 text-primary-700 dark:text-primary-700 -mb-px">
            <MessageSquare className="w-4 h-4 inline-block mr-1" />
            输入行为
          </button>
          <button className="px-4 py-2 text-sm font-medium rounded-t-lg text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
            <Keyboard className="w-4 h-4 inline-block mr-1" />
            快捷键
          </button>
        </div>

        {/* 输入行为设置 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-neutral-900 dark:text-white">自动聚焦</h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">打开对话框时自动聚焦到输入框</p>
            </div>
            <Switch
              checked={inputBehavior.autoFocus}
              onCheckedChange={(checked) => handleInputBehaviorChange('autoFocus', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-neutral-900 dark:text-white">自动调整高度</h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">根据内容自动调整输入框高度</p>
            </div>
            <Switch
              checked={inputBehavior.autoResize}
              onCheckedChange={(checked) => handleInputBehaviorChange('autoResize', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-neutral-900 dark:text-white">Enter 发送消息</h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                按 Enter 键发送消息，Shift + Enter 换行
              </p>
            </div>
            <Switch
              checked={inputBehavior.enterToSend}
              onCheckedChange={(checked) => handleInputBehaviorChange('enterToSend', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-neutral-900 dark:text-white">显示字符计数</h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">在输入框右下角显示已输入字符数</p>
            </div>
            <Switch
              checked={inputBehavior.showCharCount}
              onCheckedChange={(checked) => handleInputBehaviorChange('showCharCount', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-neutral-900 dark:text-white">显示建议</h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">在输入时显示智能建议和提示</p>
            </div>
            <Switch
              checked={inputBehavior.showSuggestions}
              onCheckedChange={(checked) => handleInputBehaviorChange('showSuggestions', checked)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-neutral-900 dark:text-white">最小高度</h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">输入框最小高度（像素）</p>
              </div>
              <Input
                type="number"
                size="sm"
                value={inputBehavior.minHeight}
                onChange={(e) => handleInputBehaviorChange('minHeight', parseInt(e.target.value) || 40)}
                className="w-20"
                min="20"
                max="100"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-neutral-900 dark:text-white">最大高度</h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">输入框最大高度（像素）</p>
              </div>
              <Input
                type="number"
                size="sm"
                value={inputBehavior.maxHeight}
                onChange={(e) => handleInputBehaviorChange('maxHeight', parseInt(e.target.value) || 160)}
                className="w-20"
                min="80"
                max="300"
              />
            </div>
          </div>
        </div>

        {/* 快捷键设置 */}
        <div className="border-t border-neutral-200 dark:border-neutral-700 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <Keyboard className="w-4 h-4" />
              快捷键配置
            </h3>
            <button
              onClick={handleResetAllHotkeys}
              className="text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              重置所有
            </button>
          </div>

          <div className="space-y-3">
            {(
              ['sendMessage', 'newLine', 'toggleDeepThinking', 'toggleSmartSearch', 'clearInput'] as HotkeyAction[]
            ).map((action) => {
              const config = hotkeys[action];
              const isRecording = recordingKey === action;
              const isEditing = editingHotkey === action;
              const error = errors[action];

              return (
                <div
                  key={action}
                  className={`p-3 rounded-lg border transition-all ${
                    isRecording
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-300/20'
                      : error
                        ? 'border-error-300 bg-error-50 dark:bg-error-300/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-neutral-900 dark:text-white">
                        {HOTKEY_ACTION_LABELS[action].label}
                      </h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {HOTKEY_ACTION_LABELS[action].description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* 快捷键显示/编辑 */}
                      <div className="flex items-center gap-1">
                        {isRecording ? (
                          <div className="px-3 py-1.5 bg-primary-100 dark:bg-primary-800 rounded-lg">
                            <span className="text-xs font-mono text-primary-700 dark:text-primary-200 animate-pulse">
                              正在录制...
                            </span>
                          </div>
                        ) : isEditing ? (
                          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
                            <button
                              onClick={() => handleHotkeyChange(action, 'ctrl', !config?.ctrl)}
                              className={`px-2 py-0.5 text-xs font-mono rounded transition-colors ${
                                config?.ctrl
                                  ? 'bg-primary-container text-primary-main'
                                  : 'text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                              }`}
                            >
                              Ctrl
                            </button>
                            <button
                              onClick={() => handleHotkeyChange(action, 'alt', !config?.alt)}
                              className={`px-2 py-0.5 text-xs font-mono rounded transition-colors ${
                                config?.alt
                                  ? 'bg-primary-container text-primary-main'
                                  : 'text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                              }`}
                            >
                              Alt
                            </button>
                            <button
                              onClick={() => handleHotkeyChange(action, 'shift', !config?.shift)}
                              className={`px-2 py-0.5 text-xs font-mono rounded transition-colors ${
                                config?.shift
                                  ? 'bg-primary-container text-primary-main'
                                  : 'text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                              }`}
                            >
                              Shift
                            </button>
                            <Input
                              type="text"
                              size="sm"
                              value={config?.key || ''}
                              onChange={(e) => handleHotkeyChange(action, 'key', e.target.value)}
                              placeholder="按键"
                              className="w-14 text-center font-mono"
                              maxLength={10}
                            />
                          </div>
                        ) : (
                          <div className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                            <span className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                              {formatHotkey(config)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => setEditingHotkey(null)}
                              className="p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
                              title="完成编辑"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingHotkey(null);
                                handleResetHotkey(action);
                              }}
                              className="p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
                              title="取消"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleRecordHotkey(action)}
                              className="p-1.5 text-neutral-500 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg"
                              title="录制快捷键"
                            >
                              <Keyboard className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingHotkey(action)}
                              className="p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
                              title="手动编辑"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleResetHotkey(action)}
                              className="p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
                              title="重置为默认"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-error-600 dark:text-error-600">
                      <AlertCircle className="w-3 h-3" />
                      {error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
            💡 提示：点击录制按钮后，直接按下想要设置的快捷键组合即可自动记录
          </p>
        </div>

        {/* 底部操作按钮 */}
        <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={handleResetAll}
            className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4 inline-block mr-1" />
            重置所有设置
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-primary-main bg-primary-container hover:bg-primary-container rounded-lg transition-colors"
            >
              保存设置
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

ChatInputSettingsDialog.displayName = 'ChatInputSettingsDialog';

export { ChatInputSettingsDialog };
export default ChatInputSettingsDialog;
