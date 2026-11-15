/**
 * CountdownBanner — 正式上线倒计时（嵌入 Hero 内部使用）
 * 数据：data/launchCountdown.ts
 *
 * 逻辑：
 *   - 目标日期 = 服务端固定锚点 LAUNCH_CONFIG.anchorDate
 *     （v2 修复：原实现写入 localStorage 使倒计时随访客首次访问时间漂移，
 *       构成虚假紧迫感，违反平台"真实数据"原则；现改为全局统一日期）
 *   - 每秒 tick，归零后自动隐藏
 *   - 数字变化时有闪烁动画
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { LAUNCH_CONFIG } from '../data/launchCountdown';
import { cn } from '@/lib/utils';

// ── 计时常量 ──────────────────────────────────────────────────────
const MS_PER_DAY    = 86_400_000;
const MS_PER_HOUR   = 3_600_000;
const MS_PER_MINUTE = 60_000;
const MS_PER_SECOND = 1_000;
const TICK_MS       = 1_000;

/** 目标日期：服务端固定锚点（真实数据原则：全用户一致，不再随首次访问漂移） */
const LAUNCH_DATE = new Date(LAUNCH_CONFIG.anchorDate);

/** 格式化两位数字 */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// ── 单个倒计时单元 ────────────────────────────────────────────────
interface UnitProps {
  value: string;
  label: string;
  prevValue?: string;
}

function CountUnit({ value, label, prevValue }: UnitProps) {
  const flipped = prevValue !== value && prevValue !== undefined;
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          'w-12 h-12 sm:w-14 sm:h-14 rounded-[var(--radius-Apple-md)] flex items-center justify-center text-xl sm:text-2xl font-bold tabular-nums transition-all duration-200',
          flipped && 'lp-countdown-flip'
        )}
        style={{
          background: 'var(--bg-surface-raised, var(--bg-surface-container))',
          border: '1px solid var(--color-neutral-200, #e2e8f0)',
          color: 'var(--text-primary)',
          minWidth: 48,
        }}
      >
        {value}
      </div>
      <span className="lp-caption uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  );
}

// ── 分隔符（:） ────────────────────────────────────────────────────
function Separator() {
  return (
    <div className="flex items-center pb-5 text-lg font-bold" style={{ color: 'var(--text-secondary)' }}>
      :
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────────
export function CountdownBanner() {
  const launchDate = LAUNCH_DATE;
  const [timeLeft, setTimeLeft] = useState(() => calcTimeLeft(launchDate));
  const [prevTime, setPrevTime] = useState(timeLeft);

  function calcTimeLeft(target: Date) {
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return null;
    const days    = Math.floor(diff / MS_PER_DAY);
    const hours   = Math.floor((diff % MS_PER_DAY) / MS_PER_HOUR);
    const minutes = Math.floor((diff % MS_PER_HOUR) / MS_PER_MINUTE);
    const seconds = Math.floor((diff % MS_PER_MINUTE) / MS_PER_SECOND);
    return { days, hours: pad(hours), minutes: pad(minutes), seconds: pad(seconds) };
  }

  useEffect(() => {
    const id = setInterval(() => {
      const next = calcTimeLeft(launchDate);
      if (!next) {
        clearInterval(id);
        return;
      }
      setPrevTime(timeLeft);
      setTimeLeft(next);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [launchDate]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!LAUNCH_CONFIG.enabled) return null;

  if (!timeLeft) return null;

  return (
    <div
      className="relative overflow-hidden border-b"
      style={{
        background: 'var(--bg-surface-container)',
        borderBottom: '1px solid var(--color-neutral-200, #e2e8f0)',
      }}
    >
      <div className="relative z-10 max-w-6xl mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-4 sm:py-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

          {/* 左侧：文案 + CTA */}
          <div className="flex items-center gap-4 min-w-0">
            {/* 徽章 */}
            <div
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-pill)] lp-label"
              style={{
                background: 'color-mix(in srgb, var(--color-primary-700, #047857) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-primary-700, #047857) 25%, transparent)',
                color: 'var(--color-primary-700, #047857)',
              }}
            >
              <span className="relative inline-flex rounded-[var(--radius-pill)] h-1.5 w-1.5 bg-[var(--color-primary-container)]0" />
              {LAUNCH_CONFIG.title}
            </div>

            {/* 文案 */}
            <div className="min-w-0">
              <p className="text-[15px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {LAUNCH_CONFIG.subtitle}
              </p>
              <p className="lp-caption mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {LAUNCH_CONFIG.footnote}
              </p>
            </div>
          </div>

          {/* 右侧：倒计时 + CTA */}
          <div className="flex items-center gap-4">
            {/* 倒计时单位 */}
            <div className="flex items-center gap-1.5">
              <CountUnit value={pad(timeLeft.days)}         label="天" prevValue={String(prevTime?.days ?? -1)} />
              <Separator />
              <CountUnit value={timeLeft.hours}           label="时" prevValue={prevTime?.hours} />
              <Separator />
              <CountUnit value={timeLeft.minutes}         label="分" prevValue={prevTime?.minutes} />
              <Separator />
              <CountUnit value={timeLeft.seconds}         label="秒" prevValue={prevTime?.seconds} />
            </div>

            {/* CTA（P0 触控热区修复：44px 最小高度） */}
            <Link
              to={LAUNCH_CONFIG.ctaHref}
              className="shrink-0 inline-flex items-center gap-1.5 px-[var(--space-apple-md)] min-h-[44px] rounded-[var(--radius-Apple-md)] lp-label transition-all duration-200"
              style={{
                background: 'var(--color-neutral-900, #0f172a)',
                color: '#ffffff',
                boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = 'var(--shadow-elevated, 0 8px 24px rgba(0,0,0,0.1))';
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))';
                e.currentTarget.style.opacity = '1';
              }}
            >
              <Bell size={12} />
              {LAUNCH_CONFIG.ctaLabel}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
