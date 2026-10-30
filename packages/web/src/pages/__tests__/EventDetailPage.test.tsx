import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { EventWithCount, VisitListItem } from '@naru/shared';
import { EventDetailPage } from '../events/EventDetailPage';
import { eventsApi } from '../../api/events';
import { visitsApi } from '../../api/visits';

vi.mock('../../api/events', () => ({
  eventsApi: {
    listEvents: vi.fn(),
    fetchEvent: vi.fn(),
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
  },
}));

vi.mock('../../api/visits', () => ({
  visitsApi: {
    listVisits: vi.fn(),
    fetchVisitPrefill: vi.fn(),
    fetchVisit: vi.fn(),
    createVisit: vi.fn(),
    updateVisit: vi.fn(),
    deleteVisit: vi.fn(),
  },
}));

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
}));

const mockUser = vi.fn(() => ({ id: 1, role: 'SUPERVISOR' as 'ADMIN' | 'SUPERVISOR' | 'CASEWORKER' }));
vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({ user: mockUser(), lang: 'en' }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: '3' }),
  };
});

const mockEventsApi = vi.mocked(eventsApi);
const mockVisitsApi = vi.mocked(visitsApi);

const mockEvent: EventWithCount = {
  id: 3,
  name: 'Midwives Day',
  eventDate: '2026-05-05',
  notes: 'Annual gathering',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
  visitCount: 1,
};

const mockVisit: VisitListItem = {
  id: 42,
  localId: null,
  enrollmentId: 11,
  visitDate: '2026-05-05',
  locationType: 'MOBILE_CLINIC',
  siteId: 1,
  communityId: null,
  recordedById: 2,
  eventId: 3,
  notes: null,
  createdAt: '2026-05-05T00:00:00Z',
  updatedAt: '2026-05-05T00:00:00Z',
  resources: [],
  trainingIds: [],
  answers: [],
  program: { id: 5, name: 'Midwives', kind: 'MIDWIFE', subjectType: 'PERSON' },
  subjectName: 'Ana Pérez',
  recordedByName: 'Caseworker One',
};

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <EventDetailPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('EventDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.mockReturnValue({ id: 1, role: 'SUPERVISOR' });
    mockEventsApi.fetchEvent.mockResolvedValue(mockEvent);
    mockVisitsApi.listVisits.mockResolvedValue({
      items: [mockVisit],
      total: 1,
      skip: 0,
      limit: 100,
    });
  });

  it('renders the event name, date and notes', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Midwives Day')).toBeInTheDocument();
    });
    expect(screen.getAllByText('5/5/2026').length).toBeGreaterThan(0);
    expect(screen.getByText('Annual gathering')).toBeInTheDocument();
  });

  it('lists the visits recorded at the event, linked to the visit page', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Ana Pérez').length).toBeGreaterThan(0);
    });
    expect(mockVisitsApi.listVisits).toHaveBeenCalledWith({ eventId: 3, limit: 100 });
    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(links).toContain('/visits/42');
  });

  it('shows the deferred attendance affordance as disabled', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('events.attendance_button')).toBeInTheDocument();
    });
    expect(screen.getByText('events.attendance_button').closest('button')).toBeDisabled();
    expect(screen.getByText('events.attendance_deferred')).toBeInTheDocument();
  });

  it('opens an inline edit form and saves the change', async () => {
    mockEventsApi.updateEvent.mockResolvedValue({ ...mockEvent, name: 'Midwives Day 2026' });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('common.edit')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('common.edit'));

    const nameInput = screen.getByLabelText(/events.field_name/);
    fireEvent.change(nameInput, { target: { value: 'Midwives Day 2026' } });
    fireEvent.submit(nameInput.closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(mockEventsApi.updateEvent).toHaveBeenCalledWith(3, {
        name: 'Midwives Day 2026',
        eventDate: '2026-05-05',
        notes: 'Annual gathering',
      });
    });
  });

  it('hides delete from a caseworker and shows it to a supervisor', async () => {
    mockUser.mockReturnValue({ id: 1, role: 'CASEWORKER' });
    const { unmount } = renderPage();

    await waitFor(() => {
      expect(screen.getByText('common.edit')).toBeInTheDocument();
    });
    expect(screen.queryByText('common.delete')).not.toBeInTheDocument();
    unmount();

    mockUser.mockReturnValue({ id: 1, role: 'SUPERVISOR' });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('common.delete')).toBeInTheDocument();
    });
  });

  it('confirms deletion with copy that keeps the visits', async () => {
    mockEventsApi.deleteEvent.mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('common.delete')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('common.delete'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('events.delete_message')).toBeInTheDocument();

    const confirmButton = screen
      .getAllByText('common.delete')
      .map((node) => node.closest('button'))
      .find((button) => button && screen.getByRole('dialog').contains(button));
    fireEvent.click(confirmButton as HTMLButtonElement);

    await waitFor(() => {
      expect(mockEventsApi.deleteEvent).toHaveBeenCalledWith(3);
    });
  });
});
