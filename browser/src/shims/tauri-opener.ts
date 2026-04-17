export async function openUrl(url: string): Promise<void> {
  if (typeof window !== "undefined") {
    window.open(url, "_blank");
  }
}

export async function openPath(_path: string): Promise<void> {
  console.warn("[tauri-opener shim] openPath is not supported in browser mode");
}
