/**
 * Notification Store (solid-sonner adapter)
 */

import { toast } from "solid-sonner";

const toSonnerDuration = (duration: number): number => {
  if (duration === 0) return Number.POSITIVE_INFINITY;
  return duration;
};

const notify = (
  type: "info" | "success" | "warning" | "error",
  message: string,
  title: string,
  duration: number,
): string => {
  const baseClass =
    "alert bg-base-100 text-base-content border shadow-lg rounded-xl px-3 py-2 pr-10";
  const typeClass =
    type === "success"
      ? "border-success/45"
      : type === "error"
        ? "border-error/45"
        : type === "warning"
          ? "border-warning/45"
          : "border-info/45";

  const options = {
    description: message,
    duration: toSonnerDuration(duration),
    unstyled: true,
    class: `${baseClass} ${typeClass}`,
    classes: {
      title: "font-semibold text-sm leading-tight",
      description: "text-xs opacity-80 leading-relaxed",
      closeButton:
        "btn btn-ghost btn-xs btn-circle bg-base-200 text-base-content/75 border border-base-content/15",
    },
  };

  const id =
    type === "success"
      ? toast.success(title, options)
      : type === "warning"
        ? toast.warning(title, options)
        : type === "error"
          ? toast.error(title, options)
          : toast.info(title, options);

  return String(id);
};

export const createNotificationStore = () => {
  const info = (message: string, title?: string, duration = 5000) =>
    notify("info", message, title ?? "Info", duration);

  const success = (message: string, title?: string, duration = 3000) =>
    notify("success", message, title ?? "Success", duration);

  const warning = (message: string, title?: string, duration = 5000) =>
    notify("warning", message, title ?? "Warning", duration);

  const error = (message: string, title?: string, duration = 0) =>
    notify("error", message, title ?? "Error", duration);

  return {
    info,
    success,
    warning,
    error,
  };
};

export const notificationStore = createNotificationStore();
