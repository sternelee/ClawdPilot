import { invoke } from "@tauri-apps/api/core";
import { createConnectionHandler } from "../hooks/useConnection";

export interface ConnectionProgress {
  phase: 'connecting' | 'retrying' | 'connected' | 'failed' | 'timeout';
  elapsed: number;
  total: number;
  percentage: number;
  attempt?: number;
  error?: string;
}

/**
 * Connect to a remote CLI host via P2P ticket
 */
export async function connectToHost(
  ticket: string,
  options: {
    timeout?: number;
    retries?: number;
    onProgress?: (progress: ConnectionProgress) => void;
  } = {}
): Promise<string> {
  const { timeout = 10000, retries = 2, onProgress } = options;

  // Use the connection handler for connection management
  const connectionHandler = createConnectionHandler();

  try {
    // The connection handler already handles timeout and retries
    const sessionId = await connectionHandler.connect(ticket, {
      timeout,
      retries,
      onProgressUpdate: onProgress,
    });

    return sessionId;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to connect to host: ${errorMessage}`);
  }
}

/**
 * Disconnect from a remote session
 */
export async function disconnectFromHost(sessionId: string): Promise<void> {
  try {
    await invoke<void>("disconnect_session", { sessionId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to disconnect from host: ${errorMessage}`);
  }
}

/**
 * Parse a session ticket to validate format
 */
export async function parseSessionTicket(ticket: string): Promise<boolean> {
  try {
    await invoke<string>("parse_session_ticket", { ticket });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a session ticket format
 */
export function is_valid_session_ticket(ticket: string): boolean {
  if (!ticket || ticket.trim().length === 0) {
    return false;
  }
  const trimmed = ticket.trim();

  // New iroh-tickets format: base64 (alphanumeric + + / =), ~44-52 chars
  if (/^[A-Za-z0-9+/=]{40,60}$/.test(trimmed)) {
    return true;
  }

  // Legacy format: base32 lowercase (a-z2-7), ~150+ chars
  if (/^[a-z2-7]{100,}$/.test(trimmed)) {
    return true;
  }

  return false;
}
