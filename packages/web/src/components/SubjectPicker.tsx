import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SUBJECT_FK, ageInDays } from '@naru/shared';
import type { Sex, SubjectType } from '@naru/shared';
import { listMothers, createMother } from '../api/mothers';
import { listChildren, createChild } from '../api/children';
import { listPeople, createPerson } from '../api/people';
import { listFamilies, createFamily } from '../api/families';
import { listEnrollments } from '../api/enrollments';
import { useTranslation } from '../hooks/useTranslation';
import { SubjectTypeBadge } from './SubjectTypeBadge';

export interface PickedSubject {
  id: number;
  type: SubjectType;
  name: string;
  birthDate?: string | null;
  communityId?: number | null;
}

export interface SubjectPickerProps {
  subjectType: SubjectType;
  programId: number;
  programName?: string;
  selectedId?: number | null;
  onSelect: (subject: PickedSubject) => void;
  communityNames?: Record<number, string>;
  limit?: number;
  debounceMs?: number;
  className?: string;
}

interface SubjectResult {
  id: number;
  name: string;
  birthDate?: string | null;
  communityId?: number | null;
}

const FIELD =
  'w-full px-3 py-2 bg-white border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent';
const LABEL = 'block text-sm font-medium text-hv-gray mb-1';

const formatAge = (birthDate?: string | null): string | null => {
  if (!birthDate) {
    return null;
  }
  const days = ageInDays(new Date(birthDate));
  if (days === null) {
    return null;
  }
  const years = Math.floor(days / 365.25);
  return years >= 2 ? `${years}y` : `${Math.floor(days / 30.4375)}m`;
};

