/**
 * Operation Feedback Components
 *
 * 鍩轰簬 Google Material Error Guidelines 鐨勬搷浣滃弽棣堢郴缁?
 *
 * 鐗规€?
 * - 绗﹀悎 WCAG 2.1 AA 鍙闂€ф爣鍑?
 * - 澶氱鍙嶉绫诲瀷锛堟垚鍔?澶辫触/璀﹀憡/淇℃伅锛?
 * - 骞虫粦鍔ㄧ敾鏁堟灉
 * - 鏀寔閿欒鐮侀泦鎴?
 * - 鍝嶅簲寮忚璁?
 */

import React, { useState, useEffect, useCallback } from'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, RefreshCw, X } from'lucide-react';
import { getErrorInfo, getUserMessage, getSolution } from'@/constants/errorCodes';

export type FeedbackType ='success' |'error' |'warning' |'info';

export interface OperationFeedbackProps {
 type: FeedbackType;
 message: string;
 title?: string;
 description?: string;
 code?: string;
 solution?: string;
 retryable?: boolean;
 onRetry?: () => void;
 onDismiss?: () => void;
 duration?: number;
 showIcon?: boolean;
 showAction?: boolean;
}

const iconMap: Record<FeedbackType, React.ReactNode> = {
 success: <CheckCircle className="w-6 h-6" />,
 error: <AlertCircle className="w-6 h-6" />,
 warning: <AlertTriangle className="w-6 h-6" />,
 info: <Info className="w-6 h-6" />,
};

const colorMap: Record<FeedbackType, { bg: string; border: string; icon: string; text: string }> = {
 success: {
 bg:'bg-primary-50 dark:bg-primary-950/30',
 border:'border-primary-200 dark:border-primary-800/50',
 icon:'text-primary-500',
 text:'text-primary-800 dark:text-primary-200',
 },
 error: {
 bg:'bg-error-50 dark:bg-error-950/30',
 border:'border-red-200 dark:border-error-800/50',
 icon:'text-error-500',
 text:'text-error-800 dark:text-error-200',
 },
 warning: {
 bg:'bg-warning-50 dark:bg-warning-950/30',
 border:'border-amber-200 dark:border-warning-800/50',
 icon:'text-warning-500',
 text:'text-warning-800 dark:text-warning-200',
 },
 info: {
 bg:'bg-secondary-50 dark:bg-secondary-950/30',
 border:'border-blue-200 dark:border-secondary-800/50',
 icon:'text-secondary-500',
 text:'text-secondary-800 dark:text-secondary-200',
 },
};

