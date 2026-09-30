import React, { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { ReportCell, ReportColumn, ReportRow, TranslationKey } from '@naru/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslation } from '../../hooks';

const EM_DASH = '—';
const CARD_FALLBACK_LIMIT = 20;

const TH = 'px-4 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider';
const TH_NUMERIC = 'px-4 py-3 text-right text-xs font-medium text-hv-sage uppercase tracking-wider';
const TD = 'px-4 py-3 text-sm text-hv-charcoal whitespace-nowrap';
const TD_NUMERIC = 'px-4 py-3 text-sm text-hv-charcoal text-right tabular-nums whitespace-nowrap';

const CHART_COLORS = ['#2f4f39', '#C27D5F', '#7A8B76', '#637dff', '#c0392b', '#3d6b4a'];

const ID_KEYS = [
  'enrollmentId',
  'motherId',
  'childId',
  'resourceId',
  'programId',
  'communityId',
  'siteId',
];

const CELL_LINKS: Record<string, { idKey: string; to: (id: number) => string }> = {
  subjectName: { idKey: 'enrollmentId', to: (id) => `/enrollments/${id}` },
  motherName: { idKey: 'motherId', to: (id) => `/mothers/${id}` },
  childName: { idKey: 'childId', to: (id) => `/children/${id}` },
};

const localeFor = (lang: string): string => (lang === 'es' ? 'es' : 'en');

const formatNumber = (value: number, lang: string): string =>
  new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: 3 }).format(value);

