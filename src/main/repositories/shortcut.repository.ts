import type Database from 'better-sqlite3';
import { Shortcut } from '../../shared/schemas/shortcut.schema';
import type { ShortcutEdit } from '../../shared/types';

const COLUMNS = 'id, label, type, target, parent_id AS parentId, position';

export class ShortcutRepository {
  constructor(private readonly db: Database.Database) {}

  findAll(): Shortcut[] {
    const rows = this.db
      .prepare(`SELECT ${COLUMNS} FROM shortcuts ORDER BY position`)
      .all();
    return Shortcut.array().parse(rows);
  }

  findById(id: string): Shortcut | null {
    const row = this.db
      .prepare(`SELECT ${COLUMNS} FROM shortcuts WHERE id = ?`)
      .get(id);
    return row === undefined ? null : Shortcut.parse(row);
  }

  findAppByTarget(path: string): Shortcut | undefined {
    const row = this.db
      .prepare(
        `SELECT ${COLUMNS} FROM shortcuts WHERE type = 'app' AND target = ?`,
      )
      .get(path);
    return row === undefined ? undefined : Shortcut.parse(row);
  }

  countIn(parentId: string | null): number {
    return this.db
      .prepare('SELECT id FROM shortcuts WHERE parent_id IS ?')
      .all(parentId).length;
  }

  insert({ id, label, type, target, parentId, position }: Shortcut): void {
    this.db
      .prepare(
        'INSERT INTO shortcuts (id, label, type, target, parent_id, position) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(id, label, type, target, parentId, position);
  }

  update({ id, label, target }: ShortcutEdit): void {
    this.db
      .prepare(
        "UPDATE shortcuts SET label = ?, target = ?, updated_at = datetime('now') WHERE id = ?",
      )
      .run(label, target, id);
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM shortcuts WHERE id = ?').run(id);
  }

  // One transaction, so a crash can't leave a gap in the positions.
  removeAndRenumber(id: string, remainingIds: string[]): void {
    this.db.transaction(() => {
      this.remove(id);
      this.setOrder(remainingIds);
    })();
  }

  // Changes the row and both orders together, so nothing is left half moved.
  move(
    id: string,
    parentId: string | null,
    rowIds: string[],
    oldRowIds: string[],
  ): void {
    const setParent = this.db.prepare(
      "UPDATE shortcuts SET parent_id = ?, updated_at = datetime('now') WHERE id = ?",
    );
    this.db.transaction(() => {
      setParent.run(parentId, id);
      this.setOrder(oldRowIds);
      this.setOrder(rowIds);
    })();
  }

  setOrder(ids: string[]): void {
    const setPosition = this.db.prepare(
      'UPDATE shortcuts SET position = ? WHERE id = ?',
    );
    this.db.transaction(() => {
      ids.forEach((id, position) => setPosition.run(position, id));
    })();
  }
}
