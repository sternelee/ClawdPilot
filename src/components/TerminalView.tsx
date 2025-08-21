import { onMount, onCleanup } from 'solid-js';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

interface TerminalViewProps {
  onInput: (data: string) => void;
  onReady: (terminal: Terminal, fitAddon: FitAddon) => void;
}

export function TerminalView(props: TerminalViewProps) {
  let terminalRef: HTMLDivElement | undefined;
  let terminalInstance: Terminal | null = null;
  let fitAddon: FitAddon | null = null;
  let onDataDispose: { dispose: () => void } | null = null;

  onMount(() => {
    if (terminalRef && !terminalInstance) {
      const term = new Terminal({
        cursorBlink: true,
        scrollback: 1000,
        theme: {
          background: '#000000',
          foreground: '#ffffff',
          cursor: '#ffffff',
        },
        fontSize: 14,
        fontFamily: 'Monaco, "Courier New", monospace',
        allowProposedApi: true,
      });

      const addon = new FitAddon();
      fitAddon = addon;
      term.loadAddon(addon);
      term.loadAddon(new WebLinksAddon());

      term.open(terminalRef);
      addon.fit();
      term.focus();

      terminalInstance = term;
      props.onReady(term, addon);

      onDataDispose = term.onData((data) => {
        props.onInput(data);
      });
    }
  });

  onCleanup(() => {
    if (onDataDispose) {
      onDataDispose.dispose();
    }
    if (terminalInstance) {
      terminalInstance.dispose();
      terminalInstance = null;
    }
  });

  return <div ref={terminalRef} class="terminal-container h-full w-full" />;
}
