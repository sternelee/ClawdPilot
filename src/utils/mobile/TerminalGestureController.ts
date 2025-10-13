// TerminalGestureController - Enhanced gesture system for terminal interactions
import { GestureRecognizer, HapticFeedback } from "../mobile";
import type { GestureState } from "../mobile";

export interface GestureDefinition {
  id: string;
  type: 'tap' | 'swipe' | 'pinch' | 'longPress' | 'multiTouch';
  fingers: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  action: GestureAction;
  hapticFeedback: HapticPattern;
  hint: string;
  enabled?: boolean;
}

export interface GestureAction {
  type: 'keyboard' | 'navigation' | 'zoom' | 'menu' | 'custom';
  payload: any;
}

export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'error' | number[];
export type GestureCallback = (state: GestureState, action: GestureAction) => void;

export class TerminalGestureController {
  private recognizer: GestureRecognizer;
  private gestures: Map<string, GestureDefinition> = new Map();
  private callbacks: Map<string, GestureCallback[]> = new Map();
  private isGestureMode: boolean = false;
  private activeGestures: Set<string> = new Set();
  private hintTimeout: number | null = null;
  private gestureHistory: Array<{ gesture: string; timestamp: number }> = [];

  constructor(element: HTMLElement) {
    this.recognizer = new GestureRecognizer(element);
    this.setupDefaultGestures();
    this.setupRecognizerCallbacks();
  }

  private setupDefaultGestures(): void {
    // Two-finger swipe down - Show keyboard
    this.registerGesture({
      id: 'show-keyboard',
      type: 'swipe',
      fingers: 2,
      direction: 'down',
      action: { type: 'keyboard', payload: { show: true } },
      hapticFeedback: 'light',
      hint: '👆 Swipe down with 2 fingers to show keyboard',
      enabled: true
    });

    // Two-finger swipe up - Hide keyboard
    this.registerGesture({
      id: 'hide-keyboard',
      type: 'swipe',
      fingers: 2,
      direction: 'up',
      action: { type: 'keyboard', payload: { show: false } },
      hapticFeedback: 'light',
      hint: '👆 Swipe up with 2 fingers to hide keyboard',
      enabled: true
    });

    // Pinch in - Decrease font size
    this.registerGesture({
      id: 'zoom-out',
      type: 'pinch',
      fingers: 2,
      action: { type: 'zoom', payload: { direction: 'out' } },
      hapticFeedback: 'light',
      hint: '🤏 Pinch to zoom out',
      enabled: true
    });

    // Pinch out - Increase font size
    this.registerGesture({
      id: 'zoom-in',
      type: 'pinch',
      fingers: 2,
      action: { type: 'zoom', payload: { direction: 'in' } },
      hapticFeedback: 'light',
      hint: '🤏 Pinch to zoom in',
      enabled: true
    });

    // Three-finger tap - Toggle quick actions
    this.registerGesture({
      id: 'quick-actions',
      type: 'multiTouch',
      fingers: 3,
      action: { type: 'menu', payload: { menu: 'quick-actions' } },
      hapticFeedback: 'medium',
      hint: '👆 3-finger tap for quick actions',
      enabled: true
    });

    // Long press - Context menu
    this.registerGesture({
      id: 'context-menu',
      type: 'longPress',
      fingers: 1,
      action: { type: 'menu', payload: { menu: 'context' } },
      hapticFeedback: 'medium',
      hint: '👆 Long press for context menu',
      enabled: true
    });
  }

  private setupRecognizerCallbacks(): void {
    // Tap gestures
    this.recognizer.onTap((state) => {
      const fingers = state.startPoints.length;
      
      if (fingers >= 3) {
        this.handleGesture('quick-actions', state);
      }
    });

    // Swipe gestures
    this.recognizer.onSwipeUp((state) => {
      const fingers = state.startPoints.length;
      
      if (fingers === 2) {
        this.handleGesture('hide-keyboard', state);
      }
    });

    this.recognizer.onSwipeDown((state) => {
      const fingers = state.startPoints.length;
      
      if (fingers === 2) {
        this.handleGesture('show-keyboard', state);
      }
    });

    // Pinch gestures
    this.recognizer.onPinch((state) => {
      if (state.scale > 1.1) {
        this.handleGesture('zoom-in', state);
      } else if (state.scale < 0.9) {
        this.handleGesture('zoom-out', state);
      }
    });

    // Long press
    this.recognizer.onLongPress((state) => {
      if (state.startPoints.length === 1) {
        this.handleGesture('context-menu', state);
      }
    });
  }

