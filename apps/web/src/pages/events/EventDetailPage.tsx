import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { EventUpdate, EventWithCount, VisitListItem } from '@naru/shared';
import { EventUpdateSchema } from '@naru/shared';
import { eventsApi } from '../../api/events';
import { visitsApi } from '../../api/visits';
import {
  ConfirmDialog,
  EmptyState,
  FormField,
  LoadingState,
  PageHeader,
  RoleGate,
  StatStrip,
  SubjectTypeBadge,
} from '../../components';
import { parseZodErrors, useTranslation } from '../../hooks';
import { formatDateUTC } from '../../utils/datetime';

interface EventEditForm {
  name: string;
  eventDate: string;
  notes: string;
}

const TH = 'px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider';
const TD = 'px-6 py-4 text-sm text-hv-charcoal';

const getErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

export const EventDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const eventId = id ? parseInt(id, 10) : 0;

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<EventEditForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {
    data: event,
    isLoading,
    error,
  } = useQuery<EventWithCount>({
    queryKey: ['event', eventId],
    queryFn: () => eventsApi.fetchEvent(eventId),
    enabled: eventId > 0,
  });

  const { data: visitsData, isLoading: visitsLoading } = useQuery({
    queryKey: ['visits', { eventId }],
    queryFn: () => visitsApi.listVisits({ eventId, limit: 100 }),
    enabled: eventId > 0,
  });

  const updateEventMutation = useMutation({
    mutationFn: (data: EventUpdate) => eventsApi.updateEvent(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setIsEditing(false);
      setEditData(null);
    },
    onError: (err) => {
      setSaveError(getErrorMessage(err, t('events.save_error')));
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: () => eventsApi.deleteEvent(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.removeQueries({ queryKey: ['event', eventId] });
      setConfirmDeleteOpen(false);
      navigate('/events');
    },
    onError: (err) => {
      setDeleteError(getErrorMessage(err, t('events.delete_error')));
    },
  });

  const startEdit = () => {
    if (!event) return;
    setErrors({});
    setSaveError(null);
    setEditData({
      name: event.name,
      eventDate: event.eventDate,
      notes: event.notes ?? '',
    });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditData(null);
    setErrors({});
    setSaveError(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditData((prev) => (prev ? { ...prev, [name]: value } : prev));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData || !event) return;
    setErrors({});
    setSaveError(null);

    const parsed = EventUpdateSchema.safeParse({
      name: editData.name.trim(),
      eventDate: editData.eventDate,
      notes: editData.notes.trim() || null,
    });

    if (!parsed.success) {
      setErrors(parseZodErrors(parsed.error));
      return;
    }

    updateEventMutation.mutate(parsed.data);
  };

  if (isLoading) {
    return <LoadingState message={t('common.loading')} />;
  }

  if (error || !event) {
    return (
      <div className="bg-red-50 border border-red-300 rounded-md p-4">
        <p className="text-red-700">{t('events.not_found')}</p>
      </div>
    );
  }

  const visits: VisitListItem[] = visitsData?.items ?? [];

  return (
    <div>
      <PageHeader
        title={event.name}
        backTo="/events"
        backLabel={t('events.back_to_events')}
        actions={
          !isEditing ? (
            <>
              <button
                type="button"
                onClick={startEdit}
                className="px-4 py-2 text-sm border border-hv-border rounded-md text-hv-charcoal hover:bg-hv-page transition-colors"
              >
                {t('common.edit')}
              </button>
              <RoleGate requiredRole="SUPERVISOR">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setConfirmDeleteOpen(true);
                  }}
                  className="px-4 py-2 text-sm rounded-md bg-hv-crisis text-white hover:bg-red-800 transition-colors"
                >
                  {t('common.delete')}
                </button>
              </RoleGate>
            </>
          ) : undefined
        }
      />

      {isEditing && editData ? (
        <form
          onSubmit={handleSave}
          className="bg-white p-6 rounded-xl border border-hv-border space-y-6 max-w-2xl mb-6"
        >
          <FormField
            label={t('events.field_name')}
            name="name"
            value={editData.name}
            onChange={handleChange}
            error={errors.name}
            required
            maxLength={256}
          />
          <FormField
            label={t('events.field_date')}
            name="eventDate"
            type="date"
            value={editData.eventDate}
            onChange={handleChange}
            error={errors.eventDate}
            required
          />
          <FormField
            label={t('events.field_notes')}
            name="notes"
            value={editData.notes}
            onChange={handleChange}
            error={errors.notes}
            rows={4}
          />

          {saveError && (
            <div className="bg-red-50 border border-red-300 rounded-md p-3">
              <p className="text-red-700">{saveError}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-hv-border">
            <button
              type="button"
              onClick={cancelEdit}
              className="px-4 py-2 text-hv-sage hover:text-hv-charcoal transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={updateEventMutation.isPending}
              className="px-6 py-2 bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateEventMutation.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white p-6 rounded-xl border border-hv-border space-y-4 mb-6">
          <div>
            <p className="text-sm font-medium text-hv-gray">{t('events.field_date')}</p>
            <p className="text-hv-charcoal">{formatDateUTC(event.eventDate)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-hv-gray">{t('events.field_notes')}</p>
            <p className="text-hv-charcoal whitespace-pre-line">
              {event.notes || t('events.no_notes')}
            </p>
          </div>
        </div>
      )}

      <StatStrip
        className="mb-6"
        stats={[{ label: t('events.visits_recorded'), value: event.visitCount }]}
      />

      <div className="bg-white rounded-xl border border-hv-border overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-hv-border">
          <h2 className="text-lg font-serif font-semibold text-hv-charcoal">
            {t('events.visits_section')}
          </h2>
        </div>

        {visitsLoading && <LoadingState message={t('common.loading')} />}

        {!visitsLoading && visits.length === 0 && (
          <div className="p-6">
            <EmptyState message={t('events.visits_empty')} />
          </div>
        )}

        {!visitsLoading && visits.length > 0 && (
          <>
            <table className="hidden md:table min-w-full divide-y divide-hv-border">
              <thead className="bg-hv-page">
                <tr>
                  <th className={TH}>{t('events.col_date')}</th>
                  <th className={TH}>{t('events.col_subject')}</th>
                  <th className={TH}>{t('events.col_program')}</th>
                  <th className={TH}>{t('events.col_recorded_by')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hv-border">
                {visits.map((visit) => (
                  <tr key={visit.id} className="hover:bg-hv-page">
                    <td className={`${TD} whitespace-nowrap`}>
                      <Link
                        to={`/visits/${visit.id}`}
                        className="text-hv-terracotta hover:underline transition-colors"
                      >
                        {formatDateUTC(visit.visitDate)}
                      </Link>
                    </td>
                    <td className={TD}>
                      <span className="mr-2">{visit.subjectName || t('common.unnamed')}</span>
                      <SubjectTypeBadge type={visit.program.subjectType} />
                    </td>
                    <td className={TD}>{visit.program.name}</td>
                    <td className={TD}>{visit.recordedByName || t('common.unknown')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="md:hidden divide-y divide-hv-border">
              {visits.map((visit) => (
                <li key={visit.id} className="p-4">
                  <Link
                    to={`/visits/${visit.id}`}
                    className="font-medium text-hv-terracotta hover:underline transition-colors"
                  >
                    {visit.subjectName || t('common.unnamed')}
                  </Link>
                  <div className="mt-1">
                    <SubjectTypeBadge type={visit.program.subjectType} />
                  </div>
                  <p className="text-sm text-hv-gray mt-1">{formatDateUTC(visit.visitDate)}</p>
                  <p className="text-sm text-hv-gray">{visit.program.name}</p>
                  <p className="text-sm text-hv-gray">
                    {visit.recordedByName || t('common.unknown')}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl border border-hv-border">
        <button
          type="button"
          disabled
          title={t('events.attendance_deferred')}
          className="px-4 py-2 text-sm border border-hv-border rounded-md text-hv-charcoal opacity-50 cursor-not-allowed"
        >
          {t('events.attendance_button')}
        </button>
        <p className="text-sm text-hv-gray mt-2">{t('events.attendance_deferred')}</p>
      </div>

      {confirmDeleteOpen && (
        <ConfirmDialog
          open
          title={t('events.delete_title')}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          busy={deleteEventMutation.isPending}
          message={
            <div className="space-y-2">
              <p className="font-medium text-hv-charcoal">{event.name}</p>
              <p>{t('events.delete_message')}</p>
              {deleteError && <p className="text-hv-crisis font-medium">{deleteError}</p>}
            </div>
          }
          onConfirm={() => deleteEventMutation.mutate()}
          onCancel={() => {
            setConfirmDeleteOpen(false);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
};

export default EventDetailPage;
