import type { NotesBridge } from '../../shared/types';

declare global {
  interface Window {
    notes: NotesBridge;
  }
}

export const notesBridge: NotesBridge = window.notes;
