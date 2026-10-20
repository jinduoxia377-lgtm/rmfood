import { useTranslation } from 'react-i18next'
import { useCountdown, formatCountdown, getAnnouncedRemaining } from '../hooks/useCountdown'

interface WindowCountdownProps {
  /** 服务端下发的申请窗口截止时间（UTC ISO） */
  deadline?: string | null
  /** 服务端响应中的 server_time，用于时钟偏移校正 */
  serverTime?: string | null
}

/**
 * Hero 区「申请窗口截止」环形倒计时。
 * 秒级文本对屏幕阅读器隐藏，仅每分钟播报一次剩余分钟数。
 */
export function WindowCountdown({ deadline, serverTime }: WindowCountdownProps) {
  const { t } = useTranslation()
  const cd = useCountdown(deadline, serverTime)

  if (!deadline) return null

  const announced = getAnnouncedRemaining(cd)

  return (
    <div className="whitelist-window-countdown" role="group" aria-label={t('pages.whitelist.windowCountdownLabel')}>
      <span className="whitelist-window-label">{t('pages.whitelist.windowCountdownLabel')}</span>
      <div className="whitelist-countdown-ring" aria-hidden="true">
        <span className="whitelist-countdown-days">
          {cd.days}
          <small>d</small>
        </span>
        <span className="whitelist-countdown-clock">{formatCountdown(cd)}</span>
      </div>
      {!cd.expired && (
        <span className="sr-only" role="status">
          {t('pages.whitelist.windowAnnounced', { minutes: announced })}
        </span>
      )}
    </div>
  )
}