/**
 * ThinkingRow — agent 思考状态行
 *
 * aria-live polite 区域，流式时旋转图标 + 动词轮换 + 计时，
 * 结束后可折叠展开思考内容。
 */

import { type Component, createSignal, onCleanup, onMount, Show } from "solid-js";
import { FiChevronDown, FiChevronRight } from "solid-icons/fi";

interface ThinkingRowProps {
  thinking?: string;
  isStreaming?: boolean;
  elapsed?: number;
}

const VERBS = ["Thinking", "Analyzing", "Planning", "Searching", "Processing"];

export const ThinkingRow: Component<ThinkingRowProps> = (props) => {
  const [expanded, setExpanded] = createSignal(false);
  const [verbIdx, setVerbIdx] = createSignal(0);

  let verbInterval: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    if (props.isStreaming) {
      verbInterval = setInterval(() => {
        setVerbIdx((i) => (i + 1) % VERBS.length);
      }, 1500);
    }
  });

  onCleanup(() => {
    if (verbInterval) clearInterval(verbInterval);
  });

  const hasContent = () => !!props.thinking;
  const elapsedStr = () => {
    if (!props.elapsed) return "";
    const s = Math.floor(props.elapsed / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div
      class="mx-4 my-1 group"
      role="status"
      aria-live="polite"
      aria-label={
        props.isStreaming
          ? `${VERBS[verbIdx()]}...`
          : "Thinking complete"
      }
    >
      <button
        type="button"
        class="flex items-center gap-2 w-full text-left px-2 py-1
               text-[var(--as-font-size-sm,0.8125rem)]
               text-[hsl(var(--bc)/0.5)] hover:text-[hsl(var(--bc)/0.7)]
               transition-colors duration-[var(--as-transition-speed,0.15s)]"
        onClick={() => setExpanded((v) => !v)}
        disabled={!hasContent()}
      >
        <Show
          when={props.isStreaming}
          fallback={
            hasContent()
              ? (
                expanded() ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />
              )
              : null
          }
        >
          <span class="inline-block w-3 h-3" aria-hidden="true">
            <svg
              class="animate-spin"
              viewBox="0 0 12 12"
              fill="none"
            >
              <circle
                cx="6"
                cy="6"
                r="4"
                stroke="currentColor"
                stroke-width="2"
                stroke-dasharray="6 18"
              />
            </svg>
          </span>
        </Show>
        <span class="font-medium">
          {props.isStreaming ? `${VERBS[verbIdx()]}…` : hasContent() ? `Thought for ${elapsedStr()}` : ""}
        </span>
        <Show when={props.isStreaming}>
          <span>{elapsedStr()}</span>
        </Show>
      </button>
      <Show when={expanded() && hasContent()}>
        <div class="px-4 py-2 text-[var(--as-font-size-sm,0.8125rem)] text-[hsl(var(--bc)/0.5)] leading-relaxed whitespace-pre-wrap border-t border-[hsl(var(--bc)/0.05)]">
          {props.thinking}
        </div>
      </Show>
    </div>
  );
};
