import type Database from 'better-sqlite3';
import { Slice } from '../../shared/schemas/slice.schema';
import type { SliceEdit } from '../../shared/types';

export class SliceRepository {
  constructor(private readonly db: Database.Database) {}

  findAll(): Slice[] {
    const rows = this.db
      .prepare(
        'SELECT id, label, type, path, position FROM slices ORDER BY position',
      )
      .all();
    return Slice.array().parse(rows);
  }

  findById(id: string): Slice | null {
    const row = this.db
      .prepare(
        'SELECT id, label, type, path, position FROM slices WHERE id = ?',
      )
      .get(id);
    return row === undefined ? null : Slice.parse(row);
  }

  count(): number {
    return this.db.prepare('SELECT id FROM slices').all().length;
  }

  insert({ id, label, type, path, position }: Slice): void {
    this.db
      .prepare(
        'INSERT INTO slices (id, label, type, path, position) VALUES (?, ?, ?, ?, ?)',
      )
      .run(id, label, type, path, position);
  }

  update({ id, label, type, path }: SliceEdit): void {
    this.db
      .prepare(
        "UPDATE slices SET label = ?, type = ?, path = ?, updated_at = datetime('now') WHERE id = ?",
      )
      .run(label, type, path, id);
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM slices WHERE id = ?').run(id);
  }

  // One transaction, so a crash can't leave a gap in the positions.
  removeAndRenumber(id: string, remainingIds: string[]): void {
    this.db.transaction(() => {
      this.remove(id);
      this.setOrder(remainingIds);
    })();
  }

  setOrder(ids: string[]): void {
    const setPosition = this.db.prepare(
      'UPDATE slices SET position = ? WHERE id = ?',
    );
    this.db.transaction(() => {
      // Positions must stay unique, so move everything out of the way first.
      this.db.prepare('UPDATE slices SET position = -1 - position').run();
      ids.forEach((id, position) => setPosition.run(position, id));
    })();
  }
}
