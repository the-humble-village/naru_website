import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ParentCreate, ParentCreateSchema } from '@naru/shared';
import { parentsApi } from '../../api/parents';
import { PhotoUpload } from '../../components';
import { useTranslation } from '../../hooks';

/**
 * AddParentPage - Form to add a new parent to a family
 */
export const AddParentPage: React.FC = () => {
  const { id: familyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const familyIdNum = familyId ? parseInt(familyId, 10) : 0;

  const [formData, setFormData] = useState({
    name: '',
    role: '',
    birthDate: '',
    dueDate: '',
    reasonEnroll: '',
    notes: '',
    photos: [] as number[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createParentMutation = useMutation({
    mutationFn: (data: ParentCreate) => parentsApi.createParent(familyIdNum, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['parents', familyIdNum] });
      navigate(`/families/${familyId}/parents/${data.id}`);
    },
    onError: (error) => {
      console.error('Failed to create parent:', error);
      setErrors({ submit: 'Failed to create parent. Please try again.' });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const payload = {
        name: formData.name || null,
        role: formData.role || null,
        birthDate: formData.birthDate ? new Date(formData.birthDate).toISOString() : null,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
        reasonEnroll: formData.reasonEnroll || null,
        notes: formData.notes || null,
        photos: formData.photos,
        dateEntered: new Date().toISOString(),
      };

      // Validate with schema minus familyId (backend gets it from URL)
      const validatedData = ParentCreateSchema.omit({ familyId: true }).parse(payload);
      createParentMutation.mutate({ ...validatedData, familyId: familyIdNum });
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
        <h1 className="text-2xl font-serif font-bold text-hv-charcoal">Add Parent</h1>
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
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
            placeholder="Enter parent's name"
            maxLength={256}
          />
          {errors.name && <p className="text-hv-crisis text-sm mt-1">{errors.name}</p>}
        </div>

        {/* Role */}
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-hv-charcoal mb-2">
            Role
          </label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
          >
            <option value="">Select a role</option>
            <option value="mother">Mother</option>
            <option value="father">Father</option>
            <option value="caregiver">Caregiver</option>
            <option value="guardian">Guardian</option>
          </select>
        </div>

        {/* Birth Date */}
        <div>
          <label htmlFor="birthDate" className="block text-sm font-medium text-hv-charcoal mb-2">
            Birth Date
          </label>
          <input
            type="date"
            id="birthDate"
            name="birthDate"
            value={formData.birthDate}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
          />
        </div>

        {/* Due Date */}
        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium text-hv-charcoal mb-2">
            Due Date
          </label>
          <input
            type="date"
            id="dueDate"
            name="dueDate"
            value={formData.dueDate}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
          />
        </div>

        {/* Reason for Enrollment */}
        <div>
          <label htmlFor="reasonEnroll" className="block text-sm font-medium text-hv-charcoal mb-2">
            Reason for Enrollment
          </label>
          <textarea
            id="reasonEnroll"
            name="reasonEnroll"
            value={formData.reasonEnroll}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
            placeholder="Reason for enrolling"
          />
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-hv-charcoal mb-2">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
            placeholder="Any notes about this parent"
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
            disabled={createParentMutation.isPending}
            className="px-6 py-2 bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createParentMutation.isPending ? t('common.creating') : t('common.add_parent')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddParentPage;
