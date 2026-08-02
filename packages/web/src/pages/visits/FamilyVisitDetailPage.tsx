import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import {
  FamilyVisitRead,
  FamilyVisitUpdate,
  FamilyVisitQuestion,
  TrainingReceived,
  ResourceReceived,
} from '@naru/shared';
import { visitsApi } from '../../api/visits';
import { adminApi } from '../../api/admin';
import { questionSetsApi } from '../../api/question-sets';
import { VisitQuestionsPanel } from './VisitQuestionsPanel';
import { PhotoUpload, PhotoGallery, ConfirmDialog, RoleGate } from '../../components';
import { usePendingPhotoDeletions } from '../../hooks';
import { toDateTimeLocal, fromDateTimeLocal } from '../../utils/datetime';

/** Local shape of the inline edit form (visitDate held as a datetime-local value). */
interface VisitEditData {
  visitDate: string;
  trainingsReceived: TrainingReceived[];
  resourcesReceived: ResourceReceived[];
  questions: FamilyVisitQuestion[];
  photos: number[];
  notes: string;
}

const emptyEditData: VisitEditData = {
  visitDate: '',
  trainingsReceived: [],
  resourcesReceived: [],
  questions: [],
  photos: [],
  notes: '',
};

/**
 * FamilyVisitDetailPage - Shows a single family visit, with inline editing of every
 * field (including question answers) and a supervisor-gated delete.
 */
