import React, { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  type ProgramRead,
  type ProgramCreate,
  type ProgramUpdate,
  type ProgramKind,
  type SubjectType,
  type TranslationKey,
} from '@naru/shared';
import { programsApi } from '../../api/programs';
import { RoleGate, ConfirmDialog, PageHeader, NameInput } from '../../components';
import { useTranslation } from '../../hooks';

// Duplicates the backend's KIND_SUBJECT_TYPE map (program.service.ts). Each kind
// has exactly one subject type; creating a contradictory pair is rejected by the
// API, so the form derives the subject rather than offering a second choice.
const KIND_SUBJECT: Record<ProgramKind, SubjectType> = {
  PREGNANCY: 'MOTHER',
  NUTRITION: 'CHILD',
  MIDWIFE: 'PERSON',
  STUDENT: 'PERSON',
  FAMILY_PAF: 'FAMILY',
};

const KIND_ORDER: ProgramKind[] = ['PREGNANCY', 'NUTRITION', 'MIDWIFE', 'STUDENT', 'FAMILY_PAF'];

const KIND_LABEL: Record<ProgramKind, TranslationKey> = {
  PREGNANCY: 'program.kind.PREGNANCY',
  NUTRITION: 'program.kind.NUTRITION',
  MIDWIFE: 'program.kind.MIDWIFE',
  STUDENT: 'program.kind.STUDENT',
  FAMILY_PAF: 'program.kind.FAMILY_PAF',
};

const SUBJECT_LABEL: Record<SubjectType, TranslationKey> = {
  MOTHER: 'subject_type.mother',
  CHILD: 'subject_type.child',
  PERSON: 'subject_type.person',
  FAMILY: 'subject_type.family',
};

const getErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

const toIntOrNull = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

interface ProgramFormState {
  name: string;
  kind: ProgramKind;
  description: string;
  visitIntervalDays: string;
  minAgeMonths: string;
  maxAgeMonths: string;
  active: boolean;
  sortOrder: string;
}

const emptyForm: ProgramFormState = {
  name: '',
  kind: 'NUTRITION',
  description: '',
  visitIntervalDays: '',
  minAgeMonths: '',
  maxAgeMonths: '',
  active: true,
  sortOrder: '0',
};

const formFor = (program: ProgramRead): ProgramFormState => ({
  name: program.name,
  kind: program.kind,
  description: program.description ?? '',
  visitIntervalDays: program.visitIntervalDays?.toString() ?? '',
  minAgeMonths: program.minAgeMonths?.toString() ?? '',
  maxAgeMonths: program.maxAgeMonths?.toString() ?? '',
  active: program.active,
  sortOrder: program.sortOrder.toString(),
});

const inputClass =
  'w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent';
const labelClass = 'block text-sm font-medium text-hv-charcoal mb-1';
const hintClass = 'text-xs text-hv-sage mt-1';

