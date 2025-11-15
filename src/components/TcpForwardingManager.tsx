import { createSignal, createEffect, onMount, Show, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface TcpForwardingSession {
  id: string;
  local_addr: string;
  remote_target: string;
  forwarding_type: string;
  active_connections: number;
  bytes_sent: number;
  bytes_received: number;
  status: string;
  created_at: number;
}

interface TcpForwardingManagerProps {
  sessionId: string;
}

export const TcpForwardingManager = (props: TcpForwardingManagerProps) => {
  const [sessions, setSessions] = createSignal<TcpForwardingSession[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [showCreateForm, setShowCreateForm] = createSignal(false);
  const [formData, setFormData] = createSignal({
    localAddr: "127.0.0.1:8080",
    remoteHost: "127.0.0.1",
    remotePort: "3000",
    forwardingType: "ConnectToRemote" as "ListenToRemote" | "ConnectToRemote"
  });

  // 监听 TCP 转发事件
  createEffect(() => {
    const unlistenForwarding = listen(`tcp-forwarding-${props.sessionId}`, (event: any) => {
      console.log("TCP forwarding event:", event.payload);
      // 直接更新会话列表数据，避免循环调用
      if (event.payload.sessions && Array.isArray(event.payload.sessions)) {
        setSessions(event.payload.sessions);
        setIsLoading(false); // 确保关闭 loading 状态
      }
    });

    const unlistenData = listen(`tcp-data-${props.sessionId}`, (event: any) => {
      console.log("TCP data event:", event.payload);
      // TCP 数据事件不需要刷新会话列表
    });

    const unlistenResponse = listen(`session-response-${props.sessionId}`, (event: any) => {
      console.log("Session response:", event.payload);
      // 检查是否是 TCP 转发相关的响应
      if (event.payload.request_id && event.payload.data) {
        try {
          const responseData = JSON.parse(event.payload.data);
          if (responseData.sessions && Array.isArray(responseData.sessions)) {
            // 直接更新会话列表，避免循环调用
            setSessions(responseData.sessions);
            setIsLoading(false); // 确保关闭 loading 状态
          } else if (responseData.session_id) {
            // 单个会话更新，重新加载列表（但防止无限循环）
            setIsLoading(false); // 先关闭当前 loading
          }
        } catch (e) {
          console.log("Response data is not JSON:", event.payload.data);
          setIsLoading(false); // 确保在出错时也关闭 loading
        }
      }
    });

    return () => {
      unlistenForwarding.then(fn => fn());
      unlistenData.then(fn => fn());
      unlistenResponse.then(fn => fn());
    };
  });

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      await invoke("list_tcp_forwarding_sessions", { sessionId: props.sessionId });
      // 注意：实际的会话数据将通过事件监听器更新，这里不直接更新状态
    } catch (error) {
      console.error("Failed to load TCP forwarding sessions:", error);
      setIsLoading(false);
    }
  };

  const createSession = async () => {
    try {
      setIsLoading(true);
      const { localAddr, remoteHost, remotePort, forwardingType } = formData();

      await invoke("create_tcp_forwarding_session", {
        sessionId: props.sessionId,
        localAddr,
        remoteHost: remoteHost || undefined,
        remotePort: remotePort ? parseInt(remotePort) : undefined,
        forwardingType
      });

      // 重置表单并关闭
      setFormData({
        localAddr: "127.0.0.1:8080",
        remoteHost: "127.0.0.1",
        remotePort: "3000",
        forwardingType: "ListenToRemote"
      });
      setShowCreateForm(false);

      // 不需要手动调用 loadSessions，事件会自动更新
      // 如果需要手动刷新，给一个短暂延迟避免事件冲突
      setTimeout(() => {
        if (isLoading()) {
          setIsLoading(false);
        }
      }, 1000);
    } catch (error) {
      console.error("Failed to create TCP forwarding session:", error);
      alert("创建 TCP 转发会话失败: " + error);
      setIsLoading(false);
    }
  };

  const stopSession = async (sessionId: string) => {
    // if (!confirm("Are you sure you want to stop this TCP forwarding session?")) {
    //   return;
    // }

    try {
      setIsLoading(true);
      await invoke("stop_tcp_forwarding_session", {
        sessionId: props.sessionId,
        tcpSessionId: sessionId
      });

      // 不需要手动调用 loadSessions，事件会自动更新
      // 如果需要手动刷新，给一个短暂延迟避免事件冲突
      setTimeout(() => {
        if (isLoading()) {
          setIsLoading(false);
        }
        loadSessions();
      }, 1000);
    } catch (error) {
      console.error("Failed to stop TCP forwarding session:", error);
      alert("停止 TCP 转发会话失败: " + error);
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  onMount(() => {
    loadSessions();
  });

  return (
    <div class="p-4 max-w-6xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <div class="space-x-2">
          <button
            class="btn btn-primary"
            onClick={() => setShowCreateForm(true)}
            disabled={isLoading()}
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M12 4v16m8-8H4" />
            </svg>
            New Session
          </button>
          <button
            class="btn btn-secondary"
            onClick={loadSessions}
            disabled={isLoading()}
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* 创建会话表单 */}
      <Show when={showCreateForm()}>
        <div class="card bg-base-100 shadow-xl mb-6">
          <div class="card-body">
            <h3 class="card-title">Create TCP Forwarding Session</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="form-control">
                <label class="label">
                  <span class="label-text font-medium">Local Address</span>
                </label>
                <input
                  type="text"
                  placeholder="127.0.0.1:8080"
                  class="input input-bordered w-full font-mono text-sm"
                  value={formData().localAddr}
                  onInput={(e) => setFormData(prev => ({ ...prev, localAddr: e.currentTarget.value }))}
                />
              </div>

              <div class="form-control">
                <label class="label">
                  <span class="label-text font-medium">Forwarding Type</span>
                </label>
                <select
                  class="select select-bordered w-full"
                  value={formData().forwardingType}
                  onChange={(e) => setFormData(prev => ({ ...prev, forwardingType: e.currentTarget.value as "ListenToRemote" | "ConnectToRemote" }))}
                >
                  <option value="ConnectToRemote">Connect to Remote → Forward to Local</option>
                  <option value="ListenToRemote">Listen on Local → Forward to Remote</option>
                </select>
              </div>

              <div class="form-control">
                <label class="label">
                  <span class="label-text font-medium">Remote Host</span>
                </label>
                <input
                  type="text"
                  placeholder="127.0.0.1"
                  class="input input-bordered w-full font-mono text-sm"
                  value={formData().remoteHost}
                  onInput={(e) => setFormData(prev => ({ ...prev, remoteHost: e.currentTarget.value }))}
                />
              </div>

              <div class="form-control">
                <label class="label">
                  <span class="label-text font-medium">Remote Port</span>
                </label>
                <input
                  type="number"
                  placeholder="3000"
                  class="input input-bordered w-full font-mono text-sm"
                  value={formData().remotePort}
                  onInput={(e) => setFormData(prev => ({ ...prev, remotePort: e.currentTarget.value }))}
                />
              </div>
            </div>

            <div class="card-actions justify-end mt-4">
              <button
                class="btn btn-ghost"
                onClick={() => setShowCreateForm(false)}
                disabled={isLoading()}
              >
                Cancel
              </button>
              <button
                class="btn btn-primary"
                onClick={createSession}
                disabled={isLoading()}
              >
                {isLoading() ? (
                  <span class="loading loading-spinner loading-sm"></span>
                ) : (
                  "Create Session"
                )}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* 会话列表 */}
      <div class="grid grid-cols1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <For each={sessions()}>
          {(session) => (
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <div class="card-title justify-between">
                  <h3 class="text-lg">{session.id.slice(0, 8)}...</h3>
                  <span class={`badge badge-sm ${session.status === 'running' ? 'badge-success' : session.status === 'stopped' ? 'badge-error' : 'badge-warning'}`}>
                    {session.status}
                  </span>
                </div>

                <div class="space-y-3 text-sm">
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-base-content/70">Local:</span>
                    <span class="font-mono text-xs bg-base-200 px-2 py-1 rounded">{session.local_addr}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-base-content/70">Remote:</span>
                    <span class="font-mono text-xs bg-base-200 px-2 py-1 rounded">{session.remote_target}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-base-content/70">Type:</span>
                    <span class="text-xs badge badge-outline">{session.forwarding_type}</span>
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    <div class="flex items-center space-x-2">
                      <span class="font-medium text-base-content/70">Connections:</span>
                      <span class="font-semibold">{session.active_connections}</span>
                    </div>
                    <div class="flex items-center space-x-2">
                      <span class="font-medium text-base-content/70">Status:</span>
                      <span class={`badge badge-xs ${session.status === 'running' ? 'badge-success' : session.status === 'stopped' ? 'badge-error' : 'badge-warning'}`}>
                        {session.status}
                      </span>
                    </div>
                  </div>
                  <div class="border-t pt-3">
                    <div class="grid grid-cols-2 gap-4 text-xs">
                      <div class="flex flex-col">
                        <span class="font-medium text-base-content/70 mb-1">Sent</span>
                        <span class="font-mono text-success">{formatBytes(session.bytes_sent)}</span>
                      </div>
                      <div class="flex flex-col">
                        <span class="font-medium text-base-content/70 mb-1">Received</span>
                        <span class="font-mono text-info">{formatBytes(session.bytes_received)}</span>
                      </div>
                    </div>
                  </div>
                  <div class="text-xs text-base-content/50 border-t pt-2">
                    Created: {formatDate(session.created_at)}
                  </div>
                </div>

                <div class="card-actions justify-end mt-4">
                  <button
                    class="btn btn-error btn-sm"
                    onClick={() => stopSession(session.id)}
                    disabled={isLoading()}
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Stop
                  </button>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* 空状态 */}
      <Show when={sessions().length === 0 && !isLoading()}>
        <div class="text-center py-12">
          <svg class="w-16 h-16 mx-auto text-base-content/40 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <p class="text-base-content/60 mb-4">Create a forwarding session to start managing TCP services</p>
          <button
            class="btn btn-primary"
            onClick={() => setShowCreateForm(true)}
          >
            Create First Session
          </button>
        </div>
      </Show>

      {/* 加载状态 */}
      <Show when={isLoading()}>
        <div class="text-center py-8">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      </Show>
    </div>
  );
};
