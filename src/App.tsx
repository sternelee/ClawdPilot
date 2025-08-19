import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from 'xterm-addon-fit';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './App.css';
import { useConnectionHistory, HistoryEntry } from './hooks/useConnectionHistory';
import { ConnectionView } from './components/ConnectionView';
import { TerminalView } from './components/TerminalView';
import { SettingsModal } from './components/SettingsModal';

function App() {
  const [sessionTicket, setSessionTicket] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState('Disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  const { history, addHistoryEntry, updateHistoryEntry } = useConnectionHistory();

  const initializeNetwork = useCallback(async () => {
    try {
      const nodeId = await invoke<string>('initialize_network');
      setStatus(`Ready - Node ID: ${nodeId.substring(0, 8)}...`);
    } catch (error) {
      console.error('Failed to initialize network:', error);
      setStatus('Failed to initialize network');
    }
  }, []);

  useEffect(() => {
    initializeNetwork();
  }, [initializeNetwork]);

  const handleTerminalReady = useCallback((term: Terminal, addon: FitAddon) => {
    terminalInstance.current = term;
    fitAddon.current = addon;
    window.addEventListener('resize', () => addon.fit());
  }, []);

  const handleTerminalInput = useCallback((data: string) => {
    if (isConnected && sessionIdRef.current) {
      invoke('send_terminal_input', {
        sessionId: sessionIdRef.current,
        input: data,
      }).catch((error) => {
        console.error('Failed to send input:', error);
        terminalInstance.current?.writeln(`\r\n❌ Failed to send input: ${error}`);
      });
    }
  }, [isConnected]);

  const handleDisconnect = useCallback(async () => {
    if (terminalInstance.current) {
      terminalInstance.current.writeln('\r\n\x1b[1;33m👋 Disconnected from session\x1b[0m');
    }

    if (activeTicket) {
      updateHistoryEntry(activeTicket, { status: 'Completed', description: 'Session ended by user.' });
    }

    if (sessionIdRef.current) {
      try {
        await invoke('disconnect_session', { sessionId: sessionIdRef.current });
      } catch (error) {
        console.error('Failed to disconnect:', error);
      }
    }

    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }

    setIsConnected(false);
    sessionIdRef.current = null;
    setActiveTicket(null);
    setStatus('Disconnected');
  }, [activeTicket, updateHistoryEntry]);

  const handleConnect = useCallback(async (ticketOverride?: string) => {
    const ticket = (ticketOverride || sessionTicket).trim();
    if (!ticket) {
      alert('Please enter a session ticket.');
      return;
    }

    // If a new ticket is used, add it to history.
    if (!history.some(h => h.ticket === ticket)) {
      addHistoryEntry(ticket);
    }
    setConnecting(true);
    setStatus('Connecting...');
    setConnectionError(null);

    try {
      const actualSessionId = await invoke<string>('connect_to_peer', {
        sessionTicket: ticket,
      });

      sessionIdRef.current = actualSessionId;
      setActiveTicket(ticket);
      setIsConnected(true);
      updateHistoryEntry(ticket, { description: 'Connection established.' });

      const unlisten = await listen<any>(`terminal-event-${actualSessionId}`, (event) => {
        const termEvent = event.payload;
        if (terminalInstance.current) {
          if (termEvent.event_type === 'Output') {
            terminalInstance.current.write(termEvent.data);
          } else if (termEvent.event_type === 'End') {
            terminalInstance.current.writeln('\r\n\r\n[Session Ended]');
            handleDisconnect();
          }
        }
      });

      unlistenRef.current = unlisten;
      setStatus('Connected');
      terminalInstance.current?.clear();
      terminalInstance.current?.writeln('\r\n\x1b[1;32m✅ Connection established!\x1b[0m');
      terminalInstance.current?.focus();
    } catch (error) {
      console.error('Connection failed:', error);
      setStatus('Connection failed');
      updateHistoryEntry(ticket, { status: 'Failed', description: String(error) });
      setConnectionError(String(error));
    } finally {
      setConnecting(false);
    }
  }, [sessionTicket, history, addHistoryEntry, updateHistoryEntry, handleDisconnect]);

  const handleSaveSettings = (ticket: string, updates: { title: string; description: string }) => {
    updateHistoryEntry(ticket, updates);
  };

  const activeHistoryEntry = history.find((entry) => entry.ticket === activeTicket);

  return (
    <div className="app">
      <div className="header">
        <div className="header-controls">
          <div className="status-bar">{status}</div>
          {isConnected && (
            <button className="settings-btn" onClick={() => setIsSettingsOpen(true)}>
              Settings
            </button>
          )}
        </div>
      </div>

      <div className="terminal-container-wrapper">
        {isConnected ? (
          <TerminalView onReady={handleTerminalReady} onInput={handleTerminalInput} />
        ) : (
          <ConnectionView
            sessionTicket={sessionTicket}
            setSessionTicket={setSessionTicket}
            handleConnect={handleConnect}
            connecting={connecting}
            history={history}
            connectionError={connectionError}
          />
        )}
      </div>

      {isConnected && (
        <div className="controls">
          <button className="disconnect-btn" onClick={handleDisconnect}>
            Disconnect
          </button>
        </div>
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        entry={activeHistoryEntry || null}
        onSave={handleSaveSettings}
      />
    </div>
  );
}

export default App;
