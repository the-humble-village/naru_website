import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AdminQuestionSetsPage } from '../admin/AdminQuestionSetsPage';
import { questionSetsApi } from '../../api/question-sets';
import { questionsApi } from '../../api/questions';
import { programsApi } from '../../api/programs';
import { type ProgramRead, type QuestionRead, type QuestionSetRead } from '@naru/shared';

vi.mock('../../api/question-sets', () => ({
  questionSetsApi: {
    listQuestionSets: vi.fn(),
    fetchQuestionSet: vi.fn(),
    createQuestionSet: vi.fn(),
    updateQuestionSet: vi.fn(),
    deleteQuestionSet: vi.fn(),
  },
}));

vi.mock('../../api/questions', () => ({
  questionsApi: {
    listQuestions: vi.fn(),
    fetchQuestion: vi.fn(),
    createQuestion: vi.fn(),
    updateQuestion: vi.fn(),
    deleteQuestion: vi.fn(),
  },
}));

vi.mock('../../api/programs', () => ({
  programsApi: {
    listPrograms: vi.fn(),
    fetchProgram: vi.fn(),
    createProgram: vi.fn(),
    updateProgram: vi.fn(),
    deleteProgram: vi.fn(),
  },
}));

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

const program: ProgramRead = {
  id: 3,
  name: 'Nutrition Infant',
  kind: 'NUTRITION',
  subjectType: 'CHILD',
  description: null,
  minAgeMonths: null,
  maxAgeMonths: null,
  visitIntervalDays: 30,
  active: true,
  sortOrder: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const questions: QuestionRead[] = [
  {
    id: 10,
    title: 'Does the family have a kitchen garden?',
    answerType: 'BOOL',
    choices: null,
    sortOrder: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 11,
    title: 'Water source',
    answerType: 'CHOICE',
    choices: ['Well', 'River'],
    sortOrder: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const programSet: QuestionSetRead = {
  id: 100,
  name: 'Monthly nutrition',
  programId: 3,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  items: [
    { id: 1, questionId: 10, questionTitle: questions[0]!.title, answerType: 'BOOL', choices: null, sortOrder: 0 },
    { id: 2, questionId: 11, questionTitle: questions[1]!.title, answerType: 'CHOICE', choices: ['Well', 'River'], sortOrder: 1 },
  ],
};

const sharedSet: QuestionSetRead = {
  id: 101,
  name: 'Household basics',
  programId: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  items: [],
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={['/admin/question-sets']}>
      <QueryClientProvider client={queryClient}>
        <AdminQuestionSetsPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

const setsTable = () => screen.getAllByRole('table')[0] as HTMLElement;
const questionsTable = () => screen.getAllByRole('table')[1] as HTMLElement;

describe('AdminQuestionSetsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.mockReturnValue(mockAdminUser);
    vi.mocked(programsApi.listPrograms).mockResolvedValue({ items: [program], total: 1 });
    vi.mocked(questionSetsApi.listQuestionSets).mockResolvedValue([programSet, sharedSet]);
    vi.mocked(questionsApi.listQuestions).mockResolvedValue(questions);
  });

  it('lists sets with their program and labels a null program as shared', async () => {
    renderPage();

    await waitFor(() => expect(screen.getAllByRole('table').length).toBe(2));
    expect(within(setsTable()).getByText('Nutrition Infant')).toBeInTheDocument();
    const sharedRow = within(setsTable()).getByText('Household basics').closest('tr') as HTMLElement;
    expect(within(sharedRow).getByText('admin.qs_all_programs')).toBeInTheDocument();
  });

  it('asks the API for an exact program match, without shared sets', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getAllByRole('table').length).toBe(2));

    await user.selectOptions(screen.getByLabelText('admin.qs_filter_program'), '3');

    await waitFor(() => {
      expect(questionSetsApi.listQuestionSets).toHaveBeenCalledWith({ programId: 3 });
    });
    expect(questionSetsApi.listQuestionSets).not.toHaveBeenCalledWith(
      expect.objectContaining({ includeShared: true })
    );
  });

  it('hides the page from non-admin users', async () => {
    mockUser.mockReturnValue({ ...mockAdminUser, role: 'CASEWORKER' });

    const { container } = renderPage();

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('sends the whole ordered question list when membership changes', async () => {
    const user = userEvent.setup();
    vi.mocked(questionSetsApi.updateQuestionSet).mockResolvedValue(programSet);

    renderPage();
    await waitFor(() => expect(screen.getAllByRole('table').length).toBe(2));

    const row = within(setsTable()).getByText('Monthly nutrition').closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));

    await user.click(screen.getAllByRole('button', { name: 'admin.qs_move_up' })[1] as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Update Set' }));

    await waitFor(() => {
      expect(questionSetsApi.updateQuestionSet).toHaveBeenCalledWith(100, {
        name: 'Monthly nutrition',
        programId: 3,
        questionIds: [11, 10],
      });
    });
  });

  it('leaves membership alone when only the name changes', async () => {
    const user = userEvent.setup();
    vi.mocked(questionSetsApi.updateQuestionSet).mockResolvedValue(programSet);

    renderPage();
    await waitFor(() => expect(screen.getAllByRole('table').length).toBe(2));

    const row = within(setsTable()).getByText('Monthly nutrition').closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));

    const nameInput = screen.getByDisplayValue('Monthly nutrition');
    await user.clear(nameInput);
    await user.type(nameInput, 'Monthly');
    await user.click(screen.getByRole('button', { name: 'Update Set' }));

    await waitFor(() => {
      expect(questionSetsApi.updateQuestionSet).toHaveBeenCalledWith(100, {
        name: 'Monthly',
        programId: 3,
      });
    });
  });

  it('creates a shared set when no program is chosen', async () => {
    const user = userEvent.setup();
    vi.mocked(questionSetsApi.createQuestionSet).mockResolvedValue(sharedSet);

    renderPage();
    await waitFor(() => expect(screen.getAllByRole('table').length).toBe(2));

    await user.click(screen.getByRole('button', { name: '+ New Set' }));
    await user.type(screen.getByLabelText(/Name/), 'Everywhere');
    await user.click(screen.getByRole('button', { name: 'Create Set' }));

    await waitFor(() => {
      expect(questionSetsApi.createQuestionSet).toHaveBeenCalledWith({
        name: 'Everywhere',
        programId: null,
        questionIds: [],
      });
    });
  });

  it('only asks for choices on a CHOICE question', async () => {
    const user = userEvent.setup();
    vi.mocked(questionsApi.createQuestion).mockResolvedValue(questions[1]!);

    renderPage();
    await waitFor(() => expect(screen.getAllByRole('table').length).toBe(2));

    await user.click(screen.getByRole('button', { name: '+ Add Question' }));
    expect(screen.queryByLabelText('admin.question_choice 1')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/Title/), 'Water source');
    await user.selectOptions(screen.getByLabelText('admin.question_answer_type'), 'CHOICE');
    expect(screen.getByLabelText('admin.question_choice 1')).toBeInTheDocument();

    await user.type(screen.getByLabelText('admin.question_choice 1'), 'Well');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(questionsApi.createQuestion).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Water source',
          answerType: 'CHOICE',
          choices: ['Well'],
        })
      );
    });
  });

  it('frames deleting a question as retirement, not removal from its sets', async () => {
    const user = userEvent.setup();

    renderPage();
    await waitFor(() => expect(screen.getAllByRole('table').length).toBe(2));

    const row = within(questionsTable()).getByText('Water source').closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'admin.question_retire' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('admin.question_retire_title')).toBeInTheDocument();
    expect(within(dialog).getByText('admin.question_retire_warning')).toBeInTheDocument();
    expect(questionsApi.deleteQuestion).not.toHaveBeenCalled();
  });
});
