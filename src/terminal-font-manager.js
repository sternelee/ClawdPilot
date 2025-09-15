/**
 * Terminal Font Manager
 * Handles Nerd Font detection, fallback, and character rendering issues
 */
class TerminalFontManager {
  constructor() {
    this.detectedFonts = new Set();
    this.fallbackChars = new Map();
    this.isNerdFontSupported = false;

    this.init();
  }

  /**
   * Initialize font detection and setup
   */
  async init() {
    await this.detectAvailableFonts();
    this.setupFontFallbacks();
    this.checkNerdFontSupport();
  }

  /**
   * Detect which fonts are available in the browser
   */
  async detectAvailableFonts() {
    const testFonts = [
      'FiraCode Nerd Font',
      'CascadiaCode Nerd Font',
      'JetBrainsMono Nerd Font',
      'RobotoMono Nerd Font',
      'SourceCodePro Nerd Font',
      'Fira Code',
      'Cascadia Code',
      'JetBrains Mono',
      'SF Mono',
      'Monaco',
      'Consolas'
    ];

    for (const font of testFonts) {
      if (await this.isFontAvailable(font)) {
        this.detectedFonts.add(font);
      }
    }

    console.log('Available fonts:', Array.from(this.detectedFonts));
  }

  /**
   * Check if a specific font is available
   */
  async isFontAvailable(fontName) {
    if (!document.fonts || !document.fonts.check) {
      return this.fallbackFontCheck(fontName);
    }

    try {
      return await document.fonts.check(`12px "${fontName}"`);
    } catch (e) {
      return this.fallbackFontCheck(fontName);
    }
  }

  /**
   * Fallback font detection method
   */
  fallbackFontCheck(fontName) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    // Test with a character that should look different
    const testChar = 'W';
    const fallbackFont = 'monospace';

    context.font = `12px ${fallbackFont}`;
    const fallbackWidth = context.measureText(testChar).width;

    context.font = `12px "${fontName}", ${fallbackFont}`;
    const testWidth = context.measureText(testChar).width;

    return Math.abs(testWidth - fallbackWidth) > 0.1;
  }

  /**
   * Check if Nerd Font characters are supported
   */
  checkNerdFontSupport() {
    const testChars = [
      '\uE0A0', // Git branch symbol
      '\uF015', // Home icon
      '\uF07C', // Folder icon
      '\uE725', // File icon
      '\uF419'  // Terminal icon
    ];

    this.isNerdFontSupported = testChars.every(char =>
      this.canRenderCharacter(char)
    );

    console.log('Nerd Font support:', this.isNerdFontSupported);
  }

  /**
   * Check if a character can be rendered properly
   */
  canRenderCharacter(char) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = 20;
    canvas.height = 20;

    ctx.font = '14px "FiraCode Nerd Font", monospace';
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 20, 20);
    ctx.fillStyle = 'white';
    ctx.fillText(char, 2, 14);

    // Check if pixels were drawn (not just empty)
    const imageData = ctx.getImageData(0, 0, 20, 20);
    const pixels = imageData.data;

    let hasPixels = false;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 0 || pixels[i + 1] > 0 || pixels[i + 2] > 0) {
        hasPixels = true;
        break;
      }
    }

    return hasPixels;
  }

  /**
   * Setup character fallbacks for unsupported characters
   */
  setupFontFallbacks() {
    // Common Nerd Font character fallbacks
    this.fallbackChars.set('\uE0A0', '⎇');   // Git branch
    this.fallbackChars.set('\uF015', '🏠');  // Home
    this.fallbackChars.set('\uF07C', '📁');  // Folder
    this.fallbackChars.set('\uE725', '📄');  // File
    this.fallbackChars.set('\uF419', '💻');  // Terminal
    this.fallbackChars.set('\uF1C0', '📁');  // Database
    this.fallbackChars.set('\uF121', '⚙️');   // Settings
  }

  /**
   * Get the best available font for the terminal
   */
  getBestTerminalFont() {
    const preferredFonts = [
      'FiraCode Nerd Font',
      'CascadiaCode Nerd Font',
      'JetBrainsMono Nerd Font'
    ];

    for (const font of preferredFonts) {
      if (this.detectedFonts.has(font)) {
        return font;
      }
    }

    // Fallback to regular programming fonts
    const fallbackFonts = [
      'Fira Code',
      'Cascadia Code',
      'JetBrains Mono',
      'SF Mono',
      'Monaco',
      'Consolas'
    ];

    for (const font of fallbackFonts) {
      if (this.detectedFonts.has(font)) {
        return font;
      }
    }

    return 'monospace';
  }

  /**
   * Apply the best font to terminal elements
   */
  applyTerminalFont(terminal) {
    const bestFont = this.getBestTerminalFont();

    if (terminal && terminal.options) {
      terminal.options.fontFamily = bestFont;

      // Apply additional font settings
      terminal.options.fontSize = 14;
      terminal.options.lineHeight = 1.2;
      terminal.options.letterSpacing = 0;

      console.log(`Applied terminal font: ${bestFont}`);
    }
  }

  /**
   * Process terminal output to handle missing characters
   */
  processTerminalOutput(text) {
    if (this.isNerdFontSupported) {
      return text;
    }

    let processedText = text;
    for (const [nerdChar, fallback] of this.fallbackChars) {
      processedText = processedText.replace(new RegExp(nerdChar, 'g'), fallback);
    }

    return processedText;
  }

  /**
   * Setup mutation observer to handle dynamic content
   */
  setupDynamicFontHandling(terminalElement) {
    if (!terminalElement) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE && node.textContent) {
              const processed = this.processTerminalOutput(node.textContent);
              if (processed !== node.textContent) {
                node.textContent = processed;
              }
            }
          });
        }
      });
    });

    observer.observe(terminalElement, {
      childList: true,
      subtree: true,
      characterData: true
    });

    return observer;
  }

  /**
   * Download and install Nerd Fonts helper
   */
  showNerdFontInstallInstructions() {
    if (this.isNerdFontSupported) return;

    console.warn(`
Nerd Font characters may not display correctly.
To install Nerd Fonts:

1. Download from: https://github.com/ryanoasis/nerd-fonts/releases
2. Recommended fonts:
   - FiraCode Nerd Font
   - CascadiaCode Nerd Font
   - JetBrainsMono Nerd Font
3. Install the fonts on your system
4. Refresh the page

Current available fonts: ${Array.from(this.detectedFonts).join(', ')}
    `);
  }
}

// Initialize and export
const terminalFontManager = new TerminalFontManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TerminalFontManager;
} else if (typeof window !== 'undefined') {
  window.TerminalFontManager = TerminalFontManager;
  window.terminalFontManager = terminalFontManager;
}
