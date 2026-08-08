import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ChildVisitQuestion, type ChildVisitRead, type ChildVisitUpdate } from '@naru/shared';
import { Trash2 } from 'lucide-react';
import { visitsApi } from '../../api/visits';
import { childrenApi } from '../../api/children';
import { adminApi } from '../../api/admin';
import { questionSetsApi } from '../../api/question-sets';
import { VisitQuestionsPanel } from './VisitQuestionsPanel';
import { PhotoGallery, PhotoUpload, ConfirmDialog, RoleGate } from '../../components';
import { usePendingPhotoDeletions, useTranslation } from '../../hooks';
import { toDateTimeLocal, fromDateTimeLocal } from '../../utils/datetime';

/**
 * Inline edit form state. Numeric measurements are held as strings so the inputs can be
 * cleared without coercing to 0 mid-typing; they are converted on save.
 */
interface ChildVisitEditForm {
  visitDate: string; // datetime-local ("YYYY-MM-DDTHH:mm"), local time
  weight: string;
  armCircumference: string;
  height: string;
  incap: boolean;
  leche: boolean;
  bagsGiven: string;
  recvAnyMedicine: string;
  leftFromProg: string;
  passedAway: string;
  questions: ChildVisitQuestion[];
  photos: number[];
  notes: string;
}

const buildEditForm = (visit: ChildVisitRead): ChildVisitEditForm => ({
  visitDate: toDateTimeLocal(visit.visitDate),
  weight: String(visit.weight ?? 0),
  armCircumference: String(visit.armCircumference ?? 0),
  height: String(visit.height ?? 0),
  incap: visit.incap,
  leche: visit.leche,
  bagsGiven: visit.bagsGiven ?? '',
  recvAnyMedicine: visit.recvAnyMedicine ?? '',
  leftFromProg: visit.leftFromProg ?? '',
  passedAway: visit.passedAway ?? '',
  questions: visit.questions ?? [],
  photos: visit.photos ?? [],
  notes: visit.notes ?? '',
});

