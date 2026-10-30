import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ResourceRow, { ResourceOption, ResourceRowValue } from '../ResourceRow';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
  default: () => ({ t: (key: string) => key, lang: 'en' }),
}));

const OPTIONS: ResourceOption[] = [
  { id: 1, title: 'Incaparina', defaultUnit: 'bag' },
  { id: 2, title: 'Milk', defaultUnit: 'litre' },
  { id: 3, title: 'Chickens', defaultUnit: null },
];

const EMPTY: ResourceRowValue = { resourceId: null, quantity: null, unit: null };

const renderRow = (
  value: ResourceRowValue = EMPTY,
  onChange = vi.fn(),
  onRemove = vi.fn()
) => {
  render(
    <ResourceRow options={OPTIONS} value={value} onChange={onChange} onRemove={onRemove} />
  );
  return { onChange, onRemove };
};

describe('ResourceRow', () => {
  it('renders a resource select, a quantity input and a unit select', () => {
    renderRow();

    expect(screen.getByLabelText('visit.resource')).toBeInTheDocument();
    expect(screen.getByLabelText('visit.quantity')).toBeInTheDocument();
    expect(screen.getByLabelText('visit.unit')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Incaparina' })).toBeInTheDocument();
  });

  it('keeps quantity numeric rather than free text', () => {
    const { onChange } = renderRow();

    const quantity = screen.getByLabelText('visit.quantity');
    expect(quantity).toHaveAttribute('type', 'number');

    fireEvent.change(quantity, { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith({ resourceId: null, quantity: 2, unit: null });
  });

  it('clears quantity back to null when emptied', () => {
    const { onChange } = renderRow({ resourceId: 1, quantity: 2, unit: 'bag' });

    fireEvent.change(screen.getByLabelText('visit.quantity'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ resourceId: 1, quantity: null, unit: 'bag' });
  });

  it('prefills the unit from the selected resource default', () => {
    const { onChange } = renderRow();

    fireEvent.change(screen.getByLabelText('visit.resource'), { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith({ resourceId: 2, quantity: null, unit: 'litre' });
  });

  it('keeps the existing unit when the resource has no default', () => {
    const { onChange } = renderRow({ resourceId: 1, quantity: 1, unit: 'bag' });

    fireEvent.change(screen.getByLabelText('visit.resource'), { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith({ resourceId: 3, quantity: 1, unit: 'bag' });
  });

  it('offers the distinct units from the options plus any extras', () => {
    render(
      <ResourceRow
        options={OPTIONS}
        value={EMPTY}
        onChange={vi.fn()}
        onRemove={vi.fn()}
        unitOptions={['kg']}
      />
    );

    const unitSelect = screen.getByLabelText('visit.unit');
    const labels = Array.from(unitSelect.querySelectorAll('option')).map((o) => o.textContent);
    expect(labels).toEqual(['visit.unit', 'bag', 'kg', 'litre']);
  });

  it('reports removal', () => {
    const { onRemove } = renderRow();

    fireEvent.click(screen.getByRole('button', { name: 'common.remove' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
