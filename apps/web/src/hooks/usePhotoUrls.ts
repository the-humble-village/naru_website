import { useQuery } from '@tanstack/react-query';
import { filesApi } from '../api/files';

/**
 * Resolves an array of file IDs to presigned download URLs.
 * Returns a Record<number, string> mapping fileId to URL.
 */
export function usePhotoUrls(fileIds: number[]): {
  urls: Record<number, string>;
  isLoading: boolean;
} {
  const sorted = [...fileIds].sort((a, b) => a - b);

  const { data, isLoading } = useQuery({
    queryKey: ['file-urls', ...sorted],
    queryFn: async () => {
      const response = await filesApi.getPresignedDownloadUrls(sorted);
      const map: Record<number, string> = {};
      for (const entry of response.urls) {
        map[entry.fileId] = entry.url;
      }
      return map;
    },
    enabled: sorted.length > 0,
    staleTime: 30 * 60 * 1000, // 30 min (presigned URLs valid for 1 hour)
  });

  return {
    urls: data ?? {},
    isLoading: isLoading && sorted.length > 0,
  };
}
