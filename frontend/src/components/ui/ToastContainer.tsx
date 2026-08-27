import { useToastStore } from '@/stores/toastStore';
import { Toast, ToastTitle, ToastDescription, ToastClose } from './Toast';

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-container" aria-live="polite" style={{ paddingTop: 'var(--safe-area-inset-top, 0px)' }}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          variant={toast.type === 'error' ? 'destructive' : toast.type === 'warning' ? 'warning' : toast.type === 'success' ? 'success' : 'default'}
        >
          <div className="flex items-start gap-3 w-full">
            <div className="flex-1">
              {toast.title && <ToastTitle>{toast.title}</ToastTitle>}
              {toast.message && <ToastDescription>{toast.message}</ToastDescription>}
            </div>
            <ToastClose onClick={() => removeToast(toast.id)} />
          </div>
        </Toast>
      ))}
    </div>
  );
}
