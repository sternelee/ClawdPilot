/**
 * ToolCallRow — 工具调用行
 *
 * 使用原生 <details>/<summary> 语义，键盘可操作，
 * 展开显示工具输出（输出可能较长，限制最大高度滚动）。
 */

import { type Component, Show } from "solid-js";
import type { ToolCall } from "~/stores/chatStore";

interface ToolCallRowProps {
  tool: ToolCall;
}

function statusIcon(status: ToolCall["status"] | undefined): string {
  switch (status) {
    case "started":
    case "in_progress":
      return "⏺";
    case "completed":
      return "⏸";
    case "failed":
      return "✕";
    case "cancelled":
      return "○";
    default:
      return "○";
  }
}

export const ToolCallRow: Component<ToolCallRowProps> = (props) => {
  return (
    <details
      class="mx-4 my-1.5 group border border-[hsl(var(--bc)/0.08)] rounded-[var(--as-radius,0.25rem)] overflow-hidden"
      open={false}
    >
      <summary
        class="flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none list-none
               text-[var(--as-font-size-sm,0.8125rem)] text-[hsl(var(--bc)/0.6)]
               hover:bg-[hsl(var(--b2)/0.3)] transition-colors
               [&::-webkit-details-marker]:hidden"
      >
        <span aria-hidden="true">{statusIcon(props.tool.status)}</span>
        <span class="font-medium text-[hsl(var(--bc)/0.8)]">
          {props.tool.toolName || "Tool Call"}
        </span>
        <span class="ml-auto text-[hsl(var(--bc)/0.4)]">
          {props.tool.status || "pending"}
        </span>
      </summary>
      <Show when={props.tool.output}>
        <div class="px-3 pb-2 border-t border-[hsl(var(--bc)/0.04)]">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--bc)/0.3)]">
            Output
          </span>
          <pre class="text-[11px] font-mono text-[hsl(var(--bc)/0.6)] bg-[hsl(var(--b2)/0.3)] rounded p-1.5 mt-0.5 overflow-x-auto max-h-48 overflow-y-auto">
            {props.tool.output}
          </pre>
        </div>
      </Show>
    </details>
  );
};
