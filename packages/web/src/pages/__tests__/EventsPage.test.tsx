import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { EventWithCount } from '@naru/shared';
import { EventsPage } from '../events/EventsPage';
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

const mockEventsApi = vi.mocked(eventsApi);

const mockEvents: EventWithCount[] = [
  {
    id: 1,
    name: 'Midwives Day',
    eventDate: '2026-05-05',
    notes: 'Annual gathering',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    visitCount: 4,
  },
  {
    id: 2,
    name: 'Fathers Day',
    eventDate: '2026-03-19',
    notes: null,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
    visitCount: 0,
  },
];

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <EventsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('EventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventsApi.listEvents.mockResolvedValue({
      items: mockEvents,
      total: 2,
      skip: 0,
      limit: 25,
    });
  });

  it('renders the events it loads', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Midwives Day').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Fathers Day').length).toBeGreaterThan(0);
  });

  it('shows a link to create a new event', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('events.new')).toBeInTheDocument();
    });
    expect(screen.getByText('events.new').closest('a')).toHaveAttribute('href', '/events/new');
  });

  it('links each event to its detail page', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Midwives Day').length).toBeGreaterThan(0);
    });
    const links = screen.getAllByText('Midwives Day').map((node) => node.closest('a'));
    expect(links.every((link) => link?.getAttribute('href') === '/events/1')).toBe(true);
  });

  it('renders the date range filter and search box', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('events.search_label')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('filter.date_from')).toBeInTheDocument();
    expect(screen.getByLabelText('filter.date_to')).toBeInTheDocument();
  });

  it('shows an empty state when there are no events', async () => {
    mockEventsApi.listEvents.mockResolvedValue({ items: [], total: 0, skip: 0, limit: 25 });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('events.empty')).toBeInTheDocument();
    });
  });

  it('shows an error message when the list fails to load', async () => {
    mockEventsApi.listEvents.mockRejectedValue(new Error('boom'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('events.load_error')).toBeInTheDocument();
    });
  });
});
