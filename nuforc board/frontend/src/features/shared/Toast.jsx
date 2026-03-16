import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { springs } from "../../lib/motion";

const ToastContext = createContext(null);

let toastId = 0;

const TOAST_CONFIG = {
  success: {
    border: "border-green-500/20",
    bg: "bg-zinc-900",
    text: "text-green-300",
    accent: "bg-green-500",
  },
  error: {
    border: "border-red-500/20",
    bg: "bg-zinc-900",
    text: "text-red-300",
    accent: "bg-red-500",
  },
  info: {
    border: "border-blue-500/20",
    bg: "bg-zinc-900",
    text: "text-blue-300",
    accent: "bg-blue-500",
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info", duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}

      <div className="fixed bottom-4 right-4 z-[9998] flex flex-col-reverse gap-2" style={{ pointerEvents: "none" }}>
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => {
            const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info;
            return (
              <m.div
                key={toast.id}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={springs.snappy}
                className={`flex items-center gap-3 overflow-hidden rounded-md border ${config.border} ${config.bg} shadow-elevated`}
                style={{ pointerEvents: "auto" }}
              >
                <div className={`w-0.5 self-stretch ${config.accent}`} />
                <span className={`py-2.5 text-caption ${config.text}`}>{toast.message}</span>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="mr-3 text-zinc-500 hover:text-zinc-300"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </m.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
