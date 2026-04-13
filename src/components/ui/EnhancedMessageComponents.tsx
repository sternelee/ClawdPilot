/**
 * Enhanced Message Components v2
 *
 * Improved AI-native UI components with better display for:
 * - ToolCallItem: Enhanced tool call display with syntax highlighting
 * - ReasoningBlock: Beautiful thinking/reasoning display with streaming
 * - FileEditDiff: Unified diff view for file edits
 * - TerminalOutput: Terminal output with ANSI support
 */

import {
  type Component,
  type JSX,
  Show,
  createSignal,
  For,
  createMemo,
  createEffect,
} from "solid-js";
import { cn } from "~/lib/utils";
import type { ToolCall } from "~/stores/chatStore";
import {
  FiTool,
  FiCheck,
  FiX,
  FiChevronDown,
  FiChevronRight,
  FiCopy,
  FiCheckCircle,
  FiAlertCircle,
  FiLoader,
  FiTerminal,
  FiFile,
  FiEdit3,
  FiMinus,
  FiPlus,
  FiMaximize2,
  FiMinimize2,
  FiPlay,
  FiClock,
} from "solid-icons/fi";

// ============================================================================
// Utility Functions
// ============================================================================

const normalizeMultiline = (text: string) =>
  text.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");

const truncateMiddle = (str: string, maxLen: number) => {
  if (str.length <= maxLen) return str;
  const half = Math.floor((maxLen - 3) / 2);
  return `${str.slice(0, half)}...${str.slice(-half)}`;
};

// ============================================================================
// Tool Call Component (Enhanced)
// ============================================================================

export interface ToolCallItemProps {
  toolCall: ToolCall;
  expanded?: boolean;
  class?: string;
}

const statusConfig = {
  started: {
    icon: FiLoader,
    label: "Started",
    iconClass: "text-blue-500",
    badgeClass:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
    animate: true,
    spinnerClass: "animate-spin",
  },
  in_progress: {
    icon: FiPlay,
    label: "Running",
    iconClass: "text-amber-500",
    badgeClass:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    animate: true,
    spinnerClass: "animate-pulse",
  },
  completed: {
    icon: FiCheckCircle,
    label: "Completed",
    iconClass: "text-emerald-500",
    badgeClass:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    animate: false,
    spinnerClass: "",
  },
  failed: {
    icon: FiAlertCircle,
    label: "Failed",
    iconClass: "text-red-500",
    badgeClass:
      "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
    animate: false,
    spinnerClass: "",
  },
  cancelled: {
    icon: FiX,
    label: "Cancelled",
    iconClass: "text-gray-400",
    badgeClass: "bg-gray-500/10 text-gray-500 border border-gray-500/20",
    animate: false,
    spinnerClass: "",
  },
};

