import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Lock, Search, X } from 'lucide-react';
import type { ReportSlug, TranslationKey } from '@naru/shared';
import { reportsApi } from '../../api/reports';
import { EmptyState, LoadingState } from '../../components';
import { useReportText } from './ReportTable';

type Category = 'enrollment' | 'nutrition' | 'visits' | 'other';

const sections: { category: Category; label: TranslationKey }[] = [
  { category: 'enrollment', label: 'reports.category_enrollment' },
  { category: 'nutrition', label: 'reports.category_nutrition' },
  { category: 'visits', label: 'reports.category_visits' },
  { category: 'other', label: 'reports.category_other' },
];

interface ReportStyle {
  category: Category;
  icon: string;
  summary: TranslationKey;
}

const reportStyles = {
  census: { category: 'enrollment', icon: 'fa-users', summary: 'report.census.summary' },
  newcomers: { category: 'enrollment', icon: 'fa-chart-column', summary: 'report.newcomers.summary' },
  demographics: { category: 'enrollment', icon: 'fa-users', summary: 'report.demographics.summary' },
  'incap-pairs': { category: 'enrollment', icon: 'fa-person-breastfeeding', summary: 'report.incap-pairs.summary' },
  'weight-change': { category: 'nutrition', icon: 'fa-weight-scale', summary: 'report.weight-change.summary' },
  transitions: { category: 'nutrition', icon: 'fa-utensils', summary: 'report.transitions.summary' },
  graduations: { category: 'nutrition', icon: 'fa-graduation-cap', summary: 'report.graduations.summary' },
  evaluations: { category: 'nutrition', icon: 'fa-clipboard-list', summary: 'report.evaluations.summary' },
  attendance: { category: 'visits', icon: 'fa-calendar-days', summary: 'report.attendance.summary' },
  'visits-by-site': { category: 'visits', icon: 'fa-location-dot', summary: 'report.visits-by-site.summary' },
  'home-visits': { category: 'visits', icon: 'fa-house', summary: 'report.home-visits.summary' },
  resources: { category: 'visits', icon: 'fa-box', summary: 'report.resources.summary' },
} satisfies Record<ReportSlug, ReportStyle>;

// Keep the visual order independent of the API's report order.
const orderedSlugs = Object.keys(reportStyles);
const styleFor = (slug: string): ReportStyle | undefined =>
  Object.hasOwn(reportStyles, slug) ? reportStyles[slug as ReportSlug] : undefined;
const normalizeSearch = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

