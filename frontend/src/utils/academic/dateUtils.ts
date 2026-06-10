export interface DateRange {
  start: Date;
  end: Date;
  days: number;
  hours: number;
  minutes: number;
}

export interface ParsedDate {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  valid: boolean;
}

export function parseDate(str: string): ParsedDate {
  const defaultResult: ParsedDate = {
    year: 0,
    month: 0,
    day: 0,
    hour: 0,
    minute: 0,
    second: 0,
    valid: false,
  };

  if (!str || typeof str !== 'string') {
    return defaultResult;
  }

  const formats = [
    /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/,
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/,
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
    /^(\d{4})年(\d{1,2})月(\d{1,2})日$/,
  ];

  for (const format of formats) {
    const match = str.match(format);
    if (match && match[1] && match[2] && match[3]) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      const hour = match[4] ? parseInt(match[4], 10) : 0;
      const minute = match[5] ? parseInt(match[5], 10) : 0;
      const second = match[6] ? parseInt(match[6], 10) : 0;

      const date = new Date(year, month - 1, day, hour, minute, second);
      const valid = !isNaN(date.getTime()) && date.getFullYear() === year;

      return {
        year,
        month,
        day,
        hour,
        minute,
        second,
        valid,
      };
    }
  }

  const timestamp = Date.parse(str);
  if (!isNaN(timestamp)) {
    const date = new Date(timestamp);
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
      valid: true,
    };
  }

  return defaultResult;
}

export function getCurrentDate(): Date {
  return new Date();
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return '无效日期';
  }

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffMs < 0) {
    const absSeconds = Math.abs(diffSeconds);
    const absMinutes = Math.abs(diffMinutes);
    const absHours = Math.abs(diffHours);
    const absDays = Math.abs(diffDays);
    const absWeeks = Math.floor(absDays / 7);
    const absMonths = Math.floor(absDays / 30);
    const absYears = Math.floor(absDays / 365);

    if (absSeconds < 60) return '刚刚';
    if (absMinutes < 60) return `${absMinutes}分钟后`;
    if (absHours < 24) return `${absHours}小时后`;
    if (absDays < 7) return `${absDays}天后`;
    if (absDays < 30) return `${absWeeks}周后`;
    if (absDays < 365) return `${absMonths}个月后`;
    return `${absYears}年后`;
  }

  if (diffSeconds < 60) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${diffWeeks}周前`;
  if (diffDays < 365) return `${diffMonths}个月前`;
  return `${diffYears}年前`;
}

export function getDateRange(start: Date | string, end: Date | string): DateRange {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return {
      start: startDate,
      end: endDate,
      days: 0,
      hours: 0,
      minutes: 0,
    };
  }

  const diffMs = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return {
    start: startDate,
    end: endDate,
    days: diffDays,
    hours: diffHours,
    minutes: diffMinutes,
  };
}
