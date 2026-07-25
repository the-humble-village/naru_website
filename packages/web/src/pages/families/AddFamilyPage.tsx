import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FamilyCreate, FamilyCreateSchema } from '@naru/shared';
import { familiesApi } from '../../api/families';
import { adminApi } from '../../api/admin';
import { birthingAssistantsApi } from '../../api/birthing-assistants';
import { PhotoUpload } from '../../components';

/**
 * AddFamilyPage - Form to create a new family
 */
export const AddFamilyPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FamilyCreate>({
    familyName: null,
    childrenEditable: 0,
    inCrisis: false,
    notes: null,
    communityId: null,
    siteId: null,
    birthingAssistantId: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch lookup data for selectors
  const { data: communities = [], isLoading: loadingCommunities } = useQuery({
    queryKey: ['communities'],
    queryFn: adminApi.fetchCommunities,
  });

  const { data: sites = [], isLoading: loadingSites } = useQuery({
    queryKey: ['sites'],
    queryFn: adminApi.fetchSites,
  });

  const { data: birthingAssistants = [], isLoading: loadingBAs } = useQuery({
    queryKey: ['birthing-assistants'],
    queryFn: birthingAssistantsApi.fetchBirthingAssistants,
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
      if (['communityId', 'siteId', 'birthingAssistantId'].includes(name)) {
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
      const validatedData = FamilyCreateSchema.parse({
        ...formData,
        childrenEditable: Number(formData.childrenEditable) || 0,
      });
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

  const isLoading = loadingCommunities || loadingSites || loadingBAs;

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
        <h1 className="text-2xl font-serif font-bold text-hv-charcoal">Add Family</h1>
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
            Family Name
          </label>
          <input
            type="text"
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
            Community
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

        {/* Site */}
        <div>
          <label htmlFor="siteId" className="block text-sm font-medium text-hv-charcoal mb-2">
            Site
          </label>
          <select
            id="siteId"
            name="siteId"
            value={formData.siteId || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
          >
            <option value="">Select a site</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.title}
              </option>
            ))}
          </select>
          {errors.siteId && (
            <p className="text-hv-crisis text-sm mt-1">{errors.siteId}</p>
          )}
        </div>

        {/* Birthing Assistant */}
        <div>
          <label htmlFor="birthingAssistantId" className="block text-sm font-medium text-hv-charcoal mb-2">
            Birthing Assistant
          </label>
          <select
            id="birthingAssistantId"
            name="birthingAssistantId"
            value={formData.birthingAssistantId || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
          >
            <option value="">Select a birthing assistant</option>
            {birthingAssistants.map((ba) => (
              <option key={ba.id} value={ba.id}>
                {ba.name}
              </option>
            ))}
          </select>
          {errors.birthingAssistantId && (
            <p className="text-hv-crisis text-sm mt-1">{errors.birthingAssistantId}</p>
          )}
        </div>

        {/* Children Editable */}
        <div>
          <label htmlFor="childrenEditable" className="block text-sm font-medium text-hv-charcoal mb-2">
            Children Editable Count
          </label>
          <input
            type="number"
            id="childrenEditable"
            name="childrenEditable"
            value={formData.childrenEditable}
            onChange={handleInputChange}
            onFocus={(e) => { if (Number(e.target.value) === 0) setFormData(prev => ({ ...prev, childrenEditable: '' as unknown as number })); }}
            onBlur={(e) => { if (e.target.value === '') setFormData(prev => ({ ...prev, childrenEditable: 0 })); }}
            min="0"
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
          />
          {errors.childrenEditable && (
            <p className="text-hv-crisis text-sm mt-1">{errors.childrenEditable}</p>
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

        {/* Photos */}
        <PhotoUpload
          photos={formData.photos ?? []}
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
            to="/families"
            className="px-4 py-2 text-hv-sage hover:text-hv-charcoal transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createFamilyMutation.isPending}
            className="px-6 py-2 bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createFamilyMutation.isPending ? 'Creating...' : 'Create Family'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddFamilyPage;
