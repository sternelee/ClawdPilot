export async function writeText(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
  }
}

export async function readText(): Promise<string> {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    return navigator.clipboard.readText();
  }
  return "";
}
