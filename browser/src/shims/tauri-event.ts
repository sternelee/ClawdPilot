import { browserListen } from "../lib/wasm-client";

export type UnlistenFn = () => void;

export interface EventPayload<T> {
  payload: T;
}

export async function listen<T>(
  event: string,
  handler: (event: EventPayload<T>) => void,
): Promise<UnlistenFn> {
  const unlisten = browserListen(event, (payload: T) => {
    handler({ payload });
  });
  return unlisten;
}

export async function once<T>(
  event: string,
  handler: (event: EventPayload<T>) => void,
): Promise<UnlistenFn> {
  const unlisten = await listen<T>(event, (e) => {
    unlisten();
    handler(e);
  });
  return unlisten;
}

export async function emit(event: string, payload?: unknown): Promise<void> {
  // No-op in browser shim
  console.warn(`[tauri-event shim] emit('${event}') is a no-op`);
}
