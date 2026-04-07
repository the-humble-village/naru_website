import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { visitsApi } from '../../api/visits';

/**
 * FamilyVisitDetailPage - Shows full details of a single family visit
 */
export const FamilyVisitDetailPage: React.FC = () => {
  const { id: familyId, vid: visitId } = useParams<{ id: string; vid: string }>();

  const familyIdNum = familyId ? parseInt(familyId, 10) : 0;
  const visitIdNum = visitId ? parseInt(visitId, 10) : 0;

  const { data: visit, isLoading, isError } = useQuery({
    queryKey: ['familyVisit', familyIdNum, visitIdNum],
    queryFn: () => visitsApi.fetchFamilyVisit(familyIdNum, visitIdNum),
    enabled: familyIdNum > 0 && visitIdNum > 0,
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
          Family Visit — {new Date(visit.visitDate).toLocaleDateString()}
        </h1>
        <Link
          to={`/families/${familyId}`}
          className="text-hv-terracotta hover:underline transition-colors shrink-0"
        >
          ← Back to Family
        </Link>
      </div>

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
      </div>
    </div>
  );
};

export default FamilyVisitDetailPage;
