import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  DEFAULT_LINK_FILTER,
  LINK_RULES,
  MAX_WORD,
  MAX_WORDS,
  RULE_GROUPS,
  cleanWord,
} from '../../shared/link-rules';
import type { LinkFilter } from '../../shared/link-rules';

interface Props {
  filter: LinkFilter;
  onChange: (filter: LinkFilter) => void;
}

function Check({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="filter-check">
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span>{label}</span>
    </label>
  );
}

export function LinkFilters({ filter, onChange }: Props) {
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const off = new Set(filter.off);

  const toggleRule = (id: string) =>
    onChange({
      ...filter,
      off: off.has(id)
        ? filter.off.filter((item) => item !== id)
        : [...filter.off, id],
    });

  const allOn =
    filter.off.length === 0 &&
    filter.tokens &&
    filter.words.every(({ on }) => on);

  const checkAll = () =>
    onChange({
      ...DEFAULT_LINK_FILTER,
      words: filter.words.map(({ word }) => ({ word, on: true })),
    });

  const addWord = (event: FormEvent) => {
    event.preventDefault();
    const word = cleanWord(typed);
    if (word === null) {
      setProblem('Type a word with letters or digits.');
      return;
    }
    if (filter.words.some((item) => item.word === word)) {
      setProblem(`"${word}" is already in your words.`);
      return;
    }
    if (filter.words.length >= MAX_WORDS) {
      setProblem(`You can add up to ${MAX_WORDS} words.`);
      return;
    }
    onChange({ ...filter, words: [...filter.words, { word, on: true }] });
    setTyped('');
    setProblem(null);
  };

  const toggleWord = (word: string) =>
    onChange({
      ...filter,
      words: filter.words.map((item) =>
        item.word === word ? { ...item, on: !item.on } : item,
      ),
    });

  const removeWord = (word: string) =>
    onChange({
      ...filter,
      words: filter.words.filter((item) => item.word !== word),
    });

  return (
    <div className="link-filters">
      <div className="link-summary">
        <p>Links matching a checked rule are hidden from the list below.</p>
        <button
          type="button"
          className="link-button"
          disabled={allOn}
          onClick={checkAll}
        >
          Check all
        </button>
      </div>

      {RULE_GROUPS.map((group) => (
        <fieldset key={group.id} className="filter-group">
          <legend>{group.title}</legend>
          <div className="filter-checks">
            {LINK_RULES.filter((rule) => rule.group === group.id).map(
              (rule) => (
                <Check
                  key={rule.id}
                  label={rule.label}
                  checked={!off.has(rule.id)}
                  onToggle={() => toggleRule(rule.id)}
                />
              ),
            )}
          </div>
        </fieldset>
      ))}

      <fieldset className="filter-group">
        <legend>Token or ID</legend>
        <div className="filter-checks">
          <Check
            label="Mark links that carry a token or an ID (listed with Copy only, never opened)"
            checked={filter.tokens}
            onToggle={() => onChange({ ...filter, tokens: !filter.tokens })}
          />
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend>Your words</legend>
        <p className="info-note">
          Hides links with the word anywhere in the address, like /checkout or
          ?checkout=1.
        </p>
        <form className="filter-add" onSubmit={addWord}>
          <input
            type="text"
            value={typed}
            maxLength={MAX_WORD}
            placeholder="Word to block, like checkout"
            aria-label="Word to block"
            onChange={(event) => {
              setTyped(event.target.value);
              setProblem(null);
            }}
          />
          <button
            type="submit"
            className="link-button"
            disabled={!typed.trim()}
          >
            Add
          </button>
        </form>
        {problem && (
          <p className="link-status is-warning" role="alert">
            {problem}
          </p>
        )}
        {filter.words.length > 0 && (
          <ul className="filter-words">
            {filter.words.map(({ word, on }) => (
              <li key={word}>
                <Check
                  label={word}
                  checked={on}
                  onToggle={() => toggleWord(word)}
                />
                <button
                  type="button"
                  className="link-button"
                  aria-label={`Remove ${word}`}
                  onClick={() => removeWord(word)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
    </div>
  );
}
