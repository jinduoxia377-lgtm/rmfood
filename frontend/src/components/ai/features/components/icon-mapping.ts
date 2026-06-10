export const ICON_MAP = {
  send: 'Send',
  copy: 'Copy',
  quote: 'Quote',
  'thumbs-up': 'ThumbsUp',
  'thumbs-down': 'ThumbsDown',
  share: 'Share2',
  'more-horizontal': 'MoreHorizontal',
  'more-vertical': 'MoreVertical',
  check: 'Check',
  'check-circle': 'CheckCircle',
  loader: 'Loader2',
  alert: 'AlertCircle',
  image: 'Image',
  file: 'FileText',
  paperclip: 'Paperclip',
  microphone: 'Mic',
  'mic-off': 'MicOff',
  history: 'History',
  clock: 'Clock',
  refresh: 'RefreshCw',
  bot: 'Bot',
  sparkles: 'Sparkles',
  brain: 'Brain',
  zap: 'Zap',
  edit: 'Edit3',
  trash: 'Trash2',
  download: 'Download',
  print: 'Printer',
} as const

export const ICON_SIZES = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 40,
} as const

export type IconSize = keyof typeof ICON_SIZES
export type IconName = keyof typeof ICON_MAP
