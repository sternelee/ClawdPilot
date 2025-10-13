// QuickAccessToolbar - Touch-optimized terminal key access
import { createSignal, createMemo, For, Show, onMount, onCleanup } from "solid-js";
import { HapticFeedback, getDeviceCapabilities } from "../../utils/mobile";

export interface QuickAccessKey {
  id: string;
  label: string;
  keySequence: string;
  icon?: string;
  category: 'navigation' | 'control' | 'editing' | 'custom';
  hapticFeedback?: 'light' | 'medium' | 'heavy';
}

export type ToolbarLayout = 'compact' | 'expanded' | 'auto';
export type ToolbarPosition = 'top' | 'bottom' | 'floating';

interface QuickAccessToolbarProps {
  onKeyPress: (keySequence: string) => void;
  layout?: ToolbarLayout;
  position?: ToolbarPosition;
  visible?: boolean;
  customKeys?: QuickAccessKey[];
  class?: string;
}

// Default key sets - Enhanced with practical shortcuts
const ESSENTIAL_KEYS: QuickAccessKey[] = [
  { id: 'ctrl-c', label: 'Ctrl+C', keySequence: '\x03', icon: '⌃C', category: 'control', hapticFeedback: 'medium' },
  { id: 'ctrl-v', label: 'Paste', keySequence: '\x16', icon: '📋', category: 'editing', hapticFeedback: 'light' },
  { id: 'tab', label: 'Tab', keySequence: '\t', icon: '⇥', category: 'control', hapticFeedback: 'light' },
  { id: 'esc', label: 'Esc', keySequence: '\x1b', icon: '⎋', category: 'control', hapticFeedback: 'light' },
  { id: 'enter', label: '↵', keySequence: '\r', icon: '↵', category: 'control', hapticFeedback: 'medium' },
  { id: 'ctrl-d', label: 'Ctrl+D', keySequence: '\x04', icon: '⌃D', category: 'control', hapticFeedback: 'medium' },
];

const NAVIGATION_KEYS: QuickAccessKey[] = [
  { id: 'arrow-left', label: '←', keySequence: '\x1b[D', icon: '←', category: 'navigation', hapticFeedback: 'light' },
  { id: 'arrow-right', label: '→', keySequence: '\x1b[C', icon: '→', category: 'navigation', hapticFeedback: 'light' },
  { id: 'arrow-up', label: '↑', keySequence: '\x1b[A', icon: '↑', category: 'navigation', hapticFeedback: 'light' },
  { id: 'arrow-down', label: '↓', keySequence: '\x1b[B', icon: '↓', category: 'navigation', hapticFeedback: 'light' },
  { id: 'home', label: 'Home', keySequence: '\x1b[H', icon: '⇱', category: 'navigation', hapticFeedback: 'light' },
  { id: 'end', label: 'End', keySequence: '\x1b[F', icon: '⇲', category: 'navigation', hapticFeedback: 'light' },
];

const EDITING_KEYS: QuickAccessKey[] = [
  { id: 'ctrl-z', label: 'Undo', keySequence: '\x1a', icon: '↶', category: 'editing', hapticFeedback: 'light' },
  { id: 'ctrl-x', label: 'Cut', keySequence: '\x18', icon: '✂', category: 'editing', hapticFeedback: 'light' },
  { id: 'ctrl-a', label: 'Select All', keySequence: '\x01', icon: '⌃A', category: 'editing', hapticFeedback: 'light' },
  { id: 'ctrl-l', label: 'Clear', keySequence: '\x0c', icon: '🗑', category: 'control', hapticFeedback: 'light' },
];

// Vim/Editor specific shortcuts
const VIM_KEYS: QuickAccessKey[] = [
  { id: 'vim-quit', label: ':q', keySequence: ':q\r', icon: ':q', category: 'custom', hapticFeedback: 'medium' },
  { id: 'vim-quit-force', label: ':q!', keySequence: ':q!\r', icon: ':q!', category: 'custom', hapticFeedback: 'medium' },
  { id: 'vim-save', label: ':w', keySequence: ':w\r', icon: ':w', category: 'custom', hapticFeedback: 'medium' },
  { id: 'vim-save-quit', label: ':wq', keySequence: ':wq\r', icon: ':wq', category: 'custom', hapticFeedback: 'medium' },
  { id: 'vim-insert', label: 'i', keySequence: 'i', icon: 'i', category: 'custom', hapticFeedback: 'light' },
  { id: 'vim-visual', label: 'v', keySequence: 'v', icon: 'v', category: 'custom', hapticFeedback: 'light' },
];

