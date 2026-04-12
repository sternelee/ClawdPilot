/**
 * Message List View Component
 *
 * Clean, modern message list inspired by OpenChamber.
 * Groups messages by date with subtle separators.
 */

import {
  type Component,
  Show,
  For,
  createSignal,
  createMemo,
  createEffect,
} from "solid-js";
import { cn } from "~/lib/utils";
import type { ChatMessage } from "~/stores/chatStore";
import { FiChevronDown, FiMessageSquare } from "solid-icons/fi";

interface MessageListViewProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  isStreaming?: boolean;
  onQuote?: (content: string) => void;
  onResend?: (content: string) => void;
  onToggleFileBrowser?: () => void;
  onSyncTodoList?: (content: string) => void;
  onOpenFileLocation?: (path: string, line?: number) => void;
  onApplyEditReview?: (path: string, action: "accept" | "reject") => void;
  onTerminalAction?: (terminalId: string, action: "attach" | "stop" | "status") => void;
}

interface DateGroup {
  date: string;
  label: string;
  messages: ChatMessage[];
}

const formatDateLabel = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
};

const groupMessagesByDate = (messages: ChatMessage[]): DateGroup[] => {
  const groups: Record<string, ChatMessage[]> = {};
  for (const message of messages) {
    const timestamp = message.timestamp || Date.now();
    const date = new Date(timestamp);
    const dateKey = date.toDateString();
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(message);
  }
  return Object.entries(groups).map(([dateKey, msgs]) => ({
    date: dateKey,
    label: formatDateLabel(new Date(dateKey)),
    messages: msgs,
  }));
};

const DateSeparator: Component<{ date: string }> = (props) => (
  <div class="flex items-center gap-3 py-4">
    <div class="flex-1 h-px bg-border/50" />
    <span class="text-[11px] font-medium text-muted-foreground/60 px-2">{props.date}</span>
    <div class="flex-1 h-px bg-border/50" />
  </div>
);

interface ChatEmptyStateProps {
  agentType?: string;
}

const ChatEmptyState: Component<ChatEmptyStateProps> = (props) => (
  <div class="flex flex-col items-center justify-center min-h-[400px] px-4 sm:px-6 text-center">
    <div class="relative mb-6">
      <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
        <FiMessageSquare size={28} class="text-primary sm:w-8 sm:h-8" />
      </div>
      <div class="absolute inset-0 rounded-2xl border-2 border-primary/20 scale-110 animate-ping opacity-50" />
    </div>
    <h3 class="text-lg sm:text-xl font-semibold tracking-tight mb-2">Start a conversation</h3>
    <p class="text-sm text-muted-foreground max-w-xs mb-6">
      Send a message to begin chatting with{" "}
      <span class="font-medium text-foreground">{props.agentType || "your AI agent"}</span>
    </p>
    <div class="flex flex-wrap gap-2 justify-center px-4">
      <button type="button" class="px-4 py-2 text-sm rounded-xl bg-muted/50 hover:bg-muted border border-border transition-colors">
        Help me code
      </button>
      <button type="button" class="px-4 py-2 text-sm rounded-xl bg-muted/50 hover:bg-muted border border-border transition-colors">
        Explain this
      </button>
      <button type="button" class="px-4 py-2 text-sm rounded-xl bg-muted/50 hover:bg-muted border border-border transition-colors">
        Debug issue
      </button>
    </div>
  </div>
);

interface ScrollToBottomButtonProps {
  visible: boolean;
  onClick: () => void;
  unreadCount?: number;
}

const ScrollToBottomButton: Component<ScrollToBottomButtonProps> = (props) => (
  <Show when={props.visible}>
    <button
      type="button"
      onClick={props.onClick}
      class="fixed bottom-24 right-4 sm:right-6 z-30 flex items-center gap-2 px-3 py-2 bg-background border border-border/50 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 text-xs font-medium"
    >
      <Show when={(props.unreadCount || 0) > 0}>
        <span class="bg-primary text-primary-contrast rounded-full h-5 w-5 flex items-center justify-center text-[10px] font-bold">
          {props.unreadCount}
        </span>
      </Show>
      <FiChevronDown size={14} />
      <span class="hidden sm:inline">Latest</span>
    </button>
  </Show>
);

export const MessageListView: Component<MessageListViewProps> = (props) => {
  let scrollContainerRef: HTMLDivElement | undefined;
  const [isScrolledToBottom, setIsScrolledToBottom] = createSignal(true);
  const [showScrollButton, setShowScrollButton] = createSignal(false);
  const [lastScrollTop, setLastScrollTop] = createSignal(0);

  const groupedMessages = createMemo(() => groupMessagesByDate(props.messages));

  const handleScroll = () => {
    if (!scrollContainerRef) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef;
    const atBottom = scrollHeight - scrollTop - clientHeight < 80;
    const userScrolledUp = scrollTop < lastScrollTop() - 5;
    setIsScrolledToBottom(atBottom);
    setShowScrollButton(!atBottom && userScrolledUp);
    setLastScrollTop(scrollTop);
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (!scrollContainerRef) return;
    scrollContainerRef.scrollTo({ top: scrollContainerRef.scrollHeight, behavior });
    setShowScrollButton(false);
  };

  createEffect(() => {
    const msgCount = props.messages.length;
    if (msgCount > 0 && isScrolledToBottom()) {
      queueMicrotask(() => scrollToBottom());
    }
  });

  createEffect(() => {
    if (!props.isStreaming && isScrolledToBottom()) {
      queueMicrotask(() => scrollToBottom());
    }
  });

  return (
    <div class="relative flex-1 min-h-0 flex flex-col">
      <Show when={props.isLoading}>
        <div class="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-20">
          <div class="flex flex-col items-center gap-3">
            <span class="loading loading-spinner loading-lg text-primary" />
            <span class="text-xs font-medium text-muted-foreground">Loading messages...</span>
          </div>
        </div>
      </Show>

      <Show
        when={props.messages.length > 0}
        fallback={
          <Show when={!props.isLoading}>
            <ChatEmptyState />
          </Show>
        }
      >
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          class="flex-1 overflow-y-auto px-4 sm:px-6 py-4"
        >
          <div class="max-w-3xl mx-auto">
            <For each={groupedMessages()}>
              {(group) => (
                <>
                  <DateSeparator date={group.label} />
                  <For each={group.messages}>
                    {(message, index) => (
                      <div class="py-3">
                        {/* Simple message display - individual message components handle role-based styling */}
                        <div class={cn(
                          "text-sm leading-relaxed whitespace-pre-wrap break-words",
                          message.role === "user" && "text-right",
                        )}>
                          {message.content}
                        </div>
                      </div>
                    )}
                  </For>
                </>
              )}
            </For>
          </div>
        </div>
      </Show>

      <ScrollToBottomButton
        visible={showScrollButton()}
        onClick={() => scrollToBottom()}
      />
    </div>
  );
};

export { ChatEmptyState };
