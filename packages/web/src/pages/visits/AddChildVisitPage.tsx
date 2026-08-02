import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ZodError } from 'zod';
import { ChildVisitCreate, ChildVisitCreateSchema } from '@naru/shared';
import { visitsApi } from '../../api/visits';
import { childrenApi } from '../../api/children';
import { adminApi } from '../../api/admin';
import { questionSetsApi } from '../../api/question-sets';
import { VisitQuestionsPanel } from './VisitQuestionsPanel';
import { PhotoUpload } from '../../components';
import { toDateTimeLocal, fromDateTimeLocal, nowDateTimeLocal } from '../../utils/datetime';

export const AddChildVisitPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: familyId, cid: childId } = useParams<{ id: string; cid: string }>();

  // Parse IDs from URL params
  const familyIdNum = familyId ? parseInt(familyId, 10) : 0;
  const childIdNum = childId ? parseInt(childId, 10) : 0;

  // Check if IDs are valid
  const isValidIds = !isNaN(familyIdNum) && familyIdNum > 0 && !isNaN(childIdNum) && childIdNum > 0;

  const [formData, setFormData] = useState<ChildVisitCreate>({
    familyId: familyIdNum,
    childId: childIdNum,
    visitDate: nowDateTimeLocal(),
    weight: 0,
    armCircumference: 0,
    height: 0,
    incap: false,
    leche: false,
    bagsGiven: null,
    recvAnyMedicine: null,
    leftFromProg: null,
    passedAway: null,
    questions: [],
    photos: [] as number[],
    notes: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch child information for display
  const { data: child } = useQuery({
    queryKey: ['child', familyIdNum, childIdNum],
    queryFn: () => childrenApi.fetchChild(familyIdNum, childIdNum),
    enabled: isValidIds,
  });

  // Fetch available questions
  const { data: availableQuestions = [], isLoading: loadingQuestions } = useQuery({
    queryKey: ['child-visit-questions'],
    queryFn: adminApi.fetchChildVisitQuestions,
    enabled: isValidIds,
  });

  // Fetch question sets
  const { data: questionSets = [] } = useQuery({
    queryKey: ['question-sets', 'child'],
    queryFn: () => questionSetsApi.list('child'),
    enabled: isValidIds,
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

  // Create child visit mutation
  const createVisitMutation = useMutation({
    mutationFn: (data: ChildVisitCreate) => visitsApi.createChildVisit(familyIdNum, childIdNum, data),
    onSuccess: () => {
      navigate(`/families/${familyId}/children/${childId}`);
    },
    onError: (error) => {
      console.error('Failed to create child visit:', error);
      setErrors({ submit: 'Failed to create visit. Please try again.' });
    },
  });

  const handleInputChange = <K extends keyof ChildVisitCreate>(field: K, value: ChildVisitCreate[K]) => {
    setFormData(prev => ({ ...prev, [field]: value } as ChildVisitCreate));
    if (errors[field as string]) {
      setErrors(prev => { const e = { ...prev }; delete e[field as string]; return e; });
    }
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
      ChildVisitCreateSchema.parse({
        ...formData,
        visitDate: fromDateTimeLocal(formData.visitDate),
        weight: Number(formData.weight),
        armCircumference: Number(formData.armCircumference),
        height: Number(formData.height),
      });
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        error.errors.forEach((err) => {
          if (err.path.length > 0) newErrors[String(err.path[0])] = err.message;
        });
      }
    }

    // Additional validation
    if (Number(formData.weight) < 0) newErrors.weight = 'Weight must be non-negative';
    if (Number(formData.armCircumference) < 0) newErrors.armCircumference = 'Arm circumference must be non-negative';
    if (Number(formData.height) < 0) newErrors.height = 'Height must be non-negative';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const submitData: ChildVisitCreate = {
      ...formData,
      visitDate: fromDateTimeLocal(formData.visitDate),
      weight: Number(formData.weight),
      armCircumference: Number(formData.armCircumference),
      height: Number(formData.height),
      photos: formData.photos,
      questions: formData.questions.filter(q => q.answer.trim() !== ''),
    };

    createVisitMutation.mutate(submitData);
  };

  if (!isValidIds) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-hv-crisis">Invalid family or child ID in URL</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-hv-charcoal">Add Child Visit</h1>
          {child && (
            <p className="text-hv-gray mt-1">
              Visit for: {child.name}
            </p>
          )}
        </div>
        <Link
          to={`/families/${familyId}/children/${childId}`}
          className="text-hv-terracotta hover:underline transition-colors shrink-0"
        >
          ← Back to Child
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
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-hv-green ${
                errors.visitDate ? 'border-red-500' : 'border-hv-border-input'
              }`}
              required
            />
            {errors.visitDate && (
              <p className="text-hv-crisis text-sm mt-1">{errors.visitDate}</p>
            )}
          </div>

          {/* Measurements */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="weight" className="block text-sm font-medium text-hv-charcoal mb-1">
                Weight (kg)
              </label>
              <input
                type="number"
                id="weight"
                min="0"
                step="0.1"
                value={formData.weight}
                onChange={(e) => handleInputChange('weight', e.target.value as unknown as number)}
                onFocus={(e) => { if (Number(e.target.value) === 0) handleInputChange('weight', '' as unknown as number); }}
                onBlur={(e) => { if (e.target.value === '') handleInputChange('weight', 0); }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-hv-green ${
                  errors.weight ? 'border-red-500' : 'border-hv-border-input'
                }`}
              />
              {errors.weight && (
                <p className="text-hv-crisis text-sm mt-1">{errors.weight}</p>
              )}
            </div>

            <div>
              <label htmlFor="armCircumference" className="block text-sm font-medium text-hv-charcoal mb-1">
                Arm Circumference (mm)
              </label>
              <input
                type="number"
                id="armCircumference"
                min="0"
                value={formData.armCircumference}
                onChange={(e) => handleInputChange('armCircumference', e.target.value as unknown as number)}
                onFocus={(e) => { if (Number(e.target.value) === 0) handleInputChange('armCircumference', '' as unknown as number); }}
                onBlur={(e) => { if (e.target.value === '') handleInputChange('armCircumference', 0); }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-hv-green ${
                  errors.armCircumference ? 'border-red-500' : 'border-hv-border-input'
                }`}
              />
              {errors.armCircumference && (
                <p className="text-hv-crisis text-sm mt-1">{errors.armCircumference}</p>
              )}
            </div>

            <div>
              <label htmlFor="height" className="block text-sm font-medium text-hv-charcoal mb-1">
                Height (mm)
              </label>
              <input
                type="number"
                id="height"
                min="0"
                value={formData.height}
                onChange={(e) => handleInputChange('height', e.target.value as unknown as number)}
                onFocus={(e) => { if (Number(e.target.value) === 0) handleInputChange('height', '' as unknown as number); }}
                onBlur={(e) => { if (e.target.value === '') handleInputChange('height', 0); }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-hv-green ${
                  errors.height ? 'border-red-500' : 'border-hv-border-input'
                }`}
              />
              {errors.height && (
                <p className="text-hv-crisis text-sm mt-1">{errors.height}</p>
              )}
            </div>
          </div>

          {/* Health Status Checkboxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="incap"
                checked={formData.incap}
                onChange={(e) => handleInputChange('incap', e.target.checked)}
                className="w-4 h-4 text-hv-green border-hv-border-input rounded focus:ring-hv-green"
              />
              <label htmlFor="incap" className="ml-2 text-sm text-hv-charcoal">
                Gave special drink (INCAP)
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="leche"
                checked={formData.leche}
                onChange={(e) => handleInputChange('leche', e.target.checked)}
                className="w-4 h-4 text-hv-green border-hv-border-input rounded focus:ring-hv-green"
              />
              <label htmlFor="leche" className="ml-2 text-sm text-hv-charcoal">
                Drinking milk (Leche)
              </label>
            </div>
          </div>

          {/* Text Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="bagsGiven" className="block text-sm font-medium text-hv-charcoal mb-1">
                Bags Given
              </label>
              <input
                type="text"
                id="bagsGiven"
                value={formData.bagsGiven || ''}
                onChange={(e) => handleInputChange('bagsGiven', e.target.value || null)}
                className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-green"
              />
            </div>

            <div>
              <label htmlFor="recvAnyMedicine" className="block text-sm font-medium text-hv-charcoal mb-1">
                Received Medicine
              </label>
              <input
                type="text"
                id="recvAnyMedicine"
                value={formData.recvAnyMedicine || ''}
                onChange={(e) => handleInputChange('recvAnyMedicine', e.target.value || null)}
                className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-green"
              />
            </div>

            <div>
              <label htmlFor="leftFromProg" className="block text-sm font-medium text-hv-charcoal mb-1">
                Left Program
              </label>
              <input
                type="text"
                id="leftFromProg"
                value={formData.leftFromProg || ''}
                onChange={(e) => handleInputChange('leftFromProg', e.target.value || null)}
                className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-green"
              />
            </div>

            <div>
              <label htmlFor="passedAway" className="block text-sm font-medium text-hv-charcoal mb-1">
                Passed Away
              </label>
              <input
                type="text"
                id="passedAway"
                value={formData.passedAway || ''}
                onChange={(e) => handleInputChange('passedAway', e.target.value || null)}
                className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-green"
              />
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

          {/* Photos */}
          <PhotoUpload
            photos={formData.photos}
            onChange={(photos) => setFormData(prev => ({ ...prev, photos }))}
          />

          {/* Form Actions */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={createVisitMutation.isPending}
              className="bg-hv-terracotta hover:bg-hv-terracotta-hover text-white px-6 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createVisitMutation.isPending ? 'Creating...' : 'Create Visit'}
            </button>
            <Link
              to={`/families/${familyId}/children/${childId}`}
              className="px-6 py-2 border border-hv-border rounded-md text-hv-charcoal hover:bg-hv-page transition-colors"
            >
              Cancel
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

export default AddChildVisitPage;
