/**
 * 配方分享组件
 * 支持复制链接、二维码生成、社交媒体分享
 */
import { useState, useEffect } from 'react';
import { Copy, Check, QrCode, Share2, Mail, MessageCircle } from 'lucide-react';
import { Button, Modal, Card, CardContent, CardHeader, CardTitle, useToast } from '@/components/ui';

interface ShareFormulaProps {
  formulaId: number;
  formulaName: string;
  open: boolean;
  onClose: () => void;
}

export function ShareFormula({ formulaId, formulaName, open, onClose }: ShareFormulaProps) {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const shareUrl = `${window.location.origin}/formulas/${formulaId}`;

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [copied]);
  return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      addToast({ type: 'success', message: '链接已复制到剪贴板' });
    } catch {
      addToast({ type: 'error', message: '复制失败，请手动复制' });
    }
  };

  const handleShare = async (platform: string) => {
    const text = `查看「${formulaName}」配方 - RMFOOD配方设计平台`;
    const urls: Record<string, string> = {
      mail: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(shareUrl)}`,
      message: `sms:?body=${encodeURIComponent(text + ' ' + shareUrl)}`,
    };

    if (urls[platform]) {
      window.open(urls[platform], '_blank');
    }
  };

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}&bgcolor=FFFFFF&color=000000&format=png`;

  return (
    <Modal open={open} onClose={onClose} title="分享配方" size="md">
      <div className="space-y-6">
        {/* 复制链接 */}
        <Card>
          <CardHeader>
            <CardTitle as="h3" className="text-base">
              复制链接
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-[var(--space-apple-sm)]">
            <div className="flex items-center gap-2">
              <div className="flex-1 px-[var(--space-apple-sm)] py-2 bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] text-sm text-[var(--text-secondary)] truncate">
                {shareUrl}
              </div>
              <Button
                variant={copied ? 'secondary' : 'primary'}
                size="sm"
                icon={copied ? <Check size={14} /> : <Copy size={14} />}
                onClick={handleCopyLink}
              >
                {copied ? '已复制' : '复制'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 二维码 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle as="h3" className="text-base">
                二维码
              </CardTitle>
              <Button variant="ghost" size="sm" icon={<QrCode size={14} />} onClick={() => setShowQR(!showQR)}>
                {showQR ? '隐藏' : '显示'}
              </Button>
            </div>
          </CardHeader>
          {showQR && (
            <CardContent className="flex justify-center">
              <div className="p-[var(--space-apple-md)] bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)]">
                <div className="relative">
                  <img
                    src={qrCodeUrl}
                    alt="配方二维码"
                    className="w-48 h-48"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = `
                          <div class="flex flex-col items-center justify-center w-48 h-48 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                            <QrCode size={32} />
                            <p class="text-xs mt-2">二维码加载失败</p>
                          </div>
                        `;
                      }
                    }}
                  />
                </div>
                <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-center mt-2">扫码查看配方</p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* 分享到 */}
        <Card>
          <CardHeader>
            <CardTitle as="h3" className="text-base">
              分享到
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-[var(--space-apple-sm)]">
              <button
                onClick={() => handleShare('mail')}
                className="flex flex-col items-center gap-2 p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <div className="w-10 h-10 rounded-[var(--radius-pill)] bg-[var(--color-error-container)] dark:bg-[var(--color-error-container)]0/10 flex items-center justify-center">
                  <Mail size={20} className="text-[var(--color-error-text)]0" />
                </div>
                <span className="text-xs text-[var(--text-secondary)]">邮件</span>
              </button>

              <button
                onClick={() => handleShare('message')}
                className="flex flex-col items-center gap-2 p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <div className="w-10 h-10 rounded-[var(--radius-pill)] bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]0/10 flex items-center justify-center">
                  <MessageCircle size={20} className="text-[var(--color-success-text)]0" />
                </div>
                <span className="text-xs text-[var(--text-secondary)]">短信</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="flex flex-col items-center gap-2 p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <div className="w-10 h-10 rounded-[var(--radius-pill)] bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]0/10 flex items-center justify-center">
                  <Share2 size={20} className="text-[var(--color-secondary-text)]0" />
                </div>
                <span className="text-xs text-[var(--text-secondary)]">更多</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end mt-6">
        <Button variant="secondary" onClick={onClose}>
          关闭
        </Button>
      </div>
    </Modal>
  );
}
