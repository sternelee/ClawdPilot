export async function readTextFile(_path: string): Promise<string> {
  throw new Error("[tauri-fs shim] readTextFile is not supported in browser mode");
}

export async function writeTextFile(_path: string, _contents: string): Promise<void> {
  throw new Error("[tauri-fs shim] writeTextFile is not supported in browser mode");
}

export async function exists(_path: string): Promise<boolean> {
  return false;
}

export async function mkdir(_path: string, _options?: { recursive?: boolean }): Promise<void> {
  throw new Error("[tauri-fs shim] mkdir is not supported in browser mode");
}

export async function remove(_path: string, _options?: { recursive?: boolean }): Promise<void> {
  throw new Error("[tauri-fs shim] remove is not supported in browser mode");
}
