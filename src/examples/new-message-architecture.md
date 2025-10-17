# New Message Architecture Usage Guide

This guide demonstrates how to use the new structured message architecture in the frontend. The new architecture provides better type safety, improved error handling, and more maintainable code.

## Overview

The new message architecture is based on the `StructuredPayload` enum that organizes messages by functional domains:

- **Session**: Connection management and session control
- **Terminal**: Terminal operations (create, stop, input, output)
- **FileTransfer**: File upload/download operations
- **PortForward**: Unified port forwarding (TCP + WebShare)
- **System**: System stats, logs, and notifications

## Key Components

### 1. Message Types (`src/types/messages.ts`)

All message types are now strongly typed and organized by domain:

```typescript
import {
  NetworkMessage,
  StructuredPayload,
  MessageDomain,
  TerminalEvent,
  PortForwardEvent
} from "../types/messages";

// Example: Handle a terminal event
const handleTerminalEvent = (event: TerminalEvent) => {
  switch (event.type) {
    case "created":
      console.log("Terminal created:", event.data.terminal_info);
      break;
    case "output":
      console.log("Terminal output:", event.data.data);
      break;
  }
};
```

### 2. Message Handler (`src/utils/messageHandler.ts`)

The `StructuredMessageHandler` class provides a unified way to handle all message types:

```typescript
import { createMessageHandler } from "../utils/messageHandler";

const messageHandler = createMessageHandler(sessionId, {
  onTerminalEvent: (event) => {
    // Handle terminal events
    console.log("Terminal event:", event);
  },
  onPortForwardEvent: (event) => {
    // Handle port forward events
    console.log("Port forward event:", event);
  },
  onFileTransferEvent: (event) => {
    // Handle file transfer events
    console.log("File transfer event:", event);
  },
  onSystemEvent: (event) => {
    // Handle system events
    console.log("System event:", event);
  },
  onError: (error) => {
    console.error("Message handler error:", error);
  }
});

// Start listening for events
await messageHandler.startListening();

// Stop listening when done
await messageHandler.stopListening();
```

### 3. API Client (`src/utils/api.ts`)

The `RitermApiClient` provides type-safe API calls with proper error handling:

```typescript
import { createApiClient, ApiValidators } from "../utils/api";

const apiClient = createApiClient(sessionId);

// Create a terminal with validation
const createTerminal = async () => {
  const request = {
    session_id: sessionId,
    name: "My Terminal",
    shell_path: "/bin/bash",
    working_dir: "/home/user",
    size: [24, 80] as [number, number]
  };

  // Validate request
  const errors = ApiValidators.validateCreateTerminalRequest(request);
  if (errors.length > 0) {
    throw new Error(`Validation errors: ${errors.join(", ")}`);
  }

  const response = await apiClient.createTerminal(request);
  if (!response.success) {
    throw new Error(response.error || "Failed to create terminal");
  }

  console.log("Terminal creation initiated");
};
```

## Usage Examples

### Example 1: Terminal Management

```typescript
import { createSignal, onMount, onCleanup } from "solid-js";
import { createMessageHandler, extractTerminalInfo } from "../utils/messageHandler";
import { createApiClient } from "../utils/api";
import { TerminalEvent, TerminalInfo } from "../types/messages";

export function TerminalComponent() {
  const [terminals, setTerminals] = createSignal<TerminalInfo[]>([]);
  const [loading, setLoading] = createSignal(false);

  let apiClient: ReturnType<typeof createApiClient>;
  let messageHandler: ReturnType<typeof createMessageHandler>;

  onMount(async () => {
    const sessionId = "your-session-id";

    apiClient = createApiClient(sessionId);
    messageHandler = createMessageHandler(sessionId, {
      onTerminalEvent: handleTerminalEvent
    });

    await messageHandler.startListening();
    await loadTerminals();
  });

  onCleanup(async () => {
    if (messageHandler) {
      await messageHandler.stopListening();
    }
  });

  const handleTerminalEvent = (event: TerminalEvent) => {
    switch (event.type) {
      case "created":
        const terminalInfo = extractTerminalInfo(event);
        if (terminalInfo) {
          setTerminals(prev => [...prev, terminalInfo]);
        }
        break;
      case "stopped":
        setTerminals(prev => prev.filter(t => t.id !== event.terminal_id));
        break;
      case "status_update":
        setTerminals(prev =>
          prev.map(t =>
            t.id === event.terminal_id
              ? { ...t, status: event.data.status }
              : t
          )
        );
        break;
    }
  };

  const loadTerminals = async () => {
    setLoading(true);
    try {
      const response = await apiClient.listTerminals();
      if (!response.success) {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error("Failed to load terminals:", error);
    } finally {
      setLoading(false);
    }
  };

  const createTerminal = async () => {
    const response = await apiClient.createTerminal({
      session_id: "your-session-id",
      name: "New Terminal",
      size: [24, 80]
    });

    if (!response.success) {
      console.error("Failed to create terminal:", response.error);
    }
  };

  return (
    <div>
      {/* Your terminal UI here */}
      <button onClick={createTerminal}>Create Terminal</button>
      <div>
        {terminals().map(terminal => (
          <div key={terminal.id}>
            {terminal.name} - {terminal.status}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Example 2: Port Forward Management (Unified TCP + WebShare)

```typescript
import { createMessageHandler } from "../utils/messageHandler";
import { createApiClient } from "../utils/api";
import { PortForwardEvent, PortForwardType } from "../types/messages";