const formatTimestamp = (ts: number) => {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const detectOutputType = (
  output: string,
): "json" | "error" | "success" | "plain" => {
  const trimmed = output.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
  if (
    trimmed.toLowerCase().includes("error") ||
    trimmed.toLowerCase().includes("failed")
  )
    return "error";
  if (
    trimmed.toLowerCase().includes("success") ||
    trimmed.toLowerCase().includes("done")
  )
    return "success";
  return "plain";
};

const SyntaxHighlightedOutput: Component<{ output: string }> = (props) => {
  const outputType = createMemo(() => detectOutputType(props.output));
  const [copied, setCopied] = createSignal(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(props.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple JSON syntax highlighting
  const highlightedOutput = createMemo(() => {
    const output = normalizeMultiline(props.output);
    const type = outputType();

    if (type === "json") {
      try {
        const formatted = JSON.stringify(JSON.parse(output), null, 2);
        return formatted
          .replace(/(".*?")\s*:/g, '<span class="text-blue-400">$1</span>:')
          .replace(/:\s*(".*?")/g, ': <span class="text-emerald-400">$1</span>')
          .replace(
            /:\s*(true|false)/g,
            ': <span class="text-amber-400">$1</span>',
          )
          .replace(/:\s*(\d+)/g, ': <span class="text-violet-400">$1</span>');
      } catch {
        return output;
      }
    }

    return output
      .replace(
        /\b(error|failed|failure)\b/gi,
        '<span class="text-red-400 font-medium">$1</span>',
      )
      .replace(
        /\b(success|completed|done|ok)\b/gi,
        '<span class="text-emerald-400 font-medium">$1</span>',
      )
      .replace(
        /\b(warning|warn)\b/gi,
        '<span class="text-amber-400 font-medium">$1</span>',
      );
  });

  return (
    <div class="relative group">
      <pre
        class={cn(
          "text-xs font-mono p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-64 rounded-lg",
          outputType() === "error" && "bg-red-500/5 border border-red-500/20",
          outputType() === "success" &&
            "bg-emerald-500/5 border border-emerald-500/20",
          outputType() === "plain" && "bg-muted/50",
          outputType() === "json" && "bg-blue-500/5 border border-blue-500/20",
        )}
        innerHTML={highlightedOutput()}
      />
      <button
        type="button"
        onClick={handleCopy}
        class="absolute top-2 right-2 p-1.5 bg-background/80 hover:bg-background rounded-md opacity-0 group-hover:opacity-100 transition-opacity border border-border/50"
        title="Copy output"
      >
        <Show when={copied()} fallback={<FiCopy size={12} />}>
          <FiCheck size={12} class="text-emerald-500" />
        </Show>
      </button>
    </div>
  );
};

export const ToolCallItem: Component<ToolCallItemProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(props.expanded ?? true);
  const config = createMemo(
    () => statusConfig[props.toolCall.status] || statusConfig.started,
  );
  const StatusIcon = config().icon;
  const hasOutput = () => !!props.toolCall.output;

  // Auto-collapse completed tools with short output
  createEffect(() => {
    if (props.toolCall.status === "completed" && hasOutput()) {
      const output = normalizeMultiline(props.toolCall.output || "");
      if (output.length < 200) {
        setIsExpanded(false);
      }
    }
  });

  return (
    <div
      class={cn(
        "rounded-xl border overflow-hidden transition-all duration-200",
        props.toolCall.status === "in_progress" &&
          "border-amber-500/30 bg-amber-500/5",
        props.toolCall.status === "failed" && "border-red-500/30 bg-red-500/5",
        props.toolCall.status === "completed" && "border-border bg-muted/20",
        props.toolCall.status === "started" &&
          "border-blue-500/30 bg-blue-500/5",
        props.class,
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded())}
        class="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        {/* Animated Status Icon */}
        <div class={cn("shrink-0", config().iconClass)}>
          <StatusIcon size={16} class={config().spinnerClass} />
        </div>

        {/* Tool Icon & Name */}
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <div class="p-1.5 rounded-lg bg-background/80 border border-border/50">
            <FiTool size={14} class="text-muted-foreground" />
          </div>
          <div class="min-w-0">
            <span class="font-semibold text-sm truncate block">
              {props.toolCall.toolName}
            </span>
            <Show when={hasOutput()}>
              <span class="text-[10px] text-muted-foreground truncate">
                {truncateMiddle(
                  normalizeMultiline(props.toolCall.output || ""),
                  50,
                )}
              </span>
            </Show>
          </div>
        </div>

        {/* Status Badge */}
        <span
          class={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1.5",
            config().badgeClass,
          )}
        >
          <StatusIcon size={10} class={config().spinnerClass} />
          {config().label}
        </span>

        {/* Expand/Collapse */}
        <Show when={hasOutput()}>
          <div class="shrink-0 text-muted-foreground">
            <Show when={isExpanded()} fallback={<FiChevronRight size={16} />}>
              <FiChevronDown size={16} />
            </Show>
          </div>
        </Show>
      </button>

      {/* Collapsible Output */}
      <Show when={isExpanded() && hasOutput()}>
        <div class="border-t border-border/50">
          <div class="px-4 py-2 bg-muted/20 border-b border-border/50 flex items-center justify-between">
            <div class="flex items-center gap-2 text-[11px] text-muted-foreground">
              <FiTerminal size={12} />
              <span class="font-medium uppercase tracking-wide">Output</span>
              <span class="text-[10px] opacity-60">
                {normalizeMultiline(props.toolCall.output || "").length} chars
              </span>
            </div>
            <div class="flex items-center gap-1 text-[10px] text-muted-foreground">
              <FiClock size={10} />
              {formatTimestamp(props.toolCall.timestamp)}
            </div>
          </div>
          <div class="p-3">
            <SyntaxHighlightedOutput output={props.toolCall.output || ""} />
          </div>
        </div>
      </Show>
    </div>
  );
};

// ============================================================================
// Tool Call List Component
// ============================================================================

export interface ToolCallListProps {
  toolCalls: ToolCall[];
  class?: string;
}

export const ToolCallList: Component<ToolCallListProps> = (props) => {
  const inProgressCount = createMemo(
    () => props.toolCalls.filter((tc) => tc.status === "in_progress").length,
  );
  const completedCount = createMemo(
    () => props.toolCalls.filter((tc) => tc.status === "completed").length,
  );

  return (
    <div class={cn("flex flex-col gap-2", props.class)}>
      {/* Summary header */}
      <Show when={props.toolCalls.length > 1}>
        <div class="flex items-center gap-2 text-[11px] text-muted-foreground px-1">
          <span class="font-medium">{props.toolCalls.length} tools used</span>
          <Show when={completedCount() > 0}>
            <span class="text-emerald-600 dark:text-emerald-400">
              · {completedCount()} completed
            </span>
          </Show>
          <Show when={inProgressCount() > 0}>
            <span class="text-amber-600 dark:text-amber-400 animate-pulse">
              · {inProgressCount()} running
            </span>
          </Show>
        </div>
      </Show>

      <For each={props.toolCalls}>
        {(toolCall) => <ToolCallItem toolCall={toolCall} />}
      </For>
    </div>
  );
};

// ============================================================================
// Reasoning Block Component (Enhanced)
// ============================================================================

export interface ReasoningBlockProps {
  thinking?: string;
  isStreaming?: boolean;
  class?: string;
}

// Parse thinking into logical steps
const parseThinkingSteps = (
  thinking: string,
): { step: string; indent: number }[] => {
  const lines = normalizeMultiline(thinking).split("\n");
  return lines
    .filter((line) => line.trim())
    .map((line) => {
      const match = line.match(/^(→|▸|✓|✗|\*|\-\s*)?(.*)/);
      const prefix = match?.[1] || "";
      const content = match?.[2] || line;
      const indent = Math.floor(prefix.length / 2);
      return { step: content, indent };
    });
};

const ThinkingCursor: Component = () => (
  <span class="inline-flex ml-1">
    <span class="animate-pulse inline-block h-4 w-0.5 bg-blue-400" />
  </span>
);

export const ReasoningBlock: Component<ReasoningBlockProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(true);
  // autoScroll for future use
  createSignal(true);

  const steps = createMemo(() =>
    props.thinking ? parseThinkingSteps(props.thinking) : [],
  );

  const stepCount = createMemo(() => steps().length);

  return (
    <Show when={props.thinking}>
      <div
        class={cn(
          "rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-purple-500/5 overflow-hidden",
          props.class,
        )}
      >
        {/* Header */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded())}
          class="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
        >
          {/* Animated Brain Icon */}
          <div class="relative">
            <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center">
              <span class="text-sm">🧠</span>
            </div>
            <Show when={props.isStreaming}>
              <div class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
              <div class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-500" />
            </Show>
          </div>

          <div class="flex-1 text-left">
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center rounded-lg bg-blue-500/15 px-2.5 py-1 text-sm font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Thinking
              </span>
              <Show when={stepCount() > 1}>
                <span class="text-[11px] text-muted-foreground">
                  {stepCount()} steps
                </span>
              </Show>
            </div>
            <Show when={props.isStreaming}>
              <span class="text-[11px] text-muted-foreground/60 mt-0.5 block">
                Reasoning in progress...
              </span>
            </Show>
          </div>

          {/* Streaming Indicator */}
          <Show when={props.isStreaming}>
            <div class="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
              <div
                class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"
                style={{ "animation-delay": "0ms" }}
              />
              <div
                class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"
                style={{ "animation-delay": "150ms" }}
              />
              <div
                class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"
                style={{ "animation-delay": "300ms" }}
              />
            </div>
          </Show>

          {/* Expand/Collapse */}
          <div class="text-muted-foreground">
            <Show when={isExpanded()} fallback={<FiChevronRight size={18} />}>
              <FiChevronDown size={18} />
            </Show>
          </div>
        </button>

        {/* Content */}
        <Show when={isExpanded()}>
          <div class="border-t border-blue-500/10">
            <div class="p-4 space-y-1 max-h-96 overflow-y-auto">
              <For each={steps()}>
                {(item, index) => (
                  <div
                    class={cn(
                      "flex items-start gap-3 py-1 px-2 rounded-lg transition-colors hover:bg-muted/30",
                      item.indent > 0 && "ml-4",
                    )}
                  >
                    {/* Step indicator */}
                    <div class="shrink-0 w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mt-0.5">
                      <span class="text-[10px] font-medium text-blue-500">
                        {index() + 1}
                      </span>
                    </div>

                    {/* Step content */}
                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {item.step}
                        <Show
                          when={
                            props.isStreaming && index() === stepCount() - 1
                          }
                        >
                          <ThinkingCursor />
                        </Show>
                      </p>
                    </div>
                  </div>
                )}
              </For>

              {/* Fallback for unparsed content */}
              <Show when={steps().length === 0 && props.thinking}>
                <pre class="text-sm font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {normalizeMultiline(props.thinking || "")}
                  <Show when={props.isStreaming}>
                    <ThinkingCursor />
                  </Show>
                </pre>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
};

