import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AddEventPage } from '../events/AddEventPage';
import { eventsApi } from '../../api/events';

vi.mock('../../api/events', () => ({
  eventsApi: {
    listEvents: vi.fn(),
    fetchEvent: vi.fn(),
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
  },
}));

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
}));

vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({ user: { id: 1, role: 'ADMIN' }, lang: 'en' }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockEventsApi = vi.mocked(eventsApi);

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AddEventPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('AddEventPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the name, date and notes fields', () => {
    renderPage();

    expect(screen.getByLabelText(/events.field_name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/events.field_date/)).toBeInTheDocument();
    expect(screen.getByLabelText(/events.field_notes/)).toBeInTheDocument();
  });

  it('defaults the date to today', () => {
    renderPage();

    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    expect(screen.getByLabelText(/events.field_date/)).toHaveValue(expected);
  });

  it('blocks submission and shows a field error when the name is blank', async () => {
    renderPage();

    fireEvent.submit(screen.getByLabelText(/events.field_name/).closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(mockEventsApi.createEvent).not.toHaveBeenCalled();
    });
    expect(screen.getByText(/String must contain at least 1/)).toBeInTheDocument();
  });

  it('creates the event and navigates to its detail page', async () => {
    mockEventsApi.createEvent.mockResolvedValue({
      id: 7,
      name: 'Teen activity',
      eventDate: '2026-07-01',
      notes: null,
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-01T00:00:00Z',
      visitCount: 0,
    });

    renderPage();

    fireEvent.change(screen.getByLabelText(/events.field_name/), {
      target: { value: 'Teen activity' },
    });
    fireEvent.change(screen.getByLabelText(/events.field_date/), {
      target: { value: '2026-07-01' },
    });
    fireEvent.submit(screen.getByLabelText(/events.field_name/).closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(mockEventsApi.createEvent).toHaveBeenCalled();
    });
    expect(mockEventsApi.createEvent.mock.calls[0]?.[0]).toEqual({
      name: 'Teen activity',
      eventDate: '2026-07-01',
      notes: null,
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/events/7');
    });
  });
});
