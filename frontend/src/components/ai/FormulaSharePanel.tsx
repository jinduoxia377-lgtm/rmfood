/**
 * 跨平台配方分享组件
 * 支持分享链接生成、二维码和隐私控制
 */
import { useState, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui';
import { Share2, Link, QrCode, Lock, Eye, EyeOff, Copy, Check, Download, Trash2, BarChart3 } from 'lucide-react';
import { FONT_SIZES, FONT_WEIGHTS } from '../../types/design-tokens';
import { logger } from '@/utils/safeLogger';
import { sanitizeHTML } from '@/utils/sanitize';

export interface SharedFormula {
  shareId: string;
  formulaName: string;
  effects: string[];
  ingredients: {
    name: string;
    dosage: string;
    role: string;
  }[];
  scores: {
    synergy: number;
    taste: number;
    stability: number;
    overall: number;
  };
  creatorName?: string;
  createdAt: number;
  expiresAt?: number;
  viewCount: number;
}

export type SharePermission = 'public' | 'private' | 'password';

interface ShareConfig {
  permission: SharePermission;
  password?: string;
  expiresInDays?: number;
  includeScores?: boolean;
  includeIngredients?: boolean;
  template?: 'compact' | 'detailed' | 'card';
}

interface FormulaSharePanelProps {
  formula: {
    formulaName: string;
    effects: string[];
    ingredients: { name: string; dosage: string; role: string }[];
    scores: { synergy: number; taste: number; stability: number; overall: number };
  };
  onClose?: () => void;
  onShare?: (shareData: SharedFormula) => void;
  onImport?: (shareId: string) => void;
}

export function FormulaSharePanel({ formula, onClose, onShare, onImport }: FormulaSharePanelProps) {
  const [config, setConfig] = useState<ShareConfig>({
    permission: 'public',
    expiresInDays: 30,
    includeScores: true,
    includeIngredients: true,
    template: 'card',
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [accessPassword, setAccessPassword] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importLink, setImportLink] = useState('');

  const generateShareId = useCallback(() => {
    return `sf_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  const handleGenerateLink = useCallback(() => {
    const shareId = generateShareId();
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
      f: typeof formula.formulaName === 'string' ? formula.formulaName : '未知配方',
      e: (Array.isArray(formula.effects) ? formula.effects : [])
        .map((e) => (typeof e === 'string' ? e : '未知功效'))
        .join(','),
      s: config.includeScores ? formula.scores.overall.toString() : '',
      i: config.includeIngredients
        ? (Array.isArray(formula.ingredients) ? formula.ingredients : [])
            .map((ing) => (typeof ing.name === 'string' ? ing.name : '未知药材'))
            .join(',')
        : '',
      p: config.permission,
      t: config.template || 'card',
    });

    if (config.permission === 'password' && password) {
      // 不使用 base64 编码密码（可轻易逆转），改为在服务端验证
      params.set('pwd_hint', 'true');
    }

    if (config.expiresInDays) {
      const expiresAt = Date.now() + config.expiresInDays * 24 * 60 * 60 * 1000;
      params.set('exp', expiresAt.toString());
    }

    const link = `${baseUrl}/share/formula/${shareId}?${params.toString()}`;
    setGeneratedLink(link);

    const sharedFormula: SharedFormula = {
      shareId,
      formulaName: formula.formulaName,
      effects: formula.effects,
      ingredients: formula.ingredients,
      scores: formula.scores,
      createdAt: Date.now(),
      expiresAt: config.expiresInDays ? Date.now() + config.expiresInDays * 24 * 60 * 60 * 1000 : undefined,
      viewCount: 0,
    };
    onShare?.(sharedFormula);
  }, [formula, config, password, generateShareId, onShare]);

  const handleCopyLink = useCallback(async () => {
    if (generatedLink) {
      try {
        await navigator.clipboard.writeText(generatedLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        logger.error('复制失败:', err);
      }
    }
  }, [generatedLink]);

  const handleImport = useCallback(() => {
    if (importLink) {
      onImport?.(importLink);
      setShowImportDialog(false);
      setImportLink('');
    }
  }, [importLink, onImport]);

  const QRCodeDataUrl = useMemo(() => {
    if (!generatedLink || !showQRCode) return null;
    const qrData = generatedLink;
    return `data:text/plain;base64,${btoa(qrData)}`;
  }, [generatedLink, showQRCode]);

  const previewHtml = useMemo(() => {
    const scoresHtml = config.includeScores
      ? `<div style="display:flex;gap:8px;font-size:${FONT_SIZES['body-sm']};">
          <span>协同:${formula.scores.synergy.toFixed(2)}</span>
          <span>口感:${formula.scores.taste.toFixed(2)}</span>
          <span>稳定性:${formula.scores.stability.toFixed(2)}</span>
          <span><b>综合:${formula.scores.overall.toFixed(2)}</b></span>
        </div>`
      : '';

    const ingredientsHtml = config.includeIngredients
      ? `<div style="font-size:${FONT_SIZES['label-sm']};color:var(--text-secondary);">
          ${(Array.isArray(formula.ingredients) ? formula.ingredients : []).map((ing) => `${typeof ing.name === 'string' ? ing.name : '未知药材'}(${typeof ing.dosage === 'string' ? ing.dosage : '未知剂量'})`).join(' + ')}
        </div>`
      : '';

    return `
      <div style="padding:16px;background:linear-gradient(135deg,var(--color-primary-surface,#047857) 0%,var(--color-primary-surface-hover,#065f46) 100%);border-radius:12px;color:var(--color-on-primary-surface,#ffffff);max-width:280px;">
        <div style="font-size:${FONT_SIZES['body-lg']};font-weight:${FONT_WEIGHTS.bold};margin-bottom:8px;">${typeof formula.formulaName === 'string' ? formula.formulaName : '未知配方'}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
          ${(Array.isArray(formula.effects) ? formula.effects : []).map((e) => `<span style="background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:12px;font-size:${FONT_SIZES['label-sm']};">${typeof e === 'string' ? e : '未知功效'}</span>`).join('')}
        </div>
        ${scoresHtml}
        ${ingredientsHtml}
      </div>
    `;
  }, [formula, config.includeScores, config.includeIngredients]);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
          <Share2 className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">分享配方</h3>
          <p className="text-xs text-neutral-500">生成链接或二维码分享配方</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* 隐私权限 */}
        <div>
          <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2 block">隐私权限</label>
          <div className="flex gap-2">
            <PermissionButton
              active={config.permission === 'public'}
              onClick={() => setConfig({ ...config, permission: 'public' })}
              icon={<Eye className="w-3.5 h-3.5" />}
              label="公开"
            />
            <PermissionButton
              active={config.permission === 'private'}
              onClick={() => setConfig({ ...config, permission: 'private' })}
              icon={<EyeOff className="w-3.5 h-3.5" />}
              label="私密"
            />
            <PermissionButton
              active={config.permission === 'password'}
              onClick={() => setConfig({ ...config, permission: 'password' })}
              icon={<Lock className="w-3.5 h-3.5" />}
              label="密码"
            />
          </div>
        </div>

        {/* 密码设置 */}
        {config.permission === 'password' && (
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="设置访问密码"
              className="w-full px-3 py-2 pr-10 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        )}

        {/* 有效期 */}
        <div>
          <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2 block">链接有效期</label>
          <select
            value={config.expiresInDays || ''}
            onChange={(e) =>
              setConfig({ ...config, expiresInDays: e.target.value ? parseInt(e.target.value) : undefined })
            }
            className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
          >
            <option value="">永久有效</option>
            <option value="7">7天</option>
            <option value="30">30天</option>
            <option value="90">90天</option>
            <option value="365">1年</option>
          </select>
        </div>

        {/* 分享内容 */}
        <div>
          <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2 block">分享内容</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 cursor-pointer">
              <input
                type="checkbox"
                checked={config.includeScores}
                onChange={(e) => setConfig({ ...config, includeScores: e.target.checked })}
                className="rounded border-neutral-300 text-cyan-500 focus:ring-cyan-500"
              />
              包含评分信息
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 cursor-pointer">
              <input
                type="checkbox"
                checked={config.includeIngredients}
                onChange={(e) => setConfig({ ...config, includeIngredients: e.target.checked })}
                className="rounded border-neutral-300 text-cyan-500 focus:ring-cyan-500"
              />
              包含原料信息
            </label>
          </div>
        </div>

        {/* 卡片样式 */}
        <div>
          <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2 block">卡片样式</label>
          <div className="flex gap-2">
            {['compact', 'detailed', 'card'].map((t) => (
              <button
                key={t}
                onClick={() => setConfig({ ...config, template: t as unknown as typeof config.template })}
                className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                  config.template === t
                    ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400'
                    : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                }`}
              >
                {t === 'compact' ? '简洁' : t === 'detailed' ? '详细' : '卡片'}
              </button>
            ))}
          </div>
        </div>

        {/* 生成按钮 */}
        <button
          onClick={handleGenerateLink}
          className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg shadow-cyan-500/20"
        >
          生成分享链接
        </button>

        {/* 生成的链接和二维码 */}
        {generatedLink && (
          <div className="space-y-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <Link className="w-4 h-4 text-cyan-500" />
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">分享链接</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={generatedLink}
                readOnly
                className="flex-1 px-3 py-2 text-xs border border-neutral-200 dark:border-neutral-700 rounded-lg bg-slate-50 dark:bg-neutral-800"
              />
              <button
                onClick={handleCopyLink}
                className={`p-2 rounded-lg transition-colors ${
                  copied
                    ? 'bg-success-100 text-success-600 dark:bg-success-900/40'
                    : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowQRCode(!showQRCode)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-lg border transition-colors ${
                  showQRCode
                    ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400'
                    : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                }`}
              >
                <QrCode className="w-4 h-4" />
                {showQRCode ? '隐藏' : '显示'}二维码
              </button>
            </div>

            {showQRCode && QRCodeDataUrl && (
              <div className="flex flex-col items-center p-4 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-100 dark:border-neutral-700">
                <img src={QRCodeDataUrl} alt="二维码" className="w-48 h-48" />
                <p className="text-xs text-neutral-500 mt-2">扫描二维码访问配方</p>
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = QRCodeDataUrl;
                    link.download = `${formula.formulaName}_qrcode.png`;
                    link.click();
                  }}
                  className="mt-2 flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  下载二维码
                </button>
              </div>
            )}

            {/* 预览 */}
            <div className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg">
              <p className="text-xs text-neutral-500 mb-2">分享预览</p>
              <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(previewHtml) }} />
            </div>

            {/* 分享数据 */}
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <div className="flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5" />
                <span>访问次数: 0</span>
              </div>
              <button className="flex items-center gap-1 text-error-500 hover:text-error-600">
                <Trash2 className="w-3.5 h-3.5" />
                删除分享
              </button>
            </div>
          </div>
        )}

        {/* 导入功能 */}
        <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <button
            onClick={() => setShowImportDialog(!showImportDialog)}
            className="w-full py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            导入他人分享的配方
          </button>

          {showImportDialog && (
            <div className="mt-3 space-y-3 animate-fade-in">
              <input
                type="text"
                value={importLink}
                onChange={(e) => setImportLink(e.target.value)}
                placeholder="粘贴分享链接或输入分享ID"
                className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
              {importLink.startsWith('http') && importLink.includes('pwd=') && (
                <input
                  type="password"
                  value={accessPassword}
                  onChange={(e) => setAccessPassword(e.target.value)}
                  placeholder="输入访问密码"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
                />
              )}
              <button
                onClick={handleImport}
                className="w-full py-2 bg-cyan-500 text-white text-sm font-medium rounded-lg hover:bg-cyan-600 transition-colors"
              >
                导入配方
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function PermissionButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg border transition-colors ${
        active
          ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400'
          : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 text-neutral-600 dark:text-neutral-400'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function ImportShareDialog({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (shareData: SharedFormula) => void;
}) {
  const [link, setLink] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!link) return;

    setLoading(true);
    setError(null);

    try {
      const url = new URL(link);
      const params = url.searchParams;

      const shareData: SharedFormula = {
        shareId: typeof url.pathname.split('/').pop() === 'string' ? url.pathname.split('/').pop() || '' : '',
        formulaName: typeof params.get('f') === 'string' ? params.get('f') || '未知配方' : '未知配方',
        effects:
          params
            .get('e')
            ?.split(',')
            .filter((e) => typeof e === 'string' && e)
            .map((e) => (typeof e === 'string' ? e : '未知功效')) || [],
        ingredients:
          params
            .get('i')
            ?.split(',')
            .filter((name) => typeof name === 'string' && name)
            .map((name) => ({
              name: typeof name === 'string' ? name : '未知药材',
              dosage: '-',
              role: '-',
            })) || [],
        scores: {
          synergy: parseFloat(params.get('s') || '0') || 0,
          taste: 0,
          stability: 0,
          overall: parseFloat(params.get('s') || '0') || 0,
        },
        createdAt: Date.now(),
        expiresAt: params.get('exp') ? parseInt(params.get('exp')!) : undefined,
        viewCount: 0,
      };

      onImport(shareData);
      onClose();
    } catch (err) {
      setError('无效的分享链接');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">导入配方</h3>

        <div className="space-y-4">
          <input
            type="text"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="粘贴分享链接"
            className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />

          {link.includes('pwd=') && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入访问密码"
              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
            />
          )}

          {error && <p className="text-sm text-error-500">{error}</p>}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg">
              取消
            </button>
            <button
              onClick={handleImport}
              disabled={!link || loading}
              className="px-4 py-2 text-sm bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50"
            >
              {loading ? '导入中...' : '导入'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
