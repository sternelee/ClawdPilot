import { createSignal, Show, For } from "solid-js";
import { getDeviceCapabilities } from "../utils/mobile";

interface HomeViewProps {
  sessionTicket: string;
  onTicketInput: (value: string) => void;
  onConnect: (ticket?: string) => void;
  onShowSettings: () => void;
  connecting: boolean;
  connectionError: string | null;
  isLoggedIn: boolean;
  onLogin: (username: string, password: string) => void;
  onSkipLogin: () => void;
  isConnected: boolean;
  activeTicket: string | null;
  onReturnToSession: () => void;
  onDisconnect: () => void;
}

export function HomeView(props: HomeViewProps) {
  const [showLoginModal, setShowLoginModal] = createSignal(false);
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");

  // 检测设备类型
  const deviceCapabilities = getDeviceCapabilities();
  const isMobile = deviceCapabilities.isMobile;

  const handleLogin = () => {
    props.onLogin(username(), password());
    setShowLoginModal(false);
  };

  const handleQuickConnect = (ticket: string) => {
    props.onConnect(ticket);
  };

  const handleShowQRScanner = async () => {
    try {
      // 使用Tauri的条码扫描插件
      const { scan } = await import("@tauri-apps/plugin-barcode-scanner");
      const result = await scan();
      console.log(result);
      if (result) {
        props.onTicketInput(result.content);
      }
    } catch (error) {
      console.error("QR Scanner error:", error);
    }
  };

  // 登录模态框
  const renderLoginModal = () => (
    <Show when={showLoginModal()}>
      <div
        class="fixed inset-0 bg-black/50 z-50 flex items-end justify-center md:items-center"
        onClick={() => setShowLoginModal(false)}
      >
        <div
          class="bg-base-100 w-full max-w-md rounded-t-3xl md:rounded-2xl p-6 transform transition-transform"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="text-center mb-6">
            <div class="w-12 h-1 bg-base-300 rounded-full mx-auto mb-4 md:hidden"></div>
            <h2 class="text-2xl font-bold mb-2">登录</h2>
            <p class="text-sm opacity-70">登录后解锁完整功能</p>
          </div>

          <div class="space-y-4">
            <div class="form-control">
              <label class="label">
                <span class="label-text font-medium">用户名</span>
              </label>
              <input
                type="text"
                placeholder="输入用户名"
                class="input input-bordered w-full"
                value={username()}
                onInput={(e) => setUsername(e.currentTarget.value)}
              />
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text font-medium">密码</span>
              </label>
              <input
                type="password"
                placeholder="输入密码"
                class="input input-bordered w-full"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    username().trim() &&
                    password().trim()
                  ) {
                    handleLogin();
                  }
                }}
              />
            </div>

            <div class="flex space-x-3 mt-6">
              <button
                class="btn btn-primary flex-1"
                onClick={handleLogin}
                disabled={!username().trim() || !password().trim()}
              >
                🔑 登录
              </button>
            </div>

            <div class="text-center text-xs opacity-50 mt-4">
              <p>登陆后解锁完整功能</p>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );

  
  // 主页渲染 - 简洁设计
  const renderMainView = () => (
    <div class="min-h-screen bg-base-100 flex flex-col">
      {/* 主内容区域 - Logo 和 Slogan */}
      <div class="flex-1 flex flex-col items-center justify-center p-6">
        {/* Logo */}
        <div class="text-center mb-12">
          <div class="text-6xl text-primary mb-6">⚡</div>
          <h1 class="text-4xl font-bold mb-3">
            RiTerm
          </h1>
          <p class="text-lg text-base-content/70 max-w-sm">
            P2P 终端远程连接工具
          </p>
        </div>

        {/* 连接输入框 */}
        <div class="w-full max-w-md mb-4">
          <div class="flex items-center space-x-2">
            <div class="flex-1">
              <input
                type="text"
                value={props.sessionTicket}
                onInput={(e) => props.onTicketInput(e.currentTarget.value)}
                placeholder="输入会话票据..."
                class="input input-bordered w-full"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && props.sessionTicket.trim()) {
                    props.onConnect();
                  }
                }}
                autoFocus
              />
              {props.connectionError && (
                <div class="text-error text-sm mt-1">{props.connectionError}</div>
              )}
            </div>
            {/* 扫码按钮 - 仅移动端显示 */}
            <Show when={isMobile}>
              <button
                class="btn btn-outline"
                onClick={handleShowQRScanner}
              >
                📷
              </button>
            </Show>
          </div>
        </div>

        {/* 登录按钮 */}
        {/* <EnhancedButton */}
        {/*   variant="primary" */}
        {/*   size="lg" */}
        {/*   fullWidth */}
        {/*   onClick={() => setShowLoginModal(true)} */}
        {/*   icon="🚀" */}
        {/*   haptic */}
        {/*   class="max-w-md" */}
        {/* > */}
        {/*   帐号登录 */}
        {/* </EnhancedButton> */}
      </div>
    </div>
  );

  return (
    <div class="font-mono">
      {/* 主页内容 */}
      {renderMainView()}

      {/* 登录模态框 */}
      {renderLoginModal()}

      {/* 正在连接的加载遮罩 */}
      <Show when={props.connecting}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div class="bg-base-100 p-8 rounded-2xl text-center">
            <div class="loading loading-spinner loading-lg mb-4"></div>
            <div class="font-medium">正在连接...</div>
            <div class="text-sm opacity-70 mt-2">请稍候</div>
          </div>
        </div>
      </Show>
    </div>
  );
}