export function OperationFeedback({
 type,
 message,
 title,
 description,
 code,
 solution: customSolution,
 retryable = false,
 onRetry,
 onDismiss,
 duration = type ==='error' ? 5000 : 3000,
 showIcon = true,
 showAction = true,
}: OperationFeedbackProps) {
 const [isVisible, setIsVisible] = useState(false);
 const [isExiting, setIsExiting] = useState(false);

 const errorInfo = code ? getErrorInfo(code) : undefined;
 const userMessage = message || (code ? getUserMessage(code) :'');
 const solution = customSolution || (code ? getSolution(code) :'');

 const colors = colorMap[type];

 useEffect(() => {
 requestAnimationFrame(() => {
 setIsVisible(true);
 });
 }, []);

 useEffect(() => {
 if (duration > 0 && !retryable) {
 const timer = setTimeout(() => {
 handleClose();
 }, duration);
 return () => clearTimeout(timer);
 }
 return;
 }, [duration, retryable]);

 const handleClose = useCallback(() => {
 setIsExiting(true);
 setTimeout(() => {
 onDismiss?.();
 }, 300);
 }, [onDismiss]);

 return (
 <div
 className={`
 relative flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm
 transition-all duration-300 ease-out max-w-md w-full
 ${colors.bg} ${colors.border}
 ${isVisible ?'opacity-100 translate-y-0 scale-100' :'opacity-0 -translate-y-4 scale-95'}
 ${isExiting ?'opacity-0 translate-y-2 scale-95' :''}
 `}
 role="alert"
 aria-live="assertive"
 aria-atomic="true"
 >
 {/* Icon */}
 {showIcon && <div className={`flex-shrink-0 mt-0.5 ${colors.icon}`}>{iconMap[type]}</div>}

 {/* Content */}
 <div className="flex-1 min-w-0">
 {title && <h4 className="text-sm font-semibold text-text-primary">{title}</h4>}
 <p className="text-sm text-text-secondary mt-1">{userMessage}</p>

 {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}

 {/* Error Code Display */}
 {code && (
 <div className="mt-2 inline-flex items-center px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800">
 <span className="text-xs font-mono text-text-secondary">{code}</span>
 </div>
 )}

 {/* Solution */}
 {solution && (
 <div className="mt-3 p-3 rounded-lg surface-overlay60 border border-neutral-200">
 <p className="text-xs font-medium text-text-muted mb-1">
 {type ==='error' ?'寤鸿瑙ｅ喅鏂规' :'鎻愮ず'}
 </p>
 <ul className="text-xs text-text-secondary space-y-0.5">
 {solution.split('\n').map((step, index) => (
 <li key={index} className="flex items-start gap-1">
 <span className="flex-shrink-0 mt-0.5">{index + 1}.</span>
 <span>{step.replace(/^\d+\.\s*/,'')}</span>
 </li>
 ))}
 </ul>
 </div>
 )}

 {/* Action Button */}
 {showAction && retryable && onRetry && (
 <button
 onClick={onRetry}
 className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
 bg-neutral-900 text-white text-xs font-medium
 hover:bg-neutral-800 transition-colors
 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
 >
 <RefreshCw className="w-3.5 h-3.5" />
 閲嶈瘯
 </button>
 )}
 </div>

 {/* Close Button */}
 <button
 onClick={handleClose}
 className="flex-shrink-0 p-1 rounded-md text-text-disabled hover:text-text-secondary
 dark:hover:text-text-disabled hover:bg-neutral-200
 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
 aria-label="鍏抽棴閫氱煡"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 );
}

// -----------------------------------------------------------------------------
// 鍐呰仈鍙嶉缁勪欢 - 鐢ㄤ簬琛ㄥ崟鎴栨寜閽檮杩戠殑鍗虫椂鍙嶉
// -----------------------------------------------------------------------------

export interface InlineFeedbackProps {
 type: FeedbackType;
 message: string;
 showIcon?: boolean;
}

export function InlineFeedback({ type, message, showIcon = true }: InlineFeedbackProps) {
 const colors = colorMap[type];

 return (
 <div
 className={`
 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
 ${colors.bg} ${colors.border}
 `}
 role="status"
 aria-live="polite"
 >
 {showIcon && <span className={`${colors.icon}`}>{iconMap[type]}</span>}
 <span className="text-text-secondary">{message}</span>
 </div>
 );
}

// -----------------------------------------------------------------------------
// 鎿嶄綔鐘舵€佹寚绀哄櫒 - 鐢ㄤ簬鎸夐挳鎴栨搷浣滃尯鍩?
// -----------------------------------------------------------------------------

export interface OperationStatusProps {
 status:'idle' |'loading' |'success' |'error';
 size?:'sm' |'md' |'lg';
 showText?: boolean;
}

