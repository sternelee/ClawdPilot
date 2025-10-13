// AdaptiveLayoutManager - Responsive layout system for terminal
import { getDeviceCapabilities } from "../mobile";
import type { DeviceCapabilities } from "../mobile";

export type ScreenBreakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type Orientation = 'portrait' | 'landscape';

export interface LayoutConfig {
  breakpoint: ScreenBreakpoint;
  orientation: Orientation;
  showBottomNav: boolean;
  terminalLayout: 'single' | 'split';
  uiDensity: 'compact' | 'comfortable' | 'spacious';
  prioritizeVerticalSpace: boolean;
}

export interface LayoutDimensions {
  terminalHeight: number;
  terminalWidth: number;
  headerHeight: number;
  toolbarHeight: number;
  navHeight: number;
  availableHeight: number;
  availableWidth: number;
}

export type LayoutChangeCallback = (config: LayoutConfig) => void;

export class AdaptiveLayoutManager {
  private static instance: AdaptiveLayoutManager | null = null;
  
  private currentBreakpoint: ScreenBreakpoint = 'md';
  private currentOrientation: Orientation = 'portrait';
  private deviceCapabilities: DeviceCapabilities;
  private callbacks: LayoutChangeCallback[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private orientationMediaQuery: MediaQueryList | null = null;

  private constructor() {
    this.deviceCapabilities = getDeviceCapabilities();
    this.detectBreakpoint();
    this.detectOrientation();
  }

  static getInstance(): AdaptiveLayoutManager {
    if (!AdaptiveLayoutManager.instance) {
      AdaptiveLayoutManager.instance = new AdaptiveLayoutManager();
    }
    return AdaptiveLayoutManager.instance;
  }

  initialize(): void {
    this.setupBreakpointDetection();
    this.setupOrientationDetection();
    
    console.log('[AdaptiveLayoutManager] Initialized', {
      breakpoint: this.currentBreakpoint,
      orientation: this.currentOrientation,
      deviceCapabilities: this.deviceCapabilities
    });
  }

  private detectBreakpoint(): void {
    const width = window.innerWidth;
    
    if (width < 475) {
      this.currentBreakpoint = 'xs';
    } else if (width < 640) {
      this.currentBreakpoint = 'sm';
    } else if (width < 768) {
      this.currentBreakpoint = 'md';
    } else if (width < 1024) {
      this.currentBreakpoint = 'lg';
    } else {
      this.currentBreakpoint = 'xl';
    }
  }

  private detectOrientation(): void {
    this.currentOrientation = window.innerWidth > window.innerHeight 
      ? 'landscape' 
      : 'portrait';
  }

  private setupBreakpointDetection(): void {
    // Use ResizeObserver for efficient resize detection
    this.resizeObserver = new ResizeObserver((entries) => {
      const oldBreakpoint = this.currentBreakpoint;
      this.detectBreakpoint();
      
      if (oldBreakpoint !== this.currentBreakpoint) {
        console.log('[AdaptiveLayoutManager] Breakpoint changed:', 
          oldBreakpoint, '->', this.currentBreakpoint);
        this.notifyCallbacks();
      }
    });

    this.resizeObserver.observe(document.documentElement);
  }

  private setupOrientationDetection(): void {
    // Use matchMedia for orientation detection
    this.orientationMediaQuery = window.matchMedia('(orientation: portrait)');
    
    const handleOrientationChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const oldOrientation = this.currentOrientation;
      this.detectOrientation();
      
      if (oldOrientation !== this.currentOrientation) {
        console.log('[AdaptiveLayoutManager] Orientation changed:', 
          oldOrientation, '->', this.currentOrientation);
        this.notifyCallbacks();
      }
    };

    // Modern browsers
    if (this.orientationMediaQuery.addEventListener) {
      this.orientationMediaQuery.addEventListener('change', handleOrientationChange);
    } else {
      // Fallback for older browsers
      this.orientationMediaQuery.addListener(handleOrientationChange);
    }

    // Also listen to window resize as fallback
    window.addEventListener('resize', () => {
      const oldOrientation = this.currentOrientation;
      this.detectOrientation();
      
      if (oldOrientation !== this.currentOrientation) {
        this.notifyCallbacks();
      }
    });
  }

  getLayoutConfig(): LayoutConfig {
    const isMobile = this.deviceCapabilities.isMobile;
    const isTablet = this.deviceCapabilities.isTablet;
    const breakpoint = this.currentBreakpoint;
    const orientation = this.currentOrientation;

    // Determine if bottom navigation should be shown
    const showBottomNav = isMobile && orientation === 'portrait' && 
                          (breakpoint === 'xs' || breakpoint === 'sm');

    // Determine terminal layout
    const terminalLayout: 'single' | 'split' = 
      (isTablet || breakpoint === 'lg' || breakpoint === 'xl') && orientation === 'landscape'
        ? 'split'
        : 'single';

    // Determine UI density
    let uiDensity: 'compact' | 'comfortable' | 'spacious';
    if (breakpoint === 'xs') {
      uiDensity = 'compact';
    } else if (breakpoint === 'sm' || breakpoint === 'md') {
      uiDensity = 'comfortable';
    } else {
      uiDensity = 'spacious';
    }

    // Prioritize vertical space in portrait mode on mobile
    const prioritizeVerticalSpace = isMobile && orientation === 'portrait';

    return {
      breakpoint,
      orientation,
      showBottomNav,
      terminalLayout,
      uiDensity,
      prioritizeVerticalSpace
    };
  }

