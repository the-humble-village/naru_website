import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FamilyCreate, FamilyCreateSchema } from '@naru/shared';
import { familiesApi } from '../../api/families';
import { adminApi } from '../../api/admin';
import { NameInput } from '../../components';
import { useTranslation } from '../../hooks';

/**
 * AddFamilyPage - Form to create a new family
 */
export const AddFamilyPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [formData, setFormData] = useState<FamilyCreate>({
    familyName: null,
    inCrisis: false,
    notes: null,
    communityId: null,
    phone: null,
    caretaker2Name: null,
    incomeSources: null,
    deathsNotes: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch lookup data for selectors
  const { data: communities = [], isLoading: loadingCommunities } = useQuery({
    queryKey: ['communities'],
    queryFn: adminApi.fetchCommunities,
  });

  // Create family mutation
  const createFamilyMutation = useMutation({
    mutationFn: familiesApi.createFamily,
    onSuccess: (data) => {
      navigate(`/families/${data.id}`);
    },
    onError: (error) => {
      console.error('Failed to create family:', error);
      setErrors({ submit: 'Failed to create family. Please try again.' });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    let processedValue: any = value;

    if (type === 'checkbox') {
      processedValue = (e.target as HTMLInputElement).checked;
    } else if (type === 'number') {
      processedValue = value === '' ? '' : Number(value);
    } else if (e.target.tagName === 'SELECT') {
      // For select elements, convert empty strings to null for nullable fields
      if (name === 'communityId') {
        processedValue = value === '' ? null : Number(value);
      } else {
        processedValue = value === '' ? null : value;
      }
    } else {
      // For text inputs and textareas
      processedValue = value === '' ? null : value;
    }

    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));

    // Clear errors when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      // Validate form data with Zod schema
      const validatedData = FamilyCreateSchema.parse(formData);
      createFamilyMutation.mutate(validatedData);
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

  const isLoading = loadingCommunities;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-hv-gray">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-serif font-bold text-hv-charcoal">{t('add_family.title')}</h1>
        <Link
          to="/families"
          className="text-hv-terracotta hover:underline transition-colors"
        >
          ← Back to Families
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-hv-border space-y-6">
        {/* Family Name */}
        <div>
          <label htmlFor="familyName" className="block text-sm font-medium text-hv-charcoal mb-2">
            {t('families.col_name')}
          </label>
          <NameInput
            id="familyName"
            name="familyName"
            value={formData.familyName || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
            placeholder="Enter family name"
            maxLength={512}
          />
          {errors.familyName && (
            <p className="text-hv-crisis text-sm mt-1">{errors.familyName}</p>
          )}
        </div>

        {/* Community */}
        <div>
          <label htmlFor="communityId" className="block text-sm font-medium text-hv-charcoal mb-2">
            {t('families.col_community')}
          </label>
          <select
            id="communityId"
            name="communityId"
            value={formData.communityId || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
          >
            <option value="">Select a community</option>
            {communities.map((community) => (
              <option key={community.id} value={community.id}>
                {community.title}
              </option>
            ))}
          </select>
          {errors.communityId && (
            <p className="text-hv-crisis text-sm mt-1">{errors.communityId}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-hv-charcoal mb-2">
            Phone
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone || ''}
            onChange={handleInputChange}
            maxLength={64}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
          />
          {errors.phone && (
            <p className="text-hv-crisis text-sm mt-1">{errors.phone}</p>
          )}
        </div>

        {/* Second caretaker */}
        <div>
          <label htmlFor="caretaker2Name" className="block text-sm font-medium text-hv-charcoal mb-2">
            Second caretaker
          </label>
          <NameInput
            id="caretaker2Name"
            name="caretaker2Name"
            value={formData.caretaker2Name || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
            maxLength={256}
          />
          {errors.caretaker2Name && (
            <p className="text-hv-crisis text-sm mt-1">{errors.caretaker2Name}</p>
          )}
        </div>

        {/* Income sources */}
        <div>
          <label htmlFor="incomeSources" className="block text-sm font-medium text-hv-charcoal mb-2">
            Income sources
          </label>
          <textarea
            id="incomeSources"
            name="incomeSources"
            value={formData.incomeSources || ''}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
          />
          {errors.incomeSources && (
            <p className="text-hv-crisis text-sm mt-1">{errors.incomeSources}</p>
          )}
        </div>

        {/* In Crisis */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="inCrisis"
            name="inCrisis"
            checked={formData.inCrisis}
            onChange={handleInputChange}
            className="h-4 w-4 text-hv-accent focus:ring-hv-accent border-hv-border-input rounded"
          />
          <label htmlFor="inCrisis" className="ml-2 text-sm font-medium text-hv-green">
            Family is in crisis
          </label>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-hv-charcoal mb-2">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes || ''}
            onChange={handleInputChange}
            rows={4}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
            placeholder="Enter any notes about the family"
          />
          {errors.notes && (
            <p className="text-hv-crisis text-sm mt-1">{errors.notes}</p>
          )}
        </div>

        {/* Submit Error */}
        {errors.submit && (
          <div className="bg-red-50 border border-red-300 rounded-md p-3">
            <p className="text-red-700">{errors.submit}</p>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end space-x-4 pt-4 border-t border-hv-border">
          <Link
            to="/families"
            className="px-4 py-2 text-hv-sage hover:text-hv-charcoal transition-colors"
          >
            {t('common.cancel')}
          </Link>
          <button
            type="submit"
            disabled={createFamilyMutation.isPending}
            className="px-6 py-2 bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createFamilyMutation.isPending ? t('common.creating') : t('common.create_family')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddFamilyPage;
