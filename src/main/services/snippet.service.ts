import { randomUUID } from 'node:crypto';
import { MAX_SNIPPETS } from '../../shared/schemas/snippet.schema';
import type { NewSnippet, Snippet, SnippetEdit } from '../../shared/types';
import type { SnippetRepository } from '../repositories/snippet.repository';
import { UserError } from './user-error';

const SNIPPET_GONE = 'That snippet no longer exists.';

export class SnippetService {
  constructor(
    private readonly snippets: SnippetRepository,
    private readonly writeClipboard: (text: string) => Promise<void>,
  ) {}

  list(): Snippet[] {
    return this.snippets.findAll();
  }

  add(item: NewSnippet): Snippet[] {
    const count = this.snippets.count();
    if (count >= MAX_SNIPPETS) {
      throw new UserError(`You can save ${MAX_SNIPPETS} snippets at most.`);
    }
    this.snippets.insert({ ...item, id: randomUUID(), position: count });
    return this.list();
  }

  update(edit: SnippetEdit): Snippet[] {
    this.existing(edit.id);
    this.snippets.update(edit);
    return this.list();
  }

  remove(id: string): Snippet[] {
    this.existing(id);
    this.snippets.remove(id);
    this.snippets.setOrder(this.list().map((snippet) => snippet.id));
    return this.list();
  }

  reorder(ids: string[]): Snippet[] {
    const current = new Set(this.list().map((snippet) => snippet.id));
    const isEveryItemOnce =
      ids.length === current.size &&
      new Set(ids).size === ids.length &&
      ids.every((id) => current.has(id));
    if (!isEveryItemOnce) {
      throw new UserError('The snippets changed. Please try again.');
    }

    this.snippets.setOrder(ids);
    return this.list();
  }

  // Takes an id, never text: what gets copied comes from the database.
  async copy(id: string): Promise<void> {
    const { content } = this.existing(id);
    try {
      await this.writeClipboard(content);
    } catch {
      throw new UserError('Could not copy that snippet.');
    }
  }

  private existing(id: string): Snippet {
    const snippet = this.snippets.findById(id);
    if (!snippet) {
      throw new UserError(SNIPPET_GONE);
    }
    return snippet;
  }
}