  calculateLayoutDimensions(config: LayoutConfig): LayoutDimensions {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Base dimensions based on UI density
    let headerHeight: number;
    let toolbarHeight: number;
    let navHeight: number;

    switch (config.uiDensity) {
      case 'compact':
        headerHeight = 44;
        toolbarHeight = 48;
        navHeight = config.showBottomNav ? 60 : 0;
        break;
      case 'comfortable':
        headerHeight = 48;
        toolbarHeight = 56;
        navHeight = config.showBottomNav ? 64 : 0;
        break;
      case 'spacious':
        headerHeight = 56;
        toolbarHeight = 64;
        navHeight = 0; // No bottom nav in spacious mode
        break;
    }

    // Calculate available space
    const availableHeight = viewportHeight - headerHeight - toolbarHeight - navHeight;
    const availableWidth = viewportWidth;

    // Terminal dimensions
    let terminalHeight = availableHeight;
    let terminalWidth = availableWidth;

    // Adjust for split layout
    if (config.terminalLayout === 'split') {
      terminalWidth = Math.floor(availableWidth / 2);
    }

    return {
      terminalHeight,
      terminalWidth,
      headerHeight,
      toolbarHeight,
      navHeight,
      availableHeight,
      availableWidth
    };
  }

  getBreakpoint(): ScreenBreakpoint {
    return this.currentBreakpoint;
  }

  getOrientation(): Orientation {
    return this.currentOrientation;
  }

  isPortrait(): boolean {
    return this.currentOrientation === 'portrait';
  }

  isLandscape(): boolean {
    return this.currentOrientation === 'landscape';
  }

  isMobileSize(): boolean {
    return this.currentBreakpoint === 'xs' || this.currentBreakpoint === 'sm';
  }

  isTabletSize(): boolean {
    return this.currentBreakpoint === 'md' || this.currentBreakpoint === 'lg';
  }

  isDesktopSize(): boolean {
    return this.currentBreakpoint === 'xl';
  }

  shouldShowBottomNav(): boolean {
    return this.getLayoutConfig().showBottomNav;
  }

  shouldPrioritizeVerticalSpace(): boolean {
    return this.getLayoutConfig().prioritizeVerticalSpace;
  }

  getOptimalFontSize(): number {
    const config = this.getLayoutConfig();
    
    switch (config.breakpoint) {
      case 'xs':
        return 12;
      case 'sm':
        return 13;
      case 'md':
        return 14;
      case 'lg':
        return 15;
      case 'xl':
        return 16;
      default:
        return 14;
    }
  }

  getOptimalTerminalCols(): number {
    const config = this.getLayoutConfig();
    const dimensions = this.calculateLayoutDimensions(config);
    
    // Estimate based on width and font size
    const fontSize = this.getOptimalFontSize();
    const charWidth = fontSize * 0.6; // Approximate monospace char width
    
    return Math.floor(dimensions.terminalWidth / charWidth);
  }

  getOptimalTerminalRows(): number {
    const config = this.getLayoutConfig();
    const dimensions = this.calculateLayoutDimensions(config);
    
    // Estimate based on height and font size
    const fontSize = this.getOptimalFontSize();
    const lineHeight = fontSize * 1.2;
    
    return Math.floor(dimensions.terminalHeight / lineHeight);
  }

  onLayoutChange(callback: LayoutChangeCallback): () => void {
    this.callbacks.push(callback);
    
    // Immediately call with current config
    callback(this.getLayoutConfig());
    
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  private notifyCallbacks(): void {
    const config = this.getLayoutConfig();
    this.callbacks.forEach(callback => {
      try {
        callback(config);
      } catch (error) {
        console.error('[AdaptiveLayoutManager] Error in callback:', error);
      }
    });
  }

  applyLayoutClasses(): void {
    const config = this.getLayoutConfig();
    const root = document.documentElement;

    // Remove all layout classes
    root.classList.remove('layout-xs', 'layout-sm', 'layout-md', 'layout-lg', 'layout-xl');
    root.classList.remove('layout-portrait', 'layout-landscape');
    root.classList.remove('layout-compact', 'layout-comfortable', 'layout-spacious');
    root.classList.remove('layout-single', 'layout-split');
    root.classList.remove('show-bottom-nav', 'prioritize-vertical');

    // Add current layout classes
    root.classList.add(`layout-${config.breakpoint}`);
    root.classList.add(`layout-${config.orientation}`);
    root.classList.add(`layout-${config.uiDensity}`);
    root.classList.add(`layout-${config.terminalLayout}`);
    
    if (config.showBottomNav) {
      root.classList.add('show-bottom-nav');
    }
    
    if (config.prioritizeVerticalSpace) {
      root.classList.add('prioritize-vertical');
    }

    console.log('[AdaptiveLayoutManager] Applied layout classes:', {
      breakpoint: config.breakpoint,
      orientation: config.orientation,
      density: config.uiDensity,
      layout: config.terminalLayout
    });
  }

  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.orientationMediaQuery) {
      if (this.orientationMediaQuery.removeEventListener) {
        this.orientationMediaQuery.removeEventListener('change', () => {});
      } else {
        this.orientationMediaQuery.removeListener(() => {});
      }
      this.orientationMediaQuery = null;
    }

    this.callbacks = [];
    AdaptiveLayoutManager.instance = null;
  }
}

// Export singleton instance getter
export const getAdaptiveLayoutManager = () => AdaptiveLayoutManager.getInstance();
