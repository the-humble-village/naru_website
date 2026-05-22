import React, { useRef, useState } from 'react';
import { usePhotoUrls } from '../hooks/usePhotoUrls';
import { filesApi } from '../api/files';

interface PhotoUploadProps {
  photos: number[];
  onChange: (photos: number[]) => void;
  maxPhotos?: number;
  disabled?: boolean;
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
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [error, setError] = useState<string | null>(null);
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

  const handleRemove = (fileId: number) => {
    onChange(photos.filter((id) => id !== fileId));
  };

  const canAddMore = photos.length + uploading.length < maxPhotos;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Photos</label>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {/* Existing photos */}
        {photos.map((fileId) => (
          <div
            key={fileId}
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
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(fileId)}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
              >
                X
              </button>
            )}
          </div>
        ))}

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

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled}
      />
    </div>
  );
};
