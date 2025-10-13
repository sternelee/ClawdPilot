// OcclusionPrevention - Intelligent keyboard occlusion prevention system
import { getViewportManager } from "./ViewportManager";

export interface OcclusionStatus {
  isOccluded: boolean;
  occludedAmount: number;
  elementRect: DOMRect;
  visibleRect: DOMRect;
  recommendedScroll: number;
}

export interface ScrollAdjustment {
  deltaY: number;
  behavior: ScrollBehavior;
  reason: 'keyboard' | 'cursor' | 'input' | 'manual';
}

export type ScrollBehavior = 'smooth' | 'instant' | 'auto';
export type OcclusionCallback = (status: OcclusionStatus) => void;
export type ScrollAdjustmentCallback = (adjustment: ScrollAdjustment) => void;

export class OcclusionPrevention {
  private static instance: OcclusionPrevention | null = null;
  
  private bufferSpace: number = 50; // Default 50px buffer
  private scrollBehavior: ScrollBehavior = 'smooth';
  private occlusionCallbacks: OcclusionCallback[] = [];
  private scrollAdjustmentCallbacks: ScrollAdjustmentCallback[] = [];
  private trackedElements: Set<HTMLElement> = new Set();
  private cursorPosition: { element: HTMLElement; y: number } | null = null;
  private isAdjusting: boolean = false;

  private constructor() {}

  static getInstance(): OcclusionPrevention {
    if (!OcclusionPrevention.instance) {
      OcclusionPrevention.instance = new OcclusionPrevention();
    }
    return OcclusionPrevention.instance;
  }

  setBufferSpace(buffer: number): void {
    this.bufferSpace = Math.max(0, buffer);
  }

  setScrollBehavior(behavior: ScrollBehavior): void {
    this.scrollBehavior = behavior;
  }

  trackElement(element: HTMLElement): () => void {
    this.trackedElements.add(element);
    
    return () => {
      this.trackedElements.delete(element);
    };
  }

  updateCursorPosition(element: HTMLElement, y: number): void {
    this.cursorPosition = { element, y };
    
    // Check if cursor is occluded and adjust if needed
    if (this.isElementOccluded(element)) {
      this.preventOcclusion(element);
    }
  }

  checkOcclusion(element: HTMLElement): OcclusionStatus {
    const viewportManager = getViewportManager();
    const rect = element.getBoundingClientRect();
    
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const viewportOffsetTop = window.visualViewport?.offsetTop || 0;
    const keyboardHeight = viewportManager.getKeyboardHeight();
    
    // Calculate visible area
    const visibleTop = viewportOffsetTop;
    const visibleBottom = viewportOffsetTop + viewportHeight;
    
    // Calculate if element is occluded by keyboard
    const elementBottom = rect.bottom;
    const occlusionThreshold = visibleBottom - this.bufferSpace;
    
    const isOccluded = elementBottom > occlusionThreshold;
    const occludedAmount = isOccluded ? elementBottom - occlusionThreshold : 0;
    
    // Calculate recommended scroll
    const recommendedScroll = isOccluded ? occludedAmount : 0;
    
    const visibleRect = new DOMRect(
      rect.x,
      Math.max(rect.y, visibleTop),
      rect.width,
      Math.min(rect.bottom, visibleBottom) - Math.max(rect.y, visibleTop)
    );
    
    return {
      isOccluded,
      occludedAmount,
      elementRect: rect,
      visibleRect,
      recommendedScroll
    };
  }

  private isElementOccluded(element: HTMLElement): boolean {
    const status = this.checkOcclusion(element);
    return status.isOccluded;
  }

  preventOcclusion(element: HTMLElement): void {
    if (this.isAdjusting) return; // Prevent recursive adjustments
    
    const status = this.checkOcclusion(element);
    
    if (status.isOccluded) {
      this.isAdjusting = true;
      
      // Notify occlusion detected
      this.notifyOcclusionCallbacks(status);
      
      // Perform scroll adjustment
      this.adjustScroll({
        deltaY: status.recommendedScroll,
        behavior: this.scrollBehavior,
        reason: 'keyboard'
      });
      
      // Reset adjusting flag after animation completes
      setTimeout(() => {
        this.isAdjusting = false;
      }, this.scrollBehavior === 'smooth' ? 300 : 0);
    }
  }

