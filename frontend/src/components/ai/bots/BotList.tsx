/**
 * BotList — Bot 列表视图（含新建入口）
 */
import { useState } from 'react';
import { Bot as BotIcon, Plus, RefreshCw } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';
import { BotCard } from './BotCard';
import { BotCreateDialog } from './BotCreateDialog';
import type { Bot } from './types';

interface BotListProps {
  bots: Bot[];
  loading: boolean;
  onSelect: (bot: Bot) => void;
  onRefresh: () => void;
  onCreated: (bot: Bot) => void;
}

export function BotList({ bots, loading, onSelect, onRefresh, onCreated }: BotListProps) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">我的智能体团队</h2>
          <p className="text-xs text-muted-foreground">
            创建具名 AI Bot，为每个角色配置独立人设、模型与能力
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> 新建 Bot
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
          title="还没有智能体"
          description="点击「新建 Bot」创建第一个具名 AI 助手"
          action={<Button onClick={() => setCreateOpen(true)}>新建 Bot</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {bots.map((bot) => (
            <BotCard key={bot.id} bot={bot} onOpen={onSelect} />
          ))}
        </div>
      )}

      <BotCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={onCreated} />
    </div>
  );
}