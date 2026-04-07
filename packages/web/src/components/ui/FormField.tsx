import React from 'react';

interface FormFieldProps {
  label: string;
  name: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}

/**
 * FormField - Reusable label + input (or textarea) + error message component.
 */
export const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  value,
  onChange,
  error,
  type = 'text',
  required,
  placeholder,
  rows,
  maxLength,
}) => {
  const baseInputClass = `w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta ${
    error ? 'border-red-500' : 'border-hv-border-input'
  }`;

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-hv-charcoal mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {rows !== undefined ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          rows={rows}
          placeholder={placeholder}
          maxLength={maxLength}
          className={baseInputClass}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          maxLength={maxLength}
          className={baseInputClass}
        />
      )}
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
};

export default FormField;
