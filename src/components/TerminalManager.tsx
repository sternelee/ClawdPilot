import { createSignal, createEffect, onMount, For, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface Terminal {
  id: string;
  name?: string;
  shell_type: string;
  current_dir: string;
  status: "Starting" | "Running" | "Paused" | "Stopped" | "Error";
  created_at: number;
  last_activity: number;
  size: [number, number];
  process_id?: number;
}

interface CreateTerminalRequest {
  session_id: string;
  name?: string;
  shell_path?: string;
  working_dir?: string;
  size?: [number, number];
}

interface TerminalInputRequest {
  session_id: string;
  terminal_id: string;
  input: string;
}

interface TerminalResizeRequest {
  session_id: string;
  terminal_id: string;
  rows: number;
  cols: number;
}

interface TerminalStopRequest {
  session_id: string;
  terminal_id: string;
}

export function TerminalManager(props: {
  sessionId: string;
  onClose: () => void;
}) {
  const [terminals, setTerminals] = createSignal<Terminal[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [creating, setCreating] = createSignal(false);
  const [showCreateForm, setShowCreateForm] = createSignal(false);
  const [selectedTerminal, setSelectedTerminal] = createSignal<string | null>(null);
  const [terminalInput, setTerminalInput] = createSignal("");

  // Create terminal form state
  const [newTerminalName, setNewTerminalName] = createSignal("");
  const [newTerminalShell, setNewTerminalShell] = createSignal("");
  const [newTerminalDir, setNewTerminalDir] = createSignal("");
  const [newTerminalRows, setNewTerminalRows] = createSignal(24);
  const [newTerminalCols, setNewTerminalCols] = createSignal(80);

  // Load terminals on mount
  onMount(() => {
    loadTerminals();
    setupEventListeners();
  });

  const loadTerminals = async () => {
    setLoading(true);
    try {
      await invoke("list_terminals", { sessionId: props.sessionId });
    } catch (error) {
      console.error("Failed to load terminals:", error);
    } finally {
      setLoading(false);
    }
  };

  const setupEventListeners = async () => {
    // Listen for structured terminal events
    await listen(`structured-event-${props.sessionId}`, (event) => {
      const structuredEvent = event.payload;
      console.log("Received structured terminal event:", structuredEvent);

      if (structuredEvent.type === "terminal_list_response") {
        setTerminals(structuredEvent.data.terminals || []);
      } else if (structuredEvent.type === "terminal_status_update") {
        setTerminals(prev =>
          prev.map(terminal =>
            terminal.id === structuredEvent.terminal_id
              ? { ...terminal, status: structuredEvent.status }
              : terminal
          )
        );
      } else if (structuredEvent.type === "terminal_output") {
        // Handle terminal output for specific terminal if needed
        console.log(`Terminal ${structuredEvent.terminal_id} output:`, structuredEvent.data);
      } else if (structuredEvent.type === "terminal_input") {
        // Handle terminal input feedback if needed
        console.log(`Terminal ${structuredEvent.terminal_id} input:`, structuredEvent.data);
      } else if (structuredEvent.type === "terminal_resize") {
        // Handle terminal resize feedback
        console.log(`Terminal ${structuredEvent.terminal_id} resized to:`, structuredEvent.size);
      }
    });
  };

  const createTerminal = async () => {
    setCreating(true);
    try {
      const request: CreateTerminalRequest = {
        session_id: props.sessionId,
        name: newTerminalName() || undefined,
        shell_path: newTerminalShell() || undefined,
        working_dir: newTerminalDir() || undefined,
        size: [newTerminalRows(), newTerminalCols()],
      };

      await invoke("create_terminal", { request });
      setShowCreateForm(false);
      resetCreateForm();
      loadTerminals(); // Refresh the list
    } catch (error) {
      console.error("Failed to create terminal:", error);
    } finally {
      setCreating(false);
    }
  };

  const stopTerminal = async (terminalId: string) => {
    try {
      const request: TerminalStopRequest = {
        session_id: props.sessionId,
        terminal_id: terminalId,
      };

      await invoke("stop_terminal", { request });
      loadTerminals(); // Refresh the list
    } catch (error) {
      console.error("Failed to stop terminal:", error);
    }
  };

  const sendInputToTerminal = async (terminalId: string, input: string) => {
    try {
      const request: TerminalInputRequest = {
        session_id: props.sessionId,
        terminal_id: terminalId,
        input,
      };

      await invoke("send_terminal_input_to_terminal", { request });
    } catch (error) {
      console.error("Failed to send input to terminal:", error);
    }
  };

  const resizeTerminal = async (terminalId: string, rows: number, cols: number) => {
    try {
      const request: TerminalResizeRequest = {
        session_id: props.sessionId,
        terminal_id: terminalId,
        rows,
        cols,
      };

      await invoke("resize_terminal", { request });
    } catch (error) {
      console.error("Failed to resize terminal:", error);
    }
  };

  const resetCreateForm = () => {
    setNewTerminalName("");
    setNewTerminalShell("");
    setNewTerminalDir("");
    setNewTerminalRows(24);
    setNewTerminalCols(80);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Running": return "text-green-500";
      case "Starting": return "text-yellow-500";
      case "Paused": return "text-blue-500";
      case "Stopped": return "text-gray-500";
      case "Error": return "text-red-500";
      default: return "text-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Running": return "▶";
      case "Starting": return "⏳";
      case "Paused": return "⏸";
      case "Stopped": return "⏹";
      case "Error": return "⚠";
      default: return "❓";
    }
  };

  return (
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div class="bg-gray-800 text-white p-4 flex justify-between items-center">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span class="text-white font-bold">T</span>
            </div>
            <h2 class="text-xl font-semibold">Terminal Manager</h2>
            <span class="text-sm text-gray-300">Session: {props.sessionId.slice(0, 8)}...</span>
          </div>
          <div class="flex items-center space-x-2">
            <button
              onClick={loadTerminals}
              disabled={loading()}
              class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm disabled:opacity-50"
            >
              {loading() ? "Loading..." : "Refresh"}
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
            >
              + New Terminal
            </button>
            <button
              onClick={props.onClose}
              class="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
            >
              Close
            </button>
          </div>
        </div>

        {/* Create Terminal Form */}
        <Show when={showCreateForm()}>
          <div class="bg-gray-100 p-4 border-b">
            <h3 class="font-semibold mb-3">Create New Terminal</h3>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Name (optional)</label>
                <input
                  type="text"
                  value={newTerminalName()}
                  onInput={(e) => setNewTerminalName(e.currentTarget.value)}
                  placeholder="Terminal name"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Shell Path (optional)</label>
                <input
                  type="text"
                  value={newTerminalShell()}
                  onInput={(e) => setNewTerminalShell(e.currentTarget.value)}
                  placeholder="/bin/bash"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Working Directory (optional)</label>
                <input
                  type="text"
                  value={newTerminalDir()}
                  onInput={(e) => setNewTerminalDir(e.currentTarget.value)}
                  placeholder="~/"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Rows</label>
                  <input
                    type="number"
                    value={newTerminalRows()}
                    onInput={(e) => setNewTerminalRows(parseInt(e.currentTarget.value) || 24)}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Cols</label>
                  <input
                    type="number"
                    value={newTerminalCols()}
                    onInput={(e) => setNewTerminalCols(parseInt(e.currentTarget.value) || 80)}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
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
                onClick={createTerminal}
                disabled={creating()}
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
              >
                {creating() ? "Creating..." : "Create Terminal"}
              </button>
            </div>
          </div>
        </Show>

        {/* Terminal List */}
        <div class="flex-1 overflow-y-auto p-4">
          <Show
            when={terminals().length > 0}
            fallback={<div class="text-center text-gray-500 py-8">No terminals found. Create one to get started.</div>}
          >
            <div class="grid gap-3">
              <For each={terminals()}>
                {(terminal) => (
                  <div
                    class={`border rounded-lg p-4 cursor-pointer transition-colors ${selectedTerminal() === terminal.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    onClick={() => setSelectedTerminal(terminal.id)}
                  >
                    <div class="flex justify-between items-start mb-2">
                      <div class="flex-1">
                        <div class="flex items-center space-x-2">
                          <h3 class="font-semibold text-lg">
                            {terminal.name || `Terminal ${terminal.id.slice(0, 8)}`}
                          </h3>
                          <span class={`text-sm ${getStatusColor(terminal.status)}`}>
                            {getStatusIcon(terminal.status)} {terminal.status}
                          </span>
                        </div>
                        <div class="text-sm text-gray-600 mt-1">
                          <div>Shell: {terminal.shell_type}</div>
                          <div>Directory: {terminal.current_dir}</div>
                          <div>Size: {terminal.size[0]}x{terminal.size[1]}</div>
                          <div>PID: {terminal.process_id || "N/A"}</div>
                        </div>
                      </div>
                      <div class="flex flex-col space-y-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            stopTerminal(terminal.id);
                          }}
                          class="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded"
                        >
                          Stop
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            resizeTerminal(terminal.id, 30, 100);
                          }}
                          class="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded"
                        >
                          Resize
                        </button>
                      </div>
                    </div>

                    {/* Terminal Input Section */}
                    <Show when={selectedTerminal() === terminal.id && terminal.status === "Running"}>
                      <div class="mt-3 pt-3 border-t">
                        <div class="flex space-x-2">
                          <input
                            type="text"
                            value={terminalInput()}
                            onInput={(e) => setTerminalInput(e.currentTarget.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && terminalInput().trim()) {
                                sendInputToTerminal(terminal.id, terminalInput() + "\n");
                                setTerminalInput("");
                              }
                            }}
                            placeholder="Enter command..."
                            class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            onClick={() => {
                              if (terminalInput().trim()) {
                                sendInputToTerminal(terminal.id, terminalInput() + "\n");
                                setTerminalInput("");
                              }
                            }}
                            disabled={!terminalInput().trim()}
                            class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Send
                          </button>
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
          <div>Total terminals: {terminals().length}</div>
        </div>
      </div>
    </div>
  );
}