export const AdminProgramsPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProgramRead | null>(null);
  const [form, setForm] = useState<ProgramFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgramRead | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['programs', { activeOnly: false }],
    queryFn: () => programsApi.listPrograms({}),
  });

  const programs = data?.items ?? [];

  // The sidebar renders from ['programs', { activeOnly: true }]; invalidating the
  // prefix keeps it from going stale after any write here.
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['programs'] });

  const createMutation = useMutation({
    mutationFn: (payload: ProgramCreate) => programsApi.createProgram(payload),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ProgramUpdate }) =>
      programsApi.updateProgram(id, payload),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => programsApi.deleteProgram(id),
    onSuccess: invalidate,
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
    setShowForm(false);
    setFormError(null);
  };

  const startCreate = () => {
    setForm(emptyForm);
    setEditing(null);
    setFormError(null);
    setShowForm(true);
  };

  const startEdit = (program: ProgramRead) => {
    setForm(formFor(program));
    setEditing(program);
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = form.name.trim();
    if (!name) {
      setFormError(t('admin.program_name_required'));
      return;
    }

    const minAgeMonths = toIntOrNull(form.minAgeMonths);
    const maxAgeMonths = toIntOrNull(form.maxAgeMonths);
    if (minAgeMonths !== null && maxAgeMonths !== null && maxAgeMonths < minAgeMonths) {
      setFormError(t('admin.program_age_band_invalid'));
      return;
    }

    const shared = {
      name,
      description: form.description.trim() === '' ? null : form.description.trim(),
      minAgeMonths,
      maxAgeMonths,
      visitIntervalDays: toIntOrNull(form.visitIntervalDays),
      active: form.active,
      sortOrder: toIntOrNull(form.sortOrder) ?? 0,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, payload: shared });
      } else {
        await createMutation.mutateAsync({
          ...shared,
          kind: form.kind,
          subjectType: KIND_SUBJECT[form.kind],
        });
      }
      resetForm();
    } catch (err) {
      setFormError(getErrorMessage(err, t('admin.program_save_failed')));
    }
  };

  const toggleActive = (program: ProgramRead) => {
    updateMutation.mutate({ id: program.id, payload: { active: !program.active } });
  };

  const requestDelete = (program: ProgramRead) => {
    setDeleteError(null);
    setDeleteTarget(program);
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(getErrorMessage(err, t('admin.program_delete_failed')));
    }
  };

  const deactivateInstead = async () => {
    if (!deleteTarget) return;
    try {
      await updateMutation.mutateAsync({ id: deleteTarget.id, payload: { active: false } });
      setDeleteTarget(null);
      setDeleteError(null);
    } catch (err) {
      setDeleteError(getErrorMessage(err, t('admin.program_save_failed')));
    }
  };

  const ageBand = (program: ProgramRead): string => {
    if (program.minAgeMonths == null && program.maxAgeMonths == null) return '—';
    const min = program.minAgeMonths ?? 0;
    const max = program.maxAgeMonths;
    return max == null
      ? `${min}+ ${t('admin.program_months_short')}`
      : `${min}–${max} ${t('admin.program_months_short')}`;
  };

  const interval = (program: ProgramRead): string =>
    program.visitIntervalDays == null
      ? t('admin.program_never_overdue')
      : `${program.visitIntervalDays} ${t('admin.program_days_short')}`;

  const subjectFor = form.kind;

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <RoleGate requiredRole="ADMIN">
      <div>
        <PageHeader
          title={t('admin.programs')}
          backTo="/admin"
          backLabel={t('common.back_to_admin')}
          actions={
            !showForm && (
              <button
                onClick={startCreate}
                className="bg-hv-terracotta text-white px-4 py-2 rounded-md hover:bg-hv-terracotta-hover transition-colors"
              >
                + {t('admin.program_add')}
              </button>
            )
          }
        />

        {showForm && (
          <div className="bg-white p-6 rounded-xl border border-hv-border mb-6">
            <h2 className="text-lg font-serif font-semibold text-hv-charcoal mb-4">
              {editing ? t('admin.program_edit') : t('admin.program_new')}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="program-name" className={labelClass}>
                    {t('common.col_name')} <span className="text-red-500">*</span>
                  </label>
                  <NameInput
                    id="program-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={inputClass}
                    placeholder={t('admin.program_name_placeholder')}
                  />
                </div>

                <div>
                  {editing ? (
                    <>
                      <span className={labelClass}>{t('admin.program_kind')}</span>
                      <p className="px-3 py-2 rounded-md bg-hv-page border border-hv-border text-hv-charcoal">
                        {t(KIND_LABEL[editing.kind])}
                      </p>
                      <p className={hintClass}>{t('admin.program_kind_locked')}</p>
                    </>
                  ) : (
                    <>
                      <label htmlFor="program-kind" className={labelClass}>
                        {t('admin.program_kind')} <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="program-kind"
                        value={form.kind}
                        onChange={(e) => setForm({ ...form, kind: e.target.value as ProgramKind })}
                        className={`${inputClass} bg-white`}
                      >
                        {KIND_ORDER.map((kind) => (
                          <option key={kind} value={kind}>
                            {t(KIND_LABEL[kind])}
                          </option>
                        ))}
                      </select>
                      <p className={hintClass}>{t('admin.program_kind_immutable_hint')}</p>
                    </>
                  )}
                </div>

                <div>
                  <span className={labelClass}>{t('admin.program_subject')}</span>
                  <p className="px-3 py-2 rounded-md bg-hv-page border border-hv-border text-hv-charcoal">
                    {t(SUBJECT_LABEL[editing ? editing.subjectType : KIND_SUBJECT[subjectFor]])}
                  </p>
                  <p className={hintClass}>{t('admin.program_subject_locked')}</p>
                </div>

                <div>
                  <label htmlFor="program-interval" className={labelClass}>
                    {t('admin.program_visit_interval')}
                  </label>
                  <input
                    id="program-interval"
                    type="number"
                    min={1}
                    value={form.visitIntervalDays}
                    onChange={(e) => setForm({ ...form, visitIntervalDays: e.target.value })}
                    className={inputClass}
                    placeholder={t('admin.program_visit_interval_placeholder')}
                  />
                  <p className={hintClass}>{t('admin.program_visit_interval_hint')}</p>
                </div>
              </div>

              <div>
                <label htmlFor="program-description" className={labelClass}>
                  {t('admin.program_description')}
                </label>
                <textarea
                  id="program-description"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={inputClass}
                />
              </div>

              <fieldset className="border border-hv-border rounded-md p-4">
                <legend className="px-1 text-sm font-medium text-hv-charcoal">
                  {t('admin.program_age_band')}
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="program-min-age" className={labelClass}>
                      {t('admin.program_min_age')}
                    </label>
                    <input
                      id="program-min-age"
                      type="number"
                      min={0}
                      value={form.minAgeMonths}
                      onChange={(e) => setForm({ ...form, minAgeMonths: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="program-max-age" className={labelClass}>
                      {t('admin.program_max_age')}
                    </label>
                    <input
                      id="program-max-age"
                      type="number"
                      min={0}
                      value={form.maxAgeMonths}
                      onChange={(e) => setForm({ ...form, maxAgeMonths: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
                <p className={hintClass}>{t('admin.program_age_band_hint')}</p>
              </fieldset>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="program-sort-order" className={labelClass}>
                    {t('admin.program_sort_order')}
                  </label>
                  <input
                    id="program-sort-order"
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                    className={inputClass}
                  />
                  <p className={hintClass}>{t('admin.program_sort_order_hint')}</p>
                </div>

                <div>
                  <label htmlFor="program-active" className="flex items-center gap-2 cursor-pointer">
                    <input
                      id="program-active"
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm({ ...form, active: e.target.checked })}
                      className="rounded border-hv-border-input text-hv-accent focus:ring-hv-accent"
                    />
                    <span className="text-sm font-medium text-hv-charcoal">
                      {t('admin.program_active')}
                    </span>
                  </label>
                  <p className={hintClass}>{t('admin.program_active_hint')}</p>
                </div>
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-hv-crisis text-sm">{formError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover disabled:opacity-50 transition-colors"
                >
                  {isSaving ? t('common.saving') : editing ? t('common.update') : t('common.create')}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-hv-gray border border-hv-border rounded-md hover:bg-hv-page transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <p className="text-hv-gray">{t('common.loading')}</p>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-hv-crisis">{getErrorMessage(error, t('admin.program_load_failed'))}</p>
          </div>
        ) : programs.length === 0 ? (
          <p className="text-hv-gray text-center py-8">{t('admin.programs_empty')}</p>
        ) : (
          <>
            <div className="hidden md:block bg-white rounded-xl border border-hv-border overflow-x-auto">
              <table className="w-full">
                <thead className="bg-hv-page">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                      {t('common.col_name')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                      {t('admin.program_kind')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                      {t('admin.program_subject')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                      {t('admin.program_visit_interval')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                      {t('admin.program_age_band')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                      {t('admin.program_active')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-hv-sage uppercase tracking-wider">
                      {t('common.col_actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hv-border">
                  {programs.map((program) => (
                    <tr key={program.id} className="hover:bg-hv-page">
                      <td className="px-6 py-4">
                        <div className="font-medium text-hv-charcoal">{program.name}</div>
                        {program.description && (
                          <div className="text-sm text-hv-sage">{program.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-hv-gray">{t(KIND_LABEL[program.kind])}</td>
                      <td className="px-6 py-4 text-sm text-hv-gray">
                        {t(SUBJECT_LABEL[program.subjectType])}
                      </td>
                      <td className="px-6 py-4 text-sm text-hv-gray">{interval(program)}</td>
                      <td className="px-6 py-4 text-sm text-hv-gray">{ageBand(program)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            program.active ? 'bg-green-500 text-white' : 'bg-hv-page text-hv-sage border border-hv-border'
                          }`}
                        >
                          {program.active ? t('admin.program_active') : t('admin.program_inactive')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm space-x-3 whitespace-nowrap">
                        <button
                          onClick={() => startEdit(program)}
                          className="text-hv-terracotta hover:underline transition-colors"
                        >
                          {t('admin.edit_entity_title')}
                        </button>
                        <button
                          onClick={() => toggleActive(program)}
                          disabled={updateMutation.isPending}
                          className="text-hv-accent hover:underline disabled:opacity-50 transition-colors"
                        >
                          {program.active ? t('admin.program_deactivate') : t('admin.program_activate')}
                        </button>
                        <button
                          onClick={() => requestDelete(program)}
                          disabled={deleteMutation.isPending}
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
              {programs.map((program) => (
                <div key={program.id} className="bg-white p-4 rounded-xl border border-hv-border">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-medium text-hv-charcoal">{program.name}</p>
                      <p className="text-sm text-hv-sage">
                        {t(KIND_LABEL[program.kind])} · {t(SUBJECT_LABEL[program.subjectType])}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium shrink-0 ${
                        program.active ? 'bg-green-500 text-white' : 'bg-hv-page text-hv-sage border border-hv-border'
                      }`}
                    >
                      {program.active ? t('admin.program_active') : t('admin.program_inactive')}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-hv-sage uppercase tracking-wider">
                        {t('admin.program_visit_interval')}
                      </dt>
                      <dd className="text-hv-gray">{interval(program)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-hv-sage uppercase tracking-wider">
                        {t('admin.program_age_band')}
                      </dt>
                      <dd className="text-hv-gray">{ageBand(program)}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex gap-4 text-sm">
                    <button
                      onClick={() => startEdit(program)}
                      className="text-hv-terracotta hover:underline transition-colors"
                    >
                      {t('admin.edit_entity_title')}
                    </button>
                    <button
                      onClick={() => toggleActive(program)}
                      disabled={updateMutation.isPending}
                      className="text-hv-accent hover:underline disabled:opacity-50 transition-colors"
                    >
                      {program.active ? t('admin.program_deactivate') : t('admin.program_activate')}
                    </button>
                    <button
                      onClick={() => requestDelete(program)}
                      disabled={deleteMutation.isPending}
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

        {deleteTarget && (
          <ConfirmDialog
            open
            title={t('admin.program_delete_title')}
            confirmLabel={t('common.delete')}
            busy={deleteMutation.isPending}
            message={
              <div className="space-y-2">
                <p>
                  {t('admin.program_delete_message').replace('{name}', deleteTarget.name)}
                </p>
                {deleteError && (
                  <>
                    <p className="text-hv-crisis font-medium">{deleteError}</p>
                    {deleteTarget.active && (
                      <button
                        type="button"
                        onClick={deactivateInstead}
                        disabled={updateMutation.isPending}
                        className="px-3 py-1 rounded-md bg-hv-green text-white text-sm hover:bg-hv-green-hover disabled:opacity-50 transition-colors"
                      >
                        {t('admin.program_deactivate_instead')}
                      </button>
                    )}
                  </>
                )}
              </div>
            }
            warning={t('admin.program_delete_warning')}
            onConfirm={confirmDelete}
            onCancel={cancelDelete}
          />
        )}
      </div>
    </RoleGate>
  );
};

export default AdminProgramsPage;
