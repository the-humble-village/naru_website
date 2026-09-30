import { apiClient } from './client';
import {
  type ReportIndexResponse,
  type ReportResponse,
  type ReportSlug,
} from '@naru/shared';

export interface ReportParams {
  from?: string;
  to?: string;
  siteId?: number;
  programId?: number;
  communityId?: number;
  asOf?: string;
}

const toQuery = (params: ReportParams): string => {
  const searchParams = new URLSearchParams();

  if (params.from) searchParams.set('from', params.from);
  if (params.to) searchParams.set('to', params.to);
  if (params.asOf) searchParams.set('asOf', params.asOf);
  if (params.siteId !== undefined) searchParams.set('siteId', params.siteId.toString());
  if (params.programId !== undefined) searchParams.set('programId', params.programId.toString());
  if (params.communityId !== undefined)
    searchParams.set('communityId', params.communityId.toString());

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const listReports = async (): Promise<ReportIndexResponse> => {
  const response = await apiClient.get<ReportIndexResponse>('/reports');
  return response.data;
};

export const fetchReport = async (
  slug: ReportSlug,
  params: ReportParams = {}
): Promise<ReportResponse> => {
  const response = await apiClient.get<ReportResponse>(`/reports/${slug}${toQuery(params)}`);
  return response.data;
};

export const exportReport = async (
  slug: ReportSlug,
  params: ReportParams = {}
): Promise<{ blob: Blob; filename: string }> => {
  const response = await apiClient.get<Blob>(`/reports/${slug}/export${toQuery(params)}`, {
    responseType: 'blob',
  });

  const disposition = response.headers['content-disposition'];
  const match = typeof disposition === 'string' ? /filename="([^"]+)"/.exec(disposition) : null;

  return { blob: response.data, filename: match?.[1] ?? `${slug}.csv` };
};

/**
 * Fetch the CSV and hand it to the browser as a download. The export endpoint
 * needs the JWT, so it cannot be a plain anchor href.
 */
export const downloadReport = async (
  slug: ReportSlug,
  params: ReportParams = {}
): Promise<void> => {
  const { blob, filename } = await exportReport(slug, params);
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
};

export const reportsApi = {
  listReports,
  fetchReport,
  exportReport,
  downloadReport,
};
