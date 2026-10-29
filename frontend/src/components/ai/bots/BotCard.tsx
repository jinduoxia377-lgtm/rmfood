/**
 * BotCard — 具名 Bot 卡片（多智能体协作平台）
 */
import { Sparkles, ShieldCheck, Archive, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui';
import { BotAvatar } from './BotAvatar';
import type { Bot as BotType } from './types';

interface BotCardProps {
  bot: BotType;
  active?: boolean;
  onOpen: (bot: BotType) => void;
  onDelete?: (bot: BotType) => void;
}

export function BotCard({ bot, active, onOpen, onDelete }: BotCardProps) {
  const { t } = useTranslation();
  return (
    <div
      className={`group relative cursor-pointer rounded-[var(--radius-Apple-md)] border bg-card p-4 transition-all hover:shadow-md ${
        active
          ? 'border-primary-500 ring-2 ring-primary-500/20'
          : 'border-border hover:border-primary-300'
      }`}
      onClick={() => onOpen(bot)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen(bot);
      }}
      data-testid="bot-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <BotAvatar bot={bot} size="md" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{bot.name}</span>
              {bot.is_chief && (
                <Badge variant="default" className="gap-1 bg-primary-600 text-xs">
                  <Sparkles className="h-3 w-3" /> Chief
                </Badge>
              )}
              {bot.is_system && !bot.is_chief && (
                <Badge variant="secondary" className="text-xs">{t('pages.agent.botOfficial')}</Badge>
              )}
            </div>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {bot.description || t('pages.agent.botNoDesc')}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {bot.status === 'archived' ? (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              <Archive className="mr-1 h-3 w-3" aria-hidden="true" /> {t('pages.agent.botArchived')}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-success-600">
              <ShieldCheck className="mr-1 h-3 w-3" aria-hidden="true" /> {t('pages.agent.botRunning')}
            </Badge>
          )}
          {bot.model_id && (
            <span className="text-xs text-muted-foreground">{bot.model_id}</span>
          )}
        </div>
      </div>

      {bot.capabilities && bot.capabilities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {bot.capabilities.slice(0, 4).map((cap) => (
            <span
              key={cap}
              className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
            >
              {cap}
            </span>
          ))}
          {bot.capabilities.length > 4 && (
            <span className="text-xs text-muted-foreground">
              +{bot.capabilities.length - 4}
            </span>
          )}
        </div>
      )}

      {onDelete && !bot.is_system && (
        <button
          className="absolute right-2 top-2 hidden h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:flex"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(bot);
          }}
          title={t('pages.agent.botDeleteTitle')}
          aria-label={t('pages.agent.botDeleteTitle')}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}