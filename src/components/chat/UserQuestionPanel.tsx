/**
 * User Question Panel Component
 *
 * Inline user question display for chat view.
 */

import { type Component, For } from "solid-js";
import { UserQuestionMessage } from "../ui/PermissionCard";
import type { UserQuestion } from "~/stores/chatStore";

interface UserQuestionPanelProps {
  questions: UserQuestion[];
  disabled?: boolean;
  onSelect: (questionId: string, option: string) => void;
}

export const UserQuestionPanel: Component<UserQuestionPanelProps> = (props) => {
  return (
    <div class="space-y-3 px-3 sm:px-4 py-3">
      <For each={props.questions}>
        {(question) => (
          <UserQuestionMessage
            question={question.question}
            options={question.options}
            questionId={question.id}
            disabled={props.disabled}
            onSelect={(option) => props.onSelect(question.id, option)}
          />
        )}
      </For>
    </div>
  );
};
