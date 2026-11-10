import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ReportSlug } from '@naru/shared';
import { reportsApi, type ReportParams } from '../../api/reports';
import { adminApi } from '../../api/admin';
import { programsApi } from '../../api/programs';
import {
  EmptyState,
  FilterBar,
  LoadingState,
  PageHeader,
  type FilterValues,
} from '../../components';
import { ReportChart, ReportTable, useReportText } from './ReportTable';

const readId = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const statusOf = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  return (error as { response?: { status?: number } }).response?.status;
};

export const ReportDetailPage: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, reportName, reportDescription, reportNote } = useReportText();

  // Keyed on the serialised query string rather than the URLSearchParams object:
  // react-router hands back a fresh instance on every render, which would make
  // `params` a new object each time and reset the filter draft mid-edit.
  const queryString = searchParams.toString();

  const params = useMemo<ReportParams>(() => {
    const current = new URLSearchParams(queryString);
    return {
      from: current.get('from') || undefined,
      to: current.get('to') || undefined,
      asOf: current.get('asOf') || undefined,
      siteId: readId(current.get('siteId')),
      programId: readId(current.get('programId')),
      communityId: readId(current.get('communityId')),
    };
  }, [queryString]);

  const [draft, setDraft] = useState<FilterValues>({});

  useEffect(() => {
    setDraft({
      dateFrom: params.from ?? null,
      dateTo: params.to ?? null,
      siteId: params.siteId ?? null,
      programId: params.programId ?? null,
      communityId: params.communityId ?? null,
    });
  }, [params]);

  const { data: index, isLoading: indexLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: reportsApi.listReports,
  });

  const descriptor = index?.items.find((item) => item.slug === slug);
  const unavailable = descriptor?.available === false;

  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: adminApi.fetchSites });
  const { data: communities = [] } = useQuery({
    queryKey: ['communities'],
    queryFn: adminApi.fetchCommunities,
  });
  const { data: programData } = useQuery({
    queryKey: ['programs'],
    queryFn: () => programsApi.listPrograms(),
  });

  const siteOptions = useMemo(
    () => sites.map((site) => ({ id: site.id, title: site.title })),
    [sites]
  );

  const communityOptions = useMemo(
    () =>
      communities
        .filter((community) => !draft.siteId || (community.siteId ?? null) === draft.siteId)
        .map((community) => ({ id: community.id, title: community.title })),
    [communities, draft.siteId]
  );

  const programOptions = useMemo(
    () => (programData?.items ?? []).map((program) => ({ id: program.id, title: program.name })),
    [programData]
  );

  const {
    data: report,
    isLoading: reportLoading,
    isError: reportError,
    error,
  } = useQuery({
    queryKey: ['report', slug, params],
    queryFn: () => reportsApi.fetchReport(slug as ReportSlug, params),
    enabled: Boolean(slug) && !indexLoading && !unavailable,
  });

  const exportMutation = useMutation({
    mutationFn: () => reportsApi.downloadReport(slug as ReportSlug, params),
  });

  const handleChange = useCallback((next: FilterValues) => {
    setDraft((previous) => {
      const siteChanged = next.siteId !== previous.siteId;
      return { ...next, communityId: siteChanged ? null : next.communityId ?? null };
    });
  }, []);

  const handleApply = useCallback(() => {
    const next = new URLSearchParams();
    if (draft.dateFrom) next.set('from', draft.dateFrom);
    if (draft.dateTo) next.set('to', draft.dateTo);
    if (draft.siteId) next.set('siteId', String(draft.siteId));
    if (draft.programId) next.set('programId', String(draft.programId));
    if (draft.communityId) next.set('communityId', String(draft.communityId));
    if (params.asOf) next.set('asOf', params.asOf);
    setSearchParams(next);
  }, [draft, params.asOf, setSearchParams]);

  const title = reportName(slug, descriptor?.title ?? report?.title ?? slug);
  const status = statusOf(error);
  const notFound = reportError && status === 404;
  const deferred = unavailable || (reportError && status === 501);
  const rows = report?.rows ?? [];

  const backLabel = t('reports.back');

  if (deferred) {
    return (
      <div>
        <PageHeader title={title} backTo="/reports" backLabel={backLabel} />
        <div className="bg-white p-6 rounded-xl border border-hv-border">
          <p className="text-hv-gray">
            {reportNote(slug, descriptor?.note ?? t('reports.deferred_body'))}
          </p>
          <span className="inline-block mt-3 px-2 py-1 bg-hv-page text-hv-sage rounded-full text-xs">
            {t('reports.coming_future')}
          </span>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div>
        <PageHeader
          title={t('reports.not_found_title')}
          backTo="/reports"
          backLabel={backLabel}
        />
        <EmptyState message={t('reports.not_found')} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} backTo="/reports" backLabel={backLabel} />

      {descriptor && (
        <p className="text-hv-gray mb-4">{reportDescription(slug, descriptor.description)}</p>
      )}

      <div className="space-y-3 mb-6">
        <FilterBar
          fields={['dateRange', 'site', 'program', 'community']}
          value={draft}
          onChange={handleChange}
          sites={siteOptions}
          programs={programOptions}
          communities={communityOptions}
          onApply={handleApply}
          actions={
            <button
              type="button"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending || rows.length === 0}
              className="bg-hv-terracotta text-white px-4 py-2 rounded hover:bg-hv-terracotta-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportMutation.isPending ? t('reports.exporting') : t('reports.export_csv')}
            </button>
          }
        />

        {slug === 'census' && <p className="text-sm text-hv-gray">{t('reports.as_of_hint')}</p>}

        {exportMutation.isError && (
          <p className="text-sm text-hv-crisis">{t('reports.export_failed')}</p>
        )}
      </div>

      {(indexLoading || reportLoading) && <LoadingState message={t('common.loading')} />}

      {reportError && !notFound && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-hv-crisis">{t('reports.report_load_failed')}</p>
        </div>
      )}

      {report && rows.length === 0 && <EmptyState message={t('reports.empty_rows')} />}

      {report && rows.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-hv-gray">
            {t('reports.row_count').replace('{count}', String(report.total))}
          </p>

          <ReportChart
            slug={slug}
            chart={descriptor?.chart ?? null}
            columns={report.columns}
            rows={rows}
          />

          <ReportTable slug={slug} columns={report.columns} rows={rows} />
        </div>
      )}
    </div>
  );
};

export default ReportDetailPage;
