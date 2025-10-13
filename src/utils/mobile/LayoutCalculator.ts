// LayoutCalculator - Intelligent terminal layout calculation
import type { SafeAreaInsets, ViewportDimensions } from "./ViewportManager";
import type { DeviceCapabilities } from "../mobile";

export interface LayoutOptions {
  includeToolbar: boolean;
  includeQuickAccess: boolean;
  includeStatusBar: boolean;
  minimumHeight: number;
}

export interface UIElementDimensions {
  statusBar: number;
  terminalHeader: number;
  quickAccessToolbar: number;
  bottomNavigation: number;
  searchBar: number;
}

export interface LayoutContext {
  viewportHeight: number;
  viewportWidth: number;
  keyboardHeight: number;
  keyboardVisible: boolean;
  orientation: 'portrait' | 'landscape';
  safeAreaInsets: SafeAreaInsets;
  uiElements: UIElementDimensions;
  deviceCapabilities: DeviceCapabilities;
}

export interface LayoutResult {
  terminalHeight: number;
  terminalWidth: number;
  scrollOffset: number;
  shouldResize: boolean;
  transitionDuration: number;
  debugInfo?: string;
}

export class LayoutCalculator {
  private lastCalculatedHeight: number = 0;
  private resizeThreshold: number = 0.1; // 10% change threshold

  calculate(context: LayoutContext, options: LayoutOptions): LayoutResult {
    const debugSteps: string[] = [];
    
    // Step 1: Start with base viewport height
    let availableHeight = context.viewportHeight;
    debugSteps.push(`1. Base viewport height: ${availableHeight}px`);

    // Step 2: Subtract safe area insets
    const safeAreaReduction = context.safeAreaInsets.top + context.safeAreaInsets.bottom;
    availableHeight -= safeAreaReduction;
    debugSteps.push(`2. After safe area insets (-${safeAreaReduction}px): ${availableHeight}px`);

    // Step 3: Subtract UI chrome heights
    let uiChromeHeight = 0;
    
    if (options.includeStatusBar) {
      uiChromeHeight += context.uiElements.statusBar;
    }
    
    uiChromeHeight += context.uiElements.terminalHeader;
    
    if (options.includeQuickAccess) {
      uiChromeHeight += context.uiElements.quickAccessToolbar;
    }
    
    if (context.deviceCapabilities.isMobile && context.orientation === 'portrait') {
      uiChromeHeight += context.uiElements.bottomNavigation;
    }
    
    if (options.includeToolbar) {
      uiChromeHeight += context.uiElements.searchBar;
    }

    availableHeight -= uiChromeHeight;
    debugSteps.push(`3. After UI chrome (-${uiChromeHeight}px): ${availableHeight}px`);

    // Step 4: Handle keyboard if visible
    if (context.keyboardVisible && context.keyboardHeight > 0) {
      const buffer = 50; // Buffer space above keyboard
      availableHeight -= (context.keyboardHeight + buffer);
      debugSteps.push(`4. After keyboard (-${context.keyboardHeight + buffer}px): ${availableHeight}px`);
    }

    // Step 5: Ensure minimum height
    const finalHeight = Math.max(availableHeight, options.minimumHeight);
    if (finalHeight !== availableHeight) {
      debugSteps.push(`5. Applied minimum height constraint: ${finalHeight}px`);
    } else {
      debugSteps.push(`5. Final height: ${finalHeight}px`);
    }

    // Step 6: Calculate terminal width (account for safe area horizontal insets)
    const terminalWidth = context.viewportWidth - 
                          context.safeAreaInsets.left - 
                          context.safeAreaInsets.right;

    // Step 7: Determine if resize is needed
    const heightChange = Math.abs(finalHeight - this.lastCalculatedHeight);
    const changePercentage = this.lastCalculatedHeight > 0 
      ? heightChange / this.lastCalculatedHeight 
      : 1;
    const shouldResize = changePercentage >= this.resizeThreshold;

    debugSteps.push(`6. Resize needed: ${shouldResize} (change: ${(changePercentage * 100).toFixed(1)}%)`);

    // Step 8: Calculate transition duration based on change magnitude
    const transitionDuration = this.calculateTransitionDuration(heightChange);
    debugSteps.push(`7. Transition duration: ${transitionDuration}ms`);

    // Update last calculated height
    if (shouldResize) {
      this.lastCalculatedHeight = finalHeight;
    }

    return {
      terminalHeight: finalHeight,
      terminalWidth,
      scrollOffset: 0, // Will be calculated by occlusion prevention
      shouldResize,
      transitionDuration,
      debugInfo: debugSteps.join('\n')
    };
  }

  private calculateTransitionDuration(heightChange: number): number {
    // Base duration: 200ms
    // Add 10ms per 100px of change, capped at 400ms
    const baseDuration = 200;
    const additionalDuration = Math.min((heightChange / 100) * 10, 200);
    return Math.round(baseDuration + additionalDuration);
  }

  calculateOptimalRows(terminalHeight: number, fontSize: number, lineHeight: number = 1.2): number {
    const charHeight = fontSize * lineHeight;
    const rows = Math.floor(terminalHeight / charHeight);
    return Math.max(rows, 10); // Minimum 10 rows
  }

  calculateOptimalCols(terminalWidth: number, fontSize: number, charWidth: number = 0.6): number {
    const effectiveCharWidth = fontSize * charWidth;
    const cols = Math.floor(terminalWidth / effectiveCharWidth);
    return Math.max(cols, 40); // Minimum 40 columns
  }

  getDefaultUIElementDimensions(deviceCapabilities: DeviceCapabilities): UIElementDimensions {
    const isMobile = deviceCapabilities.isMobile;
    const isTablet = deviceCapabilities.isTablet;

    return {
      statusBar: 0, // Usually handled by safe area
      terminalHeader: isMobile ? 44 : 48,
      quickAccessToolbar: isMobile ? 48 : 56,
      bottomNavigation: isMobile ? 60 : 0,
      searchBar: 50
    };
  }

  reset(): void {
    this.lastCalculatedHeight = 0;
  }
}

// Export singleton instance
let calculatorInstance: LayoutCalculator | null = null;

export const getLayoutCalculator = (): LayoutCalculator => {
  if (!calculatorInstance) {
    calculatorInstance = new LayoutCalculator();
  }
  return calculatorInstance;
};