const ADVANCED_KEYS: QuickAccessKey[] = [
  { id: 'pgup', label: 'PgUp', keySequence: '\x1b[5~', icon: '⇞', category: 'navigation', hapticFeedback: 'light' },
  { id: 'pgdn', label: 'PgDn', keySequence: '\x1b[6~', icon: '⇟', category: 'navigation', hapticFeedback: 'light' },
  { id: 'ctrl-r', label: 'Ctrl+R', keySequence: '\x12', icon: '⌃R', category: 'control', hapticFeedback: 'light' },
  { id: 'ctrl-u', label: 'Ctrl+U', keySequence: '\x15', icon: '⌃U', category: 'control', hapticFeedback: 'light' },
  { id: 'ctrl-k', label: 'Ctrl+K', keySequence: '\x0b', icon: '⌃K', category: 'control', hapticFeedback: 'light' },
  { id: 'ctrl-w', label: 'Ctrl+W', keySequence: '\x17', icon: '⌃W', category: 'control', hapticFeedback: 'light' },
];

export function QuickAccessToolbar(props: QuickAccessToolbarProps) {
  const [layout, setLayout] = createSignal<ToolbarLayout>(props.layout || 'auto');
  const [showExpanded, setShowExpanded] = createSignal(false);
  const [scrollPosition, setScrollPosition] = createSignal(0);
  const [longPressKey, setLongPressKey] = createSignal<string | null>(null);

  const deviceCapabilities = getDeviceCapabilities();
  let scrollContainerRef: HTMLDivElement | undefined;
  let longPressTimeout: number | null = null;

  // Determine effective layout based on screen size
  const effectiveLayout = createMemo(() => {
    const currentLayout = layout();
    if (currentLayout !== 'auto') return currentLayout;

    // Auto mode: switch based on screen width
    return window.innerWidth < 640 ? 'compact' : 'expanded';
  });

  // Get keys to display based on layout
  const displayKeys = createMemo(() => {
    const customKeys = props.customKeys || [];
    const baseKeys = [...ESSENTIAL_KEYS, ...NAVIGATION_KEYS];

    if (effectiveLayout() === 'compact') {
      // Compact: Essential keys + custom keys
      return [...ESSENTIAL_KEYS, ...customKeys];
    } else {
      // Expanded: All keys + custom keys
      return [...baseKeys, ...EDITING_KEYS, ...customKeys];
    }
  });

  // Get expanded keys (shown on long press)
  const expandedKeys = createMemo(() => {
    return [...EDITING_KEYS, ...VIM_KEYS, ...ADVANCED_KEYS];
  });

  // Handle key press
  const handleKeyPress = (key: QuickAccessKey) => {
    // Haptic feedback
    if (key.hapticFeedback) {
      switch (key.hapticFeedback) {
        case 'light':
          HapticFeedback.light();
          break;
        case 'medium':
          HapticFeedback.medium();
          break;
        case 'heavy':
          HapticFeedback.heavy();
          break;
      }
    } else {
      HapticFeedback.light();
    }

    // Send key sequence
    props.onKeyPress(key.keySequence);

    console.log('[QuickAccessToolbar] Key pressed:', key.label, key.keySequence);
  };

  // Handle long press start
  const handleLongPressStart = (keyId: string) => {
    setLongPressKey(keyId);

    longPressTimeout = window.setTimeout(() => {
      setShowExpanded(true);
      HapticFeedback.medium();
      console.log('[QuickAccessToolbar] Long press detected, showing expanded keyboard');
    }, 500);
  };

  // Handle long press end
  const handleLongPressEnd = () => {
    if (longPressTimeout) {
      clearTimeout(longPressTimeout);
      longPressTimeout = null;
    }
    setLongPressKey(null);
  };

  // Handle scroll
  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef) return;

    const scrollAmount = 200;
    const newPosition = direction === 'left'
      ? Math.max(0, scrollPosition() - scrollAmount)
      : scrollPosition() + scrollAmount;

    scrollContainerRef.scrollTo({
      left: newPosition,
      behavior: 'smooth'
    });

    setScrollPosition(newPosition);
    HapticFeedback.light();
  };

  // Update scroll position on scroll
  const updateScrollPosition = () => {
    if (scrollContainerRef) {
      setScrollPosition(scrollContainerRef.scrollLeft);
    }
  };

  // Handle orientation change
  const handleOrientationChange = () => {
    // Recalculate layout on orientation change
    if (layout() === 'auto') {
      setLayout('auto'); // Trigger recalculation
    }
  };

  onMount(() => {
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    onCleanup(() => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);

      if (longPressTimeout) {
        clearTimeout(longPressTimeout);
      }
    });
  });

  // Get position classes
  const getPositionClasses = () => {
    const position = props.position || 'bottom';
    const baseClasses = 'quick-access-toolbar';

    switch (position) {
      case 'top':
        return `${baseClasses} toolbar-top`;
      case 'bottom':
        return `${baseClasses} toolbar-bottom`;
      case 'floating':
        return `${baseClasses} toolbar-floating`;
      default:
        return baseClasses;
    }
  };

  return (
    <Show when={props.visible !== false}>
      <div class={`${getPositionClasses()} ${props.class || ''}`}>
        {/* Main toolbar */}
        <div class="toolbar-container">
          {/* Scroll left button (compact mode only) */}
          <Show when={effectiveLayout() === 'compact' && scrollPosition() > 0}>
            <button
              class="toolbar-scroll-btn toolbar-scroll-left"
              onClick={() => handleScroll('left')}
              aria-label="Scroll left"
            >
              ‹
            </button>
          </Show>

          {/* Keys container */}
          <div
            ref={scrollContainerRef}
            class={`toolbar-keys ${effectiveLayout() === 'compact' ? 'toolbar-keys-compact' : 'toolbar-keys-expanded'}`}
            onScroll={updateScrollPosition}
          >
            <For each={displayKeys()}>
              {(key) => (
                <button
                  class={`toolbar-key ${longPressKey() === key.id ? 'toolbar-key-pressed' : ''}`}
                  onClick={() => handleKeyPress(key)}
                  onTouchStart={() => handleLongPressStart(key.id)}
                  onTouchEnd={handleLongPressEnd}
                  onTouchCancel={handleLongPressEnd}
                  onMouseDown={() => handleLongPressStart(key.id)}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                  title={key.label}
                  aria-label={key.label}
                >
                  <span class="toolbar-key-icon">{key.icon || key.label}</span>
                  <Show when={effectiveLayout() === 'expanded'}>
                    <span class="toolbar-key-label">{key.label}</span>
                  </Show>
                </button>
              )}
            </For>
          </div>

          {/* Scroll right button (compact mode only) */}
          <Show when={effectiveLayout() === 'compact'}>
            <button
              class="toolbar-scroll-btn toolbar-scroll-right"
              onClick={() => handleScroll('right')}
              aria-label="Scroll right"
            >
              ›
            </button>
          </Show>

          {/* Expand button (compact mode only) */}
          <Show when={effectiveLayout() === 'compact'}>
            <button
              class="toolbar-expand-btn"
              onClick={() => setShowExpanded(!showExpanded())}
              aria-label={showExpanded() ? 'Hide expanded keyboard' : 'Show expanded keyboard'}
            >
              {showExpanded() ? '▼' : '▲'}
            </button>
          </Show>
        </div>

        {/* Expanded keyboard overlay */}
        <Show when={showExpanded()}>
          <div class="toolbar-expanded-overlay">
            <div class="toolbar-expanded-content">
              <div class="toolbar-expanded-header">
                <h3 class="toolbar-expanded-title">Extended Keys</h3>
                <button
                  class="toolbar-expanded-close"
                  onClick={() => setShowExpanded(false)}
                  aria-label="Close expanded keyboard"
                >
                  ✕
                </button>
              </div>

              {/* Vim/Editor Commands Section */}
              <div class="toolbar-section">
                <div class="toolbar-section-title">Vim Commands</div>
                <div class="toolbar-expanded-keys">
                  <For each={VIM_KEYS}>
                    {(key) => (
                      <button
                        class="toolbar-key toolbar-key-expanded toolbar-key-vim"
                        onClick={() => {
                          handleKeyPress(key);
                          setShowExpanded(false);
                        }}
                        title={key.label}
                        aria-label={key.label}
                      >
                        <span class="toolbar-key-icon">{key.icon || key.label}</span>
                        <span class="toolbar-key-label">{key.label}</span>
                      </button>
                    )}
                  </For>
                </div>
              </div>

              {/* Editing Keys Section */}
              <div class="toolbar-section">
                <div class="toolbar-section-title">Editing</div>
                <div class="toolbar-expanded-keys">
                  <For each={EDITING_KEYS}>
                    {(key) => (
                      <button
                        class="toolbar-key toolbar-key-expanded"
                        onClick={() => {
                          handleKeyPress(key);
                          setShowExpanded(false);
                        }}
                        title={key.label}
                        aria-label={key.label}
                      >
                        <span class="toolbar-key-icon">{key.icon || key.label}</span>
                        <span class="toolbar-key-label">{key.label}</span>
                      </button>
                    )}
                  </For>
                </div>
              </div>

              {/* Advanced Keys Section */}
              <div class="toolbar-section">
                <div class="toolbar-section-title">Advanced</div>
                <div class="toolbar-expanded-keys">
                  <For each={ADVANCED_KEYS}>
                    {(key) => (
                      <button
                        class="toolbar-key toolbar-key-expanded"
                        onClick={() => {
                          handleKeyPress(key);
                          setShowExpanded(false);
                        }}
                        title={key.label}
                        aria-label={key.label}
                      >
                        <span class="toolbar-key-icon">{key.icon || key.label}</span>
                        <span class="toolbar-key-label">{key.label}</span>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}

// Export key sets for customization
export { ESSENTIAL_KEYS, NAVIGATION_KEYS, EDITING_KEYS, VIM_KEYS, ADVANCED_KEYS };
