import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QuestionSetRead, VisitAnswerEntry } from '@naru/shared';
import VisitQuestionsPanel from '../VisitQuestionsPanel';
import { questionSetsApi } from '../../api/question-sets';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
  default: () => ({ t: (key: string) => key, lang: 'en' }),
}));

vi.mock('../../api/question-sets', () => ({
  questionSetsApi: { listQuestionSets: vi.fn() },
}));

const STAMP = '2026-01-01T00:00:00.000Z';

const SET: QuestionSetRead = {
  id: 1,
  name: 'Nutrition questions',
  programId: 3,
  createdAt: STAMP,
  updatedAt: STAMP,
  items: [
    {
      id: 11,
      questionId: 101,
      questionTitle: 'Notes from caretaker',
      answerType: 'TEXT',
      choices: null,
      sortOrder: 0,
    },
    {
      id: 12,
      questionId: 102,
      questionTitle: 'How many meals per day?',
      answerType: 'NUMBER',
      choices: null,
      sortOrder: 1,
    },
    {
      id: 13,
      questionId: 103,
      questionTitle: 'Does the family have chickens?',
      answerType: 'BOOL',
      choices: null,
      sortOrder: 2,
    },
    {
      id: 14,
      questionId: 104,
      questionTitle: 'Water source',
      answerType: 'CHOICE',
      choices: ['Well', 'River', 'Tap'],
      sortOrder: 3,
    },
  ],
};

const renderPanel = (value: VisitAnswerEntry[] = [], onChange = vi.fn()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <VisitQuestionsPanel programId={3} value={value} onChange={onChange} />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { onChange };
};

describe('VisitQuestionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(questionSetsApi.listQuestionSets).mockResolvedValue([SET]);
  });

  it('loads the question sets for the program, including shared sets', async () => {
    renderPanel();

    await waitFor(() =>
      expect(questionSetsApi.listQuestionSets).toHaveBeenCalledWith({
        programId: 3,
        includeShared: true,
      })
    );
  });

  it('renders a control per answerType', async () => {
    renderPanel();

    expect(await screen.findByLabelText('Notes from caretaker')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('How many meals per day?')).toHaveAttribute('type', 'number');
    expect(screen.getByLabelText('How many meals per day?')).toHaveAttribute(
      'inputMode',
      'decimal'
    );
    expect(screen.getByLabelText('common.yes')).toHaveAttribute('type', 'radio');
    expect(screen.getByLabelText('common.no')).toHaveAttribute('type', 'radio');
    expect(screen.getByRole('option', { name: 'River' })).toBeInTheDocument();
  });

  it('serialises a TEXT answer into valueText only', async () => {
    const { onChange } = renderPanel();

    fireEvent.change(await screen.findByLabelText('Notes from caretaker'), {
      target: { value: 'Ate well' },
    });

    expect(onChange).toHaveBeenCalledWith([
      { questionId: 101, valueText: 'Ate well', valueNum: null, valueBool: null },
    ]);
  });

  it('serialises a NUMBER answer into valueNum only', async () => {
    const { onChange } = renderPanel();

    fireEvent.change(await screen.findByLabelText('How many meals per day?'), {
      target: { value: '2' },
    });

    expect(onChange).toHaveBeenCalledWith([
      { questionId: 102, valueText: null, valueNum: 2, valueBool: null },
    ]);
  });

  it('serialises a BOOL answer into valueBool only', async () => {
    const { onChange } = renderPanel();

    fireEvent.click(await screen.findByLabelText('common.no'));

    expect(onChange).toHaveBeenCalledWith([
      { questionId: 103, valueText: null, valueNum: null, valueBool: false },
    ]);
  });

  it('serialises a CHOICE answer into valueText only', async () => {
    const { onChange } = renderPanel();

    await screen.findByLabelText('Water source');
    fireEvent.change(screen.getByLabelText('Water source'), { target: { value: 'Well' } });

    expect(onChange).toHaveBeenCalledWith([
      { questionId: 104, valueText: 'Well', valueNum: null, valueBool: null },
    ]);
  });

  it('drops the entry when an answer is cleared', async () => {
    const { onChange } = renderPanel([
      { questionId: 101, valueText: 'Ate well', valueNum: null, valueBool: null },
    ]);

    fireEvent.change(await screen.findByLabelText('Notes from caretaker'), {
      target: { value: '' },
    });

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('reflects existing answers', async () => {
    renderPanel([
      { questionId: 101, valueText: 'Ate well', valueNum: null, valueBool: null },
      { questionId: 103, valueText: null, valueNum: null, valueBool: true },
    ]);

    expect(await screen.findByLabelText('Notes from caretaker')).toHaveValue('Ate well');
    expect(screen.getByLabelText('common.yes')).toBeChecked();
    expect(screen.getByLabelText('common.no')).not.toBeChecked();
  });

  it('shows an answer to a retired question read-only instead of dropping it', async () => {
    const { onChange } = renderPanel([
      { questionId: 999, valueText: 'Yes, two goats', valueNum: null, valueBool: null },
    ]);

    expect(await screen.findByText('visit.retired_questions')).toBeInTheDocument();
    expect(screen.getByText('Yes, two goats')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Notes from caretaker'), {
      target: { value: 'New note' },
    });

    expect(onChange).toHaveBeenCalledWith([
      { questionId: 999, valueText: 'Yes, two goats', valueNum: null, valueBool: null },
      { questionId: 101, valueText: 'New note', valueNum: null, valueBool: null },
    ]);
  });

  it('shows an empty state when the program has no question set', async () => {
    vi.mocked(questionSetsApi.listQuestionSets).mockResolvedValue([]);
    renderPanel();

    expect(await screen.findByText('visit.no_questions')).toBeInTheDocument();
  });

  it('renders a question only once when it appears in two applicable sets', async () => {
    vi.mocked(questionSetsApi.listQuestionSets).mockResolvedValue([
      SET,
      { ...SET, id: 2, name: 'Shared questions', programId: null },
    ]);
    renderPanel();

    expect(await screen.findAllByLabelText('Notes from caretaker')).toHaveLength(1);
  });
});
