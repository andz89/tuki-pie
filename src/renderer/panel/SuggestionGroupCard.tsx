import { useState } from 'react';
import type { DragEvent, FormEvent } from 'react';
import {
  MAX_GROUP_NAME_LENGTH,
  MAX_SUGGESTION_LABEL_LENGTH,
  MAX_SUGGESTION_LENGTH,
  MAX_SUGGESTION_VALUES,
} from '../../shared/schemas/suggestion.schema';
import type { SuggestionGroup, SuggestionValue } from '../../shared/types';
import { InlineEdit } from './InlineEdit';
import { usePanelStore } from './panel.store';
import { GROUPS_SPOT, dragProps, markOver } from './suggestion-drag';
import type { DragSpot, SuggestionDrag } from './suggestion-drag';

interface DragState {
  drag: SuggestionDrag | null;
  setDrag: (drag: SuggestionDrag | null) => void;
}

function useMoveValue() {
  const groups = usePanelStore((state) => state.suggestions);
  const changeSuggestions = usePanelStore((state) => state.changeSuggestions);
  return (from: DragSpot, to: DragSpot) => {
    const value = groups.find((group) => group.id === from.at)?.values[
      from.index
    ]?.value;
    if (value === undefined) {
      return;
    }
    void changeSuggestions({
      kind: 'move-value',
      groupId: from.at,
      value,
      toGroupId: to.at,
      index: to.index,
    });
  };
}

interface ValueRowProps extends DragState {
  group: SuggestionGroup;
  item: SuggestionValue;
  index: number;
}

function ValueRow({ group, item, index, drag, setDrag }: ValueRowProps) {
  const changeSuggestions = usePanelStore((state) => state.changeSuggestions);
  const moveValue = useMoveValue();
  const { value, label, hidden } = item;
  const { handle, target, mark } = dragProps({
    list: 'values',
    at: group.id,
    index,
    drag,
    setDrag,
    onMove: moveValue,
  });

  const edit = (newValue: string, newLabel: string) =>
    void changeSuggestions({
      kind: 'edit-value',
      groupId: group.id,
      value,
      newValue,
      label: newLabel,
      toGroupId: group.id,
    });

  return (
    <li
      className="suggestion-value"
      data-hidden={hidden}
      data-mark={mark ?? undefined}
      {...handle}
      {...target}
    >
      <span className="drag-grip" aria-hidden="true">
        ⠿
      </span>
      <InlineEdit
        value={value}
        label={`Change ${value}`}
        maxLength={MAX_SUGGESTION_LENGTH}
        className="suggestion-value-text"
        onSave={(text) => edit(text, label ?? '')}
      >
        {value}
      </InlineEdit>
      <InlineEdit
        value={label ?? ''}
        label={
          label ? `Change the label of ${value}` : `Add a label to ${value}`
        }
        placeholder="Label (optional)"
        maxLength={MAX_SUGGESTION_LABEL_LENGTH}
        className={label ? 'suggestion-label has-label' : 'suggestion-label'}
        onSave={(text) => edit(value, text)}
      >
        {label || '+ label'}
      </InlineEdit>
      <button
        type="button"
        className="button-quiet"
        title={
          hidden
            ? 'Hidden from the list in Chrome. Click to show it again'
            : 'Hide from the list in Chrome, keep it here'
        }
        onClick={() =>
          void changeSuggestions({
            kind: 'hide-value',
            groupId: group.id,
            value,
            hidden: !hidden,
          })
        }
      >
        {hidden ? 'Show' : 'Hide'}
      </button>
      <button
        type="button"
        className="button-quiet"
        aria-label={`Delete ${value}`}
        title="Delete"
        onClick={() =>
          void changeSuggestions({
            kind: 'remove-value',
            groupId: group.id,
            value,
          })
        }
      >
        Delete
      </button>
    </li>
  );
}

interface SuggestionGroupCardProps extends DragState {
  group: SuggestionGroup;
  index: number;
}

