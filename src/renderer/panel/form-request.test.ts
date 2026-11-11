import { describe, expect, it } from 'vitest';
import type { PanelFormRequest, Snippet } from '../../shared/types';
import { isSnippetRequest, snippetFormTarget } from './form-request';

const NOTE: Snippet = { id: 'a', label: 'Note', content: 'x', position: 0 };

describe('isSnippetRequest', () => {
  it.each<PanelFormRequest>([
    { kind: 'snippet-new' },
    { kind: 'snippet-edit', id: 'a' },
    { kind: 'snippets-section' },
  ])('claims $kind', (request) => {
    expect(isSnippetRequest(request)).toBe(true);
  });

  it.each<PanelFormRequest>([
    { kind: 'shortcut', parentId: null },
    { kind: 'group' },
    { kind: 'section' },
  ])('leaves $kind to Shortcuts', (request) => {
    expect(isSnippetRequest(request)).toBe(false);
  });
});

describe('snippetFormTarget', () => {
  it('opens a new form', () => {
    expect(snippetFormTarget({ kind: 'snippet-new' }, [])).toEqual({
      mode: 'new',
    });
  });

  it('opens the snippet being edited', () => {
    expect(
      snippetFormTarget({ kind: 'snippet-edit', id: 'a' }, [NOTE]),
    ).toEqual({ mode: 'edit', snippet: NOTE });
  });

  it('reports a snippet that was removed', () => {
    expect(
      snippetFormTarget({ kind: 'snippet-edit', id: 'gone' }, [NOTE]),
    ).toBe('missing');
  });

  it('opens no form for the section itself', () => {
    expect(snippetFormTarget({ kind: 'snippets-section' }, [NOTE])).toBeNull();
  });
});
