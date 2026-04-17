import { browserInvoke } from "../lib/wasm-client";

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return browserInvoke(cmd, args ?? {}) as Promise<T>;
}

export class Channel<T = unknown> {
  private _handler: ((msg: T) => void) | null = null;

  get onmessage(): ((msg: T) => void) | null {
    return this._handler;
  }

  set onmessage(handler: ((msg: T) => void) | null) {
    this._handler = handler;
  }
}
