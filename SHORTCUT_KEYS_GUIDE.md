# Terminal Shortcut Keys Guide

## Quick Access Toolbar

The terminal now includes a comprehensive shortcut key toolbar at the bottom, providing easy access to commonly used terminal commands and shortcuts.

### Essential Keys (Always Visible)

These keys are always visible in the main toolbar:

| Key | Icon | Function | Use Case |
|-----|------|----------|----------|
| **Ctrl+C** | ⌃C | Interrupt | Stop running processes, cancel commands |
| **Paste** | 📋 | Ctrl+V | Paste clipboard content into terminal |
| **Tab** | ⇥ | Tab completion | Auto-complete commands and file names |
| **Esc** | ⎋ | Escape | Exit insert mode, cancel operations |
| **Enter** | ↵ | Execute | Run commands, confirm input |
| **Ctrl+D** | ⌃D | EOF/Logout | Send end-of-file, exit shell |

### Vim Commands (Expanded Keyboard)

Access these by tapping the expand button (▲) or long-pressing any key:

| Command | Function | Description |
|---------|----------|-------------|
| **:q** | Quit | Exit vim (if no unsaved changes) |
| **:q!** | Force Quit | Exit vim without saving changes |
| **:w** | Write | Save current file |
| **:wq** | Write & Quit | Save and exit vim |
| **i** | Insert Mode | Enter insert mode at cursor |
| **v** | Visual Mode | Enter visual selection mode |

### Editing Keys (Expanded Keyboard)

| Key | Icon | Function | Description |
|-----|------|----------|-------------|
| **Ctrl+Z** | ↶ | Undo | Undo last action (in editors) |
| **Ctrl+X** | ✂ | Cut | Cut selected text |
| **Ctrl+A** | ⌃A | Select All | Select all text / Move to line start |
| **Ctrl+L** | 🗑 | Clear | Clear terminal screen |

### Navigation Keys

| Key | Icon | Function |
|-----|------|----------|
| **←** | ← | Move cursor left |
| **→** | → | Move cursor right |
| **↑** | ↑ | Previous command / Move up |
| **↓** | ↓ | Next command / Move down |
| **Home** | ⇱ | Move to line start |
| **End** | ⇲ | Move to line end |

### Advanced Keys (Expanded Keyboard)

| Key | Function | Description |
|-----|----------|-------------|
| **PgUp** | Page Up | Scroll up one page |
| **PgDn** | Page Down | Scroll down one page |
| **Ctrl+R** | Reverse Search | Search command history |
| **Ctrl+U** | Delete Line | Delete from cursor to line start |
| **Ctrl+K** | Kill Line | Delete from cursor to line end |
| **Ctrl+W** | Delete Word | Delete word before cursor |

## How to Use

### Compact Mode (Mobile)
- **Main Toolbar**: Shows 6 essential keys
- **Scroll**: Use left/right arrows to see more keys
- **Expand**: Tap the ▲ button to see all keys

### Expanded Mode (Tablet/Desktop)
- All keys visible in organized sections
- No scrolling needed
- Categorized by function

### Long Press
- Long-press any key for 500ms to open expanded keyboard
- Provides quick access to all shortcuts

## Common Use Cases

### 1. Interrupting a Running Process
```bash
# Process is running...
[Tap Ctrl+C button]
# Process interrupted
```

### 2. Exiting Vim
```bash
vim myfile.txt
# Make changes...
[Tap :wq button]  # Save and exit
# or
[Tap :q! button]  # Exit without saving
```

### 3. Pasting Commands
```bash
# Copy command from documentation
[Tap Paste button]
# Command pasted into terminal
[Tap Enter button]
# Command executed
```

### 4. Clearing Terminal
```bash
# Terminal is cluttered
[Tap Ctrl+L button]
# Terminal cleared
```

### 5. Command History Search
```bash
[Tap Ctrl+R button]
# Type search term
# Previous matching commands appear
```

## Customization

You can add custom keys programmatically:

```typescript
<QuickAccessToolbar
  onKeyPress={(key) => terminal.write(key)}
  customKeys={[
    {
      id: 'my-command',
      label: 'Deploy',
      keySequence: 'npm run deploy\r',
      icon: '🚀',
      category: 'custom',
      hapticFeedback: 'medium'
    }
  ]}
/>
```

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Show/Hide Keyboard | Two-finger swipe up/down |
| Expand Toolbar | Long-press any key (500ms) |
| Scroll Toolbar | Swipe left/right on toolbar |
| Close Expanded | Tap ✕ or tap outside |

## Tips

1. **Vim Users**: The vim commands automatically send Enter, so you don't need to tap it separately
2. **Paste**: Works with system clipboard on supported devices
3. **Haptic Feedback**: Feel vibrations when tapping keys (if device supports it)
4. **Compact Mode**: Optimized for small screens, shows most-used keys first
5. **Sections**: Expanded keyboard organizes keys by category for easy discovery

## Accessibility

- All keys have ARIA labels for screen readers
- Minimum 44x44px touch targets
- High contrast mode support
- Reduced motion support
- Keyboard navigation support

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Safari**: Full support (iOS 13+)
- **Firefox**: Full support
- **Mobile Browsers**: Optimized for touch

## Performance

- Hardware-accelerated animations
- Smooth scrolling with momentum
- Debounced gesture recognition
- Efficient event handling
- Low memory footprint

---

**Note**: Some shortcuts may behave differently depending on the shell (bash, zsh, fish) and running applications. The toolbar sends standard terminal control sequences that work with most Unix-like systems.
