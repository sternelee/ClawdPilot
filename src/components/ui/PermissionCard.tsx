/**
 * Permission Card Component
 *
 * Features:
 * - Better visual hierarchy with icons
 * - Keyboard shortcuts (y to allow, n to deny)
 * - Syntax highlighting for parameters
 * - "Remember this choice" checkbox
 * - Subtle glow animation for pending state
 * - Better mobile responsiveness
 * - Estimated danger level indicator
 */

import { createMemo, Show, type Component, onMount, onCleanup } from "solid-js";
import { cn } from "~/lib/utils";
import { Card, CardContent, CardHeader, Switch, Spinner } from "./primitives";
import { Button } from "./primitives";
import {
  FiShield,
  FiCheck,
  FiX,
  FiLoader,
  FiAlertTriangle,
  FiAlertCircle,
  FiEdit,
  FiFile,
  FiTerminal,
  FiGlobe,
  FiLock,
} from "solid-icons/fi";
import { SolidMarkdown } from "solid-markdown";

// Types matching Rust backend
type PermissionMode = "AlwaysAsk" | "AcceptEdits" | "AutoApprove" | "Plan";

type ApprovalDecision = "Approved" | "ApprovedForSession" | "Abort";

interface PendingPermission {
  request_id: string;
  session_id: string;
  tool_name: string;
  tool_params: unknown;
  message?: string;
  created_at: number;
  response_tx?: unknown;
}

interface PermissionCardProps {
  permission: PendingPermission;
  disabled: boolean;
  loading?: boolean;
  permissionMode: PermissionMode;
  onApprove: (decision?: ApprovalDecision) => void;
  onDeny: (reason?: string) => void;
}

// ============================================================================
// Tool Icons & Danger Level
// ============================================================================

const toolIcons: Record<string, typeof FiFile> = {
  Edit: FiEdit,
  MultiEdit: FiEdit,
  Write: FiFile,
  Read: FiFile,
  NotebookEdit: FiEdit,
  Bash: FiTerminal,
  Terminal: FiTerminal,
  WebFetch: FiGlobe,
  WebSearch: FiGlobe,
  default: FiShield,
};

const toolDangerLevels: Record<string, { level: "low" | "medium" | "high"; label: string }> = {
  Read: { level: "low", label: "Read-only operation" },
  WebFetch: { level: "low", label: "Network access" },
  WebSearch: { level: "medium", label: "External search" },
  Bash: { level: "high", label: "Shell execution" },
  Terminal: { level: "high", label: "Terminal command" },
  Edit: { level: "medium", label: "File modification" },
  MultiEdit: { level: "medium", label: "Multiple edits" },
  Write: { level: "medium", label: "File creation" },
  default: { level: "medium", label: "Tool execution" },
};

const dangerColors = {
  low: {
    bg: "bg-success/10",
    border: "border-success/30",
    text: "text-success",
    label: "Low Risk",
  },
  medium: {
    bg: "bg-warning/10",
    border: "border-warning/30",
    text: "text-warning",
    label: "Medium Risk",
  },
  high: {
    bg: "bg-error/10",
    border: "border-error/30",
    text: "text-error",
    label: "High Risk",
  },
};

// ============================================================================
// Syntax Highlighted Code Block
// ============================================================================

const SyntaxHighlightedCode: Component<{ code: string; maxLines?: number }> = (props) => {
  // Simple JSON syntax highlighting
  const highlight = (code: string) => {
    try {
      const parsed = JSON.parse(code);
      const formatted = JSON.stringify(parsed, null, 2);
      
      // Apply syntax highlighting
      return formatted
        .replace(/"([^"]+)":/g, '<span class="text-secondary font-semibold">"$1"</span>:')
        .replace(/: "([^"]+)"/g, ': <span class="text-primary">"$1"</span>')
        .replace(/: (\d+)/g, ': <span class="text-accent">$1</span>')
        .replace(/: (true|false)/g, ': <span class="text-warning">$1</span>')
        .replace(/: (null)/g, ': <span class="text-muted-foreground">$1</span>');
    } catch {
      // If not JSON, escape HTML and return
      return code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
  };

  const lines = props.code.split("\n");
  const maxLines = props.maxLines ?? 8;
  const truncated = lines.length > maxLines;
  const displayLines = truncated ? lines.slice(0, maxLines) : lines;
  const displayCode = displayLines.join("\n");

  return (
    <div class="relative">
      <pre
        class={cn(
          "overflow-x-auto rounded-lg bg-base-200/50 p-3",
          "text-xs font-mono leading-relaxed",
          "border border-base-content/5"
        )}
        innerHTML={highlight(displayCode)}
      />
      <Show when={truncated}>
        <div class="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-base-200/80 to-transparent pointer-events-none rounded-b-lg" />
        <div class="absolute bottom-1 left-3 text-[10px] text-base-content/40">
          +{lines.length - maxLines} more lines
        </div>
      </Show>
    </div>
  );
};

