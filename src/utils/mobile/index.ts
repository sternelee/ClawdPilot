// Mobile utilities index - centralized exports
export { ViewportManager, getViewportManager } from './ViewportManager';
export type { 
  SafeAreaInsets, 
  ViewportDimensions, 
  CursorPosition, 
  ViewportChangeCallback, 
  UnsubscribeFn 
} from './ViewportManager';

export { LayoutCalculator, getLayoutCalculator } from './LayoutCalculator';
export type { 
  LayoutOptions, 
  UIElementDimensions, 
  LayoutContext, 
  LayoutResult 
} from './LayoutCalculator';

export { OcclusionPrevention, getOcclusionPrevention } from './OcclusionPrevention';
export type {
  OcclusionStatus,
  ScrollAdjustment,
  ScrollBehavior,
  OcclusionCallback,
  ScrollAdjustmentCallback
} from './OcclusionPrevention';

export { TerminalGestureController, createTerminalGestureController } from './TerminalGestureController';
export type {
  GestureDefinition,
  GestureAction,
  HapticPattern,
  GestureCallback
} from './TerminalGestureController';

export { AdaptiveLayoutManager, getAdaptiveLayoutManager } from './AdaptiveLayoutManager';
export type {
  ScreenBreakpoint,
  Orientation,
  LayoutConfig,
  LayoutDimensions,
  LayoutChangeCallback
} from './AdaptiveLayoutManager';

// Re-export from parent mobile.ts for convenience
export {
  getDeviceCapabilities,
  HapticFeedback,
  GestureRecognizer,
  MobileKeyboard,
  KeyboardManager,
  InputFocusManager,
  MobilePerformance,
  ScreenOrientation,
  initializeMobileUtils
} from '../mobile';

export type {
  DeviceCapabilities,
  KeyboardInfo,
  FixedElementConfig,
  TouchPoint,
  GestureState
} from '../mobile';
