import { createSignal, createEffect, Show } from 'solid-js';
import { HistoryEntry } from '../hooks/useConnectionHistory';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: HistoryEntry | null;
  onSave: (ticket: string, updates: { title: string; description: string }) => void;
}

export function SettingsModal(props: SettingsModalProps) {
  const [title, setTitle] = createSignal('');
  const [description, setDescription] = createSignal('');

  createEffect(() => {
    if (props.entry) {
      setTitle(props.entry.title);
      setDescription(props.entry.description);
    }
  });

  createEffect(() => {
    if (props.isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  });

  const handleSave = () => {
    if (props.entry) {
      props.onSave(props.entry.ticket, { title: title(), description: description() });
      props.onClose();
    }
  };

  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  };

  return (
    <Show when={props.isOpen && props.entry}>
      <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={handleOverlayClick}
      >
        <div class="modal-box w-full max-w-md">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold">Edit Connection Details</h2>
            <button
              class="btn btn-sm btn-circle btn-ghost"
              onClick={props.onClose}
            >
              ✕
            </button>
          </div>

          <div class="space-y-4">
            <div class="form-control">
              <label class="label">
                <span class="label-text">Title</span>
              </label>
              <input
                type="text"
                value={title()}
                onInput={(e) => setTitle(e.currentTarget.value)}
                class="input input-bordered w-full"
                placeholder="Session title"
              />
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Description</span>
              </label>
              <textarea
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                class="textarea textarea-bordered w-full"
                rows={4}
                placeholder="Session description"
              />
            </div>
          </div>

          <div class="modal-action">
            <button class="btn btn-ghost" onClick={props.onClose}>
              Cancel
            </button>
            <button class="btn btn-primary" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
