/**
 * SessionSidebar Component
 *
 * Sidebar for managing AI agent sessions in a unified list.
 */

import { onMount, Show, For, createSignal, type Component } from "solid-js";
import { FiPlus, FiX, FiRefreshCw, FiTrash2, FiClock } from "solid-icons/fi";
import { invoke } from "@tauri-apps/api/core";
import { sessionStore } from "../stores/sessionStore";
import { chatStore } from "../stores/chatStore";
import { notificationStore } from "../stores/notificationStore";
import type { AgentType, SessionRecord } from "../stores/sessionStore";
import { Button } from "./ui/primitives";

// ============================================================================
// Agent Icons - Using @lobehub/icons
// ============================================================================

// Import agent icons from lobehub
import {
  Claude,
  OpenAI,
  Gemini,
  GithubCopilot,
  Qwen,
  OpenClaw,
  Ai2,
} from "@lobehub/icons";

// Icon mapping with brand colors
const agentIconMap: Record<
  string,
  { Icon: any; color: string; bgColor: string }
> = {
  claude: { Icon: Claude, color: "#A855F7", bgColor: "bg-purple-500/20" },
  codex: { Icon: OpenAI, color: "#10B981", bgColor: "bg-emerald-500/20" },
  opencode: {
    Icon: OpenAI,
    color: "hsl(var(--primary))",
    bgColor: "bg-primary/20",
  },
  gemini: { Icon: Gemini, color: "#4285F4", bgColor: "bg-blue-500/20" },
  copilot: { Icon: GithubCopilot, color: "#6E7681", bgColor: "bg-gray-500/20" },
  qwen: { Icon: Qwen, color: "#6366F1", bgColor: "bg-indigo-500/20" },
  openclaw: { Icon: OpenClaw, color: "#F97316", bgColor: "bg-orange-500/20" },
  zeroClaw: { Icon: Ai2, color: "#F97316", bgColor: "bg-orange-500/20" },
};

const getAgentIcon = (agentType: AgentType) => {
  const iconClass = "w-9 h-9 rounded-xl flex items-center justify-center";
  const normalizedType = agentType?.toLowerCase() || "custom";
  const iconConfig = agentIconMap[normalizedType];

  if (iconConfig) {
    const { Icon, color, bgColor } = iconConfig;
    return (
      <div class={`${iconClass} ${bgColor}`} style={{ color }}>
        <Icon size={22} />
      </div>
    );
  }

  // Default fallback icon
  return (
    <div class={`${iconClass} bg-muted`}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    </div>
  );
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
      role="button"
      tabIndex={0}
      class={`group relative flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200
        ${
          props.isActive
            ? "bg-primary/10 border-r-2 border-primary"
            : "hover:bg-muted/50 border-r-2 border-transparent"
        }`}
      onClick={props.onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onClick();
        }
      }}
    >
      {/* Agent Icon */}
      <div class={`shrink-0 ${props.isActive ? "text-primary" : ""}`}>
        {getAgentIcon(session()?.agentType || "claude")}
      </div>

      {/* Session Info */}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span
            class={`font-medium text-sm truncate ${props.isActive ? "text-primary" : ""}`}
          >
            {session()?.agentType === "claude" && "Claude"}
            {session()?.agentType === "gemini" && "Gemini"}
            {session()?.agentType === "opencode" && "OpenCode"}
            {session()?.agentType === "copilot" && "Copilot"}
            {session()?.agentType === "qwen" && "Qwen"}
            {session()?.agentType === "codex" && "Codex"}
            {session()?.agentType === "zeroclaw" && "ClawdAI"}
            {session()?.agentType === "custom" && "Custom"}
          </span>
          <span
            class={`text-xs text-muted-foreground ${
              session()?.mode === "local"
                ? "bg-primary/20 px-2 py-0.5 rounded-full"
                : "bg-muted px-2 py-0.5 rounded-full"
            }`}
          >
            {session()?.mode === "local" ? "Local" : "Remote"}
          </span>
        </div>
        <div class="text-xs text-muted-foreground/60 truncate">
          {session()?.projectPath?.split("/").pop() || "No project"}
        </div>
      </div>

      {/* Close Button */}
      <Button
        type="button"
        variant="ghost"
        size="xs"
        class={`p-1 rounded opacity-0 inline-flex items-center justify-center group-hover:opacity-100 transition-opacity
          ${props.isActive ? "hover:bg-primary/20" : "hover:bg-muted"}`}
        onClick={props.onClose}
        title="Close session"
      >
        <FiX size={16} />
      </Button>
    </div>
  );
};

// ============================================================================
// Saved Session Item Component
// ============================================================================

