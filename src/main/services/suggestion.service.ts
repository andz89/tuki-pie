import { randomUUID } from 'node:crypto';
import {
  MAX_SUGGESTION_GROUPS,
  MAX_SUGGESTION_LENGTH,
  MAX_SUGGESTION_VALUES,
} from '../../shared/schemas/suggestion.schema';
import { cleanText, moveItem, splitValues } from '../../shared/suggestions';
import type {
  SuggestionChange,
  SuggestionGroup,
  SuggestionValue,
} from '../../shared/types';
import type { SuggestionRepository } from '../repositories/suggestion.repository';
import { UserError } from './user-error';

const GROUP_GONE = 'That group no longer exists.';
const VALUE_GONE = 'That value no longer exists.';
const CHANGED = 'The suggestions changed. Please try again.';
const TOO_MANY_VALUES = `A group can hold ${MAX_SUGGESTION_VALUES} values at most.`;

// The same items, each once, in any order.
function isSameSet(next: string[], current: string[]): boolean {
  const known = new Set(current);
  return (
    next.length === current.length &&
    new Set(next).size === next.length &&
    next.every((item) => known.has(item))
  );
}

export class SuggestionService {
  private readonly listeners = new Set<() => void>();

  constructor(private readonly repository: SuggestionRepository) {}

  list(): SuggestionGroup[] {
    return this.repository.findAll();
  }

  // Called after every change that was saved.
  onChanged(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  apply(change: SuggestionChange): SuggestionGroup[] {
    this.repository.transaction(() => this.run(change));
    for (const listener of this.listeners) {
      listener();
    }
    return this.list();
  }

  private run(change: SuggestionChange): void {
    switch (change.kind) {
      case 'add-group': {
        const count = this.list().length;
        if (count >= MAX_SUGGESTION_GROUPS) {
          throw new UserError(
            `You can have ${MAX_SUGGESTION_GROUPS} groups at most.`,
          );
        }
        const name = cleanText(change.name) || 'New group';
        this.repository.insertGroup(randomUUID(), name, count);
        return;
      }
      case 'rename-group': {
        this.group(change.id);
        const name = cleanText(change.name);
        if (name) {
          this.repository.renameGroup(change.id, name);
        }
        return;
      }
      case 'remove-group': {
        this.group(change.id);
        this.repository.removeGroup(change.id);
        this.repository.setGroupOrder(this.list().map(({ id }) => id));
        return;
      }
      case 'reorder-groups': {
        const current = this.list().map(({ id }) => id);
        if (!isSameSet(change.ids, current)) {
          throw new UserError(CHANGED);
        }
        this.repository.setGroupOrder(change.ids);
        return;
      }
      case 'collapse-group': {
        this.group(change.id);
        this.repository.setCollapsed(change.id, change.collapsed);
        return;
      }
      case 'hide-group': {
        const group = this.group(change.id);
        this.repository.setValues(
          group.id,
          group.values.map((item) => ({ ...item, hidden: change.hidden })),
        );
        return;
      }
      case 'add-values': {
        const group = this.group(change.groupId);
        const added = splitValues(change.text).filter(
          (value) => !group.values.some((item) => item.value === value),
        );
        if (added.some((value) => value.length > MAX_SUGGESTION_LENGTH)) {
          throw new UserError(
            `A value can be ${MAX_SUGGESTION_LENGTH} characters at most.`,
          );
        }
        if (group.values.length + added.length > MAX_SUGGESTION_VALUES) {
          throw new UserError(TOO_MANY_VALUES);
        }
        this.repository.setValues(group.id, [
          ...group.values,
          ...added.map((value) => ({ value, label: null, hidden: false })),
        ]);
        return;
      }
      case 'edit-value': {
        this.editValue(change);
        return;
      }
      case 'move-value': {
        const source = this.group(change.groupId);
        const item = this.value(source, change.value);
        if (change.toGroupId === source.id) {
          this.repository.setValues(
            source.id,
            moveItem(source.values, source.values.indexOf(item), change.index),
          );
        } else {
          this.moveTo(source, item, change.toGroupId, change.index);
        }
        return;
      }
      case 'hide-value': {
        const group = this.group(change.groupId);
        this.value(group, change.value);
        this.repository.setValues(
          group.id,
          group.values.map((item) =>
            item.value === change.value
              ? { ...item, hidden: change.hidden }
              : item,
          ),
        );
        return;
      }
      case 'reorder-values': {
        const group = this.group(change.groupId);
        const current = group.values.map(({ value }) => value);
        if (!isSameSet(change.values, current)) {
          throw new UserError(CHANGED);
        }
        const byValue = new Map(group.values.map((item) => [item.value, item]));
        this.repository.setValues(
          group.id,
          change.values.map((value) => byValue.get(value) as SuggestionValue),
        );
        return;
      }
      case 'remove-value': {
        const group = this.group(change.groupId);
        this.value(group, change.value);
        this.repository.setValues(
          group.id,
          group.values.filter(({ value }) => value !== change.value),
        );
        return;
      }
    }
  }

  private editValue(
    change: Extract<SuggestionChange, { kind: 'edit-value' }>,
  ): void {
    const source = this.group(change.groupId);
    const old = this.value(source, change.value);
    const edited: SuggestionValue = {
      value: cleanText(change.newValue) || old.value,
      label: cleanText(change.label) || null,
      hidden: old.hidden,
    };

    if (change.toGroupId === source.id) {
      if (
        edited.value !== old.value &&
        source.values.some(({ value }) => value === edited.value)
      ) {
        throw new UserError(`${source.name} already has ${edited.value}.`);
      }
      this.repository.setValues(
        source.id,
        source.values.map((item) => (item.value === old.value ? edited : item)),
      );
      return;
    }

    // To another group, at its end.
    this.moveTo(
      source,
      edited,
      change.toGroupId,
      Number.POSITIVE_INFINITY,
      old.value,
    );
  }

  // Takes a value out of `source` and puts it before `index` in another
  // group, or at its end. A value the target already has stays as it is there.
  private moveTo(
    source: SuggestionGroup,
    item: SuggestionValue,
    toGroupId: string,
    index: number,
    oldValue = item.value,
  ): void {
    const target = this.group(toGroupId);
    const isNew = !target.values.some(({ value }) => value === item.value);
    if (isNew && target.values.length >= MAX_SUGGESTION_VALUES) {
      throw new UserError(TOO_MANY_VALUES);
    }
    this.repository.setValues(
      source.id,
      source.values.filter(({ value }) => value !== oldValue),
    );
    if (isNew) {
      const values = [...target.values];
      values.splice(Math.min(index, values.length), 0, item);
      this.repository.setValues(target.id, values);
    }
  }

  private group(id: string): SuggestionGroup {
    const group = this.list().find((item) => item.id === id);
    if (!group) {
      throw new UserError(GROUP_GONE);
    }
    return group;
  }

  private value(group: SuggestionGroup, value: string): SuggestionValue {
    const item = group.values.find((each) => each.value === value);
    if (!item) {
      throw new UserError(VALUE_GONE);
    }
    return item;
  }
}
