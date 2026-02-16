/**
 * SessionSidebar Component
 *
 * Sidebar for managing AI agent sessions (both local and remote).
 * Supports switching between local and remote modes.
 */

import { createSignal, Show, For, type Component } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { sessionStore, type SessionMode } from "../stores/sessionStore";
import { notificationStore } from "../stores/notificationStore";
import type { AgentType } from "../stores/sessionStore";

// ============================================================================
// Icons
// ============================================================================

const PlusIcon: Component = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
  </svg>
);

const CloseIcon: Component = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const LocalIcon: Component = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 12s4.48 2 12 12H4c-1.1 0-2 .9-2 2-2V4c0-1.1-.9-2-2-2H4c-2.21 0-4-4.21 0-4s-2.21 0-4-4.21V8c0 2.21 0 4 4.21 4H4c1.1 0 2 .9 2 2 2h16c1.1 0 2 .9 2 2 2v-4c0-1.1.9-2 2-2H4c-2.21 0-4-4.21 0-4s2.21 0 4 4.21V8c0 2.21 0 4-4.21 4h-4.21c1.1 0 2-.9-2-2-2H4c-1.1 0-2-.9-2-2-2V4c0-1.1-.9-2-2-2H4c-2.21 0-4-4.21 0-4s-.21 0 4-4.21V4h16c1.1 0 2 .9 2 2 2v4c0-1.1.9-2 2-2H4c-2.21 0-4-4.21 0-4s-.21 0 4 4.21V8z" />
  </svg>
);

const RemoteIcon: Component = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 4H4c-1.1 0-2 .9-2 2-2H3c-1.1 0-2-.9-2-2-2V8c0-1.1-.9-2-2-2H2c-2.21 0-4-4.21 0-4s2.21 0 4 4.21V6h18c1.1 0 2 .9 2 2 2v4c0-1.1.9-2 2-2h-4.21c-1.1 0 2-.9-2-2-2V4c0-1.1-.9-2-2-2H4c-2.21 0-4-4.21 0-4s2.21 0 4 4.21V8z" />
  </svg>
);

// ============================================================================
// Agent Icons
// ============================================================================

const getAgentIcon = (agentType: AgentType) => {
  const iconClass = "w-4 h-4";
  switch (agentType) {
    case "claude":
      return (
        <div class={`${iconClass} text-purple-500`}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5-10-5zM12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5-10-5z" />
          </svg>
        </div>
      );
    case "gemini":
      return (
        <div class={`${iconClass} text-blue-500`}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>
      );
    case "opencode":
      return (
        <div class={`${iconClass} text-green-500`}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 19c-5.1 1.5-5.2 7.9 0-5-2 7.9-0-5.2C3.5 11.3.5.5 11.3 0 5.2 7.9-0-5.2 0 10 5c0 11.3 0 15 0 15v-1.3 0 15-7.9-0 15-15.7 0 15-15.7-4.21c0-15.7-4.21c-15.7-4.21 0-8.5 0 15-7.9-4.21c0-8.5-0 11.3 0-8.5 11.3 0-8.5 11.3-0 11.3 0 11.3-7.9 0 11.3-7.9 0 11.3 0 11.3 0 7.9 0 11.3c0 7.9 0 11.3 0 7.9H5.4c0-2.21-2-7.9 2-7.9 0 15.7 0 15-15.7 0 15H9z" />
          </svg>
        </div>
      );
    case "copilot":
      return (
        <div class={`${iconClass} text-gray-500`}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="5" r="2" />
            <path d="M12 7v4" />
            <line x1="8" y1="16" x2="8" y2="16" />
            <line x1="16" y1="16" x2="16" y2="16" />
          </svg>
        </div>
      );
    case "qwen":
      return (
        <div class={`${iconClass} text-orange-500`}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="4" y="3" width="16" height="18" rx="2" />
            <path d="M12 6v4" />
            <circle cx="12" cy="11" r="2" />
          </svg>
        </div>
      );
    default:
      return (
        <div class={`${iconClass} text-gray-500`}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>
      );
  }
};

// ============================================================================
// Session Item Component
// ============================================================================

interface SessionItemProps {
  session: ReturnType<typeof sessionStore.getSession>;
  isActive: boolean;
  onClick: () => void;
  onClose: (e: Event) => void;
  onSpawnRemoteSession?: () => void;
}