export const FamilyVisitDetailPage: React.FC = () => {
  const { id: familyId, vid: visitId } = useParams<{ id: string; vid: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const familyIdNum = familyId ? parseInt(familyId, 10) : 0;
  const visitIdNum = visitId ? parseInt(visitId, 10) : 0;

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<VisitEditData>(emptyEditData);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const { data: visit, isLoading, isError } = useQuery<FamilyVisitRead>({
    queryKey: ['familyVisit', familyIdNum, visitIdNum],
    queryFn: () => visitsApi.fetchFamilyVisit(familyIdNum, visitIdNum),
    enabled: familyIdNum > 0 && visitIdNum > 0,
  });

  // Lookup data is only needed by the edit form.
  const { data: availableTrainings = [] } = useQuery({
    queryKey: ['training'],
    queryFn: adminApi.fetchTraining,
    enabled: isEditing,
  });

  const { data: availableResources = [] } = useQuery({
    queryKey: ['resources'],
    queryFn: adminApi.fetchResources,
    enabled: isEditing,
  });

  const { data: availableQuestions = [], isLoading: loadingQuestions } = useQuery({
    queryKey: ['family-visit-questions'],
    queryFn: adminApi.fetchFamilyVisitQuestions,
    enabled: isEditing,
  });

  const { data: questionSets = [] } = useQuery({
    queryKey: ['question-sets', 'family'],
    queryFn: () => questionSetsApi.list('family'),
    enabled: isEditing,
  });

  // Photo removals are staged until save so Cancel can undo them.
  const photoDeletions = usePendingPhotoDeletions();

  const updateVisitMutation = useMutation({
    mutationFn: (data: FamilyVisitUpdate) => visitsApi.updateFamilyVisit(familyIdNum, visitIdNum, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['familyVisit', familyIdNum, visitIdNum] });
      queryClient.invalidateQueries({ queryKey: ['familyVisits', familyIdNum] });
      setIsEditing(false);
      setEditData(emptyEditData);
      // The record saved without these photos, so it is now safe to delete the
      // files. Staged until here so cancelling the edit could undo the removal.
      void photoDeletions.commit();
    },
  });

  const deleteVisitMutation = useMutation({
    mutationFn: () => visitsApi.deleteFamilyVisit(familyIdNum, visitIdNum),
    onSuccess: () => {
      setConfirmDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ['familyVisits', familyIdNum] });
      queryClient.removeQueries({ queryKey: ['familyVisit', familyIdNum, visitIdNum] });
      navigate(`/families/${familyId}`);
    },
  });

  const handleEdit = () => {
    if (!visit) return;
    // localId is deliberately excluded — overwriting it breaks sync duplicate detection.
    setEditData({
      visitDate: toDateTimeLocal(visit.visitDate),
      trainingsReceived: visit.trainingsReceived,
      resourcesReceived: visit.resourcesReceived,
      questions: visit.questions,
      photos: visit.photos ?? [],
      notes: visit.notes ?? '',
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    photoDeletions.discard();
    setIsEditing(false);
    setEditData(emptyEditData);
  };

  const handleSave = () => {
    if (!visit) return;

    const dataToSave: FamilyVisitUpdate = {};

    if (editData.visitDate) {
      const isoVisitDate = fromDateTimeLocal(editData.visitDate);
      if (new Date(isoVisitDate).getTime() !== new Date(visit.visitDate).getTime()) {
        dataToSave.visitDate = isoVisitDate;
      }
    }
    if (JSON.stringify(editData.trainingsReceived) !== JSON.stringify(visit.trainingsReceived)) {
      dataToSave.trainingsReceived = editData.trainingsReceived;
    }
    if (JSON.stringify(editData.resourcesReceived) !== JSON.stringify(visit.resourcesReceived)) {
      dataToSave.resourcesReceived = editData.resourcesReceived;
    }
    if (JSON.stringify(editData.questions) !== JSON.stringify(visit.questions)) {
      dataToSave.questions = editData.questions;
    }
    if (JSON.stringify(editData.photos) !== JSON.stringify(visit.photos ?? [])) {
      dataToSave.photos = editData.photos;
    }
    if (editData.notes !== (visit.notes ?? '')) {
      dataToSave.notes = editData.notes || null;
    }

    updateVisitMutation.mutate(dataToSave);
  };

  const handleTrainingAdd = (trainingId: number) => {
    const training = availableTrainings.find((t) => t.id === trainingId);
    if (!training) return;
    setEditData((prev) =>
      prev.trainingsReceived.some((t) => t.id === trainingId)
        ? prev
        : { ...prev, trainingsReceived: [...prev.trainingsReceived, { id: training.id, title: training.title }] }
    );
  };

  const handleTrainingRemove = (trainingId: number) => {
    setEditData((prev) => ({
      ...prev,
      trainingsReceived: prev.trainingsReceived.filter((t) => t.id !== trainingId),
    }));
  };

  const handleResourceAdd = (resourceId: number) => {
    const resource = availableResources.find((r) => r.id === resourceId);
    if (!resource) return;
    setEditData((prev) =>
      prev.resourcesReceived.some((r) => r.id === resourceId)
        ? prev
        : { ...prev, resourcesReceived: [...prev.resourcesReceived, { id: resource.id, title: resource.title }] }
    );
  };

  const handleResourceRemove = (resourceId: number) => {
    setEditData((prev) => ({
      ...prev,
      resourcesReceived: prev.resourcesReceived.filter((r) => r.id !== resourceId),
    }));
  };

  const handleQuestionChange = (questionId: number, question: string, answer: string) => {
    setEditData((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.questionId === questionId ? { questionId, question, answer } : q)),
    }));
  };

  const handleQuestionRemove = (questionId: number) => {
    setEditData((prev) => ({ ...prev, questions: prev.questions.filter((q) => q.questionId !== questionId) }));
  };

  const addQuestion = (questionId: number, question: string) => {
    setEditData((prev) =>
      prev.questions.some((q) => q.questionId === questionId)
        ? prev
        : { ...prev, questions: [...prev.questions, { questionId, question, answer: '' }] }
    );
  };

  const applyQuestionSet = (setId: number) => {
    const set = questionSets.find((s) => s.id === setId);
    if (!set) return;
    setEditData((prev) => ({
      ...prev,
      questions: set.items.map((item) => {
        const existing = prev.questions.find((q) => q.questionId === item.questionId);
        return {
          questionId: item.questionId,
          question: item.questionTitle,
          answer: existing?.answer ?? '',
        };
      }),
    }));
  };

  if (isLoading) return <div className="text-hv-gray">Loading visit...</div>;
  if (isError || !visit) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-hv-crisis">Failed to load visit details.</p>
      </div>
    );
  }

  const deleteMessage =
    `Delete the family visit recorded on ${new Date(visit.visitDate).toLocaleDateString()}? ` +
    'Its trainings, resources, question answers, notes and photos are removed with it. This cannot be undone.';

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
        <h1 className="text-2xl font-serif font-bold text-hv-charcoal">
          Family Visit — {new Date(visit.visitDate).toLocaleDateString()}
        </h1>
        <div className="flex items-center gap-2 shrink-0">
          {!isEditing && (
            <button
              onClick={handleEdit}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-hv-border rounded-md text-hv-charcoal hover:bg-hv-page transition-colors"
            >
              <Pencil size={13} />
              Edit
            </button>
          )}
          <RoleGate requiredRole="SUPERVISOR">
            <button
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={deleteVisitMutation.isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-red-200 rounded-md text-hv-crisis hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <Trash2 size={13} />
              Delete
            </button>
          </RoleGate>
          <Link
            to={`/families/${familyId}`}
            className="text-hv-terracotta hover:underline transition-colors"
          >
            ← Back to Family
          </Link>
        </div>
      </div>

      {isEditing ? (
        /* ── Edit form ── */
        <div className="bg-white p-6 rounded-xl border border-hv-border">
          <h2 className="text-lg font-serif font-semibold text-hv-charcoal mb-4">Edit Family Visit</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="space-y-6"
          >
            <div>
              <label htmlFor="visitDate" className="block text-sm font-medium text-hv-charcoal mb-1">
                Visit Date
              </label>
              <input
                type="datetime-local"
                id="visitDate"
                value={editData.visitDate}
                onChange={(e) => setEditData({ ...editData, visitDate: e.target.value })}
                className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-green"
                required
              />
            </div>

            {/* Trainings */}
            <div>
              <label htmlFor="addTraining" className="block text-sm font-medium text-hv-charcoal mb-2">
                Trainings Received
              </label>
              <div className="mb-4">
                <select
                  id="addTraining"
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
                    .filter((t) => !editData.trainingsReceived.some((ft) => ft.id === t.id))
                    .map((training) => (
                      <option key={training.id} value={training.id}>{training.title}</option>
                    ))}
                </select>
              </div>
              <div className="space-y-2">
                {editData.trainingsReceived.map((training) => (
                  <div key={training.id} className="flex items-center justify-between bg-hv-page border border-hv-border rounded-md px-3 py-2">
                    <span className="text-sm">{training.title}</span>
                    <button
                      type="button"
                      onClick={() => handleTrainingRemove(training.id)}
                      aria-label={`Remove training ${training.title}`}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Resources */}
            <div>
              <label htmlFor="addResource" className="block text-sm font-medium text-hv-charcoal mb-2">
                Resources Received
              </label>
              <div className="mb-4">
                <select
                  id="addResource"
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
                    .filter((r) => !editData.resourcesReceived.some((fr) => fr.id === r.id))
                    .map((resource) => (
                      <option key={resource.id} value={resource.id}>{resource.title}</option>
                    ))}
                </select>
              </div>
              <div className="space-y-2">
                {editData.resourcesReceived.map((resource) => (
                  <div key={resource.id} className="flex items-center justify-between bg-hv-page border border-hv-border rounded-md px-3 py-2">
                    <span className="text-sm">{resource.title}</span>
                    <button
                      type="button"
                      onClick={() => handleResourceRemove(resource.id)}
                      aria-label={`Remove resource ${resource.title}`}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Question answers */}
            <VisitQuestionsPanel
              questionSets={questionSets}
              availableQuestions={availableQuestions}
              loadingQuestions={loadingQuestions}
              questions={editData.questions}
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
                rows={4}
                value={editData.notes}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-green"
                placeholder="Additional notes about the visit..."
              />
            </div>

            {/* Photos */}
            <PhotoUpload
              photos={editData.photos}
              onChange={(photos) => setEditData((prev) => ({ ...prev, photos }))}
              pendingDeletions={photoDeletions}
            />

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={updateVisitMutation.isPending}
                className="bg-hv-terracotta text-white px-4 py-2 rounded-md text-sm hover:bg-hv-terracotta-hover transition-colors disabled:opacity-50"
              >
                {updateVisitMutation.isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={updateVisitMutation.isPending}
                className="px-4 py-2 border border-hv-border rounded-md text-sm text-hv-charcoal hover:bg-hv-page transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            {updateVisitMutation.isError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-hv-crisis text-sm">
                  Error saving visit: {updateVisitMutation.error instanceof Error ? updateVisitMutation.error.message : 'Unknown error'}
                </p>
              </div>
            )}
          </form>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Visit info strip */}
          <div className="bg-white rounded-xl border border-hv-border">
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-hv-border">
              <div className="px-5 py-4">
                <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">Visit Date</div>
                <div className="text-sm font-medium text-hv-charcoal">
                  {new Date(visit.visitDate).toLocaleString()}
                </div>
              </div>
              <div className="px-5 py-4">
                <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">Recorded</div>
                <div className="text-sm font-medium text-hv-charcoal">
                  {new Date(visit.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Trainings */}
            <div className="bg-white rounded-xl border border-hv-border">
              <div className="px-5 py-3 border-b border-hv-border">
                <h2 className="text-sm font-semibold text-hv-charcoal">Trainings Received</h2>
              </div>
              {visit.trainingsReceived.length > 0 ? (
                <ul className="divide-y divide-hv-border">
                  {visit.trainingsReceived.map((t) => (
                    <li key={t.id} className="px-5 py-2.5 text-sm text-hv-charcoal">{t.title}</li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-4 text-sm text-hv-sage">None recorded</p>
              )}
            </div>

            {/* Resources */}
            <div className="bg-white rounded-xl border border-hv-border">
              <div className="px-5 py-3 border-b border-hv-border">
                <h2 className="text-sm font-semibold text-hv-charcoal">Resources Received</h2>
              </div>
              {visit.resourcesReceived.length > 0 ? (
                <ul className="divide-y divide-hv-border">
                  {visit.resourcesReceived.map((r) => (
                    <li key={r.id} className="px-5 py-2.5 text-sm text-hv-charcoal">{r.title}</li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-4 text-sm text-hv-sage">None recorded</p>
              )}
            </div>
          </div>

          {/* Questions */}
          {visit.questions && visit.questions.length > 0 && (
            <div className="bg-white rounded-xl border border-hv-border">
              <div className="px-5 py-3 border-b border-hv-border">
                <h2 className="text-sm font-semibold text-hv-charcoal">Visit Questions</h2>
              </div>
              <div className="divide-y divide-hv-border">
                {visit.questions.map((q) => (
                  <div key={q.questionId} className="px-5 py-3">
                    <div className="text-xs font-medium text-hv-sage mb-0.5">{q.question}</div>
                    <div className="text-sm text-hv-charcoal">{q.answer || <span className="italic text-hv-sage">No answer</span>}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {visit.notes && (
            <div className="bg-white rounded-xl border border-hv-border p-5">
              <h2 className="text-sm font-semibold text-hv-charcoal mb-2">Notes</h2>
              <p className="text-sm text-hv-charcoal whitespace-pre-wrap">{visit.notes}</p>
            </div>
          )}

          {/* Photos */}
          {visit.photos && visit.photos.length > 0 && (
            <PhotoGallery photos={visit.photos} />
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete family visit"
        message={deleteMessage}
        warning={
          deleteVisitMutation.isError
            ? 'Failed to delete this visit. Please try again.'
            : undefined
        }
        busy={deleteVisitMutation.isPending}
        onConfirm={() => deleteVisitMutation.mutate()}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
};

export default FamilyVisitDetailPage;
