# Mobile Utilities - Enhanced Viewport and Keyboard Management

This directory contains enhanced mobile utilities for managing viewport dimensions, keyboard state, and layout calculations in the RiTerm mobile terminal application.

## Components

### OcclusionPrevention

Intelligent keyboard occlusion prevention system that ensures input elements remain visible.

**Features:**
- Automatic occlusion detection
- Smart scroll adjustment with configurable buffer
- Cursor position tracking
- Full-screen app support (vim, nano, etc.)
- Element tracking for continuous monitoring
- Configurable scroll behavior

**Usage:**

```typescript
import { getOcclusionPrevention } from './utils/mobile/OcclusionPrevention';

// Get singleton instance
const occlusionPrevention = getOcclusionPrevention();

// Configure buffer space (default: 50px)
occlusionPrevention.setBufferSpace(50);

// Configure scroll behavior (default: 'smooth')
occlusionPrevention.setScrollBehavior('smooth'); // or 'instant' or 'auto'

// Track an element for occlusion
const untrack = occlusionPrevention.trackElement(inputElement);

// Check if element is occluded
const status = occlusionPrevention.checkOcclusion(inputElement);
console.log('Is occluded:', status.isOccluded);
console.log('Occluded amount:', status.occludedAmount);
console.log('Recommended scroll:', status.recommendedScroll);

// Prevent occlusion (automatically scrolls if needed)
occlusionPrevention.preventOcclusion(inputElement);

// Update cursor position for tracking
occlusionPrevention.updateCursorPosition(terminalElement, cursorY);

// Ensure cursor is visible
occlusionPrevention.ensureCursorVisible();

// Handle full-screen terminal apps
const adjustedRows = occlusionPrevention.handleFullScreenApp(terminalElement, currentRows);

// Subscribe to occlusion events
const unsubscribeOcclusion = occlusionPrevention.onOcclusionDetected((status) => {
  console.log('Occlusion detected:', status);
});

// Subscribe to scroll adjustments
const unsubscribeScroll = occlusionPrevention.onScrollAdjusted((adjustment) => {
  console.log('Scroll adjusted:', adjustment);
});

// Manually adjust scroll
occlusionPrevention.adjustScroll({
  deltaY: 100,
  behavior: 'smooth',
  reason: 'manual'
});

// Monitor all tracked elements
occlusionPrevention.monitorTrackedElements();

// Reset state
occlusionPrevention.reset();

// Cleanup
untrack();
unsubscribeOcclusion();
unsubscribeScroll();
```

### ViewportManager

Centralized viewport and keyboard state management with safe area support.

**Features:**
- Real-time viewport dimension tracking
- Keyboard height detection and management
- Safe area inset detection (notches, dynamic island)
- Orientation change handling
- Element visibility checking
- Automatic scroll adjustment

**Usage:**

```typescript
import { getViewportManager } from './utils/mobile/ViewportManager';

// Get singleton instance
const viewportManager = getViewportManager();

// Initialize (call once at app startup)
viewportManager.initialize();

// Subscribe to viewport changes
const unsubscribe = viewportManager.onViewportChange((dimensions) => {
  console.log('Viewport changed:', dimensions);
  // dimensions: { width, height, effectiveHeight, keyboardHeight }
});

// Update keyboard state (usually called by MobileKeyboard)
viewportManager.updateKeyboardState(keyboardInfo);

// Check if element is visible
const isVisible = viewportManager.isInputVisible(element);

// Ensure element is visible (with buffer)
viewportManager.ensureElementVisible(element, 50);

// Scroll to cursor position
viewportManager.scrollToCursor({ row: 10, col: 5, absoluteY: 500 });

// Get current state
const dimensions = viewportManager.getAvailableSpace();
const safeAreas = viewportManager.getSafeAreaInsets();
const orientation = viewportManager.getOrientation();
const keyboardHeight = viewportManager.getKeyboardHeight();

// Cleanup
unsubscribe();
```

### LayoutCalculator

Intelligent terminal layout calculation based on viewport, keyboard, and UI elements.

**Features:**
- Multi-factor layout calculation
- Safe area and UI chrome accounting
- Keyboard occlusion prevention
- Resize threshold detection
- Adaptive transition durations
- Debug information output

**Usage:**

```typescript
import { getLayoutCalculator } from './utils/mobile/LayoutCalculator';
import { getDeviceCapabilities } from './utils/mobile';

const calculator = getLayoutCalculator();
const deviceCapabilities = getDeviceCapabilities();

// Get default UI element dimensions
const uiElements = calculator.getDefaultUIElementDimensions(deviceCapabilities);

// Create layout context
const context = {
  viewportHeight: window.innerHeight,
  viewportWidth: window.innerWidth,
  keyboardHeight: 300,
  keyboardVisible: true,
  orientation: 'portrait',
  safeAreaInsets: { top: 44, right: 0, bottom: 34, left: 0 },
  uiElements,
  deviceCapabilities
};

// Define layout options
const options = {
  includeToolbar: true,
  includeQuickAccess: true,
  includeStatusBar: false,
  minimumHeight: 200
};

// Calculate layout
const result = calculator.calculate(context, options);

console.log('Terminal height:', result.terminalHeight);
console.log('Should resize:', result.shouldResize);
console.log('Transition duration:', result.transitionDuration);
console.log('Debug info:', result.debugInfo);

// Calculate optimal terminal dimensions
const rows = calculator.calculateOptimalRows(result.terminalHeight, 14);
const cols = calculator.calculateOptimalCols(result.terminalWidth, 14);

// Reset calculator state
calculator.reset();
```