const SessionItem: Component<SessionItemProps> = (props) => {
  const session = () => props.session;

  return (
    <div
      class={`group relative flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200
        ${props.isActive
          ? "bg-primary/10 border-r-2 border-primary"
          : "hover:bg-base-200/50 border-r-2 border-transparent"
        }`}
      onClick={props.onClick}
    >
      {/* Mode Indicator */}
      <div class="flex-shrink-0">
        <Show
          when={session()?.mode === "local"}
          fallback={<LocalIcon />}
        >
          <RemoteIcon />
        </Show>
      </div>

      {/* Agent Icon */}
      <div class={`flex-shrink-0 ${props.isActive ? "text-primary" : ""}`}>
        {getAgentIcon(session()?.agentType || "claude")}
      </div>

      {/* Session Info */}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class={`font-medium text-sm truncate ${props.isActive ? "text-primary" : ""}`}>
            {session()?.agentType === "claude" && "Claude"}
            {session()?.agentType === "gemini" && "Gemini"}
            {session()?.agentType === "opencode" && "OpenCode"}
            {session()?.agentType === "copilot" && "Copilot"}
            {session()?.agentType === "qwen" && "Qwen"}
            {session()?.agentType === "custom" && "Custom"}
          </span>
          <span class={`text-xs text-base-content/50 ${
            session()?.mode === "local" ? "bg-primary/20 px-2 py-0.5 rounded-full" : "bg-base-200 px-2 py-0.5 rounded-full"
          }`}>
            {session()?.mode === "local" ? "Local" : "Remote"}
          </span>
        </div>
        <div class="text-xs text-base-content/60 truncate">
          {session()?.projectPath?.split("/").pop() || "No project"}
        </div>
      </div>

      {/* Status Indicator */}
      <div class="flex items-center gap-2">
        {session()?.active && (
          <span class="w-2 h-2 rounded-full bg-success animate-pulse" />
        )}
        <Show when={session()?.mode === "local" && props.onSpawnRemoteSession}>
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            onClick={(e) => {
              e.stopPropagation();
              if (props.onSpawnRemoteSession) {
                props.onSpawnRemoteSession();
              }
            }}
            title="Spawn remote session"
          >
            <PlusIcon />
          </button>
        </Show>
      </div>

      {/* Close Button */}
      <button
        class={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity
          ${props.isActive ? "hover:bg-primary/20" : "hover:bg-base-300"}`}
        onClick={props.onClose}
        title="Close session"
      >
        <CloseIcon />
      </button>
    </div>
  );
};

// ============================================================================
// Session Sidebar Component
// ============================================================================

interface SessionSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const SessionSidebar: Component<SessionSidebarProps> = (props) => {
  const [mode, setMode] = createSignal<SessionMode>("remote");
  const [showNewSessionModal, setShowNewSessionModal] = createSignal(false);
  const [newSessionAgent, setNewSessionAgent] = createSignal<AgentType>("claude");
  const [newSessionPath, setNewSessionPath] = createSignal("");
  const [newSessionMode, setNewSessionMode] = createSignal<"remote" | "local">("remote");

  // Remote connection state
  const [sessionTicket, setSessionTicket] = createSignal("");
  const [connecting, setConnecting] = createSignal(false);
  const [connectionError, setConnectionError] = createSignal<string | null>(null);

  const sessions = () => sessionStore.getSessions();
  const activeSession = () => sessionStore.getActiveSession();
  const activeSessions = () => sessionStore.getActiveSessions();

  // Load local sessions on mount
  const handleLoadLocalSessions = async () => {
    try {
      const localSessions = await invoke<ReturnType<typeof sessionStore.getSessions>>("local_list_agents");
      // Add mode property to each session
      const sessionsWithMode = localSessions.map((s) => ({
        ...s,
        mode: "local" as SessionMode,
      }));

      // Update sessions in store
      for (const session of sessionsWithMode) {
        sessionStore.addSession(session);
      }

      setMode("local");
      notificationStore.success("Loaded local sessions", "System");
    } catch (error) {
      console.error("Failed to load local sessions:", error);
      notificationStore.error("Failed to load local sessions", "Error");
    }
  };

  const handleSessionClick = (sessionId: string) => {
    const session = sessionStore.getSession(sessionId);
    if (session?.mode === "remote") {
      // For remote sessions, switch to remote mode
      setMode("remote");
    } else {
      setMode("local");
    }
    sessionStore.setActiveSession(sessionId);
  };

  const handleCloseSession = (e: Event, sessionId: string) => {
    e.stopPropagation();
    const session = sessionStore.getSession(sessionId);
    if (session?.mode === "local") {
      // Stop local agent
      invoke("local_stop_agent", { sessionId }).catch((err) => {
        console.error("Failed to stop local agent:", err);
        notificationStore.error("Failed to stop local agent", "Error");
      });
    }
    sessionStore.removeSession(sessionId);
    notificationStore.success("Session closed", "System");
  };

  // Handle remote ticket connection
  const handleRemoteConnect = async () => {
    const ticket = sessionTicket().trim();
    if (!ticket) {
      setConnectionError("Please enter a session ticket");
      return;
    }

    setConnecting(true);
    setConnectionError(null);

    try {
      const sessionId = await invoke<string>("connect_to_host", {
        sessionTicket: ticket,
      });

      // Add remote session to store
      sessionStore.addSession({
        sessionId,
        agentType: newSessionAgent(),
        projectPath: "",
        startedAt: Date.now(),
        active: true,
        controlledByRemote: false,
        hostname: "remote",
        os: "remote",
        currentDir: "",
        machineId: "remote",
        mode: "remote",
      });

      sessionStore.setActiveSession(sessionId);
      setShowNewSessionModal(false);
      setSessionTicket("");
      setMode("remote");
      notificationStore.success("Connected to remote host", "System");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setConnectionError(errorMessage);
      notificationStore.error(`Connection failed: ${errorMessage}`, "Error");
    } finally {
      setConnecting(false);
    }
  };

  const handleCreateSession = () => {
    if (newSessionMode() === "remote") {
      handleRemoteConnect();
      return;
    }

    if (!newSessionPath().trim()) {
      notificationStore.error("Please enter a project path", "Error");
      return;
    }

    // Create local agent session
    invoke<string>("local_start_agent", {
      agentTypeStr: newSessionAgent(),
      projectPath: newSessionPath(),
      sessionId: undefined,
    }).then((sessionId) => {
      const newSession: ReturnType<typeof sessionStore.getSession> = {
        sessionId,
        agentType: newSessionAgent(),
        projectPath: newSessionPath(),
        startedAt: Date.now(),
        active: true,
        controlledByRemote: false,
        hostname: "localhost",
        os: navigator.userAgent,
        currentDir: newSessionPath(),
        machineId: "local",
        mode: "local",
      };

      sessionStore.addSession(newSession);
      sessionStore.setActiveSession(sessionId);
      setShowNewSessionModal(false);
      setNewSessionPath("");
      notificationStore.success("Local agent session started", "System");
    }).catch((error) => {
      console.error("Failed to start local agent:", error);
      notificationStore.error("Failed to start local agent", "Error");
    });
  };

  // Handle spawning remote session from local session
  const handleSpawnRemoteSession = () => {
    const session = activeSession();
    if (!session || session?.mode !== "local") {
      return;
    }

    // Trigger remote session spawn via CLI
    invoke("remote_spawn_session", {
      sessionId: session.sessionId,
      agentType: session.agentType,
      projectPath: session.projectPath,
      args: [],
    }).catch((err) => {
      console.error("Failed to spawn remote session:", err);
      notificationStore.error("Failed to spawn remote session", "Error");
    });
  };

  return (
    <>
      {/* Mobile Overlay */}
      <Show when={props.isOpen}>
        <div
          class="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={props.onToggle}
        />
      </Show>

      {/* Sidebar */}
      <aside
        class={`fixed lg:static inset-y-0 left-0 z-50 w-80 bg-base-100 border-r border-base-300
          transform transition-transform duration-300 ease-in-out
          ${props.isOpen ? "translate-x-0" : "-translate-x-full lg:hidden"}
        `}
      >
        {/* Mode Toggle */}
        <div class="flex items-center justify-between p-4 border-b border-base-300">
          <div class="flex items-center gap-2">
            <button
              type="button"
              class={`btn btn-sm ${mode() === "remote" ? "btn-active" : "btn-ghost"}`}
              onClick={() => {
                setMode("remote");
                handleLoadLocalSessions();
              }}
            >
              <RemoteIcon />
              Remote
            </button>
            <button
              type="button"
              class={`btn btn-sm ${mode() === "local" ? "btn-active" : "btn-ghost"}`}
              onClick={() => setMode("local")}
            >
              <LocalIcon />
              Local
            </button>
          </div>
          <button
            class="btn btn-sm btn-ghost btn-circle"
            onClick={props.onToggle}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Session List Header */}
        <div class="p-3 border-b border-base-200">
          <h3 class="text-xs font-bold text-base-content/50 uppercase">
            {mode() === "local" ? "Local Sessions" : "Remote Sessions"}
          </h3>
        </div>

        {/* Session List */}
        <div class="overflow-y-auto flex-1 p-2">
          <Show when={sessions().length > 0}>
            <For each={sessions()}>
              {(session) => (
                <SessionItem
                  session={session}
                  isActive={session.sessionId === activeSession()?.sessionId}
                  onClick={() => handleSessionClick(session.sessionId)}
                  onClose={(e) => handleCloseSession(e, session.sessionId)}
                  onSpawnRemoteSession={handleSpawnRemoteSession}
                />
              )}
            </For>
          </Show>
          <Show when={sessions().length === 0}>
            <div class="text-center py-8 text-base-content/50">
              <p class="text-sm">No active sessions</p>
              <p class="text-xs mt-1">
                {mode() === "remote" ? "Connect to a remote CLI" : "Create a local agent session"}
              </p>
            </div>
          </Show>
        </div>

        {/* Footer */}
        <div class="p-3 border-t border-base-300">
          <div class="flex items-center justify-between">
            <div class="text-xs text-base-content/50">
              {activeSessions().length} active session{activeSessions().length !== 1 ? "s" : ""}
            </div>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              onClick={() => setShowNewSessionModal(true)}
              title="New Session"
            >
              <PlusIcon />
            </button>
          </div>
        </div>
      </aside>

      {/* New Session Modal */}
      <Show when={showNewSessionModal()}>
        <dialog class="modal modal-open">
          <div class="modal-box max-w-md">
            <h3 class="font-bold text-lg mb-4 flex items-center gap-2">
              <PlusIcon />
              New Session
            </h3>

            {/* Mode Toggle */}
            <div class="flex gap-2 mb-4">
              <button
                type="button"
                class={`btn ${newSessionMode() === "remote" ? "btn-active" : "btn-ghost"}`}
                onClick={() => {
                  setNewSessionMode("remote");
                  setConnectionError(null);
                }}
              >
                <RemoteIcon /> Remote
              </button>
              <button
                type="button"
                class={`btn ${newSessionMode() === "local" ? "btn-active" : "btn-ghost"}`}
                onClick={() => {
                  setNewSessionMode("local");
                  setConnectionError(null);
                }}
              >
                <LocalIcon /> Local
              </button>
            </div>

            {/* Remote Mode: Ticket Input */}
            <Show when={newSessionMode() === "remote"}>
              <div class="form-control mb-4">
                <label class="label">
                  <span class="label-text font-semibold">Session Ticket</span>
                </label>
                <textarea
                  class="textarea textarea-bordered w-full font-mono text-sm h-24"
                  placeholder="Paste the session ticket from CLI host..."
                  value={sessionTicket()}
                  onInput={(e) => {
                    setSessionTicket(e.currentTarget.value);
                    setConnectionError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && sessionTicket().trim()) {
                      e.preventDefault();
                      handleRemoteConnect();
                    }
                  }}
                />
                <label class="label">
                  <span class="label-text-alt text-base-content/50">
                    Run `cli host` to get a session ticket
                  </span>
                </label>
              </div>

              <Show when={connectionError()}>
                <div class="alert alert-error mb-4 py-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  <span class="text-sm">{connectionError()}</span>
                </div>
              </Show>
            </Show>

            {/* Local Mode: Agent Config */}
            <Show when={newSessionMode() === "local"}>
              <div class="form-control mb-4">
                <label class="label">
                  <span class="label-text font-semibold">Agent Type</span>
                </label>
                <select
                  class="select select-bordered w-full"
                  value={newSessionAgent()}
                  onChange={(e) => setNewSessionAgent(e.currentTarget.value as AgentType)}
                >
                  <option value="claude">Claude Code</option>
                  <option value="gemini">Gemini CLI</option>
                  <option value="opencode">OpenCode</option>
                  <option value="copilot">GitHub Copilot</option>
                  <option value="qwen">Qwen Code</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div class="form-control mb-4">
                <label class="label">
                  <span class="label-text font-semibold">Project Path</span>
                </label>
                <input
                  type="text"
                  value={newSessionPath()}
                  onInput={(e) => setNewSessionPath(e.currentTarget.value)}
                  placeholder="/path/to/project"
                  class="input input-bordered w-full font-mono text-sm"
                />
              </div>
            </Show>

            <div class="modal-action">
              <button
                type="button"
                class="btn btn-ghost"
                onClick={() => {
                  setShowNewSessionModal(false);
                  setConnectionError(null);
                  setSessionTicket("");
                }}
              >
                Cancel
              </button>
              <Show
                when={newSessionMode() === "remote"}
                fallback={
                  <button
                    type="button"
                    class="btn btn-primary"
                    onClick={handleCreateSession}
                    disabled={!newSessionPath().trim()}
                  >
                    Create Session
                  </button>
                }
              >
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick={handleRemoteConnect}
                  disabled={!sessionTicket().trim() || connecting()}
                >
                  <Show
                    when={connecting()}
                    fallback={<span>Connect</span>}
                  >
                    <span class="loading loading-spinner loading-sm" />
                    Connecting...
                  </Show>
                </button>
              </Show>
            </div>
          </div>
          <form method="dialog" class="modal-backdrop">
            <button onClick={() => setShowNewSessionModal(false)}>close</button>
          </form>
        </dialog>
      </Show>
    </>
  );
};

export default SessionSidebar;
