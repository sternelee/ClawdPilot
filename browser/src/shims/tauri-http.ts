export async function fetch(_url: string, _options?: RequestInit): Promise<Response> {
  throw new Error("[tauri-http shim] Use native fetch() in browser mode");
}
