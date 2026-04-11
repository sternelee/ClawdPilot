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
  <div class="flex items-center gap-3 py-3 px-2">
    <div class="flex-1 h-px bg-base-content/10" />
    <span class="text-[10px] sm:text-xs font-medium text-base-content/50 px-2">{props.date}</span>
    <div class="flex-1 h-px bg-base-content/10" />
  </div>
);

interface ChatEmptyStateProps {
  agentType?: string;
}

const ChatEmptyState: Component<ChatEmptyStateProps> = (props) => (
  <div class="flex flex-col items-center justify-center min-h-[350px] sm:min-h-[450px] px-4 sm:px-6 text-center">
    <div class="relative mb-6 sm:mb-8">
      <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
        <FiMessageSquare size={32} class="text-primary sm:w-10 sm:h-10" />
      </div>
      <div class="absolute inset-0 rounded-2xl border-2 border-primary/20 scale-110 animate-ping" />
    </div>
    <h3 class="text-lg sm:text-xl font-bold mb-2 tracking-tight">Start a conversation</h3>
    <p class="text-sm sm:text-base text-base-content/60 max-w-xs sm:max-w-sm mb-6 sm:mb-8">
      Send a message to begin chatting with{" "}
      <span class="font-medium text-base-content/80">{props.agentType || "your AI agent"}</span>
    </p>
    <div class="flex flex-wrap gap-2 sm:gap-3 justify-center px-4">
      <button type="button" class="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-xl bg-base-200 hover:bg-base-300 border border-base-content/10 transition-colors">
        Help me code
      </button>
      <button type="button" class="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-xl bg-base-200 hover:bg-base-300 border border-base-content/10 transition-colors">
        Explain this
      </button>
      <button type="button" class="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-xl bg-base-200 hover:bg-base-300 border border-base-content/10 transition-colors">
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
      class="fixed bottom-24 sm:bottom-28 right-4 sm:right-6 z-30 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-base-100 border border-base-content/15 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 text-xs sm:text-sm font-medium"
    >
      <Show when={(props.unreadCount || 0) > 0}>
        <span class="bg-primary text-primary-content rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
          {props.unreadCount}
        </span>
      </Show>
      <FiChevronDown size={14} class="sm:w-4 sm:h-4" />
      <span class="hidden sm:inline">Scroll to bottom</span>
    </button>
  </Show>
);

const MessageBubbleContent: Component<{ message: ChatMessage }> = (props) => (
  <div class={cn(
    "rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5",
    props.message.role === "user" && "bg-primary text-primary-content",
    props.message.role === "assistant" && "bg-base-200",
    props.message.role === "system" && "bg-base-200/50 border border-base-content/10",
  )}>
    <div class="text-[13px] sm:text-[14px] leading-relaxed whitespace-pre-wrap break-words">
      {props.message.content}
    </div>
    <Show when={props.message.thinking}>
      <div class="mt-1 flex items-center gap-1 text-xs opacity-60">
        <span class="loading loading-dots loading-xs" />
        <span>Thinking...</span>
      </div>
    </Show>
  </div>
);

const MessageItem: Component<{ message: ChatMessage; index: number }> = (props) => (
  <div class={cn(
    "py-2 sm:py-3",
    props.message.role === "user" && "chat chat-end",
    props.message.role !== "user" && "chat chat-start",
  )}>
    <div class="chat-bubble bg-transparent p-0">
      <Show when={props.message.role !== "user"}>
        <div class="flex items-center gap-2 mb-1">
          <div class="w-6 h-6 rounded-full bg-base-300 flex items-center justify-center text-[10px] font-bold">
            {props.message.role === "assistant" ? "AI" : "SYS"}
          </div>
          <span class="text-[10px] font-medium text-base-content/40">
            {props.message.role === "assistant" ? "Assistant" : "System"}
          </span>
        </div>
      </Show>
      <MessageBubbleContent message={props.message} />
      <div class="text-[9px] sm:text-[10px] text-base-content/40 mt-1 px-1">
        {new Date(props.message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  </div>
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
        <div class="absolute inset-0 flex items-center justify-center bg-base-100/80 backdrop-blur-sm z-20">
          <div class="flex flex-col items-center gap-3">
            <span class="loading loading-spinner loading-lg text-primary" />
            <span class="text-xs font-medium text-base-content/60">Loading messages...</span>
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
          class="flex-1 overflow-y-auto px-3 sm:px-4 lg:px-6 py-2 sm:py-4"
        >
          <div class="max-w-3xl mx-auto">
            <For each={groupedMessages()}>
              {(group) => (
                <>
                  <DateSeparator date={group.label} />
                  <For each={group.messages}>
                    {(message, index) => <MessageItem message={message} index={index()} />}
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
