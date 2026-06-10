import { useToastStore } from '@/stores/toastStore'
import { Toast } from './Toast'

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          title={toast.title || '通知'}
          message={toast.message}
          onClose={removeToast}
        />
      ))}
    </div>
  )
}
