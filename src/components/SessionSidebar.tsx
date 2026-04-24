/**
 * SessionSidebar Component
 *
 * Left navigation sidebar inspired by OpenChamber's clean design.
 * Shows navigation menu with session-aware indicators.
 * Uses bg-sidebar, bg-background, and border tokens for consistency.
 */

import { Show, For, type Component, createMemo } from "solid-js";
import {
  FiActivity,
  FiArchive,
  FiSettings,
  FiChevronRight,
  FiFolder,
  FiHome,
  FiList,
  FiMessageSquare,
  FiMonitor,
  FiPlus,
  FiStopCircle,
} from "solid-icons/fi";
import {
  navigationStore,
  type NavigationView,
} from "../stores/navigationStore";
import { sessionStore } from "../stores/sessionStore";
import type { AgentSessionMetadata } from "../stores/sessionStore";
import { cn } from "~/lib/utils";

import { t } from "../stores/i18nStore";

// ============================================================================
// Navigation Items
// ============================================================================

interface NavItem {
  id: NavigationView;
  label: () => string;
  icon: typeof FiActivity;
  description?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: () => t("sidebar.home") as string, icon: FiHome },
  {
    id: "devices",
    label: () => t("sidebar.devices") as string,
    icon: FiMonitor,
  },
  {
    id: "settings",
    label: () => t("sidebar.settings") as string,
    icon: FiSettings,
  },
];

interface ThreadGroup {
  projectPath: string;
  projectName: string;
  sessions: AgentSessionMetadata[];
  lastStartedAt: number;
}

const getProjectName = (projectPath: string) => {
  const parts = projectPath.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || projectPath || "Untitled";
};

const getThreadScope = (session: AgentSessionMetadata) => {
  if (session.mode === "local") return "Local";
  return session.hostname || session.controlSessionId?.slice(0, 8) || "Remote";
};

// ============================================================================
// Connection Status Badge
// ============================================================================

const ConnectionBadge: Component = () => {
  const connectionState = () => sessionStore.state.connectionState;
  const isConnected = () => connectionState() === "connected";
  const isReconnecting = () => connectionState() === "reconnecting";

  return (
    <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
      <span
        class={cn(
          "relative inline-flex h-2.5 w-2.5 rounded-full",
          isConnected() && "bg-green-500",
          isReconnecting() && "bg-yellow-500",
          !isConnected() && !isReconnecting() && "bg-muted-foreground/40",
        )}
      >
        <Show when={isConnected()}>
          <span class="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
        </Show>
        <Show when={isReconnecting()}>
          <span class="absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75 animate-ping" />
        </Show>
      </span>
      <span class="text-xs font-medium text-muted-foreground">
        {isConnected()
          ? t("sidebar.connected")
          : isReconnecting()
            ? t("sidebar.reconnecting")
            : t("sidebar.disconnected")}
      </span>
    </div>
  );
};

// ============================================================================
// Nav Item Component
// ============================================================================

interface NavItemButtonProps {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}

