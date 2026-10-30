import React, { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import {
  type AnswerType,
  type QuestionRead,
  type QuestionCreate,
  type QuestionUpdate,
  type QuestionSetRead,
  type QuestionSetCreate,
  type QuestionSetUpdate,
  type TranslationKey,
} from '@naru/shared';
import { questionSetsApi } from '../../api/question-sets';
import { questionsApi } from '../../api/questions';
import { programsApi } from '../../api/programs';
import { RoleGate, ConfirmDialog, PageHeader } from '../../components';
import { useTranslation } from '../../hooks';

const ANSWER_TYPES: AnswerType[] = ['TEXT', 'NUMBER', 'BOOL', 'CHOICE'];

const ANSWER_TYPE_LABEL: Record<AnswerType, TranslationKey> = {
  TEXT: 'answer_type.TEXT',
  NUMBER: 'answer_type.NUMBER',
  BOOL: 'answer_type.BOOL',
  CHOICE: 'answer_type.CHOICE',
};

const SHARED = 'shared';
const ALL = 'all';

const getErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

const inputClass =
  'w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent';
const labelClass = 'block text-sm font-medium text-hv-charcoal mb-1';
const hintClass = 'text-xs text-hv-sage mt-1';
const headerCellClass =
  'px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider';

interface SetFormState {
  name: string;
  programId: string;
  questionIds: number[];
}

const emptySetForm: SetFormState = { name: '', programId: SHARED, questionIds: [] };

interface QuestionFormState {
  title: string;
  answerType: AnswerType;
  choices: string[];
}

const emptyQuestionForm: QuestionFormState = { title: '', answerType: 'TEXT', choices: [''] };

export const AdminQuestionSetsPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [programFilter, setProgramFilter] = useState<string>(ALL);

  const [showSetForm, setShowSetForm] = useState(false);
  const [editingSet, setEditingSet] = useState<QuestionSetRead | null>(null);
  const [setForm, setSetForm] = useState<SetFormState>(emptySetForm);
  const [membershipTouched, setMembershipTouched] = useState(false);
  const [setError, setSetError] = useState<string | null>(null);
  const [deleteSetTarget, setDeleteSetTarget] = useState<QuestionSetRead | null>(null);
  const [deleteSetError, setDeleteSetError] = useState<string | null>(null);

  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionRead | null>(null);
  const [questionForm, setQuestionForm] = useState<QuestionFormState>(emptyQuestionForm);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [retireTarget, setRetireTarget] = useState<QuestionRead | null>(null);
  const [retireError, setRetireError] = useState<string | null>(null);

  const { data: programsData } = useQuery({
    queryKey: ['programs', { activeOnly: false }],
    queryFn: () => programsApi.listPrograms({}),
  });
  const programs = programsData?.items ?? [];

  // The admin screen wants an exact match: a set attached to another program has
  // no business showing here. Shared sets (programId null) are only reachable
  // through the filter's own option, since the API cannot ask for them alone.
  const { data: sets = [], isLoading: loadingSets } = useQuery({
    queryKey: ['question-sets', { programId: programFilter }],
    queryFn: () =>
      programFilter === ALL || programFilter === SHARED
        ? questionSetsApi.listQuestionSets({})
        : questionSetsApi.listQuestionSets({ programId: Number(programFilter) }),
  });

  const visibleSets =
    programFilter === SHARED ? sets.filter((set) => set.programId === null) : sets;

  const { data: questions = [], isLoading: loadingQuestions } = useQuery({
    queryKey: ['questions'],
    queryFn: questionsApi.listQuestions,
  });

  const invalidateSets = () => queryClient.invalidateQueries({ queryKey: ['question-sets'] });
  const invalidateQuestions = () => {
    queryClient.invalidateQueries({ queryKey: ['questions'] });
    invalidateSets();
  };

  const createSetMutation = useMutation({
    mutationFn: (payload: QuestionSetCreate) => questionSetsApi.createQuestionSet(payload),
    onSuccess: invalidateSets,
  });
  const updateSetMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: QuestionSetUpdate }) =>
      questionSetsApi.updateQuestionSet(id, payload),
    onSuccess: invalidateSets,
  });
  const deleteSetMutation = useMutation({
    mutationFn: (id: number) => questionSetsApi.deleteQuestionSet(id),
    onSuccess: invalidateSets,
  });

  const createQuestionMutation = useMutation({
    mutationFn: (payload: QuestionCreate) => questionsApi.createQuestion(payload),
    onSuccess: invalidateQuestions,
  });
  const updateQuestionMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: QuestionUpdate }) =>
      questionsApi.updateQuestion(id, payload),
    onSuccess: invalidateQuestions,
  });
  const deleteQuestionMutation = useMutation({
    mutationFn: (id: number) => questionsApi.deleteQuestion(id),
    onSuccess: invalidateQuestions,
  });

  const programName = (programId: number | null): string => {
    if (programId === null) return t('admin.qs_all_programs');
    return programs.find((p) => p.id === programId)?.name ?? `#${programId}`;
  };

  const questionTitle = (id: number): string =>
    questions.find((q) => q.id === id)?.title
    ?? editingSet?.items.find((item) => item.questionId === id)?.questionTitle
    ?? `#${id}`;

  const questionAnswerType = (id: number): AnswerType | null =>
    questions.find((q) => q.id === id)?.answerType
    ?? editingSet?.items.find((item) => item.questionId === id)?.answerType
    ?? null;

  /* ---------------- question set form ---------------- */

  const resetSetForm = () => {
    setSetForm(emptySetForm);
    setEditingSet(null);
    setShowSetForm(false);
    setMembershipTouched(false);
    setSetError(null);
  };

  const startCreateSet = () => {
    setSetForm({
      ...emptySetForm,
      programId: programFilter === ALL || programFilter === SHARED ? SHARED : programFilter,
    });
    setEditingSet(null);
    setMembershipTouched(false);
    setSetError(null);
    setShowSetForm(true);
  };

  const startEditSet = (set: QuestionSetRead) => {
    setSetForm({
      name: set.name,
      programId: set.programId === null ? SHARED : set.programId.toString(),
      questionIds: set.items.map((item) => item.questionId),
    });
    setEditingSet(set);
    setMembershipTouched(false);
    setSetError(null);
    setShowSetForm(true);
  };

  const addQuestionToSet = (id: number) => {
    if (setForm.questionIds.includes(id)) return;
    setSetForm({ ...setForm, questionIds: [...setForm.questionIds, id] });
    setMembershipTouched(true);
  };

  const removeQuestionFromSet = (id: number) => {
    setSetForm({ ...setForm, questionIds: setForm.questionIds.filter((qid) => qid !== id) });
    setMembershipTouched(true);
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const next = [...setForm.questionIds];
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= next.length) return;
    const current = next[index];
    const other = next[swapWith];
    if (current === undefined || other === undefined) return;
    next[index] = other;
    next[swapWith] = current;
    setSetForm({ ...setForm, questionIds: next });
    setMembershipTouched(true);
  };

  const submitSet = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetError(null);

    const name = setForm.name.trim();
    if (!name) {
      setSetError(t('admin.qs_name_required'));
      return;
    }

    const programId = setForm.programId === SHARED ? null : Number(setForm.programId);

    try {
      if (editingSet) {
        // Membership is replaced wholesale, and the API hides retired questions
        // from `items` - so an untouched list is left alone rather than resent.
        const payload: QuestionSetUpdate = { name, programId };
        if (membershipTouched) payload.questionIds = setForm.questionIds;
        await updateSetMutation.mutateAsync({ id: editingSet.id, payload });
      } else {
        await createSetMutation.mutateAsync({ name, programId, questionIds: setForm.questionIds });
      }
      resetSetForm();
    } catch (err) {
      setSetError(getErrorMessage(err, t('admin.qs_save_failed')));
    }
  };

  const confirmDeleteSet = async () => {
    if (!deleteSetTarget) return;
    setDeleteSetError(null);
    try {
      await deleteSetMutation.mutateAsync(deleteSetTarget.id);
      setDeleteSetTarget(null);
    } catch (err) {
      setDeleteSetError(getErrorMessage(err, t('admin.qs_delete_failed')));
    }
  };

  /* ---------------- question library form ---------------- */

  const resetQuestionForm = () => {
    setQuestionForm(emptyQuestionForm);
    setEditingQuestion(null);
    setShowQuestionForm(false);
    setQuestionError(null);
  };

  const startCreateQuestion = () => {
    setQuestionForm(emptyQuestionForm);
    setEditingQuestion(null);
    setQuestionError(null);
    setShowQuestionForm(true);
  };

  const startEditQuestion = (question: QuestionRead) => {
    setQuestionForm({
      title: question.title,
      answerType: question.answerType,
      choices: question.choices && question.choices.length > 0 ? question.choices : [''],
    });
    setEditingQuestion(question);
    setQuestionError(null);
    setShowQuestionForm(true);
  };

  const setChoice = (index: number, value: string) => {
    const next = [...questionForm.choices];
    next[index] = value;
    setQuestionForm({ ...questionForm, choices: next });
  };

  const addChoice = () =>
    setQuestionForm({ ...questionForm, choices: [...questionForm.choices, ''] });

  const removeChoice = (index: number) => {
    const next = questionForm.choices.filter((_, i) => i !== index);
    setQuestionForm({ ...questionForm, choices: next.length > 0 ? next : [''] });
  };

  const submitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuestionError(null);

    const title = questionForm.title.trim();
    if (!title) {
      setQuestionError(t('admin.question_title_required'));
      return;
    }

    const isChoice = questionForm.answerType === 'CHOICE';
    const choices = questionForm.choices.map((c) => c.trim()).filter((c) => c !== '');

    if (isChoice && choices.length === 0) {
      setQuestionError(t('admin.question_choices_required'));
      return;
    }

    try {
      if (editingQuestion) {
        await updateQuestionMutation.mutateAsync({
          id: editingQuestion.id,
          payload: { title, answerType: questionForm.answerType, choices: isChoice ? choices : null },
        });
      } else {
        await createQuestionMutation.mutateAsync({
          title,
          answerType: questionForm.answerType,
          choices: isChoice ? choices : null,
          sortOrder: questions.length,
        });
      }
      resetQuestionForm();
    } catch (err) {
      setQuestionError(getErrorMessage(err, t('admin.question_save_failed')));
    }
  };

  const confirmRetire = async () => {
    if (!retireTarget) return;
    setRetireError(null);
    try {
      await deleteQuestionMutation.mutateAsync(retireTarget.id);
      setRetireTarget(null);
    } catch (err) {
      setRetireError(getErrorMessage(err, t('admin.question_retire_failed')));
    }
  };

  const availableQuestions = questions.filter((q) => !setForm.questionIds.includes(q.id));
  const savingSet = createSetMutation.isPending || updateSetMutation.isPending;
  const savingQuestion = createQuestionMutation.isPending || updateQuestionMutation.isPending;

  return (
    <RoleGate requiredRole="ADMIN">
      <div className="space-y-8">
        <PageHeader
          title={t('admin.question_sets')}
          backTo="/admin"
          backLabel={t('common.back_to_admin')}
          actions={
            !showSetForm && (
              <button
                onClick={startCreateSet}
                className="bg-hv-terracotta text-white px-4 py-2 rounded-md hover:bg-hv-terracotta-hover transition-colors"
              >
                + {t('admin.new_set')}
              </button>
            )
          }
        />

        <p className="text-sm text-hv-gray -mt-4">{t('admin.qs_program_scope_hint')}</p>

        <div className="max-w-xs">
          <label htmlFor="qs-program-filter" className={labelClass}>
            {t('admin.qs_filter_program')}
          </label>
          <select
            id="qs-program-filter"
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            className={`${inputClass} bg-white`}
          >
            <option value={ALL}>{t('admin.qs_filter_all')}</option>
            <option value={SHARED}>{t('admin.qs_all_programs')}</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
        </div>

        {showSetForm && (
          <div className="bg-white p-6 rounded-xl border border-hv-border">
            <h2 className="text-lg font-serif font-semibold text-hv-charcoal mb-4">
              {editingSet ? t('admin.qs_edit_set') : t('admin.qs_new_set')}
            </h2>

            <form onSubmit={submitSet} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="qs-name" className={labelClass}>
                    {t('common.col_name')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="qs-name"
                    type="text"
                    value={setForm.name}
                    onChange={(e) => setSetForm({ ...setForm, name: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="qs-program" className={labelClass}>
                    {t('admin.qs_program')}
                  </label>
                  <select
                    id="qs-program"
                    value={setForm.programId}
                    onChange={(e) => setSetForm({ ...setForm, programId: e.target.value })}
                    className={`${inputClass} bg-white`}
                  >
                    <option value={SHARED}>{t('admin.qs_all_programs')}</option>
                    {programs.map((program) => (
                      <option key={program.id} value={program.id}>
                        {program.name}
                      </option>
                    ))}
                  </select>
                  <p className={hintClass}>{t('admin.qs_shared_hint')}</p>
                </div>
              </div>

              <div>
                <span className={labelClass}>{t('admin.qs_questions_in_set')}</span>
                <p className={hintClass}>{t('admin.qs_order_hint')}</p>

                {setForm.questionIds.length === 0 ? (
                  <p className="text-sm text-hv-gray border border-dashed border-hv-border rounded-md p-4 mt-2 text-center">
                    {t('admin.qs_no_questions_in_set')}
                  </p>
                ) : (
                  <ol className="mt-2 space-y-2">
                    {setForm.questionIds.map((id, index) => {
                      const answerType = questionAnswerType(id);
                      return (
                        <li
                          key={id}
                          className="flex items-center gap-3 border border-hv-border rounded-md p-3 bg-hv-page"
                        >
                          <span className="text-sm text-hv-sage w-6 shrink-0">{index + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-hv-charcoal truncate">{questionTitle(id)}</p>
                            {answerType && (
                              <span className="text-xs text-hv-sage">
                                {t(ANSWER_TYPE_LABEL[answerType])}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveQuestion(index, 'up')}
                              disabled={index === 0}
                              aria-label={t('admin.qs_move_up')}
                              className="p-1 text-hv-sage hover:text-hv-charcoal disabled:opacity-25 transition-colors"
                            >
                              <ChevronUp size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveQuestion(index, 'down')}
                              disabled={index === setForm.questionIds.length - 1}
                              aria-label={t('admin.qs_move_down')}
                              className="p-1 text-hv-sage hover:text-hv-charcoal disabled:opacity-25 transition-colors"
                            >
                              <ChevronDown size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeQuestionFromSet(id)}
                              aria-label={`${t('admin.qs_remove_question')}: ${questionTitle(id)}`}
                              className="p-1 text-hv-crisis hover:text-red-800 transition-colors"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}

                <div className="mt-3 max-w-md">
                  <label htmlFor="qs-add-question" className={labelClass}>
                    {t('admin.qs_add_question')}
                  </label>
                  <select
                    id="qs-add-question"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) addQuestionToSet(Number(e.target.value));
                    }}
                    className={`${inputClass} bg-white`}
                  >
                    <option value="">{t('admin.qs_choose_question')}</option>
                    {availableQuestions.map((question) => (
                      <option key={question.id} value={question.id}>
                        {question.title}
                      </option>
                    ))}
                  </select>
                </div>

                {editingSet && (
                  <p className={hintClass}>{t('admin.qs_retired_members_hint')}</p>
                )}
              </div>

              {setError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-hv-crisis text-sm">{setError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={savingSet}
                  className="px-4 py-2 bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover disabled:opacity-50 transition-colors"
                >
                  {savingSet
                    ? t('common.saving')
                    : editingSet
                      ? t('common.update_set')
                      : t('common.create_set')}
                </button>
                <button
                  type="button"
                  onClick={resetSetForm}
                  className="px-4 py-2 text-hv-gray border border-hv-border rounded-md hover:bg-hv-page transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

        {loadingSets ? (
          <p className="text-hv-gray">{t('common.loading')}</p>
        ) : visibleSets.length === 0 ? (
          <p className="text-hv-gray text-center py-8">{t('admin.no_sets')}</p>
        ) : (
          <>
            <div className="hidden md:block bg-white rounded-xl border border-hv-border overflow-x-auto">
              <table className="w-full">
                <thead className="bg-hv-page">
                  <tr>
                    <th className={headerCellClass}>{t('common.col_name')}</th>
                    <th className={headerCellClass}>{t('admin.qs_program')}</th>
                    <th className={headerCellClass}>{t('admin.questions')}</th>
                    <th className={`${headerCellClass} text-right`}>{t('common.col_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hv-border">
                  {visibleSets.map((set) => (
                    <tr key={set.id} className="hover:bg-hv-page">
                      <td className="px-6 py-4 font-medium text-hv-charcoal">{set.name}</td>
                      <td className="px-6 py-4 text-sm">
                        {set.programId === null ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-hv-accent text-white">
                            {t('admin.qs_all_programs')}
                          </span>
                        ) : (
                          <span className="text-hv-gray">{programName(set.programId)}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-hv-gray">{set.items.length}</td>
                      <td className="px-6 py-4 text-right text-sm space-x-3 whitespace-nowrap">
                        <button
                          onClick={() => startEditSet(set)}
                          className="text-hv-terracotta hover:underline transition-colors"
                        >
                          {t('admin.edit_entity_title')}
                        </button>
                        <button
                          onClick={() => {
                            setDeleteSetError(null);
                            setDeleteSetTarget(set);
                          }}
                          disabled={deleteSetMutation.isPending}
                          className="text-hv-crisis hover:underline disabled:opacity-50 transition-colors"
                        >
                          {t('common.delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {visibleSets.map((set) => (
                <div key={set.id} className="bg-white p-4 rounded-xl border border-hv-border">
                  <p className="font-medium text-hv-charcoal">{set.name}</p>
                  <p className="text-sm text-hv-sage mt-1">
                    {set.programId === null ? t('admin.qs_all_programs') : programName(set.programId)}
                    {' · '}
                    {set.items.length} {t('admin.questions')}
                  </p>
                  <div className="mt-3 flex gap-4 text-sm">
                    <button
                      onClick={() => startEditSet(set)}
                      className="text-hv-terracotta hover:underline transition-colors"
                    >
                      {t('admin.edit_entity_title')}
                    </button>
                    <button
                      onClick={() => {
                        setDeleteSetError(null);
                        setDeleteSetTarget(set);
                      }}
                      disabled={deleteSetMutation.isPending}
                      className="text-hv-crisis hover:underline disabled:opacity-50 transition-colors"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <h2 className="text-lg font-serif font-semibold text-hv-charcoal">
              {t('admin.questions')}
            </h2>
            {!showQuestionForm && (
              <button
                onClick={startCreateQuestion}
                className="bg-hv-green text-white px-4 py-2 rounded-md hover:bg-hv-green-hover transition-colors"
              >
                + {t('admin.add_question')}
              </button>
            )}
          </div>

          {showQuestionForm && (
            <div className="bg-white p-6 rounded-xl border border-hv-border">
              <form onSubmit={submitQuestion} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="question-title" className={labelClass}>
                      {t('common.col_title')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="question-title"
                      type="text"
                      value={questionForm.title}
                      onChange={(e) => setQuestionForm({ ...questionForm, title: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="question-answer-type" className={labelClass}>
                      {t('admin.question_answer_type')}
                    </label>
                    <select
                      id="question-answer-type"
                      value={questionForm.answerType}
                      onChange={(e) =>
                        setQuestionForm({
                          ...questionForm,
                          answerType: e.target.value as AnswerType,
                        })
                      }
                      className={`${inputClass} bg-white`}
                    >
                      {ANSWER_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {t(ANSWER_TYPE_LABEL[type])}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {questionForm.answerType === 'CHOICE' && (
                  <div>
                    <span className={labelClass}>{t('admin.question_choices')}</span>
                    <p className={hintClass}>{t('admin.question_choices_hint')}</p>
                    <div className="space-y-2 mt-2">
                      {questionForm.choices.map((choice, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={choice}
                            onChange={(e) => setChoice(index, e.target.value)}
                            aria-label={`${t('admin.question_choice')} ${index + 1}`}
                            className={inputClass}
                          />
                          <button
                            type="button"
                            onClick={() => removeChoice(index)}
                            aria-label={`${t('admin.question_remove_choice')} ${index + 1}`}
                            className="p-2 text-hv-crisis hover:text-red-800 transition-colors"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addChoice}
                      className="mt-2 text-sm text-hv-accent hover:underline transition-colors"
                    >
                      + {t('admin.question_add_choice')}
                    </button>
                  </div>
                )}

                {questionError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-hv-crisis text-sm">{questionError}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={savingQuestion}
                    className="px-4 py-2 bg-hv-green text-white rounded-md hover:bg-hv-green-hover disabled:opacity-50 transition-colors"
                  >
                    {savingQuestion
                      ? t('common.saving')
                      : editingQuestion
                        ? t('common.update')
                        : t('common.create')}
                  </button>
                  <button
                    type="button"
                    onClick={resetQuestionForm}
                    className="px-4 py-2 text-hv-gray border border-hv-border rounded-md hover:bg-hv-page transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {loadingQuestions ? (
            <p className="text-hv-gray">{t('common.loading')}</p>
          ) : questions.length === 0 ? (
            <p className="text-hv-gray text-center py-8">{t('admin.no_questions')}</p>
          ) : (
            <>
              <div className="hidden md:block bg-white rounded-xl border border-hv-border overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-hv-page">
                    <tr>
                      <th className={headerCellClass}>{t('common.col_title')}</th>
                      <th className={headerCellClass}>{t('admin.question_answer_type')}</th>
                      <th className={headerCellClass}>{t('admin.question_choices')}</th>
                      <th className={`${headerCellClass} text-right`}>{t('common.col_actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hv-border">
                    {questions.map((question) => (
                      <tr key={question.id} className="hover:bg-hv-page">
                        <td className="px-6 py-4 text-hv-charcoal">{question.title}</td>
                        <td className="px-6 py-4 text-sm text-hv-gray">
                          {t(ANSWER_TYPE_LABEL[question.answerType])}
                        </td>
                        <td className="px-6 py-4 text-sm text-hv-gray">
                          {question.choices && question.choices.length > 0
                            ? question.choices.join(', ')
                            : '—'}
                        </td>
                        <td className="px-6 py-4 text-right text-sm space-x-3 whitespace-nowrap">
                          <button
                            onClick={() => startEditQuestion(question)}
                            className="text-hv-terracotta hover:underline transition-colors"
                          >
                            {t('admin.edit_entity_title')}
                          </button>
                          <button
                            onClick={() => {
                              setRetireError(null);
                              setRetireTarget(question);
                            }}
                            disabled={deleteQuestionMutation.isPending}
                            className="text-hv-crisis hover:underline disabled:opacity-50 transition-colors"
                          >
                            {t('admin.question_retire')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-3">
                {questions.map((question) => (
                  <div key={question.id} className="bg-white p-4 rounded-xl border border-hv-border">
                    <p className="text-hv-charcoal">{question.title}</p>
                    <p className="text-sm text-hv-sage mt-1">
                      {t(ANSWER_TYPE_LABEL[question.answerType])}
                      {question.choices && question.choices.length > 0
                        ? ` · ${question.choices.join(', ')}`
                        : ''}
                    </p>
                    <div className="mt-3 flex gap-4 text-sm">
                      <button
                        onClick={() => startEditQuestion(question)}
                        className="text-hv-terracotta hover:underline transition-colors"
                      >
                        {t('admin.edit_entity_title')}
                      </button>
                      <button
                        onClick={() => {
                          setRetireError(null);
                          setRetireTarget(question);
                        }}
                        disabled={deleteQuestionMutation.isPending}
                        className="text-hv-crisis hover:underline disabled:opacity-50 transition-colors"
                      >
                        {t('admin.question_retire')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {deleteSetTarget && (
          <ConfirmDialog
            open
            title={t('admin.qs_delete_title')}
            confirmLabel={t('common.delete')}
            busy={deleteSetMutation.isPending}
            message={
              <div className="space-y-2">
                <p>{t('admin.qs_delete_message').replace('{name}', deleteSetTarget.name)}</p>
                {deleteSetError && <p className="text-hv-crisis font-medium">{deleteSetError}</p>}
              </div>
            }
            warning={t('admin.qs_delete_warning')}
            onConfirm={confirmDeleteSet}
            onCancel={() => {
              setDeleteSetTarget(null);
              setDeleteSetError(null);
            }}
          />
        )}

        {retireTarget && (
          <ConfirmDialog
            open
            title={t('admin.question_retire_title')}
            confirmLabel={t('admin.question_retire')}
            busy={deleteQuestionMutation.isPending}
            message={
              <div className="space-y-2">
                <p>{t('admin.question_retire_message').replace('{title}', retireTarget.title)}</p>
                {retireError && <p className="text-hv-crisis font-medium">{retireError}</p>}
              </div>
            }
            warning={t('admin.question_retire_warning')}
            onConfirm={confirmRetire}
            onCancel={() => {
              setRetireTarget(null);
              setRetireError(null);
            }}
          />
        )}
      </div>
    </RoleGate>
  );
};

export default AdminQuestionSetsPage;
