import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { filesApi } from '../api/files';

export interface PendingPhotoDeletions {
  /** File ids the user has removed but which are not yet deleted server-side. */
  ids: number[];
  /** Mark a photo for deletion. The caller still drops it from its own photos array. */
  stage: (fileId: number) => void;
  /** Forget every staged deletion — nothing was sent, so nothing to undo. */
  discard: () => void;
  /** Actually delete every staged file. Call this only after the record saved. */
  commit: () => Promise<void>;
  isCommitting: boolean;
  error: string | null;
}

/**
 * Defers photo deletion until an edit form is saved.
 *
 * Deleting a file is irreversible (the row is soft-deleted and the storage
 * object is gone), so doing it the moment the user clicks the X means cancelling
 * the form cannot bring the photo back. Instead the removal is staged: the photo
 * disappears from the form immediately, and the delete only fires from
 * `commit()` once the record itself has been saved. `discard()` on cancel throws
 * the staged list away and the photo is still there.
 *
 * Commit after the record update, not before — if the update fails, the files
 * must survive. By then the saved photos array no longer references them, so the
 * server-side detach is a no-op.
 */
export function usePendingPhotoDeletions(): PendingPhotoDeletions {
  const queryClient = useQueryClient();
  const [ids, setIds] = useState<number[]>([]);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `commit` is often called from a mutation's onSuccess, which may hold a
  // closure from an older render. Deleting files is irreversible, so it reads
  // the staged list from a ref rather than risking a stale `ids`.
  const idsRef = useRef<number[]>([]);
  const setStaged = useCallback((next: number[]) => {
    idsRef.current = next;
    setIds(next);
  }, []);

  const stage = useCallback((fileId: number) => {
    setError(null);
    if (!idsRef.current.includes(fileId)) {
      setStaged([...idsRef.current, fileId]);
    }
  }, [setStaged]);

  const discard = useCallback(() => {
    setStaged([]);
    setError(null);
  }, [setStaged]);

  const commit = useCallback(async () => {
    const staged = idsRef.current;
    if (staged.length === 0) return;

    setIsCommitting(true);
    setError(null);
    try {
      const outcomes = await Promise.allSettled(staged.map((id) => filesApi.deleteFile(id)));
      const failed = outcomes.filter((o) => o.status === 'rejected');

      // A failed cleanup leaves an orphaned file, which is untidy but harmless —
      // the record itself already saved without it. Surface it, do not throw.
      if (failed.length > 0) {
        console.error('Failed to delete photos:', failed.map((f) => f.reason));
        setError(
          failed.length === 1
            ? 'One photo could not be deleted from storage.'
            : `${failed.length} photos could not be deleted from storage.`
        );
      }

      setStaged([]);
      queryClient.invalidateQueries({ queryKey: ['file-urls'] });
    } finally {
      setIsCommitting(false);
    }
  }, [queryClient, setStaged]);

  return { ids, stage, discard, commit, isCommitting, error };
}
