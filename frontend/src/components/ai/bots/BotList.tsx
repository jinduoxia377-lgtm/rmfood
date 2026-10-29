/**
 * BotList — Bot 列表视图（含新建入口）
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot as BotIcon, Plus, RefreshCw } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';
import { BotCard } from './BotCard';
import { BotCreateDialog } from './BotCreateDialog';
import { botApi } from './api';
import type { Bot } from './types';

interface BotListProps {
  bots: Bot[];
  loading: boolean;
  onSelect: (bot: Bot) => void;
  onRefresh: () => void;
  onCreated: (bot: Bot) => void;
}

export function BotList({ bots, loading, onSelect, onRefresh, onCreated }: BotListProps) {
  const { t } = useTranslation();
  const [createOpen, setCreateOpen] = useState(false);

  // P3：接通 BotCard 真实删除（之前 onDelete 未传递导致删除按钮永不渲染）
  const handleDelete = async (bot: Bot) => {
    if (!window.confirm(t('pages.agent.botDeleteConfirm', { name: bot.name }))) return;
    try {
      await botApi.remove(bot.id);
      onRefresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : t('pages.agent.botDeleteFailed'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t('pages.agent.botsTitle')}</h2>
          <p className="text-xs text-muted-foreground">
            {t('pages.agent.botsSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            aria-label={t('pages.agent.refreshAria')}
            title={t('pages.agent.refresh')}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> {t('pages.agent.newBot')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-[var(--radius-Apple-md)] bg-muted/50" />
          ))}
        </div>
      ) : bots.length === 0 ? (
        <EmptyState
          icon={<BotIcon className="h-8 w-8" />}
          title={t('pages.agent.botsEmptyTitle')}
          description={t('pages.agent.botsEmptyDesc')}
          action={<Button onClick={() => setCreateOpen(true)}>{t('pages.agent.newBot')}</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {bots.map((bot) => (
            <BotCard key={bot.id} bot={bot} onOpen={onSelect} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <BotCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={onCreated} />
    </div>
  );
}