export const ChildVisitDetailPage: React.FC = () => {
  const { id: familyId, cid: childId, vid: visitId } = useParams<{ id: string; cid: string; vid: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const familyIdNum = familyId ? parseInt(familyId, 10) : 0;
  const childIdNum = childId ? parseInt(childId, 10) : 0;
  const visitIdNum = visitId ? parseInt(visitId, 10) : 0;
  const hasValidIds = familyIdNum > 0 && childIdNum > 0 && visitIdNum > 0;

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<ChildVisitEditForm | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const { data: visit, isLoading, isError } = useQuery({
    queryKey: ['child-visit', familyIdNum, childIdNum, visitIdNum],
    queryFn: () => visitsApi.fetchChildVisit(familyIdNum, childIdNum, visitIdNum),
    enabled: hasValidIds,
  });

  const { data: child } = useQuery({
    queryKey: ['child', familyIdNum, childIdNum],
    queryFn: () => childrenApi.fetchChild(familyIdNum, childIdNum),
    enabled: familyIdNum > 0 && childIdNum > 0,
  });

  const { data: availableQuestions = [], isLoading: loadingQuestions } = useQuery({
    queryKey: ['child-visit-questions'],
    queryFn: adminApi.fetchChildVisitQuestions,
    enabled: hasValidIds && isEditing,
  });

  const { data: questionSets = [] } = useQuery({
    queryKey: ['question-sets', 'child'],
    queryFn: () => questionSetsApi.list('child'),
    enabled: hasValidIds && isEditing,
  });

  const invalidateVisitQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['child-visits', familyIdNum, childIdNum] });
    queryClient.invalidateQueries({ queryKey: ['child', familyIdNum, childIdNum] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  // Photo removals are staged until save so Cancel can undo them.
  const photoDeletions = usePendingPhotoDeletions();

  const updateVisitMutation = useMutation({
    mutationFn: (data: ChildVisitUpdate) =>
      visitsApi.updateChildVisit(familyIdNum, childIdNum, visitIdNum, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['child-visit', familyIdNum, childIdNum, visitIdNum] });
      invalidateVisitQueries();
      setIsEditing(false);
      setEditData(null);
      // The record saved without these photos, so it is now safe to delete the
      // files. Staged until here so cancelling the edit could undo the removal.
      void photoDeletions.commit();
    },
  });

  const deleteVisitMutation = useMutation({
    mutationFn: () => visitsApi.deleteChildVisit(familyIdNum, childIdNum, visitIdNum),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['child-visit', familyIdNum, childIdNum, visitIdNum] });
      invalidateVisitQueries();
      setConfirmDeleteOpen(false);
      navigate(`/families/${familyIdNum}/children/${childIdNum}`);
    },
  });

  const handleEdit = () => {
    if (!visit) return;
    setEditData(buildEditForm(visit));
    setIsEditing(true);
  };

  const handleCancel = () => {
    photoDeletions.discard();
    setIsEditing(false);
    setEditData(null);
  };

  const handleQuestionChange = (questionId: number, question: string, answer: string) => {
    setEditData((prev) =>
      prev
        ? {
            ...prev,
            questions: [...prev.questions.filter((q) => q.questionId !== questionId), { questionId, question, answer }],
          }
        : prev,
    );
  };

  const handleQuestionRemove = (questionId: number) => {
    setEditData((prev) =>
      prev ? { ...prev, questions: prev.questions.filter((q) => q.questionId !== questionId) } : prev,
    );
  };

  const addQuestion = (questionId: number, question: string) => {
    if (editData?.questions.some((q) => q.questionId === questionId)) return;
    handleQuestionChange(questionId, question, '');
  };

  const applyQuestionSet = (setId: number) => {
    const set = questionSets.find((s) => s.id === setId);
    if (!set) return;
    setEditData((prev) =>
      prev
        ? {
            ...prev,
            questions: set.items.map((item) => ({
              questionId: item.questionId,
              question: item.questionTitle,
              answer: '',
            })),
          }
        : prev,
    );
  };

  const handleSave = () => {
    if (!visit || !editData) return;
    const dataToSave: ChildVisitUpdate = {};

    if (editData.visitDate && editData.visitDate !== toDateTimeLocal(visit.visitDate)) {
      dataToSave.visitDate = fromDateTimeLocal(editData.visitDate);
    }

    const weightNum = editData.weight === '' ? 0 : Number(editData.weight);
    if (weightNum !== visit.weight) dataToSave.weight = weightNum;

    const armNum = editData.armCircumference === '' ? 0 : Math.round(Number(editData.armCircumference));
    if (armNum !== visit.armCircumference) dataToSave.armCircumference = armNum;

    const heightNum = editData.height === '' ? 0 : Math.round(Number(editData.height));
    if (heightNum !== visit.height) dataToSave.height = heightNum;

    if (editData.incap !== visit.incap) dataToSave.incap = editData.incap;
    if (editData.leche !== visit.leche) dataToSave.leche = editData.leche;

    if (editData.bagsGiven !== (visit.bagsGiven ?? '')) dataToSave.bagsGiven = editData.bagsGiven || null;
    if (editData.recvAnyMedicine !== (visit.recvAnyMedicine ?? '')) {
      dataToSave.recvAnyMedicine = editData.recvAnyMedicine || null;
    }
    if (editData.leftFromProg !== (visit.leftFromProg ?? '')) dataToSave.leftFromProg = editData.leftFromProg || null;
    if (editData.passedAway !== (visit.passedAway ?? '')) dataToSave.passedAway = editData.passedAway || null;
    if (editData.notes !== (visit.notes ?? '')) dataToSave.notes = editData.notes || null;

    const answeredQuestions = editData.questions.filter((q) => q.answer.trim() !== '');
    if (JSON.stringify(answeredQuestions) !== JSON.stringify(visit.questions ?? [])) {
      dataToSave.questions = answeredQuestions;
    }

    if (JSON.stringify(editData.photos) !== JSON.stringify(visit.photos ?? [])) {
      dataToSave.photos = editData.photos;
    }

    updateVisitMutation.mutate(dataToSave);
  };

  if (!hasValidIds) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-hv-crisis">Invalid family, child, or visit ID in URL</p>
      </div>
    );
  }
  if (isLoading) return <div className="text-hv-gray">Loading visit...</div>;
  if (isError || !visit) return <div className="text-red-500">Visit not found</div>;

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: 'Visit Date', value: new Date(visit.visitDate).toLocaleDateString() },
    { label: 'Weight', value: visit.weight > 0 ? `${visit.weight.toFixed(2)} kg` : '—' },
    { label: 'Arm Circumference (MUAC)', value: visit.armCircumference > 0 ? `${(visit.armCircumference / 10).toFixed(1)} cm` : '—' },
    { label: 'Height', value: visit.height > 0 ? `${(visit.height / 10).toFixed(1)} cm` : '—' },
    { label: 'INCAP', value: visit.incap ? 'Yes' : 'No' },
    { label: 'Leche', value: visit.leche ? 'Yes' : 'No' },
    // The four below are free-text columns, not booleans.
    { label: 'Bags Given', value: visit.bagsGiven || '—' },
    { label: 'Received Medicine', value: visit.recvAnyMedicine || '—' },
    { label: 'Left Program', value: visit.leftFromProg || '—' },
    { label: 'Passed Away', value: visit.passedAway || '—' },
  ];

  const inputClass =
    'w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-green';

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <Link
            to={`/families/${familyId}/children/${childId}`}
            className="text-xs text-hv-sage hover:text-hv-charcoal transition-colors"
          >
            ← {child?.name ?? 'Child'}
          </Link>
          <h1 className="text-2xl font-serif font-bold text-hv-charcoal mt-1">
            Visit — {new Date(visit.visitDate).toLocaleDateString()}
          </h1>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {!isEditing && (
            <button
              onClick={handleEdit}
              className="px-3 py-1.5 text-sm bg-hv-green text-white rounded-md hover:bg-hv-green-hover transition-colors"
            >
              {t('admin.edit_entity_title')}
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
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete visit"
        message={`Delete the visit recorded on ${new Date(visit.visitDate).toLocaleDateString()}? Its measurements, answers and photos go with it.`}
        busy={deleteVisitMutation.isPending}
        onConfirm={() => deleteVisitMutation.mutate()}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      {deleteVisitMutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5">
          <p className="text-hv-crisis text-sm">
            Error deleting visit: {deleteVisitMutation.error instanceof Error ? deleteVisitMutation.error.message : 'Unknown error'}
          </p>
        </div>
      )}

      {isEditing && editData ? (
        /* ── Edit form ── */
        <div className="bg-white rounded-xl border border-hv-border p-5">
          <h2 className="text-sm font-semibold text-hv-charcoal mb-4">Edit Visit</h2>
          <div className="space-y-5">
            <div>
              <label htmlFor="visitDate" className="block text-sm font-medium text-hv-charcoal mb-1">
                Visit Date
              </label>
              <input
                type="datetime-local"
                id="visitDate"
                value={editData.visitDate}
                onChange={(e) => setEditData({ ...editData, visitDate: e.target.value })}
                className={inputClass}
              />
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
                  value={editData.weight}
                  onChange={(e) => setEditData({ ...editData, weight: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="armCircumference" className="block text-sm font-medium text-hv-charcoal mb-1">
                  Arm Circumference (mm)
                </label>
                <input
                  type="number"
                  id="armCircumference"
                  min="0"
                  value={editData.armCircumference}
                  onChange={(e) => setEditData({ ...editData, armCircumference: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="height" className="block text-sm font-medium text-hv-charcoal mb-1">
                  Height (mm)
                </label>
                <input
                  type="number"
                  id="height"
                  min="0"
                  value={editData.height}
                  onChange={(e) => setEditData({ ...editData, height: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Flags */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="incap"
                  checked={editData.incap}
                  onChange={(e) => setEditData({ ...editData, incap: e.target.checked })}
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
                  checked={editData.leche}
                  onChange={(e) => setEditData({ ...editData, leche: e.target.checked })}
                  className="w-4 h-4 text-hv-green border-hv-border-input rounded focus:ring-hv-green"
                />
                <label htmlFor="leche" className="ml-2 text-sm text-hv-charcoal">
                  Drinking milk (Leche)
                </label>
              </div>
            </div>

            {/* Free-text status fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="bagsGiven" className="block text-sm font-medium text-hv-charcoal mb-1">
                  Bags Given
                </label>
                <input
                  type="text"
                  id="bagsGiven"
                  value={editData.bagsGiven}
                  onChange={(e) => setEditData({ ...editData, bagsGiven: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="recvAnyMedicine" className="block text-sm font-medium text-hv-charcoal mb-1">
                  Received Medicine
                </label>
                <input
                  type="text"
                  id="recvAnyMedicine"
                  value={editData.recvAnyMedicine}
                  onChange={(e) => setEditData({ ...editData, recvAnyMedicine: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="leftFromProg" className="block text-sm font-medium text-hv-charcoal mb-1">
                  Left Program
                </label>
                <input
                  type="text"
                  id="leftFromProg"
                  value={editData.leftFromProg}
                  onChange={(e) => setEditData({ ...editData, leftFromProg: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="passedAway" className="block text-sm font-medium text-hv-charcoal mb-1">
                  Passed Away
                </label>
                <input
                  type="text"
                  id="passedAway"
                  value={editData.passedAway}
                  onChange={(e) => setEditData({ ...editData, passedAway: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Survey answers */}
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
                className={inputClass}
                placeholder="Additional notes about the visit..."
              />
            </div>

            {/* Photos */}
            <PhotoUpload
              photos={editData.photos}
              onChange={(photos) => setEditData({ ...editData, photos })}
              pendingDeletions={photoDeletions}
            />

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={updateVisitMutation.isPending}
                className="bg-hv-terracotta text-white px-4 py-2 rounded-md text-sm hover:bg-hv-terracotta-hover transition-colors disabled:opacity-50"
              >
                {updateVisitMutation.isPending ? t('common.saving') : t('common.save')}
              </button>
              <button
                onClick={handleCancel}
                disabled={updateVisitMutation.isPending}
                className="px-4 py-2 border border-hv-border rounded-md text-sm text-hv-charcoal hover:bg-hv-page transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
            </div>

            {updateVisitMutation.isError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-hv-crisis text-sm">
                  Error saving visit: {updateVisitMutation.error instanceof Error ? updateVisitMutation.error.message : 'Unknown error'}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-hv-border">
          {/* Info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-hv-border">
            {fields.map(({ label, value }) => (
              <div key={label} className="px-4 py-3">
                <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">{label}</div>
                <div className="text-sm font-medium text-hv-charcoal">{value}</div>
              </div>
            ))}
          </div>

          {/* Notes */}
          {visit.notes && (
            <div className="px-4 py-3 border-t border-hv-border">
              <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">Notes</div>
              <div className="text-sm text-hv-charcoal">{visit.notes}</div>
            </div>
          )}

          {/* Questions */}
          {Array.isArray(visit.questions) && visit.questions.length > 0 && (
            <div className="px-4 py-3 border-t border-hv-border">
              <div className="text-xs text-hv-sage uppercase tracking-wide mb-2">Survey Questions</div>
              <div className="space-y-2">
                {visit.questions.map((q, i) => (
                  <div key={q.questionId ?? i}>
                    <div className="text-xs text-hv-sage">{q.question || `Question ${q.questionId}`}</div>
                    <div className="text-sm text-hv-charcoal">{q.answer || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photos */}
          {visit.photos && visit.photos.length > 0 && (
            <PhotoGallery photos={visit.photos} />
          )}
        </div>
      )}
    </div>
  );
};

export default ChildVisitDetailPage;
