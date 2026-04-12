/**
 * SessionListView Component
 *
 * Displays list of AI agent sessions with controls for session management.
 * Improved with OpenChamber-inspired patterns:
 * - Hover actions (pin, copy URL, delete)
 * - Status indicators (streaming, thinking, idle)
 * - More session metadata (branch, project, last activity)
 * - Better typography hierarchy
 * - Inline editing of session titles
 * - Selection highlight for active session
 * - Skeleton loading states
 * - Time-based grouping (Today, Yesterday, This Week, Older)
 * - Session search functionality
 */

import {
  For,
  Show,
  createSignal,
  createMemo,
  type Component,
} from "solid-js";
import { sessionStore, type AgentSessionMetadata, type AgentType } from "../stores/sessionStore";
import { sessionEventRouter } from "../stores/sessionEventRouter";
import { notificationStore } from "../stores/notificationStore";
import {
  FiSearch,
  FiX,
  FiPlus,
  FiBookmark,
  FiTrash2,
  FiCopy,
  FiShare2,
  FiEdit3,
  FiCheck,
  FiClock,
  FiInbox,
  FiCalendar,
  FiChevronDown,
  FiChevronRight,
  FiWifi,
  FiCpu,
  FiFolder,
  FiActivity,
  FiMoreVertical,
} from "solid-icons/fi";
import { cn } from "~/lib/utils";

// ========================================================================
// Types
// ========================================================================

interface SessionListViewProps {
  onSelectSession?: (sessionId: string) => void;
  onStartNewSession?: () => void;
  onStopSession?: (sessionId: string) => void;
  onBack?: () => void;
}

interface SessionGroup {
  title: string;
  icon: typeof FiCalendar;
  sessions: AgentSessionMetadata[];
}

// ========================================================================
// Utility Functions
// ========================================================================

const getAgentIcon = (agentType: AgentType, className?: string) => {
  const iconPaths: Record<string, string> = {
    claude: "/claude-ai.svg",
    claudecode: "/claude-ai.svg",
    "claude-code": "/claude-ai.svg",
    codex: "/openai-light.svg",
    cursor: "/cursor.svg",
    opencode: "/opencode-wordmark-dark.svg",
    open: "/openai-light.svg",
    openai: "/openai-light.svg",
    gemini: "/google-gemini.svg",
    "gemini-cli": "/google-gemini.svg",
    openclaw: "/openclaw.svg",
    "open-claw": "/openclaw.svg",
  };

  const iconPath = iconPaths[agentType.toLowerCase()];

  if (iconPath) {
    return (
      <div class={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-base-200", className)}>
        <img src={iconPath} alt={agentType} class="w-5 h-5" />
      </div>
    );
  }

  return (
    <div class={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-base-200", className)}>
      <span class="text-sm">🤖</span>
    </div>
  );
};

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString();
};

const formatDetailedTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getProjectName = (projectPath: string) => {
  const parts = projectPath.split("/");
  return parts[parts.length - 1] || projectPath;
};

// ========================================================================
// Time-based Grouping
// ========================================================================

const groupSessionsByTime = (sessions: AgentSessionMetadata[]): SessionGroup[] => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const groups: Record<string, AgentSessionMetadata[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  };

  sessions.forEach((session) => {
    const sessionDate = new Date(session.startedAt);

    if (sessionDate >= today) {
      groups.today.push(session);
    } else if (sessionDate >= yesterday) {
      groups.yesterday.push(session);
    } else if (sessionDate >= thisWeek) {
      groups.thisWeek.push(session);
    } else {
      groups.older.push(session);
    }
  });

  const result: SessionGroup[] = [];

  if (groups.today.length > 0) {
    result.push({ title: "Today", icon: FiCalendar, sessions: groups.today });
  }
  if (groups.yesterday.length > 0) {
    result.push({ title: "Yesterday", icon: FiCalendar, sessions: groups.yesterday });
  }
  if (groups.thisWeek.length > 0) {
    result.push({ title: "This Week", icon: FiFolder, sessions: groups.thisWeek });
  }
  if (groups.older.length > 0) {
    result.push({ title: "Older", icon: FiInbox, sessions: groups.older });
  }

  return result;
};

// ========================================================================
// Status Indicators
// ========================================================================

interface StatusBadgeProps {
  status: "streaming" | "thinking" | "idle" | "tool_calling";
  isActive?: boolean;
}

