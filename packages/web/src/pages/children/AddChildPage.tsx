import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChildCreate, ChildCreateSchema } from '@naru/shared';
import { childrenApi } from '../../api/children';
import { PhotoUpload, NameInput } from '../../components';
import { useTranslation } from '../../hooks';

/**
 * AddChildPage - Form to add a new child to a family
 */
export const AddChildPage: React.FC = () => {
  const { id: familyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const familyIdNum = familyId ? parseInt(familyId, 10) : 0;

  const [formData, setFormData] = useState({
    name: '',
    birthDate: '',
    sex: 'MALE' as 'MALE' | 'FEMALE',
    weight: 0,
    nutritionalState: '',
    reasonEnrollment: '',
    observations: '',
    photos: [] as number[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createChildMutation = useMutation({
    mutationFn: (data: ChildCreate) => childrenApi.createChild(familyIdNum, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['children', familyIdNum] });
      navigate(`/families/${familyId}/children/${data.id}`);
    },
    onError: (error) => {
      console.error('Failed to create child:', error);
      setErrors({ submit: 'Failed to create child. Please try again.' });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    let processedValue: any = value;
    if (type === 'number') {
      processedValue = value === '' ? '' : Number(value);
    } else {
      processedValue = value === '' ? '' : value;
    }

    setFormData(prev => ({ ...prev, [name]: processedValue }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const payload = {
        name: formData.name,
        birthDate: new Date(formData.birthDate).toISOString(),
        sex: formData.sex,
        weight: Number(formData.weight) || 0,
        nutritionalState: formData.nutritionalState || null,
        reasonEnrollment: formData.reasonEnrollment || null,
        observations: formData.observations || null,
        photos: formData.photos,
        dateEntered: new Date().toISOString(),
      };

      // Validate with schema minus familyId (backend gets it from URL)
      const validatedData = ChildCreateSchema.omit({ familyId: true }).parse(payload);
      createChildMutation.mutate({ ...validatedData, familyId: familyIdNum });
    } catch (error: any) {
      const fieldErrors: Record<string, string> = {};
      if (error.errors) {
        error.errors.forEach((err: any) => {
          if (err.path?.[0]) {
            fieldErrors[err.path[0]] = err.message;
          }
        });
      }
      setErrors(fieldErrors);
    }
  };

  if (!familyIdNum) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-hv-crisis">Invalid family ID</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-serif font-bold text-hv-charcoal">{t('families.add_child')}</h1>
        <Link
          to={`/families/${familyId}`}
          className="text-hv-terracotta hover:underline transition-colors"
        >
          &larr; Back to Family
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-hv-border space-y-6">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-hv-charcoal mb-2">
            Name <span className="text-red-500">*</span>
          </label>
          <NameInput
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
            placeholder="Enter child's name"
            maxLength={256}
            required
          />
          {errors.name && <p className="text-hv-crisis text-sm mt-1">{errors.name}</p>}
        </div>

        {/* Birth Date */}
        <div>
          <label htmlFor="birthDate" className="block text-sm font-medium text-hv-charcoal mb-2">
            Birth Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="birthDate"
            name="birthDate"
            value={formData.birthDate}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
            required
          />
          {errors.birthDate && <p className="text-hv-crisis text-sm mt-1">{errors.birthDate}</p>}
        </div>

        {/* Sex */}
        <div>
          <label htmlFor="sex" className="block text-sm font-medium text-hv-charcoal mb-2">
            Sex <span className="text-red-500">*</span>
          </label>
          <select
            id="sex"
            name="sex"
            value={formData.sex}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
          >
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
        </div>

        {/* Weight */}
        <div>
          <label htmlFor="weight" className="block text-sm font-medium text-hv-charcoal mb-2">
            Weight (kg)
          </label>
          <input
            type="number"
            id="weight"
            name="weight"
            value={formData.weight}
            onChange={handleInputChange}
            onFocus={(e) => { if (Number(e.target.value) === 0) setFormData(prev => ({ ...prev, weight: '' as unknown as number })); }}
            onBlur={(e) => { if (e.target.value === '') setFormData(prev => ({ ...prev, weight: 0 })); }}
            min="0"
            step="0.1"
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
            placeholder="Weight in kg"
          />
          {errors.weight && <p className="text-hv-crisis text-sm mt-1">{errors.weight}</p>}
        </div>

        {/* Nutritional State */}
        <div>
          <label htmlFor="nutritionalState" className="block text-sm font-medium text-hv-charcoal mb-2">
            Nutritional State
          </label>
          <input
            type="text"
            id="nutritionalState"
            name="nutritionalState"
            value={formData.nutritionalState}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
            placeholder="e.g. Normal, Malnourished"
            maxLength={512}
          />
        </div>

        {/* Reason for Enrollment */}
        <div>
          <label htmlFor="reasonEnrollment" className="block text-sm font-medium text-hv-charcoal mb-2">
            Reason for Enrollment
          </label>
          <textarea
            id="reasonEnrollment"
            name="reasonEnrollment"
            value={formData.reasonEnrollment}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
            placeholder="Reason for enrolling the child"
          />
        </div>

        {/* Observations */}
        <div>
          <label htmlFor="observations" className="block text-sm font-medium text-hv-charcoal mb-2">
            Observations
          </label>
          <textarea
            id="observations"
            name="observations"
            value={formData.observations}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
            placeholder="Any observations"
          />
        </div>

        {/* Photos */}
        <PhotoUpload
          photos={formData.photos}
          onChange={(photos) => setFormData(prev => ({ ...prev, photos }))}
        />

        {/* Submit Error */}
        {errors.submit && (
          <div className="bg-red-50 border border-red-300 rounded-md p-3">
            <p className="text-red-700">{errors.submit}</p>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end space-x-4 pt-4 border-t border-hv-border">
          <Link
            to={`/families/${familyId}`}
            className="px-4 py-2 text-hv-sage hover:text-hv-charcoal transition-colors"
          >
            {t('common.cancel')}
          </Link>
          <button
            type="submit"
            disabled={createChildMutation.isPending}
            className="px-6 py-2 bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createChildMutation.isPending ? t('common.creating') : t('common.add_child')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddChildPage;
