// AI-assisted: see AI-ATTRIBUTION.md
import React from 'react';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { vi } from 'vitest';
import { ErrorPage } from '@/pages/ErrorPage';

const mockUseAuthStore = vi.fn();

vi.mock('@/store/auth', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

// Renders ErrorPage the way App.tsx does: as the errorElement of a route that threw.
const renderWithError = (error: unknown) => {
  const Thrower: React.FC = () => {
    throw error;
  };
  const router = createMemoryRouter([
    { path: '/', element: <Thrower />, errorElement: <ErrorPage /> },
  ]);
  return render(<RouterProvider router={router} />);
};

// Stops jsdom printing the errors these tests throw on purpose.
const suppressUncaught = (event: ErrorEvent) => event.preventDefault();

describe('ErrorPage', () => {
  beforeEach(() => {
    mockUseAuthStore.mockReturnValue({ lang: 'en' });
    // React and React Router log every caught render error.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.addEventListener('error', suppressUncaught);
  });

  afterEach(() => {
    window.removeEventListener('error', suppressUncaught);
    vi.restoreAllMocks();
  });

  it('shows the message of a thrown Error under the generic title', () => {
    renderWithError(new Error('Boom'));
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByText('Boom')).toBeInTheDocument();
  });

  it('falls back to the generic message when the thrown value is not an Error', () => {
    renderWithError('just a string');
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred.')).toBeInTheDocument();
  });

  it('shows the status and server message of a route error response', () => {
    renderWithError({
      status: 403,
      statusText: 'Forbidden',
      internal: false,
      data: { message: 'Not allowed here' },
    });
    expect(screen.getByRole('heading', { name: '403 Forbidden' })).toBeInTheDocument();
    expect(screen.getByText('Not allowed here')).toBeInTheDocument();
  });

  it('shows a 404 for an unmatched route', () => {
    const router = createMemoryRouter(
      [{ path: '/', element: <div />, errorElement: <ErrorPage /> }],
      { initialEntries: ['/nowhere'] }
    );
    render(<RouterProvider router={router} />);
    expect(screen.getByRole('heading', { name: '404 Not Found' })).toBeInTheDocument();
    expect(screen.getByText('Not Found')).toBeInTheDocument();
  });

  it('links back to the home route', () => {
    renderWithError(new Error('Boom'));
    expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', '/');
  });

  it('translates the page into Spanish', () => {
    mockUseAuthStore.mockReturnValue({ lang: 'es' });
    renderWithError('just a string');
    expect(screen.getByRole('heading', { name: 'Algo salio mal' })).toBeInTheDocument();
    expect(screen.getByText('Ocurrio un error inesperado.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al Inicio' })).toBeInTheDocument();
  });
});
