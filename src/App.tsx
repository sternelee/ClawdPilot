import { createSignal, createEffect, onMount, createMemo } from 'solid-js';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from 'xterm-addon-fit';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './App.css';
import { createConnectionHistory, HistoryEntry } from './hooks/useConnectionHistory';
import { ConnectionView } from './components/ConnectionView';
import { TerminalView } from './components/TerminalView';
import { SettingsModal } from './components/SettingsModal';

function App() {
  const [sessionTicket, setSessionTicket] = createSignal('');
  const [connecting, setConnecting] = createSignal(false);
  const [status, setStatus] = createSignal('Disconnected');
  const [isConnected, setIsConnected] = createSignal(false);
  const [connectionError, setConnectionError] = createSignal<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false);
  const [activeTicket, setActiveTicket] = createSignal<string | null>(null);

  let sessionIdRef: string | null = null;
  let terminalInstance: Terminal | null = null;
  let fitAddon: FitAddon | null = null;
  let unlistenRef: (() => void) | null = null;

  const { history, addHistoryEntry, updateHistoryEntry } = createConnectionHistory();

  const initializeNetwork = async () => {
    try {
      const nodeId = await invoke<string>('initialize_network');
      setStatus(`Ready - Node ID: ${nodeId.substring(0, 8)}...`);
    } catch (error) {
      console.error('Failed to initialize network:', error);
      setStatus('Failed to initialize network');
    }
  };

  onMount(() => {
    initializeNetwork();
  });

  const handleTerminalReady = (term: Terminal, addon: FitAddon) => {
    terminalInstance = term;
    fitAddon = addon;
    window.addEventListener('resize', () => addon.fit());
  };

  const handleTerminalInput = (data: string) => {
    if (isConnected() && sessionIdRef) {
      invoke('send_terminal_input', {
        sessionId: sessionIdRef,
        input: data,
      }).catch((error) => {
        console.error('Failed to send input:', error);
        terminalInstance?.writeln(`\r\n❌ Failed to send input: ${error}`);
      });
    }
  };

  const handleDisconnect = async () => {
    if (terminalInstance) {
      terminalInstance.writeln('\r\n\x1b[1;33m👋 Disconnected from session\x1b[0m');
    }

    const currentActiveTicket = activeTicket();
    if (currentActiveTicket) {
      updateHistoryEntry(currentActiveTicket, { status: 'Completed', description: 'Session ended by user.' });
    }

    if (sessionIdRef) {
      try {
        await invoke('disconnect_session', { sessionId: sessionIdRef });
      } catch (error) {
        console.error('Failed to disconnect:', error);
      }
    }

    if (unlistenRef) {
      unlistenRef();
      unlistenRef = null;
    }

    setIsConnected(false);
    sessionIdRef = null;
    setActiveTicket(null);
    setStatus('Disconnected');
  };

  const handleConnect = async (ticketOverride?: string) => {
    const ticket = (ticketOverride || sessionTicket()).trim();
    if (!ticket) {
      alert('Please enter a session ticket.');
      return;
    }

    // If a new ticket is used, add it to history.
    if (!history().some(h => h.ticket === ticket)) {
      addHistoryEntry(ticket);
    }
    setConnecting(true);
    setStatus('Connecting...');
    setConnectionError(null);

    try {
      const actualSessionId = await invoke<string>('connect_to_peer', {
        sessionTicket: ticket,
      });

      sessionIdRef = actualSessionId;
      setActiveTicket(ticket);
      setIsConnected(true);
      updateHistoryEntry(ticket, { description: 'Connection established.' });

      const unlisten = await listen<any>(`terminal-event-${actualSessionId}`, (event) => {
        const termEvent = event.payload;
        if (terminalInstance) {
          if (termEvent.event_type === 'Output') {
            terminalInstance.write(termEvent.data);
          } else if (termEvent.event_type === 'End') {
            terminalInstance.writeln('\r\n\r\n[Session Ended]');
            handleDisconnect();
          } else if (termEvent.event_type === 'HistoryData') {
            // 处理接收到的历史记录数据
            console.log('📜 Received session history:', termEvent.data);

            // 解析历史记录数据
            try {
              const historyData = JSON.parse(termEvent.data);
              const { logs, shell, cwd } = historyData;

              // 在终端中显示历史记录
              terminalInstance.writeln('\r\n\x1b[1;36m📜 Session History Received\x1b[0m');
              terminalInstance.writeln(`\x1b[1;33mShell:\x1b[0m ${shell}`);
              terminalInstance.writeln(`\x1b[1;33mWorking Directory:\x1b[0m ${cwd}`);
              terminalInstance.writeln('\x1b[1;33m--- History Start ---\x1b[0m');
              terminalInstance.write(logs);
              terminalInstance.writeln('\x1b[1;33m--- History End ---\x1b[0m\r\n');

              // 更新连接历史记录
              updateHistoryEntry(ticket, {
                description: `Connected with history (Shell: ${shell}, CWD: ${cwd})`
              });

              console.log(`✅ History displayed: ${logs.length} characters, Shell: ${shell}, CWD: ${cwd}`);
            } catch (error) {
              console.error('❌ Failed to parse history data:', error);
              terminalInstance.writeln('\r\n\x1b[1;31m❌ Failed to parse session history\x1b[0m\r\n');
            }
          }
        }
      });

      unlistenRef = unlisten;
      setStatus('Connected');
      terminalInstance?.clear();
      terminalInstance?.writeln('\r\n\x1b[1;32m✅ Connection established!\x1b[0m');
      terminalInstance?.focus();
    } catch (error) {
      console.error('Connection failed:', error);
      setStatus('Connection failed');
      updateHistoryEntry(ticket, { status: 'Failed', description: String(error) });
      setConnectionError(String(error));
    } finally {
      setConnecting(false);
    }
  };

  const handleSaveSettings = (ticket: string, updates: { title: string; description: string }) => {
    updateHistoryEntry(ticket, updates);
  };

  const activeHistoryEntry = createMemo(() =>
    history().find((entry) => entry.ticket === activeTicket())
  );

  return (
    <div class="w-full h-full flex flex-col bg-base-300 backdrop-blur-xl">
      <div class="navbar bg-base-100 shadow-sm">
        <div class="flex-1">
          <div class="text-sm font-mono">{status()}</div>
        </div>
        {isConnected() && (
          <div class="flex-none">
            <button
              class="btn btn-ghost btn-sm"
              onClick={() => setIsSettingsOpen(true)}
            >
              Settings
            </button>
          </div>
        )}
      </div>

      <div class="flex-1">
        {isConnected() ? (
          <TerminalView onReady={handleTerminalReady} onInput={handleTerminalInput} />
        ) : (
          <ConnectionView
            sessionTicket={sessionTicket()}
            setSessionTicket={setSessionTicket}
            handleConnect={handleConnect}
            connecting={connecting()}
            history={history()}
            connectionError={connectionError()}
          />
        )}
      </div>

      {isConnected() && (
        <div class="p-4 bg-base-100 border-t">
          <button
            class="btn btn-error btn-sm"
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        </div>
      )}

      <SettingsModal
        isOpen={isSettingsOpen()}
        onClose={() => setIsSettingsOpen(false)}
        entry={activeHistoryEntry() || null}
        onSave={handleSaveSettings}
      />
    </div>
  );
}

export default App;
