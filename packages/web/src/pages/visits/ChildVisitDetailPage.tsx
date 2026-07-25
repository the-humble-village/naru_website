import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { type ChildVisitQuestion } from '@naru/shared';
import { visitsApi } from '../../api/visits';
import { childrenApi } from '../../api/children';
import { PhotoGallery } from '../../components';

export const ChildVisitDetailPage: React.FC = () => {
  const { id: familyId, cid: childId, vid: visitId } = useParams<{ id: string; cid: string; vid: string }>();

  const familyIdNum = familyId ? parseInt(familyId, 10) : 0;
  const childIdNum = childId ? parseInt(childId, 10) : 0;
  const visitIdNum = visitId ? parseInt(visitId, 10) : 0;

  const { data: visit, isLoading, isError } = useQuery({
    queryKey: ['child-visit', familyIdNum, childIdNum, visitIdNum],
    queryFn: () => visitsApi.fetchChildVisit(familyIdNum, childIdNum, visitIdNum),
    enabled: familyIdNum > 0 && childIdNum > 0 && visitIdNum > 0,
  });

  const { data: child } = useQuery({
    queryKey: ['child', familyIdNum, childIdNum],
    queryFn: () => childrenApi.fetchChild(familyIdNum, childIdNum),
    enabled: familyIdNum > 0 && childIdNum > 0,
  });

  if (isLoading) return <div className="text-hv-gray">Loading visit...</div>;
  if (isError || !visit) return <div className="text-red-500">Visit not found</div>;

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: 'Visit Date', value: new Date(visit.visitDate).toLocaleDateString() },
    { label: 'Weight', value: visit.weight > 0 ? `${visit.weight.toFixed(2)} kg` : '—' },
    { label: 'Arm Circumference (MUAC)', value: visit.armCircumference > 0 ? `${(visit.armCircumference / 10).toFixed(1)} cm` : '—' },
    { label: 'Height', value: visit.height > 0 ? `${(visit.height / 10).toFixed(1)} cm` : '—' },
    { label: 'INCAP', value: visit.incap ? 'Yes' : 'No' },
    { label: 'Leche', value: visit.leche ? 'Yes' : 'No' },
    { label: 'Bags Given', value: visit.bagsGiven ?? '—' },
    { label: 'Received Medicine', value: visit.recvAnyMedicine ? 'Yes' : 'No' },
    { label: 'Left Program', value: visit.leftFromProg ? 'Yes' : 'No' },
    { label: 'Passed Away', value: visit.passedAway ? 'Yes' : 'No' },
  ];

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
      </div>

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
            <div className="space-y-1">
              {(visit.questions as unknown as ChildVisitQuestion[]).map((q, i) => (
                <div key={i} className="text-sm text-hv-charcoal">
                  Q{q.questionId}: {q.answer}
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
    </div>
  );
};

export default ChildVisitDetailPage;
