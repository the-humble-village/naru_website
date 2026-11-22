import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import StatStrip from '../StatStrip';

const renderStrip = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('StatStrip', () => {
  it('renders a borderless cell per stat', () => {
    const { container } = renderStrip(
      <StatStrip
        stats={[
          { label: 'Active', value: 42 },
          { label: 'New this month', value: 6 },
        ]}
      />
    );

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('New this month')).toBeInTheDocument();

    const grid = container.firstElementChild as HTMLElement;
    expect(grid).toHaveClass('grid', 'grid-cols-2', 'md:grid-cols-4', 'gap-4');

    const cell = screen.getByText('42').parentElement as HTMLElement;
    expect(cell).toHaveClass('bg-white', 'p-8', 'rounded-lg');
    expect(cell.className).not.toContain('border');
  });

  it('uses the green value colour by default and crisis for the crisis tone', () => {
    renderStrip(
      <StatStrip
        stats={[
          { label: 'Active', value: 42 },
          { label: 'Overdue', value: 7, tone: 'crisis' },
        ]}
      />
    );

    expect(screen.getByText('42')).toHaveClass('text-4xl', 'font-bold', 'text-hv-green');
    expect(screen.getByText('7')).toHaveClass('text-4xl', 'font-bold', 'text-hv-crisis');
  });

  it('renders a link when the stat has a destination', () => {
    renderStrip(<StatStrip stats={[{ label: 'Overdue', value: 7, to: '/programs/1?tab=overdue' }]} />);

    expect(screen.getByRole('link', { name: /Overdue/ })).toHaveAttribute(
      'href',
      '/programs/1?tab=overdue'
    );
  });

  it('renders nothing when there are no stats', () => {
    const { container } = renderStrip(<StatStrip stats={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
