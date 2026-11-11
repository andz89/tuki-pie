import { useEffect, useRef, useState } from 'react';
import { MAX_SNIPPETS } from '../../shared/schemas/snippet.schema';
import type { Snippet } from '../../shared/types';
import { SliceIcon } from '../components/icons/SliceIcon';
import { snippetPreview } from '../components/snippet-row';
import { SnippetForm } from './SnippetForm';
import { isSnippetRequest, snippetFormTarget } from './form-request';
import type { SnippetFormTarget } from './form-request';
import { usePanelStore } from './panel.store';

interface SnippetRowProps {
  snippet: Snippet;
  index: number;
  rowLength: number;
  onEdit: () => void;
}

function SnippetRow({ snippet, index, rowLength, onEdit }: SnippetRowProps) {
  const moveSnippet = usePanelStore((state) => state.moveSnippet);
  const removeSnippet = usePanelStore((state) => state.removeSnippet);
  const { id, label, content } = snippet;

  return (
    <li className="slice-row">
      <span className="slice-row-icon">
        <SliceIcon type="snippet" x={0} y={0} />
      </span>
      <div className="slice-row-text">
        <div className="slice-row-label">{label}</div>
        <div className="slice-row-path">{snippetPreview(content)}</div>
      </div>
      <div className="slice-row-actions">
        <button
          type="button"
          className="button-icon"
          aria-label={`Move ${label} earlier`}
          disabled={index === 0}
          onClick={() => void moveSnippet(id, -1)}
        >
          ↑
        </button>
        <button
          type="button"
          className="button-icon"
          aria-label={`Move ${label} later`}
          disabled={index === rowLength - 1}
          onClick={() => void moveSnippet(id, 1)}
        >
          ↓
        </button>
        <button
          type="button"
          className="button-quiet"
          aria-label={`Edit ${label}`}
          onClick={onEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="button-quiet"
          aria-label={`Remove ${label}`}
          onClick={() => void removeSnippet(id)}
        >
          Remove
        </button>
      </div>
    </li>
  );
}

export function SnippetSection() {
  const snippets = usePanelStore((state) => state.snippets);
  const formRequest = usePanelStore((state) => state.formRequest);
  const clearFormRequest = usePanelStore((state) => state.clearFormRequest);
  const showError = usePanelStore((state) => state.showError);

  const sectionRef = useRef<HTMLElement>(null);
  const [formTarget, setFormTarget] = useState<SnippetFormTarget | null>(null);
  // A new key starts a fresh form, even if one is already open.
  const [formKey, setFormKey] = useState(0);

  const openForm = (target: SnippetFormTarget) => {
    setFormTarget(target);
    setFormKey((key) => key + 1);
  };

  // Requests come from the circles on the donut.
  useEffect(() => {
    if (!formRequest || !isSnippetRequest(formRequest)) {
      return;
    }
    sectionRef.current?.scrollIntoView({ block: 'start' });
    const target = snippetFormTarget(formRequest, snippets);
    if (target === 'missing') {
      showError('That snippet no longer exists.');
    } else if (target !== null) {
      openForm(target);
    }
    clearFormRequest();
  }, [formRequest, snippets, clearFormRequest, showError]);

  return (
    <section
      ref={sectionRef}
      className="panel-section"
      aria-labelledby="snippets-heading"
    >
      <div className="section-heading">
        <h2 id="snippets-heading">Snippets</h2>
        <span className="section-count">
          {snippets.length} of {MAX_SNIPPETS}
        </span>
        <button
          type="button"
          className="button-primary"
          disabled={snippets.length >= MAX_SNIPPETS}
          onClick={() => openForm({ mode: 'new' })}
        >
          Add snippet
        </button>
      </div>

      {formTarget !== null && (
        <SnippetForm
          key={formKey}
          target={formTarget}
          onClose={() => setFormTarget(null)}
        />
      )}

      {snippets.length === 0 ? (
        <p className="panel-hint">No snippets yet.</p>
      ) : (
        <ol className="slice-list">
          {snippets.map((snippet, index) => (
            <SnippetRow
              key={snippet.id}
              snippet={snippet}
              index={index}
              rowLength={snippets.length}
              onEdit={() => openForm({ mode: 'edit', snippet })}
            />
          ))}
        </ol>
      )}
    </section>
  );
}
