/**
 * AppLayout Component
 *
 * Main application layout integrating SessionSidebar and ChatView
 * for multi-session AI agent management.
 */

import { createSignal, Show, type Component } from "solid-js";
import { SessionSidebar } from "./SessionSidebar";
import { ChatView } from "./ChatView";
import { sessionStore, type AgentType } from "../stores/sessionStore";
import { notificationStore } from "../stores/notificationStore";

// ============================================================================
// Icons
// ============================================================================

const MenuIcon: Component = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

// ============================================================================
// Main Layout Component
// ============================================================================

export const AppLayout: Component = () => {
  const [sidebarOpen, setSidebarOpen] = createSignal(false);

  const activeSession = () => sessionStore.getActiveSession();

  const handleSendMessage = (message: string) => {
    const session = activeSession();
    if (!session) {
      notificationStore.error("No active session", "Error");
      return;
    }

    // TODO: Implement message sending via Tauri command
    console.log("Sending message to session", session.sessionId, message);
  };

  const handlePermissionResponse = (
    permissionId: string,
    response: "approved" | "denied" | "approved_for_session"
  ) => {
    console.log("Permission response:", permissionId, response);
    // TODO: Implement permission response via Tauri command
  };

  return (
    <div class="flex h-screen bg-base-200 overflow-hidden">
      {/* Mobile Menu Button */}
      <button
        class="lg:hidden fixed top-4 left-4 z-50 btn btn-circle btn-sm bg-base-100 shadow-md"
        onClick={() => setSidebarOpen(!sidebarOpen())}
      >
        <MenuIcon />
      </button>

      {/* Sidebar */}
      <SessionSidebar
        isOpen={sidebarOpen()}
        onToggle={() => setSidebarOpen(!sidebarOpen())}
      />

      {/* Main Content */}
      <main class="flex-1 flex flex-col min-w-0 lg:ml-0">
        <Show
          when={activeSession()}
          fallback={
            <div class="flex-1 flex items-center justify-center p-8">
              <div class="text-center max-w-md">
                <div class="text-6xl mb-4">💬</div>
                <h2 class="text-2xl font-bold mb-2">Welcome to RiTerm</h2>
                <p class="text-base-content/70 mb-6">
                  Manage multiple AI agent sessions in one place. Create a new session to get started.
                </p>
                <button
                  class="btn btn-primary"
                  onClick={() => setSidebarOpen(true)}
                >
                  Create Session
                </button>
              </div>
            </div>
          }
        >
          {(session) => {
            const s = session as unknown as { sessionId: string; agentType: AgentType };
            return (
              <ChatView
                sessionId={s.sessionId}
                agentType={s.agentType}
                onSendMessage={handleSendMessage}
                onPermissionResponse={handlePermissionResponse}
              />
            );
          }}
        </Show>
      </main>
    </div>
  );
};

export default AppLayout;
