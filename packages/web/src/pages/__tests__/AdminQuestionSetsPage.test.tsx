import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AdminQuestionSetsPage } from '../admin/AdminQuestionSetsPage';
import { adminApi } from '../../api/admin';
import { questionSetsApi } from '../../api/question-sets';
import { type LookupRead, type QuestionSetItemRead, type QuestionSetRead } from '@naru/shared';

vi.mock('../../api/admin', () => ({
  adminApi: {
    fetchLookupTable: vi.fn(),
    createLookupEntry: vi.fn(),
    updateLookupEntry: vi.fn(),
    deleteLookupEntry: vi.fn(),
    reorderLookupEntries: vi.fn(),
    fetchChildVisitQuestions: vi.fn(),
    fetchParentVisitQuestions: vi.fn(),
    fetchFamilyVisitQuestions: vi.fn(),
  },
}));

vi.mock('../../api/question-sets', () => ({
  questionSetsApi: {
    list: vi.fn(),
    fetch: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockUseParams = vi.fn<() => { visitType: string | undefined }>(() => ({ visitType: 'child' }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => mockUseParams() };
});

const mockAdminUser = {
  id: 1,
  login: 'admin',
  email: 'admin@test.com',
  firstName: 'Admin',
  lastName: 'User',
  role: 'ADMIN' as const,
  lang: 'en',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  localId: null,
};

const mockUser = vi.fn(() => mockAdminUser as { role: 'ADMIN' | 'SUPERVISOR' | 'CASEWORKER' });

vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({ user: mockUser() }),
}));