const NavItemButton: Component<NavItemButtonProps> = (props) => {
  const Icon = props.item.icon;
  const hasActiveSession =
    props.item.id === "workspace" &&
    sessionStore.getActiveSessions().length > 0;

  return (
    <button
      type="button"
      onClick={props.onClick}
      class={cn(
        "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150",
        "hover:bg-muted/60",
        props.isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {/* Active indicator bar */}
      <span
        class={cn(
          "absolute left-0 h-8 w-1 rounded-r-full bg-primary transition-all duration-200",
          props.isActive ? "opacity-100" : "opacity-0 -translate-x-1",
        )}
      />

      <Icon
        size={18}
        class={cn(
          "transition-colors shrink-0",
          props.isActive
            ? "text-primary"
            : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      <span class="flex-1 text-left text-sm font-medium">
        {props.item.label()}
      </span>

      {/* Active session indicator */}
      <Show when={hasActiveSession}>
        <span class="flex h-2 w-2">
          <span class="absolute h-2 w-2 rounded-full bg-primary opacity-75 animate-ping" />
          <span class="relative h-2 w-2 rounded-full bg-primary" />
        </span>
      </Show>

      <FiChevronRight
        size={14}
        class={cn(
          "transition-all text-muted-foreground/40",
          props.isActive && "text-primary/60 rotate-90",
        )}
      />
    </button>
  );
};

// ============================================================================
// SessionSidebar Component
// ============================================================================

interface SessionSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const SessionSidebar: Component<SessionSidebarProps> = (props) => {
  const activeView = () => navigationStore.state.activeView;
  const sessions = createMemo(() => sessionStore.getSessions());
  const activeSession = createMemo(() => sessionStore.getActiveSession());
  const threadGroups = createMemo<ThreadGroup[]>(() => {
    const groups = new Map<string, ThreadGroup>();

    for (const session of sessions()) {
      const existing = groups.get(session.projectPath);
      if (existing) {
        existing.sessions.push(session);
        existing.lastStartedAt = Math.max(
          existing.lastStartedAt,
          session.startedAt,
        );
      } else {
        groups.set(session.projectPath, {
          projectPath: session.projectPath,
          projectName: getProjectName(session.projectPath),
          sessions: [session],
          lastStartedAt: session.startedAt,
        });
      }
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        sessions: group.sessions.sort((a, b) => b.startedAt - a.startedAt),
      }))
      .sort((a, b) => b.lastStartedAt - a.lastStartedAt);
  });

  const handleNavClick = (view: NavigationView) => {
    navigationStore.setActiveView(view);
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 768) {
      props.onToggle();
    }
  };

  const openThread = (sessionId: string) => {
    sessionStore.setActiveSession(sessionId);
    navigationStore.setActiveView("workspace");
    if (window.innerWidth < 768) {
      props.onToggle();
    }
  };

  const startThreadForProject = (session: AgentSessionMetadata) => {
    sessionStore.openNewSessionModal(
      session.mode || "remote",
      session.controlSessionId,
      false,
      session.projectPath,
      true,
    );
    sessionStore.setNewSessionAgent(session.agentType);
  };

  return (
    <aside class="flex h-full w-full flex-col bg-sidebar border-r border-border/50">
      {/* Header */}
      <div class="flex items-center justify-between px-4 py-4 border-b border-border/50">
        <div class="flex items-center gap-3">
          {/* App Logo */}
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
            <span class="text-primary-content font-black text-base">P</span>
          </div>
          <div>
            <h1 class="text-sm font-bold tracking-tight text-foreground leading-none">
              Irogen
            </h1>
            <p class="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wider">
              {t("sidebar.agentControl")}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div class="flex-1 overflow-y-auto px-3 py-4">
        {/* Section label */}
        <div class="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          {t("sidebar.navigation")}
        </div>

        {/* Nav items */}
        <nav class="relative space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavItemButton
              item={item}
              isActive={activeView() === item.id}
              onClick={() => handleNavClick(item.id)}
            />
          ))}
        </nav>

        <div class="mt-6">
          <div class="mb-2 flex items-center justify-between gap-2 px-3">
            <div class="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              <FiMessageSquare size={12} />
              <span>Threads</span>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-square h-7 w-7 rounded-lg"
              onClick={() => sessionStore.openNewSessionModal()}
              title="New thread"
              aria-label="New thread"
            >
              <FiPlus size={14} />
            </button>
          </div>
          <Show
            when={threadGroups().length > 0}
            fallback={
              <div class="rounded-xl border border-dashed border-border/60 bg-muted/20 px-3 py-4 text-center">
                <p class="text-xs font-medium text-foreground">
                  No threads yet
                </p>
                <p class="mt-1 text-[11px] leading-4 text-muted-foreground">
                  Start a session to run agents in parallel.
                </p>
              </div>
            }
          >
            <div class="space-y-3">
              <For each={threadGroups()}>
                {(group) => (
                  <section class="rounded-xl border border-border/50 bg-background/50 p-2">
                    <div class="mb-1.5 flex items-center justify-between gap-2 px-1">
                      <div class="flex min-w-0 items-center gap-1.5">
                        <FiFolder size={13} class="shrink-0 text-primary/70" />
                        <div class="min-w-0">
                          <div class="truncate text-xs font-semibold text-foreground">
                            {group.projectName}
                          </div>
                          <div class="truncate text-[10px] text-muted-foreground/70">
                            {group.projectPath}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs btn-square h-7 w-7 rounded-lg"
                        onClick={() => startThreadForProject(group.sessions[0])}
                        title="New thread in this project"
                        aria-label="New thread in this project"
                      >
                        <FiPlus size={13} />
                      </button>
                    </div>
                    <div class="space-y-1">
                      <For each={group.sessions}>
                        {(session) => {
                          const isActive =
                            activeSession()?.sessionId === session.sessionId;
                          return (
                            <div
                              class={cn(
                                "group/thread flex items-stretch gap-1 rounded-lg transition-all duration-150",
                                isActive
                                  ? "bg-primary/10 text-primary ring-1 ring-primary/15"
                                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                              )}
                            >
                              <button
                                type="button"
                                class="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left"
                                onClick={() => openThread(session.sessionId)}
                              >
                                <span
                                  class={cn(
                                    "h-2 w-2 shrink-0 rounded-full",
                                    session.active
                                      ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.35)]"
                                      : "bg-muted-foreground/40",
                                  )}
                                />
                                <div class="min-w-0 flex-1">
                                  <div class="truncate text-xs font-semibold capitalize">
                                    {session.agentType}
                                  </div>
                                  <div class="truncate text-[10px] text-muted-foreground/70">
                                    {getThreadScope(session)}
                                  </div>
                                </div>
                              </button>
                              <div class="flex shrink-0 items-center pr-1 opacity-0 transition-opacity group-hover/thread:opacity-100 group-focus-within/thread:opacity-100">
                                <Show when={session.active}>
                                  <button
                                    type="button"
                                    class="btn btn-ghost btn-xs btn-square h-7 w-7 rounded-md text-muted-foreground hover:text-warning"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void sessionStore.stopSession(
                                        session.sessionId,
                                      );
                                    }}
                                    title="Stop thread"
                                    aria-label="Stop thread"
                                  >
                                    <FiStopCircle size={13} />
                                  </button>
                                </Show>
                                <button
                                  type="button"
                                  class="btn btn-ghost btn-xs btn-square h-7 w-7 rounded-md text-muted-foreground hover:text-error"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    sessionStore.archiveSession(
                                      session.sessionId,
                                    );
                                  }}
                                  title="Archive thread"
                                  aria-label="Archive thread"
                                >
                                  <FiArchive size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        }}
                      </For>
                    </div>
                  </section>
                )}
              </For>
            </div>
          </Show>
        </div>

        <Show when={sessions().length > 0}>
          <div class="mt-6">
            <div class="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Library
            </div>
            <button
              type="button"
              class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-muted-foreground transition-all duration-150 hover:bg-muted/60 hover:text-foreground"
              onClick={() => handleNavClick("sessions")}
            >
              <FiList size={15} />
              <span class="flex-1 text-sm font-medium">
                {t("sidebar.sessions")}
              </span>
              <span class="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {sessions().length}
              </span>
            </button>
          </div>
        </Show>
      </div>

      {/* Footer - Connection Status */}
      <div class="border-t border-border/50 p-3">
        <ConnectionBadge />
      </div>
    </aside>
  );
};

export default SessionSidebar;
