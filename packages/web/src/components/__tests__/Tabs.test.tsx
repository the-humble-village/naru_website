import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Tabs from '../Tabs';

const TABS = [
  { key: 'active', label: 'Active', count: 42 },
  { key: 'exited', label: 'Exited', count: 3 },
  { key: 'all', label: 'All' },
];

describe('Tabs', () => {
  it('renders one tab per item inside a tablist', () => {
    render(<Tabs tabs={TABS} value="active" onChange={vi.fn()} label="Enrollment status" />);

    expect(screen.getByRole('tablist', { name: 'Enrollment status' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('marks only the selected tab as selected and focusable', () => {
    render(<Tabs tabs={TABS} value="exited" onChange={vi.fn()} />);

    const exited = screen.getByRole('tab', { name: /Exited/ });
    const active = screen.getByRole('tab', { name: /Active/ });

    expect(exited).toHaveAttribute('aria-selected', 'true');
    expect(exited).toHaveAttribute('tabindex', '0');
    expect(exited).toHaveClass('border-hv-green', 'text-hv-green');

    expect(active).toHaveAttribute('aria-selected', 'false');
    expect(active).toHaveAttribute('tabindex', '-1');
  });

  it('reports the clicked tab', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} value="active" onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: /Exited/ }));
    expect(onChange).toHaveBeenCalledWith('exited');
  });

  it('moves selection with the arrow keys', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} value="active" onChange={onChange} label="Status" />);

    const tablist = screen.getByRole('tablist', { name: 'Status' });

    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('exited');

    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('all');

    fireEvent.keyDown(tablist, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('all');

    fireEvent.keyDown(tablist, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('active');
  });

  it('ignores unrelated keys', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} value="active" onChange={onChange} label="Status" />);

    fireEvent.keyDown(screen.getByRole('tablist', { name: 'Status' }), { key: 'a' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders tabs as buttons so enter and space activate them', () => {
    render(<Tabs tabs={TABS} value="active" onChange={vi.fn()} />);

    screen.getAllByRole('tab').forEach((tab) => {
      expect(tab.tagName).toBe('BUTTON');
      expect(tab).toHaveAttribute('type', 'button');
    });
  });
});
