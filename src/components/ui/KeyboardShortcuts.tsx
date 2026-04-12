/**
 * Keyboard Shortcuts Component
 *
 * Features:
 * - Common shortcuts overlay (? to show)
 * - Improved shortcut badges styling
 * - Shortcut hints in tooltips
 * - Grouped by category
 * - Global keyboard listener
 */

import { type Component, Show, For, onMount, onCleanup, createSignal } from "solid-js";
import { Portal } from "solid-js/web";
import { cn } from "~/lib/utils";
import {
  FiX,
  FiHelpCircle,
  FiCommand,
  FiMessageSquare,
  FiNavigation,
  FiGrid,
  FiLogOut,
} from "solid-icons/fi";
import { Tooltip } from "./Tooltip";

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
  { key: "⌘ B", description: "Toggle sidebar", category: "Global" },
  { key: "?", description: "Show keyboard shortcuts", category: "Global" },
  { key: "Esc", description: "Close dialogs / Cancel", category: "Global" },
  { key: "⌘ K", description: "Open command palette", category: "Global" },

  // Chat
  { key: "Enter", description: "New line in message", category: "Chat" },
  { key: "Shift Enter", description: "Send message", category: "Chat" },
  { key: "↑", description: "Navigate to previous message", category: "Chat" },
  { key: "↓", description: "Navigate to next message", category: "Chat" },

  // Navigation
  { key: "1-9", description: "Switch to session", category: "Navigation" },
  { key: "Tab", description: "Focus next element", category: "Navigation" },
  { key: "Shift Tab", description: "Focus previous element", category: "Navigation" },

  // Permissions
  { key: "Y", description: "Allow permission", category: "Permissions" },
  { key: "N", description: "Deny permission", category: "Permissions" },
];

// Category Icons
const categoryIcons: Record<string, typeof FiCommand> = {
  Global: FiCommand,
  Chat: FiMessageSquare,
  Navigation: FiNavigation,
  Permissions: FiGrid,
};

// ============================================================================
// Keyboard Shortcut Badge Component
// ============================================================================

export interface KbdShortcutProps {
  keys: string | string[];
  class?: string;
}

export const KbdShortcut: Component<KbdShortcutProps> = (props) => {
  const keys = () => Array.isArray(props.keys) ? props.keys : [props.keys];

  return (
    <div class={cn("flex items-center gap-1", props.class)}>
      {keys().map((key, index) => (
        <>
          <kbd
            class={cn(
              "kbd kbd-sm font-mono",
              "bg-base-200/80 backdrop-blur-sm",
              "border border-base-content/10",
              "shadow-sm"
            )}
          >
            {key}
          </kbd>
          {index < keys().length - 1 && (
            <span class="text-base-content/40 text-xs font-medium">+</span>
          )}
        </>
      ))}
    </div>
  );
};

// ============================================================================
// Shortcut Badge with Tooltip
// ============================================================================

export interface ShortcutBadgeProps {
  keys: string[];
  description: string;
  class?: string;
}

export const ShortcutBadge: Component<ShortcutBadgeProps> = (props) => {
  return (
    <Tooltip content={props.description} position="top">
      <div class={cn("inline-flex", props.class)}>
        <KbdShortcut keys={props.keys} />
      </div>
    </Tooltip>
  );
};

// ============================================================================
// Keyboard Shortcuts Dialog Component
// ============================================================================

