import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProgramKind, VisitRead } from '@naru/shared';
import VisitForm, { VisitFormProps } from '../VisitForm';
import { visitsApi } from '../../api/visits';
import { adminApi } from '../../api/admin';
import { photosApi } from '../../api/photos';
import { questionSetsApi } from '../../api/question-sets';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
  default: () => ({ t: (key: string) => key, lang: 'en' }),
}));

vi.mock('../../api/visits', () => ({
  visitsApi: {
    fetchVisitPrefill: vi.fn(),
    listVisits: vi.fn(),
    createVisit: vi.fn(),
    updateVisit: vi.fn(),
  },
}));

vi.mock('../../api/admin', () => ({
  adminApi: {
    fetchSites: vi.fn(),
    fetchCommunities: vi.fn(),
    fetchResources: vi.fn(),
    fetchTraining: vi.fn(),
    fetchExaminationTypes: vi.fn(),
  },
}));

vi.mock('../../api/photos', () => ({
  photosApi: { listPhotos: vi.fn(), createPhoto: vi.fn(), deletePhoto: vi.fn() },
}));

vi.mock('../../api/question-sets', () => ({
  questionSetsApi: { listQuestionSets: vi.fn() },
}));

const STAMP = '2026-01-01T00:00:00.000Z';
const VISIT_DATE = '2026-09-29';
const BIRTH_DATE = '2026-03-01T00:00:00.000Z';

const lookup = (id: number, title: string) => ({
  id,
  title,
  sortOrder: 0,
  createdAt: STAMP,
  updatedAt: STAMP,
});

const SAVED_VISIT: VisitRead = {
  id: 77,
  localId: null,
  enrollmentId: 12,
  visitDate: VISIT_DATE,
  locationType: 'SITE',
  siteId: null,
  communityId: null,
  recordedById: 1,
  eventId: null,
  notes: null,
  createdAt: STAMP,
  updatedAt: STAMP,
  resources: [],
  trainingIds: [],
  answers: [],
};