  adjustScroll(adjustment: ScrollAdjustment): void {
    if (adjustment.deltaY === 0) return;
    
    const scrollOptions: ScrollToOptions = {
      top: window.scrollY + adjustment.deltaY,
      behavior: adjustment.behavior === 'auto' ? 'smooth' : adjustment.behavior
    };
    
    window.scrollTo(scrollOptions);
    
    // Notify scroll adjustment
    this.notifyScrollAdjustmentCallbacks(adjustment);
    
    console.log('[OcclusionPrevention] Scroll adjusted:', {
      deltaY: adjustment.deltaY,
      behavior: adjustment.behavior,
      reason: adjustment.reason,
      newScrollY: window.scrollY + adjustment.deltaY
    });
  }

  ensureCursorVisible(): void {
    if (!this.cursorPosition) return;
    
    const { element, y } = this.cursorPosition;
    const viewportManager = getViewportManager();
    
    if (!viewportManager.isKeyboardVisible()) return;
    
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const viewportOffsetTop = window.visualViewport?.offsetTop || 0;
    const visibleBottom = viewportOffsetTop + viewportHeight;
    
    const cursorAbsoluteY = element.getBoundingClientRect().top + y;
    
    if (cursorAbsoluteY > visibleBottom - this.bufferSpace) {
      const scrollAmount = cursorAbsoluteY - (visibleBottom - this.bufferSpace);
      
      this.adjustScroll({
        deltaY: scrollAmount,
        behavior: this.scrollBehavior,
        reason: 'cursor'
      });
    }
  }

  handleFullScreenApp(terminalElement: HTMLElement, rows: number): number {
    // For full-screen terminal apps (vim, nano, etc.), calculate optimal rows
    const viewportManager = getViewportManager();
    
    if (!viewportManager.isKeyboardVisible()) {
      return rows; // No adjustment needed
    }
    
    const availableHeight = viewportManager.getEffectiveViewportHeight();
    const terminalRect = terminalElement.getBoundingClientRect();
    const terminalTop = terminalRect.top;
    
    // Calculate available height for terminal content
    const contentHeight = availableHeight - terminalTop - this.bufferSpace;
    
    // Estimate row height (approximate)
    const currentRowHeight = terminalRect.height / rows;
    
    // Calculate new row count
    const newRows = Math.floor(contentHeight / currentRowHeight);
    
    console.log('[OcclusionPrevention] Full-screen app adjustment:', {
      originalRows: rows,
      newRows,
      availableHeight,
      contentHeight
    });
    
    return Math.max(newRows, 10); // Minimum 10 rows
  }

  monitorTrackedElements(): void {
    // Periodically check all tracked elements for occlusion
    this.trackedElements.forEach(element => {
      if (this.isElementOccluded(element)) {
        this.preventOcclusion(element);
      }
    });
  }

  onOcclusionDetected(callback: OcclusionCallback): () => void {
    this.occlusionCallbacks.push(callback);
    
    return () => {
      const index = this.occlusionCallbacks.indexOf(callback);
      if (index > -1) {
        this.occlusionCallbacks.splice(index, 1);
      }
    };
  }

  onScrollAdjusted(callback: ScrollAdjustmentCallback): () => void {
    this.scrollAdjustmentCallbacks.push(callback);
    
    return () => {
      const index = this.scrollAdjustmentCallbacks.indexOf(callback);
      if (index > -1) {
        this.scrollAdjustmentCallbacks.splice(index, 1);
      }
    };
  }

  private notifyOcclusionCallbacks(status: OcclusionStatus): void {
    this.occlusionCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('[OcclusionPrevention] Error in occlusion callback:', error);
      }
    });
  }

  private notifyScrollAdjustmentCallbacks(adjustment: ScrollAdjustment): void {
    this.scrollAdjustmentCallbacks.forEach(callback => {
      try {
        callback(adjustment);
      } catch (error) {
        console.error('[OcclusionPrevention] Error in scroll adjustment callback:', error);
      }
    });
  }

  reset(): void {
    this.trackedElements.clear();
    this.cursorPosition = null;
    this.isAdjusting = false;
  }

  destroy(): void {
    this.reset();
    this.occlusionCallbacks = [];
    this.scrollAdjustmentCallbacks = [];
    OcclusionPrevention.instance = null;
  }
}

// Export singleton instance getter
export const getOcclusionPrevention = () => OcclusionPrevention.getInstance();
