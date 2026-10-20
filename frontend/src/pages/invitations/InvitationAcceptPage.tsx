import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2, Mail, ArrowRight } from 'lucide-react';
import api from '@/api/client';
import { useAuthStore } from '@/stores/auth';

/**
 * 接受组织邀请页（公开路由，邮件链接跳转落地页）
 * - 已登录且邮箱匹配：调用 POST /invitations/{token}/accept
 * - 未登录：提示先使用被邀请邮箱注册/登录
 */
export default function InvitationAcceptPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'need-login'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('邀请链接缺少令牌（token），请检查邮件中的链接是否完整。');
      return;
    }
    if (!isAuthenticated) {
      setStatus('need-login');
      setMessage('请使用被邀请的邮箱注册并登录后，再打开此链接接受邀请。');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    api.post(`/organizations/invitations/${encodeURIComponent(token)}/accept`)
      .then((res) => {
        if (cancelled) return;
        setStatus('success');
        setMessage(res.data?.message || '邀请已接受，您已成功加入组织。');
      })
      .catch((err: any) => {
        if (cancelled) return;
        setStatus('error');
        setMessage(err?.response?.data?.detail || '接受邀请失败，请稍后重试或联系组织管理员。');
      });
    return () => { cancelled = true; };
  }, [token, isAuthenticated]);

  return (
    <div className="min-h-screen bg-grid flex items-center justify-center px-[var(--space-apple-md)]" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <div className="w-full max-w-md bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] shadow-sm p-8">
        <div className="flex flex-col items-center text-center">
          {/* 图标 */}
          <div className={`w-14 h-14 rounded-[var(--radius-pill)] flex items-center justify-center mb-[var(--space-apple-md)] ${
            status === 'success' ? 'bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/25' :
            status === 'error' ? 'bg-[var(--color-error-container)] dark:bg-[var(--color-error-container)]/25' :
            status === 'need-login' ? 'bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/25' :
            'bg-[var(--bg-tertiary)]'
          }`}>
            {status === 'loading' ? (
              <Loader2 className="w-7 h-7 text-[var(--color-secondary-text)]0 animate-spin" />
            ) : status === 'success' ? (
              <CheckCircle className="w-7 h-7 text-[var(--color-success-text)]" />
            ) : status === 'need-login' ? (
              <Mail className="w-7 h-7 text-[var(--color-secondary-text)]" />
            ) : (
              <AlertCircle className="w-7 h-7 text-[var(--color-error-text)]" />
            )}
          </div>

          <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">组织邀请</h1>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            {status === 'loading' && '正在接受邀请...'}
            {status === 'success' && message}
            {status === 'error' && message}
            {status === 'need-login' && (
              <>
                {message}
                <span className="block mt-1 text-xs text-[var(--text-muted)]">
                  当前登录账号：{user?.email || '未登录'}（邀请需与收件邮箱一致）
                </span>
              </>
            )}
          </p>

          <div className="mt-6 w-full space-y-2">
            {status === 'need-login' && (
              <>
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 w-full px-[var(--space-apple-md)] py-2.5 text-sm font-medium bg-[var(--color-primary)] text-white rounded-[var(--radius-Apple-sm)] hover:bg-[var(--color-primary)] transition-colors"
                >
                  去登录 <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/register"
                  className="flex items-center justify-center w-full px-[var(--space-apple-md)] py-2.5 text-sm font-medium text-[var(--text-secondary)] border border-[var(--border-color)] dark:border-neutral-700 rounded-[var(--radius-Apple-sm)] hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  没有账号？去注册
                </Link>
              </>
            )}
            {(status === 'success' || status === 'error') && (
              <Link
                to={status === 'success' ? '/organizations' : '/login'}
                className="flex items-center justify-center gap-2 w-full px-[var(--space-apple-md)] py-2.5 text-sm font-medium bg-[var(--color-primary)] text-white rounded-[var(--radius-Apple-sm)] hover:bg-[var(--color-primary)] transition-colors"
              >
                {status === 'success' ? '进入我的组织' : '返回登录'} <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}