export function SuggestionGroupCard({
  group,
  index,
  drag,
  setDrag,
}: SuggestionGroupCardProps) {
  const changeSuggestions = usePanelStore((state) => state.changeSuggestions);
  const moveSuggestionGroup = usePanelStore(
    (state) => state.moveSuggestionGroup,
  );
  const moveValue = useMoveValue();
  const [text, setText] = useState('');
  const { id, name, collapsed, values } = group;
  const allHidden = values.length > 0 && values.every((item) => item.hidden);
  const isFull = values.length >= MAX_SUGGESTION_VALUES;

  const { handle, target, mark } = dragProps({
    list: 'groups',
    at: GROUPS_SPOT,
    index,
    drag,
    setDrag,
    onMove: (from, to) => void moveSuggestionGroup(from.index, to.index),
  });

  // A value dropped on the group but not on a row goes to its end.
  const end: DragSpot = { at: id, index: values.length };
  const valueTarget = {
    onDragOver: (event: DragEvent) =>
      markOver(event, drag, setDrag, 'values', end) || target.onDragOver(event),
    onDrop: (event: DragEvent) => {
      if (drag?.list !== 'values') {
        target.onDrop(event);
        return;
      }
      event.preventDefault();
      setDrag(null);
      moveValue(drag.from, end);
    },
  };
  const isValueOver =
    drag?.list === 'values' && drag.over?.at === id && drag.from.at !== id;

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) {
      return;
    }
    const saved = await changeSuggestions({
      kind: 'add-values',
      groupId: id,
      text,
    });
    if (saved) {
      setText('');
    }
  };

  const remove = () => {
    const isSure =
      values.length === 0 ||
      window.confirm(
        `Delete the group "${name}" and its ${values.length} ${values.length === 1 ? 'value' : 'values'}?`,
      );
    if (isSure) {
      void changeSuggestions({ kind: 'remove-group', id });
    }
  };

  return (
    <li
      className="suggestion-group"
      data-mark={mark ?? undefined}
      data-value-over={isValueOver}
      {...valueTarget}
    >
      <div className="suggestion-group-head" {...handle}>
        <span className="drag-grip" aria-hidden="true">
          ⠿
        </span>
        <button
          type="button"
          className="suggestion-fold"
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Show ${name}` : `Fold ${name}`}
          title={
            collapsed ? "Show this group's values" : "Hide this group's values"
          }
          onClick={() =>
            void changeSuggestions({
              kind: 'collapse-group',
              id,
              collapsed: !collapsed,
            })
          }
        >
          {collapsed ? '▸' : '▾'}
        </button>
        <InlineEdit
          value={name}
          label={`Rename ${name}`}
          maxLength={MAX_GROUP_NAME_LENGTH}
          className="suggestion-group-name"
          onSave={(newName) =>
            void changeSuggestions({ kind: 'rename-group', id, name: newName })
          }
        >
          <span data-hidden={allHidden}>{name}</span>
          <span className="suggestion-count">{values.length}</span>
        </InlineEdit>
        {values.length > 0 && (
          <button
            type="button"
            className="button-quiet"
            title={
              allHidden
                ? 'All values are hidden from the list in Chrome. Click to show them all'
                : 'Hide all values in this group from the list in Chrome'
            }
            onClick={() =>
              void changeSuggestions({
                kind: 'hide-group',
                id,
                hidden: !allHidden,
              })
            }
          >
            {allHidden ? 'Show all' : 'Hide all'}
          </button>
        )}
        <button
          type="button"
          className="button-quiet"
          aria-label={`Delete the group ${name}`}
          title="Delete this group"
          onClick={remove}
        >
          Delete
        </button>
      </div>

      {!collapsed && (
        <>
          <form
            className="suggestion-inline-form"
            onSubmit={(event) => void add(event)}
          >
            <input
              type="text"
              aria-label={`New value in ${name}`}
              placeholder={
                isFull
                  ? 'This group is full'
                  : 'Add a value, or several: "13, 02, 00"'
              }
              value={text}
              disabled={isFull}
              onChange={(event) => setText(event.target.value)}
            />
            <button type="submit" className="button-primary" disabled={isFull}>
              Add
            </button>
          </form>
          {values.length > 0 && (
            <ul className="suggestion-values">
              {values.map((item, valueIndex) => (
                <ValueRow
                  key={item.value}
                  group={group}
                  item={item}
                  index={valueIndex}
                  drag={drag}
                  setDrag={setDrag}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  );
}
