/**
 * PredictionEngine - 预测性本地回显引擎
 *
 * 参考 Mosh (Mobile Shell) 的设计理念，实现低延迟的终端输入体验。
 *
 * 核心思想：
 * 1. 用户输入时立即在本地显示（预测）
 * 2. 同时发送到远程终端
 * 3. 远程回显到达时，验证预测并去重
 * 4. 预测错误时回滚
 *
 * 与 Mosh 的区别：
 * - Mosh 维护完整的终端状态（Framebuffer），clawdchat 只做字符级预测
 * - Mosh 使用 epoch 系统处理复杂回滚，clawdchat 使用简化的队列机制
 */

export interface PredictionConfig {
  /** 是否启用预测 */
  enabled: boolean;
  /** 预测显示模式 */
  displayMode: "always" | "never" | "adaptive";
  /** 高 RTT 阈值 (ms)，超过此值激活预测 */
  rttThresholdHigh: number;
  /** 低 RTT 阈值 (ms)，低于此值关闭预测 */
  rttThresholdLow: number;
  /** 预测超时 (ms)，超过此时间未确认则标记为可疑 */
  predictionTimeout: number;
  /** 是否对未确认预测添加下划线 */
  flagUnconfirmed: boolean;
}

export interface Prediction {
  /** 预测的字符 */
  char: string;
  /** 预测时的帧 ID */
  frameId: number;
  /** 创建时间戳 */
  timestamp: number;
  /** 是否已确认 */
  confirmed: boolean;
}

export interface PredictionStats {
  /** 总预测数 */
  totalPredictions: number;
  /** 正确预测数 */
  correctPredictions: number;
  /** 错误预测数 */
  incorrectPredictions: number;
  /** 当前待确认预测数 */
  pendingCount: number;
  /** 预测准确率 */
  accuracy: number;
  /** 平均 RTT */
  averageRtt: number;
}

type WriteCallback = (data: string) => void;
type SendCallback = (data: string) => void;

export class PredictionEngine {
  private config: PredictionConfig;
  private predictions: Prediction[] = [];
  private frameCounter: number = 0;
  private lastAckedFrame: number = 0;

  // 统计信息
  private stats = {
    total: 0,
    correct: 0,
    incorrect: 0,
    rttSamples: [] as number[],
  };

  // RTT 估算
  private estimatedRtt: number = 0;
  private rttTriggerActive: boolean = false;

  // 回调
  private writeToTerminal: WriteCallback | null = null;
  private sendToRemote: SendCallback | null = null;

  // 特殊模式检测
  private inPasswordMode: boolean = false;
  private consecutiveNonEcho: number = 0;

  // 重绘模式检测 (zsh-autosuggestions, zsh-syntax-highlighting 等)
  private inRedrawMode: boolean = false;
  private redrawModeCounter: number = 0;
  private readonly REDRAW_MODE_THRESHOLD: number = 1; // 检测到1次重绘即进入重绘模式（更快响应）

  constructor(config?: Partial<PredictionConfig>) {
    this.config = {
      enabled: true,
      displayMode: "adaptive",
      rttThresholdHigh: 50, // 50ms 以上激活预测
      rttThresholdLow: 20, // 20ms 以下关闭预测
      predictionTimeout: 500, // 500ms 未确认视为可疑
      flagUnconfirmed: true,
      ...config,
    };
  }

  /**
   * 设置终端写入回调
   */
  setWriteCallback(callback: WriteCallback): void {
    this.writeToTerminal = callback;
  }

  /**
   * 设置远程发送回调
   */
  setSendCallback(callback: SendCallback): void {
    this.sendToRemote = callback;
  }

