import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { visitsApi } from '../../api/visits';
import { PhotoGallery, RoleGate, ConfirmDialog } from '../../components';

/**
 * ParentVisitDetailPage - Shows full details of a single parent visit
 */
export const ParentVisitDetailPage: React.FC = () => {
  const { id: familyId, pid: parentId, vid: visitId } = useParams<{ id: string; pid: string; vid: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const familyIdNum = familyId ? parseInt(familyId, 10) : 0;
  const parentIdNum = parentId ? parseInt(parentId, 10) : 0;
  const visitIdNum = visitId ? parseInt(visitId, 10) : 0;

  const { data: visit, isLoading, isError } = useQuery({
    queryKey: ['parentVisit', familyIdNum, parentIdNum, visitIdNum],
    queryFn: () => visitsApi.fetchParentVisit(familyIdNum, parentIdNum, visitIdNum),
    enabled: familyIdNum > 0 && parentIdNum > 0 && visitIdNum > 0,
  });

  // Delete visit mutation (soft delete on the backend)
  const deleteVisitMutation = useMutation({
    mutationFn: () => visitsApi.deleteParentVisit(familyIdNum, parentIdNum, visitIdNum),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parentVisits', familyIdNum, parentIdNum] });
      queryClient.invalidateQueries({ queryKey: ['parent', familyIdNum, parentIdNum] });
      queryClient.removeQueries({ queryKey: ['parentVisit', familyIdNum, parentIdNum, visitIdNum] });
      setConfirmDeleteOpen(false);
      navigate(`/families/${familyIdNum}/parents/${parentIdNum}`);
    },
  });

  if (isLoading) return <div className="text-hv-gray">Loading visit...</div>;
  if (isError || !visit) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-hv-crisis">Failed to load visit details.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
        <h1 className="text-2xl font-serif font-bold text-hv-charcoal">
          Parent Visit &mdash; {new Date(visit.visitDate).toLocaleDateString()}
        </h1>
        <div className="flex gap-4 shrink-0">
          <Link
            to={`/families/${familyId}/parents/${parentId}/visits/${visitId}/edit`}
            className="bg-hv-green text-white px-4 py-2 rounded text-sm hover:bg-hv-green-hover transition-colors"
          >
            Edit
          </Link>
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
            to={`/families/${familyId}/parents/${parentId}`}
            className="text-hv-terracotta hover:underline transition-colors"
          >
            &larr; Back to Parent
          </Link>
        </div>
      </div>

      {deleteVisitMutation.isError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-hv-crisis text-sm">
            Error deleting visit:{' '}
            {deleteVisitMutation.error instanceof Error
              ? deleteVisitMutation.error.message
              : 'Unknown error'}
          </p>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete parent visit"
        message={`Delete the visit recorded on ${new Date(visit.visitDate).toLocaleDateString()}?`}
        warning="Measurements, trainings, resources, question answers and photos recorded on this visit will be removed too."
        busy={deleteVisitMutation.isPending}
        onConfirm={() => deleteVisitMutation.mutate()}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      <div className="space-y-5">
        {/* Visit info strip */}
        <div className="bg-white rounded-xl border border-hv-border">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-hv-border">
            <div className="px-5 py-4">
              <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">Visit Date</div>
              <div className="text-sm font-medium text-hv-charcoal">
                {new Date(visit.visitDate).toLocaleString()}
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">Weight</div>
              <div className="text-sm font-medium text-hv-charcoal">
                {visit.weight > 0 ? `${visit.weight} kg` : 'Not recorded'}
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
    </div>
  );
};

export default ParentVisitDetailPage;
