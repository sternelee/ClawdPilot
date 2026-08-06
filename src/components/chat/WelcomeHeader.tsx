/**
 * WelcomeHeader — 会话欢迎屏，按 agent 风格展示三种变体
 *
 * Claude: fieldset/legend 极简信息行
 * Codex: 结构化分步卡片
 * Grok: 居中头像卡片 + 问候语
 */

import { type Component, Switch, Match } from "solid-js";
import { styleStore } from "~/stores/styleStore";
import { t } from "~/stores/i18nStore";

interface WelcomeHeaderProps {
  agentType?: string;
  model?: string;
  cwd?: string;
}

function avatarInitial(name: string): string {
  return (name || "A").charAt(0).toUpperCase();
}

export const WelcomeHeader: Component<WelcomeHeaderProps> = (props) => {
  const style = () => styleStore.currentStyle();

  return (
    <Switch>
      {/* ---- Claude: fieldset 极简信息行 ---- */}
      <Match when={style() === "claude"}>
        <fieldset class="mx-4 my-6 border border-[hsl(var(--bc)/0.1)] rounded-[var(--as-radius,0)] p-4">
          <legend class="px-2 text-xs font-semibold text-[hsl(var(--bc)/0.5)] uppercase tracking-wider">
            {t("home.welcomeTitle")}
          </legend>
          <div class="space-y-2 text-sm text-[hsl(var(--bc)/0.7)]">
            <div class="flex gap-3">
              <span class="text-[hsl(var(--p))] whitespace-nowrap">Model</span>
              <span>{props.model || "—"}</span>
            </div>
            <div class="flex gap-3">
              <span class="text-[hsl(var(--p))] whitespace-nowrap">Agent</span>
              <span>{props.agentType || "—"}</span>
            </div>
            <div class="flex gap-3">
              <span class="text-[hsl(var(--p))] whitespace-nowrap">cwd</span>
              <span>{props.cwd || "—"}</span>
            </div>
          </div>
        </fieldset>
      </Match>

      {/* ---- Codex: 结构化分步卡片 ---- */}
      <Match when={style() === "codex"}>
        <div class="mx-4 my-6 rounded-[var(--as-radius-lg,0.75rem)] border border-[hsl(var(--bc)/0.1)] bg-[var(--as-card-bg,transparent)] overflow-hidden">
          {/* 头部 */}
          <div class="px-4 py-3 border-b border-[hsl(var(--bc)/0.06)]">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-[hsl(var(--bc)/0.8)]">
                {t("home.welcomeTitle")}
              </span>
              <span class="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--su))] bg-success/10 px-1.5 py-0.5 rounded-full">
                {props.agentType || "Agent"}
              </span>
            </div>
          </div>
          {/* 步骤列表 */}
          <div class="p-4 space-y-3">
            <div class="flex items-start gap-3">
              <span class="flex-shrink-0 w-6 h-6 rounded-full bg-[hsl(var(--p)/0.15)] text-[hsl(var(--p))] text-xs font-bold flex items-center justify-center">1</span>
              <div>
                <div class="text-sm font-medium text-[hsl(var(--bc)/0.8)]">Describe your task</div>
                <div class="text-xs text-[hsl(var(--bc)/0.5)]">Tell the agent what you want to build, fix, or explore</div>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <span class="flex-shrink-0 w-6 h-6 rounded-full bg-[hsl(var(--p)/0.15)] text-[hsl(var(--p))] text-xs font-bold flex items-center justify-center">2</span>
              <div>
                <div class="text-sm font-medium text-[hsl(var(--bc)/0.8)]">Review the plan</div>
                <div class="text-xs text-[hsl(var(--bc)/0.5)]">The agent will propose a plan before making changes</div>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <span class="flex-shrink-0 w-6 h-6 rounded-full bg-[hsl(var(--p)/0.15)] text-[hsl(var(--p))] text-xs font-bold flex items-center justify-center">3</span>
              <div>
                <div class="text-sm font-medium text-[hsl(var(--bc)/0.8)]">Approve or iterate</div>
                <div class="text-xs text-[hsl(var(--bc)/0.5)]">Accept the changes or give feedback for refinement</div>
              </div>
            </div>
          </div>
          {/* 底部信息 */}
          <div class="px-4 py-2 border-t border-[hsl(var(--bc)/0.06)] flex gap-4 text-[11px] text-[hsl(var(--bc)/0.4)]">
            <span>Model: {props.model || "—"}</span>
            <span>cwd: {props.cwd || "—"}</span>
          </div>
        </div>
      </Match>

      {/* ---- Grok: 居中头像卡片 + 问候 ---- */}
      <Match when={style() === "grok"}>
        <div class="mx-4 my-8 flex flex-col items-center text-center">
          <div class="w-14 h-14 rounded-full bg-[hsl(var(--p)/0.15)] flex items-center justify-center mb-4">
            <span class="text-xl font-bold text-[hsl(var(--p))] select-none" aria-hidden="true">
              {avatarInitial(props.agentType || "A")}
            </span>
          </div>
          <h2 class="text-lg font-semibold text-[hsl(var(--bc)/0.85)] mb-1">
            {t("home.welcomeTitle")}
          </h2>
          <p class="text-sm text-[hsl(var(--bc)/0.5)] mb-4">
            {props.agentType ? `${props.agentType} is ready to help` : "How can I help you today?"}
          </p>
          <div class="flex gap-3 text-xs text-[hsl(var(--bc)/0.4)]">
            <span class="px-2 py-1 rounded-full bg-[hsl(var(--b2)/0.5)] border border-[hsl(var(--bc)/0.08)]">
              {props.model || "—"}
            </span>
            <span class="px-2 py-1 rounded-full bg-[hsl(var(--b2)/0.5)] border border-[hsl(var(--bc)/0.08)]">
              {props.cwd || "—"}
            </span>
          </div>
        </div>
      </Match>
    </Switch>
  );
};