const formatDate = (value: string, lang: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(localeFor(lang), {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(parsed);
};

export const formatReportCell = (
  value: ReportCell | undefined,
  type: ReportColumn['type'],
  lang: string,
  yes: string,
  no: string
): string => {
  if (value === null || value === undefined || value === '') return EM_DASH;
  if (typeof value === 'boolean') return value ? yes : no;
  if (type === 'number') {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(numeric) ? String(value) : formatNumber(numeric, lang);
  }
  if (type === 'date') return formatDate(String(value), lang);
  return String(value);
};

export const reportRowKey = (row: ReportRow, index: number): string => {
  for (const key of ID_KEYS) {
    const value = row[key];
    if (typeof value === 'number') return `${key}-${value}-${index}`;
  }
  return `row-${index}`;
};

/**
 * Report titles, descriptions and column labels arrive from the server in English.
 * Rather than ship an English-only Reports screen, every server string is looked up
 * under a conventional key first and falls back to what the server sent, so a key
 * that has not been translated yet degrades to readable English instead of a blank.
 */
export const useReportText = () => {
  const { t, lang } = useTranslation();

  const lookup = useCallback(
    (keys: string[], fallback: string): string => {
      for (const key of keys) {
        const value = t(key as TranslationKey);
        if (value !== key) return value;
      }
      return fallback;
    },
    [t]
  );

  const reportName = useCallback(
    (slug: string, fallback: string) => lookup([`report.${slug}.name`], fallback),
    [lookup]
  );

  const reportDescription = useCallback(
    (slug: string, fallback: string) => lookup([`report.${slug}.description`], fallback),
    [lookup]
  );

  const reportNote = useCallback(
    (slug: string, fallback: string) => lookup([`report.${slug}.note`], fallback),
    [lookup]
  );

  const columnLabel = useCallback(
    (slug: string, column: ReportColumn) =>
      lookup([`report.${slug}.col.${column.key}`, `report.column.${column.key}`], column.label),
    [lookup]
  );

  return { t, lang, reportName, reportDescription, reportNote, columnLabel };
};

interface ReportCellValueProps {
  column: ReportColumn;
  row: ReportRow;
  text: string;
}

const ReportCellValue: React.FC<ReportCellValueProps> = ({ column, row, text }) => {
  const link = CELL_LINKS[column.key];
  const id = link ? row[link.idKey] : null;

  if (link && typeof id === 'number' && text !== EM_DASH) {
    return (
      <Link to={link.to(id)} className="font-medium text-hv-terracotta hover:underline">
        {text}
      </Link>
    );
  }

  return <>{text}</>;
};

export interface ReportTableProps {
  slug: string;
  columns: ReportColumn[];
  rows: ReportRow[];
}

export const ReportTable: React.FC<ReportTableProps> = ({ slug, columns, rows }) => {
  const { t, lang, columnLabel } = useReportText();
  const yes = t('common.yes');
  const no = t('common.no');

  const labels = useMemo(
    () => columns.map((column) => columnLabel(slug, column)),
    [columns, columnLabel, slug]
  );

  const useCards = rows.length > 0 && rows.length <= CARD_FALLBACK_LIMIT;

  return (
    <>
      <div
        className={`bg-white rounded-xl border border-hv-border overflow-x-auto${
          useCards ? ' hidden md:block' : ''
        }`}
      >
        <table className="min-w-full divide-y divide-hv-border">
          <thead className="bg-hv-page">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column.key}
                  scope="col"
                  className={column.type === 'number' ? TH_NUMERIC : TH}
                >
                  {labels[index]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hv-border">
            {rows.map((row, rowIndex) => (
              <tr key={reportRowKey(row, rowIndex)} className="hover:bg-hv-page">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={column.type === 'number' ? TD_NUMERIC : TD}
                  >
                    <ReportCellValue
                      column={column}
                      row={row}
                      text={formatReportCell(row[column.key], column.type, lang, yes, no)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {useCards && (
        <ul className="md:hidden space-y-3">
          {rows.map((row, rowIndex) => (
            <li
              key={reportRowKey(row, rowIndex)}
              className="bg-white p-4 rounded-xl border border-hv-border"
            >
              <dl className="space-y-1">
                {columns.map((column, index) => (
                  <div key={column.key} className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs uppercase tracking-wider text-hv-sage">
                      {labels[index]}
                    </dt>
                    <dd className="text-sm text-hv-charcoal text-right">
                      <ReportCellValue
                        column={column}
                        row={row}
                        text={formatReportCell(row[column.key], column.type, lang, yes, no)}
                      />
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

interface ChartSpec {
  x: string;
  y: string;
  groupBy?: string;
}

// Only the three reports §8 calls out. `census` has no time axis of its own — a
// census is a single point in time — so its line runs across programs.
const CHART_SPECS: Record<string, ChartSpec> = {
  census: { x: 'programName', y: 'enrolled' },
  newcomers: { x: 'month', y: 'newcomers' },
  transitions: { x: 'fromStatus', y: 'transitions', groupBy: 'toStatus' },
};

interface ChartPoint {
  x: string;
  [series: string]: string | number;
}

export interface ReportChartProps {
  slug: string;
  chart: 'line' | 'bar' | null;
  columns: ReportColumn[];
  rows: ReportRow[];
}

export const ReportChart: React.FC<ReportChartProps> = ({ slug, chart, columns, rows }) => {
  const { t, columnLabel } = useReportText();
  const spec = CHART_SPECS[slug];

  const { points, series } = useMemo(() => {
    if (!spec) return { points: [] as ChartPoint[], series: [] as string[] };

    const seriesNames: string[] = [];
    const byX = new Map<string, ChartPoint>();

    for (const row of rows) {
      const xValue = row[spec.x];
      const yValue = row[spec.y];
      if (xValue === null || xValue === undefined) continue;

      const x = String(xValue);
      const amount = typeof yValue === 'number' ? yValue : Number(yValue ?? 0);
      if (Number.isNaN(amount)) continue;

      const seriesName = spec.groupBy ? String(row[spec.groupBy] ?? '') : spec.y;
      if (!seriesNames.includes(seriesName)) seriesNames.push(seriesName);

      const point = byX.get(x) ?? { x };
      const current = point[seriesName];
      point[seriesName] = (typeof current === 'number' ? current : 0) + amount;
      byX.set(x, point);
    }

    const filled = Array.from(byX.values()).map((point) => {
      const complete: ChartPoint = { ...point };
      seriesNames.forEach((name) => {
        if (typeof complete[name] !== 'number') complete[name] = 0;
      });
      return complete;
    });

    return { points: filled, series: seriesNames.sort() };
  }, [rows, spec]);

  if (!chart || !spec || points.length === 0) return null;

  const yColumn = columns.find((column) => column.key === spec.y);
  const singleLabel = yColumn ? columnLabel(slug, yColumn) : spec.y;
  const axisTick = { fontSize: 11, fill: '#7A8B76' };
  const tooltipStyle = {
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: 8,
    fontSize: 12,
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-hv-border">
      <h2 className="text-sm font-semibold text-hv-charcoal mb-2">{t('reports.chart')}</h2>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          {chart === 'bar' ? (
            <BarChart data={points} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
              <XAxis dataKey="x" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#faf7f2' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {series.map((name, index) => (
                <Bar
                  key={name}
                  dataKey={name}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  radius={[3, 3, 0, 0]}
                />
              ))}
            </BarChart>
          ) : (
            <LineChart data={points} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
              <XAxis dataKey="x" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: '#e0e0e0' }} />
              {series.map((name, index) => (
                <Line
                  key={name}
                  type="monotone"
                  name={singleLabel}
                  dataKey={name}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: CHART_COLORS[index % CHART_COLORS.length] }}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ReportTable;
