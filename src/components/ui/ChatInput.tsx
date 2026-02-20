/**
 * Enhanced Chat Input Component
 *
 * AI-native chat input inspired by Vercel AI Elements:
 * - Auto-resizing textarea
 * - Markdown support indicator
 * - Keyboard shortcuts
 * - Loading states
 */

import { type Component, Show, createSignal, createEffect, onMount } from "solid-js";
import { cn } from "~/lib/utils";
import {
  FiSend,
  FiSquare,
  FiPlus,
  FiCommand,
} from "solid-icons/fi";

// ============================================================================
// Types
// ============================================================================

export interface ChatInputProps {
  value: string;
  onInput: (value: string) => void;
  onSubmit: () => void;
  onInterrupt?: () => void;
  placeholder?: string;
  disabled?: boolean;
  isStreaming?: boolean;
  maxHeight?: number;
  class?: string;
}

// ============================================================================
// Chat Input Component
// ============================================================================

export const ChatInput: Component<ChatInputProps> = (props) => {
  let textareaRef: HTMLTextAreaElement | undefined;
  const [focused, setFocused] = createSignal(false);

  // Auto-resize textarea
  const adjustHeight = () => {
    if (textareaRef) {
      textareaRef.style.height = "auto";
      const newHeight = Math.min(textareaRef.scrollHeight, props.maxHeight || 200);
      textareaRef.style.height = `${newHeight}px`;
    }
  };

  // Adjust height when value changes
  createEffect(() => {
    props.value;
    adjustHeight();
  });

  // Focus textarea on mount
  onMount(() => {
    if (textareaRef) {
      textareaRef.focus();
    }
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (props.isStreaming && props.onInterrupt) {
        props.onInterrupt();
      } else if (props.value.trim()) {
        props.onSubmit();
      }
    }
  };

  const handleInput = (e: InputEvent) => {
    const target = e.currentTarget as HTMLTextAreaElement;
    props.onInput(target.value);
  };

  return (
    <div
      class={cn(
        "flex flex-col gap-2 p-3 bg-base-200 border-t border-border transition-colors",
        focused() && "bg-base-100",
        props.class
      )}
    >
      {/* Input Container */}
      <div
        class={cn(
          "flex items-end gap-2 rounded-xl border bg-background transition-all duration-200",
          focused()
            ? "border-primary shadow-lg shadow-primary/10"
            : "border-border hover:border-muted-foreground/30"
        )}
      >
        {/* Attach Button */}
        <button
          type="button"
          class="p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors shrink-0"
          title="Attach files"
          disabled={props.disabled}
        >
          <FiPlus size={20} />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={props.value}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={props.placeholder || "Type your message..."}
          class="flex-1 py-3 bg-transparent border-none outline-none resize-none text-sm max-h-[200px] min-h-[24px] leading-relaxed"
          disabled={props.disabled}
          rows={1}
        />

        {/* Send/Stop Button */}
        <button
          type="button"
          onClick={() => {
            if (props.isStreaming && props.onInterrupt) {
              props.onInterrupt();
            } else {
              props.onSubmit();
            }
          }}
          disabled={
            !props.isStreaming && (!props.value.trim() || props.disabled)
          }
          class={cn(
            "shrink-0 p-2.5 rounded-xl transition-all duration-200",
            props.isStreaming
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          title={props.isStreaming ? "Stop generation" : "Send message"}
        >
          <Show when={props.isStreaming} fallback={<FiSend size={20} />}>
            <FiSquare size={20} />
          </Show>
        </button>
      </div>

      {/* Footer */}
      <div class="flex items-center justify-between px-1 text-[10px] text-muted-foreground/60">
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-1">
            <kbd class="kbd kbd-xs">↵</kbd> send
          </span>
          <span class="flex items-center gap-1">
            <kbd class="kbd kbd-xs">⇧</kbd>+<kbd class="kbd kbd-xs">↵</kbd> new line
          </span>
        </div>
        <span>Markdown supported</span>
      </div>
    </div>
  );
};

// ============================================================================
// Command Palette Component
// ============================================================================

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: Component<{ size?: number; class?: string }>;
  action: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
  placeholder?: string;
  class?: string;
}

export const CommandPalette: Component<CommandPaletteProps> = (props) => {
  const [search, setSearch] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;

  const filteredItems = () => {
    const query = search().toLowerCase();
    if (!query) return props.items;
    return props.items.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
    );
  };

  // Reset selection when filtered items change
  createEffect(() => {
    filteredItems();
    setSelectedIndex(0);
  });

  // Focus input when opened
  createEffect(() => {
    if (props.open && inputRef) {
      inputRef.focus();
    }
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    const items = filteredItems();

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        const selected = items[selectedIndex()];
        if (selected) {
          selected.action();
          props.onClose();
        }
        break;
      case "Escape":
        e.preventDefault();
        props.onClose();
        break;
    }
  };

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
        {/* Backdrop */}
        <div
          class="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={props.onClose}
        />

        {/* Dialog */}
        <div
          class={cn(
            "relative w-full max-w-lg bg-base-100 rounded-xl border border-border shadow-2xl overflow-hidden",
            props.class
          )}
        >
          {/* Search Input */}
          <div class="flex items-center gap-3 px-4 py-3 border-b border-border">
            <FiCommand size={18} class="text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              placeholder={props.placeholder || "Type a command..."}
              class="flex-1 bg-transparent border-none outline-none text-sm"
            />
            <kbd class="kbd kbd-sm">ESC</kbd>
          </div>

          {/* Command List */}
          <div class="max-h-[300px] overflow-y-auto p-2">
            <Show
              when={filteredItems().length > 0}
              fallback={
                <div class="py-8 text-center text-muted-foreground text-sm">
                  No commands found
                </div>
              }
            >
              {filteredItems().map((item, index) => (
                <button
                  type="button"
                  onClick={() => {
                    item.action();
                    props.onClose();
                  }}
                  class={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                    index === selectedIndex()
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  )}
                >
                  <Show when={item.icon}>
                    <div class="text-muted-foreground shrink-0">
                      {item.icon!({ size: 18 })}
                    </div>
                  </Show>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm truncate">{item.label}</div>
                    <Show when={item.description}>
                      <div class="text-xs text-muted-foreground truncate">
                        {item.description}
                      </div>
                    </Show>
                  </div>
                  <Show when={index === selectedIndex()}>
                    <kbd class="kbd kbd-xs">↵</kbd>
                  </Show>
                </button>
              ))}
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};

// ============================================================================
// Prompt Suggestions Component
// ============================================================================

export interface PromptSuggestion {
  id: string;
  label: string;
  prompt: string;
}

export interface PromptSuggestionsProps {
  suggestions: PromptSuggestion[];
  onSelect: (prompt: string) => void;
  class?: string;
}

export const PromptSuggestions: Component<PromptSuggestionsProps> = (props) => {
  return (
    <div
      class={cn(
        "flex flex-wrap gap-2 px-3 pb-2",
        props.class
      )}
    >
      {props.suggestions.map((suggestion) => (
        <button
          type="button"
          onClick={() => props.onSelect(suggestion.prompt)}
          class="px-3 py-1.5 text-xs text-muted-foreground bg-muted/50 hover:bg-muted rounded-full border border-border hover:border-primary/50 transition-colors"
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  );
};
