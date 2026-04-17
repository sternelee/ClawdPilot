export interface OpenDialogOptions {
  multiple?: boolean;
  directory?: boolean;
  defaultPath?: string;
}

export async function open(options?: OpenDialogOptions): Promise<string | string[] | null> {
  if (typeof window === "undefined") return null;
  if (options?.directory) {
    const path = window.prompt("Enter directory path:", options.defaultPath);
    return path;
  }
  // For file open in browser, return a mock path or null
  return window.prompt("Enter file path:", options?.defaultPath);
}

export async function save(options?: { defaultPath?: string }): Promise<string | null> {
  if (typeof window === "undefined") return null;
  return window.prompt("Enter save path:", options?.defaultPath);
}

export async function message(
  msg: string,
  options?: { title?: string; type?: "info" | "warning" | "error" },
): Promise<void> {
  if (typeof window === "undefined") return;
  window.alert(`${options?.title ?? "Message"}\n\n${msg}`);
}

export async function confirm(
  msg: string,
  options?: { title?: string; type?: "info" | "warning" | "error" },
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  return window.confirm(`${options?.title ?? "Confirm"}\n\n${msg}`);
}
