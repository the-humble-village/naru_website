import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EnrollmentListItem, ProgramKind, VisitListItem } from '@naru/shared';
import EnrollmentCard from '../EnrollmentCard';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
  default: () => ({ t: (key: string) => key, lang: 'en' }),
}));

vi.mock('../../api/visits', () => ({
  listVisits: vi.fn(),
}));

vi.mock('../../api/enrollments', () => ({
  reopenEnrollment: vi.fn(),
}));

const mockUser: { id: number; role: string } = { id: 1, role: 'SUPERVISOR' };
vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({ user: mockUser }),
}));

import { listVisits } from '../../api/visits';
import { reopenEnrollment } from '../../api/enrollments';

const PROGRAM = {
  id: 3,
  name: 'Expectant Mother',
  kind: 'PREGNANCY' as ProgramKind,
  subjectType: 'MOTHER' as const,
};

const enrollment = (overrides: Partial<EnrollmentListItem> = {}): EnrollmentListItem =>
  ({
    id: 11,
    localId: null,
    programId: 3,
    motherId: 5,
    childId: null,
    personId: null,
    familyId: null,
    enrolledAt: '2026-04-02',
    entryWeight: 58.2,
    entryPhotoId: null,
    admissionNotes: null,
    exitedAt: null,
    exitReason: null,
    exitWeight: null,
    exitPhotoId: null,
    exitNotes: null,
    createdAt: '2026-04-02T00:00:00.000Z',
    updatedAt: '2026-04-02T00:00:00.000Z',
    program: PROGRAM,
    subjectName: 'María López',
    visitCount: 6,
    lastVisitDate: '2026-09-04',
    pregnancyDetail: { dueDate: '2026-11-15', pregnancyNumber: 3, birthingAssistantId: 9 },
    ...overrides,
  }) as EnrollmentListItem;

const visit = (id: number, date: string, weight: number): VisitListItem =>
  ({
    id,
    localId: null,
    enrollmentId: 11,
    visitDate: date,
    locationType: 'SITE',
    siteId: 1,
    communityId: 2,
    recordedById: 1,
    eventId: null,
    notes: null,
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
    resources: [],
    trainingIds: [],
    answers: [],
    pregnancyDetail: { weight, gestationMonths: 7, examinationTypeId: null },
    program: PROGRAM,
    subjectName: 'María López',
    recordedByName: 'Ana',
  }) as VisitListItem;

const renderCard = (props: Partial<React.ComponentProps<typeof EnrollmentCard>> = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <EnrollmentCard enrollment={enrollment()} {...props} />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

beforeEach(() => {
  vi.mocked(listVisits).mockReset();
  vi.mocked(reopenEnrollment).mockReset();
  mockUser.role = 'SUPERVISOR';
});

describe('EnrollmentCard', () => {
  it('renders an active card expanded with the accent border and admission date', () => {
    const { container } = renderCard({ visits: [] });

    expect(container.querySelector('.border-hv-accent')).not.toBeNull();
    expect(screen.getByText('enrollment.active')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Expectant Mother' })).toBeInTheDocument();
    expect(screen.getByText(/2026-04-02/)).toBeInTheDocument();
  });

  it('shows the pregnancy summary and the weight delta from the latest visit', () => {
    renderCard({
      visits: [visit(1, '2026-09-04', 64.1)],
      birthingAssistantName: 'Carmen Say',
    });

    expect(screen.getByText('2026-11-15')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument();
    expect(screen.getByText('Carmen Say')).toBeInTheDocument();
    expect(screen.getByText('58.2')).toBeInTheDocument();
    expect(screen.getByText('64.1')).toBeInTheDocument();
  });

  it('shows only the three most recent visits plus a view-all link', () => {
    renderCard({
      visits: [
        visit(1, '2026-07-09', 61.2),
        visit(2, '2026-09-04', 64.1),
        visit(3, '2026-08-12', 62.8),
        visit(4, '2026-06-01', 60.0),
      ],
    });

    expect(screen.getByText('2026-09-04')).toBeInTheDocument();
    expect(screen.getByText('2026-08-12')).toBeInTheDocument();
    expect(screen.getByText('2026-07-09')).toBeInTheDocument();
    expect(screen.queryByText('2026-06-01')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /enrollment.view_all/ })).toHaveAttribute(
      'href',
      '/enrollments/11'
    );
  });

  it('puts + Visit and Exit on the card, pointing at the enrollment', () => {
    renderCard({ visits: [] });

    expect(screen.getByRole('link', { name: 'enrollment.add_visit' })).toHaveAttribute(
      'href',
      '/enrollments/11/visits/new'
    );
    expect(screen.getByRole('link', { name: 'enrollment.exit' })).toHaveAttribute(
      'href',
      '/enrollments/11/exit'
    );
  });

  it('fetches its own visits lazily when none are supplied', async () => {
    vi.mocked(listVisits).mockResolvedValue({
      items: [visit(1, '2026-09-04', 64.1)],
      total: 1,
      skip: 0,
      limit: 3,
    });

    renderCard();

    await waitFor(() =>
      expect(listVisits).toHaveBeenCalledWith({ enrollmentId: 11, limit: 3 })
    );
    expect(await screen.findByText('2026-09-04')).toBeInTheDocument();
  });

  it('collapses an exited enrollment to a one-liner with an exit reason badge', () => {
    renderCard({
      enrollment: enrollment({
        program: { ...PROGRAM, name: 'PAF', kind: 'FAMILY_PAF' },
        enrolledAt: '2024-03-04',
        exitedAt: '2025-06-10',
        exitReason: 'GRADUATED',
      }),
    });

    expect(screen.getByText('2024-03 → 2025-06')).toBeInTheDocument();
    expect(screen.getByText('exit_reason.graduated')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'enrollment.add_visit' })).not.toBeInTheDocument();
    expect(listVisits).not.toHaveBeenCalled();
  });

  it('expands an exited enrollment on click and fetches its visits then', async () => {
    vi.mocked(listVisits).mockResolvedValue({ items: [], total: 0, skip: 0, limit: 3 });

    renderCard({
      enrollment: enrollment({ exitedAt: '2025-06-10', exitReason: 'WITHDREW' }),
    });

    expect(listVisits).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { expanded: false }));

    await waitFor(() => expect(listVisits).toHaveBeenCalled());
    expect(screen.getByText('enrollment.reopen')).toBeInTheDocument();
  });

  it('offers Reopen to a supervisor and calls the API', async () => {
    vi.mocked(listVisits).mockResolvedValue({ items: [], total: 0, skip: 0, limit: 3 });
    vi.mocked(reopenEnrollment).mockResolvedValue({} as never);

    renderCard({
      enrollment: enrollment({ exitedAt: '2025-06-10', exitReason: 'DIED' }),
      visits: [],
      defaultExpanded: true,
    });

    fireEvent.click(screen.getByRole('button', { name: 'enrollment.reopen' }));
    await waitFor(() => expect(reopenEnrollment).toHaveBeenCalledWith(11));
  });

  it('hides Reopen from a caseworker', () => {
    mockUser.role = 'CASEWORKER';

    renderCard({
      enrollment: enrollment({ exitedAt: '2025-06-10', exitReason: 'DIED' }),
      visits: [],
      defaultExpanded: true,
    });

    expect(screen.queryByRole('button', { name: 'enrollment.reopen' })).not.toBeInTheDocument();
  });
});
