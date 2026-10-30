import { apiClient } from './client';
import { EventWithCount, EventCreate, EventUpdate } from '@naru/shared';

export interface ListEventsParams {
  search?: string;
  from?: string;
  to?: string;
  skip?: number;
  limit?: number;
}

export interface ListEventsResponse {
  items: EventWithCount[];
  total: number;
  skip: number;
  limit: number;
}

export const listEvents = async (params: ListEventsParams = {}): Promise<ListEventsResponse> => {
  const searchParams = new URLSearchParams();

  if (params.search) searchParams.set('search', params.search);
  if (params.from) searchParams.set('from', params.from);
  if (params.to) searchParams.set('to', params.to);
  if (params.skip !== undefined) searchParams.set('skip', String(params.skip));
  if (params.limit !== undefined) searchParams.set('limit', String(params.limit));

  const url = `/events${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const response = await apiClient.get<ListEventsResponse>(url);
  return response.data;
};

export const fetchEvent = async (id: number): Promise<EventWithCount> => {
  const response = await apiClient.get<EventWithCount>(`/events/${id}`);
  return response.data;
};

export const createEvent = async (data: EventCreate): Promise<EventWithCount> => {
  const response = await apiClient.post<EventWithCount>('/events', data);
  return response.data;
};

export const updateEvent = async (id: number, data: EventUpdate): Promise<EventWithCount> => {
  const response = await apiClient.put<EventWithCount>(`/events/${id}`, data);
  return response.data;
};

export const deleteEvent = async (id: number): Promise<void> => {
  await apiClient.delete(`/events/${id}`);
};

export const eventsApi = {
  listEvents,
  fetchEvent,
  createEvent,
  updateEvent,
  deleteEvent,
};
