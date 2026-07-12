"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, Close, AlertTriangle, Info } from "@/components/icons";
import t from "./toast.module.css";

/* ============================================================
   Système de notifications (toasts) du back office. Remplace les
   bandeaux inline : un provider global monté dans le layout admin,
   un hook useToast() pour émettre depuis n'importe quel écran.
   ============================================================ */

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string };

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé sous <ToastProvider>.");
  return ctx;
}

const ICONS = {
  success: Check,
  error: AlertTriangle,
  info: Info,
} as const;

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setItems((prev) => [...prev, { id, kind, message }]);
      window.setTimeout(() => remove(id), kind === "error" ? 6000 : 3800);
    },
    [remove],
  );

  const api: ToastApi = {
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={t.stack} role="region" aria-label="Notifications" aria-live="polite">
        {items.map((item) => {
          const Icon = ICONS[item.kind];
          return (
            <div key={item.id} className={`${t.toast} ${t[item.kind]}`}>
              <span className={t.icon}>
                <Icon width={16} height={16} />
              </span>
              <p>{item.message}</p>
              <button
                type="button"
                className={t.close}
                onClick={() => remove(item.id)}
                aria-label="Fermer"
              >
                <Close width={13} height={13} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