export const ReportsPage: React.FC = () => {
  const { t, reportName, reportDescription, reportNote } = useReportText();
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports'],
    queryFn: reportsApi.listReports,
  });

  const items = data?.items ?? [];
  const terms = normalizeSearch(search).split(/\s+/).filter(Boolean);
  const matches = items.map(report => {
    const style = styleFor(report.slug);
    const category = style?.category ?? 'other';
    const name = reportName(report.slug, report.title);
    const description = reportDescription(report.slug, report.description);
    const summary = style ? t(style.summary) : description;
    const categoryLabel = sections.find(section => section.category === category)!.label;

    return {
      ...report,
      name,
      summary,
      category,
      icon: style?.icon ?? 'fa-chart-column',
      searchText: normalizeSearch([name, summary, description, t(categoryLabel)].join(' ')),
    };
  }).filter(report => terms.every(term => report.searchText.includes(term)));

  const visibleSections = sections.map(section => ({
    ...section,
    reports: matches
      .filter(report => report.available && report.category === section.category)
      .sort((a, b) => orderedSlugs.indexOf(a.slug) - orderedSlugs.indexOf(b.slug)),
  })).filter(section => section.reports.length > 0);
  const unavailableReports = matches.filter(report => !report.available);

  return (
    <div className="mx-auto max-w-7xl py-1">
      <header className="mb-4 text-center">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-hv-green sm:text-4xl">
          {t('nav.reports')}
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-hv-gray sm:text-base">
          {t('reports.subtitle')}
        </p>
      </header>

      {items.length > 0 && (
        <div role="search" aria-label={t('reports.search_label')} className="mx-auto mb-4 max-w-md">
          <label htmlFor="report-search" className="sr-only">{t('reports.search_label')}</label>
          <div className="relative">
            <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hv-gray" />
            <input
              id="report-search"
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={t('reports.search_placeholder')}
              className="min-h-11 w-full rounded-xl border border-hv-border bg-white py-2.5 pl-10 pr-12 text-sm text-hv-charcoal placeholder:text-hv-gray focus-visible:border-hv-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hv-green [&::-webkit-search-cancel-button]:appearance-none"
            />
            {search && (
              <button
                type="button"
                aria-label={t('reports.clear_search')}
                onClick={() => {
                  setSearch('');
                  document.getElementById('report-search')?.focus();
                }}
                className="absolute right-0 top-0 flex h-full w-11 items-center justify-center rounded-r-xl text-hv-gray hover:text-hv-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hv-green"
              >
                <X aria-hidden="true" size={18} />
              </button>
            )}
          </div>
          <p role="status" className="sr-only">
            {t('reports.search_count').replace('{count}', String(matches.length))}
          </p>
        </div>
      )}

      {isLoading && <LoadingState message={t('common.loading')} />}

      {isError && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-hv-crisis">{t('reports.load_failed')}</p>
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <EmptyState message={t('reports.empty')} />
      )}

      {items.length > 0 && matches.length === 0 && (
        <EmptyState message={t('reports.no_matches')} />
      )}

      {visibleSections.length > 0 && (
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-3">
          {visibleSections.map(section => (
            <section
              key={section.category}
              aria-labelledby={`reports-${section.category}-heading`}
              className="min-w-0 rounded-2xl border border-hv-green/15 bg-[#eaf0e9] p-3"
            >
              <h2
                id={`reports-${section.category}-heading`}
                className="mb-3 text-center font-serif text-xl font-bold text-hv-green"
              >
                {t(section.label)}
              </h2>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:auto-rows-fr">
                {section.reports.map(report => (
                  <li key={report.slug} className="min-w-0">
                    <Link
                      to={`/reports/${report.slug}`}
                      aria-labelledby={`report-${report.slug}-name`}
                      aria-describedby={`report-${report.slug}-summary`}
                      className="flex h-full min-h-[88px] items-center gap-3 rounded-xl border border-hv-green/15 bg-white p-3 transition-[border-color,box-shadow] hover:border-hv-green hover:shadow-[0_4px_12px_rgba(47,79,57,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hv-green focus-visible:ring-offset-2 focus-visible:ring-offset-[#eaf0e9] motion-reduce:transition-none"
                    >
                      <span aria-hidden="true" className="flex w-8 shrink-0 items-center justify-center text-hv-terracotta">
                        <i className={`fas ${report.icon} text-3xl`} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 id={`report-${report.slug}-name`} className="text-sm font-semibold leading-5 text-hv-charcoal">
                          {report.name}
                        </h3>
                        <p id={`report-${report.slug}-summary`} className="mt-1 text-sm leading-5 text-hv-gray">
                          {report.summary}
                        </p>
                      </div>
                      <ChevronRight aria-hidden="true" size={16} className="shrink-0 text-hv-sage" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {unavailableReports.length > 0 && (
        <ul aria-label={t('reports.coming_future')} className="mt-3 space-y-3">
          {unavailableReports.map(report => (
            <li
              key={report.slug}
              aria-disabled="true"
              aria-labelledby={`report-${report.slug}-name`}
              aria-describedby={`report-${report.slug}-note`}
              className="flex items-center gap-4 rounded-xl border border-hv-border bg-gray-100 p-3 text-hv-gray"
            >
              <Lock aria-hidden="true" size={24} className="mx-1 shrink-0" />
              <div>
                <h2 id={`report-${report.slug}-name`} className="text-sm font-medium">{report.name}</h2>
                <p className="mt-1 text-sm">{t('reports.coming_future')}</p>
                <p id={`report-${report.slug}-note`} className="sr-only">
                  {reportNote(report.slug, report.note ?? report.description)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ReportsPage;
