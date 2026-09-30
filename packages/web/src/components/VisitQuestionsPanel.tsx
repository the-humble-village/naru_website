import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QuestionSetItemRead, VisitAnswerEntry } from '@naru/shared';
import { questionSetsApi } from '../api/question-sets';
import { useTranslation } from '../hooks/useTranslation';
import { LoadingState } from './ui/LoadingState';
import { EmptyState } from './ui/EmptyState';

export interface VisitQuestionsPanelProps {
  programId: number;
  value: VisitAnswerEntry[];
  onChange: (answers: VisitAnswerEntry[]) => void;
  disabled?: boolean;
}

const FIELD =
  'w-full min-h-[44px] px-3 py-2 bg-white border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent';

const EMPTY_ANSWER = (questionId: number): VisitAnswerEntry => ({
  questionId,
  valueText: null,
  valueNum: null,
  valueBool: null,
});

const describeAnswer = (answer: VisitAnswerEntry, yes: string, no: string): string => {
  if (answer.valueText !== null && answer.valueText !== undefined) return answer.valueText;
  if (answer.valueNum !== null && answer.valueNum !== undefined) return String(answer.valueNum);
  if (answer.valueBool !== null && answer.valueBool !== undefined) {
    return answer.valueBool ? yes : no;
  }
  return '—';
};

export const VisitQuestionsPanel: React.FC<VisitQuestionsPanelProps> = ({
  programId,
  value,
  onChange,
  disabled = false,
}) => {
  const { t } = useTranslation();

  const { data: sets = [], isLoading } = useQuery({
    queryKey: ['question-sets', programId, 'includeShared'],
    queryFn: () => questionSetsApi.listQuestionSets({ programId, includeShared: true }),
  });

  // A question may sit in more than one set that applies to this program; an
  // answer is keyed by question, so the first occurrence wins and later ones are
  // dropped to keep the emitted VisitAnswerEntry[] unique by questionId.
  const sections = useMemo(() => {
    const seen = new Set<number>();
    return sets.map((set) => ({
      id: set.id,
      name: set.name,
      shared: set.programId === null,
      items: set.items.filter((item) => {
        if (seen.has(item.questionId)) return false;
        seen.add(item.questionId);
        return true;
      }),
    }));
  }, [sets]);

  const liveIds = useMemo(() => {
    const ids = new Set<number>();
    sections.forEach((section) => section.items.forEach((item) => ids.add(item.questionId)));
    return ids;
  }, [sections]);

  // A retired question keeps its historical answers. The backend filters it out
  // of the set items so no new form offers it, which would silently drop the
  // answer on save — so show it read-only and keep it in the array.
  const retired = useMemo(
    () => value.filter((answer) => !liveIds.has(answer.questionId)),
    [value, liveIds]
  );

  const answerFor = (questionId: number): VisitAnswerEntry | undefined =>
    value.find((answer) => answer.questionId === questionId);

  const write = (questionId: number, entry: VisitAnswerEntry | null): void => {
    if (entry === null) {
      onChange(value.filter((answer) => answer.questionId !== questionId));
      return;
    }
    onChange(
      value.some((answer) => answer.questionId === questionId)
        ? value.map((answer) => (answer.questionId === questionId ? entry : answer))
        : [...value, entry]
    );
  };

  const renderInput = (item: QuestionSetItemRead): React.ReactNode => {
    const id = `question-${item.questionId}`;
    const answer = answerFor(item.questionId);

    switch (item.answerType) {
      case 'NUMBER':
        return (
          <input
            id={id}
            type="number"
            inputMode="decimal"
            step="any"
            disabled={disabled}
            value={answer?.valueNum ?? ''}
            onChange={(event) => {
              const raw = event.target.value;
              const parsed = Number(raw);
              write(
                item.questionId,
                raw === '' || Number.isNaN(parsed)
                  ? null
                  : { ...EMPTY_ANSWER(item.questionId), valueNum: parsed }
              );
            }}
            className={FIELD}
          />
        );

      case 'BOOL':
        return (
          <div className="flex items-center gap-6" role="radiogroup" aria-labelledby={`${id}-label`}>
            {[true, false].map((option) => (
              <label
                key={String(option)}
                className="flex items-center gap-2 text-sm text-hv-charcoal cursor-pointer min-h-[44px]"
              >
                <input
                  type="radio"
                  name={id}
                  disabled={disabled}
                  checked={answer?.valueBool === option}
                  onChange={() =>
                    write(item.questionId, {
                      ...EMPTY_ANSWER(item.questionId),
                      valueBool: option,
                    })
                  }
                  className="h-5 w-5 border-hv-border-input text-hv-accent focus:ring-hv-accent"
                />
                <span>{option ? t('common.yes') : t('common.no')}</span>
              </label>
            ))}
          </div>
        );

      case 'CHOICE':
        return (
          <select
            id={id}
            disabled={disabled}
            value={answer?.valueText ?? ''}
            onChange={(event) => {
              const raw = event.target.value;
              write(
                item.questionId,
                raw === '' ? null : { ...EMPTY_ANSWER(item.questionId), valueText: raw }
              );
            }}
            className={FIELD}
          >
            <option value="">{t('visit.no_answer')}</option>
            {(item.choices ?? []).map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        );

      default:
        return (
          <input
            id={id}
            type="text"
            disabled={disabled}
            value={answer?.valueText ?? ''}
            onChange={(event) => {
              const raw = event.target.value;
              write(
                item.questionId,
                raw === '' ? null : { ...EMPTY_ANSWER(item.questionId), valueText: raw }
              );
            }}
            className={FIELD}
          />
        );
    }
  };

  if (isLoading) {
    return <LoadingState message={t('common.loading')} />;
  }

  const hasQuestions = sections.some((section) => section.items.length > 0);

  if (!hasQuestions && retired.length === 0) {
    return <EmptyState message={t('visit.no_questions')} />;
  }

  return (
    <div className="space-y-6">
      {sections
        .filter((section) => section.items.length > 0)
        .map((section) => (
          <div key={section.id} className="space-y-4">
            {sections.length > 1 && (
              <p className="text-sm font-medium text-hv-gray">
                {section.name}
                {section.shared && (
                  <span className="ml-2 px-2 py-0.5 bg-hv-sage text-white rounded-full text-xs">
                    {t('visit.shared_set')}
                  </span>
                )}
              </p>
            )}

            {section.items.map((item) => (
              <div key={item.questionId} className="grid grid-cols-1 md:grid-cols-2 md:gap-4">
                <label
                  id={`question-${item.questionId}-label`}
                  htmlFor={item.answerType === 'BOOL' ? undefined : `question-${item.questionId}`}
                  className="block text-sm font-medium text-hv-charcoal mb-1 md:self-center"
                >
                  {item.questionTitle}
                </label>
                {renderInput(item)}
              </div>
            ))}
          </div>
        ))}

      {retired.length > 0 && (
        <div className="space-y-2 border-t border-hv-border pt-4">
          <p className="text-sm font-medium text-hv-gray">{t('visit.retired_questions')}</p>
          {retired.map((answer) => (
            <div
              key={answer.questionId}
              className="grid grid-cols-1 md:grid-cols-2 md:gap-4 text-sm text-hv-gray"
            >
              <span>{t('visit.retired_question')} #{answer.questionId}</span>
              <span className="text-hv-charcoal">
                {describeAnswer(answer, t('common.yes'), t('common.no'))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VisitQuestionsPanel;