export function PortForwardComponent() {
  const [services, setServices] = createSignal([]);

  let apiClient: ReturnType<typeof createApiClient>;
  let messageHandler: ReturnType<typeof createMessageHandler>;

  onMount(async () => {
    const sessionId = "your-session-id";

    apiClient = createApiClient(sessionId);
    messageHandler = createMessageHandler(sessionId, {
      onPortForwardEvent: handlePortForwardEvent
    });

    await messageHandler.startListening();
  });

  const handlePortForwardEvent = (event: PortForwardEvent) => {
    switch (event.type) {
      case "created":
        console.log("Port forward created:", event.data);
        break;
      case "connected":
        console.log("Port forward connected:", event.data.access_url);
        break;
      case "status_update":
        console.log("Status updated:", event.data.status);
        break;
    }
  };

  // Create TCP port forward
  const createTcpForward = async () => {
    const response = await apiClient.createPortForward({
      session_id: "your-session-id",
      local_port: 3000,
      remote_port: 8080,
      service_type: PortForwardType.Tcp,
      service_name: "My TCP Service"
    });

    if (!response.success) {
      console.error("Failed to create TCP forward:", response.error);
    }
  };

  // Create WebShare (HTTP port forward)
  const createWebShare = async () => {
    const response = await apiClient.createPortForward({
      session_id: "your-session-id",
      local_port: 3000,
      remote_port: 8080,
      service_type: PortForwardType.Http,
      service_name: "My Web Service"
    });

    if (!response.success) {
      console.error("Failed to create WebShare:", response.error);
    }
  };

  return (
    <div>
      <button onClick={createTcpForward}>Create TCP Forward</button>
      <button onClick={createWebShare}>Create WebShare</button>
    </div>
  );
}
```

### Example 3: Connection Management

```typescript
import { createSignal } from "solid-js";
import { EnhancedConnectionInterface } from "../components/EnhancedConnectionInterface";

export function App() {
  const [sessionId, setSessionId] = createSignal<string | null>(null);

  const handleConnectionEstablished = (newSessionId: string) => {
    setSessionId(newSessionId);
    console.log("Connected to session:", newSessionId);
  };

  const handleConnectionLost = (lostSessionId: string) => {
    if (sessionId() === lostSessionId) {
      setSessionId(null);
    }
    console.log("Disconnected from session:", lostSessionId);
  };

  const handleTerminalEvent = (event: TerminalEvent) => {
    console.log("Terminal event:", event);
  };

  const handleError = (error: Error) => {
    console.error("Connection error:", error);
  };

  return (
    <div>
      <EnhancedConnectionInterface
        onConnectionEstablished={handleConnectionEstablished}
        onConnectionLost={handleConnectionLost}
        onTerminalEvent={handleTerminalEvent}
        onError={handleError}
      />

      {sessionId() && (
        <div>
          <p>Connected to session: {sessionId()}</p>
          {/* Your connected UI here */}
        </div>
      )}
    </div>
  );
}
```

## Migration Guide

### From Legacy to New Architecture

1. **Replace direct `invoke` calls** with the `RitermApiClient`:
   ```typescript
   // Old
   await invoke("create_terminal", { request });

   // New
   const apiClient = createApiClient(sessionId);
   const response = await apiClient.createTerminal(request);
   if (!response.success) {
     throw new Error(response.error);
   }
   ```

2. **Replace event listeners** with the `StructuredMessageHandler`:
   ```typescript
   // Old
   await listen("terminal-output", handleOutput);
   await listen("terminal-status", handleStatus);

   // New
   const messageHandler = createMessageHandler(sessionId, {
     onTerminalEvent: (event) => {
       switch (event.type) {
         case "output": handleOutput(event); break;
         case "status_update": handleStatus(event); break;
       }
     }
   });
   await messageHandler.startListening();
   ```

3. **Use the new message types** instead of any:
   ```typescript
   // Old
   const handleEvent = (event: any) => {
     if (event.type === "terminal_output") {
       console.log(event.data);
     }
   };

   // New
   const handleTerminalEvent = (event: TerminalEvent) => {
     if (event.type === "output") {
       console.log(event.data.data);
     }
   };
   ```

## Best Practices

1. **Always validate API requests** using `ApiValidators`
2. **Handle cleanup properly** by stopping message handlers when components unmount
3. **Use type-safe event handlers** to catch errors at compile time
4. **Implement proper error handling** with user-friendly messages
5. **Use the enhanced connection interface** for better connection management
6. **Leverage the unified PortForward API** instead of separate TCP/WebShare APIs

## Type Safety Benefits

The new architecture provides these type safety benefits:

- **Compile-time error detection** for invalid message structures
- **IDE auto-completion** for all message types and properties
- **Refactoring safety** when message structures change
- **Documentation through types** - self-documenting code
- **Consistent data structures** across frontend and backend

## Error Handling

The new architecture includes comprehensive error handling:

```typescript
// API errors are standardized
const response = await apiClient.createTerminal(request);
if (!response.success) {
  // response.error contains the error message
  // response.timestamp contains when the error occurred
  console.error("API Error:", response.error);
}

// Message handler errors are caught and reported
const messageHandler = createMessageHandler(sessionId, {
  onError: (error) => {
    console.error("Message handling error:", error);
    // Show user-friendly error message
    showErrorMessage("Failed to process message");
  }
});
```

This architecture provides a solid foundation for building robust, type-safe frontend applications that integrate seamlessly with the new backend message system.