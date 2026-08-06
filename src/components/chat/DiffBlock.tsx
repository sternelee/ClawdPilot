/**
 * DiffBlock — 内联 diff 展示
 *
 * 结构化 +/- 行，含行号，tinted 背景区分新增/删除/上下文。
 */

import { type Component, For } from "solid-js";

interface DiffLine {
	kind: "add" | "remove" | "context";
	text: string;
	ln?: number;
}

interface DiffHunk {
	lines: DiffLine[];
}

interface DiffBlockProps {
	hunks?: DiffHunk[];
}

export const DiffBlock: Component<DiffBlockProps> = (props) => {
	if (!props.hunks?.length) return null;

	return (
		<div class="mx-4 my-1.5 border border-[hsl(var(--bc)/0.1)] rounded-[var(--as-radius,0.25rem)] overflow-hidden text-[11px] font-mono">
			<For each={props.hunks}>
				{(hunk) => (
					<div>
						<For each={hunk.lines}>
							{(line) => (
								<div
									class="flex"
									classList={{
										"bg-success/10 text-success": line.kind === "add",
										"bg-error/10 text-error": line.kind === "remove",
										"text-[hsl(var(--bc)/0.6)]": line.kind === "context",
									}}
								>
									<span class="w-10 shrink-0 text-right pr-2 text-[hsl(var(--bc)/0.3)] select-none">
										{line.ln ?? ""}
									</span>
									<span class="whitespace-pre">
										{line.kind === "add"
											? "+"
											: line.kind === "remove"
												? "-"
												: " "}
										{line.text}
									</span>
								</div>
							)}
						</For>
					</div>
				)}
			</For>
		</div>
	);
};
