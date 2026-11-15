import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
  confirmAction: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const confirmAction = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ options, resolve });
    });
  }, []);

  const handleConfirmClose = (accepted: boolean) => {
    if (confirmState) {
      confirmState.resolve(accepted);
      setConfirmState(null);
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, confirmAction }}>
      {children}

      {/* Toast stack */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg transition-all duration-150 ${
              toast.variant === 'success'
                ? 'bg-[#FFFDF9] border-emerald-200 text-[#18181B]'
                : toast.variant === 'error'
                  ? 'bg-[#FFFDF9] border-rose-200 text-[#18181B]'
                  : 'bg-[#FFFDF9] border-stone-200 text-[#18181B]'
            }`}
          >
            {toast.variant === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : toast.variant === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-5 h-5 text-[#EA580C] shrink-0 mt-0.5" />
            )}
            <p className="text-sm font-medium leading-snug flex-1">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              aria-label="Dismiss notification"
              className="text-zinc-400 hover:text-zinc-700 p-0.5 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Accessible Confirmation Dialog */}
      {confirmState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 backdrop-blur-xs p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-[#FFFDF9] border border-stone-200 p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-[#18181B]">
              {confirmState.options.title}
            </h3>
            <p className="mt-2 text-sm text-[#52525B] leading-relaxed">
              {confirmState.options.message}
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => handleConfirmClose(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors whitespace-nowrap"
              >
                {confirmState.options.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmClose(true)}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors whitespace-nowrap ${
                  confirmState.options.destructive
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#EA580C] hover:bg-[#C2410C]'
                }`}
              >
                {confirmState.options.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
