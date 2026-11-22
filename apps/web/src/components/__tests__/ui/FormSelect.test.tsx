import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { FormSelect } from '../../ui/FormSelect';

const options = [
  { value: '1', label: 'Option A' },
  { value: '2', label: 'Option B' },
  { value: '3', label: 'Option C' },
];

describe('FormSelect', () => {
  const baseProps = {
    label: 'Category',
    name: 'category',
    value: '',
    onChange: vi.fn(),
    options,
  };

  describe('Rendering', () => {
    it('renders label and select', () => {
      render(<FormSelect {...baseProps} />);
      expect(screen.getByLabelText('Category')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('renders all options', () => {
      render(<FormSelect {...baseProps} />);
      expect(screen.getByRole('option', { name: 'Option A' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Option B' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Option C' })).toBeInTheDocument();
    });

    it('renders placeholder as first disabled option', () => {
      render(<FormSelect {...baseProps} placeholder="Select one..." />);
      const placeholder = screen.getByRole('option', { name: 'Select one...' });
      expect(placeholder).toBeInTheDocument();
      expect(placeholder).toBeDisabled();
    });

    it('does not render placeholder option when not provided', () => {
      render(<FormSelect {...baseProps} />);
      expect(screen.queryByRole('option', { name: /select/i })).not.toBeInTheDocument();
    });

    it('renders required asterisk when required=true', () => {
      render(<FormSelect {...baseProps} required />);
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('renders error message when error prop is provided', () => {
      render(<FormSelect {...baseProps} error="Please select a value" />);
      expect(screen.getByText('Please select a value')).toBeInTheDocument();
    });

    it('reflects the current value', () => {
      render(<FormSelect {...baseProps} value="2" />);
      expect(screen.getByRole('combobox')).toHaveValue('2');
    });
  });

  describe('Error styling', () => {
    it('applies red border when error is present', () => {
      render(<FormSelect {...baseProps} error="Required" />);
      expect(screen.getByRole('combobox')).toHaveClass('border-red-500');
    });

    it('does not apply red border when no error', () => {
      render(<FormSelect {...baseProps} />);
      expect(screen.getByRole('combobox')).not.toHaveClass('border-red-500');
    });
  });

  describe('Interaction', () => {
    it('calls onChange when selection changes', () => {
      const onChange = vi.fn();
      render(<FormSelect {...baseProps} onChange={onChange} />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });
});
