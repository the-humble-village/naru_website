import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { visitsApi } from '../../api/visits';
import { familiesApi } from '../../api/families';

const PAGE_SIZE = 20;

/** Visit dates are stored as UTC timestamps; pin the display so the day never drifts. */
const formatDateOnly = (d: string) => new Date(d).toLocaleDateString(undefined, { timeZone: 'UTC' });

/**
 * FamilyVisitsPage - The full, paginated list of a family's visits.
 *
 * FamilyDetailPage only shows the five most recent and links here for the rest.
 */
export const FamilyVisitsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const familyId = parseInt(id || '0', 10);
  const [page, setPage] = useState(1);

  const familyQuery = useQuery({
    queryKey: ['family', familyId],
    queryFn: () => familiesApi.fetchFamily(familyId),
    enabled: !!familyId,
  });

  const visitsQuery = useQuery({
    queryKey: ['familyVisits', familyId, page],
    queryFn: () => visitsApi.listFamilyVisits(familyId, {
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
    enabled: !!familyId,
  });

  const visits = visitsQuery.data?.visits || [];
  const total = visitsQuery.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      <div className="mb-6">
        <Link
          to={`/families/${familyId}`}
          className="text-sm text-hv-sage hover:text-hv-charcoal transition-colors"
        >
          ← Back to {familyQuery.data?.familyName || 'family'}
        </Link>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-2">
          <h1 className="text-2xl font-serif font-bold text-hv-charcoal">Family Visits</h1>
          <Link
            to={`/families/${familyId}/visits/new`}
            className="flex items-center gap-1.5 px-4 py-2 bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover transition-colors self-start"
          >
            <Plus size={14} />
            Add Visit
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-hv-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-hv-border">
          <h2 className="text-sm font-semibold text-hv-charcoal flex items-center gap-1.5">
            <CalendarCheck size={15} className="text-hv-sage" />
            All Visits
          </h2>
          {total > 0 && (
            <span className="text-xs text-hv-sage">
              {total} visit{total !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {visitsQuery.isLoading ? (
          <div className="px-4 py-3 text-sm text-hv-sage">Loading...</div>
        ) : visitsQuery.isError ? (
          <div className="px-4 py-3 text-sm text-hv-crisis">Could not load visits.</div>
        ) : visits.length === 0 ? (
          <div className="px-4 py-3 text-sm text-hv-sage">No visits recorded yet</div>
        ) : (
          <div className="divide-y divide-hv-border">
            {visits.map(visit => (
              <Link
                key={visit.id}
                to={`/families/${familyId}/visits/${visit.id}`}
                className="flex items-start justify-between px-4 py-2.5 hover:bg-hv-page transition-colors group"
              >
                <div>
                  <div className="text-sm font-medium text-hv-charcoal group-hover:text-hv-green transition-colors">
                    {formatDateOnly(visit.visitDate)}
                  </div>
                  <div className="text-xs text-hv-sage mt-0.5">
                    {[
                      visit.trainingsReceived.length > 0 && `${visit.trainingsReceived.length} training${visit.trainingsReceived.length !== 1 ? 's' : ''}`,
                      visit.resourcesReceived.length > 0 && `${visit.resourcesReceived.length} resource${visit.resourcesReceived.length !== 1 ? 's' : ''}`,
                    ].filter(Boolean).join(' • ') || 'No resources'}
                  </div>
                  {visit.notes && (
                    <div className="text-xs text-hv-gray mt-0.5 line-clamp-1">{visit.notes}</div>
                  )}
                </div>
                <ChevronRight size={14} className="text-hv-border group-hover:text-hv-sage transition-colors shrink-0 mt-0.5" />
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-hv-border">
            <span className="text-xs text-hv-sage">
              Showing {rangeStart} to {rangeEnd} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-hv-border rounded-md text-hv-charcoal hover:bg-hv-page transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-hv-border rounded-md text-hv-charcoal hover:bg-hv-page transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FamilyVisitsPage;