const StatusBadge: Component<StatusBadgeProps> = (props) => {
  const statusConfig = () => {
    switch (props.status) {
      case "streaming":
        return {
          label: "Streaming",
          class: "bg-info/15 text-info border-info/30",
          dotClass: "bg-info",
          glow: "shadow-[0_0_8px_rgba(59,130,246,0.3)]",
        };
      case "thinking":
        return {
          label: "Thinking",
          class: "bg-secondary/15 text-secondary border-secondary/30",
          dotClass: "bg-secondary",
          glow: "shadow-[0_0_8px_rgba(173,198,255,0.3)]",
        };
      case "tool_calling":
        return {
          label: "Tool",
          class: "bg-warning/15 text-warning border-warning/30",
          dotClass: "bg-warning",
          glow: "shadow-[0_0_8px_rgba(255,183,134,0.3)]",
        };
      default:
        return {
          label: "Idle",
          class: "bg-base-300/50 text-base-content/60 border-base-content/20",
          dotClass: "bg-base-content/40",
          glow: "",
        };
    }
  };

  return (
    <div
      class={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all",
        statusConfig().class,
        statusConfig().glow,
      )}
    >
      <span
        class={cn(
          "w-1.5 h-1.5 rounded-full",
          statusConfig().dotClass,
          props.status === "streaming" && "animate-pulse",
          props.status === "thinking" && "animate-pulse",
        )}
      />
      {statusConfig().label}
    </div>
  );
};

// ========================================================================
// Skeleton Loading
// ========================================================================

const SessionCardSkeleton: Component = () => {
  return (
    <div class="bg-card rounded-xl p-4 border border-border animate-pulse">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-lg bg-muted" />
        <div class="flex-1 space-y-2">
          <div class="h-4 w-24 rounded bg-muted" />
          <div class="h-3 w-32 rounded bg-muted/50" />
          <div class="h-3 w-20 rounded bg-muted/30" />
        </div>
        <div class="h-5 w-16 rounded-full bg-muted/50" />
      </div>
    </div>
  );
};

const SessionListSkeleton: Component = () => {
  return (
    <div class="space-y-3">
      <For each={[1, 2, 3, 4, 5]}>
        {() => <SessionCardSkeleton />}
      </For>
    </div>
  );
};

// ========================================================================
// Session Actions Menu
// ========================================================================

interface SessionActionsMenuProps {
  session: AgentSessionMetadata;
  onPin?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onCopyUrl?: () => void;
  isPinned?: boolean;
}

const SessionActionsMenu: Component<SessionActionsMenuProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  let menuRef: HTMLDivElement | undefined;

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div class="relative" ref={menuRef}>
      <button
        type="button"
        class="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-base-300/50 focus:opacity-100 focus-visible:ring-2 focus-visible:ring-primary/50"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen());
        }}
        aria-label="Session actions"
      >
        <FiMoreVertical size={14} class="text-base-content/60" />
      </button>

      <Show when={isOpen()}>
        <div class="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-base-content/10 bg-base-100 shadow-xl shadow-base-content/5 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
          <button
            type="button"
            class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-base-content/80 hover:bg-base-200/60 hover:text-base-content transition-colors"
            onClick={() => handleAction(() => props.onPin?.())}
          >
            <FiBookmark size={14} class={props.isPinned ? "text-primary" : ""} />
            {props.isPinned ? "Unpin" : "Pin"}
          </button>
          <button
            type="button"
            class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-base-content/80 hover:bg-base-200/60 hover:text-base-content transition-colors"
            onClick={() => handleAction(() => props.onCopyUrl?.())}
          >
            <FiCopy size={14} />
            Copy URL
          </button>
          <button
            type="button"
            class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-base-content/80 hover:bg-base-200/60 hover:text-base-content transition-colors"
            onClick={() => handleAction(() => props.onShare?.())}
          >
            <FiShare2 size={14} />
            Share
          </button>
          <div class="my-1 h-px bg-base-content/10" />
          <button
            type="button"
            class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-error/70 hover:bg-error/10 hover:text-error transition-colors"
            onClick={() => handleAction(() => props.onDelete?.())}
          >
            <FiTrash2 size={14} />
            Delete
          </button>
        </div>
      </Show>
    </div>
  );
};

// ========================================================================
// Inline Title Editor
// ========================================================================

interface InlineTitleEditorProps {
  title: string;
  onSave: (newTitle: string) => void;
}

