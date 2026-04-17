import { createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { sessionStore } from "~/stores/sessionStore";
import { notificationStore } from "~/stores/notificationStore";
import { navigationStore } from "~/stores/navigationStore";

export default function ConnectPage() {
  const navigate = useNavigate();
  const [ticket, setTicket] = createSignal("");
  const [connecting, setConnecting] = createSignal(false);

  const handleConnect = async () => {
    const t = ticket().trim();
    if (!t) {
      notificationStore.error("Please enter a session ticket", "Error");
      return;
    }

    sessionStore.setSessionTicket(t);
    setConnecting(true);

    try {
      await sessionStore.handleRemoteConnect();
      const sessions = sessionStore.getSessions();
      if (sessions.length > 0) {
        // Auto-select the first existing remote session and go to chat
        sessionStore.setActiveSession(sessions[0].sessionId);
        navigationStore.setActiveView("chat");
      } else {
        // No existing sessions: open the new-session modal so user can spawn one
        const controlId = sessionStore.state.targetControlSessionId;
        sessionStore.openNewSessionModal("remote", controlId || undefined, false);
      }
      navigate("/app");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      notificationStore.error(message, "Connection Failed");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div class="min-h-screen flex items-center justify-center bg-base-100 p-4">
      <div class="w-full max-w-md card bg-base-200 shadow-xl">
        <div class="card-body">
          <h1 class="card-title text-2xl font-bold">Irogen Browser</h1>
          <p class="text-base-content/70">
            Connect to a remote Irogen host via ticket
          </p>

          <div class="form-control mt-4">
            <label class="label">
              <span class="label-text">Session Ticket</span>
            </label>
            <textarea
              class="textarea textarea-bordered h-24 font-mono text-sm"
              placeholder="Paste your session ticket here..."
              value={ticket()}
              onInput={(e) => setTicket(e.currentTarget.value)}
            />
          </div>

          <button
            class="btn btn-primary mt-4"
            disabled={connecting()}
            onClick={handleConnect}
          >
            {connecting() ? (
              <>
                <span class="loading loading-spinner loading-sm" />
                Connecting...
              </>
            ) : (
              "Connect"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
