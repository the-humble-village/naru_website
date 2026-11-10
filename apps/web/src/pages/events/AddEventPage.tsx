import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { EventCreateSchema } from '@naru/shared';
import { eventsApi } from '../../api/events';
import { FormField, PageHeader } from '../../components';
import { parseZodErrors, useTranslation } from '../../hooks';

interface EventFormData {
  name: string;
  eventDate: string;
  notes: string;
}

const todayDateOnly = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

const getErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

export const AddEventPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [formData, setFormData] = useState<EventFormData>({
    name: '',
    eventDate: todayDateOnly(),
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createEventMutation = useMutation({
    mutationFn: eventsApi.createEvent,
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      navigate(`/events/${event.id}`);
    },
    onError: (err) => {
      setSubmitError(getErrorMessage(err, t('events.create_error')));
    },
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);

    const parsed = EventCreateSchema.safeParse({
      name: formData.name.trim(),
      eventDate: formData.eventDate,
      notes: formData.notes.trim() || null,
    });

    if (!parsed.success) {
      setErrors(parseZodErrors(parsed.error));
      return;
    }

    createEventMutation.mutate(parsed.data);
  };

  return (
    <div>
      <PageHeader
        title={t('add_event.title')}
        backTo="/events"
        backLabel={t('events.back_to_events')}
      />

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-xl border border-hv-border space-y-6 max-w-2xl"
      >
        <FormField
          label={t('events.field_name')}
          name="name"
          value={formData.name}
          onChange={handleChange}
          error={errors.name}
          required
          maxLength={256}
          placeholder={t('events.name_placeholder')}
        />

        <FormField
          label={t('events.field_date')}
          name="eventDate"
          type="date"
          value={formData.eventDate}
          onChange={handleChange}
          error={errors.eventDate}
          required
        />

        <FormField
          label={t('events.field_notes')}
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          error={errors.notes}
          rows={4}
        />

        {submitError && (
          <div className="bg-red-50 border border-red-300 rounded-md p-3">
            <p className="text-red-700">{submitError}</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-hv-border">
          <Link
            to="/events"
            className="px-4 py-2 text-hv-sage hover:text-hv-charcoal transition-colors"
          >
            {t('common.cancel')}
          </Link>
          <button
            type="submit"
            disabled={createEventMutation.isPending}
            className="px-6 py-2 bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createEventMutation.isPending ? t('common.creating') : t('events.create')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddEventPage;
