import type Database from 'better-sqlite3';
import { SuggestionGroup } from '../../shared/schemas/suggestion.schema';
import type { SuggestionValue } from '../../shared/types';

interface GroupRow {
  id: string;
  name: string;
  collapsed: number;
}

interface ValueRow {
  group_id: string;
  value: string;
  label: string | null;
  hidden: number;
}

export class SuggestionRepository {
  constructor(private readonly db: Database.Database) {}

  findAll(): SuggestionGroup[] {
    const groups = this.db
      .prepare(
        'SELECT id, name, collapsed FROM suggestion_groups ORDER BY position',
      )
      .all() as GroupRow[];
    const values = this.db
      .prepare(
        'SELECT group_id, value, label, hidden FROM suggestion_values ORDER BY position',
      )
      .all() as ValueRow[];
    return SuggestionGroup.array().parse(
      groups.map(({ id, name, collapsed }) => ({
        id,
        name,
        collapsed: collapsed === 1,
        values: values
          .filter((row) => row.group_id === id)
          .map(({ value, label, hidden }) => ({
            value,
            label,
            hidden: hidden === 1,
          })),
      })),
    );
  }

  insertGroup(id: string, name: string, position: number): void {
    this.db
      .prepare(
        'INSERT INTO suggestion_groups (id, name, position) VALUES (?, ?, ?)',
      )
      .run(id, name, position);
  }

  renameGroup(id: string, name: string): void {
    this.db
      .prepare(
        "UPDATE suggestion_groups SET name = ?, updated_at = datetime('now') WHERE id = ?",
      )
      .run(name, id);
  }

  setCollapsed(id: string, collapsed: boolean): void {
    this.db
      .prepare('UPDATE suggestion_groups SET collapsed = ? WHERE id = ?')
      .run(collapsed ? 1 : 0, id);
  }

  removeGroup(id: string): void {
    this.db.prepare('DELETE FROM suggestion_groups WHERE id = ?').run(id);
  }

  setGroupOrder(ids: string[]): void {
    const setPosition = this.db.prepare(
      'UPDATE suggestion_groups SET position = ? WHERE id = ?',
    );
    this.transaction(() => {
      ids.forEach((id, position) => setPosition.run(position, id));
    });
  }

  // Replaces a group's values with these, in this order.
  setValues(groupId: string, values: SuggestionValue[]): void {
    const insert = this.db.prepare(
      'INSERT INTO suggestion_values (group_id, value, label, hidden, position) VALUES (?, ?, ?, ?, ?)',
    );
    this.transaction(() => {
      this.db
        .prepare('DELETE FROM suggestion_values WHERE group_id = ?')
        .run(groupId);
      values.forEach(({ value, label, hidden }, position) =>
        insert.run(groupId, value, label, hidden ? 1 : 0, position),
      );
      this.db
        .prepare(
          "UPDATE suggestion_groups SET updated_at = datetime('now') WHERE id = ?",
        )
        .run(groupId);
    });
  }

  // Nested calls join the outer transaction.
  transaction(run: () => void): void {
    this.db.transaction(run)();
  }
}