// ============================================================================
// Permission Card Component
// ============================================================================

function PermissionCard(props: PermissionCardProps) {
  const { permission, disabled, loading, permissionMode, onApprove, onDeny } = props;
  const [rememberChoice, setRememberChoice] = createSignal(false);

  // Get tool-specific info
  const toolIcon = createMemo(() => toolIcons[permission.tool_name] || toolIcons.default);
  const dangerInfo = createMemo(() => toolDangerLevels[permission.tool_name] || toolDangerLevels.default);
  const dangerColors_ = createMemo(() => dangerColors[dangerInfo().level]);

  const shouldShowAllowForSession = createMemo(() => {
    const hideForTools = [
      "Edit",
      "MultiEdit",
      "Write",
      "NotebookEdit",
      "exit_plan_mode",
      "ExitPlanMode",
    ];
    return (
      !hideForTools.includes(permission.tool_name) &&
      permissionMode !== "AutoApprove"
    );
  });

  const shouldShowAllowAllEdits = createMemo(() => {
    const isEditTool = ["Edit", "MultiEdit", "Write"].includes(
      permission.tool_name,
    );
    return isEditTool && permissionMode === "AcceptEdits";
  });

  const formatToolInput = (input: unknown): string => {
    if (!input) return "No parameters";
    if (typeof input === "string") return input;
    try {
      return JSON.stringify(input, null, 2);
    } catch {
      return String(input);
    }
  };

  const handleApprove = () => {
    onApprove("Approved");
  };

  const handleApproveForSession = () => {
    onApprove("ApprovedForSession");
  };

  const handleAllowAllEdits = () => {
    onApprove("Approved");
  };

  const handleDeny = () => {
    onDeny();
  };

  // Keyboard shortcuts
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (props.disabled || loading) return;
      
      // Ignore if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      if (e.key.toLowerCase() === "y" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleApprove();
      } else if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleDeny();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const Icon = toolIcon();

  return (
    <Card class={cn(
      "border-l-4 relative overflow-hidden",
      "transition-all duration-300",
      !props.disabled && !loading && "animate-glow-pulse",
      dangerColors_().border
    )}>
      {/* Glow effect overlay */}
      <div
        class={cn(
          "absolute inset-0 opacity-0 transition-opacity duration-300",
          "bg-gradient-to-r from-transparent via-primary/5 to-transparent",
          !props.disabled && !loading && "opacity-100"
        )}
      />

      <CardHeader class={cn("relative", "pb-2")}>
        <div class="flex items-start gap-3">
          {/* Tool Icon */}
          <div
            class={cn(
              "shrink-0 p-2.5 rounded-xl",
              "bg-base-content/5",
              dangerColors_().bg,
              dangerColors_().text
            )}
          >
            <Icon size={18} />
          </div>

          {/* Title & Tool Name */}
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="font-semibold text-sm">{permission.tool_name}</h3>
              {/* Danger Level Badge */}
              <span
                class={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                  dangerColors_().bg,
                  dangerColors_().text,
                  dangerColors_().border,
                  "border"
                )}
              >
                <Show when={dangerInfo().level === "high"}>
                  <FiAlertTriangle size={10} />
                </Show>
                <Show when={dangerInfo().level === "medium"}>
                  <FiAlertCircle size={10} />
                </Show>
                {dangerInfo().label}
              </span>
            </div>
            <p class="text-xs text-base-content/50 mt-0.5">
              Permission request • {new Date(permission.created_at).toLocaleTimeString()}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent class="space-y-3 relative">
        {/* Message/Description */}
        <Show when={permission.message}>
          <div class="text-sm text-base-content/70 bg-base-200/30 rounded-lg p-3">
            <SolidMarkdown children={permission.message} />
          </div>
        </Show>

        {/* Tool Parameters with Syntax Highlighting */}
        <Show when={permission.tool_params}>
          <div>
            <div class="mb-1.5 text-xs font-medium text-base-content/50 flex items-center gap-1.5">
              <FiLock size={10} />
              Parameters
            </div>
            <SyntaxHighlightedCode code={formatToolInput(permission.tool_params)} />
          </div>
        </Show>

        {/* Remember Choice Checkbox */}
        <Show when={!loading}>
          <label class="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={rememberChoice()}
              onChange={(e) => setRememberChoice(e.currentTarget.checked)}
              class="checkbox checkbox-sm checkbox-primary"
            />
            <span class="text-xs text-base-content/60 group-hover:text-base-content/80 transition-colors">
              Remember this choice for similar requests
            </span>
          </label>
        </Show>

        {/* Action Buttons */}
        <Show when={!loading}>
          <div class="flex flex-col sm:flex-row gap-2 pt-1">
            <Button
              variant="success"
              size="sm"
              class="flex-1 group"
              disabled={disabled}
              onClick={handleApprove}
              title="Allow (Y)"
            >
              <FiCheck size={14} class="mr-1.5 group-hover:scale-110 transition-transform" />
              <span>Allow</span>
              <kbd class="ml-auto text-[10px] opacity-50 group-hover:opacity-80">Y</kbd>
            </Button>

            <Show when={shouldShowAllowForSession()}>
              <Button
                variant="outline"
                size="sm"
                class="flex-1 text-xs sm:text-sm"
                disabled={disabled}
                onClick={handleApproveForSession}
              >
                Allow for Session
              </Button>
            </Show>

            <Show when={shouldShowAllowAllEdits()}>
              <Button
                variant="outline"
                size="sm"
                class="flex-1 text-xs sm:text-sm"
                disabled={disabled}
                onClick={handleAllowAllEdits}
              >
                Allow All Edits
              </Button>
            </Show>

            <Button
              variant="destructive"
              size="sm"
              class="flex-1 group"
              disabled={disabled}
              onClick={handleDeny}
              title="Deny (N)"
            >
              <FiX size={14} class="mr-1.5 group-hover:scale-110 transition-transform" />
              <span>Deny</span>
              <kbd class="ml-auto text-[10px] opacity-50 group-hover:opacity-80">N</kbd>
            </Button>
          </div>
        </Show>

        {/* Loading State */}
        <Show when={loading}>
          <div class="flex items-center justify-center py-6">
            <div class="flex items-center gap-3 text-base-content/60">
              <Spinner size="sm" />
              <span class="text-sm">Waiting for response...</span>
            </div>
          </div>
        </Show>

        {/* Keyboard Hint */}
        <Show when={!loading && !disabled}>
          <div class="text-[10px] text-base-content/30 text-center pt-1">
            Press <kbd class="kbd kbd-xs">Y</kbd> to allow or <kbd class="kbd kbd-xs">N</kbd> to deny
          </div>
        </Show>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Permission List Component
