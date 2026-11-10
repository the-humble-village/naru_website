import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ConfirmDialog } from '../../ui/ConfirmDialog';

describe('ConfirmDialog', () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  const baseProps = {
    open: true,
    title: 'Delete Community',
    message: 'Are you sure you want to delete Kibera?',
    onConfirm,
    onCancel,
  };

  beforeEach(() => {
    onConfirm.mockReset();
    onCancel.mockReset();
  });

  describe('Visibility', () => {
    it('renders nothing when open is false', () => {
      const { container } = render(<ConfirmDialog {...baseProps} open={false} />);
      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders title and message when open', () => {
      render(<ConfirmDialog {...baseProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Delete Community' })).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to delete Kibera?')).toBeInTheDocument();
    });

    it('renders ReactNode messages', () => {
      render(<ConfirmDialog {...baseProps} message={<strong>Custom node</strong>} />);
      expect(screen.getByText('Custom node')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('is an aria-modal dialog labelled by the title', () => {
      render(<ConfirmDialog {...baseProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      expect(document.getElementById(labelledBy as string)).toHaveTextContent('Delete Community');
    });

    it('moves focus to the dialog when opened', () => {
      render(<ConfirmDialog {...baseProps} />);
      expect(screen.getByRole('dialog')).toHaveFocus();
    });
  });

  describe('Labels', () => {
    it('defaults to Delete / Cancel labels', () => {
      render(<ConfirmDialog {...baseProps} />);
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('uses custom labels when provided', () => {
      render(<ConfirmDialog {...baseProps} confirmLabel="Remove" cancelLabel="Never mind" />);
      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Never mind' })).toBeInTheDocument();
    });
  });

  describe('Confirm button styling', () => {
    it('uses hv-crisis by default (destructive)', () => {
      render(<ConfirmDialog {...baseProps} />);
      expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('bg-hv-crisis');
    });

    it('uses hv-green when destructive is false', () => {
      render(<ConfirmDialog {...baseProps} destructive={false} confirmLabel="Save" />);
      const confirm = screen.getByRole('button', { name: 'Save' });
      expect(confirm).toHaveClass('bg-hv-green');
      expect(confirm).not.toHaveClass('bg-hv-crisis');
    });
  });

  describe('Interaction', () => {
    it('calls onConfirm when the confirm button is clicked', () => {
      render(<ConfirmDialog {...baseProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('calls onCancel when the cancel button is clicked', () => {
      render(<ConfirmDialog {...baseProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('calls onCancel when Escape is pressed', () => {
      render(<ConfirmDialog {...baseProps} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('does not call onCancel on Escape when closed', () => {
      render(<ConfirmDialog {...baseProps} open={false} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('calls onCancel when the overlay is clicked', () => {
      const { container } = render(<ConfirmDialog {...baseProps} />);
      const overlay = container.firstElementChild as HTMLElement;
      fireEvent.click(overlay);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('does not call onCancel when the dialog card is clicked', () => {
      render(<ConfirmDialog {...baseProps} />);
      fireEvent.click(screen.getByRole('dialog'));
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('Warning callout', () => {
    it('renders the warning when provided', () => {
      render(<ConfirmDialog {...baseProps} warning="3 families reference this item." />);
      expect(screen.getByText('3 families reference this item.')).toBeInTheDocument();
    });

    it('does not render a warning area when omitted', () => {
      render(<ConfirmDialog {...baseProps} />);
      expect(screen.queryByText(/reference this item/i)).not.toBeInTheDocument();
    });
  });

  describe('Busy state', () => {
    it('disables the confirm button while busy', () => {
      render(<ConfirmDialog {...baseProps} busy />);
      const confirm = screen.getByRole('button', { name: 'Delete' });
      expect(confirm).toBeDisabled();
      fireEvent.click(confirm);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('enables the confirm button when not busy', () => {
      render(<ConfirmDialog {...baseProps} />);
      expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
    });
  });
});
