import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AdminSitesPage } from '../admin/AdminSitesPage';
import { sitesApi } from '../../api/sites';
import { type SiteRead } from '@naru/shared';

vi.mock('../../api/sites', () => ({
  sitesApi: {
    list: vi.fn(),
    fetch: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// MapPicker pulls in leaflet, which does not run in jsdom. Stub it with a
// minimal controlled input for lat/lng so the form remains testable.
vi.mock('../../components/MapPicker', () => ({
  MapPicker: ({
    value,
    onChange,
  }: {
    value: { lat: number | null; lng: number | null; boundary: [number, number][] | null };
    onChange: (v: { lat: number | null; lng: number | null; boundary: [number, number][] | null }) => void;
  }) => (
    <div>
      <span data-testid="map-lat">{value.lat ?? ''}</span>
      <span data-testid="map-lng">{value.lng ?? ''}</span>
      <button type="button" onClick={() => onChange({ ...value, lat: 1.5, lng: -2.5 })}>
        Set Pin
      </button>
    </div>
  ),
}));

const mockAdminUser = {
  id: 1,
  login: 'admin',
  email: 'admin@test.com',
  firstName: 'Admin',
  lastName: 'User',
  role: 'ADMIN' as const,
  lang: 'en',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  localId: null,
};

const mockUser = vi.fn(() => mockAdminUser as { role: 'ADMIN' | 'SUPERVISOR' | 'CASEWORKER' });

vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({ user: mockUser() }),
}));

const clinicAlpha: SiteRead = {
  id: 1,
  title: 'Clinic Alpha',
  lat: 15.5,
  lng: -90.3,
  boundary: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockSites: SiteRead[] = [
  clinicAlpha,
  {
    id: 2,
    title: 'Clinic Beta',
    lat: null,
    lng: null,
    boundary: null,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={['/admin/sites']}>
      <QueryClientProvider client={queryClient}>
        <AdminSitesPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

const rowFor = (title: string) => screen.getByText(title).closest('tr') as HTMLElement;

describe('AdminSitesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.mockReturnValue(mockAdminUser);
    vi.mocked(sitesApi.list).mockResolvedValue(mockSites);
  });

  it('renders the sites table', async () => {
    renderPage();

    expect(await screen.findByText('Clinic Alpha')).toBeInTheDocument();
    expect(screen.getByText('Clinic Beta')).toBeInTheDocument();
    expect(screen.getByText(/15\.5000, -90\.3000/)).toBeInTheDocument();
  });

  it('hides the page from non-admin users', async () => {
    mockUser.mockReturnValue({ ...mockAdminUser, role: 'SUPERVISOR' });

    const { container } = renderPage();

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('edit', () => {
    it('edits both displayed columns (name and location)', async () => {
      const user = userEvent.setup();
      vi.mocked(sitesApi.update).mockResolvedValue({ ...clinicAlpha, title: 'Clinic Alpha 2' });

      renderPage();
      await screen.findByText('Clinic Alpha');

      await user.click(within(rowFor('Clinic Alpha')).getByRole('button', { name: 'Edit' }));

      const nameInput = screen.getByDisplayValue('Clinic Alpha');
      await user.clear(nameInput);
      await user.type(nameInput, 'Clinic Alpha 2');
      await user.click(screen.getByRole('button', { name: 'Set Pin' }));
      await user.click(screen.getByRole('button', { name: 'Update Site' }));

      await waitFor(() => {
        expect(sitesApi.update).toHaveBeenCalledWith(1, {
          title: 'Clinic Alpha 2',
          lat: 1.5,
          lng: -2.5,
          boundary: null,
        });
      });
    });
  });

  describe('delete confirmation', () => {
    it('opens the ConfirmDialog instead of window.confirm', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm');

      renderPage();
      await screen.findByText('Clinic Alpha');
      await user.click(within(rowFor('Clinic Alpha')).getByRole('button', { name: 'Delete' }));

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Delete Site')).toBeInTheDocument();
      expect(within(dialog).getByText(/Clinic Alpha/)).toBeInTheDocument();
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(sitesApi.delete).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('warns about referencing families without blocking the delete', async () => {
      const user = userEvent.setup();

      renderPage();
      await screen.findByText('Clinic Alpha');
      await user.click(within(rowFor('Clinic Alpha')).getByRole('button', { name: 'Delete' }));

      const dialog = await screen.findByRole('dialog');
      expect(
        within(dialog).getByText(/Families already assigned to this site keep their current value/i)
      ).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeEnabled();
    });

    it('deletes the site when confirmed', async () => {
      const user = userEvent.setup();
      vi.mocked(sitesApi.delete).mockResolvedValue(undefined);

      renderPage();
      await screen.findByText('Clinic Beta');
      await user.click(within(rowFor('Clinic Beta')).getByRole('button', { name: 'Delete' }));

      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

      await waitFor(() => {
        expect(sitesApi.delete).toHaveBeenCalledWith(2);
      });
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('does not delete when cancelled', async () => {
      const user = userEvent.setup();

      renderPage();
      await screen.findByText('Clinic Alpha');
      await user.click(within(rowFor('Clinic Alpha')).getByRole('button', { name: 'Delete' }));

      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(sitesApi.delete).not.toHaveBeenCalled();
    });

    it('surfaces a failed delete and keeps the dialog open', async () => {
      const user = userEvent.setup();
      vi.mocked(sitesApi.delete).mockRejectedValue(new Error('Boom'));

      renderPage();
      await screen.findByText('Clinic Alpha');
      await user.click(within(rowFor('Clinic Alpha')).getByRole('button', { name: 'Delete' }));

      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

      expect(await screen.findByText(/Failed to delete site: Boom/)).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
