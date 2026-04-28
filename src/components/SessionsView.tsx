/**
 * SessionsView Component
 *
 * Zed-inspired: hard lines, high contrast, no gradients/shadows/animations.
 */

import { createSignal, createMemo, For, Show, type Component } from "solid-js";
import {
  FiActivity,
  FiServer,
  FiHome,
  FiSearch,
  FiPlus,
  FiX,
} from "solid-icons/fi";
import { sessionStore } from "../stores/sessionStore";
import { navigationStore } from "../stores/navigationStore";
import { t } from "../stores/i18nStore";

export const SessionsView: Component = () => {
  const [filter, setFilter] = createSignal<
    "all" | "active" | "local" | "remote"
  >("all");
  const [searchQuery, setSearchQuery] = createSignal("");

  const sessions = createMemo(() => {
    let list = sessionStore.getSessions();

    if (filter() === "active") {
      list = list.filter((s) => s.active);
    } else if (filter() === "local") {
      list = list.filter((s) => s.mode === "local");
    } else if (filter() === "remote") {
      list = list.filter((s) => s.mode === "remote");
    }

    const query = searchQuery().toLowerCase().trim();
    if (query) {
      list = list.filter(
        (s) =>
          s.projectPath.toLowerCase().includes(query) ||
          s.agentType.toLowerCase().includes(query) ||
          s.hostname?.toLowerCase().includes(query),
      );
    }

    return list.sort((a, b) => b.startedAt - a.startedAt);
  });

  const activeSessionId = createMemo(() => sessionStore.state.activeSessionId);

  const handleResumeSession = (sessionId: string) => {
    sessionStore.setActiveSession(sessionId);
    navigationStore.setActiveView("workspace");
  };

  const handleDeleteSession = (e: MouseEvent, sessionId: string) => {
    e.stopPropagation();
    sessionStore.removeSession(sessionId);
  };

  return (
    <div class="flex h-full flex-col overflow-y-auto bg-background p-4 sm:p-8">
      <div class="mx-auto w-full max-w-4xl space-y-6">
        <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-start sm:items-center gap-3">
            <button
              type="button"
              class="h-10 w-10 md:hidden shrink-0 -ml-2 border border-black/10 flex items-center justify-center text-zinc-500 hover:text-foreground hover:border-zinc-400"
              onClick={() => navigationStore.setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" />
              </svg>
            </button>
            <div>
              <h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {t("sessionsView.title")}
              </h1>
              <p class="mt-1 text-sm text-zinc-500">
                {t("sessionsView.desc")}
              </p>
            </div>
          </div>
          <button
            class="border border-black/10 px-4 py-2 text-sm font-medium text-foreground hover:bg-zinc-100 flex items-center gap-2"
            onClick={() => sessionStore.openNewSessionModal()}
          >
            <FiPlus size={16} />
            {t("sessionsView.startNew")}
          </button>
        </header>

        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border border-black/10 p-2">
          <div class="flex items-center gap-1 overflow-x-auto">
            {(["all", "active", "local", "remote"] as const).map((f) => (
              <button
                class={`px-4 py-1.5 text-sm font-medium whitespace-nowrap ${
                  filter() === f
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-500 hover:text-foreground"
                }`}
                onClick={() => setFilter(f)}
              >
                {t(
                  `sessionsView.filter${f.charAt(0).toUpperCase()}${f.slice(1)}` as any,
                )}
              </button>
            ))}
          </div>

          <div class="relative max-w-xs w-full px-2 pb-2 sm:p-0">
            <FiSearch
              class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 sm:left-3"
              size={16}
            />
            <input
              type="text"
              placeholder={t("sessionsView.searchPlaceholder")}
              class="w-full border border-black/10 bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-zinc-400"
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
            />
          </div>
        </div>

        {/* Sessions List */}
        <div class="border border-black/10 overflow-hidden">
          <Show
            when={sessions().length > 0}
            fallback={
              <div class="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div class="mb-4 flex h-14 w-14 items-center justify-center border border-black/10 text-zinc-400">
                  <FiActivity size={28} />
                </div>
                <h3 class="text-base font-semibold text-foreground">
                  {t("sessionsView.noSessions")}
                </h3>
                <p class="mt-1 max-w-xs text-sm text-zinc-500">
                  {searchQuery() || filter() !== "all"
                    ? t("sessionsView.noSessionsDesc")
                    : t("home.noRecentSessionsDesc")}
                </p>
              </div>
            }
          >
            <div>
              <For each={sessions()}>
                {(session) => {
                  const isActive = activeSessionId() === session.sessionId;
                  return (
                    <div
                      class="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-black/10 last:border-b-0 cursor-pointer"
                      onClick={() => handleResumeSession(session.sessionId)}
                    >
                      <div class="flex items-start sm:items-center gap-4 min-w-0">
                        <div
                          class={`flex h-12 w-12 shrink-0 items-center justify-center border ${
                            isActive
                              ? "bg-zinc-900 text-white border-zinc-900"
                              : "bg-background text-zinc-400 border-black/10"
                          }`}
                        >
                          <Show
                            when={session.mode === "local"}
                            fallback={<FiServer size={20} />}
                          >
                            <FiHome size={20} />
                          </Show>
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-2">
                            <h3 class="truncate font-semibold text-base text-foreground">
                              {session.projectPath.split("/").pop() ||
                                t("common.unknownProject")}
                            </h3>
                            <Show when={session.active}>
                              <span
                                class="h-2 w-2 bg-green-500"
                                title={t("devices.active")}
                              />
                            </Show>
                          </div>
                          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-zinc-500">
                            <span class="inline-flex items-center gap-1.5 font-medium">
                              <span class="capitalize">
                                {session.agentType}
                              </span>
                            </span>
                            <span class="text-zinc-300">•</span>
                            <span class="truncate font-mono text-[11px] bg-background px-1.5 py-0.5 border border-black/10">
                              {session.mode === "local"
                                ? t("common.local")
                                : `${t("common.remote")}: ${session.hostname || session.controlSessionId?.slice(0, 8)}`}
                            </span>
                            <span class="text-zinc-300 hidden sm:inline">
                              •
                            </span>
                            <span class="hidden sm:inline">
                              {new Date(session.startedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div class="flex items-center gap-2 shrink-0 ml-16 sm:ml-0 mt-4 sm:mt-0">
                        <button
                          class={`border px-3 py-1.5 text-sm font-medium ${
                            isActive
                              ? "bg-zinc-900 text-white border-zinc-900"
                              : "border-black/10 hover:bg-zinc-100"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResumeSession(session.sessionId);
                          }}
                        >
                          {isActive
                            ? t("sessionsView.current")
                            : t("sessionsView.resume")}
                        </button>
                        <Show when={session.active}>
                          <button
                            class="border border-black/10 p-1.5 text-zinc-400 hover:text-red-500 hover:border-red-500"
                            onClick={(e) =>
                              handleDeleteSession(e, session.sessionId)
                            }
                            title={t("sidebar.closeSession")}
                          >
                            <FiX size={16} />
                          </button>
                        </Show>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};
