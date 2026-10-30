import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Layout from '../Layout';
import { programsApi } from '../../api/programs';
import { dashboardApi } from '../../api/dashboard';
import { useAuthStore } from '../../store/auth';

vi.mock('../../api/programs', () => ({
  programsApi: { listPrograms: vi.fn() },
}));

vi.mock('../../api/dashboard', () => ({
  dashboardApi: { fetchUnenrolledCount: vi.fn() },
}));

vi.mock('../../api/search', () => ({
  searchApi: { searchByName: vi.fn() },
}));

vi.mock('../../store/auth', () => ({
  useAuthStore: vi.fn(),
}));

const mockListPrograms = programsApi.listPrograms as unknown as ReturnType<typeof vi.fn>;
const mockUnenrolledCount = dashboardApi.fetchUnenrolledCount as unknown as ReturnType<typeof vi.fn>;
const mockAuthStore = useAuthStore as unknown as ReturnType<typeof vi.fn>;

const setRole = (role: 'ADMIN' | 'SUPERVISOR' | 'CASEWORKER') => {
  mockAuthStore.mockReturnValue({
    user: { id: 1, firstName: 'Caleb', lastName: 'Rowley', role },
    logout: vi.fn(),
    lang: 'en',
  });
};

const program = (id: number, name: string) => ({
  id,
  name,
  kind: 'NUTRITION' as const,
  subjectType: 'CHILD' as const,
  description: null,
  minAgeMonths: null,
  maxAgeMonths: null,
  visitIntervalDays: 30,
  active: true,
  sortOrder: id,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const renderLayout = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

// The desktop bar and the mobile panel both render the nav, so queries scope to
// the desktop <nav> to avoid matching the same link twice.
const mainNav = () => screen.getByRole('navigation', { name: 'Main' });
const sectionNav = () => screen.getByRole('navigation', { name: 'Sections' });

const openMenu = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('Layout top nav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRole('CASEWORKER');
    mockListPrograms.mockResolvedValue({ items: [], total: 0 });
    mockUnenrolledCount.mockResolvedValue({ children: 0, mothers: 0, people: 0, families: 0, total: 0 });
  });

  it('renders the brand as the dashboard link', async () => {
    renderLayout();
    expect(screen.getByRole('link', { name: 'Humble Village' })).toHaveAttribute('href', '/');
  });

  it('renders a link for every active program inside the Programs menu', async () => {
    mockListPrograms.mockResolvedValue({
      items: [program(1, 'Expectant Mother'), program(2, 'Nutrition Infant')],
      total: 2,
    });

    renderLayout();
    await waitFor(() => expect(mockListPrograms).toHaveBeenCalledWith({ activeOnly: true }));

    openMenu(/Programs/);

    const nav = mainNav();
    expect(screen.getByRole('link', { name: 'All programs' })).toHaveAttribute('href', '/programs');
    await waitFor(() => {
      expect(within(nav).getByRole('link', { name: 'Expectant Mother' })).toHaveAttribute(
        'href',
        '/programs/1'
      );
    });
    expect(within(nav).getByRole('link', { name: 'Nutrition Infant' })).toHaveAttribute(
      'href',
      '/programs/2'
    );
  });

  it('keeps program links out of the DOM until the Programs menu is opened', async () => {
    mockListPrograms.mockResolvedValue({ items: [program(1, 'Expectant Mother')], total: 1 });

    renderLayout();
    await waitFor(() => expect(mockListPrograms).toHaveBeenCalled());

    expect(screen.queryByRole('link', { name: 'Expectant Mother' })).not.toBeInTheDocument();
  });

  it('shows an empty state in the Programs menu when no programs exist', async () => {
    renderLayout();
    await waitFor(() => expect(mockListPrograms).toHaveBeenCalled());

    openMenu(/Programs/);

    await waitFor(() => {
      expect(screen.getByText('No programs yet')).toBeInTheDocument();
    });
  });

  it('shows the unenrolled count on the People trigger and links to it in the menu', async () => {
    mockUnenrolledCount.mockResolvedValue({ children: 30, mothers: 5, people: 2, families: 1, total: 38 });

    renderLayout();

    await waitFor(() => {
      expect(within(mainNav()).getByText('38')).toBeInTheDocument();
    });

    openMenu(/People/);

    expect(within(mainNav()).getByRole('link', { name: /Unenrolled/ })).toHaveAttribute(
      'href',
      '/unenrolled'
    );
  });

  it('hides the unenrolled link when the count is zero', async () => {
    renderLayout();
    await waitFor(() => expect(mockUnenrolledCount).toHaveBeenCalled());

    openMenu(/People/);

    expect(within(mainNav()).getByRole('link', { name: 'Mothers' })).toHaveAttribute('href', '/mothers');
    expect(screen.queryByRole('link', { name: /Unenrolled/ })).not.toBeInTheDocument();
  });

  it('exposes the People subject links in the menu', async () => {
    renderLayout();
    openMenu(/People/);

    const nav = within(mainNav());
    expect(nav.getByRole('link', { name: 'Mothers' })).toHaveAttribute('href', '/mothers');
    expect(nav.getByRole('link', { name: 'Children' })).toHaveAttribute('href', '/children');
    expect(nav.getByRole('link', { name: 'Persons' })).toHaveAttribute('href', '/people');
    expect(nav.getByRole('link', { name: 'Families' })).toHaveAttribute('href', '/families');
  });

  it('always shows Visits and Events', async () => {
    renderLayout();
    const nav = within(sectionNav());
    expect(nav.getByRole('link', { name: 'Visits' })).toHaveAttribute('href', '/visits');
    expect(nav.getByRole('link', { name: 'Events' })).toHaveAttribute('href', '/events');
  });

  it('hides Admin and Reports from a caseworker', async () => {
    renderLayout();
    const nav = within(sectionNav());
    expect(nav.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'Reports' })).not.toBeInTheDocument();
  });

  it('shows Admin and Reports to a supervisor and an admin', async () => {
    setRole('SUPERVISOR');
    const { unmount } = renderLayout();
    expect(within(sectionNav()).getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
    expect(within(sectionNav()).getByRole('link', { name: 'Reports' })).toHaveAttribute('href', '/reports');
    unmount();

    setRole('ADMIN');
    renderLayout();
    expect(within(sectionNav()).getByRole('link', { name: 'Admin' })).toBeInTheDocument();
    expect(within(sectionNav()).getByRole('link', { name: 'Reports' })).toBeInTheDocument();
  });

  it('opens the profile menu with the language link and logout', async () => {
    renderLayout();

    expect(screen.queryByRole('link', { name: /Language/ })).not.toBeInTheDocument();

    openMenu(/CR/);

    expect(screen.getByRole('link', { name: /Language/ })).toHaveAttribute('href', '/admin/language');
    expect(screen.getByRole('button', { name: /Log out/ })).toBeInTheDocument();
  });
});
