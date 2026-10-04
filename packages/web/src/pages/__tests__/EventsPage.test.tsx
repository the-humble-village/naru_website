import React from 'react';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { EventWithCount } from '@naru/shared';
import { EventsPage } from '../events/EventsPage';
import { eventsApi } from '../../api/events';

vi.mock('../../api/events', () => ({ eventsApi: { listEvents: vi.fn() } }));
const mockAuth = vi.fn();
vi.mock('../../store/auth', () => ({ useAuthStore: () => mockAuth() }));
const mockEventsApi = vi.mocked(eventsApi);

const events: EventWithCount[] = [
  { id: 2, name: 'pizza party', eventDate: '2026-10-24', notes: null,
    createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', visitCount: 0 },
  { id: 1, name: 'donut party', eventDate: '2026-10-13', notes: null,
    createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', visitCount: 1 },
];

const serveEvents = (items: EventWithCount[]) => {
  mockEventsApi.listEvents.mockImplementation(async (params = {}) => {
    const filtered = items.filter(event =>
      (!params.from || event.eventDate >= params.from) &&
      (!params.to || event.eventDate <= params.to) &&
      (!params.search || event.name.toLowerCase().includes(params.search.toLowerCase()))
    );
    return {
      items: filtered.slice(params.skip ?? 0, (params.skip ?? 0) + (params.limit ?? 100)),
      total: filtered.length, skip: params.skip ?? 0, limit: params.limit ?? 100,
    };
  });
};

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><EventsPage /></MemoryRouter>
  </QueryClientProvider>
);
const agenda = () => within(screen.getByRole('region', { name: 'Month agenda' }));

describe('EventsPage calendar and agenda', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ user: { id: 1, role: 'ADMIN' }, lang: 'en' });
    serveEvents(events);
  });
  afterEach(() => vi.useRealTimers());

  it('places October dates in the correct Monday-first columns and marks today', async () => {
    renderPage();
    await agenda().findByRole('link', { name: 'donut party' });
    const calendar = screen.getByRole('table', { name: 'October 2026' });
    expect(within(calendar).getAllByRole('columnheader').map(cell => cell.textContent))
      .toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    for (const [date, column] of [['October 1, 2026', 3], ['October 13, 2026', 1], ['October 24, 2026', 5]] as const) {
      expect((screen.getByRole('button', { name: date }).closest('td') as HTMLTableCellElement).cellIndex).toBe(column);
    }
    expect(screen.getByRole('button', { name: 'October 3, 2026' })).toHaveAttribute('aria-current', 'date');
    expect(within(calendar).getAllByRole('row')).toHaveLength(6);
  });

  it('shows chronological agenda entries, correct linked-visit counts and working destinations', async () => {
    renderPage();
    const links = await agenda().findAllByRole('link');
    expect(links.map(link => link.textContent)).toEqual([
      expect.stringContaining('donut party'), expect.stringContaining('pizza party'),
    ]);
    expect(links[0]).toHaveAttribute('href', '/events/1');
    expect(links[0]).toHaveAccessibleDescription('13/10/2026. 1 linked visit');
    expect(links[1]).toHaveAccessibleDescription('24/10/2026. 0 linked visits');
    expect(screen.getByRole('link', { name: 'New event' })).toHaveAttribute('href', '/events/new');
    expect(within(screen.getByRole('table')).getByRole('link', { name: 'pizza party' })).toHaveAttribute('href', '/events/2');
  });

  it('navigates months and rolls December over to January', async () => {
    const user = userEvent.setup();
    renderPage();
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-12-01' } });
    expect(screen.getByRole('heading', { name: 'December 2026' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { name: 'January 2027' })).toBeInTheDocument();
    await waitFor(() => expect(mockEventsApi.listEvents).toHaveBeenLastCalledWith(expect.objectContaining({
      from: '2027-01-01', to: '2027-01-31', skip: 0,
    })));
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('heading', { name: 'December 2026' })).toBeInTheDocument();
  });

  it('handles leap years without shifting date-only events across time zones', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2028-02-01' } });
    expect(screen.getByRole('button', { name: 'February 29, 2028' })).toBeInTheDocument();
    await waitFor(() => expect(mockEventsApi.listEvents).toHaveBeenLastCalledWith(expect.objectContaining({ to: '2028-02-29' })));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2027-02-01' } });
    expect(screen.getByRole('button', { name: 'February 28, 2027' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'February 29, 2027' })).not.toBeInTheDocument();
  });

  it('applies date bounds to both calendar and agenda', async () => {
    renderPage();
    await agenda().findByRole('link', { name: 'donut party' });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-20' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-31' } });
    await waitFor(() => expect(agenda().getAllByRole('link')).toHaveLength(1));
    expect(agenda().getByRole('link', { name: 'pizza party' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'donut party' })).not.toBeInTheDocument();
    expect(mockEventsApi.listEvents).toHaveBeenLastCalledWith(expect.objectContaining({
      from: '2026-10-20', to: '2026-10-31',
    }));
  });

  it('searches the visible month and clears search without losing keyboard focus', async () => {
    const user = userEvent.setup();
    renderPage();
    await agenda().findByRole('link', { name: 'pizza party' });
    await user.type(screen.getByRole('searchbox'), 'donut');
    await waitFor(() => expect(agenda().getAllByRole('link')).toHaveLength(1));
    expect(agenda().getByRole('link', { name: 'donut party' })).toBeInTheDocument();
    expect(mockEventsApi.listEvents).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'donut' }));
    await user.click(screen.getByRole('button', { name: 'Clear event search' }));
    await waitFor(() => expect(agenda().getAllByRole('link')).toHaveLength(2));
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });

  it('selects a day and restores the month agenda', async () => {
    const user = userEvent.setup();
    renderPage();
    await agenda().findByRole('link', { name: 'donut party' });
    await user.click(screen.getByRole('button', { name: 'October 13, 2026' }));
    const dayAgenda = within(screen.getByRole('region', { name: 'October 13, 2026' }));
    expect(dayAgenda.getAllByRole('link')).toHaveLength(1);
    expect(dayAgenda.getByRole('link', { name: 'donut party' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All dates' }));
    expect(agenda().getAllByRole('link')).toHaveLength(2);
  });

  it('loads every API page and makes crowded-day events accessible through the agenda', async () => {
    const user = userEvent.setup();
    serveEvents(Array.from({ length: 101 }, (_, i) => ({
      ...events[1]!, id: i + 1, name: 'Event ' + (i + 1),
    })));
    renderPage();
    await waitFor(() => expect(agenda().getAllByRole('link')).toHaveLength(101));
    expect(mockEventsApi.listEvents).toHaveBeenCalledWith(expect.objectContaining({ skip: 100, limit: 100 }));
    expect(within(screen.getByRole('table')).getAllByRole('link')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Show all events on October 13, 2026' }));
    expect(within(screen.getByRole('region', { name: 'October 13, 2026' })).getAllByRole('link')).toHaveLength(101);
  });

  it('keeps the calendar visible with useful month and day empty states', async () => {
    const user = userEvent.setup();
    serveEvents([]);
    renderPage();
    expect(await screen.findByText('No events match this month and these filters.')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'October 2026' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'October 13, 2026' }));
    expect(screen.getByText('No matching events on this date.')).toBeInTheDocument();
  });

  it('rejects reversed date filters without issuing a request for an invalid range', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-20' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-10' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Choose an end date on or after the start date.');
    expect(mockEventsApi.listEvents.mock.calls.every(([params]) => !params?.from || !params.to || params.from <= params.to)).toBe(true);
  });

  it('shows a retry action when loading fails and recovers', async () => {
    const user = userEvent.setup();
    mockEventsApi.listEvents.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load events.');
    serveEvents(events);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await agenda().findByRole('link', { name: 'donut party' });
  });

  it('localizes the calendar, filters, agenda, and visit labels', async () => {
    mockAuth.mockReturnValue({ user: { id: 1, role: 'ADMIN' }, lang: 'es' });
    renderPage();
    const spanishAgenda = within(screen.getByRole('region', { name: 'Agenda del mes' }));
    await spanishAgenda.findByRole('link', { name: 'donut party' });
    expect(screen.getByRole('table', { name: 'octubre de 2026' })).toBeInTheDocument();
    expect(screen.getByLabelText('Desde')).toBeInTheDocument();
    expect(spanishAgenda.getByText('1 visita vinculada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeInTheDocument();
  });
});