## Integration with Existing Code

### App.tsx Integration

```typescript
import { getViewportManager } from "./utils/mobile/ViewportManager";
import { getLayoutCalculator } from "./utils/mobile/LayoutCalculator";

function App() {
  const [terminalDimensions, setTerminalDimensions] = createSignal({
    height: 0,
    width: 0
  });

  onMount(() => {
    const viewportManager = getViewportManager();
    const calculator = getLayoutCalculator();
    
    // Subscribe to viewport changes
    const unsubscribe = viewportManager.onViewportChange((dimensions) => {
      const deviceCapabilities = getDeviceCapabilities();
      const uiElements = calculator.getDefaultUIElementDimensions(deviceCapabilities);
      
      const context = {
        viewportHeight: dimensions.height,
        viewportWidth: dimensions.width,
        keyboardHeight: dimensions.keyboardHeight,
        keyboardVisible: dimensions.keyboardHeight > 0,
        orientation: viewportManager.getOrientation(),
        safeAreaInsets: viewportManager.getSafeAreaInsets(),
        uiElements,
        deviceCapabilities
      };
      
      const options = {
        includeToolbar: true,
        includeQuickAccess: true,
        includeStatusBar: false,
        minimumHeight: 200
      };
      
      const result = calculator.calculate(context, options);
      
      if (result.shouldResize) {
        setTerminalDimensions({
          height: result.terminalHeight,
          width: result.terminalWidth
        });
      }
    });
    
    onCleanup(() => unsubscribe());
  });
  
  return (
    <div style={{ height: `${terminalDimensions().height}px` }}>
      {/* Terminal content */}
    </div>
  );
}
```

### MobileKeyboard Integration

The `MobileKeyboard` class now integrates with `ViewportManager` automatically when initialized with the `integrateViewportManager` option:

```typescript
// In main.tsx
import { initializeMobileUtils } from "./utils/mobile";
import { getViewportManager } from "./utils/mobile/ViewportManager";

// Initialize with ViewportManager integration
initializeMobileUtils({ integrateViewportManager: true });

// Initialize ViewportManager
const viewportManager = getViewportManager();
viewportManager.initialize();
```

## Architecture

```
OcclusionPrevention (Singleton)
├── Detects element occlusion
├── Calculates scroll adjustments
├── Tracks cursor position
├── Monitors tracked elements
├── Handles full-screen apps
└── Notifies subscribers

ViewportManager (Singleton)
├── Tracks viewport dimensions
├── Monitors keyboard state
├── Detects safe area insets
├── Handles orientation changes
└── Notifies subscribers

LayoutCalculator (Singleton)
├── Calculates terminal dimensions
├── Accounts for UI chrome
├── Handles keyboard occlusion
├── Determines resize necessity
└── Provides debug information

MobileKeyboard (Static Class)
├── Detects keyboard visibility
├── Calculates keyboard height
├── Tracks active input
├── Adjusts scroll position
└── Integrates with ViewportManager
```

## Best Practices

1. **Initialize Once**: Call `viewportManager.initialize()` once at app startup
2. **Subscribe Early**: Set up viewport change subscriptions in `onMount()`
3. **Clean Up**: Always call unsubscribe functions in `onCleanup()`
4. **Use Singleton Getters**: Use `getViewportManager()` and `getLayoutCalculator()` instead of creating new instances
5. **Check Resize Flag**: Only resize terminal when `result.shouldResize` is true to avoid unnecessary reflows
6. **Respect Minimum Heights**: Always enforce minimum height constraints for usability
7. **Debug Mode**: Enable debug info in development to troubleshoot layout issues

## Performance Considerations

- **Debouncing**: Viewport changes are debounced to prevent excessive calculations
- **Resize Threshold**: 10% change threshold prevents minor adjustments
- **Transition Duration**: Adaptive durations based on change magnitude
- **Singleton Pattern**: Reduces memory overhead and ensures consistent state
- **Lazy Calculation**: Layout is only recalculated when viewport changes

## Browser Compatibility

- **Visual Viewport API**: Preferred method (Chrome 61+, Safari 13+, Firefox 91+)
- **Fallback**: Window resize events for older browsers
- **Safe Area Insets**: CSS env() variables (iOS 11+, Android with notch support)
- **Orientation API**: Standard orientation events (all modern browsers)

## Troubleshooting

### Keyboard not detected
- Check if Visual Viewport API is supported
- Verify threshold values (120px for mobile, 150px for desktop)
- Enable debug logging to see detection method

### Layout calculations incorrect
- Verify UI element dimensions are accurate
- Check safe area inset values
- Review debug info output from calculator

### Terminal not resizing
- Ensure `shouldResize` flag is checked
- Verify resize threshold (10% default)
- Check if minimum height constraint is blocking resize

### Scroll adjustment not working
- Confirm element is tracked by InputFocusManager
- Verify buffer space (50px default)
- Check if keyboard is actually visible

## Future Enhancements

- [ ] Predictive keyboard height based on device model
- [ ] Machine learning for optimal layout preferences
- [ ] Multi-window support for tablets
- [ ] Custom gesture integration
- [ ] Performance profiling and optimization