// ============================================================================

interface PermissionListProps {
  permissions: PendingPermission[];
  disabled: boolean;
  permissionMode: PermissionMode;
  onApprove: (requestId: string, decision?: ApprovalDecision) => void;
  onDeny: (requestId: string, reason?: string) => void;
}

export function PermissionList(props: PermissionListProps) {
  const { permissions, disabled, permissionMode, onApprove, onDeny } = props;

  if (permissions.length === 0) {
    return (
      <div class="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <div class="p-4 bg-base-200/50 rounded-full mb-4">
          <FiShield size={32} class="text-base-content/30" />
        </div>
        <p class="text-sm text-base-content/50">No pending permissions</p>
      </div>
    );
  }

  return (
    <div class="space-y-3">
      {permissions.map((permission) => (
        <PermissionCard
          permission={permission}
          disabled={disabled}
          permissionMode={permissionMode}
          onApprove={(decision) => onApprove(permission.request_id, decision)}
          onDeny={(reason) => onDeny(permission.request_id, reason)}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Permission Message (inline in message list)
// ============================================================================

export interface PermissionMessageProps {
  toolName: string;
  toolParams?: unknown;
  message?: string;
  requestId: string;
  permissionMode: PermissionMode;
  disabled?: boolean;
  onApprove: (decision?: ApprovalDecision) => void;
  onDeny: () => void;
}

export const PermissionMessage: Component<PermissionMessageProps> = (props) => {
  const formatToolInput = (input: unknown): string => {
    if (!input) return "";
    if (typeof input === "string") return input;
    try {
      return JSON.stringify(input, null, 2);
    } catch {
      return String(input);
    }
  };

  const showAllowForSession = createMemo(() => {
    const hideForTools = [
      "Edit",
      "MultiEdit",
      "Write",
      "NotebookEdit",
      "exit_plan_mode",
      "ExitPlanMode",
    ];
    return (
      !hideForTools.includes(props.toolName) &&
      props.permissionMode !== "AutoApprove"
    );
  });

  const dangerInfo = createMemo(() => toolDangerLevels[props.toolName] || toolDangerLevels.default);
  const dangerColors_ = createMemo(() => dangerColors[dangerInfo().level]);

  return (
    <div class={cn(
      "chat-bubble relative overflow-hidden",
      "bg-warning/10 border border-warning/20",
      "rounded-2xl px-4 py-3 max-w-[85%] sm:max-w-[80%]",
      !props.disabled && "animate-glow-pulse"
    )}>
      {/* Glow overlay */}
      <div class="absolute inset-0 bg-gradient-to-r from-warning/5 via-transparent to-warning/5 opacity-0 hover:opacity-100 transition-opacity" />

      {/* Header */}
      <div class="flex items-center gap-2 mb-2 relative">
        <div class={cn(
          "rounded-lg p-1.5",
          dangerColors_().bg,
          dangerColors_().text
        )}>
          <FiShield size={14} />
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm">Permission Required</div>
          <div class="text-xs text-base-content/50 truncate">{props.toolName}</div>
        </div>
        {/* Danger level */}
        <span class={cn(
          "text-[9px] font-medium px-1.5 py-0.5 rounded",
          dangerColors_().bg,
          dangerColors_().text
        )}>
          {dangerInfo().level === "high" && <FiAlertTriangle size={8} class="inline mr-0.5" />}
          {dangerInfo().level}
        </span>
      </div>

      {/* Message/Description */}
      <Show when={props.message}>
        <div class="mb-2 text-sm text-base-content/70">
          <SolidMarkdown children={props.message} />
        </div>
      </Show>

      {/* Tool Parameters */}
      <Show when={props.toolParams}>
        <div class="mb-2">
          <div class="text-[10px] font-medium text-base-content/40 mb-1 flex items-center gap-1">
            <FiLock size={8} />
            Parameters
          </div>
          <pre class="overflow-x-auto rounded bg-base-300/50 p-2 text-[11px] font-mono max-h-24">
            {formatToolInput(props.toolParams)}
          </pre>
        </div>
      </Show>

      {/* Action Buttons */}
      <Show when={!props.disabled}>
        <div class="flex flex-wrap gap-1.5 sm:gap-2 relative">
          <Button
            variant="success"
            size="sm"
            class="flex-1 min-w-0 px-2 sm:px-3 h-8 group"
            onClick={() => props.onApprove("Approved")}
          >
            <FiCheck size={12} class="mr-0.5 shrink-0 group-hover:scale-110" />
            <span class="text-[11px] sm:text-xs truncate">Allow</span>
            <kbd class="ml-auto text-[9px] opacity-40">Y</kbd>
          </Button>

          <Show when={showAllowForSession()}>
            <Button
              variant="outline"
              size="sm"
              class="flex-1 min-w-0 px-2 sm:px-3 h-8"
              onClick={() => props.onApprove("ApprovedForSession")}
            >
              <span class="text-[11px] sm:text-xs truncate">Session</span>
            </Button>
          </Show>

          <Button
            variant="destructive"
            size="sm"
            class="flex-1 min-w-0 px-2 sm:px-3 h-8 group"
            onClick={props.onDeny}
          >
            <FiX size={12} class="mr-0.5 shrink-0 group-hover:scale-110" />
            <span class="text-[11px] sm:text-xs truncate">Deny</span>
            <kbd class="ml-auto text-[9px] opacity-40">N</kbd>
          </Button>
        </div>
      </Show>

      <Show when={props.disabled}>
        <div class="flex items-center justify-center py-2 text-base-content/50">
          <FiLoader size={14} class="animate-spin mr-2" />
          <span class="text-xs">Waiting...</span>
        </div>
      </Show>
    </div>
  );
};

// ============================================================================
// User Question Message (inline selection)
// ============================================================================

export interface UserQuestionMessageProps {
  question: string;
  options: string[];
  questionId: string;
  disabled?: boolean;
  onSelect: (option: string) => void;
}

export const UserQuestionMessage: Component<UserQuestionMessageProps> = (props) => {
  return (
    <div class="chat-bubble bg-info/10 border border-info/20 rounded-2xl px-4 py-3 max-w-[85%] sm:max-w-[80%]">
      {/* Header */}
      <div class="flex items-center gap-2 mb-2">
        <div class="rounded-lg bg-info/20 p-1.5 text-info">
          <FiLoader size={14} />
        </div>
        <div class="font-medium text-sm">Question</div>
      </div>

      {/* Question */}
      <div class="mb-3 text-sm text-base-content/70">
        <SolidMarkdown children={props.question} />
      </div>

      {/* Options */}
      <Show when={!props.disabled}>
        <div class="flex flex-col gap-2">
          {props.options.map((option, index) => (
            <Button
              variant="outline"
              size="sm"
              class="w-full justify-start text-left h-9 px-3"
              onClick={() => props.onSelect(option)}
            >
              <span class="mr-2 text-base-content/50 font-medium">
                {String.fromCharCode(65 + index)}.
              </span>
              <span class="truncate">{option}</span>
            </Button>
          ))}
        </div>
      </Show>

      <Show when={props.disabled}>
        <div class="flex items-center justify-center py-2 text-base-content/50">
          <FiLoader size={14} class="animate-spin mr-2" />
          <span class="text-xs">Waiting for response...</span>
        </div>
      </Show>
    </div>
  );
};

// Import createSignal for rememberChoice
import { createSignal } from "solid-js";
