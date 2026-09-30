import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PlaceholderPage from '../PlaceholderPage';

vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({ lang: 'en' }),
}));

describe('PlaceholderPage', () => {
  it('renders the title and the coming-soon copy', () => {
    render(<PlaceholderPage title="Program roster" />);

    expect(screen.getByRole('heading', { name: 'Program roster' })).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    expect(screen.getByText('This screen has not been built yet.')).toBeInTheDocument();
  });

  it('renders a custom note in place of the default', () => {
    render(<PlaceholderPage title="Mobile clinics" note="Needs event attendance." />);

    expect(screen.getByText('Needs event attendance.')).toBeInTheDocument();
    expect(screen.queryByText('This screen has not been built yet.')).not.toBeInTheDocument();
  });
});
