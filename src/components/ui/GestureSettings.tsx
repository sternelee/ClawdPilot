// GestureSettings - UI for configuring terminal gestures
import { createSignal, For, Show } from "solid-js";
import type { GestureDefinition } from "../../utils/mobile/TerminalGestureController";

interface GestureSettingsProps {
  gestures: GestureDefinition[];
  onToggleGesture: (gestureId: string, enabled: boolean) => void;
  onClose: () => void;
}

export function GestureSettings(props: GestureSettingsProps) {
  const [selectedGesture, setSelectedGesture] = createSignal<string | null>(null);

  const handleToggle = (gestureId: string, currentEnabled: boolean) => {
    props.onToggleGesture(gestureId, !currentEnabled);
  };

  const getGestureIcon = (type: string): string => {
    switch (type) {
      case 'tap':
        return '👆';
      case 'swipe':
        return '👉';
      case 'pinch':
        return '🤏';
      case 'longPress':
        return '⏱️';
      case 'multiTouch':
        return '✋';
      default:
        return '🎯';
    }
  };

  const getGestureDescription = (gesture: GestureDefinition): string => {
    let desc = `${gesture.fingers} finger${gesture.fingers > 1 ? 's' : ''}`;
    
    if (gesture.direction) {
      desc += ` ${gesture.direction}`;
    }
    
    desc += ` ${gesture.type}`;
    
    return desc;
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div class="bg-base-100 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div class="flex items-center justify-between p-4 border-b border-base-300">
          <h2 class="text-lg font-semibold">Gesture Settings</h2>
          <button
            class="btn btn-ghost btn-sm btn-circle"
            onClick={props.onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-y-auto p-4">
          <div class="space-y-3">
            <For each={props.gestures}>
              {(gesture) => (
                <div
                  class={`card bg-base-200 cursor-pointer transition-all ${
                    selectedGesture() === gesture.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedGesture(
                    selectedGesture() === gesture.id ? null : gesture.id
                  )}
                >
                  <div class="card-body p-4">
                    <div class="flex items-start justify-between">
                      <div class="flex items-start space-x-3 flex-1">
                        <div class="text-2xl">{getGestureIcon(gesture.type)}</div>
                        <div class="flex-1">
                          <div class="font-medium">{gesture.hint}</div>
                          <div class="text-xs text-base-content/60 mt-1">
                            {getGestureDescription(gesture)}
                          </div>
                        </div>
                      </div>
                      
                      <input
                        type="checkbox"
                        class="toggle toggle-primary"
                        checked={gesture.enabled !== false}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggle(gesture.id, gesture.enabled !== false);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    {/* Expanded details */}
                    <Show when={selectedGesture() === gesture.id}>
                      <div class="mt-3 pt-3 border-t border-base-300 text-sm space-y-2">
                        <div>
                          <span class="font-medium">Action:</span>{' '}
                          <span class="text-base-content/70">{gesture.action.type}</span>
                        </div>
                        <div>
                          <span class="font-medium">Haptic:</span>{' '}
                          <span class="text-base-content/70">
                            {Array.isArray(gesture.hapticFeedback) 
                              ? 'Custom pattern' 
                              : gesture.hapticFeedback}
                          </span>
                        </div>
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Footer */}
        <div class="p-4 border-t border-base-300">
          <div class="text-xs text-base-content/60 text-center">
            Tap a gesture to see more details
          </div>
        </div>
      </div>
    </div>
  );
}