export const KeyboardShortcutsDialog: Component<KeyboardShortcutsDialogProps> = (props) => {
  const [isAnimating, setIsAnimating] = createSignal(false);

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
        e.preventDefault();
        handleClose();
      }

      // Open on ?
      if (e.key === "?" && !props.open && !isInputElement(e.target as HTMLElement)) {
        e.preventDefault();
        props.onClose(); // This will be handled by parent to toggle
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const isInputElement = (el: HTMLElement): boolean => {
    return el.tagName === "INPUT" || 
           el.tagName === "TEXTAREA" || 
           el.isContentEditable;
  };

  const handleClose = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setIsAnimating(false);
      props.onClose();
    }, 150);
  };

  const CategoryIcon: Component<{ category: string }> = (iconProps) => {
    const Icon = categoryIcons[iconProps.category] || FiCommand;
    return (
      <div class="p-1.5 rounded-md bg-base-200/50">
        <Icon size={14} class="text-base-content/60" />
      </div>
    );
  };

  return (
    <Show when={props.open}>
      <Portal>
        {/* Backdrop */}
        <div
          class={cn(
            "fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm",
            "transition-opacity duration-150",
            isAnimating() ? "opacity-0" : "opacity-100"
          )}
          onClick={handleClose}
        />

        {/* Dialog */}
        <div
          class={cn(
            "fixed inset-0 z-[101] flex items-center justify-center p-4",
            "pointer-events-none"
          )}
        >
          <div
            class={cn(
              "relative w-full max-w-lg bg-base-100 rounded-2xl",
              "border border-base-content/10 shadow-2xl",
              "overflow-hidden",
              "transition-all duration-200",
              isAnimating() 
                ? "scale-95 opacity-0" 
                : "scale-100 opacity-100",
              props.class
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div class="flex items-center justify-between px-6 py-4 border-b border-base-content/10 bg-base-200/30">
              <div class="flex items-center gap-3">
                <div class="p-2 bg-primary/10 rounded-xl">
                  <FiHelpCircle size={20} class="text-primary" />
                </div>
                <div>
                  <h2 class="text-lg font-semibold">Keyboard Shortcuts</h2>
                  <p class="text-sm text-base-content/50">Quick reference guide</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                class={cn(
                  "p-2 hover:bg-base-content/10 rounded-lg",
                  "transition-all duration-150",
                  "hover:scale-105 active:scale-95"
                )}
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Content */}
            <div class="p-6 max-h-[60vh] overflow-y-auto">
              <div class="space-y-6">
                <For each={Object.entries(groupedShortcuts())}>
                  {([category, items]) => (
                    <div class="space-y-3">
                      {/* Category Header */}
                      <div class="flex items-center gap-2">
                        <CategoryIcon category={category} />
                        <h3 class="text-sm font-semibold text-base-content/80 uppercase tracking-wide">
                          {category}
                        </h3>
                      </div>

                      {/* Shortcuts List */}
                      <div class="grid gap-1">
                        <For each={items}>
                          {(shortcut) => (
                            <div 
                              class={cn(
                                "flex items-center justify-between py-2 px-3",
                                "rounded-lg hover:bg-base-200/50",
                                "transition-colors duration-100"
                              )}
                            >
                              <span class="text-sm text-base-content/80">
                                {shortcut.description}
                              </span>
                              <kbd
                                class={cn(
                                  "kbd kbd-sm font-mono",
                                  "bg-base-200/80 backdrop-blur-sm",
                                  "border border-base-content/10",
                                  "shadow-sm",
                                  "text-xs"
                                )}
                              >
                                {shortcut.key}
                              </kbd>
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
            <div class="px-6 py-4 border-t border-base-content/10 bg-base-200/20">
              <div class="flex items-center justify-between text-xs text-base-content/50">
                <div class="flex items-center gap-2">
                  <span>Press</span>
                  <kbd class="kbd kbd-xs">?</kbd>
                  <span>anytime to show this help</span>
                </div>
                <div class="flex items-center gap-1">
                  <kbd class="kbd kbd-xs">Esc</kbd>
                  <span>to close</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
};

// ============================================================================
// Keyboard Shortcuts Provider (Global Listener)
// ============================================================================

export interface KeyboardShortcutsProviderProps {
  children: any;
  onToggleShortcuts: () => void;
}

export const KeyboardShortcutsProvider: Component<KeyboardShortcutsProviderProps> = (props) => {
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || 
          target.tagName === "TEXTAREA" || 
          target.isContentEditable) {
        return;
      }

      // ? to show shortcuts
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        props.onToggleShortcuts();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  return props.children;
};

export { shortcuts };
