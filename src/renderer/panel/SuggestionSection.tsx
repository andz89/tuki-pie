import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  MAX_GROUP_NAME_LENGTH,
  MAX_SUGGESTION_GROUPS,
} from '../../shared/schemas/suggestion.schema';
import type { ChromeStatus } from '../../shared/types';
import { SuggestionGroupCard } from './SuggestionGroupCard';
import { panelBridge } from './panel-bridge';
import { usePanelStore } from './panel.store';
import type { SuggestionDrag } from './suggestion-drag';

export function SuggestionSection() {
  const groups = usePanelStore((state) => state.suggestions);
  const settings = usePanelStore((state) => state.settings);
  const updateSettings = usePanelStore((state) => state.updateSettings);
  const changeSuggestions = usePanelStore((state) => state.changeSuggestions);
  const [name, setName] = useState('');
  const [drag, setDrag] = useState<SuggestionDrag | null>(null);
  const [chromeStatus, setChromeStatus] = useState<ChromeStatus | null>(null);
  const isFull = groups.length >= MAX_SUGGESTION_GROUPS;

  useEffect(() => {
    void panelBridge.chrome.get().then((result) => {
      if (result.ok) {
        setChromeStatus(result.value.status);
      }
    });
    return panelBridge.chrome.onStatus(setChromeStatus);
  }, []);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const saved = await changeSuggestions({ kind: 'add-group', name });
    if (saved) {
      setName('');
    }
  };

  return (
    <section className="panel-section" aria-labelledby="suggestions-heading">
      <div className="section-heading">
        <h2 id="suggestions-heading">Suggestions</h2>
      </div>
      <p className="section-note">
        Values you type often, in named groups. Click an input field on any page
        in Chrome to pick one from a list. Shift+click several fields to fill
        them all at once, or fill them in order from one group. Needs the Pie
        extension (Chrome tab).
      </p>
      {chromeStatus !== null && chromeStatus !== 'connected' && (
        <p className="section-note suggestion-warning">
          Chrome isn&apos;t connected. Changes reach Chrome once it is.
        </p>
      )}

      <form
        className="suggestion-inline-form"
        onSubmit={(event) => void add(event)}
      >
        <input
          type="text"
          aria-label="New group name"
          placeholder={
            isFull
              ? `You can have ${MAX_SUGGESTION_GROUPS} groups at most`
              : 'New group, e.g. "Date"'
          }
          value={name}
          maxLength={MAX_GROUP_NAME_LENGTH}
          disabled={isFull}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className="button-primary" disabled={isFull}>
          Add group
        </button>
      </form>

      <label className="suggestion-switch">
        <input
          type="checkbox"
          checked={settings.suggestionsInChrome === 'on'}
          onChange={(event) =>
            void updateSettings({
              suggestionsInChrome: event.target.checked ? 'on' : 'off',
            })
          }
        />
        Show the list on input fields in Chrome
      </label>

      {groups.length === 0 ? (
        <p className="section-empty">
          No groups yet. Add one above, then add values to it.
        </p>
      ) : (
        <>
          <p className="section-note">
            Drag groups to change their order. Drag values to reorder them or
            move them to another group. Click a name, value or label to change
            it.
          </p>
          <ol className="suggestion-groups">
            {groups.map((group, index) => (
              <SuggestionGroupCard
                key={group.id}
                group={group}
                index={index}
                drag={drag}
                setDrag={setDrag}
              />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
