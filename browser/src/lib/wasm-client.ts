/**
 * WASM Client Bridge
 *
 * Bridges the Irogen browser WASM crate to the Tauri-style API expected by src/.
 * - Manages IrogenNodeWasm lifecycle
 * - Consumes the ReadableStream of AgentEvents
 * - Exposes invoke() and listen() compatible shims
 */

export interface WasmEvent {
  type: string;
  sessionId: string;
  [key: string]: unknown;
}

let wasmModule: typeof import("../wasm/browser.js") | null = null;
let node: import("../wasm/browser.js").IrogenNodeWasm | null = null;
let currentSession: {
  sessionId: string;
  session: import("../wasm/browser.js").IrogenSessionWasm;
} | null = null;

let lastSpawnParams: {
  agentType: string;
  projectPath: string;
  spawnedAt: number;
} | null = null;

const listeners = new Map<string, Set<(payload: unknown) => void>>();

async function getWasmModule() {
  if (!wasmModule) {
    wasmModule = await import("../wasm/browser.js");
    await wasmModule.default();
  }
  return wasmModule;
}

export function emitBrowserEvent(eventName: string, payload: unknown) {
  const handlers = listeners.get(eventName);
  if (handlers) {
    handlers.forEach((h) => {
      try {
        h(payload);
      } catch (e) {
        console.error(`[wasm-client] Event handler error for ${eventName}:`, e);
      }
    });
  }
}

export function browserListen(
  eventName: string,
  handler: (payload: unknown) => void,
): () => void {
  if (!listeners.has(eventName)) listeners.set(eventName, new Set());
  listeners.get(eventName)!.add(handler);
  return () => listeners.get(eventName)?.delete(handler);
}

function normalizeWasmEventType(type: string): string {
  return type.replace(/:/g, "_").toLowerCase();
}

async function consumeEventStream(stream: ReadableStream<unknown>, defaultSessionId: string) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      let parsedEvent: WasmEvent;
      if (typeof value === "string") {
        try {
          parsedEvent = JSON.parse(value) as WasmEvent;
        } catch {
          continue;
        }
      } else if (value && typeof value === "object") {
        parsedEvent = value as WasmEvent;
      } else {
        continue;
      }

      const normalizedType = normalizeWasmEventType(parsedEvent.type);
      const sessionId = parsedEvent.sessionId || defaultSessionId;

      // Emit as agent-message for sessionEventRouter (flat format)
      emitBrowserEvent("agent-message", {
        sessionId,
        type: normalizedType,
        ...parsedEvent,
      });

      // Also emit as local-agent-event in wrapped format for compatibility
      emitBrowserEvent("local-agent-event", {
        sessionId,
        turnId: (parsedEvent as unknown as Record<string, unknown>).turnId,
        event: {
          type: normalizedType,
          ...parsedEvent,
        },
      });

      if (normalizedType === "session_started") {
        emitBrowserEvent("agent-session-created", {
          session_id: sessionId,
          agent_type: (parsedEvent.agent as string) || "claude",
          project_path: lastSpawnParams?.projectPath || "",
          control_session_id: defaultSessionId,
        });
      }

      if (normalizedType === "session_ended") {
        emitBrowserEvent("peer-disconnected", { sessionId });
        emitBrowserEvent("connection-state-changed", {
          sessionId,
          state: "disconnected",
        });
      }
    }
  } catch (err) {
    console.error("[wasm-client] Event stream error:", err);
  } finally {
    reader.releaseLock();
    if (currentSession?.sessionId === defaultSessionId) {
      emitBrowserEvent("peer-disconnected", { sessionId: defaultSessionId });
      emitBrowserEvent("connection-state-changed", {
        sessionId: defaultSessionId,
        state: "disconnected",
      });
      currentSession = null;
    }
  }
}

