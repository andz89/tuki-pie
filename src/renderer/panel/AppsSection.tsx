import { useEffect, useRef, useState } from 'react';
import { MAX_APPS } from '../../shared/schemas/shortcut.schema';
import type { Shortcut } from '../../shared/types';
import { SliceIcon } from '../components/icons/SliceIcon';
import { ShortcutForm } from './ShortcutForm';
import type { ShortcutFormTarget } from './ShortcutForm';
import { isAppRequest } from './form-request';
import { usePanelStore } from './panel.store';

interface AppRowProps {
  app: Shortcut;
  index: number;
  rowLength: number;
  onEdit: () => void;
}

function AppRow({ app, index, rowLength, onEdit }: AppRowProps) {
  const moveShortcut = usePanelStore((state) => state.moveShortcut);
  const removeShortcut = usePanelStore((state) => state.removeShortcut);

  return (
    <li className="slice-row">
      <span className="slice-row-icon">
        <SliceIcon type="app" x={0} y={0} />
      </span>
      <div className="slice-row-text">
        <div className="slice-row-label">{app.label}</div>
        <div className="slice-row-path" title={app.target ?? undefined}>
          {app.target}
        </div>
      </div>
      <div className="slice-row-actions">
        <button
          type="button"
          className="button-icon"
          aria-label={`Move ${app.label} earlier`}
          disabled={index === 0}
          onClick={() => void moveShortcut(app.id, -1)}
        >
          ↑
        </button>
        <button
          type="button"
          className="button-icon"
          aria-label={`Move ${app.label} later`}
          disabled={index === rowLength - 1}
          onClick={() => void moveShortcut(app.id, 1)}
        >
          ↓
        </button>
        <button
          type="button"
          className="button-quiet"
          aria-label={`Edit ${app.label}`}
          onClick={onEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="button-quiet"
          aria-label={`Remove ${app.label}`}
          onClick={() => void removeShortcut(app.id)}
        >
          Remove
        </button>
      </div>
    </li>
  );
}

// The apps the donut's Apps slice shows, each with the app's own icon. They
// are kept apart from the links and groups in the Shortcuts tab.
export function AppsSection() {
  const shortcuts = usePanelStore((state) => state.shortcuts);
  const formRequest = usePanelStore((state) => state.formRequest);
  const clearFormRequest = usePanelStore((state) => state.clearFormRequest);

  const sectionRef = useRef<HTMLElement>(null);
  const [formTarget, setFormTarget] = useState<ShortcutFormTarget | null>(null);
  // A new key starts a fresh form, even if one is already open.
  const [formKey, setFormKey] = useState(0);

  const openForm = (target: ShortcutFormTarget) => {
    setFormTarget(target);
    setFormKey((key) => key + 1);
  };

  // Requests come from the Apps slice on the donut.
  useEffect(() => {
    if (!formRequest || !isAppRequest(formRequest)) {
      return;
    }
    sectionRef.current?.scrollIntoView({ block: 'start' });
    if (formRequest.kind === 'app-new') {
      openForm({ mode: 'new-app' });
    }
    clearFormRequest();
  }, [formRequest, clearFormRequest]);

  const apps = shortcuts.filter((item) => item.type === 'app');
  const isFull = apps.length >= MAX_APPS;

  return (
    <section
      ref={sectionRef}
      className="panel-section"
      aria-labelledby="apps-heading"
    >
      <div className="section-heading">
        <h2 id="apps-heading">Apps</h2>
        <span className="section-count">
          {apps.length} of {MAX_APPS}
        </span>
        <button
          type="button"
          className="button-primary"
          disabled={isFull}
          onClick={() => openForm({ mode: 'new-app' })}
        >
          Add app
        </button>
      </div>

      {formTarget !== null && (
        <ShortcutForm
          key={formKey}
          target={formTarget}
          onClose={() => setFormTarget(null)}
        />
      )}

      {apps.length === 0 ? (
        <p className="panel-hint">
          No apps yet. Add one to see it on the donut's Apps slice.
        </p>
      ) : (
        <ol className="slice-list">
          {apps.map((app, index) => (
            <AppRow
              key={app.id}
              app={app}
              index={index}
              rowLength={apps.length}
              onEdit={() => openForm({ mode: 'edit', shortcut: app })}
            />
          ))}
        </ol>
      )}
    </section>
  );
}