  private handleGesture(gestureId: string, state: GestureState): void {
    const gesture = this.gestures.get(gestureId);
    
    if (!gesture || !gesture.enabled) return;

    // Add to active gestures
    this.activeGestures.add(gestureId);

    // Add to history
    this.gestureHistory.push({
      gesture: gestureId,
      timestamp: Date.now()
    });

    // Trim history to last 10 gestures
    if (this.gestureHistory.length > 10) {
      this.gestureHistory.shift();
    }

    // Trigger haptic feedback
    this.triggerHaptic(gesture.hapticFeedback);

    // Trigger callbacks
    const callbacks = this.callbacks.get(gestureId) || [];
    callbacks.forEach(callback => {
      try {
        callback(state, gesture.action);
      } catch (error) {
        console.error(`[TerminalGestureController] Error in callback for ${gestureId}:`, error);
      }
    });

    // Log gesture
    console.log('[TerminalGestureController] Gesture detected:', {
      id: gestureId,
      type: gesture.type,
      fingers: gesture.fingers,
      direction: gesture.direction,
      action: gesture.action
    });

    // Remove from active gestures after a delay
    setTimeout(() => {
      this.activeGestures.delete(gestureId);
    }, 500);
  }

  private triggerHaptic(pattern: HapticPattern): void {
    if (Array.isArray(pattern)) {
      HapticFeedback.custom(pattern);
    } else {
      switch (pattern) {
        case 'light':
          HapticFeedback.light();
          break;
        case 'medium':
          HapticFeedback.medium();
          break;
        case 'heavy':
          HapticFeedback.heavy();
          break;
        case 'success':
          HapticFeedback.success();
          break;
        case 'error':
          HapticFeedback.error();
          break;
      }
    }
  }

  // Public API
  registerGesture(gesture: GestureDefinition): void {
    this.gestures.set(gesture.id, gesture);
    console.log('[TerminalGestureController] Registered gesture:', gesture.id);
  }

  unregisterGesture(gestureId: string): void {
    this.gestures.delete(gestureId);
    this.callbacks.delete(gestureId);
    console.log('[TerminalGestureController] Unregistered gesture:', gestureId);
  }

  enableGesture(gestureId: string): void {
    const gesture = this.gestures.get(gestureId);
    if (gesture) {
      gesture.enabled = true;
    }
  }

  disableGesture(gestureId: string): void {
    const gesture = this.gestures.get(gestureId);
    if (gesture) {
      gesture.enabled = false;
    }
  }

  onGesture(gestureId: string, callback: GestureCallback): () => void {
    if (!this.callbacks.has(gestureId)) {
      this.callbacks.set(gestureId, []);
    }
    
    this.callbacks.get(gestureId)!.push(callback);
    
    return () => {
      const callbacks = this.callbacks.get(gestureId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  enableGestureMode(): void {
    this.isGestureMode = true;
    console.log('[TerminalGestureController] Gesture mode enabled');
  }

  disableGestureMode(): void {
    this.isGestureMode = false;
    console.log('[TerminalGestureController] Gesture mode disabled');
  }

  showGestureHints(duration: number = 3000): void {
    // Clear existing timeout
    if (this.hintTimeout) {
      clearTimeout(this.hintTimeout);
    }

    // Enable gesture mode to show hints
    this.enableGestureMode();

    // Auto-hide after duration
    this.hintTimeout = window.setTimeout(() => {
      this.disableGestureMode();
      this.hintTimeout = null;
    }, duration);
  }

  hideGestureHints(): void {
    if (this.hintTimeout) {
      clearTimeout(this.hintTimeout);
      this.hintTimeout = null;
    }
    this.disableGestureMode();
  }

  getGestureHints(): string[] {
    return Array.from(this.gestures.values())
      .filter(g => g.enabled)
      .map(g => g.hint);
  }

  getActiveGestures(): string[] {
    return Array.from(this.activeGestures);
  }

  getGestureHistory(): Array<{ gesture: string; timestamp: number }> {
    return [...this.gestureHistory];
  }

  isInGestureMode(): boolean {
    return this.isGestureMode;
  }

  getGesture(gestureId: string): GestureDefinition | undefined {
    return this.gestures.get(gestureId);
  }

  getAllGestures(): GestureDefinition[] {
    return Array.from(this.gestures.values());
  }

  destroy(): void {
    if (this.hintTimeout) {
      clearTimeout(this.hintTimeout);
    }
    this.recognizer.destroy();
    this.gestures.clear();
    this.callbacks.clear();
    this.activeGestures.clear();
    this.gestureHistory = [];
  }
}

// Export singleton factory
export const createTerminalGestureController = (element: HTMLElement): TerminalGestureController => {
  return new TerminalGestureController(element);
};
