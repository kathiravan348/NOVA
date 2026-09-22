import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { IconButton } from "../IconButton/IconButton";
import { ToastContext, type ToastItem, type ToastOptions } from "./toastContext";

export interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps): React.ReactElement {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const show = React.useCallback((options: ToastOptions) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newToast: ToastItem = { ...options, id };
    setToasts((prev) => [...prev.slice(-2), newToast]);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}

        {toasts.map((toast) => {
          const isDanger = toast.tone === "danger";
          const icon =
            toast.tone === "success" ? (
              <CircleCheck className="h-5 w-5 text-profit shrink-0" aria-hidden="true" />
            ) : toast.tone === "danger" ? (
              <CircleAlert className="h-5 w-5 text-loss shrink-0" aria-hidden="true" />
            ) : (
              <Info className="h-5 w-5 text-action-text shrink-0" aria-hidden="true" />
            );

          return (
            <ToastPrimitive.Root
              key={toast.id}
              type={isDanger ? "foreground" : "background"}
              duration={toast.durationMs ?? 5000}
              onOpenChange={(open) => {
                if (!open) {
                  removeToast(toast.id);
                }
              }}
              className={cn(
                "flex items-start gap-3 w-full rounded-md border border-border-default bg-bg-surface p-4 shadow-lg",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
              )}
            >
              <div className="pt-0.5">{icon}</div>

              <div className="flex-1 space-y-1">
                <ToastPrimitive.Title className="font-sans text-body font-semibold text-text-primary">
                  {toast.title}
                </ToastPrimitive.Title>
                {toast.description && (
                  <ToastPrimitive.Description className="text-body-sm text-text-secondary">
                    {toast.description}
                  </ToastPrimitive.Description>
                )}
              </div>

              <ToastPrimitive.Close asChild>
                <IconButton
                  icon={<X className="h-4 w-4" />}
                  aria-label="Close toast"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 -mr-2 -mt-2"
                />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}

        <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-50 flex flex-col gap-2 p-4 w-full md:max-w-sm max-w-full pointer-events-none [&>*]:pointer-events-auto" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
