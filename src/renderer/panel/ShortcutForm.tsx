import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  isWebLink,
  normalizeWebAddress,
} from '../../shared/schemas/shortcut.schema';
import type { Shortcut } from '../../shared/types';
import { cleanPastedPath, isLocalPath } from './clean-pasted-path';
import { labelFromPath } from './label-from-path';
import { usePanelStore } from './panel.store';

const MAX_LABEL_LENGTH = 24;
const MAX_ADDRESS_LENGTH = 2048;

export type ShortcutFormTarget =
  | { mode: 'new-shortcut'; parentId: string | null }
  | { mode: 'new-group' }
  // From the Apps tab: always an app, at the top level.
  | { mode: 'new-app' }
  | { mode: 'edit'; shortcut: Shortcut };

type ShortcutKind = 'link' | 'path' | 'app';

function formTitle(target: ShortcutFormTarget): string {
  if (target.mode === 'edit') {
    return `Edit ${target.shortcut.label}`;
  }
  if (target.mode === 'new-app') {
    return 'New app';
  }
  return target.mode === 'new-group' ? 'New group' : 'New link';
}

interface ShortcutFormProps {
  target: ShortcutFormTarget;
  onClose: () => void;
}

export function ShortcutForm({ target, onClose }: ShortcutFormProps) {
  const addShortcut = usePanelStore((state) => state.addShortcut);
  const updateShortcut = usePanelStore((state) => state.updateShortcut);
  const pickPath = usePanelStore((state) => state.pickPath);

  const editing = target.mode === 'edit' ? target.shortcut : null;
  const isGroup = target.mode === 'new-group' || editing?.type === 'group';

  const [label, setLabel] = useState(editing?.label ?? '');
  const [address, setAddress] = useState(editing?.target ?? '');
  const [problem, setProblem] = useState<string | null>(null);

  // The Apps tab adds apps. The Shortcuts tab adds a web link, or a folder or
  // file when what was typed is a path. A saved one keeps its kind.
  const pasted = cleanPastedPath(address);
  let kind: ShortcutKind;
  if (editing?.type === 'app' || target.mode === 'new-app') {
    kind = 'app';
  } else if (editing) {
    kind = editing.type === 'path' ? 'path' : 'link';
  } else {
    kind = isLocalPath(pasted) ? 'path' : 'link';
  }
  const canBePath = !editing || editing.type === 'path';

  const enteredAddress = kind === 'link' ? address.trim() : pasted;

  const usePath = (path: string) => {
    setAddress(path);
    if (path && !label.trim()) {
      setLabel(labelFromPath(path));
    }
  };

  const browse = async (type: 'app' | 'folder') => {
    const picked = await pickPath(type);
    if (picked) {
      usePath(picked);
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const name = label.trim();

    let destination: string | null = null;
    if (!isGroup) {
      destination =
        kind === 'link' ? normalizeWebAddress(address) : enteredAddress;
      if (kind === 'link' && !isWebLink(destination)) {
        setProblem('Links must start with http or https.');
        return;
      }
    }

    let saved: boolean;
    if (editing) {
      saved = await updateShortcut({
        id: editing.id,
        label: name,
        target: destination,
      });
    } else if (destination === null) {
      saved = await addShortcut({
        type: 'group',
        label: name,
        target: null,
        parentId: null,
      });
    } else {
      saved = await addShortcut({
        type: kind,
        label: name,
        target: destination,
        parentId: target.mode === 'new-shortcut' ? target.parentId : null,
      });
    }

    if (saved) {
      onClose();
    }
  };

  return (
    <form
      className="slice-form"
      aria-label={formTitle(target)}
      onSubmit={(event) => void save(event)}
    >
      <h3>{formTitle(target)}</h3>

      {!isGroup && kind !== 'app' && (
        <div className="field">
          <label htmlFor="shortcut-address">
            {canBePath ? 'Web address, folder, or file' : 'Web address'}
          </label>
          <div className={canBePath ? 'path-picker' : undefined}>
            <input
              id="shortcut-address"
              type="text"
              value={address}
              maxLength={MAX_ADDRESS_LENGTH}
              placeholder={
                canBePath ? 'example.com or C:\\Folder' : 'example.com'
              }
              onChange={(event) => {
                setAddress(event.target.value);
                setProblem(null);
              }}
              onBlur={() => kind === 'path' && usePath(enteredAddress)}
            />
            {canBePath && (
              <button
                type="button"
                className="button"
                onClick={() => void browse('folder')}
              >
                Browse
              </button>
            )}
          </div>
        </div>
      )}

      {!isGroup && kind === 'app' && (
        <div className="field">
          <label htmlFor="shortcut-app">App, file, or folder</label>
          <div className="path-picker">
            <input
              id="shortcut-app"
              type="text"
              value={address}
              maxLength={MAX_ADDRESS_LENGTH}
              placeholder="Paste a path or browse"
              onChange={(event) => {
                setAddress(event.target.value);
                setProblem(null);
              }}
              onBlur={() => usePath(enteredAddress)}
            />
            <button
              type="button"
              className="button"
              onClick={() => void browse('app')}
            >
              Browse
            </button>
          </div>
        </div>
      )}

      <div className="field">
        <label htmlFor="shortcut-label">Name</label>
        <input
          id="shortcut-label"
          type="text"
          value={label}
          maxLength={MAX_LABEL_LENGTH}
          onChange={(event) => setLabel(event.target.value)}
        />
      </div>

      {problem && (
        <p className="panel-hint" role="alert">
          {problem}
        </p>
      )}

      <div className="form-actions">
        <button
          type="submit"
          className="button-primary"
          disabled={!label.trim() || (!isGroup && !enteredAddress)}
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