export function OperationStatus({ status, size ='md', showText = true }: OperationStatusProps) {
 const sizeClasses = {
 sm:'gap-1.5',
 md:'gap-2',
 lg:'gap-2.5',
 };

 const textClasses = {
 sm:'text-xs',
 md:'text-sm',
 lg:'text-base',
 };

 const statusConfig = {
 idle: {
 icon: null,
 text:'',
 className:'',
 },
 loading: {
 icon: (
 <div className="w-4 h-4 border-2 border-neutral-300 border-t-slate-500 dark:border-t-slate-400 rounded-full animate-spin" />
 ),
 text:'澶勭悊涓?..',
 className:'text-text-muted',
 },
 success: {
 icon: <CheckCircle className="w-4 h-4 text-primary-500" />,
 text:'鎴愬姛',
 className:'text-primary-600 dark:text-primary-400',
 },
 error: {
 icon: <AlertCircle className="w-4 h-4 text-error-500" />,
 text:'澶辫触',
 className:'text-error-600 dark:text-error-400',
 },
 };

 const config = statusConfig[status];

 if (status ==='idle') return null;

 return (
 <span className={`inline-flex items-center ${sizeClasses[size]} ${config.className}`}>
 {config.icon}
 {showText && <span className={textClasses[size]}>{config.text}</span>}
 </span>
 );
}

// -----------------------------------------------------------------------------
// Toast 椋庢牸鍙嶉缁勪欢
// -----------------------------------------------------------------------------

export interface ToastFeedbackProps {
 type: FeedbackType;
 message: string;
 title?: string;
 onClose: () => void;
}

export function ToastFeedback({ type, message, title, onClose }: ToastFeedbackProps) {
 const colors = colorMap[type];
 const [isVisible, setIsVisible] = useState(false);
 const [isExiting, setIsExiting] = useState(false);

 useEffect(() => {
 requestAnimationFrame(() => setIsVisible(true));
 }, []);

 const handleClose = useCallback(() => {
 setIsExiting(true);
 setTimeout(onClose, 300);
 }, [onClose]);

 return (
 <div
 className={`
 flex items-center gap-3 px-4 py-3 rounded-lg shadow-card-hover
 backdrop-blur-sm transition-all duration-300 ease-out
 max-w-sm w-full
 ${colors.bg} border-l-4 ${
 type ==='success'
 ?'border-l-primary-500'
 : type ==='error'
 ?'border-l-red-500'
 : type ==='warning'
 ?'border-l-amber-500'
 :'border-l-blue-500'
 }
 ${isVisible ?'opacity-100 translate-x-0' :'opacity-0 -translate-x-4'}
 ${isExiting ?'opacity-0 translate-x-4' :''}
 `}
 role="alert"
 aria-live="polite"
 >
 <div className={`flex-shrink-0 ${colors.icon}`}>{iconMap[type]}</div>
 <div className="flex-1 min-w-0">
 {title && <p className="text-sm font-semibold text-text-primary">{title}</p>}
 <p className="text-sm text-text-secondary truncate">{message}</p>
 </div>
 <button
 onClick={handleClose}
 className="flex-shrink-0 p-1 rounded-md text-text-disabled hover:text-text-secondary
 dark:hover:text-text-disabled hover:bg-neutral-200
 transition-colors"
 aria-label="鍏抽棴閫氱煡"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 );
}

// -----------------------------------------------------------------------------
// 鍏ㄥ眬鍙嶉灞曠ず缁勪欢
// -----------------------------------------------------------------------------

export interface GlobalFeedbackProps {
 feedbacks: {
 id: string;
 type: FeedbackType;
 message: string;
 title?: string;
 code?: string;
 retryable?: boolean;
 onRetry?: () => void;
 }[];
 onRemove: (id: string) => void;
}

export function GlobalFeedback({ feedbacks, onRemove }: GlobalFeedbackProps) {
 if (feedbacks.length === 0) return null;

 return (
 <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-full max-w-md pointer-events-none">
 {feedbacks.map((feedback) => (
 <div key={feedback.id} className="pointer-events-auto">
 <OperationFeedback
 type={feedback.type}
 message={feedback.message}
 title={feedback.title}
 code={feedback.code}
 retryable={feedback.retryable}
 onRetry={feedback.onRetry}
 onDismiss={() => onRemove(feedback.id)}
 />
 </div>
 ))}
 </div>
 );
}

