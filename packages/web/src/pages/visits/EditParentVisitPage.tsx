import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ZodError } from 'zod';
import { ParentVisitCreate, ParentVisitCreateSchema, ParentVisitUpdate } from '@naru/shared';
import { visitsApi } from '../../api/visits';
import { adminApi } from '../../api/admin';
import { questionSetsApi } from '../../api/question-sets';
import { VisitQuestionsPanel } from './VisitQuestionsPanel';
import { PhotoUpload } from '../../components';
import { toDateTimeLocal, fromDateTimeLocal, nowDateTimeLocal, formatDateUTC } from '../../utils/datetime';
import { usePendingPhotoDeletions, useTranslation } from '../../hooks';

export const EditParentVisitPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { id: familyId, pid: parentId, vid: visitId } = useParams<{ id: string; pid: string; vid: string }>();

  const familyIdNum = familyId ? parseInt(familyId, 10) : 0;
  const parentIdNum = parentId ? parseInt(parentId, 10) : 0;
  const visitIdNum = visitId ? parseInt(visitId, 10) : 0;

  const isValidId = familyIdNum > 0 && parentIdNum > 0 && visitIdNum > 0;

  const [formData, setFormData] = useState<ParentVisitCreate>({
    familyId: familyIdNum,
    parentId: parentIdNum,
    visitDate: '',
    weight: 0,
    trainingsReceived: [],
    resourcesReceived: [],
    questions: [],
    photos: [],
    notes: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  const { data: visit, isLoading: loadingVisit } = useQuery({
    queryKey: ['parentVisit', familyIdNum, parentIdNum, visitIdNum],
    queryFn: () => visitsApi.fetchParentVisit(familyIdNum, parentIdNum, visitIdNum),
    enabled: isValidId,
  });

  useEffect(() => {
    if (visit && !loaded) {
      setFormData({
        familyId: visit.familyId,
        parentId: visit.parentId,
        visitDate: toDateTimeLocal(visit.visitDate),
        weight: visit.weight,
        trainingsReceived: visit.trainingsReceived,
        resourcesReceived: visit.resourcesReceived,
        questions: visit.questions,
        photos: visit.photos,
        notes: visit.notes,
      });
      setLoaded(true);
    }
  }, [visit, loaded]);

  const { data: availableTrainings = [], isLoading: loadingTrainings } = useQuery({
    queryKey: ['training'],
    queryFn: adminApi.fetchTraining,
    enabled: isValidId,
  });

  const { data: availableResources = [], isLoading: loadingResources } = useQuery({
    queryKey: ['resources'],
    queryFn: adminApi.fetchResources,
    enabled: isValidId,
  });

  const { data: availableQuestions = [], isLoading: loadingQuestions } = useQuery({
    queryKey: ['parent-visit-questions'],
    queryFn: adminApi.fetchParentVisitQuestions,
    enabled: isValidId,
  });

  const { data: questionSets = [] } = useQuery({
    queryKey: ['question-sets', 'parent'],
    queryFn: () => questionSetsApi.list('parent'),
    enabled: isValidId,
  });

  const applyQuestionSet = (setId: number) => {
    const set = questionSets.find((s) => s.id === setId);
    if (!set) return;
    setFormData((prev) => ({
      ...prev,
      questions: set.items.map((item) => ({
        questionId: item.questionId,
        question: item.questionTitle,
        answer: '',
      })),
    }));
  };

  // Photo removals are staged until save. Cancel is a plain link away from this
  // page, so navigating off discards the staged list and the photos survive.
  const photoDeletions = usePendingPhotoDeletions();

  const updateVisitMutation = useMutation({
    mutationFn: (data: ParentVisitUpdate) => visitsApi.updateParentVisit(familyIdNum, parentIdNum, visitIdNum, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parentVisit', familyIdNum, parentIdNum, visitIdNum] });
      // The visit saved without these photos, so it is now safe to delete the files.
      void photoDeletions.commit();
      navigate(`/families/${familyId}/parents/${parentId}/visits/${visitId}`);
    },
    onError: (error) => {
      console.error('Failed to update parent visit:', error);
      setErrors({ submit: 'Failed to update visit. Please try again.' });
    },
  });

  const handleInputChange = <K extends keyof ParentVisitCreate>(field: K, value: ParentVisitCreate[K]) => {
    setFormData(prev => ({ ...prev, [field]: value } as ParentVisitCreate));
    if (errors[field as string]) {
      setErrors(prev => { const e = { ...prev }; delete e[field as string]; return e; });
    }
  };

  const handleTrainingAdd = (trainingId: number) => {
    const training = availableTrainings.find(t => t.id === trainingId);
    if (training && !formData.trainingsReceived.some(t => t.id === trainingId)) {
      setFormData(prev => ({
        ...prev,
        trainingsReceived: [...prev.trainingsReceived, { id: training.id, title: training.title }]
      }));
    }
  };

  const handleTrainingRemove = (trainingId: number) => {
    setFormData(prev => ({
      ...prev,
      trainingsReceived: prev.trainingsReceived.filter(t => t.id !== trainingId)
    }));
  };

  const handleResourceAdd = (resourceId: number) => {
    const resource = availableResources.find(r => r.id === resourceId);
    if (resource && !formData.resourcesReceived.some(r => r.id === resourceId)) {
      setFormData(prev => ({
        ...prev,
        resourcesReceived: [...prev.resourcesReceived, { id: resource.id, title: resource.title }]
      }));
    }
  };

  const handleResourceRemove = (resourceId: number) => {
    setFormData(prev => ({
      ...prev,
      resourcesReceived: prev.resourcesReceived.filter(r => r.id !== resourceId)
    }));
  };

  const handleQuestionChange = (questionId: number, question: string, answer: string) => {
    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions.filter(q => q.questionId !== questionId), { questionId, question, answer }],
    }));
  };

  const handleQuestionRemove = (questionId: number) => {
    setFormData(prev => ({ ...prev, questions: prev.questions.filter(q => q.questionId !== questionId) }));
  };

  const addQuestion = (questionId: number, question: string) => {
    if (!formData.questions.some(q => q.questionId === questionId)) handleQuestionChange(questionId, question, '');
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    try {
      ParentVisitCreateSchema.parse({
        ...formData,
        visitDate: fromDateTimeLocal(formData.visitDate),
        weight: Number(formData.weight) || 0,
      });
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        error.errors.forEach((err) => {
          if (err.path.length > 0) newErrors[String(err.path[0])] = err.message;
        });
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Keep questions that were already stored on the visit even when their answer
    // is blank (the detail page renders them as "No answer"), so an unrelated edit
    // never silently drops a recorded question. Newly added, unanswered questions
    // are still discarded, matching AddParentVisitPage.
    const storedQuestionIds = new Set((visit?.questions ?? []).map((q) => q.questionId));

    const submitData: ParentVisitUpdate = {
      visitDate: fromDateTimeLocal(formData.visitDate),
      weight: Number(formData.weight) || 0,
      trainingsReceived: formData.trainingsReceived,
      resourcesReceived: formData.resourcesReceived,
      questions: formData.questions.filter(
        (q) => q.answer.trim() !== '' || storedQuestionIds.has(q.questionId)
      ),
      photos: formData.photos,
      notes: formData.notes,
    };

    updateVisitMutation.mutate(submitData);
  };

  if (!isValidId) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-hv-crisis">Invalid family, parent, or visit ID in URL</p>
      </div>
    );
  }

  if (loadingVisit || !loaded) {
    return <div className="text-hv-gray">Loading visit...</div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-hv-charcoal">Edit Parent Visit</h1>
          <p className="text-hv-gray mt-1">
            {visit ? formatDateUTC(visit.visitDate) : ''}
          </p>
        </div>
        <Link
          to={`/families/${familyId}/parents/${parentId}/visits/${visitId}`}
          className="text-hv-terracotta hover:underline transition-colors shrink-0"
        >
          &larr; Back to Visit
        </Link>
      </div>

      <div className="bg-white p-6 rounded-xl border border-hv-border">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Visit Date */}
          <div>
            <label htmlFor="visitDate" className="block text-sm font-medium text-hv-charcoal mb-1">
              Visit Date *
            </label>
            <input
              type="datetime-local"
              id="visitDate"
              value={formData.visitDate}
              onChange={(e) => handleInputChange('visitDate', e.target.value)}
              onClick={(e) => e.currentTarget.showPicker()}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-hv-green ${
                errors.visitDate ? 'border-red-500' : 'border-hv-border-input'
              }`}
              required
            />
            {errors.visitDate && (
              <p className="text-red-500 text-sm mt-1">{errors.visitDate}</p>
            )}
          </div>

          {/* Weight */}
          <div>
            <label htmlFor="weight" className="block text-sm font-medium text-hv-charcoal mb-1">
              Weight (kg)
            </label>
            <input
              type="number"
              id="weight"
              value={formData.weight}
              onChange={(e) => handleInputChange('weight', e.target.value as unknown as number)}
              onFocus={(e) => { if (Number(e.target.value) === 0) handleInputChange('weight', '' as unknown as number); }}
              onBlur={(e) => { if (e.target.value === '') handleInputChange('weight', 0); }}
              step="0.1"
              min="0"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-hv-green ${
                errors.weight ? 'border-red-500' : 'border-hv-border-input'
              }`}
            />
            {errors.weight && (
              <p className="text-red-500 text-sm mt-1">{errors.weight}</p>
            )}
          </div>

          {/* Trainings Received */}
          <div>
            <label className="block text-sm font-medium text-hv-charcoal mb-2">
              Trainings Received
            </label>

            {!loadingTrainings && availableTrainings.length > 0 && (
              <div className="mb-4">
                <select
                  onChange={(e) => {
                    const trainingId = parseInt(e.target.value, 10);
                    if (trainingId) {
                      handleTrainingAdd(trainingId);
                      e.target.value = '';
                    }
                  }}
                  className="px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-green"
                  value=""
                >
                  <option value="">Add a training...</option>
                  {availableTrainings
                    .filter(t => !formData.trainingsReceived.some(ft => ft.id === t.id))
                    .map(training => (
                      <option key={training.id} value={training.id}>
                        {training.title}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              {formData.trainingsReceived.map((training) => (
                <div key={training.id} className="flex items-center justify-between bg-hv-page border border-hv-border rounded-md px-3 py-2">
                  <span className="text-sm">{training.title}</span>
                  <button
                    type="button"
                    onClick={() => handleTrainingRemove(training.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Resources Received */}
          <div>
            <label className="block text-sm font-medium text-hv-charcoal mb-2">
              Resources Received
            </label>

            {!loadingResources && availableResources.length > 0 && (
              <div className="mb-4">
                <select
                  onChange={(e) => {
                    const resourceId = parseInt(e.target.value, 10);
                    if (resourceId) {
                      handleResourceAdd(resourceId);
                      e.target.value = '';
                    }
                  }}
                  className="px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-green"
                  value=""
                >
                  <option value="">Add a resource...</option>
                  {availableResources
                    .filter(r => !formData.resourcesReceived.some(fr => fr.id === r.id))
                    .map(resource => (
                      <option key={resource.id} value={resource.id}>
                        {resource.title}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              {formData.resourcesReceived.map((resource) => (
                <div key={resource.id} className="flex items-center justify-between bg-hv-page border border-hv-border rounded-md px-3 py-2">
                  <span className="text-sm">{resource.title}</span>
                  <button
                    type="button"
                    onClick={() => handleResourceRemove(resource.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Dynamic Questions */}
          <VisitQuestionsPanel
            questionSets={questionSets}
            availableQuestions={availableQuestions}
            loadingQuestions={loadingQuestions}
            questions={formData.questions}
            onApplySet={applyQuestionSet}
            onAdd={addQuestion}
            onChange={handleQuestionChange}
            onRemove={handleQuestionRemove}
          />

          {/* Photos */}
          <PhotoUpload
            photos={formData.photos}
            onChange={(photos) => handleInputChange('photos', photos)}
            pendingDeletions={photoDeletions}
          />

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-hv-charcoal mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value || null)}
              rows={4}
              className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-green"
              placeholder="Additional notes about the visit..."
            />
          </div>

          {/* Form Actions */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={updateVisitMutation.isPending}
              className="bg-hv-terracotta hover:bg-hv-terracotta-hover text-white px-6 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateVisitMutation.isPending ? t('common.saving') : t('common.save_changes')}
            </button>
            <Link
              to={`/families/${familyId}/parents/${parentId}/visits/${visitId}`}
              className="px-6 py-2 border border-hv-border rounded-md text-hv-charcoal hover:bg-hv-page transition-colors"
            >
              {t('common.cancel')}
            </Link>
          </div>

          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-600">{errors.submit}</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default EditParentVisitPage;
