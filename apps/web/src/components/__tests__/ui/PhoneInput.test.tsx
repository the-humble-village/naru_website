import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PhoneInput } from '../../ui/PhoneInput';
import { FormField } from '../../ui/FormField';

const Controlled: React.FC = () => {
  const [value, setValue] = useState('');
  return (
    <label>
      Phone
      <PhoneInput value={value} onChange={(event) => setValue(event.target.value)} />
    </label>
  );
};

describe('PhoneInput', () => {
  it('is a tel input so a phone shows the dial pad', () => {
    render(<Controlled />);
    const input = screen.getByLabelText('Phone');
    expect(input).toHaveAttribute('type', 'tel');
    expect(input).toHaveAttribute('inputmode', 'tel');
  });

  it('formats the number as it is typed', () => {
    render(<Controlled />);
    const input = screen.getByLabelText('Phone');
    fireEvent.change(input, { target: { value: '55123344' } });
    expect(input).toHaveValue('5512-3344');
  });

  it('drops letters', () => {
    render(<Controlled />);
    const input = screen.getByLabelText('Phone');
    fireEvent.change(input, { target: { value: '55ab12' } });
    expect(input).toHaveValue('5512');
  });

  it('is what FormField renders for type="tel"', () => {
    const FieldHarness: React.FC = () => {
      const [value, setValue] = useState('');
      return (
        <FormField
          label="Phone"
          name="phone"
          type="tel"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      );
    };
    render(<FieldHarness />);
    const input = screen.getByLabelText('Phone');
    fireEvent.change(input, { target: { value: '+50255123344' } });
    expect(input).toHaveValue('+502 5512-3344');
  });
});