const renderForm = (props: Partial<VisitFormProps> = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const merged: VisitFormProps = {
    enrollmentId: 12,
    program: { id: 3, kind: 'NUTRITION', name: 'Nutrition' },
    ...props,
  };

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <VisitForm {...merged} />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const program = (kind: ProgramKind) => ({ id: 3, kind, name: kind });

const setDate = (value: string) => {
  fireEvent.change(screen.getByLabelText(/visit\.date/), { target: { value } });
};

describe('VisitForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(visitsApi.fetchVisitPrefill).mockResolvedValue({
      locationType: 'SITE',
      siteId: null,
      communityId: null,
      source: 'DEFAULT',
    });
    vi.mocked(visitsApi.listVisits).mockResolvedValue({
      items: [],
      total: 0,
      skip: 0,
      limit: 5,
    });
    vi.mocked(visitsApi.createVisit).mockResolvedValue(SAVED_VISIT);
    vi.mocked(visitsApi.updateVisit).mockResolvedValue(SAVED_VISIT);
    vi.mocked(adminApi.fetchSites).mockResolvedValue([lookup(2, 'Quetzaltenango')]);
    vi.mocked(adminApi.fetchCommunities).mockResolvedValue([
      { ...lookup(5, 'Xela'), siteId: 2 },
    ]);
    vi.mocked(adminApi.fetchResources).mockResolvedValue([
      { ...lookup(7, 'Incaparina'), defaultUnit: 'bag' },
    ]);
    vi.mocked(adminApi.fetchTraining).mockResolvedValue([lookup(9, 'Nutrition basics')]);
    vi.mocked(adminApi.fetchExaminationTypes).mockResolvedValue([lookup(4, 'Prenatal check')]);
    vi.mocked(photosApi.listPhotos).mockResolvedValue({ items: [], total: 0, skip: 0, limit: 20 });
    vi.mocked(questionSetsApi.listQuestionSets).mockResolvedValue([]);
  });

  describe('kind-specific block', () => {
    it('renders the pregnancy block for a PREGNANCY program', async () => {
      renderForm({ program: program('PREGNANCY') });

      expect(await screen.findByLabelText('visit.weight_kg')).toBeInTheDocument();
      expect(screen.getByLabelText('visit.gestation_months')).toBeInTheDocument();
      expect(screen.getByLabelText('visit.examination_type')).toBeInTheDocument();
      expect(screen.queryByLabelText('visit.height_mm')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('visit.arm_circumference_mm')).not.toBeInTheDocument();
    });

    it('renders the nutrition block for a NUTRITION program', async () => {
      renderForm({ program: program('NUTRITION') });

      expect(await screen.findByLabelText('visit.weight_kg')).toBeInTheDocument();
      expect(screen.getByLabelText('visit.height_mm')).toBeInTheDocument();
      expect(screen.getByLabelText('visit.arm_circumference_mm')).toBeInTheDocument();
      expect(screen.queryByLabelText('visit.gestation_months')).not.toBeInTheDocument();
    });

    it.each<ProgramKind>(['MIDWIFE', 'STUDENT', 'FAMILY_PAF'])(
      'renders the spine only for a %s program',
      async (kind) => {
        renderForm({ program: program(kind) });

        await screen.findByLabelText(/visit\.date/);
        expect(screen.queryByLabelText('visit.weight_kg')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('visit.height_mm')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('visit.gestation_months')).not.toBeInTheDocument();
      }
    );

    it('uses numeric inputs so a phone shows a number keypad', async () => {
      renderForm({ program: program('NUTRITION') });

      expect(await screen.findByLabelText('visit.weight_kg')).toHaveAttribute(
        'inputMode',
        'decimal'
      );
      expect(screen.getByLabelText('visit.height_mm')).toHaveAttribute('inputMode', 'numeric');
    });
  });

  describe('prefill', () => {
    it('defaults the date to today', async () => {
      renderForm();

      const today = new Date();
      const pad = (value: number) => String(value).padStart(2, '0');
      const expected = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

      expect(await screen.findByLabelText(/visit\.date/)).toHaveValue(expected);
    });

    it('applies the location prefill and says where it came from', async () => {
      vi.mocked(visitsApi.fetchVisitPrefill).mockResolvedValue({
        locationType: 'HOME',
        siteId: 2,
        communityId: 5,
        source: 'PREVIOUS_VISIT',
      });

      renderForm();

      await waitFor(() =>
        expect(screen.getByLabelText(/visit\.location_type/)).toHaveValue('HOME')
      );
      expect(screen.getByLabelText('visit.site')).toHaveValue('2');
      expect(screen.getByLabelText('visit.community')).toHaveValue('5');
      expect(screen.getByText('visit.prefill_previous')).toBeInTheDocument();
    });

    it('names the subject home as the source when there is no previous visit', async () => {
      vi.mocked(visitsApi.fetchVisitPrefill).mockResolvedValue({
        locationType: 'SITE',
        siteId: 2,
        communityId: 5,
        source: 'SUBJECT_HOME',
      });

      renderForm();

      expect(await screen.findByText('visit.prefill_home')).toBeInTheDocument();
    });

    it('never prefills trainings or resources', async () => {
      vi.mocked(visitsApi.fetchVisitPrefill).mockResolvedValue({
        locationType: 'HOME',
        siteId: 2,
        communityId: 5,
        source: 'PREVIOUS_VISIT',
      });

      renderForm();

      await screen.findByText('visit.prefill_previous');
      expect(screen.getByLabelText('Nutrition basics')).not.toBeChecked();
      expect(screen.queryByLabelText('visit.resource')).not.toBeInTheDocument();
    });
  });

  describe('live z-score', () => {
    const child = { birthDate: BIRTH_DATE, sex: 'FEMALE' as const };

    it('classifies as soon as a weight is typed', async () => {
      renderForm({ program: program('NUTRITION'), subject: child });

      await screen.findByLabelText('visit.weight_kg');
      setDate(VISIT_DATE);
      fireEvent.change(screen.getByLabelText('visit.weight_kg'), { target: { value: '3.9' } });

      expect(screen.getByTestId('live-nutritional-status')).toHaveTextContent('nutrition.severe');
      expect(screen.getByText(/-5\.71/)).toBeInTheDocument();
    });

    it('reclassifies as the weight changes', async () => {
      renderForm({ program: program('NUTRITION'), subject: child });

      await screen.findByLabelText('visit.weight_kg');
      setDate(VISIT_DATE);
      fireEvent.change(screen.getByLabelText('visit.weight_kg'), { target: { value: '3.9' } });
      expect(screen.getByTestId('live-nutritional-status')).toHaveTextContent('nutrition.severe');

      fireEvent.change(screen.getByLabelText('visit.weight_kg'), { target: { value: '6.5' } });
      expect(screen.getByTestId('live-nutritional-status')).toHaveTextContent('nutrition.mild');
    });

    it('follows MUAC over weight-for-age when an arm circumference is taken', async () => {
      renderForm({ program: program('NUTRITION'), subject: child });

      await screen.findByLabelText('visit.weight_kg');
      setDate(VISIT_DATE);
      fireEvent.change(screen.getByLabelText('visit.weight_kg'), { target: { value: '5' } });
      expect(screen.getByTestId('live-nutritional-status')).toHaveTextContent('nutrition.severe');

      fireEvent.change(screen.getByLabelText('visit.arm_circumference_mm'), {
        target: { value: '118' },
      });
      expect(screen.getByTestId('live-nutritional-status')).toHaveTextContent('nutrition.mild');
    });

    it('shows the transition from the previous visit', async () => {
      vi.mocked(visitsApi.listVisits).mockResolvedValue({
        items: [
          {
            ...SAVED_VISIT,
            id: 70,
            visitDate: '2026-08-29',
            program: { id: 3, name: 'Nutrition', kind: 'NUTRITION', subjectType: 'CHILD' },
            subjectName: 'Ana',
            recordedByName: null,
            nutritionDetail: {
              weight: 3.9,
              height: null,
              armCircumference: null,
              weightForAgeZ: -5.71,
              heightForAgeZ: null,
              weightForHeightZ: null,
              muacZ: null,
              nutritionalStatus: 'SEVERE',
            },
          },
        ],
        total: 1,
        skip: 0,
        limit: 5,
      });

      renderForm({ program: program('NUTRITION'), subject: child });

      await screen.findByLabelText('visit.weight_kg');
      setDate(VISIT_DATE);
      fireEvent.change(screen.getByLabelText('visit.weight_kg'), { target: { value: '6.5' } });

      await waitFor(() => expect(screen.getByText(/visit\.was_status/)).toBeInTheDocument());
      expect(screen.getByText(/nutrition\.severe/)).toBeInTheDocument();
      expect(screen.getByText(/\+4\.4 visit\.z_wfa/)).toBeInTheDocument();
      expect(screen.getByText(/visit\.improving/)).toBeInTheDocument();
    });

    it('renders no badge for the z-scores WHO reference data cannot produce yet', async () => {
      renderForm({ program: program('NUTRITION'), subject: child });

      await screen.findByLabelText('visit.weight_kg');
      setDate(VISIT_DATE);
      fireEvent.change(screen.getByLabelText('visit.weight_kg'), { target: { value: '3.9' } });

      expect(screen.queryByText(/No data/)).not.toBeInTheDocument();
      expect(screen.queryByText('visit.z_muac', { exact: false })).not.toBeInTheDocument();
    });

    it('explains itself when the child has no birth date', async () => {
      renderForm({ program: program('NUTRITION'), subject: null });

      expect(await screen.findByText('visit.zscore_needs_birth_date')).toBeInTheDocument();
    });
  });

  describe('resources', () => {
    it('adds and removes rows', async () => {
      renderForm();

      fireEvent.click(await screen.findByText('visit.add_resource'));
      expect(screen.getByLabelText('visit.resource')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'common.remove' }));
      expect(screen.queryByLabelText('visit.resource')).not.toBeInTheDocument();
    });

    it('rejects a row with a resource but no quantity', async () => {
      renderForm();

      fireEvent.click(await screen.findByText('visit.add_resource'));
      fireEvent.change(screen.getByLabelText('visit.resource'), { target: { value: '7' } });
      fireEvent.click(screen.getByRole('button', { name: 'visit.save_visit' }));

      expect(await screen.findByText('visit.error_resource_incomplete')).toBeInTheDocument();
      expect(visitsApi.createVisit).not.toHaveBeenCalled();
    });
  });

  describe('save', () => {
    it('posts a visit with explicit resource, training and answer arrays', async () => {
      const onSaved = vi.fn();
      renderForm({ onSaved });

      await screen.findByLabelText(/visit\.date/);
      setDate(VISIT_DATE);
      fireEvent.change(screen.getByLabelText('visit.site'), { target: { value: '2' } });
      fireEvent.click(screen.getByLabelText('Nutrition basics'));
      fireEvent.click(screen.getByText('visit.add_resource'));
      fireEvent.change(screen.getByLabelText('visit.resource'), { target: { value: '7' } });
      fireEvent.change(screen.getByLabelText('visit.quantity'), { target: { value: '2' } });
      fireEvent.click(screen.getByRole('button', { name: 'visit.save_visit' }));

      await waitFor(() => expect(visitsApi.createVisit).toHaveBeenCalledTimes(1));
      expect(visitsApi.createVisit).toHaveBeenCalledWith({
        enrollmentId: 12,
        visitDate: VISIT_DATE,
        locationType: 'SITE',
        siteId: 2,
        communityId: null,
        eventId: null,
        notes: null,
        resources: [{ resourceId: 7, quantity: 2, unit: 'bag' }],
        trainingIds: [9],
        answers: [],
        nutritionDetail: { weight: null, height: null, armCircumference: null },
      });
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(SAVED_VISIT));
    });

    it('never sends a detail block a kind does not permit', async () => {
      renderForm({ program: program('STUDENT') });

      await screen.findByLabelText(/visit\.date/);
      fireEvent.click(screen.getByRole('button', { name: 'visit.save_visit' }));

      await waitFor(() => expect(visitsApi.createVisit).toHaveBeenCalledTimes(1));
      const payload = vi.mocked(visitsApi.createVisit).mock.calls[0]![0];
      expect(payload).not.toHaveProperty('nutritionDetail');
      expect(payload).not.toHaveProperty('pregnancyDetail');
    });
  });

  describe('edit mode', () => {
    const existing: VisitRead = {
      ...SAVED_VISIT,
      visitDate: '2026-09-20',
      locationType: 'HOME',
      siteId: 2,
      communityId: 5,
      notes: 'Doing better',
      resources: [{ resourceId: 7, quantity: 2, unit: 'bag' }],
      trainingIds: [9],
      answers: [{ questionId: 101, valueText: 'Ate well', valueNum: null, valueBool: null }],
      nutritionDetail: {
        weight: 6.5,
        height: 560,
        armCircumference: 118,
        weightForAgeZ: -1.33,
        heightForAgeZ: null,
        weightForHeightZ: null,
        muacZ: -1.99,
        nutritionalStatus: 'MILD',
      },
    };

    it('loads the visit into the same form', async () => {
      renderForm({ visit: existing });

      expect(await screen.findByLabelText(/visit\.date/)).toHaveValue('2026-09-20');
      expect(screen.getByLabelText(/visit\.location_type/)).toHaveValue('HOME');
      expect(screen.getByLabelText('visit.weight_kg')).toHaveValue(6.5);
      expect(screen.getByLabelText('visit.height_mm')).toHaveValue(560);
      expect(screen.getByLabelText('visit.notes')).toHaveValue('Doing better');
      expect(await screen.findByLabelText('Nutrition basics')).toBeChecked();
      expect(screen.getByLabelText('visit.resource')).toHaveValue('7');
      expect(visitsApi.fetchVisitPrefill).not.toHaveBeenCalled();
    });

    it('PUTs all three join arrays so nothing is silently left behind', async () => {
      renderForm({ visit: existing });

      await screen.findByLabelText(/visit\.date/);
      fireEvent.click(screen.getByRole('button', { name: 'visit.save_visit' }));

      await waitFor(() => expect(visitsApi.updateVisit).toHaveBeenCalledTimes(1));
      const [id, payload] = vi.mocked(visitsApi.updateVisit).mock.calls[0]!;
      expect(id).toBe(77);
      expect(payload).not.toHaveProperty('enrollmentId');
      expect(payload.resources).toEqual([{ resourceId: 7, quantity: 2, unit: 'bag' }]);
      expect(payload.trainingIds).toEqual([9]);
      expect(payload.answers).toEqual([
        { questionId: 101, valueText: 'Ate well', valueNum: null, valueBool: null },
      ]);
      expect(payload.nutritionDetail).toEqual({
        weight: 6.5,
        height: 560,
        armCircumference: 118,
      });
    });
  });
});
