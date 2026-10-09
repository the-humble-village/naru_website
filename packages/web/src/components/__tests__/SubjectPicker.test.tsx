import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SubjectType } from '@naru/shared';
import SubjectPicker from '../SubjectPicker';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
  default: () => ({ t: (key: string) => key, lang: 'en' }),
}));

vi.mock('../../api/children', () => ({
  listChildren: vi.fn(),
  createChild: vi.fn(),
}));
vi.mock('../../api/mothers', () => ({ listMothers: vi.fn(), createMother: vi.fn() }));
vi.mock('../../api/people', () => ({ listPeople: vi.fn(), createPerson: vi.fn() }));
vi.mock('../../api/families', () => ({ listFamilies: vi.fn(), createFamily: vi.fn() }));
vi.mock('../../api/enrollments', () => ({ listEnrollments: vi.fn() }));

import { listChildren, createChild } from '../../api/children';
import { listMothers } from '../../api/mothers';
import { listEnrollments } from '../../api/enrollments';

const daysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

const child = (id: number, name: string) => ({
  id,
  localId: null,
  name,
  birthDate: daysAgo(120),
  sex: 'MALE' as const,
  communityId: 7,
  motherId: null,
  familyId: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const renderPicker = (props: Partial<React.ComponentProps<typeof SubjectPicker>> = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SubjectPicker
        subjectType={'CHILD' as SubjectType}
        programId={4}
        programName="Nutrition Infant"
        onSelect={vi.fn()}
        debounceMs={0}
        communityNames={{ 7: 'Xela' }}
        {...props}
      />
    </QueryClientProvider>
  );
};

const type = (value: string) => {
  fireEvent.change(screen.getByLabelText('subject_picker.search'), { target: { value } });
};

beforeEach(() => {
  vi.mocked(listChildren).mockReset();
  vi.mocked(createChild).mockReset();
  vi.mocked(listMothers).mockReset();
  vi.mocked(listEnrollments).mockReset();

  vi.mocked(listEnrollments).mockResolvedValue({ items: [], total: 0, skip: 0, limit: 1000 });
  vi.mocked(listChildren).mockResolvedValue({
    items: [child(1, 'José Ramírez')],
    total: 1,
    skip: 0,
    limit: 20,
  });
});

describe('SubjectPicker', () => {
  it('does not search until something is typed', async () => {
    renderPicker();
    await waitFor(() => expect(listEnrollments).toHaveBeenCalled());
    expect(listChildren).not.toHaveBeenCalled();
  });

  it('searches only the table named by subjectType', async () => {
    renderPicker();
    type('jos');

    await waitFor(() =>
      expect(listChildren).toHaveBeenCalledWith({ search: 'jos', limit: 20 })
    );
    expect(listMothers).not.toHaveBeenCalled();
  });

  it('debounces the search, issuing one request for a burst of keystrokes', async () => {
    renderPicker({ debounceMs: 60 });
    type('j');
    type('jo');
    type('jos');

    expect(listChildren).not.toHaveBeenCalled();

    await waitFor(() => expect(listChildren).toHaveBeenCalled());
    const searches = vi
      .mocked(listChildren)
      .mock.calls.map((call) => call[0]?.search)
      .filter((value, index, all) => all.indexOf(value) === index);
    expect(searches).toEqual(['jos']);
  });

  it('shows name, age and community for each result and reports the selection', async () => {
    const onSelect = vi.fn();
    renderPicker({ onSelect });
    type('jos');

    const option = await screen.findByRole('option', { name: /José Ramírez/ });
    expect(option).toHaveTextContent('3m');
    expect(option).toHaveTextContent('Xela');

    fireEvent.click(option);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, type: 'CHILD', name: 'José Ramírez' })
    );
  });

  it('disables a subject already actively enrolled in this program', async () => {
    vi.mocked(listEnrollments).mockResolvedValue({
      items: [{ childId: 1, motherId: null, personId: null, familyId: null }] as never,
      total: 1,
      skip: 0,
      limit: 1000,
    });
    const onSelect = vi.fn();
    renderPicker({ onSelect });
    type('jos');

    const option = await screen.findByRole('option', { name: /José Ramírez/ });
    await waitFor(() => expect(option).toBeDisabled());
    expect(option).toHaveTextContent('subject_picker.already_enrolled');
    expect(option).toHaveTextContent('Nutrition Infant');

    fireEvent.click(option);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('flags results with no active enrollment anywhere', async () => {
    vi.mocked(listChildren).mockImplementation(async (params) =>
      params?.unenrolled
        ? { items: [child(1, 'José Ramírez')], total: 1, skip: 0, limit: 20 }
        : { items: [child(1, 'José Ramírez')], total: 1, skip: 0, limit: 20 }
    );

    renderPicker();
    type('jos');

    const option = await screen.findByRole('option', { name: /José Ramírez/ });
    await waitFor(() => expect(option).toHaveTextContent('subject_picker.unenrolled'));
  });

  it('creates a child inline from name, birth date and sex, then selects it', async () => {
    const onSelect = vi.fn();
    vi.mocked(createChild).mockResolvedValue(child(99, 'Nuevo Niño'));

    renderPicker({ onSelect });
    fireEvent.click(screen.getByRole('button', { name: 'subject_picker.create_child' }));

    fireEvent.change(screen.getByLabelText(/subject_picker.name/), {
      target: { value: 'Nuevo Niño' },
    });
    fireEvent.change(screen.getByLabelText(/subject_picker.birth_date/), {
      target: { value: '2026-05-01' },
    });
    fireEvent.change(screen.getByLabelText(/subject_picker.sex/), {
      target: { value: 'MALE' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() =>
      expect(createChild).toHaveBeenCalledWith({
        name: 'Nuevo Niño',
        birthDate: '2026-05-01T00:00:00.000Z',
        sex: 'MALE',
      })
    );
    await waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 99, type: 'CHILD', name: 'Nuevo Niño' })
      )
    );
  });

  it('refuses to create a child without birth date and sex', async () => {
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'subject_picker.create_child' }));
    fireEvent.change(screen.getByLabelText(/subject_picker.name/), {
      target: { value: 'Sin datos' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    expect(await screen.findByText('subject_picker.child_fields_required')).toBeInTheDocument();
    expect(createChild).not.toHaveBeenCalled();
  });

  it('asks only for a name when creating a mother', () => {
    renderPicker({ subjectType: 'MOTHER' as SubjectType });

    fireEvent.click(screen.getByRole('button', { name: 'subject_picker.create_mother' }));
    expect(screen.getByLabelText(/subject_picker.name/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/subject_picker.birth_date/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/subject_picker.sex/)).not.toBeInTheDocument();
  });
});
