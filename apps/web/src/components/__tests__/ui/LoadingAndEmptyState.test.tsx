import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LoadingState } from '../../ui/LoadingState';
import { EmptyState } from '../../ui/EmptyState';

describe('LoadingState', () => {
  it('renders default loading message', () => {
    render(<LoadingState />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders custom message when provided', () => {
    render(<LoadingState message="Fetching families..." />);
    expect(screen.getByText('Fetching families...')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders the provided message', () => {
    render(<EmptyState message="No families found" />);
    expect(screen.getByText('No families found')).toBeInTheDocument();
  });

  it('renders different messages correctly', () => {
    render(<EmptyState message="No visits recorded yet" />);
    expect(screen.getByText('No visits recorded yet')).toBeInTheDocument();
  });
});
