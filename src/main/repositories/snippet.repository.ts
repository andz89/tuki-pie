import type Database from 'better-sqlite3';
import { Snippet } from '../../shared/schemas/snippet.schema';
import type { SnippetEdit } from '../../shared/types';

const COLUMNS = 'id, label, content, position';

export class SnippetRepository {
  constructor(private readonly db: Database.Database) {}

  findAll(): Snippet[] {
    const rows = this.db
      .prepare(`SELECT ${COLUMNS} FROM snippets ORDER BY position`)
      .all();
    return Snippet.array().parse(rows);
  }

  findById(id: string): Snippet | null {
    const row = this.db
      .prepare(`SELECT ${COLUMNS} FROM snippets WHERE id = ?`)
      .get(id);
    return row === undefined ? null : Snippet.parse(row);
  }

  count(): number {
    return this.db.prepare('SELECT id FROM snippets').all().length;
  }

  insert({ id, label, content, position }: Snippet): void {
    this.db
      .prepare(
        'INSERT INTO snippets (id, label, content, position) VALUES (?, ?, ?, ?)',
      )
      .run(id, label, content, position);
  }

  update({ id, label, content }: SnippetEdit): void {
    this.db
      .prepare(
        "UPDATE snippets SET label = ?, content = ?, updated_at = datetime('now') WHERE id = ?",
      )
      .run(label, content, id);
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM snippets WHERE id = ?').run(id);
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
      'UPDATE snippets SET position = ? WHERE id = ?',
    );
    this.db.transaction(() => {
      ids.forEach((id, position) => setPosition.run(position, id));
    })();
  }
}