// ============================================================================
// File Edit Diff Component (New)
// ============================================================================

export interface FileEditDiffProps {
  path: string;
  oldText: string;
  newText: string;
  onAccept?: () => void;
  onReject?: () => void;
  class?: string;
}

const LineNumber: Component<{
  num: number;
  type?: "added" | "removed" | "unchanged";
}> = (props) => (
  <span
    class={cn(
      "inline-block w-10 text-right pr-3 select-none text-[11px] font-mono",
      props.type === "added" && "text-emerald-500/60 bg-emerald-500/5",
      props.type === "removed" && "text-red-500/60 bg-red-500/5",
      props.type === "unchanged" && "text-muted-foreground/40",
    )}
  >
    {props.num}
  </span>
);

export const FileEditDiff: Component<FileEditDiffProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(true);
  const [viewMode, setViewMode] = createSignal<"unified" | "split">("unified");

  const diffLines = createMemo(() => {
    const oldLines = props.oldText.split("\n");
    const newLines = props.newText.split("\n");
    const lines: {
      type: "added" | "removed" | "unchanged";
      content: string;
    }[] = [];

    // Compute LCS-based diff for better display
    let oldIdx = 0;
    let newIdx = 0;

    // Simple heuristic diff
    while (oldIdx < oldLines.length || newIdx < newLines.length) {
      const oldLine = oldLines[oldIdx];
      const newLine = newLines[newIdx];

      if (oldLine === newLine) {
        lines.push({ type: "unchanged", content: oldLine || "" });
        oldIdx++;
        newIdx++;
      } else if (oldLine !== undefined && newLine !== undefined) {
        lines.push({ type: "removed", content: oldLine });
        lines.push({ type: "added", content: newLine });
        oldIdx++;
        newIdx++;
      } else if (oldLine === undefined) {
        lines.push({ type: "added", content: newLine });
        newIdx++;
      } else {
        lines.push({ type: "removed", content: oldLine });
        oldIdx++;
      }
    }

    return lines;
  });

  const stats = createMemo(() => {
    const added = diffLines().filter((l) => l.type === "added").length;
    const removed = diffLines().filter((l) => l.type === "removed").length;
    return { added, removed };
  });

  const fileName = createMemo(() => {
    const parts = props.path.split("/");
    return parts[parts.length - 1];
  });

  const fileDir = createMemo(() => {
    const parts = props.path.split("/");
    parts.pop();
    return parts.join("/") || ".";
  });

  return (
    <div
      class={cn(
        "rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 overflow-hidden",
        props.class,
      )}
    >
      {/* Header */}
      <div class="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b border-border/50">
        {/* File Icon */}
        <div class="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <FiEdit3 size={16} class="text-amber-600 dark:text-amber-400" />
        </div>

        {/* File Path */}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <FiFile size={12} class="text-muted-foreground shrink-0" />
            <span class="font-semibold text-sm truncate">{fileName()}</span>
          </div>
          <Show when={fileDir() !== "."}>
            <span class="text-[11px] text-muted-foreground truncate block">
              {fileDir()}
            </span>
          </Show>
        </div>

        {/* Stats */}
        <div class="flex items-center gap-3 text-[11px]">
          <span class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <FiPlus size={12} />
            {stats().added}
          </span>
          <span class="flex items-center gap-1 text-red-600 dark:text-red-400">
            <FiMinus size={12} />
            {stats().removed}
          </span>
        </div>

        {/* Actions */}
        <div class="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode("unified")}
            class={cn(
              "px-2 py-1 rounded text-[11px] font-medium transition-colors",
              viewMode() === "unified"
                ? "bg-primary text-primary-contrast"
                : "hover:bg-muted",
            )}
          >
            Unified
          </button>
          <button
            type="button"
            onClick={() => setViewMode("split")}
            class={cn(
              "px-2 py-1 rounded text-[11px] font-medium transition-colors",
              viewMode() === "split"
                ? "bg-primary text-primary-contrast"
                : "hover:bg-muted",
            )}
          >
            Split
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded())}
            class="p-1.5 hover:bg-muted rounded transition-colors"
          >
            <Show when={isExpanded()} fallback={<FiMaximize2 size={14} />}>
              <FiMinimize2 size={14} />
            </Show>
          </button>
        </div>
      </div>

      {/* Diff Content */}
      <Show when={isExpanded()}>
        <div class="border-t border-border/50">
          {/* Diff View */}
          <div class="overflow-x-auto">
            <Show
              when={viewMode() === "unified"}
              fallback={
                // Split view placeholder
                <div class="flex">
                  <div class="flex-1 border-r border-border/50">
                    <div class="px-3 py-1.5 bg-red-500/10 border-b border-border/50 text-[11px] font-medium text-red-600 dark:text-red-400">
                      - Old
                    </div>
                    <For each={diffLines().filter((l) => l.type !== "added")}>
                      {(line) => (
                        <div
                          class={cn(
                            "flex font-mono text-xs",
                            line.type === "removed" && "bg-red-500/10",
                          )}
                        >
                          <LineNumber num={0} type={line.type} />
                          <span
                            class={cn(
                              "flex-1 px-2 py-0.5 whitespace-pre",
                              line.type === "removed" &&
                                "text-red-600 dark:text-red-400",
                            )}
                          >
                            {line.type === "removed" ? "- " : "  "}
                            {line.content}
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                  <div class="flex-1">
                    <div class="px-3 py-1.5 bg-emerald-500/10 border-b border-border/50 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      + New
                    </div>
                    <For each={diffLines().filter((l) => l.type !== "removed")}>
                      {(line) => (
                        <div
                          class={cn(
                            "flex font-mono text-xs",
                            line.type === "added" && "bg-emerald-500/10",
                          )}
                        >
                          <LineNumber num={0} type={line.type} />
                          <span
                            class={cn(
                              "flex-1 px-2 py-0.5 whitespace-pre",
                              line.type === "added" &&
                                "text-emerald-600 dark:text-emerald-400",
                            )}
                          >
                            {line.type === "added" ? "+ " : "  "}
                            {line.content}
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              }
            >
              {/* Unified View */}
              <div class="font-mono text-xs">
                <For each={diffLines()}>
                  {(line, index) => (
                    <div
                      class={cn(
                        "flex",
                        line.type === "added" && "bg-emerald-500/10",
                        line.type === "removed" && "bg-red-500/10",
                      )}
                    >
                      <LineNumber num={index() + 1} type={line.type} />
                      <span
                        class={cn(
                          "flex-1 px-2 py-0.5 whitespace-pre",
                          line.type === "added" &&
                            "text-emerald-600 dark:text-emerald-400",
                          line.type === "removed" &&
                            "text-red-600 dark:text-red-400",
                        )}
                      >
                        {line.type === "added"
                          ? "+ "
                          : line.type === "removed"
                            ? "- "
                            : "  "}
                        {line.content}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* Action Buttons */}
          <Show when={props.onAccept || props.onReject}>
            <div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-border/50 bg-muted/20">
              <button
                type="button"
                onClick={props.onReject}
                class="px-4 py-2 rounded-lg text-sm font-medium border border-red-500/30 text-red-600 hover:bg-red-500/10 transition-colors flex items-center gap-2"
              >
                <FiX size={14} />
                Reject
              </button>
              <button
                type="button"
                onClick={props.onAccept}
                class="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors flex items-center gap-2"
              >
                <FiCheck size={14} />
                Accept
              </button>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

// ============================================================================
// Terminal Output Component (Enhanced)
// ============================================================================

export interface TerminalOutputProps {
  output: string;
  command?: string;
  exitCode?: number;
  isStreaming?: boolean;
  class?: string;
}

export const TerminalOutput: Component<TerminalOutputProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(true);
  const [copied, setCopied] = createSignal(false);

  const normalizeOutput = () => normalizeMultiline(props.output || "");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(normalizeOutput());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusConfig = createMemo(() => {
    if (props.exitCode === 0) {
      return {
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/30",
        text: "text-emerald-600 dark:text-emerald-400",
        label: "Success",
      };
    }
    if (props.exitCode !== undefined) {
      return {
        bg: "bg-red-500/10",
        border: "border-red-500/30",
        text: "text-red-600 dark:text-red-400",
        label: "Failed",
      };
    }
    return {
      bg: "bg-muted",
      border: "border-border",
      text: "text-muted-foreground",
      label: "Output",
    };
  });

  return (
    <div
      class={cn(
        "rounded-xl border overflow-hidden",
        statusConfig().bg,
        statusConfig().border,
        props.class,
      )}
    >
      {/* Header */}
      <div
        class={cn(
          "flex items-center gap-3 px-4 py-2.5 border-b border-border/50",
          statusConfig().bg,
        )}
      >
        <div class="flex items-center gap-2">
          <FiTerminal size={16} class="text-muted-foreground" />
          <span class="font-semibold text-sm truncate">
            {props.command || "Terminal"}
          </span>
        </div>

        <div class="flex-1" />

        {/* Exit Code Badge */}
        <Show when={props.exitCode !== undefined}>
          <span
            class={cn(
              "px-2 py-0.5 rounded text-[11px] font-mono font-bold",
              statusConfig().bg,
              statusConfig().text,
              "border",
              statusConfig().border,
            )}
          >
            {props.exitCode === 0 ? "✓" : "✗"} {props.exitCode}
          </span>
        </Show>

        {/* Streaming Indicator */}
        <Show when={props.isStreaming}>
          <div class="flex items-center gap-1">
            <div class="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            <span class="text-[10px] text-muted-foreground">streaming</span>
          </div>
        </Show>

        {/* Actions */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded())}
          class="p-1.5 hover:bg-muted rounded transition-colors"
        >
          <Show when={isExpanded()} fallback={<FiChevronRight size={14} />}>
            <FiChevronDown size={14} />
          </Show>
        </button>
        <button
          type="button"
          onClick={handleCopy}
          class="p-1.5 hover:bg-muted rounded transition-colors"
          title="Copy output"
        >
          <Show when={copied()} fallback={<FiCopy size={14} />}>
            <FiCheck size={14} class="text-emerald-500" />
          </Show>
        </button>
      </div>

      {/* Output */}
      <Show when={isExpanded()}>
        <pre class="p-4 text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-80">
          {normalizeOutput()}
          <Show when={props.isStreaming}>
            <span class="inline-block ml-1 animate-pulse">▊</span>
          </Show>
        </pre>
      </Show>
    </div>
  );
};

// ============================================================================
// Empty State Component
// ============================================================================

type IconComponent = Component<{ size?: number; class?: string }>;

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: IconComponent;
  action?: JSX.Element;
  class?: string;
}

export const EmptyState: Component<EmptyStateProps> = (props) => {
  return (
    <div
      class={cn(
        "flex flex-col items-center justify-center gap-3 p-8 text-center",
        props.class,
      )}
    >
      <Show when={props.icon}>
        <div class="text-muted-foreground/50">{props.icon!({ size: 48 })}</div>
      </Show>
      <Show when={props.title}>
        <h3 class="text-lg font-semibold">{props.title}</h3>
      </Show>
      <Show when={props.description}>
        <p class="text-sm text-muted-foreground max-w-sm">
          {props.description}
        </p>
      </Show>
      <Show when={props.action}>
        <div class="mt-2">{props.action}</div>
      </Show>
    </div>
  );
};

// ============================================================================
// Shimmer Loading Effect
// ============================================================================

export interface ShimmerProps {
  class?: string;
}

export const Shimmer: Component<ShimmerProps> = (props) => {
  return (
    <div
      class={cn(
        "animate-pulse bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:200%_100%]",
        props.class,
      )}
    />
  );
};

// ============================================================================
// Message Loading Skeleton
// ============================================================================

export const MessageSkeleton: Component<{ class?: string }> = (props) => {
  return (
    <div class={cn("flex flex-col gap-2", props.class)}>
      <div class="flex items-center gap-2">
        <Shimmer class="h-8 w-8 rounded-full" />
        <Shimmer class="h-3 w-20 rounded" />
      </div>
      <Shimmer class="h-20 w-full rounded-lg" />
    </div>
  );
};
