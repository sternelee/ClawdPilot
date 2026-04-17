/* tslint:disable */
/* eslint-disable */
/**
 * The `ReadableStreamType` enum.
 *
 * *This API requires the following crate features to be activated: `ReadableStreamType`*
 */

type ReadableStreamType = "bytes";

export class IntoUnderlyingByteSource {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  pull(controller: ReadableByteStreamController): Promise<any>;
  start(controller: ReadableByteStreamController): void;
  cancel(): void;
  readonly autoAllocateChunkSize: number;
  readonly type: ReadableStreamType;
}

export class IntoUnderlyingSink {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  abort(reason: any): Promise<any>;
  close(): Promise<any>;
  write(chunk: any): Promise<any>;
}

export class IntoUnderlyingSource {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  pull(controller: ReadableStreamDefaultController): Promise<any>;
  cancel(): void;
}

export class IrogenNodeWasm {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  static spawn(): Promise<IrogenNodeWasm>;
  connect(ticket: string): Promise<any>;
  node_id(): string;
}

export class IrogenSessionWasm {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Send a text message to the agent session.
   */
  send_message(content: string): Promise<void>;
  /**
   * Request system status from the remote CLI.
   */
  get_system_status(): Promise<void>;
  /**
   * Set the permission mode for the current session.
   * Accepted values: "alwaysAsk", "acceptEdits", "autoApprove", "plan"
   */
  set_permission_mode(mode: string): Promise<void>;
  /**
   * Request remote session spawn.
   */
  spawn_remote_session(agent_type: string, project_path: string, args: string[]): Promise<void>;
  /**
   * Respond to a permission request.
   */
  respond_to_permission(request_id: string, approved: boolean, reason?: string | null): Promise<void>;
  /**
   * Close the session.
   */
  close(): Promise<void>;
  /**
   * Send an interrupt/terminate control action.
   */
  interrupt(): Promise<void>;
  readonly session_id: string;
}

export function init_panic_hook(): void;

export function start(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_irogennodewasm_free: (a: number, b: number) => void;
  readonly __wbg_irogensessionwasm_free: (a: number, b: number) => void;
  readonly irogennodewasm_connect: (a: number, b: number, c: number, d: number) => void;
  readonly irogennodewasm_node_id: (a: number, b: number) => void;
  readonly irogennodewasm_spawn: () => number;
  readonly irogensessionwasm_close: (a: number) => number;
  readonly irogensessionwasm_get_system_status: (a: number) => number;
  readonly irogensessionwasm_interrupt: (a: number) => number;
  readonly irogensessionwasm_respond_to_permission: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly irogensessionwasm_send_message: (a: number, b: number, c: number) => number;
  readonly irogensessionwasm_session_id: (a: number, b: number) => void;
  readonly irogensessionwasm_set_permission_mode: (a: number, b: number, c: number) => number;
  readonly irogensessionwasm_spawn_remote_session: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
  readonly start: () => void;
  readonly init_panic_hook: () => void;
  readonly ring_core_0_17_14__bn_mul_mont: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly __wbg_intounderlyingbytesource_free: (a: number, b: number) => void;
  readonly __wbg_intounderlyingsink_free: (a: number, b: number) => void;
  readonly __wbg_intounderlyingsource_free: (a: number, b: number) => void;
  readonly intounderlyingbytesource_autoAllocateChunkSize: (a: number) => number;
  readonly intounderlyingbytesource_cancel: (a: number) => void;
  readonly intounderlyingbytesource_pull: (a: number, b: number) => number;
  readonly intounderlyingbytesource_start: (a: number, b: number) => void;
  readonly intounderlyingbytesource_type: (a: number) => number;
  readonly intounderlyingsink_abort: (a: number, b: number) => number;
  readonly intounderlyingsink_close: (a: number) => number;
  readonly intounderlyingsink_write: (a: number, b: number) => number;
  readonly intounderlyingsource_cancel: (a: number) => void;
  readonly intounderlyingsource_pull: (a: number, b: number) => number;
  readonly __wasm_bindgen_func_elem_7724: (a: number, b: number, c: number) => void;
  readonly __wasm_bindgen_func_elem_7717: (a: number, b: number) => void;
  readonly __wasm_bindgen_func_elem_2948: (a: number, b: number) => void;
  readonly __wasm_bindgen_func_elem_2938: (a: number, b: number) => void;
  readonly __wasm_bindgen_func_elem_1587: (a: number, b: number, c: number) => void;
  readonly __wasm_bindgen_func_elem_1234: (a: number, b: number) => void;
  readonly __wasm_bindgen_func_elem_2862: (a: number, b: number) => void;
  readonly __wasm_bindgen_func_elem_2850: (a: number, b: number) => void;
  readonly __wasm_bindgen_func_elem_6077: (a: number, b: number) => void;
  readonly __wasm_bindgen_func_elem_6072: (a: number, b: number) => void;
  readonly __wasm_bindgen_func_elem_3516: (a: number, b: number, c: number) => void;
  readonly __wasm_bindgen_func_elem_3490: (a: number, b: number) => void;
  readonly __wasm_bindgen_func_elem_7763: (a: number, b: number, c: number, d: number) => void;
  readonly __wbindgen_export: (a: number, b: number) => number;
  readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export3: (a: number) => void;
  readonly __wbindgen_export4: (a: number, b: number, c: number) => void;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
