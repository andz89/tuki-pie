import type { PanelFormRequest, Snippet } from '../../shared/types';

export type SnippetFormTarget =
  | { mode: 'new' }
  | { mode: 'edit'; snippet: Snippet };

export function isSnippetRequest(request: PanelFormRequest): boolean {
  return (
    request.kind === 'snippet-new' ||
    request.kind === 'snippet-edit' ||
    request.kind === 'snippets-section'
  );
}

export function isAppRequest(request: PanelFormRequest): boolean {
  return request.kind === 'app-new' || request.kind === 'apps-section';
}

// Which form a request opens. A snippet may have been removed since it was asked for.
export function snippetFormTarget(
  request: PanelFormRequest,
  snippets: Snippet[],
): SnippetFormTarget | 'missing' | null {
  if (request.kind === 'snippet-new') {
    return { mode: 'new' };
  }
  if (request.kind !== 'snippet-edit') {
    return null;
  }
  const snippet = snippets.find(({ id }) => id === request.id);
  return snippet ? { mode: 'edit', snippet } : 'missing';
}
