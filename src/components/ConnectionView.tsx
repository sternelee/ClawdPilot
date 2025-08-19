import React from 'react';
import { HistoryEntry } from '../hooks/useConnectionHistory';
import { HistoryCard } from './HistoryCard';

interface ConnectionViewProps {
  sessionTicket: string;
  setSessionTicket: (ticket: string) => void;
  handleConnect: (ticket?: string) => void;
  connecting: boolean;
  history: HistoryEntry[];
  connectionError: string | null;
}

export function ConnectionView({
  sessionTicket,
  setSessionTicket,
  handleConnect,
  connecting,
  history,
  connectionError,
}: ConnectionViewProps) {
  const handleTicketKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !connecting && sessionTicket.trim()) {
      handleConnect();
    }
  };

  const handleCardConnect = (ticket: string) => {
    setSessionTicket(ticket);
    handleConnect(ticket);
  };

  return (
    <div className="connection-view-container">
      <div className="connection-main-panel">
        <div className="connection-form">
          <h1>Connect to a Remote Session</h1>
          <p>Enter a session ticket to start a secure P2P terminal session.</p>

          {connectionError && (
            <div className="error-message">
              <p>Connection Failed:</p>
              <pre>{connectionError}</pre>
            </div>
          )}

          <div className="form-group">
            <div className="input-group">
              <input
                type="text"
                value={sessionTicket}
                onChange={(e) => setSessionTicket(e.target.value)}
                onKeyPress={handleTicketKeyPress}
                placeholder="Enter session ticket"
                disabled={connecting}
                className="ticket-input"
                autoFocus
              />
              <button className="scan-qr-btn" onClick={() => alert('QR code scanning not implemented yet.')}>
                {/* Placeholder for a QR code icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>
              </button>
            </div>
          </div>
          <button
            className="connect-btn ripple"
            onClick={() => handleConnect()}
            disabled={connecting || !sessionTicket.trim()}
          >
            {connecting ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>

      {history.length > 0 && (
        <div className="history-panel">
          <div className="history-header">
            <h2>History</h2>
          </div>
          <div className="history-list-container">
            {history.map((entry) => (
              <HistoryCard key={entry.ticket} entry={entry} onConnect={handleCardConnect} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}