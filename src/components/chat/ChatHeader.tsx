/**
 * Chat Header Component
 *
 * Header for the chat view with session info and navigation.
 * Responsive design with mobile-first approach.
 */

import { type Component, Show, createMemo } from "solid-js";
import { FiTerminal, FiSettings } from "solid-icons/fi";
import { sessionStore } from "../../stores/sessionStore";
import { sessionEventRouter } from "../../stores/sessionEventRouter";
import { navigationStore } from "../../stores/navigationStore";
import { Button } from "../ui/primitives";
import { cn } from "~/lib/utils";

interface ChatHeaderProps {
  onToggleSidebar?: () => void;
  sessionId: string;
  agentType?: string;
  sessionMode?: "remote" | "local";
  projectPath?: string;
}

export const ChatHeader: Component<ChatHeaderProps> = (props) => {
  const session = createMemo(() => sessionStore.getSession(props.sessionId));

  const statusColor = createMemo(() => {
    const sess = session();
    if (!sess?.active) return "bg-base-300";
    const routerState = sessionEventRouter.getStreamingState(props.sessionId);
    if (routerState?.isStreaming) return "bg-info";
    return "bg-success";
  });

  const statusText = createMemo(() => {
    const sess = session();
    if (!sess?.active) return "Offline";
    const routerState = sessionEventRouter.getStreamingState(props.sessionId);
    if (routerState?.isStreaming) return "Streaming";
    return "Online";
  });

  return (
    <header class="compact-mobile-controls z-20 flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-base-content/10 bg-base-100/80 px-3 py-2 backdrop-blur-lg sm:min-h-16 sm:px-4 lg:px-6">
      {/* Left: Menu button (mobile) + Session info */}
      <div class="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {/* Hamburger menu - visible only on mobile */}
        <label
          for="drawer"
          aria-label="Open menu"
          class="btn btn-square btn-ghost drawer-button lg:hidden shrink-0"
        >
          <svg
            width="20"
            height="20"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="inline-block h-5 w-5 stroke-current"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </label>

        {/* Session info */}
        <Show when={props.agentType}>
          <div class="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Agent icon */}
            <div class="hidden sm:flex w-9 h-9 rounded-xl bg-primary/10 items-center justify-center shrink-0">
              <FiTerminal size={18} class="text-primary" />
            </div>

            {/* Session details */}
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-mono text-sm font-medium truncate max-w-[120px] sm:max-w-[200px]">
                  {props.agentType?.charAt(0).toUpperCase() + (props.agentType?.slice(1) || "")}
                </span>
                {/* Status indicator */}
                <span
                  class={cn(
                    "shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                    statusText() === "Online" && "bg-success/15 text-success",
                    statusText() === "Streaming" && "bg-info/15 text-info",
                    statusText() === "Offline" && "bg-base-300 text-base-content/50",
                  )}
                >
                  <span class={cn("w-1.5 h-1.5 rounded-full", statusColor())} />
                  <span class="hidden xs:inline">{statusText()}</span>
                </span>
              </div>
              <Show when={props.projectPath}>
                <span class="text-[10px] opacity-50 font-mono truncate block max-w-[150px] sm:max-w-[250px]">
                  {props.projectPath?.split("/").pop()}
                </span>
              </Show>
            </div>
          </div>
        </Show>
      </div>

      {/* Right: Action buttons */}
      <div class="flex items-center gap-1 sm:gap-2">
        <Button
          variant="ghost"
          size="icon"
          class="rounded-lg sm:rounded-xl"
          onClick={() => navigationStore.setActiveView("settings")}
        >
          <FiSettings size={18} />
        </Button>
      </div>
    </header>
  );
};
