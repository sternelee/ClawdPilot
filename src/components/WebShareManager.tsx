import { createSignal, createEffect, onMount, For, Show, onCleanup } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createMessageHandler, extractPortForwardInfo } from "../utils/messageHandler";
import { createApiClient, createWebShareAdapter, ApiValidators } from "../utils/api";
import { PortForwardInfo, PortForwardEvent, MessageDomain, PortForwardType } from "../types/messages";

// Use the new PortForwardInfo type for WebShare (WebShare is now HTTP PortForward)
interface WebShare extends Omit<PortForwardInfo, "service_type" | "service_id"> {
  public_port: number; // Map remote_port to public_port for legacy compatibility
  service_id: string; // Keep for internal use
}

interface CreateWebShareRequest {
  session_id: string;
  local_port: number;
  public_port?: number;
  service_name: string;
  terminal_id?: string;
}

interface WebShareStopRequest {
  session_id: string;
  public_port: number;
}

export function WebShareManager(props: {
  sessionId: string;
  availableTerminals: Array<{ id: string; name?: string }>;
  onClose: () => void;
}) {
  const [webshares, setWebshares] = createSignal<WebShare[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [creating, setCreating] = createSignal(false);
  const [showCreateForm, setShowCreateForm] = createSignal(false);

  // Create WebShare form state
  const [newLocalPort, setNewLocalPort] = createSignal(3000);
  const [newPublicPort, setNewPublicPort] = createSignal(8080);
  const [newServiceName, setNewServiceName] = createSignal("");
  const [newTerminalId, setNewTerminalId] = createSignal("");

  // Create API client and message handler
  let apiClient: ReturnType<typeof createApiClient>;
  let webShareAdapter: ReturnType<typeof createWebShareAdapter>;
  let messageHandler: ReturnType<typeof createMessageHandler>;

  // Load WebShares on mount
  onMount(() => {
    apiClient = createApiClient(props.sessionId);
    webShareAdapter = createWebShareAdapter(props.sessionId);
    messageHandler = createMessageHandler(props.sessionId, {
      onPortForwardEvent: handlePortForwardEvent,
      onError: (error) => console.error("WebShare manager message handler error:", error)
    });

    loadWebShares();
    setupEventListeners();
  });

  // Cleanup on unmount
  onCleanup(async () => {
    if (messageHandler) {
      await messageHandler.stopListening();
    }
  });

  const loadWebShares = async () => {
    setLoading(true);
    try {
      const response = await apiClient.listPortForwards();
      if (!response.success) {
        throw new Error(response.error || "Failed to list web shares");
      }
      // WebShare list will be received via events (filtered for HTTP type)
    } catch (error) {
      console.error("Failed to load webshares:", error);
    } finally {
      setLoading(false);
    }
  };

  const setupEventListeners = async () => {
    if (!messageHandler) {
      console.error("Message handler not initialized");
      return;
    }

    try {
      await messageHandler.startListening();
    } catch (error) {
      console.error("Failed to start message handler:", error);
    }
  };

  const handlePortForwardEvent = (event: PortForwardEvent) => {
    console.log("Port forward event:", event);

    // Only handle HTTP type events for WebShare
    if (event.data.service_type && event.data.service_type !== PortForwardType.Http) {
      return;
    }

    const portForwardInfo = extractPortForwardInfo(event);
    if (!portForwardInfo) {
      return;
    }

    // Convert PortForwardInfo to WebShare interface
    const webShare: WebShare = {
      ...portForwardInfo,
      public_port: portForwardInfo.remote_port,
      service_id: event.service_id,
      service_type: undefined, // Remove service_type for legacy compatibility
    };

    switch (event.type) {
      case "created":
        setWebshares(prev => [...prev, webShare]);
        break;

      case "connected":
        setWebshares(prev =>
          prev.map(ws =>
            ws.service_id === event.service_id
              ? { ...ws, status: "Active", access_url: portForwardInfo.access_url }
              : ws
          )
        );
        break;

      case "status_update":
        setWebshares(prev =>
          prev.map(ws =>
            ws.service_id === event.service_id
              ? { ...ws, status: portForwardInfo.status as any }
              : ws
          )
        );
        break;

      case "stopped":
        setWebshares(prev => prev.filter(ws => ws.service_id !== event.service_id));
        break;

      case "list_response":
        // Filter for HTTP services and convert to WebShare format
        const httpServices = (event.data.services || [])
          .filter((service: PortForwardInfo) => service.service_type === PortForwardType.Http)
          .map((service: PortForwardInfo) => ({
            ...service,
            public_port: service.remote_port,
            service_id: service.service_id,
            service_type: undefined, // Remove service_type for legacy compatibility
          }));
        setWebshares(httpServices);
        break;

      default:
        console.log(`Unhandled port forward event type: ${event.type}`);
    }
  };

  const createWebShare = async () => {
    setCreating(true);
    try {
      const request = {
        session_id: props.sessionId,
        local_port: newLocalPort(),
        remote_port: newPublicPort() || undefined,
        service_type: PortForwardType.Http,
        service_name: newServiceName() || `Service on port ${newLocalPort()}`,
        terminal_id: newTerminalId() || undefined,
        metadata: {
          created_by: "webshare_manager"
        }
      };

      // Validate request
      const errors = ApiValidators.validateCreatePortForwardRequest(request);
      if (errors.length > 0) {
        throw new Error(`Validation errors: ${errors.join(", ")}`);
      }

      const response = await apiClient.createPortForward(request);
      if (!response.success) {
        throw new Error(response.error || "Failed to create web share");
      }

      setShowCreateForm(false);
      resetCreateForm();
      // WebShare will be added via events, no need to refresh list
    } catch (error) {
      console.error("Failed to create webshare:", error);
      // TODO: Show error to user
    } finally {
      setCreating(false);
    }
  };

  const stopWebShare = async (publicPort: number) => {
    try {
      // Find the service_id for the given public_port
      const webshare = webshares().find(ws => ws.public_port === publicPort);
      if (!webshare) {
        throw new Error("WebShare not found");
      }

      const request = {
        session_id: props.sessionId,
        service_id: webshare.service_id,
      };

      const response = await apiClient.stopPortForward(request);
      if (!response.success) {
        throw new Error(response.error || "Failed to stop web share");
      }
      // WebShare will be removed via events, no need to refresh list
    } catch (error) {
      console.error("Failed to stop webshare:", error);
      // TODO: Show error to user
    }
  };

  const resetCreateForm = () => {
    setNewLocalPort(3000);
    setNewPublicPort(8080);
    setNewServiceName("");
    setNewTerminalId("");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active": return "text-green-500";
      case "Starting": return "text-yellow-500";
      case "Stopped": return "text-gray-500";
      case "Error": return "text-red-500";
      default: return "text-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Active": return "🌐";
      case "Starting": return "⏳";
      case "Stopped": return "⏹";
      case "Error": return "⚠";
      default: return "❓";
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getAccessUrl = (publicPort: number) => {
    // This would typically be the host's IP or domain
    // For now, we'll show localhost as an example
    return `http://localhost:${publicPort}`;
  };

  return (
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div class="bg-indigo-800 text-white p-4 flex justify-between items-center">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <span class="text-white font-bold">W</span>
            </div>
            <h2 class="text-xl font-semibold">WebShare Manager</h2>
            <span class="text-sm text-gray-300">Session: {props.sessionId.slice(0, 8)}...</span>
          </div>
          <div class="flex items-center space-x-2">
            <button
              onClick={loadWebShares}
              disabled={loading()}
              class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm disabled:opacity-50"
            >
              {loading() ? "Loading..." : "Refresh"}
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
            >
              + New WebShare
            </button>
            <button
              onClick={props.onClose}
              class="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
            >
              Close
            </button>
          </div>
        </div>

        {/* Create WebShare Form */}
        <Show when={showCreateForm()}>
          <div class="bg-gray-100 p-4 border-b">
            <h3 class="font-semibold mb-3">Create New WebShare</h3>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Local Port</label>
                <input
                  type="number"
                  value={newLocalPort()}
                  onInput={(e) => setNewLocalPort(parseInt(e.currentTarget.value) || 3000)}
                  placeholder="3000"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Public Port (optional)</label>
                <input
                  type="number"
                  value={newPublicPort()}
                  onInput={(e) => setNewPublicPort(parseInt(e.currentTarget.value) || 8080)}
                  placeholder="8080"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div class="col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Service Name</label>
                <input
                  type="text"
                  value={newServiceName()}
                  onInput={(e) => setNewServiceName(e.currentTarget.value)}
                  placeholder="My Service"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div class="col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Terminal (optional)</label>
                <select
                  value={newTerminalId()}
                  onInput={(e) => setNewTerminalId(e.currentTarget.value)}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">No specific terminal</option>
                  <For each={props.availableTerminals}>
                    {(terminal) => (
                      <option value={terminal.id}>
                        {terminal.name || `Terminal ${terminal.id.slice(0, 8)}`}
                      </option>
                    )}
                  </For>
                </select>
              </div>
            </div>
            <div class="bg-blue-50 border border-blue-200 rounded-md p-3 mt-3">
              <div class="text-sm text-blue-800">
                <strong>💡 Tip:</strong> WebShare forwards traffic from the public port to your local port.
                Leave the public port empty to auto-assign one.
              </div>
            </div>
            <div class="flex justify-end space-x-2 mt-3">
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  resetCreateForm();
                }}
                class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={createWebShare}
                disabled={creating()}
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md disabled:opacity-50"
              >
                {creating() ? "Creating..." : "Create WebShare"}
              </button>
            </div>
          </div>
        </Show>

        {/* WebShare List */}
        <div class="flex-1 overflow-y-auto p-4">
          <Show
            when={webshares().length > 0}
            fallback={<div class="text-center text-gray-500 py-8">No web services found. Create one to get started.</div>}
          >
            <div class="grid gap-3">
              <For each={webshares()}>
                {(webshare) => (
                  <div class="border rounded-lg p-4 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
                    <div class="flex justify-between items-start mb-2">
                      <div class="flex-1">
                        <div class="flex items-center space-x-2">
                          <h3 class="font-semibold text-lg">{webshare.service_name}</h3>
                          <span class={`text-sm ${getStatusColor(webshare.status)}`}>
                            {getStatusIcon(webshare.status)} {webshare.status}
                          </span>
                        </div>
                        <div class="text-sm text-gray-600 mt-1">
                          <div class="flex items-center space-x-2">
                            <span>Local Port:</span>
                            <span class="font-mono bg-gray-100 px-2 py-1 rounded">{webshare.local_port}</span>
                            <span>→</span>
                            <span>Public Port:</span>
                            <span class="font-mono bg-green-100 px-2 py-1 rounded">{webshare.public_port}</span>
                          </div>
                          <Show when={webshare.terminal_id}>
                            <div class="mt-1">
                              Terminal: {webshare.terminal_id?.slice(0, 8)}...
                            </div>
                          </Show>
                          <div class="mt-1 text-xs text-gray-500">
                            Created: {formatDate(webshare.created_at)}
                          </div>
                        </div>
                      </div>
                      <div class="flex flex-col space-y-1">
                        <Show when={webshare.status === "Active"}>
                          <button
                            onClick={() => navigator.clipboard.writeText(getAccessUrl(webshare.public_port))}
                            class="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded"
                          >
                            📋 Copy URL
                          </button>
                        </Show>
                        <button
                          onClick={() => stopWebShare(webshare.public_port)}
                          class="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded"
                        >
                          Stop
                        </button>
                      </div>
                    </div>

                    {/* Access Information */}
                    <Show when={webshare.status === "Active"}>
                      <div class="mt-3 pt-3 border-t">
                        <div class="bg-green-50 border border-green-200 rounded-md p-3">
                          <div class="text-sm text-green-800">
                            <div class="font-semibold mb-1">🔗 Access Information:</div>
                            <div class="font-mono text-xs break-all">
                              {getAccessUrl(webshare.public_port)}
                            </div>
                            <div class="mt-2 text-xs">
                              <strong>Forwarding:</strong> {getAccessUrl(webshare.public_port)} → localhost:{webshare.local_port}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Show>

                    {/* Error Information */}
                    <Show when={webshare.status === "Error"}>
                      <div class="mt-3 pt-3 border-t">
                        <div class="bg-red-50 border border-red-200 rounded-md p-3">
                          <div class="text-sm text-red-800">
                            <div class="font-semibold mb-1">⚠️ Service Error</div>
                            <div class="text-xs">
                              The web service encountered an error. Check the logs for more details.
                            </div>
                          </div>
                        </div>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Footer */}
        <div class="bg-gray-100 p-3 border-t text-sm text-gray-600 text-center">
          <div>Connected to: {props.sessionId}</div>
          <div>Total web services: {webshares().length}</div>
          <div class="text-xs text-gray-500 mt-1">
            💡 WebShare forwards external traffic to your local services
          </div>
        </div>
      </div>
    </div>
  );
}