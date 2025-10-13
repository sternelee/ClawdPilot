// ViewportManager - Centralized viewport and keyboard state management
import { getDeviceCapabilities } from "../mobile";
import type { KeyboardInfo, DeviceCapabilities } from "../mobile";

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ViewportDimensions {
  width: number;
  height: number;
  effectiveHeight: number;
  keyboardHeight: number;
}

export interface CursorPosition {
  row: number;
  col: number;
  absoluteY: number;
}

export type ViewportChangeCallback = (dimensions: ViewportDimensions) => void;
export type UnsubscribeFn = () => void;

export class ViewportManager {
  private static instance: ViewportManager | null = null;
  
  private keyboardHeight: number = 0;
  private effectiveViewportHeight: number = window.innerHeight;
  private safeAreaInsets: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  private orientation: 'portrait' | 'landscape' = 'portrait';
  private deviceCapabilities: DeviceCapabilities;
  private callbacks: ViewportChangeCallback[] = [];
  private isInitialized: boolean = false;

  private constructor() {
    this.deviceCapabilities = getDeviceCapabilities();
    this.detectOrientation();
    this.detectSafeAreaInsets();
  }

  static getInstance(): ViewportManager {
    if (!ViewportManager.instance) {
      ViewportManager.instance = new ViewportManager();
    }
    return ViewportManager.instance;
  }

  initialize(): void {
    if (this.isInitialized) return;

    this.detectOrientation();
    this.detectSafeAreaInsets();
    this.setupOrientationListener();
    
    this.isInitialized = true;
    console.log('[ViewportManager] Initialized', {
      orientation: this.orientation,
      safeAreaInsets: this.safeAreaInsets,
      deviceCapabilities: this.deviceCapabilities
    });
  }

  private detectOrientation(): void {
    this.orientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
  }

  private detectSafeAreaInsets(): void {
    // Try to get safe area insets from CSS environment variables
    const computedStyle = getComputedStyle(document.documentElement);
    
    const parseInset = (value: string): number => {
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? 0 : parsed;
    };

    this.safeAreaInsets = {
      top: parseInset(computedStyle.getPropertyValue('--safe-area-inset-top')) || 
           parseInset(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)')),
      right: parseInset(computedStyle.getPropertyValue('--safe-area-inset-right')) ||
             parseInset(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-right)')),
      bottom: parseInset(computedStyle.getPropertyValue('--safe-area-inset-bottom')) ||
              parseInset(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)')),
      left: parseInset(computedStyle.getPropertyValue('--safe-area-inset-left')) ||
            parseInset(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-left)'))
    };
  }

  private setupOrientationListener(): void {
    const handleOrientationChange = () => {
      const oldOrientation = this.orientation;
      this.detectOrientation();
      this.detectSafeAreaInsets();
      
      if (oldOrientation !== this.orientation) {
        console.log('[ViewportManager] Orientation changed:', this.orientation);
        this.notifyCallbacks();
      }
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
  }

  updateKeyboardState(keyboardInfo: KeyboardInfo): void {
    const oldHeight = this.keyboardHeight;
    this.keyboardHeight = keyboardInfo.height;
    this.effectiveViewportHeight = keyboardInfo.viewportHeight - (keyboardInfo.viewportOffsetTop || 0);

    if (oldHeight !== this.keyboardHeight) {
      console.log('[ViewportManager] Keyboard state updated:', {
        height: this.keyboardHeight,
        effectiveHeight: this.effectiveViewportHeight
      });
      this.notifyCallbacks();
    }
  }

  getAvailableSpace(): ViewportDimensions {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      effectiveHeight: this.effectiveViewportHeight,
      keyboardHeight: this.keyboardHeight
    };
  }

  getSafeAreaInsets(): SafeAreaInsets {
    return { ...this.safeAreaInsets };
  }

  getOrientation(): 'portrait' | 'landscape' {
    return this.orientation;
  }

  getKeyboardHeight(): number {
    return this.keyboardHeight;
  }

  getEffectiveViewportHeight(): number {
    return this.effectiveViewportHeight;
  }

  isKeyboardVisible(): boolean {
    return this.keyboardHeight > 0;
  }

  isInputVisible(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const viewportOffsetTop = window.visualViewport?.offsetTop || 0;
    
    const visibleTop = viewportOffsetTop;
    const visibleBottom = viewportOffsetTop + viewportHeight;
    
    return rect.top >= visibleTop && rect.bottom <= visibleBottom;
  }

  ensureElementVisible(element: HTMLElement, buffer: number = 50): void {
    if (this.isInputVisible(element)) return;

    const rect = element.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const viewportOffsetTop = window.visualViewport?.offsetTop || 0;
    
    const visibleBottom = viewportOffsetTop + viewportHeight;
    
    if (rect.bottom > visibleBottom - buffer) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
        inline: 'nearest'
      });
      
      setTimeout(() => {
        const newRect = element.getBoundingClientRect();
        const overflow = (newRect.bottom - viewportOffsetTop) - (visibleBottom - buffer);
        if (overflow > 0) {
          window.scrollBy({
            top: overflow,
            behavior: 'smooth'
          });
        }
      }, 250);
    }
  }

  scrollToCursor(cursorPosition: CursorPosition): void {
    if (!this.isKeyboardVisible()) return;

    const buffer = 50;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const viewportOffsetTop = window.visualViewport?.offsetTop || 0;
    const visibleBottom = viewportOffsetTop + viewportHeight;

    if (cursorPosition.absoluteY > visibleBottom - buffer) {
      const scrollAmount = cursorPosition.absoluteY - (visibleBottom - buffer);
      window.scrollBy({
        top: scrollAmount,
        behavior: 'smooth'
      });
    }
  }

  onViewportChange(callback: ViewportChangeCallback): UnsubscribeFn {
    this.callbacks.push(callback);
    
    // Immediately call with current state
    callback(this.getAvailableSpace());
    
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  private notifyCallbacks(): void {
    const dimensions = this.getAvailableSpace();
    this.callbacks.forEach(callback => callback(dimensions));
  }

  destroy(): void {
    this.callbacks = [];
    this.isInitialized = false;
    ViewportManager.instance = null;
  }
}

// Export singleton instance getter
export const getViewportManager = () => ViewportManager.getInstance();
