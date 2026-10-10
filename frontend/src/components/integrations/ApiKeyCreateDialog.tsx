/**
 * API 密钥创建 Dialog（共享组件）
 *
 * 封装「创建密钥」完整流程：
 *   - 名称 + 过期天数 + 权限范围（scopes，后端 /integrations/api-keys/scopes，失败时前端兜底）
 *   - 调 POST /integrations/api-keys 写入后端 api_keys 表
 *   - 创建成功后独立弹窗一次性展示后端返回的明文密钥（关闭后不可再看）
 *
 * 由 /settings（API Tab）与 /integrations（API 密钥 Tab）复用，避免两处重复逻辑。
 * 父组件仅需控制 open/onOpenChange，并在 onCreated 中刷新自己的密钥列表。
 */
import { useState, useRef } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Key, Copy, CheckCircle, AlertCircle } from 'lucide-react'
import {
  Button, Input,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { createAPIKey, listScopes, type APIKeyFull } from '@/api/integrations'

// 后端真实 API 密钥权限范围（与 GET /integrations/api-keys/scopes 对齐，接口失败时前端兜底）
const API_SCOPE_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: 'read',                 label: '读取权限',     description: '读取配方、实验等数据' },
  { value: 'write',                label: '写入权限',     description: '创建、修改数据' },
  { value: 'delete',               label: '删除权限',     description: '删除数据' },
  { value: 'admin',                label: '管理员权限',   description: '完整的管理员访问权限' },
  { value: 'ai:generate',          label: 'AI 生成',      description: '调用 AI 配方生成' },
  { value: 'analytics:read',       label: '数据分析',     description: '访问分析报表' },
  { value: 'webhooks:manage',      label: 'Webhook 管理', description: '管理 Webhook' },
  { value: 'integrations:manage',  label: '集成管理',     description: '管理第三方集成' },
]

export interface ApiKeyCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 创建成功后回调（父组件据此刷新密钥列表） */
  onCreated?: () => void
}

export default function ApiKeyCreateDialog({ open, onOpenChange, onCreated }: ApiKeyCreateDialogProps) {
  const { addToast } = useToast()

  // 可用权限范围（后端 /integrations/api-keys/scopes，接口失败时前端兜底）
  const { data: scopesData } = useQuery({
    queryKey: ['integrations-api-key-scopes'],
    queryFn: listScopes,
    staleTime: 60_000,
    retry: 1,
  })
  const scopeOptions = scopesData?.scopes?.length
    ? scopesData.scopes.map(s => ({ value: s.value, label: s.label, description: s.description }))
    : API_SCOPE_OPTIONS

  // 创建密钥
  const createKeyMutation = useMutation({
    mutationFn: (payload: { name: string; scopes: string[]; expires_in_days?: number }) =>
      createAPIKey(payload),
    onSuccess: (res) => {
      onCreated?.()
      addToast({ type: 'success', message: 'API 密钥已创建' })
      // 展示后端返回的明文密钥（仅此一次）
      const full = res?.api_key as APIKeyFull | undefined
      if (full?.key) {
        setCreatedKey({ name: full.name, key: full.key, prefix: full.key_prefix })
        onOpenChange(false)
      }
    },
    onError: (e: unknown) => {
      addToast({ type: 'error', message: (e instanceof Error && 'response' in e)
        ? String((e as { response?: { data?: { detail?: unknown } } }).response?.data?.detail ?? '') || '创建失败'
        : '创建失败' })
    },
  })

  // ── 创建 Dialog 状态 ────────────────────────────────────────────
  const [newName, setNewName] = useState('')
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['read'])
  // 过期天数：字符串以保持「留空 = 永不过期」语义；空值不传给后端（undefined）
  const [expiryDays, setExpiryDays] = useState('')
  // 创建成功后待展示的明文密钥（一次性）
  const [createdKey, setCreatedKey] = useState<{ name: string; key: string; prefix: string } | null>(null)
  const createRef = useRef<HTMLDivElement>(null)
  useFocusTrap(createRef, open || !!createdKey, () => { onOpenChange(false); setCreatedKey(null) })

  const toggleScope = (v: string) =>
    setSelectedScopes(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])

  const submitCreate = () => {
    if (!newName.trim()) { addToast({ type: 'error', message: '请输入密钥名称' }); return }
    if (selectedScopes.length === 0) { addToast({ type: 'error', message: '请至少选择一项权限' }); return }
    // 留空 = 永不过期（undefined）；填写则解析为整数（非法值按不过期处理并提示）
    let expires_in_days: number | undefined
    if (expiryDays.trim() !== '') {
      const n = parseInt(expiryDays, 10)
      if (Number.isNaN(n) || n <= 0) {
        addToast({ type: 'error', message: '过期天数须为正整数，或留空表示永不过期' })
        return
      }
      expires_in_days = n
    }
    createKeyMutation.mutate({ name: newName.trim(), scopes: selectedScopes, expires_in_days })
  }

  const copyPlainKey = () => {
    if (createdKey) { navigator.clipboard.writeText(createdKey.key); addToast({ type: 'success', message: '密钥已复制到剪贴板' }) }
  }

  return (
    <>
      {/* 创建密钥 Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent ref={createRef} size="sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-4 h-4 text-accent-500" />创建新 API 密钥
            </DialogTitle>
            <DialogDescription>为应用程序生成访问凭证（明文仅展示一次）</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">密钥名称</label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="例如：生产环境、测试工具" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">过期天数（可选）</label>
              <Input type="number" min={1} max={365} value={expiryDays} placeholder="留空 = 永不过期"
                onChange={e => setExpiryDays(e.target.value)} />
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">留空表示永不过期；填写 1–365 天内整数表示相对当前的过期时间</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">权限范围</label>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {scopeOptions.map(s => (
                  <label key={s.value} className="flex items-start gap-2.5 cursor-pointer rounded-lg border border-neutral-200 dark:border-neutral-700 p-2.5 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
                    <input type="checkbox" checked={selectedScopes.includes(s.value)}
                      onChange={() => toggleScope(s.value)}
                      className="mt-0.5 rounded border-neutral-300 dark:border-neutral-700 text-primary-700 focus:ring-primary-500" />
                    <span className="min-w-0">
                      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{s.label}</span>
                      {s.description && <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{s.description}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
            <Button variant="primary" loading={createKeyMutation.isPending} onClick={submitCreate}>创建密钥</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 一次性明文密钥展示 */}
      <Dialog open={!!createdKey} onOpenChange={open2 => { if (!open2) setCreatedKey(null) }}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-success-600" />密钥创建成功
            </DialogTitle>
            <DialogDescription>请立即复制并妥善保存，此密钥不会再次显示。</DialogDescription>
          </DialogHeader>
          {createdKey && (
            <div className="space-y-3">
              <p className="text-xs text-neutral-500">名称：<span className="text-neutral-700 dark:text-neutral-300 font-medium">{createdKey.name}</span></p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono px-3 py-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 break-all text-neutral-700 dark:text-neutral-300">
                  {createdKey.key}
                </code>
                <Button variant="outline" size="icon" title="复制完整密钥" onClick={copyPlainKey}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-warning-600 dark:text-warning-700 flex items-start gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                关闭后无法再次查看明文。建议立即复制并保存到密码管理器中。
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="primary" onClick={() => { copyPlainKey(); setCreatedKey(null) }}>我已复制，关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}