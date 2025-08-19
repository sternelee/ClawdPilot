import React from 'react';
import { HistoryEntry } from '../hooks/useConnectionHistory';
import { formatTimeAgo } from '../utils/time';

interface HistoryCardProps {
  entry: HistoryEntry;
  onConnect: (ticket: string) => void;
}

const statusColorMap: { [key in HistoryEntry['status']]: string } = {
  Active: '#2ecc71', // green
  Completed: '#3498db', // blue
  Failed: '#e74c3c', // red
  'Waiting Input': '#f39c12', // orange
};

export function HistoryCard({ entry, onConnect }: HistoryCardProps) {
  const statusColor = statusColorMap[entry.status] || '#bdc3c7'; // default to grey

  return (
    <div className="history-card" onClick={() => onConnect(entry.ticket)}>
      <div className="history-card-header">
        <span className="history-card-title">{entry.title}</span>
        <span className="history-card-time">{formatTimeAgo(entry.timestamp)}</span>
      </div>
      <div className="history-card-body">
        <p className="history-card-description">{entry.description}</p>
      </div>
      <div className="history-card-footer">
        <div className="history-card-status">
          <span className="status-dot" style={{ backgroundColor: statusColor }}></span>
          <span>{entry.status}</span>
        </div>
      </div>
    </div>
  );
}