const searchSubjects = async (
  type: SubjectType,
  search: string,
  limit: number
): Promise<SubjectResult[]> => {
  switch (type) {
    case 'MOTHER': {
      const { items } = await listMothers({ search, limit });
      return items.map((item) => ({
        id: item.id,
        name: item.name,
        birthDate: item.birthDate,
        communityId: item.communityId,
      }));
    }
    case 'CHILD': {
      const { items } = await listChildren({ search, limit });
      return items.map((item) => ({
        id: item.id,
        name: item.name,
        birthDate: item.birthDate,
        communityId: item.communityId,
      }));
    }
    case 'PERSON': {
      const { items } = await listPeople({ search, limit });
      return items.map((item) => ({
        id: item.id,
        name: item.name,
        birthDate: item.birthDate,
        communityId: item.communityId,
      }));
    }
    case 'FAMILY': {
      const { families } = await listFamilies({ search, limit });
      return families.map((item) => ({
        id: item.id,
        name: item.familyName ?? '',
        communityId: item.communityId,
      }));
    }
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
};

const searchUnenrolled = async (
  type: SubjectType,
  search: string,
  limit: number
): Promise<number[]> => {
  switch (type) {
    case 'MOTHER': {
      const { items } = await listMothers({ search, limit, unenrolled: true });
      return items.map((item) => item.id);
    }
    case 'CHILD': {
      const { items } = await listChildren({ search, limit, unenrolled: true });
      return items.map((item) => item.id);
    }
    case 'PERSON': {
      const { items } = await listPeople({ search, limit, unenrolled: true });
      return items.map((item) => item.id);
    }
    case 'FAMILY':
      return [];
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
};

interface DraftSubject {
  name: string;
  birthDate: string;
  sex: Sex | '';
}

const EMPTY_DRAFT: DraftSubject = { name: '', birthDate: '', sex: '' };

const toIsoDate = (value: string): string => new Date(`${value}T00:00:00.000Z`).toISOString();

export const SubjectPicker: React.FC<SubjectPickerProps> = ({
  subjectType,
  programId,
  programName,
  selectedId,
  onSelect,
  communityNames,
  limit = 20,
  debounceMs = 300,
  className,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<DraftSubject>(EMPTY_DRAFT);
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(term.trim()), debounceMs);
    return () => clearTimeout(handle);
  }, [term, debounceMs]);

  const enabled = debounced.length > 0;

  const results = useQuery({
    queryKey: ['subject-picker', subjectType, debounced, limit],
    queryFn: () => searchSubjects(subjectType, debounced, limit),
    enabled,
  });

  const unenrolled = useQuery({
    queryKey: ['subject-picker-unenrolled', subjectType, debounced, limit],
    queryFn: () => searchUnenrolled(subjectType, debounced, limit),
    enabled: enabled && subjectType !== 'FAMILY',
  });

  const enrolled = useQuery({
    queryKey: ['subject-picker-enrolled', programId, subjectType],
    queryFn: () => listEnrollments({ programId, status: 'active', limit: 1000 }),
  });

  const blockedIds = useMemo(() => {
    const fk = SUBJECT_FK[subjectType];
    const ids = new Set<number>();
    (enrolled.data?.items ?? []).forEach((item) => {
      const value = item[fk];
      if (typeof value === 'number') {
        ids.add(value);
      }
    });
    return ids;
  }, [enrolled.data, subjectType]);

  const unenrolledIds = useMemo(
    () => new Set(unenrolled.data ?? []),
    [unenrolled.data]
  );

  const pick = (result: SubjectResult) => {
    onSelect({
      id: result.id,
      type: subjectType,
      name: result.name,
      birthDate: result.birthDate ?? null,
      communityId: result.communityId ?? null,
    });
  };

  const create = useMutation({
    mutationFn: async (): Promise<PickedSubject> => {
      const name = draft.name.trim();
      switch (subjectType) {
        case 'CHILD': {
          const created = await createChild({
            name,
            birthDate: toIsoDate(draft.birthDate),
            sex: draft.sex as Sex,
          });
          return {
            id: created.id,
            type: 'CHILD',
            name: created.name,
            birthDate: created.birthDate,
            communityId: created.communityId,
          };
        }
        case 'MOTHER': {
          const created = await createMother({ name });
          return {
            id: created.id,
            type: 'MOTHER',
            name: created.name,
            birthDate: created.birthDate,
            communityId: created.communityId,
          };
        }
        case 'PERSON': {
          const created = await createPerson({ name });
          return {
            id: created.id,
            type: 'PERSON',
            name: created.name,
            birthDate: created.birthDate,
            communityId: created.communityId,
          };
        }
        case 'FAMILY': {
          const created = await createFamily({ familyName: name, inCrisis: false });
          return {
            id: created.id,
            type: 'FAMILY',
            name: created.familyName ?? name,
            communityId: created.communityId,
          };
        }
        default: {
          const exhaustive: never = subjectType;
          return exhaustive;
        }
      }
    },
    onSuccess: (subject) => {
      void queryClient.invalidateQueries({ queryKey: ['subject-picker'] });
      setCreating(false);
      setDraft(EMPTY_DRAFT);
      setDraftError(null);
      onSelect(subject);
    },
    onError: () => setDraftError(t('subject_picker.create_failed')),
  });

  const submitDraft = (event: React.FormEvent) => {
    event.preventDefault();
    if (draft.name.trim().length === 0 && subjectType !== 'FAMILY') {
      setDraftError(t('subject_picker.name_required'));
      return;
    }
    if (subjectType === 'CHILD' && (draft.birthDate === '' || draft.sex === '')) {
      setDraftError(t('subject_picker.child_fields_required'));
      return;
    }
    setDraftError(null);
    create.mutate();
  };

  const createLabelKey =
    subjectType === 'MOTHER'
      ? 'subject_picker.create_mother'
      : subjectType === 'CHILD'
        ? 'subject_picker.create_child'
        : subjectType === 'PERSON'
          ? 'subject_picker.create_person'
          : 'subject_picker.create_family';

  const items = results.data ?? [];

  return (
    <div className={`space-y-4${className ? ` ${className}` : ''}`}>
      <div>
        <label htmlFor="subject-picker-search" className={LABEL}>
          {t('subject_picker.search')}
        </label>
        <input
          id="subject-picker-search"
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={t('subject_picker.search')}
          className={FIELD}
        />
      </div>

      {enabled && results.isLoading && (
        <p className="text-sm text-hv-gray">{t('common.loading')}</p>
      )}

      {enabled && !results.isLoading && items.length === 0 && (
        <p className="text-sm text-hv-gray">{t('subject_picker.no_results')}</p>
      )}

      {items.length > 0 && (
        <ul className="space-y-2" role="listbox" aria-label={t('subject_picker.results')}>
          {items.map((item) => {
            const blocked = blockedIds.has(item.id);
            const age = formatAge(item.birthDate);
            const community = item.communityId ? communityNames?.[item.communityId] : null;
            const selected = selectedId === item.id;

            return (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-disabled={blocked}
                  disabled={blocked}
                  onClick={() => pick(item)}
                  className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded border p-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-hv-accent ${
                    blocked
                      ? 'border-hv-border bg-hv-page opacity-50 cursor-not-allowed'
                      : selected
                        ? 'border-hv-accent bg-white'
                        : 'border-hv-border bg-white hover:border-hv-accent'
                  }`}
                >
                  <span className="font-medium text-hv-green">
                    {item.name || t('common.unnamed')}
                  </span>
                  <SubjectTypeBadge type={subjectType} />
                  {age && <span className="text-sm text-hv-gray tabular-nums">{age}</span>}
                  {community && <span className="text-sm text-hv-gray">{community}</span>}
                  {blocked && (
                    <span className="ml-auto text-sm font-medium text-hv-crisis">
                      {t('subject_picker.already_enrolled')}
                      {programName ? ` ${programName}` : ''}
                    </span>
                  )}
                  {!blocked && unenrolledIds.has(item.id) && (
                    <span className="ml-auto text-sm text-hv-terracotta">
                      <span aria-hidden="true">&#9888; </span>
                      {t('subject_picker.unenrolled')}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-hv-border pt-4">
        {!creating ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="bg-hv-green text-white px-4 py-2 rounded hover:bg-hv-green-hover transition-colors"
          >
            {t(createLabelKey)}
          </button>
        ) : (
          <form onSubmit={submitDraft} className="space-y-4">
            <h3 className="text-lg font-semibold text-hv-green">{t(createLabelKey)}</h3>

            {draftError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-red-600">{draftError}</p>
              </div>
            )}

            <div>
              <label htmlFor="subject-draft-name" className={LABEL}>
                {t('subject_picker.name')}
                {subjectType !== 'FAMILY' && <span className="text-red-500">*</span>}
              </label>
              <input
                id="subject-draft-name"
                type="text"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className={FIELD}
              />
            </div>

            {subjectType === 'CHILD' && (
              <>
                <div>
                  <label htmlFor="subject-draft-birth-date" className={LABEL}>
                    {t('subject_picker.birth_date')}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="subject-draft-birth-date"
                    type="date"
                    value={draft.birthDate}
                    onChange={(event) => setDraft({ ...draft, birthDate: event.target.value })}
                    className={FIELD}
                  />
                </div>
                <div>
                  <label htmlFor="subject-draft-sex" className={LABEL}>
                    {t('subject_picker.sex')}
                    <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="subject-draft-sex"
                    value={draft.sex}
                    onChange={(event) =>
                      setDraft({ ...draft, sex: event.target.value as Sex | '' })
                    }
                    className={FIELD}
                  >
                    <option value="">{t('subject_picker.select_sex')}</option>
                    <option value="MALE">{t('subject_picker.male')}</option>
                    <option value="FEMALE">{t('subject_picker.female')}</option>
                  </select>
                </div>
              </>
            )}

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={create.isPending}
                className="bg-hv-green text-white px-4 py-2 rounded hover:bg-hv-green-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {create.isPending ? t('common.saving') : t('common.save')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setDraft(EMPTY_DRAFT);
                  setDraftError(null);
                }}
                className="bg-hv-gray text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SubjectPicker;
