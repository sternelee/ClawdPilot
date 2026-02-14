/**
 * AppLayout Component
 *
 * Main application layout with multi-session support.
 * Features:
 * - Collapsible sidebar with session list
 * - Main content area for active session
 * - Responsive design for mobile/desktop
 * - DaisyUI styling
 */

import { createSignal, Show, For, type Component } from "solid-js";
import { sessionStore, type AgentType } from "../stores/sessionStore";
import { notificationStore } from "../stores/notificationStore";

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
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
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
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
          </svg>
        </div>
      );
    default:
      return (
        <div class={`${iconClass} text-gray-500`}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
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
          {session()?.active && (
            <span class="w-2 h-2 rounded-full bg-success animate-pulse" />
          )}
        </div>
        <div class="text-xs text-base-content/50 truncate">
          {session()?.projectPath?.split("/").pop() || "No project"}
        </div>
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
  const [showNewSessionModal, setShowNewSessionModal] = createSignal(false);
  const [newSessionAgent, setNewSessionAgent] = createSignal<AgentType>("claude");
  const [newSessionPath, setNewSessionPath] = createSignal("");

  const sessions = () => sessionStore.getSessions();
  const activeSession = () => sessionStore.getActiveSession();

  const handleSessionClick = (sessionId: string) => {
    sessionStore.setActiveSession(sessionId);
  };

  const handleCloseSession = (e: Event, sessionId: string) => {
    e.stopPropagation();
    sessionStore.removeSession(sessionId);
    notificationStore.success("Session closed", "System");
  };

  const handleCreateSession = () => {
    if (!newSessionPath().trim()) {
      notificationStore.error("Please enter a project path", "Error");
      return;
    }

    // Create new session
    const sessionId = `session_${Date.now()}`;
    sessionStore.addSession({
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
    });

    sessionStore.setActiveSession(sessionId);
    setShowNewSessionModal(false);
    setNewSessionPath("");
    notificationStore.success("New session created", "System");
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
        class={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-base-100 border-r border-base-300
          transform transition-transform duration-300 ease-in-out
          ${props.isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:hidden"}`}
      >
        {/* Header */}
        <div class="flex items-center justify-between p-4 border-b border-base-300">
          <h2 class="font-bold text-lg">Sessions</h2>
          <button
            class="btn btn-sm btn-ghost btn-circle"
            onClick={() => setShowNewSessionModal(true)}
            title="New Session"
          >
            <PlusIcon />
          </button>
        </div>

        {/* Session List */}
        <div class="overflow-y-auto flex-1 py-2">
          <Show
            when={sessions().length > 0}
            fallback={
              <div class="text-center py-8 text-base-content/50">
                <p class="text-sm">No active sessions</p>
                <p class="text-xs mt-1">Click + to create one</p>
              </div>
            }
          >
            <For each={sessions()}>
              {(session) => (
                <SessionItem
                  session={session}
                  isActive={session.sessionId === activeSession()?.sessionId}
                  onClick={() => handleSessionClick(session.sessionId)}
                  onClose={(e) => handleCloseSession(e, session.sessionId)}
                />
              )}
            </For>
          </Show>
        </div>

        {/* Footer */}
        <div class="p-4 border-t border-base-300">
          <div class="flex items-center gap-2 text-sm text-base-content/50">
            <div class={`w-2 h-2 rounded-full ${
              sessionStore.state.connectionState === "connected"
                ? "bg-success"
                : sessionStore.state.connectionState === "connecting"
                ? "bg-warning animate-pulse"
                : "bg-error"
            }`} />
            <span class="capitalize">{sessionStore.state.connectionState}</span>
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
              </select>
            </div>

            <div class="form-control mb-6">
              <label class="label">
                <span class="label-text font-semibold">Project Path</span>
              </label>
              <input
                type="text"
                placeholder="/path/to/project"
                class="input input-bordered w-full font-mono text-sm"
                value={newSessionPath()}
                onInput={(e) => setNewSessionPath(e.currentTarget.value)}
              />
            </div>

            <div class="modal-action">
              <button
                class="btn btn-ghost"
                onClick={() => setShowNewSessionModal(false)}
              >
                Cancel
              </button>
              <button
                class="btn btn-primary"
                onClick={handleCreateSession}
                disabled={!newSessionPath().trim()}
              >
                Create Session
              </button>
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
