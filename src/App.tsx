import {
  createSignal,
  createEffect,
  onMount,
  createMemo,
  onCleanup,
  For,
} from "solid-js";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";
import {
  createConnectionHistory,
  HistoryEntry,
} from "./hooks/useConnectionHistory";
import { EnhancedTerminalView } from "./components/EnhancedTerminalView";
import { SettingsModal } from "./components/SettingsModal";
import { HomeView } from "./components/HomeView";
import { MobileNavigation } from "./components/ui/MobileNavigation";
import { P2PBackground } from "./components/P2PBackground";
import { t } from "./stores/settingsStore";
import {
  initializeMobileUtils,
  getDeviceCapabilities,
  MobileKeyboard,
  KeyboardInfo,
} from "./utils/mobile";

function App() {
  const [sessionTicket, setSessionTicket] = createSignal("");
  const [connecting, setConnecting] = createSignal(false);
  const [status, setStatus] = createSignal("Disconnected");
  const [connectionError, setConnectionError] = createSignal<string | null>(
    null
  );
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false);
  const [isLoggedIn, setIsLoggedIn] = createSignal(false);
  const [networkStrength, setNetworkStrength] = createSignal(3);
  const [currentView, setCurrentView] = createSignal<"home" | "terminal">(
    "home"
  );

  // Multi-session state management
  const [activeSessions, setActiveSessions] = createSignal<Map<string, {
    sessionId: string;
    ticket: string;
    terminal: Terminal | null;
    fitAddon: FitAddon | null;
    unlisten: (() => void) | null;
    terminalInfo: {
      sessionTitle: string;
      terminalType: string;
      workingDirectory: string;
    };
  }>>(new Map());
  const [currentSessionTicket, setCurrentSessionTicket] = createSignal<string | null>(null);
  const [currentTime, setCurrentTime] = createSignal(
    new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    })
  );

  // Enhanced mobile keyboard state management
  const [keyboardVisible, setKeyboardVisible] = createSignal(false);
  const [keyboardHeight, setKeyboardHeight] = createSignal(0);
  const [effectiveViewportHeight, setEffectiveViewportHeight] = createSignal(
    window.innerHeight
  );
  const [debugInfo, setDebugInfo] = createSignal("");

  // Computed values for current session
  const isConnected = createMemo(() => activeSessions().size > 0);
  const activeTicket = createMemo(() => currentSessionTicket());
  const currentSession = createMemo(() => {
    const ticket = currentSessionTicket();
    return ticket ? activeSessions().get(ticket) : null;
  });
  const terminalInfo = createMemo(() => {
    const session = currentSession();
    return session?.terminalInfo || {
      sessionTitle: "RiTerm",
      terminalType: "shell",
      workingDirectory: "~"
    };
  });

  const { history, addHistoryEntry, updateHistoryEntry, deleteHistoryEntry } =
    createConnectionHistory();

  // Enhanced mobile initialization and keyboard state management
  onMount(() => {
    // Initialize enhanced mobile utilities
    initializeMobileUtils();

    // Time update timer
    const timer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }, 1000);

    // Enhanced keyboard visibility tracking with the new mobile utilities
    const unsubscribeKeyboard = MobileKeyboard.onVisibilityChange(
      (visible: boolean, keyboardInfo?: KeyboardInfo) => {
        setKeyboardVisible(visible);

        if (keyboardInfo) {
          setKeyboardHeight(keyboardInfo.height);
          setEffectiveViewportHeight(
            keyboardInfo.viewportHeight - (keyboardInfo.viewportOffsetTop || 0)
          );

          // Enhanced debug info
          setDebugInfo(
            `Keyboard: ${visible ? "Visible" : "Hidden"}, ` +
            `Height: ${keyboardInfo.height}px, ` +
            `Viewport: ${keyboardInfo.viewportHeight}px, ` +
            `Effective: ${keyboardInfo.viewportHeight -
            (keyboardInfo.viewportOffsetTop || 0)
            }px`
          );
        } else {
          setKeyboardHeight(0);
          setEffectiveViewportHeight(window.innerHeight);
          setDebugInfo("Keyboard: Hidden");
        }
      }
    );

    onCleanup(() => {
      clearInterval(timer);
      unsubscribeKeyboard();
    });
  });

  const initializeNetwork = async () => {
    try {
      const nodeId = await invoke<string>("initialize_network");
      setStatus(`Ready - Node ID: ${nodeId.substring(0, 8)}...`);
      setNetworkStrength(4); // Full network strength when connected
    } catch (error) {
      console.error("Failed to initialize network:", error);
      setStatus("Failed to initialize network");
      setNetworkStrength(0); // No network when failed
    }
  };

  // Helper function to get session display info
  const getSessionDisplayInfo = createMemo(() => {
    const sessionCount = activeSessions().size;
    if (sessionCount === 0) return { count: 0, status: "Disconnected" };
    if (sessionCount === 1) return { count: 1, status: "Connected" };
    return { count: sessionCount, status: `Connected to ${sessionCount} sessions` };
  });

  onMount(() => {
    // 初始化网络
    initializeNetwork();
  });

  const handleTerminalReady = (term: Terminal, addon: FitAddon) => {
    const ticket = currentSessionTicket();
    if (ticket) {
      const sessions = activeSessions();
      const session = sessions.get(ticket);
      if (session) {
        session.terminal = term;
        session.fitAddon = addon;
        setActiveSessions(new Map(sessions));
        window.addEventListener("resize", () => addon.fit());

        // Initialize terminal with welcome message if it's a new connection
        if (!session.terminal) {
          term.clear();
          term.writeln("\r\n\x1b[1;32m🚀 P2P Connection established!\x1b[0m");
          term.focus();
        }
      }
    }
  };

  const handleTerminalInput = (data: string) => {
    const session = currentSession();
    if (session?.sessionId) {
      invoke("send_terminal_input", {
        sessionId: session.sessionId,
        input: data,
      }).catch((error) => {
        console.error("Failed to send input:", error);
        session.terminal?.writeln(`\r\n❌ Failed to send input: ${error}`);
      });
    }
  };

  const handleDisconnect = async (ticketToDisconnect?: string) => {
    const ticket = ticketToDisconnect || currentSessionTicket();
    if (!ticket) return;

    const sessions = activeSessions();
    const session = sessions.get(ticket);

    if (session) {
      // Show disconnect message in terminal
      if (session.terminal) {
        session.terminal.writeln(
          "\r\n\x1b[1;33m👋 Disconnected from session\x1b[0m"
        );
      }

      // Update history
      updateHistoryEntry(ticket, {
        status: "Completed",
        description: "Session ended by user.",
      });

      // Disconnect from backend
      if (session.sessionId) {
        try {
          await invoke("disconnect_session", { sessionId: session.sessionId });
        } catch (error) {
          console.error("Failed to disconnect:", error);
        }
      }

      // Clean up event listener
      if (session.unlisten) {
        session.unlisten();
      }

      // Remove session from active sessions
      sessions.delete(ticket);
      setActiveSessions(new Map(sessions));

      // If this was the current session, switch to another or go home
      if (currentSessionTicket() === ticket) {
        const remainingSessions = Array.from(sessions.keys());
        if (remainingSessions.length > 0) {
          setCurrentSessionTicket(remainingSessions[0]);
        } else {
          setCurrentSessionTicket(null);
          setCurrentView("home");
        }
      }
    }

    // Update status based on remaining connections
    if (activeSessions().size === 0) {
      setStatus(t("connection.status.disconnected"));
      setNetworkStrength(3);
    } else {
      setStatus(`Connected to ${activeSessions().size} session(s)`);
    }
  };

  const handleConnect = async (ticketOverride?: string) => {
    const ticket = (ticketOverride || sessionTicket()).trim();
    if (!ticket) {
      setConnectionError("Please enter a session ticket.");
      return;
    }

    // Check if this ticket is already connected
    const sessions = activeSessions();
    if (sessions.has(ticket)) {
      // Already connected to this ticket, just switch to it
      setCurrentSessionTicket(ticket);
      setCurrentView("terminal");
      setConnectionError(null);
      return;
    }

    // If a new ticket is used, add it to history
    if (!history().some((h) => h.ticket === ticket)) {
      addHistoryEntry(ticket);
    }

    setConnecting(true);
    setStatus(t("connection.status.connecting"));
    setConnectionError(null);

    try {
      const connectPromise = invoke<string>("connect_to_peer", {
        sessionTicket: ticket,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Connection timed out after 5 seconds")),
          5000
        )
      );

      const actualSessionId = await Promise.race([
        connectPromise,
        timeoutPromise,
      ]);

      // Create new session entry
      const newSession = {
        sessionId: actualSessionId,
        ticket: ticket,
        terminal: null as Terminal | null,
        fitAddon: null as FitAddon | null,
        unlisten: null as (() => void) | null,
        terminalInfo: {
          sessionTitle: "RiTerm",
          terminalType: "shell",
          workingDirectory: "~",
        },
      };

      // Set up event listener for this session
      const unlisten = await listen<any>(
        `terminal-event-${actualSessionId}`,
        (event) => {
          const termEvent = event.payload;
          console.log("📜 Received terminal event:", termEvent);

          const currentSessions = activeSessions();
          const session = currentSessions.get(ticket);

          if (session?.terminal) {
            if (termEvent.event_type === "Output") {
              session.terminal.write(termEvent.data);
            } else if (termEvent.event_type === "End") {
              // INFO: 其他端退出不影响本端
              // session.terminal.writeln("\r\n\r\n[Session Ended]");
              // handleDisconnect(ticket);
            } else if (termEvent.event_type === "HistoryData") {
              // 处理接收到的历史记录数据
              console.log("📜 Received session history:", termEvent.data);

              try {
                const historyData = JSON.parse(termEvent.data);
                const { logs, shell, cwd } = historyData;

                // 更新终端信息
                session.terminalInfo = {
                  sessionTitle: `Remote Shell`,
                  terminalType: shell || "shell",
                  workingDirectory: cwd || "~",
                };

                // 在终端中显示历史记录
                session.terminal.writeln(
                  "\r\n\x1b[1;36m📜 Session History Received\x1b[0m"
                );
                session.terminal.writeln(`\x1b[1;33mShell:\x1b[0m ${shell}`);
                session.terminal.writeln(
                  `\x1b[1;33mWorking Directory:\x1b[0m ${cwd}`
                );
                session.terminal.writeln(
                  "\x1b[1;33m--- History Start ---\x1b[0m"
                );
                session.terminal.write(logs);
                session.terminal.writeln(
                  "\x1b[1;33m--- History End ---\x1b[0m\r\n"
                );

                // 更新连接历史记录
                updateHistoryEntry(ticket, {
                  description: `Connected with history (Shell: ${shell}, CWD: ${cwd})`,
                });

                // Update sessions map
                setActiveSessions(new Map(currentSessions));

                console.log(
                  `✅ History displayed: ${logs.length} characters, Shell: ${shell}, CWD: ${cwd}`
                );
              } catch (error) {
                console.error("❌ Failed to parse history data:", error);
                session.terminal.writeln(
                  "\r\n\x1b[1;31m❌ Failed to parse session history\x1b[0m\r\n"
                );
              }
            }
          }
        }
      );

      newSession.unlisten = unlisten;

      // Add session to active sessions
      const updatedSessions = new Map(sessions);
      updatedSessions.set(ticket, newSession);
      setActiveSessions(updatedSessions);

      // Set as current session and switch to terminal view
      setCurrentSessionTicket(ticket);
      setCurrentView("terminal");
      updateHistoryEntry(ticket, { description: "Connection established." });

      setStatus(`Connected to ${updatedSessions.size} session(s)`);
      setNetworkStrength(4);

      console.log(`✅ Connected to session: ${ticket}`);
    } catch (error) {
      console.error("Connection failed:", error);
      setStatus(t("connection.status.failed"));
      updateHistoryEntry(ticket, {
        status: "Failed",
        description: String(error),
      });
      setConnectionError(String(error));
      setNetworkStrength(1);
    } finally {
      setConnecting(false);
    }
  };

  const handleLogin = (username: string, password: string) => {
    // TODO: Implement actual authentication
    console.log("Login attempt:", username);
    setIsLoggedIn(true);
  };

  const handleSkipLogin = () => {
    setIsLoggedIn(true);
  };

  const activeHistoryEntry = createMemo(() =>
    history().find((entry) => entry.ticket === activeTicket())
  );

  return (
    <div
      class="w-full font-mono mobile-viewport"
      data-theme="riterm-mobile"
      style={{
        height: keyboardVisible() ? `${effectiveViewportHeight()}px` : "100vh",
        "max-height": keyboardVisible()
          ? `${effectiveViewportHeight()}px`
          : "100vh",
        "padding-top": "env(safe-area-inset-top)",
        "padding-bottom": keyboardVisible()
          ? "0px"
          : "env(safe-area-inset-bottom)",
        transition:
          "height 0.2s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden", // 防止滚动
        position: "relative",
      }}
    >
      {/* P2P Background */}
      <P2PBackground />

      {/* Main Layout - Mobile First */}
      <div
        class="relative z-20 w-full flex flex-col overflow-hidden"
        style={{
          height: keyboardVisible() ? `${effectiveViewportHeight()}px` : "100%",
          "max-height": keyboardVisible()
            ? `${effectiveViewportHeight()}px`
            : "100%",
          transition:
            "height 0.2s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Mobile Navigation */}
        <MobileNavigation
          currentView={currentView()}
          onViewChange={setCurrentView}
          isConnected={isConnected()}
          networkStrength={networkStrength()}
          status={getSessionDisplayInfo().status}
          currentTime={currentTime()}
          onDisconnect={() => handleDisconnect()}
          onShowSettings={() => setIsSettingsOpen(true)}
        />

        {/* Debug Info - 开发时显示 */}
        {/* {window.location.hostname === "localhost" && ( */}
        {/*   <div class="bg-yellow-100 text-black text-xs p-2 border-b shrink-0"> */}
        {/*     Debug: {debugInfo()} | KB: {keyboardVisible() ? "Yes" : "No"} | */}
        {/*     EffectiveVH: {effectiveViewportHeight()}px | KH: {keyboardHeight()} */}
        {/*     px */}
        {/*   </div> */}
        {/* )} */}

        {/* Session Tabs - Show when multiple sessions are active */}
        {activeSessions().size > 1 && currentView() === "terminal" && (
          <div class="bg-gray-800 border-b border-gray-700 px-2 py-1 flex gap-1 overflow-x-auto">
            <For each={Array.from(activeSessions().entries())}>
              {([ticket, session]) => (
                <button
                  class={`px-3 py-1 text-xs rounded-t-lg border-b-2 whitespace-nowrap flex items-center gap-2 ${currentSessionTicket() === ticket
                    ? "bg-gray-700 border-blue-500 text-white"
                    : "bg-gray-900 border-transparent text-gray-400 hover:text-white hover:bg-gray-800"
                    }`}
                  onClick={() => setCurrentSessionTicket(ticket)}
                >
                  <span>{session.terminalInfo.sessionTitle}</span>
                  <button
                    class="text-red-400 hover:text-red-300 ml-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDisconnect(ticket);
                    }}
                  >
                    ×
                  </button>
                </button>
              )}
            </For>
          </div>
        )}

        {/* Main Content */}
        <div
          class="flex-1 overflow-hidden" // 改为overflow-hidden防止滚动问题
          style={{
            height: keyboardVisible()
              ? `${effectiveViewportHeight() - (activeSessions().size > 1 && currentView() === "terminal" ? 100 : 60)}px` // 导航栏高度约60px，标签栏40px
              : "auto",
            "max-height": keyboardVisible()
              ? `${effectiveViewportHeight() - (activeSessions().size > 1 && currentView() === "terminal" ? 100 : 60)}px`
              : "none",
            transition:
              "height 0.2s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {currentView() === "terminal" && isConnected() && currentSession() ? (
            <EnhancedTerminalView
              onReady={handleTerminalReady}
              onInput={handleTerminalInput}
              isConnected={isConnected()}
              onDisconnect={() => handleDisconnect()}
              onShowKeyboard={() => {
                /* TODO: Implement mobile keyboard */
              }}
              sessionTitle={terminalInfo().sessionTitle}
              terminalType={terminalInfo().terminalType}
              workingDirectory={terminalInfo().workingDirectory}
              keyboardVisible={keyboardVisible()}
              safeViewportHeight={effectiveViewportHeight()}
              onKeyboardToggle={(visible) => {
                // 处理内部移动键盘状态变化
                console.log("Terminal internal keyboard toggled:", visible);
              }}
            />
          ) : (
            <HomeView
              sessionTicket={sessionTicket()}
              onTicketInput={setSessionTicket}
              onConnect={handleConnect}
              onShowSettings={() => setIsSettingsOpen(true)}
              connecting={connecting()}
              connectionError={connectionError()}
              history={history()}
              isLoggedIn={isLoggedIn()}
              onLogin={handleLogin}
              onSkipLogin={handleSkipLogin}
              isConnected={isConnected()}
              activeTicket={activeTicket()}
              onReturnToSession={() => {
                if (activeSessions().size > 0) {
                  const firstSession = Array.from(activeSessions().keys())[0];
                  setCurrentSessionTicket(firstSession);
                  setCurrentView("terminal");
                }
              }}
              onDeleteHistory={deleteHistoryEntry}
              onDisconnect={handleDisconnect}
            />
          )}
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen()}
        onClose={() => setIsSettingsOpen(false)}
        entry={activeHistoryEntry() || null}
        onSave={(ticket, updates) => updateHistoryEntry(ticket, updates)}
      />
    </div>
  );
}

export default App;