const InlineTitleEditor: Component<InlineTitleEditorProps> = (props) => {
  const [isEditing, setIsEditing] = createSignal(false);
  const [value, setValue] = createSignal(props.title);
  let inputRef: HTMLInputElement | undefined;

  const startEditing = (e: MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setValue(props.title);
    // Focus input after render
    requestAnimationFrame(() => inputRef?.focus());
  };

  const save = () => {
    const newTitle = value().trim();
    if (newTitle && newTitle !== props.title) {
      props.onSave(newTitle);
    }
    setIsEditing(false);
  };

  const cancel = () => {
    setValue(props.title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      save();
    } else if (e.key === "Escape") {
      cancel();
    }
  };

  return (
    <Show
      when={isEditing()}
      fallback={
        <button
          type="button"
          class="group flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors"
          onClick={startEditing}
        >
          <span class="truncate max-w-[180px]">{props.title}</span>
          <FiEdit3
            size={12}
            class="opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0"
          />
        </button>
      }
    >
      <div class="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={value()}
          onInput={(e) => setValue(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onBlur={save}
          class="w-full px-2 py-0.5 text-sm font-semibold rounded border border-primary/50 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          onClick={save}
          class="p-1 rounded hover:bg-success/10 text-success/60 hover:text-success transition-colors"
        >
          <FiCheck size={14} />
        </button>
        <button
          type="button"
          onClick={cancel}
          class="p-1 rounded hover:bg-error/10 text-error/60 hover:text-error transition-colors"
        >
          <FiX size={14} />
        </button>
      </div>
    </Show>
  );
};

// ========================================================================
// Enhanced Session Card
// ========================================================================

interface SessionCardProps {
  session: AgentSessionMetadata;
  isActive: boolean;
  isStreaming: boolean;
  isPinned?: boolean;
  onSelect: () => void;
  onStop: () => void;
  onPin?: () => void;
  onDelete?: () => void;
  onCopyUrl?: () => void;
  onShare?: () => void;
  onRename?: (title: string) => void;
}

const SessionCard: Component<SessionCardProps> = (props) => {
  const status = () => {
    if (props.isStreaming) return "streaming" as const;
    if (props.session.thinking) return "thinking" as const;
    return "idle" as const;
  };

  const projectName = () => getProjectName(props.session.projectPath);

  const handleCopyUrl = (e: MouseEvent) => {
    e.stopPropagation();
    const url = `irogen://session/${props.session.sessionId}`;
    navigator.clipboard.writeText(url);
    notificationStore.success("Session URL copied to clipboard", "Copied");
  };

  return (
    <div
      class={cn(
        "group relative bg-card rounded-xl p-4 border transition-all duration-200 cursor-pointer",
        "hover:shadow-md hover:border-primary/20",
        "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
        props.isActive
          ? "border-primary/30 bg-primary/5 shadow-sm shadow-primary/10"
          : "border-border hover:bg-card/80",
      )}
      onClick={props.onSelect}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onSelect();
        }
      }}
    >
      {/* Active selection indicator */}
      <Show when={props.isActive}>
        <div class="absolute left-0 top-4 bottom-4 w-1 rounded-r-full bg-primary" />
      </Show>

      <div class="flex items-start gap-3">
        {/* Agent Icon */}
        {getAgentIcon(props.session.agentType)}

        {/* Content */}
        <div class="flex-1 min-w-0 space-y-1.5">
          {/* Title row with inline editing */}
          <InlineTitleEditor
            title={projectName()}
            onSave={(title) => props.onRename?.(title)}
          />

          {/* Path */}
          <p class="text-xs text-muted-foreground truncate max-w-[250px]" title={props.session.currentDir}>
            {props.session.currentDir}
          </p>

          {/* Metadata row */}
          <div class="flex flex-wrap items-center gap-2">
            {/* Git branch */}
            <Show when={props.session.gitBranch}>
              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50 text-[10px] font-mono text-muted-foreground">
                <FiActivity size={10} />
                {props.session.gitBranch}
              </span>
            </Show>

            {/* Time */}
            <span class="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60">
              <FiClock size={10} />
              {formatTime(props.session.startedAt)}
            </span>

            {/* Agent type */}
            <span class="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60">
              <FiCpu size={10} />
              {props.session.agentType}
            </span>
          </div>
        </div>

        {/* Right side: Status + Actions */}
        <div class="flex flex-col items-end gap-2">
          {/* Status Badge */}
          <StatusBadge status={status()} isActive={props.session.active} />

          {/* Action buttons - visible on hover */}
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.onSelect();
              }}
              class="px-3 py-1 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Open
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopyUrl(e);
              }}
              class="p-1.5 rounded-lg hover:bg-base-300/50 text-base-content/40 hover:text-base-content transition-colors"
              title="Copy session URL"
            >
              <FiCopy size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.onStop();
              }}
              class="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive/40 hover:text-destructive transition-colors"
              title="Stop session"
            >
              <FiTrash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Hover actions menu (alternative) */}
      <div class="absolute top-2 right-2">
        <SessionActionsMenu
          session={props.session}
          onPin={props.onPin}
          onDelete={props.onDelete}
          onCopyUrl={handleCopyUrl}
          onShare={props.onShare}
          isPinned={props.isPinned}
        />
      </div>
    </div>
  );
};

