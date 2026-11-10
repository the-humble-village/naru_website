import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { FormField } from '../../ui/FormField';

describe('FormField', () => {
  const baseProps = {
    label: 'Full Name',
    name: 'fullName',
    value: '',
    onChange: vi.fn(),
  };

  describe('Rendering', () => {
    it('renders label and input', () => {
      render(<FormField {...baseProps} />);
      expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders textarea when rows prop is provided', () => {
      render(<FormField {...baseProps} rows={4} />);
      expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
    });

    it('renders input when rows is not provided', () => {
      render(<FormField {...baseProps} />);
      expect(screen.getByRole('textbox').tagName).toBe('INPUT');
    });

    it('renders required asterisk when required=true', () => {
      render(<FormField {...baseProps} required />);
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('does not render required asterisk when required is not set', () => {
      render(<FormField {...baseProps} />);
      expect(screen.queryByText('*')).not.toBeInTheDocument();
    });

    it('renders placeholder text', () => {
      render(<FormField {...baseProps} placeholder="Enter your name" />);
      expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument();
    });

    it('renders with current value', () => {
      render(<FormField {...baseProps} value="John Doe" />);
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    });

    it('renders error message when error prop is provided', () => {
      render(<FormField {...baseProps} error="Name is required" />);
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });

    it('does not render error message when no error', () => {
      render(<FormField {...baseProps} />);
      expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
    });
  });

  describe('Input types', () => {
    it('defaults to type="text"', () => {
      render(<FormField {...baseProps} />);
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text');
    });

    it('renders number input when type="number"', () => {
      render(<FormField {...baseProps} type="number" value={0} />);
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('renders date input when type="date"', () => {
      const { container } = render(<FormField {...baseProps} type="date" />);
      expect(container.querySelector('input[type="date"]')).toBeInTheDocument();
    });
  });

  describe('Error styling', () => {
    it('applies red border class when error is present', () => {
      render(<FormField {...baseProps} error="Required" />);
      expect(screen.getByRole('textbox')).toHaveClass('border-red-500');
    });

    it('does not apply red border when no error', () => {
      render(<FormField {...baseProps} />);
      expect(screen.getByRole('textbox')).not.toHaveClass('border-red-500');
    });
  });

  describe('Interaction', () => {
    it('calls onChange when input value changes', () => {
      const onChange = vi.fn();
      render(<FormField {...baseProps} onChange={onChange} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });
});
