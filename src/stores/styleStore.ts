import { createSignal, createRoot } from "solid-js";

export type StyleName = "claude" | "codex" | "grok";

// AgentType → StyleName 映射
const AGENT_TO_STYLE: Record<string, StyleName> = {
	claude: "claude",
	codex: "codex",
};

function deriveStyle(
	agentType: string | undefined,
	defaultStyle: StyleName,
	manualOverride: boolean,
	manualStyle: StyleName,
): StyleName {
	if (manualOverride) return manualStyle;
	if (agentType) {
		const mapped = AGENT_TO_STYLE[agentType.toLowerCase()];
		if (mapped) return mapped;
	}
	return defaultStyle;
}

function applyDataStyle(style: StyleName) {
	if (typeof document !== "undefined") {
		document.documentElement.setAttribute("data-style", style);
	}
}

function styleStoreFactory() {
	const [defaultStyle, setDefaultStyle] = createSignal<StyleName>("claude");
	const [manualOverride, setManualOverride] = createSignal(false);
	const [manualStyle, setManualStyle] = createSignal<StyleName>("claude");
	const [currentStyle, setCurrentStyle] = createSignal<StyleName>("claude");
	const [currentAgentType, setCurrentAgentType] = createSignal<
		string | undefined
	>(undefined);

	const updateStyle = (agentType?: string) => {
		const next = deriveStyle(
			agentType ?? currentAgentType(),
			defaultStyle(),
			manualOverride(),
			manualStyle(),
		);
		setCurrentStyle(next);
		applyDataStyle(next);
	};

	return {
		currentStyle,
		defaultStyle,
		manualOverride,
		manualStyle,
		// 切换默认风格（自动映射模式下重新求值）
		setDefaultStyle: (s: StyleName) => {
			setDefaultStyle(s);
			if (!manualOverride()) {
				updateStyle(currentAgentType());
			}
		},
		// 全局手动切换
		setManualStyle: (s: StyleName) => {
			setManualStyle(s);
			setManualOverride(true);
			setCurrentStyle(s);
			applyDataStyle(s);
		},
		// 恢复自动映射
		restoreAuto: (agentType?: string) => {
			setManualOverride(false);
			const effectiveAgentType = agentType ?? currentAgentType();
			updateStyle(effectiveAgentType);
		},
		// agent 映射驱动（会话切换时调用）
		applyForAgent: (agentType?: string) => {
			if (agentType !== undefined) {
				setCurrentAgentType(agentType);
			}
			updateStyle(agentType);
		},
	};
}

export const styleStore = createRoot(styleStoreFactory);
