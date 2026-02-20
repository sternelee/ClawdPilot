/**
 * Enhanced Toast/Notification System
 *
 * AI-native toast notifications inspired by Vercel AI Elements
 */

import { type Component, Show, For, createSignal, onMount, onCleanup } from "solid-js";
import { cn } from "~/lib/utils";
import {
  FiCheck,
  FiX,
  FiAlertCircle,
  FiInfo,
  FiAlertTriangle,
} from "solid-icons/fi";

// ============================================================================
// Types
// ============================================================================

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

// ============================================================================
// Toast Icons
// ============================================================================

const toastIcons = {
  success: FiCheck,
  error: FiAlertCircle,
  warning: FiAlertTriangle,
  info: FiInfo,
};

const toastStyles = {
  success: "bg-success/10 border-success/20 text-success",
  error: "bg-error/10 border-error/20 text-error",
  warning: "bg-warning/10 border-warning/20 text-warning",
  info: "bg-info/10 border-info/20 text-info",
};

const toastIconStyles = {
  success: "text-success",
  error: "text-error",
  warning: "text-warning",
  info: "text-info",
};

// ============================================================================
// Toast Item Component
// ============================================================================

const ToastItem: Component<ToastItemProps> = (props) => {
  let timeoutId: number | undefined;

  onMount(() => {
    // Auto-dismiss after duration
    const duration = props.toast.duration || 5000;
    if (duration > 0) {
      timeoutId = window.setTimeout(() => {
        props.onDismiss(props.toast.id);
      }, duration);
    }
  });

  onCleanup(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });

  const Icon = toastIcons[props.toast.type];

  return (
    <div
      class={cn(
        "flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm",
        "animate-slide-up",
        toastStyles[props.toast.type]
      )}
    >
      {/* Icon */}
      <div class={cn("shrink-0 mt-0.5", toastIconStyles[props.toast.type])}>
        <Icon size={20} />
      </div>

      {/* Content */}
      <div class="flex-1 min-w-0">
        <div class="font-medium text-sm">{props.toast.title}</div>
        <Show when={props.toast.description}>
          <div class="text-xs opacity-80 mt-0.5">{props.toast.description}</div>
        </Show>
      </div>

      {/* Dismiss Button */}
      <button
        type="button"
        onClick={() => props.onDismiss(props.toast.id)}
        class="shrink-0 p-1 hover:bg-muted rounded-lg transition-colors"
      >
        <FiX size={14} />
      </button>
    </div>
  );
};

// ============================================================================
// Toast Container Component
// ============================================================================

export interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  class?: string;
}

export const ToastContainer: Component<ToastContainerProps> = (props) => {
  return (
    <div
      class={cn(
        "fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm",
        props.class
      )}
    >
      <For each={props.toasts}>
        {(toast) => (
          <ToastItem toast={toast} onDismiss={props.onDismiss} />
        )}
      </For>
    </div>
  );
};

// ============================================================================
// Toast Hook (for usage in stores)
// ============================================================================

export interface UseToastOptions {
  duration?: number;
}

export function createToast(options: UseToastOptions = {}) {
  const [toasts, setToasts] = createSignal<Toast[]>([]);

  const addToast = (type: ToastType, title: string, description?: string) => {
    const id = Math.random().toString(36).slice(2);
    const toast: Toast = {
      id,
      type,
      title,
      description,
      duration: options.duration,
    };
    setToasts((prev) => [...prev, toast]);
    return id;
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const success = (title: string, description?: string) => addToast("success", title, description);
  const error = (title: string, description?: string) => addToast("error", title, description);
  const warning = (title: string, description?: string) => addToast("warning", title, description);
  const info = (title: string, description?: string) => addToast("info", title, description);

  return {
    toasts,
    addToast,
    dismissToast,
    success,
    error,
    warning,
    info,
  };
}
