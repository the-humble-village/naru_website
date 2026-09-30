import { apiClient } from './client';
import {
  PhotoAttachmentRead,
  PhotoAttachmentCreate,
  PhotoAttachmentUpdate,
  PhotoOwnerType,
} from '@naru/shared';

export interface ListPhotosParams {
  ownerType?: PhotoOwnerType;
  ownerId?: number;
  fileId?: number;
  skip?: number;
  limit?: number;
}

export interface ListPhotosResponse {
  items: PhotoAttachmentRead[];
  total: number;
  skip: number;
  limit: number;
}

export const listPhotos = async (params: ListPhotosParams = {}): Promise<ListPhotosResponse> => {
  const searchParams = new URLSearchParams();

  if (params.ownerType) searchParams.set('ownerType', params.ownerType);
  if (params.ownerId !== undefined) searchParams.set('ownerId', String(params.ownerId));
  if (params.fileId !== undefined) searchParams.set('fileId', String(params.fileId));
  if (params.skip !== undefined) searchParams.set('skip', String(params.skip));
  if (params.limit !== undefined) searchParams.set('limit', String(params.limit));

  const url = `/photos${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const response = await apiClient.get<ListPhotosResponse>(url);
  return response.data;
};

export const fetchPhoto = async (id: number): Promise<PhotoAttachmentRead> => {
  const response = await apiClient.get<PhotoAttachmentRead>(`/photos/${id}`);
  return response.data;
};

export const createPhoto = async (data: PhotoAttachmentCreate): Promise<PhotoAttachmentRead> => {
  const response = await apiClient.post<PhotoAttachmentRead>('/photos', data);
  return response.data;
};

export const updatePhoto = async (
  id: number,
  data: PhotoAttachmentUpdate
): Promise<PhotoAttachmentRead> => {
  const response = await apiClient.put<PhotoAttachmentRead>(`/photos/${id}`, data);
  return response.data;
};

export const deletePhoto = async (id: number): Promise<void> => {
  await apiClient.delete(`/photos/${id}`);
};

export const reorderPhotos = async (
  ownerType: PhotoOwnerType,
  ownerId: number,
  photoIds: number[]
): Promise<{ items: PhotoAttachmentRead[]; total: number }> => {
  const response = await apiClient.post<{ items: PhotoAttachmentRead[]; total: number }>(
    '/photos/reorder',
    { ownerType, ownerId, photoIds }
  );
  return response.data;
};

export const photosApi = {
  listPhotos,
  fetchPhoto,
  createPhoto,
  updatePhoto,
  deletePhoto,
  reorderPhotos,
};
