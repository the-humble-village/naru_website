import { apiClient } from './client';
import type {
  PresignUploadRequest,
  PresignUploadResponse,
  ConfirmUploadResponse,
  PresignDownloadResponse,
} from '@naru/shared';

export const filesApi = {
  requestPresignedUpload: async (data: PresignUploadRequest): Promise<PresignUploadResponse> => {
    const response = await apiClient.post('/files/presign-upload', data);
    return response.data;
  },

  confirmUpload: async (fileId: number): Promise<ConfirmUploadResponse> => {
    const response = await apiClient.post('/files/confirm-upload', { fileId });
    return response.data;
  },

  getPresignedDownloadUrls: async (fileIds: number[]): Promise<PresignDownloadResponse> => {
    const response = await apiClient.post('/files/presign-download', { fileIds });
    return response.data;
  },

  uploadFileToS3: (
    uploadUrl: string,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);

      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`S3 upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('S3 upload failed'));
      xhr.send(file);
    });
  },
};
