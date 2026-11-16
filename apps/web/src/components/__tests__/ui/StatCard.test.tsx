import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatCard } from '../../ui/StatCard';

describe('StatCard', () => {
  it('renders the value and label', () => {
    render(<StatCard value={42} label="Total Families" />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Total Families')).toBeInTheDocument();
  });

  it('renders string values', () => {
    render(<StatCard value="N/A" label="Score" />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('uses green color class for default variant', () => {
    render(<StatCard value={10} label="Total" />);
    expect(screen.getByText('10')).toHaveClass('text-hv-green');
  });

  it('uses crisis color class for crisis variant', () => {
    render(<StatCard value={3} label="In Crisis" variant="crisis" />);
    expect(screen.getByText('3')).toHaveClass('text-hv-crisis');
  });

  it('defaults to default variant when variant is omitted', () => {
    render(<StatCard value={5} label="Count" />);
    expect(screen.getByText('5')).not.toHaveClass('text-hv-crisis');
    expect(screen.getByText('5')).toHaveClass('text-hv-green');
  });
});
