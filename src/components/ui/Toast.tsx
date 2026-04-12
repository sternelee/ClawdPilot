/**
 * Enhanced Toast/Notification System
 *
 * Features:
 * - Slide-in/fade animations
 * - Progress bar for auto-dismiss countdown
 * - Stacking for multiple toasts
 * - Toast variant icons with better styling
 * - "Undo" action support
 * - Improved positioning (top-right corner)
 * - Better mobile responsiveness
 */

import {
  type Component,
  Show,
  For,
  createSignal,
  onMount,
  onCleanup,
  createEffect,
} from "solid-js";
import { cn } from "~/lib/utils";
import {
  FiCheck,
  FiX,
  FiAlertCircle,
  FiInfo,
  FiAlertTriangle,
  FiRotateCcw,
} from "solid-icons/fi";

// ============================================================================
// Types
// ============================================================================

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  action?: ToastAction;
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
  stackIndex: number;
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
  success: "border-l-success",
  error: "border-l-error",
  warning: "border-l-warning",
  info: "border-l-info",
};

const toastIconStyles = {
  success: "text-success",
  error: "text-error",
  warning: "text-warning",
  info: "text-info",
};

const toastGlowStyles = {
  success: "shadow-success/20",
  error: "shadow-error/20",
  warning: "shadow-warning/20",
  info: "shadow-info/20",
};

// ============================================================================
// Toast Item Component
// ============================================================================

const ToastItem: Component<ToastItemProps> = (props) => {
  const [isVisible, setIsVisible] = createSignal(false);
  const [progress, setProgress] = createSignal(100);
  let timeoutId: number | undefined;
  let progressInterval: number | undefined;
  const duration = props.toast.duration ?? 5000;

  onMount(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    // Auto-dismiss after duration
    if (duration > 0) {
      // Start progress countdown
      const step = 50; // Update every 50ms
      const decrementPerStep = (100 / duration) * step;
      
      progressInterval = window.setInterval(() => {
        setProgress((prev) => {
          const next = prev - decrementPerStep;
          return next < 0 ? 0 : next;
        });
      }, step);

      timeoutId = window.setTimeout(() => {
        handleDismiss();
      }, duration);
    }
  });

  onCleanup(() => {
    if (timeoutId) clearTimeout(timeoutId);
    if (progressInterval) clearInterval(progressInterval);
  });

  const handleDismiss = () => {
    setIsVisible(false);
    // Wait for exit animation before removing
    setTimeout(() => {
      props.onDismiss(props.toast.id);
    }, 300);
  };

  const Icon = toastIcons[props.toast.type];

  return (
    <div
      role="alert"
      class={cn(
        "relative overflow-hidden",
        "bg-base-100 border border-base-content/10 rounded-xl",
        "shadow-lg shadow-base-content/5",
        "transition-all duration-300 ease-out",
        // Entrance/exit animations
        isVisible()
          ? "translate-x-0 opacity-100"
          : "translate-x-full opacity-0",
        // Stacking offset based on index
        toastStyles[props.toast.type],
        props.stackIndex > 0 && "mt-2",
        // Glow effect
        toastGlowStyles[props.toast.type],
        "hover:shadow-xl hover:scale-[1.01]"
      )}
      style={{
        "border-left-width": "4px",
        "border-left-color": `var(--sonner-${props.toast.type})`,
      }}
    >
      <div class="flex items-start gap-3 p-4 pr-12">
        {/* Icon */}
        <div
          class={cn(
            "shrink-0 p-2 rounded-lg",
            "bg-base-content/5"
          )}
        >
          <Icon size={18} class={toastIconStyles[props.toast.type]} />
        </div>

        {/* Content */}
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold">{props.toast.title}</div>
          <Show when={props.toast.description}>
            <div class="text-xs text-base-content/60 mt-0.5 line-clamp-2">
              {props.toast.description}
            </div>
          </Show>

          {/* Action Button */}
          <Show when={props.toast.action}>
            <button
              type="button"
              onClick={() => {
                props.toast.action?.onClick();
                handleDismiss();
              }}
              class={cn(
                "mt-2 inline-flex items-center gap-1.5",
                "text-xs font-medium px-2.5 py-1 rounded-md",
                "bg-base-content/5 hover:bg-base-content/10",
                "transition-colors duration-150"
              )}
            >
              <FiRotateCcw size={12} />
              {props.toast.action?.label}
            </button>
          </Show>
        </div>
      </div>

      {/* Close Button */}
      <button
        type="button"
        onClick={handleDismiss}
        class={cn(
          "absolute top-3 right-3",
          "w-7 h-7 rounded-full",
          "flex items-center justify-center",
          "bg-base-content/5 hover:bg-base-content/10",
          "text-base-content/60 hover:text-base-content",
          "transition-all duration-150",
          "hover:scale-105 active:scale-95"
        )}
      >
        <FiX size={14} />
      </button>

      {/* Progress Bar */}
      <Show when={duration > 0 && progress() > 0}>
        <div
          class={cn(
            "absolute bottom-0 left-0 h-0.5",
            "transition-all duration-50 ease-linear",
            toastIconStyles[props.toast.type]
          )}
          style={{ width: `${progress()}%` }}
        />
      </Show>
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
        "fixed top-4 right-4 z-[100] flex flex-col gap-2",
        "w-full max-w-sm sm:max-w-[356px]",
        // Mobile: full width with padding
        "left-4 sm:left-auto",
        "max-h-[calc(100vh-2rem)] overflow-hidden",
        props.class
      )}
    >
      <For each={props.toasts}>
        {(toast, index) => (
          <ToastItem
            toast={toast}
            onDismiss={props.onDismiss}
            stackIndex={index()}
          />
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

  const addToast = (
    type: ToastType,
    title: string,
    description?: string,
    action?: ToastAction
  ) => {
    const id = Math.random().toString(36).slice(2);
    const toast: Toast = {
      id,
      type,
      title,
      description,
      duration: options.duration,
      action,
    };
    setToasts((prev) => [...prev.slice(-4), toast]); // Keep max 5 toasts
    return id;
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const dismissAll = () => {
    setToasts([]);
  };

  const success = (title: string, description?: string, action?: ToastAction) =>
    addToast("success", title, description, action);
  const error = (title: string, description?: string, action?: ToastAction) =>
    addToast("error", title, description, action);
  const warning = (title: string, description?: string, action?: ToastAction) =>
    addToast("warning", title, description, action);
  const info = (title: string, description?: string, action?: ToastAction) =>
    addToast("info", title, description, action);

  return {
    toasts,
    addToast,
    dismissToast,
    dismissAll,
    success,
    error,
    warning,
    info,
  };
}

export type { Toast, ToastAction, ToastType };
