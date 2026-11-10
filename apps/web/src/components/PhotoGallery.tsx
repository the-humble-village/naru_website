import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { usePhotoUrls } from '../hooks/usePhotoUrls';
import { filesApi } from '../api/files';
import { ConfirmDialog } from './ui/ConfirmDialog';

interface PhotoGalleryProps {
  photos: number[];
  /**
   * Show the per-photo delete affordance. Defaults to true.
   * Pass `false` on surfaces where the current user may not modify the owning record.
   */
  canDelete?: boolean;
  /**
   * Called after the file has been deleted server-side. The owning page should
   * invalidate its own record query here (the backend detaches the id from the
   * record's `photos` array, so a refetch is enough — no manual splice needed).
   * When omitted, the gallery invalidates every query so the owning record is
   * refetched without the deleted id.
   */
  onDeleted?: (fileId: number) => void;
}

/**
 * PhotoGallery - Read view for a record's photos, with an optional delete
 * affordance per photo. Entity-agnostic: it only knows file ids, and reports
 * deletions through `onDeleted`.
 */
export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  photos,
  canDelete = true,
  onDeleted,
}) => {
  const queryClient = useQueryClient();
  // Ids removed in this session — the owning record's cached `photos` array may
  // still contain them until its query refetches.
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visiblePhotos = photos.filter((id) => !deletedIds.includes(id));
  const { urls, isLoading } = usePhotoUrls(visiblePhotos);

  const deleteMutation = useMutation({
    mutationFn: (fileId: number) => filesApi.deleteFile(fileId),
    onSuccess: (_data, fileId) => {
      setDeletedIds((prev) => [...prev, fileId]);
      queryClient.invalidateQueries({ queryKey: ['file-urls'] });
      if (onDeleted) {
        onDeleted(fileId);
      } else {
        // No owner hook supplied — refresh everything so the record that
        // referenced this file reloads without it.
        queryClient.invalidateQueries();
      }
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to delete photo');
    },
    onSettled: () => {
      setPendingId(null);
      setDeletingId(null);
    },
  });

  const handleConfirmDelete = () => {
    if (pendingId === null) return;
    setError(null);
    setDeletingId(pendingId);
    deleteMutation.mutate(pendingId);
  };

  if (visiblePhotos.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-2">Photos</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {visiblePhotos.map((fileId) => {
          const isDeleting = deletingId === fileId;
          return (
            <div
              key={fileId}
              aria-busy={isDeleting}
              className="group relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-hv-border"
            >
              {isLoading || !urls[fileId] ? (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : (
                <a href={urls[fileId]} target="_blank" rel="noopener noreferrer">
                  <img
                    src={urls[fileId]}
                    alt={`Photo ${fileId}`}
                    className="w-full h-full object-cover hover:opacity-90 transition-opacity cursor-pointer"
                  />
                </a>
              )}

              {canDelete && (
                <button
                  type="button"
                  aria-label={`Delete photo ${fileId}`}
                  title="Delete photo"
                  disabled={isDeleting}
                  onClick={() => {
                    setError(null);
                    setPendingId(fileId);
                  }}
                  className="absolute top-1 right-1 w-6 h-6 bg-hv-crisis text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-red-800 transition-opacity disabled:opacity-100 disabled:cursor-not-allowed"
                >
                  <Trash2 size={12} />
                </button>
              )}

              {isDeleting && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                  <svg className="w-6 h-6 animate-spin text-hv-crisis" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="sr-only">Deleting photo {fileId}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-sm text-hv-crisis mt-2">{error}</p>}

      <ConfirmDialog
        open={pendingId !== null}
        title="Delete photo"
        message="This photo will be removed from this record and deleted from storage. This cannot be undone."
        confirmLabel="Delete"
        busy={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingId(null)}
      />
    </div>
  );
};