  /**
   * 处理用户输入
   * @param data 用户输入的字符
   * @returns 是否应该发送到远程（总是返回 true）
   */
  handleUserInput(data: string): boolean {
    // 发送到远程
    if (this.sendToRemote) {
      this.sendToRemote(data);
    }

    // 检查是否应该做本地预测
    // 重绘模式、密码模式、或特殊字符时跳过预测
    if (!this.shouldPredict(data)) {
      console.log(
        `[PredictionEngine] Skipping prediction for input (redrawMode: ${this.inRedrawMode}, passwordMode: ${this.inPasswordMode})`,
      );
      return true;
    }

    // 关键修复：只有当显示激活时才创建预测
    // 这确保了预测创建和显示的一致性 - 如果不显示，也不创建
    // 避免了"创建预测但不显示，却尝试去重"的问题
    if (!this.isDisplayActive()) {
      console.log(
        `[PredictionEngine] Display not active (RTT: ${this.estimatedRtt.toFixed(0)}ms), passing input through`,
      );
      return true;
    }

    const now = Date.now();
    const frameId = ++this.frameCounter;

    // 对每个可打印字符创建预测并立即显示
    for (const char of data) {
      if (this.isPrintable(char)) {
        // 创建预测
        const prediction: Prediction = {
          char,
          frameId,
          timestamp: now,
          confirmed: false,
        };
        this.predictions.push(prediction);
        this.stats.total++;

        // 立即本地显示（此时 isDisplayActive 已确认为 true）
        if (this.writeToTerminal) {
          console.log(`[PredictionEngine] Writing prediction: "${char}"`);
          this.writeToTerminal(char);
        }
      }
    }

    return true;
  }

  /**
   * 处理远程终端输出
   * @param data 远程终端返回的数据
   * @returns 应该写入终端的数据（已去重）
   */
  handleRemoteOutput(data: string): string {
    const now = Date.now();

    // 检测终端重绘行为 (zsh-autosuggestions 等)
    const isRedraw = this.containsTerminalRedraw(data);

    if (isRedraw) {
      this.redrawModeCounter++;
      console.log(
        `[PredictionEngine] Redraw detected (count: ${this.redrawModeCounter}), pending: ${this.predictions.length}`,
      );

      if (
        this.redrawModeCounter >= this.REDRAW_MODE_THRESHOLD &&
        !this.inRedrawMode
      ) {
        console.log(
          `[PredictionEngine] Entering redraw mode - terminal uses autosuggestions/syntax-highlighting`,
        );
        this.inRedrawMode = true;
      }

      // 如果有待确认的预测，需要回滚
      const pendingCount = this.predictions.filter((p) => !p.confirmed).length;
      if (pendingCount > 0) {
        console.log(
          `[PredictionEngine] Rolling back ${pendingCount} predictions`,
        );

        // 发送退格清除本地显示的预测字符
        if (this.writeToTerminal) {
          const rollback = "\b \b".repeat(pendingCount);
          this.writeToTerminal(rollback);
        }

        this.predictions = [];
      }

      // 重绘模式下直接返回原数据
      return data;
    } else {
      // 没有检测到重绘，重置计数器
      // 但如果已经在重绘模式，保持一段时间
      if (!this.inRedrawMode) {
        this.redrawModeCounter = 0;
      }
    }

    // 如果没有待确认的预测，直接返回原数据
    if (this.predictions.length === 0) {
      return data;
    }

    let result = "";
    let dataIndex = 0;

    while (dataIndex < data.length) {
      const char = data[dataIndex];

      // 检测 ANSI 转义序列
      if (char === "\x1b") {
        const ansiSeq = this.extractAnsiSequence(data, dataIndex);
        if (ansiSeq) {
          // 检查是否是光标移动或清除操作
          if (this.isCursorOrClearSequence(ansiSeq)) {
            // 清空所有预测，因为终端状态可能已经改变
            this.clearAllPredictions();
          }
          // ANSI 序列完整传递，不做去重
          result += ansiSeq;
          dataIndex += ansiSeq.length;
          continue;
        }
      }

      // 尝试匹配预测队列头部
      const pendingPrediction = this.predictions.find((p) => !p.confirmed);

      if (pendingPrediction && pendingPrediction.char === char) {
        // 预测正确！
        pendingPrediction.confirmed = true;
        this.stats.correct++;

        // 更新已确认的帧 ID
        this.lastAckedFrame = pendingPrediction.frameId;

        // 更新 RTT 估算
        const rtt = now - pendingPrediction.timestamp;
        this.updateRttEstimate(rtt);

        // 移除已确认的预测
        this.predictions = this.predictions.filter((p) => !p.confirmed);

        // 跳过这个字符（已经本地显示过了）
        dataIndex++;

        // 重置非回显计数
        this.consecutiveNonEcho = 0;
      } else {
        // 预测不匹配或无预测
        if (pendingPrediction) {
          // 检查是否是密码模式（输入后无回显）
          if (this.isControlChar(char) || char === "\n" || char === "\r") {
            // 可能是密码模式或命令执行
            this.consecutiveNonEcho++;
            if (this.consecutiveNonEcho >= 3) {
              this.enterPasswordMode();
            }
          } else {
            // 预测错误，需要回滚
            this.handlePredictionMismatch(pendingPrediction, char);
          }
        }

        // 添加到结果
        result += char;
        dataIndex++;
      }
    }

    // 清理过期预测
    this.cullExpiredPredictions(now);

    return result;
  }

