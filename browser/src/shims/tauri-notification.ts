export async function isPermissionGranted(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  return Notification.permission === "granted";
}

export async function requestPermission(): Promise<NotificationPermission | "default"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "default";
  const result = await Notification.requestPermission();
  return result;
}

export async function sendNotification(options: { title: string; body?: string }): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(options.title, { body: options.body });
  }
}