const questionHow: LookupRead = {
  id: 10,
  title: 'How are you?',
  sortOrder: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockQuestions: LookupRead[] = [
  questionHow,
  { id: 11, title: 'Any concerns?', sortOrder: 1, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

const concernsItem: QuestionSetItemRead = {
  id: 1001,
  questionId: 11,
  questionTitle: 'Any concerns?',
  sortOrder: 1,
};

const firstVisitSet: QuestionSetRead = {
  id: 100,
  name: 'First Visit',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  items: [
    { id: 1000, questionId: 10, questionTitle: 'How are you?', sortOrder: 0 },
    concernsItem,
  ],
};

const mockSets: QuestionSetRead[] = [firstVisitSet];

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={['/admin/question-sets/child']}>
      <QueryClientProvider client={queryClient}>
        <AdminQuestionSetsPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

/** The questions lookup table row (the sets list uses <li>, not <tr>). */
const questionRow = (title: string) => {
  const cells = screen.getAllByText(title).map((el) => el.closest('tr')).filter(Boolean);
  return cells[0] as HTMLElement;
};

describe('AdminQuestionSetsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ visitType: 'child' });
    mockUser.mockReturnValue(mockAdminUser);
    vi.mocked(adminApi.fetchChildVisitQuestions).mockResolvedValue(mockQuestions);
    vi.mocked(questionSetsApi.list).mockResolvedValue(mockSets);
  });

  it('renders questions and sets', async () => {
    renderPage();

    expect(await screen.findByText('Child Visit Questions & Sets')).toBeInTheDocument();
    expect(await screen.findByText('Questions (2)')).toBeInTheDocument();
    expect(await screen.findByText('First Visit')).toBeInTheDocument();
    expect(screen.getByText('2 questions')).toBeInTheDocument();
  });

  it('hides the page from non-admin users', async () => {
    mockUser.mockReturnValue({ ...mockAdminUser, role: 'CASEWORKER' });

    const { container } = renderPage();

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('edits a question title', async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.updateLookupEntry).mockResolvedValue({ ...questionHow, title: 'Updated?' });

    renderPage();
    await screen.findByText('Questions (2)');

    await user.click(within(questionRow('How are you?')).getByRole('button', { name: 'Edit' }));
    const input = screen.getByDisplayValue('How are you?');
    await user.clear(input);
    await user.type(input, 'Updated?');
    await user.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => {
      expect(adminApi.updateLookupEntry).toHaveBeenCalledWith('child-visit-questions', 10, { title: 'Updated?' });
    });
  });

  describe('question delete', () => {
    it('opens the ConfirmDialog instead of window.confirm, showing the referencing set count', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm');

      renderPage();
      await screen.findByText('Questions (2)');
      await screen.findByText('First Visit');

      await user.click(within(questionRow('How are you?')).getByRole('button', { name: 'Delete' }));

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Delete Question')).toBeInTheDocument();
      expect(
        within(dialog).getByText(/1 question set references this question \(First Visit\)/i)
      ).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeEnabled();
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(adminApi.deleteLookupEntry).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('falls back to a generic warning when no set references the question', async () => {
      const user = userEvent.setup();
      vi.mocked(questionSetsApi.list).mockResolvedValue([]);

      renderPage();
      await screen.findByText('Questions (2)');

      await user.click(within(questionRow('How are you?')).getByRole('button', { name: 'Delete' }));

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/Answers already recorded on visits keep their text/i)).toBeInTheDocument();
    });

    it('deletes the question when confirmed', async () => {
      const user = userEvent.setup();
      vi.mocked(adminApi.deleteLookupEntry).mockResolvedValue(undefined);

      renderPage();
      await screen.findByText('Questions (2)');
      await user.click(within(questionRow('Any concerns?')).getByRole('button', { name: 'Delete' }));

      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

      await waitFor(() => {
        expect(adminApi.deleteLookupEntry).toHaveBeenCalledWith('child-visit-questions', 11);
      });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('does not delete the question when cancelled', async () => {
      const user = userEvent.setup();

      renderPage();
      await screen.findByText('Questions (2)');
      await user.click(within(questionRow('How are you?')).getByRole('button', { name: 'Delete' }));

      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(adminApi.deleteLookupEntry).not.toHaveBeenCalled();
    });
  });

  describe('set delete', () => {
    it('opens the ConfirmDialog and deletes on confirm', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm');
      vi.mocked(questionSetsApi.delete).mockResolvedValue(undefined);

      renderPage();
      const setCard = (await screen.findByText('First Visit')).closest('div.rounded-xl') as HTMLElement;
      await user.click(within(setCard).getByRole('button', { name: 'Delete' }));

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Delete Question Set')).toBeInTheDocument();
      expect(confirmSpy).not.toHaveBeenCalled();

      await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

      await waitFor(() => {
        expect(questionSetsApi.delete).toHaveBeenCalledWith('child', 100);
      });

      confirmSpy.mockRestore();
    });

    it('surfaces a failed set delete', async () => {
      const user = userEvent.setup();
      vi.mocked(questionSetsApi.delete).mockRejectedValue(new Error('Boom'));

      renderPage();
      const setCard = (await screen.findByText('First Visit')).closest('div.rounded-xl') as HTMLElement;
      await user.click(within(setCard).getByRole('button', { name: 'Delete' }));

      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

      expect(await screen.findByText(/Failed to delete set: Boom/)).toBeInTheDocument();
    });
  });

  describe('removing a single question from a set', () => {
    it('confirms then updates the set with the remaining ordered question ids', async () => {
      const user = userEvent.setup();
      vi.mocked(questionSetsApi.update).mockResolvedValue({ ...firstVisitSet, items: [concernsItem] });

      renderPage();
      await screen.findByText('First Visit');

      await user.click(screen.getByRole('button', { name: 'Remove "How are you?" from First Visit' }));

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Remove Question From Set')).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

      await waitFor(() => {
        expect(questionSetsApi.update).toHaveBeenCalledWith('child', 100, { questionIds: [11] });
      });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('does not update the set when cancelled', async () => {
      const user = userEvent.setup();

      renderPage();
      await screen.findByText('First Visit');

      await user.click(screen.getByRole('button', { name: 'Remove "Any concerns?" from First Visit' }));
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(questionSetsApi.update).not.toHaveBeenCalled();
    });
  });

  it('renders an error for an invalid visit type', () => {
    mockUseParams.mockReturnValue({ visitType: 'nope' });

    renderPage();

    expect(screen.getByText('Invalid visit type.')).toBeInTheDocument();
  });
});