  /**
   * 检测数据是否包含终端重绘操作
   * 这包括：退格符开头、光标移动序列等
   * 典型场景：zsh-autosuggestions, zsh-syntax-highlighting
   */
  private containsTerminalRedraw(data: string): boolean {
    // 以退格符开头 - 终端正在删除并重写内容
    if (data.charCodeAt(0) === 0x08) {
      return true;
    }

    // 检查是否包含光标移动序列
    // CSI n D (光标左移), CSI n C (光标右移), CSI n G (移动到列)
    // ESC = \x1b = charCode 27
    for (let i = 0; i < data.length - 2; i++) {
      if (data.charCodeAt(i) === 0x1b && data[i + 1] === "[") {
        // 找到 CSI 序列，检查终止符
        let j = i + 2;
        while (
          j < data.length &&
          data.charCodeAt(j) >= 0x30 &&
          data.charCodeAt(j) <= 0x3f
        ) {
          j++; // 跳过参数字节
        }
        if (j < data.length) {
          const terminator = data[j];
          // 光标移动: A(上) B(下) C(右) D(左) G(列)
          // 清除: J(屏幕) K(行)
          if ("ABCDGJK".includes(terminator)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * 从数据中提取 ANSI 转义序列
   * @param data 数据字符串
   * @param startIndex 起始索引（指向 ESC 字符）
   * @returns ANSI 序列字符串，如果不是有效序列则返回 null
   */
  private extractAnsiSequence(data: string, startIndex: number): string | null {
    if (data[startIndex] !== "\x1b") {
      return null;
    }

    // 检查是否有足够的字符
    if (startIndex + 1 >= data.length) {
      return null;
    }

    const nextChar = data[startIndex + 1];

    // CSI 序列: ESC [ ... 终止符
    if (nextChar === "[") {
      let endIndex = startIndex + 2;
      while (endIndex < data.length) {
        const c = data[endIndex];
        // CSI 序列以 0x40-0x7E 范围内的字符终止
        if (c >= "@" && c <= "~") {
          return data.substring(startIndex, endIndex + 1);
        }
        endIndex++;
      }
      // 未找到终止符，返回已有的部分
      return data.substring(startIndex, endIndex);
    }

    // OSC 序列: ESC ] ... BEL 或 ST
    if (nextChar === "]") {
      let endIndex = startIndex + 2;
      while (endIndex < data.length) {
        const c = data[endIndex];
        // OSC 以 BEL (\x07) 或 ST (ESC \) 终止
        if (c === "\x07") {
          return data.substring(startIndex, endIndex + 1);
        }
        if (
          c === "\x1b" &&
          endIndex + 1 < data.length &&
          data[endIndex + 1] === "\\"
        ) {
          return data.substring(startIndex, endIndex + 2);
        }
        endIndex++;
      }
      return data.substring(startIndex, endIndex);
    }

    // 简单的两字符序列: ESC + 单个字符
    if (
      (nextChar >= "@" && nextChar <= "_") || // C1 控制字符
      (nextChar >= "(" && nextChar <= "/") // 字符集选择
    ) {
      // 可能需要额外的参数字符
      if (nextChar >= "(" && nextChar <= "/" && startIndex + 2 < data.length) {
        return data.substring(startIndex, startIndex + 3);
      }
      return data.substring(startIndex, startIndex + 2);
    }

    // 未知序列，只返回 ESC
    return "\x1b";
  }

  /**
   * 检查 ANSI 序列是否涉及光标移动或清除操作
   * 这些操作会使预测失效，需要清空预测队列
   */
  private isCursorOrClearSequence(seq: string): boolean {
    if (!seq.startsWith("\x1b[")) {
      return false;
    }

    // 获取终止字符（最后一个字符）
    const terminator = seq[seq.length - 1];

    // 光标移动命令
    const cursorMoveCmds = [
      "A", // 上移
      "B", // 下移
      "C", // 右移
      "D", // 左移
      "E", // 下移到行首
      "F", // 上移到行首
      "G", // 移动到列
      "H", // 移动到位置
      "f", // 移动到位置（同 H）
    ];

    // 清除命令
    const clearCmds = [
      "J", // 清除屏幕
      "K", // 清除行
      "X", // 清除字符
      "P", // 删除字符
      "M", // 删除行
      "L", // 插入行
      "@", // 插入字符
    ];

    if (cursorMoveCmds.includes(terminator) || clearCmds.includes(terminator)) {
      return true;
    }

    return false;
  }

  /**
   * 清空所有预测（不回滚显示）
   * 用于处理终端状态变化的情况
   */
  private clearAllPredictions(): void {
    if (this.predictions.length > 0) {
      console.log(
        `[PredictionEngine] Clearing ${this.predictions.length} predictions due to cursor/clear operation`,
      );
      this.predictions = [];
    }
  }

  /**
   * 判断是否应该预测
   */
  private shouldPredict(data: string): boolean {
    if (!this.config.enabled) return false;
    if (this.inPasswordMode) return false;
    if (this.inRedrawMode) return false; // 重绘模式下禁用预测
    if (this.config.displayMode === "never") return false;

    // 特殊控制字符不预测
    if (
      data === "\x03" || // Ctrl+C
      data === "\x04" || // Ctrl+D
      data === "\x1a" || // Ctrl+Z
      data === "\x1b" || // Escape
      data.startsWith("\x1b[")
    ) {
      // ANSI 序列
      return false;
    }

    return true;
  }

  /**
   * 判断预测显示是否激活
   */
  private isDisplayActive(): boolean {
    if (this.config.displayMode === "always") return true;
    if (this.config.displayMode === "never") return false;

    // adaptive 模式：根据 RTT 决定
    if (this.estimatedRtt > this.config.rttThresholdHigh) {
      this.rttTriggerActive = true;
    } else if (
      this.estimatedRtt <= this.config.rttThresholdLow &&
      this.predictions.length === 0
    ) {
      this.rttTriggerActive = false;
    }

    return this.rttTriggerActive;
  }

  /**
   * 判断是否是可打印字符
   */
  private isPrintable(char: string): boolean {
    const code = char.charCodeAt(0);
    // 可打印 ASCII 字符 (0x20-0x7E) 或 Unicode 字符
    return (code >= 0x20 && code <= 0x7e) || code > 0x7f;
  }

  /**
   * 判断是否是控制字符
   */
  private isControlChar(char: string): boolean {
    const code = char.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  }

  /**
   * 更新 RTT 估算（使用指数移动平均）
   */
  private updateRttEstimate(sample: number): void {
    const alpha = 0.125; // EWMA 平滑因子
    if (this.estimatedRtt === 0) {
      this.estimatedRtt = sample;
    } else {
      this.estimatedRtt = (1 - alpha) * this.estimatedRtt + alpha * sample;
    }

    // 保存样本用于统计
    this.stats.rttSamples.push(sample);
    if (this.stats.rttSamples.length > 100) {
      this.stats.rttSamples.shift();
    }
  }

  /**
   * 处理预测不匹配
   */
  private handlePredictionMismatch(
    prediction: Prediction,
    actualChar: string,
  ): void {
    this.stats.incorrect++;

    // 回滚：清除所有未确认的预测
    const unconfirmedCount = this.predictions.filter(
      (p) => !p.confirmed,
    ).length;

    if (unconfirmedCount > 0 && this.writeToTerminal) {
      // 发送退格清除本地显示的预测字符
      const backspaces = "\b \b".repeat(unconfirmedCount);
      this.writeToTerminal(backspaces);
    }

    // 清除所有预测
    this.predictions = [];

    console.log(
      `[PredictionEngine] Mismatch: expected '${prediction.char}', got '${actualChar}'`,
    );
  }

  /**
   * 进入密码模式
   */
  private enterPasswordMode(): void {
    if (!this.inPasswordMode) {
      console.log("[PredictionEngine] Entering password mode");
      this.inPasswordMode = true;
      this.predictions = [];
    }
  }

  /**
   * 退出密码模式
   */
  exitPasswordMode(): void {
    if (this.inPasswordMode) {
      console.log("[PredictionEngine] Exiting password mode");
      this.inPasswordMode = false;
      this.consecutiveNonEcho = 0;
    }
  }

  /**
   * 清理过期预测
   */
  private cullExpiredPredictions(now: number): void {
    const timeout = this.config.predictionTimeout;
    const expired = this.predictions.filter(
      (p) => !p.confirmed && now - p.timestamp > timeout,
    );

    if (expired.length > 0) {
      console.log(
        `[PredictionEngine] Culling ${expired.length} expired predictions`,
      );
      this.stats.incorrect += expired.length;

      // 回滚过期预测
      if (this.writeToTerminal) {
        const backspaces = "\b \b".repeat(expired.length);
        this.writeToTerminal(backspaces);
      }

      this.predictions = this.predictions.filter(
        (p) => p.confirmed || now - p.timestamp <= timeout,
      );
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): PredictionStats {
    const avgRtt =
      this.stats.rttSamples.length > 0
        ? this.stats.rttSamples.reduce((a, b) => a + b, 0) /
          this.stats.rttSamples.length
        : 0;

    return {
      totalPredictions: this.stats.total,
      correctPredictions: this.stats.correct,
      incorrectPredictions: this.stats.incorrect,
      pendingCount: this.predictions.filter((p) => !p.confirmed).length,
      accuracy:
        this.stats.total > 0
          ? (this.stats.correct / this.stats.total) * 100
          : 100,
      averageRtt: avgRtt,
    };
  }

  /**
   * 重置引擎状态
   */
  reset(): void {
    this.predictions = [];
    this.frameCounter = 0;
    this.lastAckedFrame = 0;
    this.inPasswordMode = false;
    this.consecutiveNonEcho = 0;
    this.inRedrawMode = false;
    this.redrawModeCounter = 0;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PredictionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 检查是否在密码模式
   */
  isInPasswordMode(): boolean {
    return this.inPasswordMode;
  }

  /**
   * 获取当前 RTT 估算值
   */
  getEstimatedRtt(): number {
    return this.estimatedRtt;
  }

  /**
   * 获取最后确认的帧 ID
   */
  getLastAckedFrame(): number {
    return this.lastAckedFrame;
  }

  /**
   * 检查是否在重绘模式（zsh-autosuggestions 等）
   */
  isInRedrawMode(): boolean {
    return this.inRedrawMode;
  }

  /**
   * 退出重绘模式（例如在命令执行后）
   */
  exitRedrawMode(): void {
    if (this.inRedrawMode) {
      console.log("[PredictionEngine] Exiting redraw mode");
      this.inRedrawMode = false;
      this.redrawModeCounter = 0;
    }
  }
}

/**
 * 创建预测引擎的工厂函数
 */
export function createPredictionEngine(
  config?: Partial<PredictionConfig>,
): PredictionEngine {
  return new PredictionEngine(config);
}
