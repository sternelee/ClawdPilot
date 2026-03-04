/**
 * Keyboard Shortcuts Help Dialog
 *
 * Displays all available keyboard shortcuts in a modal.
 */

import { type Component, Show, For, onMount, onCleanup } from "solid-js";
import { cn } from "~/lib/utils";
import {
  FiX,
  FiHelpCircle,
} from "solid-icons/fi";

// ============================================================================
// Types
// ============================================================================

export interface KeyboardShortcut {
  key: string;
  description: string;
  category: string;
}

export interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
  class?: string;
}

// ============================================================================
// Shortcut Categories and Definitions
// ============================================================================

const shortcuts: KeyboardShortcut[] = [
  // Global
  { key: "⌘ K", description: "Open command palette", category: "Global" },
  { key: "⌘ B", description: "Toggle sidebar", category: "Global" },
  { key: "?", description: "Show keyboard shortcuts", category: "Global" },
  { key: "Esc", description: "Close dialogs", category: "Global" },

  // Chat
  { key: "Enter", description: "New line", category: "Chat" },
  { key: "Shift + Enter", description: "Send message", category: "Chat" },
  { key: "↑ / ↓", description: "Navigate history", category: "Chat" },

  // Navigation
  { key: "1-9", description: "Switch to session", category: "Navigation" },
  { key: "Tab", description: "Focus next element", category: "Navigation" },
  { key: "Shift + Tab", description: "Focus previous", category: "Navigation" },
];

// ============================================================================
// Component
// ============================================================================

export const KeyboardShortcutsDialog: Component<KeyboardShortcutsDialogProps> = (props) => {
  // Group shortcuts by category
  const groupedShortcuts = () => {
    const groups: Record<string, KeyboardShortcut[]> = {};
    for (const shortcut of shortcuts) {
      if (!groups[shortcut.category]) {
        groups[shortcut.category] = [];
      }
      groups[shortcut.category].push(shortcut);
    }
    return groups;
  };

  // Handle keyboard events
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close on Escape
      if (e.key === "Escape" && props.open) {
        props.onClose();
      }

      // Open on ?
      if (e.key === "?" && !props.open) {
        // Don't prevent default, let it type
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div
          class="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={props.onClose}
        />

        {/* Dialog */}
        <div
          class={cn(
            "relative w-full max-w-lg bg-base-100 rounded-2xl border border-border shadow-2xl overflow-hidden",
            props.class
          )}
        >
          {/* Header */}
          <div class="flex items-center justify-between px-6 py-4 border-b border-border">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-primary/10 rounded-xl">
                <FiHelpCircle size={20} class="text-primary" />
              </div>
              <div>
                <h2 class="text-lg font-semibold">Keyboard Shortcuts</h2>
                <p class="text-sm text-muted-foreground">Press ? to show this help</p>
              </div>
            </div>
            <button
              type="button"
              onClick={props.onClose}
              class="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <FiX size={20} />
            </button>
          </div>

          {/* Content */}
          <div class="p-6 max-h-[60vh] overflow-y-auto">
            <div class="space-y-6">
              <For each={Object.entries(groupedShortcuts())}>
                {([category, items]) => (
                  <div>
                    <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      {category}
                    </h3>
                    <div class="space-y-2">
                      <For each={items}>
                        {(shortcut) => (
                          <div class="flex items-center justify-between py-2">
                            <span class="text-sm">{shortcut.description}</span>
                            <kbd class="kbd kbd-sm">{shortcut.key}</kbd>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>

          {/* Footer */}
          <div class="px-6 py-4 border-t border-border bg-muted/30">
            <p class="text-xs text-muted-foreground text-center">
              Press <kbd class="kbd kbd-xs">?</kbd> anytime to show this help
            </p>
          </div>
        </div>
      </div>
    </Show>
  );
};

// ============================================================================
// Keyboard Shortcut Badge Component
// ============================================================================

export interface KbdShortcutProps {
  keys: string[];
  class?: string;
}

export const KbdShortcut: Component<KbdShortcutProps> = (props) => {
  return (
    <div class={cn("flex items-center gap-1", props.class)}>
      {props.keys.map((key, index) => (
        <>
          <kbd class="kbd kbd-xs">{key}</kbd>
          {index < props.keys.length - 1 && (
            <span class="text-muted-foreground text-xs">+</span>
          )}
        </>
      ))}
    </div>
  );
};
