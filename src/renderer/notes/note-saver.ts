import type { NewNote, Note, NoteEdit, Result } from '../../shared/types';
import { isBlank } from './notes-view';

interface SaveApi {
  create(item: NewNote): Promise<Result<Note>>;
  update(edit: NoteEdit): Promise<Result<Note>>;
}

// Saves the open note. Saves run one after another, so a new note is
// created once even while you keep typing, and a blank new note is never
// created at all.
export class NoteSaver {
  private queue: Promise<void> = Promise.resolve();
  private saved: { title: string; body: string };

  constructor(
    private readonly api: SaveApi,
    private id: string | null,
    saved: { title: string; body: string },
    private readonly onError: (message: string) => void,
  ) {
    this.saved = saved;
  }

  get noteId(): string | null {
    return this.id;
  }

  save(title: string, body: string): Promise<void> {
    this.queue = this.queue.then(() => this.write(title, body));
    return this.queue;
  }

  private async write(title: string, body: string): Promise<void> {
    if (title === this.saved.title && body === this.saved.body) {
      return;
    }
    if (this.id === null && isBlank(title, body)) {
      return;
    }
    const result =
      this.id === null
        ? await this.api.create({ title, body })
        : await this.api.update({ id: this.id, title, body });
    if (!result.ok) {
      this.onError(result.error);
      return;
    }
    this.id = result.value.id;
    this.saved = { title, body };
  }
}
