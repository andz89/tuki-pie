import { useState } from 'react';
import type { FormEvent } from 'react';
import { MAX_SNIPPET_LENGTH } from '../../shared/schemas/snippet.schema';
import type { SnippetFormTarget } from './form-request';
import { usePanelStore } from './panel.store';

const MAX_LABEL_LENGTH = 24;

interface SnippetFormProps {
  target: SnippetFormTarget;
  onClose: () => void;
}

export function SnippetForm({ target, onClose }: SnippetFormProps) {
  const addSnippet = usePanelStore((state) => state.addSnippet);
  const updateSnippet = usePanelStore((state) => state.updateSnippet);

  const editing = target.mode === 'edit' ? target.snippet : null;
  const [label, setLabel] = useState(editing?.label ?? '');
  const [content, setContent] = useState(editing?.content ?? '');

  const title = editing ? `Edit ${editing.label}` : 'New snippet';

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const name = label.trim();
    const saved = editing
      ? await updateSnippet({ id: editing.id, label: name, content })
      : await addSnippet({ label: name, content });
    if (saved) {
      onClose();
    }
  };

  return (
    <form
      className="slice-form"
      aria-label={title}
      onSubmit={(event) => void save(event)}
    >
      <h3>{title}</h3>

      <div className="field">
        <label htmlFor="snippet-label">Name</label>
        <input
          id="snippet-label"
          type="text"
          value={label}
          maxLength={MAX_LABEL_LENGTH}
          onChange={(event) => setLabel(event.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="snippet-content">Text</label>
        <textarea
          id="snippet-content"
          rows={6}
          value={content}
          maxLength={MAX_SNIPPET_LENGTH}
          onChange={(event) => setContent(event.target.value)}
        />
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="button-primary"
          disabled={!label.trim() || !content.trim()}
        >
          Save
        </button>
        <button type="button" className="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
