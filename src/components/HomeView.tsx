/**
 * HomeView Component
 *
 * Zed-inspired: hard lines, high contrast, no gradients/shadows/animations.
 */

import { createMemo, For, type Component } from "solid-js";
import { FiServer, FiActivity } from "solid-icons/fi";
import { sessionStore } from "../stores/sessionStore";
import { navigationStore } from "../stores/navigationStore";
import { t } from "../stores/i18nStore";
import { cn } from "~/lib/utils";

export const HomeView: Component = () => {
  const sessions = createMemo(() => sessionStore.getSessions());

  const getRecentSessions = () => {
    return [...sessions()]
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 5);
  };

  const handleResumeSession = (sessionId: string) => {
    sessionStore.setActiveSession(sessionId);
    navigationStore.setActiveView("workspace");
  };

  return (
    <div class="flex h-full flex-col bg-background">
      <header class="flex items-center gap-4 px-6 py-5 border-b border-black/10">
        <button
          type="button"
          class="text-zinc-500 hover:text-foreground md:hidden"
          onClick={() => navigationStore.setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" />
          </svg>
        </button>
        <div>
          <h1 class="text-xl font-bold text-foreground">
            {t("home.welcomeTitle")}
          </h1>
          <p class="text-sm text-zinc-500">
            {t("home.welcomeDescription")}
          </p>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto p-6">
        <div class="max-w-2xl mx-auto space-y-8">
          {/* Quick Actions */}
          <section>
            <h2 class="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">
              {t("home.quickActions")}
            </h2>
            <div class="grid grid-cols-2 gap-2">
              <button
                class="flex items-center gap-3 p-4 border border-black/10 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
                onClick={() => sessionStore.openNewSessionModal()}
              >
                <span class="text-zinc-400">+</span>
                <div>
                  <div class="text-sm font-medium text-foreground">
                    {t("home.startNewSession")}
                  </div>
                  <div class="text-xs text-zinc-500">
                    {t("home.startNewSessionDesc")}
                  </div>
                </div>
              </button>
              <button
                class="flex items-center gap-3 p-4 border border-black/10 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
                onClick={() => navigationStore.setActiveView("devices")}
              >
                <FiServer size={16} class="text-zinc-400" />
                <div>
                  <div class="text-sm font-medium text-foreground">
                    {t("home.connectToHost")}
                  </div>
                  <div class="text-xs text-zinc-500">
                    {t("home.connectToHostDesc")}
                  </div>
                </div>
              </button>
            </div>
          </section>

          {/* Recent Sessions */}
          <section>
            <h2 class="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">
              {t("home.recentSessions")}
            </h2>
            <div class="border border-black/10">
              {getRecentSessions().length === 0 ? (
                <div class="py-12 text-center">
                  <FiActivity size={24} class="text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
                  <p class="text-sm text-zinc-500">{t("home.noRecentSessions")}</p>
                </div>
              ) : (
                <For each={getRecentSessions()}>
                  {(session) => (
                    <div class="flex items-center justify-between px-4 py-3 border-b border-black/5 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                      <div class="flex items-center gap-3 min-w-0">
                        <span
                          class={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            session.active ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-600",
                          )}
                        />
                        <div class="min-w-0">
                          <div class="text-sm font-medium text-foreground truncate">
                            {session.projectPath.split("/").pop() || t("common.unknownProject")}
                          </div>
                          <div class="text-xs text-zinc-500">
                            {session.agentType} &middot; {session.mode === "local" ? t("common.local") : t("common.remote")}
                          </div>
                        </div>
                      </div>
                      <button
                        class="text-xs text-zinc-500 hover:text-foreground px-2 py-1 border border-black/10"
                        onClick={() => handleResumeSession(session.sessionId)}
                      >
                        {t("home.resume")}
                      </button>
                    </div>
                  )}
                </For>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};