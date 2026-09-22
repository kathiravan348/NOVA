import * as React from "react";

export type ToastTone = "neutral" | "success" | "danger";

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
}

export interface ToastItem extends ToastOptions {
  id: string;
}

export interface ToastContextValue {
  show: (options: ToastOptions) => void;
}

export const ToastContext = React.createContext<ToastContextValue | null>(null);
