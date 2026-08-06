/**
 * TodoListBlock — agent todo 列表
 *
 * 语义 <ul> 列表，状态标签 + 完成项划线。
 */

import { type Component, For } from "solid-js";

interface TodoItem {
	id: string;
	title: string;
	status: "in-progress" | "completed" | "pending" | "not-started";
}

interface TodoListBlockProps {
	todos?: TodoItem[];
}

export const TodoListBlock: Component<TodoListBlockProps> = (props) => {
	if (!props.todos?.length) return null;

	return (
		<ul class="mx-4 my-1.5 space-y-0.5" role="list" aria-label="Todo list">
			<For each={props.todos}>
				{(item) => (
					<li
						class="flex items-center gap-2 text-[var(--as-font-size-sm,0.8125rem)]"
						classList={{
							"line-through text-[hsl(var(--bc)/0.35)]":
								item.status === "completed",
							"text-[hsl(var(--bc)/0.7)]": item.status !== "completed",
						}}
					>
						<span class="text-[hsl(var(--bc)/0.3)]">
							{item.status === "completed"
								? "✓"
								: item.status === "in-progress"
									? "●"
									: "○"}
						</span>
						<span>{item.title}</span>
					</li>
				)}
			</For>
		</ul>
	);
};