// ========================================================================
// Session Group Component
// ========================================================================

interface SessionGroupItemProps {
  group: SessionGroup;
  activeSessionId?: string;
  pinnedSessions: Set<string>;
  onSelectSession: (sessionId: string) => void;
  onStopSession: (sessionId: string) => void;
  onPinSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

const SessionGroupItem: Component<SessionGroupItemProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(true);

  return (
    <div class="mb-4">
      {/* Group Header */}
      <button
        type="button"
        class="flex items-center gap-2 mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        onClick={() => setIsExpanded(!isExpanded())}
      >
        <Show
          when={isExpanded()}
          fallback={<FiChevronRight size={12} class="transition-transform" />}
        >
          <FiChevronDown size={12} class="transition-transform" />
        </Show>
        <props.group.icon size={12} />
        <span>{props.group.title}</span>
        <span class="text-muted-foreground/40">({props.group.sessions.length})</span>
      </button>

      {/* Sessions in group */}
      <Show when={isExpanded()}>
        <div class="space-y-2 pl-2">
          <For each={props.group.sessions}>
            {(session) => (
              <SessionCard
                session={session}
                isActive={props.activeSessionId === session.sessionId}
                isStreaming={
                  sessionEventRouter.getStreamingState(session.sessionId).isStreaming
                }
                isPinned={props.pinnedSessions.has(session.sessionId)}
                onSelect={() => props.onSelectSession(session.sessionId)}
                onStop={() => props.onStopSession(session.sessionId)}
                onPin={() => props.onPinSession(session.sessionId)}
                onDelete={() => props.onDeleteSession(session.sessionId)}
                onRename={(title) => {
                  // Handle rename - in a real app this would update the session
                  console.log("Rename session", session.sessionId, "to", title);
                }}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

// ========================================================================
// Empty State
// ========================================================================

interface EmptyStateProps {
  searchQuery?: string;
  onStartNewSession?: () => void;
}

const EmptyState: Component<EmptyStateProps> = (props) => {
  return (
    <div class="flex flex-col items-center justify-center h-full text-center py-12 animate-in fade-in duration-300">
      <div class="relative mb-6">
        <div class="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center">
          <FiInbox size={36} class="text-muted-foreground/30" />
        </div>
        <Show when={!props.searchQuery}>
          <div class="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <FiPlus size={16} class="text-primary/60" />
          </div>
        </Show>
      </div>

      <Show
        when={props.searchQuery}
        fallback={
          <>
            <h3 class="text-lg font-semibold text-foreground mb-2">
              No active sessions
            </h3>
            <p class="text-sm text-muted-foreground max-w-xs mb-6 leading-relaxed">
              Start a new AI agent session to begin coding assistance
            </p>
            <button
              onClick={props.onStartNewSession}
              class="px-6 py-2.5 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-xl transition-all"
            >
              Start New Session
            </button>
          </>
        }
      >
        <h3 class="text-lg font-semibold text-foreground mb-2">
          No matching results
        </h3>
        <p class="text-sm text-muted-foreground max-w-xs">
          No sessions match "{props.searchQuery}"
        </p>
      </Show>
    </div>
  );
};

// ========================================================================
// Main Component
// ========================================================================

export function SessionListView(props: SessionListViewProps) {
  const [filter, setFilter] = createSignal<"all" | "active">("all");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [pinnedSessions, setPinnedSessions] = createSignal<Set<string>>(new Set());

  const sessions = createMemo(() => {
    let allSessions = sessionStore.getSessions();

    // Apply filter
    if (filter() === "active") {
      allSessions = allSessions.filter((s) => s.active);
    }

    // Apply search
    const query = searchQuery().toLowerCase();
    if (query) {
      allSessions = allSessions.filter(
        (s) =>
          s.agentType.toLowerCase().includes(query) ||
          s.projectPath.toLowerCase().includes(query) ||
          s.currentDir.toLowerCase().includes(query) ||
          s.gitBranch?.toLowerCase().includes(query)
      );
    }

    return allSessions;
  });

  const groupedSessions = createMemo(() => groupSessionsByTime(sessions()));

  const activeCount = () => sessionStore.getActiveSessions().length;
  const activeSessionId = () => sessionStore.getActiveSession()?.sessionId;

  const handleStopSession = (sessionId: string) => {
    props.onStopSession?.(sessionId);
  };

  const handleSelectSession = (sessionId: string) => {
    props.onSelectSession?.(sessionId);
  };

  const togglePinSession = (sessionId: string) => {
    setPinnedSessions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const handleDeleteSession = (sessionId: string) => {
    // In a real app, this would show a confirmation dialog
    notificationStore.info(
      `Delete session: ${sessionId}`,
      "Delete Session"
    );
  };

  return (
    <div class="flex flex-col h-full bg-background">
      {/* Header */}
      <div class="p-4 border-b border-border space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-foreground">Sessions</h2>
            <p class="text-xs text-muted-foreground">
              {sessions().length} session{sessions().length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            onClick={props.onStartNewSession}
            class="px-4 py-2 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-xl transition-all flex items-center gap-2"
          >
            <FiPlus size={16} />
            New Session
          </button>
        </div>

        {/* Search */}
        <div class="relative">
          <FiSearch
            size={14}
            class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40"
          />
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="w-full pl-9 pr-4 py-2 h-10 text-sm rounded-xl border border-border bg-muted/30 placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <Show when={searchQuery()}>
            <button
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted transition-colors"
              onClick={() => setSearchQuery("")}
            >
              <FiX size={14} class="text-muted-foreground/40" />
            </button>
          </Show>
        </div>

        {/* Filter Tabs */}
        <div class="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            class={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
              filter() === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted",
            )}
          >
            All ({sessions().length})
          </button>
          <button
            onClick={() => setFilter("active")}
            class={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
              filter() === "active"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted",
            )}
          >
            Active ({activeCount()})
          </button>
        </div>
      </div>

      {/* Session List */}
      <div class="flex-1 overflow-y-auto p-4">
        {/* Loading State */}
        <Show when={isLoading()}>
          <SessionListSkeleton />
        </Show>

        {/* Empty State */}
        <Show when={!isLoading() && sessions().length === 0}>
          <EmptyState
            searchQuery={searchQuery() || undefined}
            onStartNewSession={props.onStartNewSession}
          />
        </Show>

        {/* Session Groups */}
        <Show when={!isLoading() && sessions().length > 0}>
          {/* Pinned sessions first (if any and no search) */}
          <Show when={!searchQuery() && pinnedSessions().size > 0}>
            <div class="mb-4">
              <div class="flex items-center gap-2 mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                <FiBookmark size={12} class="text-primary" />
                <span>Pinned</span>
                <span class="text-muted-foreground/40">({pinnedSessions().size})</span>
              </div>
              <div class="space-y-2 pl-2">
                <For each={sessions().filter((s) => pinnedSessions().has(s.sessionId))}>
                  {(session) => (
                    <SessionCard
                      session={session}
                      isActive={activeSessionId() === session.sessionId}
                      isStreaming={
                        sessionEventRouter.getStreamingState(session.sessionId).isStreaming
                      }
                      isPinned={true}
                      onSelect={() => handleSelectSession(session.sessionId)}
                      onStop={() => handleStopSession(session.sessionId)}
                      onPin={() => togglePinSession(session.sessionId)}
                      onDelete={() => handleDeleteSession(session.sessionId)}
                    />
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* Time-based groups */}
          <For each={groupedSessions()}>
            {(group) => (
              <SessionGroupItem
                group={group}
                activeSessionId={activeSessionId()}
                pinnedSessions={pinnedSessions()}
                onSelectSession={handleSelectSession}
                onStopSession={handleStopSession}
                onPinSession={togglePinSession}
                onDeleteSession={handleDeleteSession}
              />
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}

export default SessionListView;
