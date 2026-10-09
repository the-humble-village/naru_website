import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react';
import type { EventWithCount } from '@naru/shared';
import { eventsApi } from '../../api/events';
import { EmptyState, LoadingState } from '../../components';
import { useTranslation } from '../../hooks';
import { formatDateUTC } from '../../utils/datetime';

const FIELD = 'min-h-11 w-full min-w-0 rounded-lg border border-hv-border bg-white px-3 py-2 text-sm text-hv-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hv-green';
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hv-green focus-visible:ring-offset-2';
const PAGE_SIZE = 100;
const dayKey = (date: Date) => date.toISOString().slice(0, 10);
const monthOf = (value: string) => new Date(`${value.slice(0, 7)}-01T00:00:00Z`);
const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const EventsPage: React.FC = () => {
  const { t, lang } = useTranslation();
  const [month, setMonth] = useState(() => monthOf(localToday()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const today = localToday();

  useEffect(() => {
    if (searchInput.trim() === search) return;
    const handle = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setSelectedDay(null);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput, search]);

  const monthStart = dayKey(month);
  const monthEnd = dayKey(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)));
  const rangeFrom = from > monthStart ? from : monthStart;
  const rangeTo = to && to < monthEnd ? to : monthEnd;
  const invalidDates = Boolean(from && to && from > to);
  const hasRange = !invalidDates && rangeFrom <= rangeTo;
  const params = useMemo(() => ({
    from: rangeFrom,
    to: rangeTo,
    search: search || undefined,
  }), [rangeFrom, rangeTo, search]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['events', 'calendar', params],
    enabled: hasRange,
    queryFn: async () => {
      // Calendars need the whole month, even when it spans multiple API pages.
      const items: EventWithCount[] = [];
      let total = 0;
      do {
        const result = await eventsApi.listEvents({ ...params, skip: items.length, limit: PAGE_SIZE });
        if (result.items.length === 0 && items.length < result.total) {
          throw new Error('Incomplete event calendar response');
        }
        items.push(...result.items);
        total = result.total;
      } while (items.length < total);
      return items.sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.id - b.id);
    },
  });
  const events = hasRange ? data ?? [] : [];
  const agenda = selectedDay ? events.filter(event => event.eventDate === selectedDay) : events;
  const byDay = new Map<string, EventWithCount[]>();
  events.forEach(event => byDay.set(event.eventDate, [...(byDay.get(event.eventDate) ?? []), event]));

  const monthLabel = new Intl.DateTimeFormat(lang, {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(month);
  const fullDate = (date: Date) => new Intl.DateTimeFormat(lang, {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(date);
  const shortMonth = (value: string) => new Intl.DateTimeFormat(lang, {
    month: 'short', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
  const weekdays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 0, 5 + index)); // Monday first.
    return {
      short: new Intl.DateTimeFormat(lang, { weekday: 'short', timeZone: 'UTC' }).format(date),
      full: new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone: 'UTC' }).format(date),
    };
  });
  const firstWeekday = (month.getUTCDay() + 6) % 7;
  const daysInMonth = Number(monthEnd.slice(-2));
  const cells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day < 1 || day > daysInMonth ? null : new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day));
  });

  const navigateMonth = (offset: number) => {
    setMonth(current => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1)));
    setSelectedDay(null);
  };
  const linkedVisits = (count: number) => t(count === 1 ? 'events.linked_visit' : 'events.linked_visits').replace('{count}', String(count));
  const agendaTitle = selectedDay
    ? fullDate(new Date(`${selectedDay}T00:00:00Z`))
    : t('events.month_agenda');

  return (
    <div className="mx-auto max-w-7xl py-1">
      <header className="relative mb-5 text-center">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-hv-green sm:text-4xl">{t('nav.events')}</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-hv-gray sm:text-base">{t('events.overview_description')}</p>
        <Link to="/events/new"
          className={`mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-hv-terracotta px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hv-terracotta-hover lg:absolute lg:right-0 lg:top-0 lg:mt-0 ${FOCUS}`}>
          <Plus aria-hidden="true" size={18} />{t('events.new')}
        </Link>
      </header>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-hv-border bg-white p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] sm:p-3">
        <div className="min-w-0">
          <label htmlFor="events-from" className="mb-1 block text-sm font-medium text-hv-gray">{t('filter.date_from')}</label>
          <input id="events-from" type="date" value={from} max={to || undefined}
            onChange={event => {
              const value = event.target.value;
              setFrom(value); setSelectedDay(null);
              if (value) setMonth(monthOf(value));
            }} className={FIELD} />
        </div>
        <div className="min-w-0">
          <label htmlFor="events-to" className="mb-1 block text-sm font-medium text-hv-gray">{t('filter.date_to')}</label>
          <input id="events-to" type="date" value={to} min={from || undefined}
            onChange={event => {
              const value = event.target.value;
              setTo(value); setSelectedDay(null);
              if (value && (!from || value < monthStart)) setMonth(monthOf(value));
            }} className={FIELD} />
        </div>
        <div className="min-w-0 sm:col-span-2 lg:col-span-1">
          <label htmlFor="events-search" className="mb-1 block text-sm font-medium text-hv-gray">{t('events.search_label')}</label>
          <div className="relative">
            <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hv-gray" />
            <input ref={searchRef} id="events-search" type="search" value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
              placeholder={t('events.search_placeholder')}
              className={`${FIELD} pl-10 pr-12 [&::-webkit-search-cancel-button]:appearance-none`} />
            {searchInput && (
              <button type="button" aria-label={t('events.clear_search')}
                onClick={() => { setSearchInput(''); setSearch(''); setSelectedDay(null); searchRef.current?.focus(); }}
                className={`absolute right-0 top-0 flex h-full w-11 items-center justify-center rounded-r-lg text-hv-gray hover:text-hv-green ${FOCUS}`}>
                <X aria-hidden="true" size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {invalidDates && <p role="alert" className="mb-4 text-sm text-hv-crisis">{t('events.invalid_range')}</p>}

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-hv-green/15 bg-[#eaf0e9] p-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="events-month-heading" className="min-w-0 overflow-hidden rounded-xl border border-hv-border bg-white">
          <div className="flex items-center justify-between gap-2 p-2">
            <button type="button" onClick={() => navigateMonth(-1)} aria-label={t('events.previous_month')}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-hv-border text-hv-green hover:bg-hv-page ${FOCUS}`}>
              <ChevronLeft aria-hidden="true" size={20} />
            </button>
            <h2 id="events-month-heading" aria-live="polite" className="text-center font-serif text-xl font-bold text-hv-green sm:text-2xl">{monthLabel}</h2>
            <button type="button" onClick={() => navigateMonth(1)} aria-label={t('events.next_month')}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-hv-border text-hv-green hover:bg-hv-page ${FOCUS}`}>
              <ChevronRight aria-hidden="true" size={20} />
            </button>
          </div>
          <table className="w-full table-fixed border-collapse" aria-labelledby="events-month-heading">
            <thead className="bg-[#eaf0e9]/60">
              <tr>{weekdays.map(day => <th key={day.full} scope="col" className="border border-hv-border px-1 py-2 text-xs font-medium text-hv-gray"><abbr title={day.full} className="no-underline">{day.short}</abbr></th>)}</tr>
            </thead>
            <tbody>
              {Array.from({ length: cells.length / 7 }, (_, row) => (
                <tr key={row}>
                  {cells.slice(row * 7, row * 7 + 7).map((date, column) => {
                    const key = date ? dayKey(date) : null;
                    const entries = key ? byDay.get(key) ?? [] : [];
                    return (
                      <td key={key ?? `blank-${column}`} className={`h-[60px] border border-hv-border p-1 align-top sm:h-[68px] sm:p-1.5 ${key === selectedDay ? 'bg-[#eaf0e9]/70' : ''}`}>
                        {date && key && (
                          <>
                            <button type="button" aria-label={fullDate(date)} aria-pressed={selectedDay === key}
                              aria-current={key === today ? 'date' : undefined}
                              onClick={() => setSelectedDay(current => current === key ? null : key)}
                              className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full text-sm hover:bg-[#eaf0e9] ${key === today ? 'bg-[#eaf0e9] font-semibold text-hv-green' : 'text-hv-charcoal'} ${FOCUS}`}>
                              {date.getUTCDate()}
                            </button>
                            <ul className="space-y-1">
                              {entries.slice(0, 2).map(event => (
                                <li key={event.id}>
                                  <Link to={`/events/${event.id}`} title={event.name}
                                    className={`block truncate rounded bg-[#eaf0e9] px-1.5 py-1 text-[11px] leading-4 text-hv-green hover:bg-hv-terracotta/15 sm:text-xs ${FOCUS}`}>
                                    {event.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                            {entries.length > 2 && (
                              <button type="button" onClick={() => setSelectedDay(key)}
                                aria-label={t('events.show_day_events').replace('{date}', fullDate(date))}
                                className={`mt-1 rounded px-1 py-1 text-xs font-medium text-hv-green underline ${FOCUS}`}>
                                {t('events.more_events').replace('{count}', String(entries.length - 2))}
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="events-agenda-heading" className="min-w-0 rounded-xl border border-hv-border bg-white p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="events-agenda-heading" className="font-serif text-xl font-bold text-hv-green sm:text-2xl">{agendaTitle}</h2>
            {selectedDay && <button type="button" onClick={() => setSelectedDay(null)} className={`rounded px-2 py-1 text-sm text-hv-green underline ${FOCUS}`}>{t('events.all_dates')}</button>}
          </div>
          <p className="mb-3 text-sm text-hv-gray">{t('events.showing_month').replace('{month}', monthLabel)}</p>
          {isLoading && hasRange && <LoadingState message={t('common.loading')} />}
          {isError && hasRange && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-hv-crisis">
              <p>{t('events.load_error')}</p>
              <button type="button" onClick={() => refetch()} className={`mt-2 rounded px-2 py-1 underline ${FOCUS}`}>{t('events.retry')}</button>
            </div>
          )}
          {!invalidDates && !(isLoading && hasRange) && !(isError && hasRange) && (
            agenda.length === 0 ? <EmptyState message={t(selectedDay ? 'events.empty_day' : 'events.empty_month')} /> : (
              <ul className="space-y-3">
                {agenda.map(event => (
                  <li key={event.id}>
                    <Link to={`/events/${event.id}`}
                      aria-labelledby={`agenda-event-${event.id}`}
                      aria-describedby={`agenda-description-${event.id}`}
                      className={`flex items-center gap-3 rounded-xl border border-hv-green/15 p-3 transition-colors hover:border-hv-green hover:bg-hv-page ${FOCUS}`}>
                      <span aria-hidden="true" className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-[#eaf0e9] py-2 text-hv-green">
                        <span className="font-serif text-2xl font-bold leading-none">{Number(event.eventDate.slice(8, 10))}</span>
                        <span className="mt-1 text-xs font-medium uppercase">{shortMonth(event.eventDate)}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span id={`agenda-event-${event.id}`} className="block break-words text-sm font-semibold text-hv-charcoal">{event.name}</span>
                        <span id={`agenda-description-${event.id}`} className="mt-1 block text-sm text-hv-gray">
                          <span className="sr-only">{formatDateUTC(event.eventDate)}. </span>{linkedVisits(event.visitCount)}
                        </span>
                      </span>
                      <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-hv-green" />
                    </Link>
                  </li>
                ))}
              </ul>
            )
          )}
        </section>
      </div>
    </div>
  );
};

export default EventsPage;
