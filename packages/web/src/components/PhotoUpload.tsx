import React, { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { usePhotoUrls } from '../hooks/usePhotoUrls';
import { type PendingPhotoDeletions } from '../hooks/usePendingPhotoDeletions';
import { filesApi } from '../api/files';
import { ConfirmDialog } from './ui/ConfirmDialog';

interface PhotoUploadProps {
  photos: number[];
  onChange: (photos: number[]) => void;
  maxPhotos?: number;
  disabled?: boolean;
  /**
   * Show the per-photo delete affordance. Defaults to true.
   * Pass `false` where the current user may not remove existing photos.
   */
  canDelete?: boolean;
  /**
   * Called after the file has been deleted server-side (in addition to
   * `onChange` with the id removed). The owning page should invalidate its own
   * record query here — the backend already detached the id from every record
   * that referenced it.
   *
   * Not called when `pendingDeletions` is set; the owning page is already
   * driving the save in that case.
   */
  onDeleted?: (fileId: number) => void;
  /**
   * Defer deletion until the surrounding edit form is saved, from
   * `usePendingPhotoDeletions()`. Without it a removal is irreversible the
   * instant it is confirmed, so cancelling the form cannot bring the photo back.
   *
   * Omit on create forms, where there is no record to cancel back to and an
   * immediate delete is what stops the just-uploaded file being orphaned.
   */
  pendingDeletions?: PendingPhotoDeletions;
}

interface UploadingFile {
  id: string;
  name: string;
  progress: number;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({
  photos,
  onChange,
  maxPhotos = 10,
  disabled = false,
  canDelete = true,
  onDeleted,
  pendingDeletions,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const { urls, isLoading } = usePhotoUrls(photos);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);

    const remaining = maxPhotos - photos.length;
    const filesToUpload = Array.from(files).slice(0, remaining);

    if (filesToUpload.length === 0) {
      setError(`Maximum of ${maxPhotos} photos allowed`);
      return;
    }

    const newIds: number[] = [];

    for (const file of filesToUpload) {
      const tempId = `${Date.now()}-${file.name}`;

      setUploading((prev) => [...prev, { id: tempId, name: file.name, progress: 0 }]);

      try {
        // Step 1: Get presigned upload URL
        const presign = await filesApi.requestPresignedUpload({
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
        });

        // Step 2: Upload directly to S3
        await filesApi.uploadFileToS3(presign.uploadUrl, file, (progress) => {
          setUploading((prev) =>
            prev.map((u) => (u.id === tempId ? { ...u, progress } : u))
          );
        });

        // Step 3: Confirm upload
        await filesApi.confirmUpload(presign.fileId);

        newIds.push(presign.fileId);
      } catch (err) {
        setError(`Failed to upload ${file.name}`);
        console.error('Upload error:', err);
      } finally {
        setUploading((prev) => prev.filter((u) => u.id !== tempId));
      }
    }

    if (newIds.length > 0) {
      onChange([...photos, ...newIds]);
    }

    // Reset input so the same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  // Removing a photo deletes the underlying File record (soft delete + storage
  // object). Without this the file would be orphaned in storage forever.
  const deleteMutation = useMutation({
    mutationFn: (fileId: number) => filesApi.deleteFile(fileId),
    onSuccess: (_data, fileId) => {
      onChange(photos.filter((id) => id !== fileId));
      queryClient.invalidateQueries({ queryKey: ['file-urls'] });
      onDeleted?.(fileId);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to delete photo');
    },
    onSettled: () => {
      setPendingRemoveId(null);
      setRemovingId(null);
    },
  });

  const handleConfirmRemove = () => {
    if (pendingRemoveId === null) return;
    setError(null);

    // Staged mode: drop the photo from the form now, delete it for real only
    // once the surrounding form saves. Cancelling the form leaves it untouched.
    if (pendingDeletions) {
      pendingDeletions.stage(pendingRemoveId);
      onChange(photos.filter((id) => id !== pendingRemoveId));
      setPendingRemoveId(null);
      return;
    }

    setRemovingId(pendingRemoveId);
    deleteMutation.mutate(pendingRemoveId);
  };

  const showDelete = canDelete && !disabled;
  const canAddMore = photos.length + uploading.length < maxPhotos;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Photos</label>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {/* Existing photos */}
        {photos.map((fileId) => {
          const isRemoving = removingId === fileId;
          return (
            <div
              key={fileId}
              aria-busy={isRemoving}
              className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-hv-border"
            >
              {isLoading || !urls[fileId] ? (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : (
                <img
                  src={urls[fileId]}
                  alt={`Photo ${fileId}`}
                  className="w-full h-full object-cover"
                />
              )}
              {showDelete && (
                <button
                  type="button"
                  aria-label={`Delete photo ${fileId}`}
                  title="Delete photo"
                  disabled={isRemoving}
                  onClick={() => {
                    setError(null);
                    setPendingRemoveId(fileId);
                  }}
                  className="absolute top-1 right-1 w-6 h-6 bg-hv-crisis text-white rounded-full flex items-center justify-center hover:bg-red-800 transition-colors disabled:cursor-not-allowed"
                >
                  <Trash2 size={12} />
                </button>
              )}
              {isRemoving && (
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

        {/* Uploading files */}
        {uploading.map((file) => (
          <div
            key={file.id}
            className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-hv-border flex flex-col items-center justify-center"
          >
            <div className="text-xs text-gray-500 mb-1 px-1 truncate w-full text-center">
              {file.name}
            </div>
            <div className="w-3/4 bg-gray-200 rounded-full h-2">
              <div
                className="bg-hv-green h-2 rounded-full transition-all"
                style={{ width: `${file.progress}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">{file.progress}%</div>
          </div>
        ))}

        {/* Add button */}
        {canAddMore && !disabled && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-hv-green hover:text-hv-green transition-colors"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs mt-1">Add Photo</span>
          </button>
        )}
      </div>

      {(error || pendingDeletions?.error) && (
        <p className="text-sm text-red-600 mt-2">{error || pendingDeletions?.error}</p>
      )}
      {pendingDeletions && pendingDeletions.ids.length > 0 && (
        <p className="text-xs text-hv-sage mt-2">
          {pendingDeletions.ids.length} photo{pendingDeletions.ids.length !== 1 ? 's' : ''} will be
          deleted when you save.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled}
      />

      <ConfirmDialog
        open={pendingRemoveId !== null}
        title={pendingDeletions ? 'Remove photo' : 'Delete photo'}
        message={
          pendingDeletions
            ? 'This photo will be removed from the form now and deleted from storage when you save. Cancel the edit to keep it.'
            : 'This photo will be removed from this record and deleted from storage. This cannot be undone.'
        }
        confirmLabel={pendingDeletions ? 'Remove' : 'Delete'}
        busy={deleteMutation.isPending}
        onConfirm={handleConfirmRemove}
        onCancel={() => setPendingRemoveId(null)}
      />
    </div>
  );
};
