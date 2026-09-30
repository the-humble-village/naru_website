import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Lock } from 'lucide-react';
import { reportsApi } from '../../api/reports';
import { EmptyState, LoadingState, PageHeader } from '../../components';
import { useReportText } from './ReportTable';

export const ReportsPage: React.FC = () => {
  const { t, reportName, reportDescription, reportNote } = useReportText();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports'],
    queryFn: reportsApi.listReports,
  });

  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader title={t('nav.reports')} />

      <p className="text-hv-gray mb-6">{t('reports.subtitle')}</p>

      {isLoading && <LoadingState message={t('common.loading')} />}

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-hv-crisis">{t('reports.load_failed')}</p>
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <EmptyState message={t('reports.empty')} />
      )}

      {items.length > 0 && (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((report) => {
            const name = reportName(report.slug, report.title);
            const description = reportDescription(report.slug, report.description);

            if (!report.available) {
              return (
                <li key={report.slug}>
                  <div
                    aria-disabled="true"
                    className="h-full bg-white p-6 rounded-xl border border-hv-border opacity-60 cursor-not-allowed"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-semibold text-hv-charcoal">{name}</h2>
                      <Lock size={16} className="text-hv-sage shrink-0 mt-0.5" />
                    </div>
                    <p className="text-sm text-hv-gray mt-2">{description}</p>
                    <p className="text-sm text-hv-gray mt-2">
                      {reportNote(report.slug, report.note ?? '')}
                    </p>
                    <span className="inline-block mt-3 px-2 py-1 bg-hv-page text-hv-sage rounded-full text-xs">
                      {t('reports.coming_future')}
                    </span>
                  </div>
                </li>
              );
            }

            return (
              <li key={report.slug}>
                <Link
                  to={`/reports/${report.slug}`}
                  className="block h-full bg-white p-6 rounded-xl border border-hv-border hover:border-hv-accent transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold text-hv-terracotta">{name}</h2>
                    <ChevronRight size={16} className="text-hv-sage shrink-0 mt-0.5" />
                  </div>
                  <p className="text-sm text-hv-gray mt-2">{description}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ReportsPage;
