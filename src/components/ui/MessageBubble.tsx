/**
 * Message Bubble Components
 *
 * Dedicated components for rendering different message types:
 * - MessageBubble: Main container with role-based styling
 * - UserMessage: User's messages
 * - AssistantMessage: AI assistant messages with thinking support
 * - SystemMessage: System notifications and tool outputs
 */

import { type Component, For, Show, createMemo, createSignal } from "solid-js";
import { createClipboard } from "@solid-primitives/clipboard";
import { FiCopy, FiCheck, FiMoreVertical } from "solid-icons/fi";
import { SolidMarkdown } from "solid-markdown";
import type { ChatMessage, SystemCard, ToolCall } from "~/stores/chatStore";
import { isMobile } from "~/stores/deviceStore";
import { HapticFeedback } from "~/utils/mobile";
import {
  ToolCallList,
  ReasoningBlock,
  TerminalOutput,
} from "./EnhancedMessageComponents";

// ============================================================================
// Code Block with Copy Button (inspired by hapi)
// ============================================================================

interface CodeBlockProps {
  code: string;
  language?: string;
}

const CodeBlockWithCopy: Component<CodeBlockProps> = (props) => {
  const [copied, setCopied] = createSignal(false);
  const [, , write] = createClipboard();

  const handleCopy = () => {
    write(props.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div class="relative min-w-0 max-w-full">
      <button
        type="button"
        onClick={handleCopy}
        class="absolute right-1.5 top-1.5 rounded p-1 text-muted-foreground hover:bg-base-200 hover:text-foreground transition-colors z-10"
        title="Copy code"
      >
        <Show when={copied()} fallback={<FiCopy size={14} />}>
          <FiCheck size={14} class="text-success" />
        </Show>
      </button>
      <div class="min-w-0 w-full max-w-full overflow-x-auto overflow-y-hidden rounded-md bg-base-300">
        <pre class="m-0 w-max min-w-full p-2 pr-8 text-xs font-mono">
          <code class="block">{props.code}</code>
        </pre>
      </div>
    </div>
  );
};

// ============================================================================
// Types
// ============================================================================

export interface MessageBubbleProps {
  message: ChatMessage;
  class?: string;
  onQuote?: (content: string) => void;
  onResend?: (content: string) => void;
  onToggleFileBrowser?: () => void;
  onSyncTodoList?: (content: string) => void;
  onOpenFileLocation?: (path: string, line?: number) => void;
  onApplyEditReview?: (path: string, action: "accept" | "reject") => void;
  onTerminalAction?: (
    terminalId: string,
    action: "attach" | "stop" | "status",
  ) => void;
}

// ============================================================================
// User Message Component
// ============================================================================

const UserMessage: Component<{ content: string; timestamp?: number }> = (
  props,
) => {
  // hapi-style: user bubble aligned right with dark background
  const bubbleClass =
    "w-fit max-w-[92%] ml-auto rounded-xl bg-primary text-primary-content px-3.5 py-2.5 shadow-sm";

  return (
    <div class="flex flex-col gap-1.5 items-end group/bubble">
      {/* Message bubble - hapi style */}
      <div class={bubbleClass}>
        <div class="flex items-end gap-2">
          <div class="flex-1 min-w-0">
            <div class="prose prose-sm wrap-break-words text-[15px] sm:text-sm max-w-none leading-relaxed sm:leading-6 selectable prose-invert">
              <SolidMarkdown children={props.content} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Assistant Message Component
// ============================================================================

interface AssistantMessageProps {
  content: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
  timestamp?: number;
}

const AssistantMessage: Component<AssistantMessageProps> = (props) => {
  return (
    <div class="flex flex-col gap-1.5 items-start group/bubble">
      {/* Message bubble */}
      <div class="w-full max-w-[min(94vw,54rem)] rounded-xl border border-base-content/10 bg-base-200/50 px-4 py-3.5 shadow-sm">
        {/* Thinking/Reasoning */}
        <Show when={props.thinking}>
          <ReasoningBlock
            thinking={props.content}
            isStreaming={props.isStreaming}
          />
        </Show>

        {/* Content */}
        <div class="prose prose-sm wrap-break-words text-[15px] sm:text-sm max-w-none leading-relaxed sm:leading-6 selectable">
          <SolidMarkdown
            children={props.thinking ? undefined : props.content}
            components={{
              code({ inline, class: className, children, ...codeProps }) {
                const match = /language-(\w+)/.exec(className || "");
                const codeString = String(children).replace(/\n$/, "");
                if (inline || !match) {
                  return (
                    <code class={className} {...codeProps}>
                      {children}
                    </code>
                  );
                }
                // Use CodeBlock with copy button
                return (
                  <CodeBlockWithCopy code={codeString} language={match[1]} />
                );
              },
            }}
          />
        </div>

        {/* Tool Calls */}
        <Show when={props.toolCalls && props.toolCalls.length > 0}>
          <div class="mt-3.5 pt-3.5 border-t border-base-content/10">
            <ToolCallList toolCalls={props.toolCalls!} />
          </div>
        </Show>
      </div>
    </div>
  );
};

// ============================================================================
// System Message Component
// ============================================================================

interface SystemMessageProps {
  content: string;
  systemCard?: SystemCard;
  timestamp?: number;
  onQuote?: (content: string) => void;
  onToggleFileBrowser?: () => void;
  onSyncTodoList?: (content: string) => void;
  onOpenFileLocation?: (path: string, line?: number) => void;
  onApplyEditReview?: (path: string, action: "accept" | "reject") => void;
  onTerminalAction?: (
    terminalId: string,
    action: "attach" | "stop" | "status",
  ) => void;
}

const SystemMessage: Component<SystemMessageProps> = (props) => {
  return (
    <div class="flex flex-col gap-1.5 items-start opacity-90">
      {/* Message content */}
      <div class="w-full max-w-[min(94vw,54rem)] rounded-xl border border-base-content/10 bg-base-300/30 px-4 py-3">
        <SystemMessageContent
          content={props.content}
          systemCard={props.systemCard}
          onQuote={props.onQuote}
          onToggleFileBrowser={props.onToggleFileBrowser}
          onSyncTodoList={props.onSyncTodoList}
          onOpenFileLocation={props.onOpenFileLocation}
          onApplyEditReview={props.onApplyEditReview}
          onTerminalAction={props.onTerminalAction}
        />
      </div>
    </div>
  );
};

// ============================================================================
// System Message Content Parser
// ============================================================================

const SystemMessageContent: Component<{
  content: string;
  systemCard?: SystemCard;
  onQuote?: (content: string) => void;
  onToggleFileBrowser?: () => void;
  onSyncTodoList?: (content: string) => void;
  onOpenFileLocation?: (path: string, line?: number) => void;
  onApplyEditReview?: (path: string, action: "accept" | "reject") => void;
  onTerminalAction?: (
    terminalId: string,
    action: "attach" | "stop" | "status",
  ) => void;
}> = (props) => {
  const [todoStates, setTodoStates] = createSignal<Record<number, boolean>>({});
  const [showDiff, setShowDiff] = createSignal(false);
  const [, , write] = createClipboard();

  const copyText = async (text: string) => {
    try {
      await write(text);
    } catch {
      // ignore clipboard failures
    }
  };

  const renderSystemCard = () => {
    const card = props.systemCard;
    if (!card) return null;

    if (card.type === "following") {
      return (
        <div class="space-y-2.5">
          <div class="text-[10px] font-bold uppercase tracking-wider text-info">
            Following
          </div>
          <For each={card.locations}>
            {(loc) => (
              <div class="flex items-center gap-2 rounded-lg border border-base-content/10 bg-base-200 px-3 py-2.5">
                <button
                  type="button"
                  class="flex-1 text-left text-[13px] sm:text-sm font-mono hover:text-primary transition-colors"
                  onClick={() => {
                    if (props.onOpenFileLocation) {
                      props.onOpenFileLocation(loc.path, loc.line);
                    } else {
                      props.onQuote?.(`@${loc.path}${loc.line ? `:${loc.line}` : ""}`);
                    }
                  }}
                >
                  {loc.path}
                  <Show when={loc.line !== undefined}>
                    <span class="ml-1 opacity-50">:{loc.line}</span>
                  </Show>
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-xs h-8 min-h-8"
                  onClick={() =>
                    copyText(`${loc.path}${loc.line ? `:${loc.line}` : ""}`)
                  }
                >
                  Copy
                </button>
              </div>
            )}
          </For>
          <button
            type="button"
            class="btn btn-outline btn-sm w-full sm:w-auto"
            onClick={() => props.onToggleFileBrowser?.()}
          >
            Open File Panel
          </button>
        </div>
      );
    }

    if (card.type === "edit_review") {
      const diffText = `--- old\n+++ new\n-${card.oldText}\n+${card.newText}`;
      return (
        <div class="space-y-2.5">
          <div class="text-[10px] font-bold uppercase tracking-wider text-warning">
            Edit Review
          </div>
          <div class="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[13px] sm:text-sm font-mono break-all">
            {card.path}
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="btn btn-ghost btn-xs h-8 min-h-8"
              onClick={() => setShowDiff((v) => !v)}
            >
              {showDiff() ? "Hide Diff" : "Show Diff"}
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-xs h-8 min-h-8"
              onClick={() => copyText(diffText)}
            >
              Copy Diff
            </button>
            <Show when={props.onApplyEditReview}>
              <button
                type="button"
                class="btn btn-ghost btn-xs h-8 min-h-8"
                onClick={() => props.onApplyEditReview?.(card.path, "accept")}
              >
                Accept
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-xs h-8 min-h-8"
                onClick={() => props.onApplyEditReview?.(card.path, "reject")}
              >
                Reject
              </button>
            </Show>
          </div>
          <Show when={showDiff()}>
            <div class="min-w-0 w-full max-w-full overflow-x-auto overflow-y-hidden rounded-md bg-base-300">
              <pre class="m-0 w-max min-w-full p-2.5 text-[11px] sm:text-xs font-mono">
                <code class="block whitespace-pre-wrap break-all">{diffText}</code>
              </pre>
            </div>
          </Show>
        </div>
      );
    }

    if (card.type === "todo_list") {
      const syncTodoToAgent = () => {
        const current = todoStates();
        const lines = card.entries.map((entry, idx) => {
          const checked =
            current[idx] !== undefined
              ? current[idx]
              : entry.status === "completed";
          return `- [${checked ? "x" : " "}] ${entry.content}`;
        });
        props.onSyncTodoList?.(`TODO update:\n${lines.join("\n")}`);
      };

      return (
        <div class="space-y-2.5">
          <div class="text-[10px] font-bold uppercase tracking-wider text-success">
            TODO List
          </div>
          <div class="space-y-1">
            <For each={card.entries}>
              {(entry, index) => {
                const initialDone = entry.status === "completed";
                const checked = () =>
                  todoStates()[index()] !== undefined
                    ? todoStates()[index()]!
                    : initialDone;
                return (
                  <label class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-base-content/5 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-primary checkbox-sm sm:checkbox-xs"
                      checked={checked()}
                      onChange={(e) =>
                        setTodoStates((prev) => ({
                          ...prev,
                          [index()]: e.currentTarget.checked,
                        }))
                      }
                    />
                    <span
                      class={`text-[15px] sm:text-sm ${checked() ? "line-through opacity-50" : ""}`}
                    >
                      {entry.content}
                    </span>
                  </label>
                );
              }}
            </For>
          </div>
          <Show when={props.onSyncTodoList}>
            <button
              type="button"
              class="btn btn-outline btn-sm w-full sm:w-auto"
              onClick={syncTodoToAgent}
            >
              Sync to Agent
            </button>
          </Show>
        </div>
      );
    }

    if (card.type === "terminal") {
      return (
        <div class="space-y-2.5">
          <div class="text-[10px] font-bold uppercase tracking-wider text-primary">
            Terminal
          </div>
          <div class="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-[13px] sm:text-sm">
            <div class="font-mono break-all">{card.terminalId || "unknown"}</div>
            <div class="mt-1 opacity-60">
              {card.mode || "interactive/background"} {card.status ? `· ${card.status}` : ""}
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="btn btn-ghost btn-xs h-8 min-h-8"
              onClick={() => copyText(card.terminalId)}
            >
              Copy ID
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-xs h-8 min-h-8"
              onClick={() => props.onQuote?.(`terminal:${card.terminalId}`)}
            >
              Insert
            </button>
            <Show when={props.onTerminalAction}>
              <button
                type="button"
                class="btn btn-ghost btn-xs h-8 min-h-8"
                onClick={() => props.onTerminalAction?.(card.terminalId, "attach")}
              >
                Attach
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-xs h-8 min-h-8"
                onClick={() => props.onTerminalAction?.(card.terminalId, "status")}
              >
                Status
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-xs h-8 min-h-8 text-error"
                onClick={() => props.onTerminalAction?.(card.terminalId, "stop")}
              >
                Stop
              </button>
            </Show>
          </div>
        </div>
      );
    }

    return null;
  };

  // Check if it's a terminal output format
  const isTerminalOutput = () => {
    const content = props.content;
    return (
      content.includes("[Tool:") ||
      content.includes("Command completed:") ||
      content.includes("Command failed:") ||
      content.includes("Command output:")
    );
  };

  // Parse terminal output
  const parseTerminalOutput = () => {
    const content = props.content;

    // Tool started/completed/failed pattern
    const toolMatch = content.match(/\[Tool: (.+?)\](.*)/s);
    if (toolMatch) {
      const toolName = toolMatch[1];
      const rest = toolMatch[2].trim();
      return {
        type: "tool",
        toolName,
        output: rest,
      };
    }

    // Command patterns
    const cmdMatch = content.match(
      /(Command completed|Command failed|Command output): (.+)/s,
    );
    if (cmdMatch) {
      return {
        type: "command",
        status: cmdMatch[1].replace("Command ", "").toLowerCase(),
        command: cmdMatch[2],
      };
    }

    return null;
  };

  return (
    <Show
      when={props.systemCard}
      fallback={
        <Show
          when={isTerminalOutput()}
          fallback={
            <div class="prose prose-sm wrap-break-words text-[15px] sm:text-sm max-w-none leading-relaxed sm:leading-6 opacity-70 selectable">
              <SolidMarkdown children={props.content} />
            </div>
          }
        >
          <Show
            when={parseTerminalOutput()}
            fallback={
              <div class="prose prose-sm wrap-break-words text-[15px] sm:text-sm max-w-none leading-relaxed sm:leading-6 opacity-70 selectable">
                <SolidMarkdown children={props.content} />
              </div>
            }
          >
            {(parsed) => (
              <Show
                when={parsed().type === "tool"}
                fallback={
                  <TerminalOutput
                    output={parsed().command || ""}
                    exitCode={
                      parsed().status === "completed"
                        ? 0
                        : parsed().status === "failed"
                          ? 1
                          : undefined
                    }
                  />
                }
              >
                <div class="text-sm">
                  <span class="font-mono text-xs text-info">
                    [{parsed().toolName}]
                  </span>
                  <Show when={parsed().output}>
                    <pre class="mt-2 text-xs opacity-60 whitespace-pre-wrap break-all">
                      {parsed().output}
                    </pre>
                  </Show>
                </div>
              </Show>
            )}
          </Show>
        </Show>
      }
    >
      {renderSystemCard()}
    </Show>
  );
};


// ============================================================================
// Main Message Bubble Component
// ============================================================================

export const MessageBubble: Component<MessageBubbleProps> = (props) => {
  const message = () => props.message;
  const isUser = createMemo(() => message().role === "user");
  const isSystem = createMemo(() => message().role === "system");
  const [showActions, setShowActions] = createSignal(false);
  const firstCodeBlock = createMemo(() => {
    const match = message().content.match(/```(?:\w+)?\n([\s\S]*?)```/);
    return match?.[1]?.trim() || null;
  });

  const closeActions = () => setShowActions(false);
  const triggerHaptic = () => {
    if (isMobile()) {
      HapticFeedback.selection();
    }
  };

  const copyMessage = async () => {
    triggerHaptic();
    try {
      await navigator.clipboard.writeText(message().content);
    } catch {
      // ignore clipboard failures
    } finally {
      closeActions();
    }
  };

  const copyAsMarkdown = async () => {
    triggerHaptic();
    try {
      await navigator.clipboard.writeText(message().content);
    } catch {
      // ignore clipboard failures
    } finally {
      closeActions();
    }
  };

  const copyCodeBlock = async () => {
    const code = firstCodeBlock();
    if (!code) return;
    triggerHaptic();
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // ignore clipboard failures
    } finally {
      closeActions();
    }
  };

  const quoteMessage = () => {
    triggerHaptic();
    props.onQuote?.(message().content);
    closeActions();
  };

  const resendMessage = () => {
    triggerHaptic();
    props.onResend?.(message().content);
    closeActions();
  };

  return (
    <div class={props.class}>
      <Show
        when={isUser()}
        fallback={
          <Show
            when={isSystem()}
            fallback={
              <AssistantMessage
                content={message().content}
                thinking={message().thinking ? "Thinking..." : undefined}
                toolCalls={message().toolCalls}
                isStreaming={message().thinking}
                timestamp={message().timestamp}
              />
            }
          >
            <SystemMessage
              content={message().content}
              systemCard={message().systemCard}
              timestamp={message().timestamp}
              onQuote={props.onQuote}
              onToggleFileBrowser={props.onToggleFileBrowser}
              onSyncTodoList={props.onSyncTodoList}
              onOpenFileLocation={props.onOpenFileLocation}
              onApplyEditReview={props.onApplyEditReview}
              onTerminalAction={props.onTerminalAction}
            />
          </Show>
        }
      >
        <UserMessage
          content={message().content}
          timestamp={message().timestamp}
        />
      </Show>

      <Show when={isMobile()}>
        <div class={`mt-1 flex ${isUser() ? "justify-end" : "justify-start"}`}>
          <button
            type="button"
            class="btn btn-ghost btn-xs h-8 min-h-8 w-8 rounded-lg opacity-60 hover:opacity-100"
            onClick={() => {
              triggerHaptic();
              setShowActions(true);
            }}
            title="Message actions"
            aria-label="Message actions"
          >
            <FiMoreVertical size={14} />
          </button>
        </div>
      </Show>

      <Show when={showActions()}>
        <div class="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            class="absolute inset-0 bg-black/45"
            aria-label="Close message actions"
            onClick={closeActions}
          />
          <div class="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-border/60 bg-base-100 p-3 pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] shadow-2xl animate-slide-up">
            <div class="mb-2 px-1 text-xs text-muted-foreground/70">
              Message actions
            </div>
            <div class="flex flex-col gap-1">
              <Show when={isUser()}>
                <button
                  type="button"
                  class="btn btn-ghost justify-start h-11 min-h-11"
                  onClick={resendMessage}
                >
                  Resend
                </button>
              </Show>
              <button
                type="button"
                class="btn btn-ghost justify-start h-11 min-h-11"
                onClick={quoteMessage}
              >
                Quote to input
              </button>
              <Show when={!isUser() && firstCodeBlock()}>
                <button
                  type="button"
                  class="btn btn-ghost justify-start h-11 min-h-11"
                  onClick={copyCodeBlock}
                >
                  Copy code block
                </button>
              </Show>
              <Show when={isUser() && firstCodeBlock()}>
                <button
                  type="button"
                  class="btn btn-ghost justify-start h-11 min-h-11"
                  onClick={copyCodeBlock}
                >
                  Copy code block
                </button>
              </Show>
              <button
                type="button"
                class="btn btn-ghost justify-start h-11 min-h-11"
                onClick={copyMessage}
              >
                Copy
              </button>
              <button
                type="button"
                class="btn btn-ghost justify-start h-11 min-h-11"
                onClick={copyAsMarkdown}
              >
                Copy as Markdown
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

// ============================================================================
// Export additional components for reuse
// ============================================================================

export { UserMessage, AssistantMessage, SystemMessage };
