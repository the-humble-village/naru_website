import React from 'react';
import { usePhotoUrls } from '../hooks/usePhotoUrls';

interface PhotoGalleryProps {
  photos: number[];
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({ photos }) => {
  const { urls, isLoading } = usePhotoUrls(photos);

  if (photos.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-2">Photos</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
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
              <a href={urls[fileId]} target="_blank" rel="noopener noreferrer">
                <img
                  src={urls[fileId]}
                  alt={`Photo ${fileId}`}
                  className="w-full h-full object-cover hover:opacity-90 transition-opacity cursor-pointer"
                />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
