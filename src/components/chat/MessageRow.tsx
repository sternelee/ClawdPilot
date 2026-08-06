// src/components/chat/MessageRow.tsx
import { type Component, Switch, Match } from "solid-js";
import { styleStore } from "~/stores/styleStore";
import type { ChatMessage } from "~/stores/chatStore";
import { SolidMarkdown } from "solid-markdown";

interface MessageRowProps {
	message: ChatMessage;
}

// Helper: return avatar initial for Grok style
function avatarChar(role: string): string {
	return role === "user" ? "U" : "A";
}

export const MessageRow: Component<MessageRowProps> = (props) => {
	const style = () => styleStore.currentStyle();
	const msg = () => props.message;

	return (
		<Switch>
			{/* ==== User message ==== */}
			<Match when={msg().role === "user"}>
				<Switch>
					<Match when={style() === "claude"}>
						<div class="flex items-start gap-2 mx-4 my-1 text-[var(--as-font-size-base,0.875rem)]">
							<span
								class="text-[hsl(var(--p))] font-semibold shrink-0 select-none mt-0.5"
								aria-hidden="true"
							>
								{">"}
							</span>
							<div class="text-[hsl(var(--bc))] whitespace-pre-wrap break-words">
								{msg().content}
							</div>
						</div>
					</Match>
					<Match when={style() === "codex"}>
						<div class="mx-4 my-2">
							<div class="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--bc)/0.35)] mb-1">
								You
							</div>
							<div class="p-3 rounded-[var(--as-radius,0.5rem)] border border-[hsl(var(--bc)/0.08)] bg-[hsl(var(--b2)/0.2)] text-sm text-[hsl(var(--bc))] whitespace-pre-wrap break-words">
								{msg().content}
							</div>
						</div>
					</Match>
					<Match when={style() === "grok"}>
						<div class="flex items-start gap-3 mx-4 my-2 justify-end">
							<div class="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-[hsl(var(--p))] text-[hsl(var(--pc))] text-sm whitespace-pre-wrap break-words shadow-sm">
								{msg().content}
							</div>
							<div
								class="w-8 h-8 rounded-full bg-[hsl(var(--p)/0.2)] flex items-center justify-center text-xs font-bold text-[hsl(var(--p))] shrink-0 mt-0.5 select-none"
								aria-hidden="true"
							>
								{avatarChar("user")}
							</div>
						</div>
					</Match>
				</Switch>
			</Match>

			{/* ==== Assistant message ==== */}
			<Match when={msg().role === "assistant"}>
				<Switch>
					<Match when={style() === "claude"}>
						<div class="mx-4 my-0.5 text-[var(--as-font-size-base,0.875rem)] text-[hsl(var(--bc)/0.85)] whitespace-pre-wrap break-words">
							<SolidMarkdown class="prose prose-sm max-w-none [color:inherit]">
								{msg().content || ""}
							</SolidMarkdown>
						</div>
					</Match>
					<Match when={style() === "codex"}>
						<div class="mx-4 my-2">
							<div class="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--bc)/0.35)] mb-1">
								Assistant
							</div>
							<div class="p-3 rounded-[var(--as-radius,0.5rem)] border border-[hsl(var(--bc)/0.08)] bg-[hsl(var(--b2)/0.15)] text-sm text-[hsl(var(--bc))]">
								<SolidMarkdown class="prose prose-sm max-w-none [color:inherit]">
									{msg().content || ""}
								</SolidMarkdown>
							</div>
						</div>
					</Match>
					<Match when={style() === "grok"}>
						<div class="flex items-start gap-3 mx-4 my-2">
							<div
								class="w-8 h-8 rounded-full bg-[hsl(var(--s)/0.2)] flex items-center justify-center text-xs font-bold text-[hsl(var(--s))] shrink-0 mt-0.5 select-none"
								aria-hidden="true"
							>
								{avatarChar("assistant")}
							</div>
							<div class="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tl-sm bg-[hsl(var(--b2)/0.5)] border border-[hsl(var(--bc)/0.08)] text-sm text-[hsl(var(--bc))] whitespace-pre-wrap break-words">
								<SolidMarkdown class="prose prose-sm max-w-none [color:inherit]">
									{msg().content || ""}
								</SolidMarkdown>
							</div>
						</div>
					</Match>
				</Switch>
			</Match>
		</Switch>
	);
};
