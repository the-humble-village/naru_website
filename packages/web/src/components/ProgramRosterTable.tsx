import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarPlus } from 'lucide-react';
import { ageInDays } from '@naru/shared';
import type { ExitReason, NutritionalStatus, ProgramKind, TranslationKey } from '@naru/shared';
import { useTranslation } from '../hooks/useTranslation';
import { OverdueBadge } from './OverdueBadge';
import { ExitReasonBadge } from './ExitReasonBadge';
import { EmptyState } from './ui/EmptyState';
import { LoadingState } from './ui/LoadingState';
import { formatDateUTC } from '../utils/datetime';

export interface RosterRow {
  enrollmentId: number;
  subjectName: string | null;
  subjectHref?: string;
  birthDate?: string | null;
  communityName?: string | null;
  entryWeight?: number | null;
  latestWeight?: number | null;
  gestationMonths?: number | null;
  dueDate?: string | null;
  nutritionalStatus?: NutritionalStatus | null;
  mothersAssigned?: number | null;
  school?: string | null;
  classYear?: string | null;
  memberCount?: number | null;
  lastVisitDate?: string | null;
  exitedAt?: string | null;
  exitReason?: ExitReason | null;
}

export interface ProgramRosterTableProps {
  kind: ProgramKind;
  rows: RosterRow[];
  visitIntervalDays?: number | null;
  variant?: 'active' | 'exited' | 'all';
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

interface Column {
  key: string;
  label: string;
  hint?: string;
  render: (row: RosterRow) => React.ReactNode;
}

const STATUS_TONE: Record<NutritionalStatus, string> = {
  SEVERE: 'bg-red-100 text-red-800',
  MODERATE: 'bg-orange-100 text-orange-800',
  MILD: 'bg-amber-100 text-amber-800',
  NORMAL: 'bg-green-100 text-green-800',
};
const STATUS_LABEL: Record<NutritionalStatus, TranslationKey> = {
  SEVERE: 'nutritional_status.severe',
  MODERATE: 'nutritional_status.moderate',
  MILD: 'nutritional_status.mild',
  NORMAL: 'nutritional_status.normal',
};
const DASH = '—';
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hv-green focus-visible:ring-offset-2';
const VISIT_LINK = `inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-hv-green/30 bg-white px-3 py-2 text-xs font-medium text-hv-green transition-colors hover:bg-[#eaf0e9] ${FOCUS}`;

export const formatSubjectAge = (birthDate?: string | null): string | null => {
  if (!birthDate) return null;
  const days = ageInDays(new Date(birthDate));
  if (days === null) return null;
  const years = Math.floor(days / 365.25);
  if (years >= 2) return `${years}y`;
  return `${Math.floor(days / 30.4375)}m`;
};

const NutritionalStatusBadge: React.FC<{ status: NutritionalStatus }> = ({ status }) => {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_TONE[status]}`}>
      {t(STATUS_LABEL[status])}
    </span>
  );
};

export const ProgramRosterTable: React.FC<ProgramRosterTableProps> = ({
  kind, rows, visitIntervalDays, variant = 'active', isLoading = false, emptyMessage, className,
}) => {
  const { t, lang } = useTranslation();
  const exited = variant === 'exited';
  const text = (value?: string | null) => value || <span className="text-hv-gray">{DASH}</span>;
  const ageText = (birthDate?: string | null) => {
    const age = formatSubjectAge(birthDate);
    if (!age) return null;
    return new Intl.NumberFormat(lang, {
      style: 'unit', unit: age.endsWith('m') ? 'month' : 'year', unitDisplay: 'long',
    }).format(parseInt(age, 10));
  };

  const nameColumn: Column = {
    key: 'name',
    label: t(kind === 'FAMILY_PAF' ? 'roster.family_name' : 'roster.member'),
    render: row => (
      <div className="min-w-[7rem]">
        {row.subjectHref ? (
          <Link to={row.subjectHref} className={`rounded font-semibold text-hv-green underline decoration-hv-green/30 underline-offset-2 hover:decoration-hv-green ${FOCUS}`}>
            {row.subjectName ?? t('common.unnamed')}
          </Link>
        ) : (
          <span className="font-semibold text-hv-charcoal">{row.subjectName ?? t('common.unnamed')}</span>
        )}
        {kind !== 'FAMILY_PAF' && ageText(row.birthDate) && (
          <span className="mt-0.5 block text-xs text-hv-gray">{ageText(row.birthDate)}</span>
        )}
        {variant === 'all' && row.exitedAt && (
          <span className="mt-1 block text-xs text-hv-gray">
            {t('enrollment.exited')} · {formatDateUTC(row.exitedAt)}
          </span>
        )}
      </div>
    ),
  };
  const communityColumn: Column = { key: 'community', label: t('roster.community'), render: row => text(row.communityName) };
  const weightColumn: Column = {
    key: 'weight', label: t('roster.weight'), hint: t('roster.entry_latest'),
    render: row => row.entryWeight == null && row.latestWeight == null
      ? <span className="text-hv-gray" aria-label={t('weight.no_data')}>{DASH}</span>
      : (
        <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
          <span>{row.entryWeight?.toFixed(1) ?? DASH}</span>
          <ArrowRight aria-label={t('roster.to_latest')} size={12} className="text-hv-green" />
          <span className="font-medium">{row.latestWeight?.toFixed(1) ?? DASH}</span>
          <span className="text-xs text-hv-gray">kg</span>
        </span>
      ),
  };
  const lastVisitColumn: Column = {
    key: 'lastVisit', label: t('roster.last_visit'),
    render: row => <OverdueBadge lastVisitDate={row.lastVisitDate} intervalDays={row.exitedAt ? null : visitIntervalDays} />,
  };
  const statusColumn: Column = {
    key: 'status', label: t('roster.nutrition_status'),
    render: row => row.nutritionalStatus ? <NutritionalStatusBadge status={row.nutritionalStatus} /> : text(null),
  };

  const kindColumns = (): Column[] => {
    switch (kind) {
      case 'PREGNANCY':
        return [
          nameColumn, communityColumn, weightColumn,
          { key: 'gestation', label: t('roster.gestation'), render: row => row.gestationMonths == null ? text(null) : `${row.gestationMonths}${t('roster.month_suffix')}` },
          { key: 'due', label: t('roster.due'), render: row => text(formatDateUTC(row.dueDate)) },
        ];
      case 'NUTRITION':
        return [nameColumn, communityColumn, weightColumn, statusColumn];
      case 'MIDWIFE':
        return [
          nameColumn, communityColumn,
          { key: 'mothers', label: t('roster.mothers_assigned'), render: row => row.mothersAssigned == null ? text(null) : <span className="tabular-nums">{row.mothersAssigned}</span> },
        ];
      case 'STUDENT':
        return [
          nameColumn, communityColumn,
          { key: 'school', label: t('roster.school'), render: row => text(row.school) },
          { key: 'classYear', label: t('roster.year'), render: row => text(row.classYear) },
        ];
      case 'FAMILY_PAF':
        return [
          nameColumn, communityColumn,
          { key: 'members', label: t('roster.members'), render: row => row.memberCount == null ? text(null) : <span className="tabular-nums">{row.memberCount}</span> },
        ];
      default: {
        const exhaustive: never = kind;
        return exhaustive;
      }
    }
  };
  const columns: Column[] = exited
    ? [...kindColumns(),
      { key: 'exitedAt', label: t('roster.exited'), render: row => text(formatDateUTC(row.exitedAt)) },
      { key: 'exitReason', label: t('roster.reason'), render: row => row.exitReason ? <ExitReasonBadge reason={row.exitReason} /> : text(null) }]
    : [...kindColumns(), lastVisitColumn];

  if (isLoading) return <LoadingState message={t('common.loading')} />;
  if (rows.length === 0) return <EmptyState message={emptyMessage ?? t('roster.empty')} />;

  const canAddVisit = (row: RosterRow) => !exited && !row.exitedAt;
  const visitLink = (row: RosterRow, mobile = false) => (
    <Link to={`/enrollments/${row.enrollmentId}/visits/new`} className={`${VISIT_LINK} ${mobile ? 'mt-3 w-full' : ''}`}>
      <CalendarPlus aria-hidden="true" size={15} />{t('roster.add_visit')}
    </Link>
  );
  const primaryBadge = (row: RosterRow) => {
    if (exited || row.exitedAt) return row.exitReason ? <ExitReasonBadge reason={row.exitReason} /> : null;
    if (kind === 'NUTRITION' && row.nutritionalStatus) return <NutritionalStatusBadge status={row.nutritionalStatus} />;
    return <OverdueBadge lastVisitDate={row.lastVisitDate} intervalDays={visitIntervalDays} />;
  };
  const metaColumns = (row: RosterRow) => columns.filter(column => {
    if (column.key === 'name') return false;
    if (exited) return column.key !== 'exitReason';
    if (row.exitedAt) return true;
    return kind === 'NUTRITION' && row.nutritionalStatus ? column.key !== 'status' : column.key !== 'lastVisit';
  });

  return (
    <div className={className}>
      <div className={`hidden max-w-full overflow-x-auto rounded-lg border border-hv-green/15 md:block ${FOCUS}`} role="region" aria-label={t('roster.records')} tabIndex={0}>
        <table className="w-full border-collapse">
          <thead className="bg-[#eaf0e9]">
            <tr>
              {columns.map(column => (
                <th key={column.key} scope="col" className="px-3 py-2.5 text-left align-middle text-[11px] font-medium uppercase tracking-wide text-hv-green">
                  {column.label}
                  {column.hint && <span className="mt-0.5 block whitespace-nowrap text-xs font-normal normal-case tracking-normal text-hv-gray">{column.hint}</span>}
                </th>
              ))}
              {!exited && <th scope="col" className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-hv-green">{t('common.col_actions')}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-hv-border bg-white">
            {rows.map(row => (
              <tr key={row.enrollmentId} className="hover:bg-[#eaf0e9]/40">
                {columns.map(column => (
                  <td key={column.key} className={`px-3 py-2 text-sm text-hv-charcoal ${column.key === 'community' ? 'min-w-[8rem] max-w-[12rem]' : ''} ${['due', 'exitedAt', 'gestation'].includes(column.key) ? 'whitespace-nowrap' : ''}`}>
                    {column.render(row)}
                  </td>
                ))}
                {!exited && (
                  <td className="px-3 py-2 text-right">
                    {canAddVisit(row) ? visitLink(row) : <span className="text-xs text-hv-gray">{t('enrollment.exited')}</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map(row => (
          <article key={row.enrollmentId} className="rounded-xl border border-hv-green/15 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              {nameColumn.render(row)}
              <div className="shrink-0">{primaryBadge(row)}</div>
            </div>
            <dl className="mt-3 space-y-2 border-t border-hv-green/10 pt-3">
              {metaColumns(row).map(column => (
                <div key={column.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-baseline gap-3 text-sm">
                  <dt className="text-xs text-hv-gray">{column.label}{column.hint && <span className="block">{column.hint}</span>}</dt>
                  <dd className="min-w-0 break-words text-hv-charcoal">{column.render(row)}</dd>
                </div>
              ))}
            </dl>
            {canAddVisit(row) && visitLink(row, true)}
          </article>
        ))}
      </div>
    </div>
  );
};

export default ProgramRosterTable;