export async function browserInvoke(
  cmd: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  switch (cmd) {
    case "initialize_network": {
      if (!node) {
        const mod = await getWasmModule();
        node = await mod.IrogenNodeWasm.spawn();
      }
      return node.node_id();
    }

    case "connect_to_host":
    case "connect_to_peer": {
      if (!node) {
        const mod = await getWasmModule();
        node = await mod.IrogenNodeWasm.spawn();
      }
      const ticket = String(args.sessionTicket ?? "");
      const result = (await (node as unknown as { connect(t: string): Promise<Record<string, unknown>> }).connect(ticket)) as {
        sessionId: string;
        session: import("../wasm/browser.js").IrogenSessionWasm;
        events: ReadableStream<unknown>;
      };
      currentSession = { sessionId: result.sessionId, session: result.session };
      consumeEventStream(result.events, result.sessionId);
      emitBrowserEvent("connection-state-changed", {
        sessionId: result.sessionId,
        state: "connected",
      });
      return result.sessionId;
    }

    case "disconnect_session": {
      if (currentSession) {
        try {
          await currentSession.session.close();
        } catch (e) {
          console.warn("[wasm-client] disconnect error:", e);
        }
        currentSession = null;
      }
      return;
    }

    case "send_agent_message":
    case "local_send_agent_message":
    case "mobile_send_agent_message": {
      if (!currentSession) throw new Error("Not connected");
      const content = String(args.content ?? args.message ?? "");
      await currentSession.session.send_message(content);
      return;
    }

    case "abort_agent_action":
    case "local_abort_agent_action": {
      if (!currentSession) throw new Error("Not connected");
      await currentSession.session.interrupt();
      return;
    }

    case "respond_to_agent_permission":
    case "local_respond_to_agent_permission":
    case "respond_permission": {
      if (!currentSession) throw new Error("Not connected");
      await currentSession.session.respond_to_permission(
        String(args.requestId ?? ""),
        Boolean(args.approved),
        (args.reason as string | null | undefined) ?? null,
      );
      return;
    }

    case "set_permission_mode":
    case "remote_set_permission_mode":
    case "local_set_permission_mode": {
      if (!currentSession) throw new Error("Not connected");
      await currentSession.session.set_permission_mode(String(args.mode ?? "alwaysAsk"));
      return;
    }

    case "remote_spawn_session": {
      if (!currentSession) throw new Error("Not connected");
      const agentType = String(args.agentType ?? "claude");
      const projectPath = String(args.projectPath ?? "");
      const extraArgs = Array.isArray(args.args) ? args.args.map(String) : [];
      await currentSession.session.spawn_remote_session(agentType, projectPath, extraArgs);
      lastSpawnParams = { agentType, projectPath, spawnedAt: Date.now() };
      return;
    }

    case "get_system_status": {
      if (!currentSession) throw new Error("Not connected");
      await currentSession.session.get_system_status();
      return;
    }

    case "parse_session_ticket": {
      const t = String(args.ticket ?? args.sessionTicket ?? "");
      if (!t || t.trim().length < 20) {
        throw new Error("Invalid ticket format");
      }
      return t.trim();
    }

    case "remote_list_agents": {
      if (!currentSession) return [];
      if (lastSpawnParams) {
        return [
          {
            session_id: currentSession.sessionId,
            agent_type: lastSpawnParams.agentType,
            project_path: lastSpawnParams.projectPath,
            started_at: lastSpawnParams.spawnedAt,
            active: true,
            controlled_by_remote: true,
            hostname: "Remote Host",
            os: "Browser",
            current_dir: lastSpawnParams.projectPath,
            machine_id: currentSession.sessionId,
          },
        ];
      }
      return [];
    }

    case "request_message_sync":
    case "install_acp_package_remote":
    case "install_acp_package_local":
    case "stop_tcp_forwarding_session": {
      console.warn(`[wasm-client] Command '${cmd}' is not supported in browser mode`);
      return;
    }

    default:
      throw new Error(`Browser shim: unsupported invoke command '${cmd}'`);
  }
}
