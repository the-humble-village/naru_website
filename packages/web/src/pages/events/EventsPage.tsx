import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { EventWithCount } from '@naru/shared';
import { eventsApi } from '../../api/events';
import { EmptyState, FilterBar, LoadingState, PageHeader } from '../../components';
import type { FilterValues } from '../../components';
import { useTranslation } from '../../hooks';
import { formatDateUTC } from '../../utils/datetime';

const PAGE_SIZE = 25;

const TH = 'px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider';
const TD = 'px-6 py-4 text-sm text-hv-charcoal';

export const EventsPage: React.FC = () => {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValues>({ dateFrom: null, dateTo: null });
  const [page, setPage] = useState(0);

  useEffect(() => {
    const handle = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
  }, [search, filters.dateFrom, filters.dateTo]);

  const params = useMemo(
    () => ({
      search: search || undefined,
      from: filters.dateFrom ?? undefined,
      to: filters.dateTo ?? undefined,
      skip: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
    [search, filters.dateFrom, filters.dateTo, page]
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['events', params],
    queryFn: () => eventsApi.listEvents(params),
  });

  const events: EventWithCount[] = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasPrev = page > 0;
  const hasNext = (page + 1) * PAGE_SIZE < total;

  return (
    <div>
      <PageHeader
        title={t('nav.events')}
        actions={
          <Link
            to="/events/new"
            className="bg-hv-terracotta text-white px-4 py-2 rounded-md hover:bg-hv-terracotta-hover transition-colors"
          >
            {t('events.new')}
          </Link>
        }
      />

      <FilterBar
        fields={['dateRange']}
        value={filters}
        onChange={setFilters}
        className="mb-6"
        actions={
          <div className="w-full sm:w-64">
            <label htmlFor="events-search" className="block text-sm font-medium text-hv-gray mb-1">
              {t('events.search_label')}
            </label>
            <input
              id="events-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('events.search_placeholder')}
              className="w-full px-3 py-2 bg-white border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
            />
          </div>
        }
      />

      {isLoading && <LoadingState message={t('common.loading')} />}

      {error && !isLoading && (
        <div className="bg-red-50 border border-red-300 rounded-md p-4">
          <p className="text-red-700">{t('events.load_error')}</p>
        </div>
      )}

      {!isLoading && !error && events.length === 0 && (
        <div className="bg-white rounded-xl border border-hv-border p-6">
          <EmptyState message={t('events.empty')} />
        </div>
      )}

      {!isLoading && !error && events.length > 0 && (
        <div className="bg-white rounded-xl border border-hv-border overflow-hidden">
          <table className="hidden md:table min-w-full divide-y divide-hv-border">
            <thead className="bg-hv-page">
              <tr>
                <th className={TH}>{t('common.col_name')}</th>
                <th className={TH}>{t('events.col_date')}</th>
                <th className={TH}>{t('events.col_visits')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hv-border">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-hv-page">
                  <td className={TD}>
                    <Link
                      to={`/events/${event.id}`}
                      className="font-medium text-hv-terracotta hover:underline transition-colors"
                    >
                      {event.name}
                    </Link>
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>{formatDateUTC(event.eventDate)}</td>
                  <td className={TD}>{event.visitCount}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="md:hidden divide-y divide-hv-border">
            {events.map((event) => (
              <li key={event.id} className="p-4">
                <Link
                  to={`/events/${event.id}`}
                  className="font-medium text-hv-terracotta hover:underline transition-colors"
                >
                  {event.name}
                </Link>
                <p className="text-sm text-hv-gray mt-1">{formatDateUTC(event.eventDate)}</p>
                <p className="text-sm text-hv-gray">
                  {t('events.col_visits')}: {event.visitCount}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isLoading && !error && (hasPrev || hasNext) && (
        <div className="flex items-center justify-between mt-4">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={!hasPrev}
            className="px-4 py-2 text-sm border border-hv-border rounded-md text-hv-charcoal hover:bg-hv-page transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('events.prev')}
          </button>
          <span className="text-sm text-hv-gray">{total}</span>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={!hasNext}
            className="px-4 py-2 text-sm border border-hv-border rounded-md text-hv-charcoal hover:bg-hv-page transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('events.next')}
          </button>
        </div>
      )}
    </div>
  );
};

export default EventsPage;
