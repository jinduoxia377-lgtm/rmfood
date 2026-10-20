import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button } from '@/components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/auth';
import { ShieldAlert, Lock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 账户注销卡片（GDPR/个保法"被遗忘权"闭环）
 *
 * 设计说明：
 * - 账户注销是 P0 级隐私功能，隐私政策承诺"可随时注销账户"
 * - 调用后端 DELETE /auth/me（需确认文本 DELETE MY ACCOUNT），
 *   后端软删除（is_active=False + 匿名化用户名/邮箱）并清除 2FA 与活跃设备，
 *   个人数据保留 30 天窗口后由后台 job 彻底删除用户行
 * - 管理员账户不允许自助注销（后端 403），前端透传错误提示
 * - 成功后清空本地 auth store 并跳转 /login
 */
export const AccountDeactivationSection: React.FC = () => {
  const { addToast } = useToast();
  const { logout } = useAuthStore();

  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE MY ACCOUNT') return;
    setDeleting(true);
    try {
      const { default: api } = await import('@/api/client');
      // 后端 DELETE /auth/me 接受 JSON body { confirm: 'DELETE MY ACCOUNT' }
      const { data } = await api.delete('/auth/me', {
        data: { confirm: 'DELETE MY ACCOUNT' },
      });
      // 成功路径：清空本地并跳转
      await logout();
      addToast({
        type: 'success',
        message: data?.message || '账户已注销，30 天内彻底清除数据',
      });
      setTimeout(() => { window.location.href = '/login' }, 1500);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { detail?: string } } };
      const detail = e.response?.data?.detail;
      if (e.response?.status === 405 || e.response?.status === 404) {
        // 端点未部署 → 降级为"请求管理员停用"
        addToast({
          type: 'info',
          message: '自助注销端点尚未上线，请联系管理员在"用户管理"中停用您的账户',
        });
      } else {
        addToast({
          type: 'error',
          message: detail || '注销请求失败',
        });
      }
    } finally {
      setDeleting(false);
      setShowConfirm(false);
      setConfirmText('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-[var(--space-apple-sm)]">
          <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-danger-50 dark:bg-danger-500/10 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-danger-600 dark:text-danger-700" />
          </div>
          <div>
            <CardTitle as="h2" className="text-base font-semibold tracking-tight">账户注销</CardTitle>
            <CardDescription>不可撤销 · 30 天内彻底清除您的个人数据</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-[var(--space-apple-sm)]">
        <ul className="text-xs text-[var(--text-muted)] space-y-1.5 list-disc list-inside">
          <li>注销后立即失去访问权限，所有配方/实验/聊天记录在 30 天内从生产库与备份中清除</li>
          <li>法律要求保留的数据（合规审计日志）将按相关法规继续保留</li>
          <li>如仅想停止使用而非清除数据，建议先在"数据"Tab 导出您的数据</li>
        </ul>
      </CardContent>
      <CardFooter className="justify-end">
        <Button variant="danger" onClick={() => setShowConfirm(true)} icon={<Lock className="w-4 h-4" />}>
          注销我的账户
        </Button>
      </CardFooter>

      {/* 确认 Dialog：输入确认文本防误触（与数据 Tab"清除数据"交互一致） */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent size="sm" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger-700 dark:text-danger-700">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              确认注销账户？
            </DialogTitle>
            <DialogDescription>
              此操作不可撤销。请输入 <strong className="font-mono">DELETE MY ACCOUNT</strong> 以确认：
            </DialogDescription>
          </DialogHeader>
          <input
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="输入 DELETE MY ACCOUNT 确认"
            className={cn(
              'w-full h-9 px-[var(--space-apple-sm)] text-sm rounded-[var(--radius-Apple-sm)] border font-mono',
              'border-[var(--border-color)] bg-transparent',
              'focus:outline-none focus:ring-2 focus:ring-danger-500/40 focus:border-danger-500',
            )}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowConfirm(false); setConfirmText('') }}>
              取消
            </Button>
            <Button variant="danger" loading={deleting}
              disabled={confirmText !== 'DELETE MY ACCOUNT'}
              icon={deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              onClick={handleDeleteAccount}>
              {deleting ? '注销中...' : '确认注销'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