interface SavedSessionItemProps {
  session: SessionRecord;
  onRestore: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

const SavedSessionItem: Component<SavedSessionItemProps> = (props) => {
  const [isDeleting, setIsDeleting] = createSignal(false);

  const handleRestore = async () => {
    setIsDeleting(true);
    try {
      await props.onRestore(props.session.sessionId);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this saved session?")) {
      setIsDeleting(true);
      try {
        await props.onDelete(props.session.sessionId);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div
      class="group relative flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200
        hover:bg-muted/50 border-r-2 border-transparent"
      onClick={handleRestore}
    >
      {/* Agent Icon */}
      <div class="shrink-0 text-muted-foreground">
        <FiClock size={16} />
      </div>

      {/* Session Info */}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-medium text-sm truncate">
            {props.session.agentType === "claudeCode" && "Claude"}
            {props.session.agentType === "gemini" && "Gemini"}
            {props.session.agentType === "openCode" && "OpenCode"}
            {props.session.agentType === "copilot" && "Copilot"}
            {props.session.agentType === "qwen" && "Qwen"}
            {props.session.agentType === "codex" && "Codex"}
            {props.session.agentType === "zeroClaw" && "ClawdAI"}
            {props.session.agentType === "custom" && "Custom"}
            {/* Also handle lowercase versions from frontend */}
            {props.session.agentType === "claude" && "Claude"}
            {props.session.agentType === "opencode" && "OpenCode"}
            {props.session.agentType === "zeroclaw" && "ClawdAI"}
          </span>
          <span class="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {props.session.messages?.length || 0} msgs
          </span>
        </div>
        <div class="text-xs text-muted-foreground/60 truncate">
          {props.session.projectPath?.split("/").pop() || "No project"}
        </div>
        <div class="text-xs text-muted-foreground/40">
          {formatDate(props.session.lastActiveAt)}
        </div>
      </div>

      {/* Action Buttons */}
      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          class="p-1 rounded hover:bg-primary/20"
          onClick={(e) => {
            e.stopPropagation();
            handleRestore();
          }}
          title="Restore session"
          disabled={isDeleting()}
        >
          <FiRefreshCw size={14} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          class="p-1 rounded hover:bg-destructive/20 text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          title="Delete session"
          disabled={isDeleting()}
        >
          <FiTrash2 size={14} />
        </Button>
      </div>
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
  const sessions = () => sessionStore.getSessions();
  const activeSession = () => sessionStore.getActiveSession();
  const activeSessions = () => sessionStore.getActiveSessions();

  // Saved sessions state
  const [savedSessions, setSavedSessions] = createSignal<SessionRecord[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = createSignal(false);
  const [showSaved, setShowSaved] = createSignal(false);

  // Load local sessions on mount
  const handleLoadLocalSessions = async () => {
    try {
      // 定义后端返回的类型
      type BackendSessionMetadata = {
        session_id: string;
        agentType: string;
        projectPath: string;
        startedAt: number;
        active: boolean;
        controlledByRemote: boolean;
        hostname: string;
        os: string;
        agentVersion?: string;
        currentDir: string;
        gitBranch?: string;
        machineId: string;
      };

      const localSessions =
        await invoke<BackendSessionMetadata[]>("local_list_agents");
      // Add mode property to each session and convert session_id to sessionId
      const sessionsWithMode = localSessions.map((s) => ({
        sessionId: s.session_id,
        agentType: s.agentType as AgentType,
        projectPath: s.projectPath,
        startedAt: s.startedAt,
        active: s.active,
        controlledByRemote: s.controlledByRemote,
        hostname: s.hostname,
        os: s.os,
        agentVersion: s.agentVersion,
        currentDir: s.currentDir,
        gitBranch: s.gitBranch,
        machineId: s.machineId,
        mode: "local" as const,
      }));

      // Update sessions in store
      for (const session of sessionsWithMode) {
        sessionStore.addSession(session);
      }
    } catch (error) {
      console.error("Failed to load local sessions:", error);
    }
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
    // Clear chat messages for this session
    chatStore.clearMessages(sessionId);
    sessionStore.removeSession(sessionId);
  };

  // Handle spawning remote session from local session
  const handleSpawnRemoteSession = () => {
    const session = activeSession();
    if (!session || session?.mode !== "local") {
      return;
    }

    // Trigger remote session spawn via CLI
    invoke("remote_spawn_session", {
      connectionSessionId: session.sessionId,
      agentType: session.agentType,
      projectPath: session.projectPath,
      args: [],
    }).catch((err) => {
      console.error("Failed to spawn remote session:", err);
      notificationStore.error("Failed to spawn remote session", "Error");
    });
  };

  onMount(() => {
    void handleLoadLocalSessions();
  });

  // Load saved sessions
  const loadSavedSessions = async () => {
    setIsLoadingSaved(true);
    try {
      const sessions = await sessionStore.loadSavedSessions({ limit: 20 });
      setSavedSessions(sessions);
    } catch (error) {
      console.error("Failed to load saved sessions:", error);
    } finally {
      setIsLoadingSaved(false);
    }
  };

  // Toggle saved sessions panel
  const handleToggleSaved = async () => {
    const newShow = !showSaved();
    setShowSaved(newShow);
    if (newShow && savedSessions().length === 0) {
      await loadSavedSessions();
    }
  };

  // Restore a saved session
  const handleRestoreSession = async (sessionId: string) => {
    try {
      const newSessionId = await sessionStore.restoreSession(sessionId);
      if (newSessionId) {
        notificationStore.success("Session restored successfully", "Restore");
        // Reload saved sessions
        await loadSavedSessions();
      }
    } catch (error) {
      console.error("Failed to restore session:", error);
      notificationStore.error("Failed to restore session", "Error");
    }
  };

  // Delete a saved session
  const handleDeleteSavedSession = async (sessionId: string) => {
    try {
      await sessionStore.deleteSavedSession(sessionId);
      // Clear chat messages for this session
      chatStore.clearMessages(sessionId);
      // Update local state
      setSavedSessions(
        savedSessions().filter((s) => s.sessionId !== sessionId),
      );
      notificationStore.success("Session deleted", "Delete");
    } catch (error) {
      console.error("Failed to delete session:", error);
      notificationStore.error("Failed to delete session", "Error");
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      <Show when={props.isOpen}>
        <button
          type="button"
          class="fixed inset-0 bg-black/50 z-40 lg:hidden w-full h-full border-none cursor-default"
          onClick={props.onToggle}
          aria-label="Close sidebar"
        />
      </Show>

      {/* Sidebar */}
      <aside
        class={`fixed lg:static inset-y-0 bg-base-300 left-0 z-50 w-80 bg-background border-r border-border
          transform transition-transform duration-300 ease-in-out
          ${props.isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Header */}
        <div class="flex items-center justify-between p-4 border-b border-border">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-semibold">Sessions</h3>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              class="text-xs h-7"
              onClick={handleToggleSaved}
              title={
                showSaved() ? "Hide saved sessions" : "Show saved sessions"
              }
            >
              <FiClock size={14} class="mr-1" />
              {showSaved() ? "Saved" : "History"}
            </Button>
            <span class="text-[10px] text-muted-foreground/50 hidden sm:inline">
              Press <kbd class="kbd kbd-xs">B</kbd> to toggle
            </span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            class="h-8 w-8 lg:hidden"
            onClick={props.onToggle}
          >
            <FiX size={18} />
          </Button>
        </div>

        {/* Session List */}
        <div class="overflow-y-auto flex-1 p-2">
          {/* Active Sessions */}
          <Show when={!showSaved()}>
            <Show when={sessions().length > 0}>
              <For each={sessions()}>
                {(session) => (
                  <SessionItem
                    session={session}
                    isActive={session.sessionId === activeSession()?.sessionId}
                    onClick={() =>
                      sessionStore.setActiveSession(session.sessionId)
                    }
                    onClose={(e) => handleCloseSession(e, session.sessionId)}
                    onSpawnRemoteSession={handleSpawnRemoteSession}
                  />
                )}
              </For>
            </Show>
            <Show when={sessions().length === 0}>
              <div class="text-center py-8 text-muted-foreground">
                <p class="text-sm">No active sessions</p>
                <p class="text-xs mt-1">
                  Create a local session or connect to a remote CLI
                </p>
              </div>
            </Show>
          </Show>

          {/* Saved Sessions */}
          <Show when={showSaved()}>
            <div class="mt-2 pt-2 border-t border-border">
              <div class="px-2 py-1 text-xs font-medium text-muted-foreground">
                Saved Sessions ({savedSessions().length})
              </div>
            </div>
            <Show when={isLoadingSaved()}>
              <div class="text-center py-4 text-muted-foreground">
                <p class="text-sm">Loading...</p>
              </div>
            </Show>
            <Show when={!isLoadingSaved() && savedSessions().length > 0}>
              <For each={savedSessions()}>
                {(session) => (
                  <SavedSessionItem
                    session={session}
                    onRestore={handleRestoreSession}
                    onDelete={handleDeleteSavedSession}
                  />
                )}
              </For>
            </Show>
            <Show when={!isLoadingSaved() && savedSessions().length === 0}>
              <div class="text-center py-8 text-muted-foreground">
                <p class="text-sm">No saved sessions</p>
                <p class="text-xs mt-1">Sessions will be saved automatically</p>
              </div>
            </Show>
          </Show>
        </div>

        {/* Footer */}
        <div class="p-3 border-t border-border">
          <div class="flex items-center justify-between">
            <div class="text-xs text-muted-foreground">
              {activeSessions().length} active session
              {activeSessions().length !== 1 ? "s" : ""}
            </div>
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => sessionStore.openNewSessionModal("local")}
              title="New Session"
            >
              <FiPlus size={18} />
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default SessionSidebar;
