import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TrainingPicker, { TrainingOption } from '../TrainingPicker';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
  default: () => ({ t: (key: string) => key, lang: 'en' }),
}));

const OPTIONS: TrainingOption[] = [
  { id: 1, title: 'Nutrition basics' },
  { id: 2, title: 'Handwashing' },
  { id: 3, title: 'Breastfeeding' },
];

describe('TrainingPicker', () => {
  it('renders a responsive checkbox grid of trainings', () => {
    render(<TrainingPicker options={OPTIONS} selectedIds={[]} onChange={vi.fn()} />);

    const grid = screen.getByRole('group', { name: 'visit.trainings' });
    expect(grid).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByLabelText('Handwashing')).toBeInTheDocument();
  });

  it('checks the selected trainings', () => {
    render(<TrainingPicker options={OPTIONS} selectedIds={[1, 3]} onChange={vi.fn()} />);

    expect(screen.getByLabelText('Nutrition basics')).toBeChecked();
    expect(screen.getByLabelText('Handwashing')).not.toBeChecked();
    expect(screen.getByLabelText('Breastfeeding')).toBeChecked();
  });

  it('adds an id when an unchecked training is ticked', () => {
    const onChange = vi.fn();
    render(<TrainingPicker options={OPTIONS} selectedIds={[1]} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Handwashing'));
    expect(onChange).toHaveBeenCalledWith([1, 2]);
  });

  it('removes an id when a checked training is unticked', () => {
    const onChange = vi.fn();
    render(<TrainingPicker options={OPTIONS} selectedIds={[1, 2]} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Nutrition basics'));
    expect(onChange).toHaveBeenCalledWith([2]);
  });

  it('renders an empty message when there are no trainings', () => {
    render(<TrainingPicker options={[]} selectedIds={[]} onChange={vi.fn()} />);

    expect(screen.getByText('visit.no_trainings')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
