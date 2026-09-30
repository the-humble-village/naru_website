import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FilterBar, { FilterOption, FilterValues } from '../FilterBar';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
  default: () => ({ t: (key: string) => key, lang: 'en' }),
}));

const SITES: FilterOption[] = [
  { id: 1, title: 'Quetzaltenango' },
  { id: 2, title: 'Nahualá' },
];
const PROGRAMS: FilterOption[] = [{ id: 7, title: 'Expectant Mother' }];
const COMMUNITIES: FilterOption[] = [{ id: 9, title: 'Xela' }];

const EMPTY: FilterValues = {};

describe('FilterBar', () => {
  it('renders only the requested fields', () => {
    render(
      <FilterBar
        fields={['dateRange', 'site']}
        value={EMPTY}
        onChange={vi.fn()}
        sites={SITES}
        programs={PROGRAMS}
        communities={COMMUNITIES}
      />
    );

    expect(screen.getByLabelText('filter.date_from')).toBeInTheDocument();
    expect(screen.getByLabelText('filter.date_to')).toBeInTheDocument();
    expect(screen.getByLabelText('filter.site')).toBeInTheDocument();
    expect(screen.queryByLabelText('filter.program')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('filter.community')).not.toBeInTheDocument();
  });

  it('renders the program and community selects when asked', () => {
    render(
      <FilterBar
        fields={['program', 'community']}
        value={EMPTY}
        onChange={vi.fn()}
        programs={PROGRAMS}
        communities={COMMUNITIES}
      />
    );

    expect(screen.getByRole('option', { name: 'Expectant Mother' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Xela' })).toBeInTheDocument();
  });

  it('reports date changes through one onChange', () => {
    const onChange = vi.fn();
    render(<FilterBar fields={['dateRange']} value={EMPTY} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('filter.date_from'), {
      target: { value: '2026-01-01' },
    });
    expect(onChange).toHaveBeenCalledWith({ dateFrom: '2026-01-01' });

    fireEvent.change(screen.getByLabelText('filter.date_to'), { target: { value: '2026-09-20' } });
    expect(onChange).toHaveBeenLastCalledWith({ dateTo: '2026-09-20' });
  });

  it('reports a selected site as a number and the All option as null', () => {
    const onChange = vi.fn();
    render(
      <FilterBar fields={['site']} value={{ siteId: 2 }} onChange={onChange} sites={SITES} />
    );

    fireEvent.change(screen.getByLabelText('filter.site'), { target: { value: '1' } });
    expect(onChange).toHaveBeenCalledWith({ siteId: 1 });

    fireEvent.change(screen.getByLabelText('filter.site'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({ siteId: null });
  });

  it('renders the Apply button only when an onApply handler is given', () => {
    const onApply = vi.fn();
    const { unmount } = render(
      <FilterBar fields={['site']} value={EMPTY} onChange={vi.fn()} sites={SITES} />
    );
    expect(screen.queryByRole('button', { name: 'filter.apply' })).not.toBeInTheDocument();
    unmount();

    render(
      <FilterBar
        fields={['site']}
        value={EMPTY}
        onChange={vi.fn()}
        sites={SITES}
        onApply={onApply}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'filter.apply' }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('renders an actions slot for things like Export CSV', () => {
    render(
      <FilterBar
        fields={['site']}
        value={EMPTY}
        onChange={vi.fn()}
        sites={SITES}
        actions={<button type="button">Export CSV</button>}
      />
    );

    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });
});
