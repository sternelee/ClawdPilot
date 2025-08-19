import React, { useState, useEffect } from 'react';
import { HistoryEntry } from '../hooks/useConnectionHistory';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: HistoryEntry | null;
  onSave: (ticket: string, updates: { title: string; description: string }) => void;
}

export function SettingsModal({ isOpen, onClose, entry, onSave }: SettingsModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (entry) {
      setTitle(entry.title);
      setDescription(entry.description);
    }
  }, [entry]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !entry) {
    return null;
  }

  const handleSave = () => {
    onSave(entry.ticket, { title, description });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Connection Details</h2>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="form-group">
          <label htmlFor="session-title">Title</label>
          <input
            id="session-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="ticket-input"
          />
        </div>
        <div className="form-group">
          <label htmlFor="session-description">Description</label>
          <textarea
            id="session-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="ticket-input"
            rows={4}
          />
        </div>
        <div className="modal-actions">
          <button className="disconnect-btn" onClick={onClose}>Cancel</button>
          <button className="connect-btn" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}