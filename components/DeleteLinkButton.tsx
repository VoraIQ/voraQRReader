'use client';

import { deleteLinkAction } from '@/app/actions';

export default function DeleteLinkButton({ id, label }: { id: number; label: string }) {
  return (
    <form
      action={deleteLinkAction}
      onSubmit={(e) => {
        if (!confirm(`Delete "${label}"? This also removes its scan history. This can't be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn-icon btn-icon-danger" aria-label={`Delete ${label}`} title="Delete">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </button>
    </form>
  );
}
