import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { PageHeader } from '../../ui/PageHeader';

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('PageHeader', () => {
  describe('Title', () => {
    it('renders the title', () => {
      renderWithRouter(<PageHeader title="Family Details" />);
      expect(screen.getByRole('heading', { name: 'Family Details' })).toBeInTheDocument();
    });
  });

  describe('Back link', () => {
    it('renders back link when backTo and backLabel are provided', () => {
      renderWithRouter(<PageHeader title="Details" backTo="/families" backLabel="Back to Families" />);
      const link = screen.getByRole('link', { name: /back to families/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/families');
    });

    it('does not render back link when backTo is omitted', () => {
      renderWithRouter(<PageHeader title="Details" backLabel="Back" />);
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('does not render back link when backLabel is omitted', () => {
      renderWithRouter(<PageHeader title="Details" backTo="/families" />);
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('Actions slot', () => {
    it('renders action elements when provided', () => {
      renderWithRouter(
        <PageHeader
          title="Details"
          actions={<button>Edit</button>}
        />
      );
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });

    it('does not render actions area when omitted', () => {
      renderWithRouter(<PageHeader title="Details" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders multiple action elements', () => {
      renderWithRouter(
        <PageHeader
          title="Details"
          actions={
            <>
              <button>Edit</button>
              <button>Delete</button>
            </>
          }
        />
      );
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });
  });
});
