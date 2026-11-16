import React from 'react';
import { formatPhone } from '@naru/shared';

type PhoneInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

/**
 * PhoneInput - text input that formats a phone number as it is typed.
 *
 * Letters and stray punctuation are dropped and the separators inserted
 * (5512-3344, +502 5512-3344) by `formatPhone` from `@naru/shared`. The
 * formatted value is written back onto the event target before `onChange`
 * runs, so callers that read `event.target.value` need no changes.
 */
export const PhoneInput: React.FC<PhoneInputProps> = ({ onChange, ...props }) => (
  <input
    type="tel"
    inputMode="tel"
    autoComplete="tel"
    {...props}
    onChange={(event) => {
      event.target.value = formatPhone(event.target.value);
      onChange?.(event);
    }}
  />
);

export default PhoneInput;
