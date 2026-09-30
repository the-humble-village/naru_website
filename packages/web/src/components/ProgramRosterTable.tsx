import React from 'react';
import { Link } from 'react-router-dom';
import { ageInDays } from '@naru/shared';
import type {
  ExitReason,
  NutritionalStatus,
  ProgramKind,
  TranslationKey,
} from '@naru/shared';
import { useTranslation } from '../hooks/useTranslation';
import { WeightDelta } from './WeightDelta';
import { OverdueBadge } from './OverdueBadge';
import { ExitReasonBadge } from './ExitReasonBadge';
import { EmptyState } from './ui/EmptyState';
import { LoadingState } from './ui/LoadingState';

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
  variant?: 'active' | 'exited';
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

interface Column {
  key: string;
  label: string;
  render: (row: RosterRow) => React.ReactNode;
}

const STATUS_TONE: Record<NutritionalStatus, string> = {
  SEVERE: 'bg-red-600 text-white',
  MODERATE: 'bg-red-400 text-white',
  MILD: 'bg-yellow-500 text-white',
  NORMAL: 'bg-green-500 text-white',
};

const STATUS_LABEL: Record<NutritionalStatus, TranslationKey> = {
  SEVERE: 'nutritional_status.severe',
  MODERATE: 'nutritional_status.moderate',
  MILD: 'nutritional_status.mild',
  NORMAL: 'nutritional_status.normal',
};

const DASH = '—';

export const formatSubjectAge = (birthDate?: string | null): string | null => {
  if (!birthDate) {
    return null;
  }
  const days = ageInDays(new Date(birthDate));
  if (days === null) {
    return null;
  }
  const years = Math.floor(days / 365.25);
  if (years >= 2) {
    return `${years}y`;
  }
  return `${Math.floor(days / 30.4375)}m`;
};

const NutritionalStatusBadge: React.FC<{ status: NutritionalStatus }> = ({ status }) => {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_TONE[status]}`}
    >
      {t(STATUS_LABEL[status])}
    </span>
  );
};

export const ProgramRosterTable: React.FC<ProgramRosterTableProps> = ({
  kind,
  rows,
  visitIntervalDays,
  variant = 'active',
  isLoading = false,
  emptyMessage,
  className,
}) => {
  const { t } = useTranslation();
  const exited = variant === 'exited';

  const text = (value?: string | null): React.ReactNode =>
    value ? value : <span className="text-hv-gray">{DASH}</span>;

  const nameColumn: Column = {
    key: 'name',
    label: kind === 'FAMILY_PAF' ? t('roster.family_name') : t('roster.name'),
    render: (row) => {
      const label = row.subjectName ?? t('common.unnamed');
      return row.subjectHref ? (
        <Link
          to={row.subjectHref}
          className="font-medium text-hv-green hover:text-hv-green-hover transition-colors"
        >
          {label}
        </Link>
      ) : (
        <span className="font-medium text-hv-charcoal">{label}</span>
      );
    },
  };

  const ageColumn: Column = {
    key: 'age',
    label: t('roster.age'),
    render: (row) => text(formatSubjectAge(row.birthDate)),
  };

  const communityColumn: Column = {
    key: 'community',
    label: t('roster.community'),
    render: (row) => text(row.communityName),
  };

  const weightColumn: Column = {
    key: 'weight',
    label: t('roster.weight'),
    render: (row) => <WeightDelta from={row.entryWeight} to={row.latestWeight} />,
  };

  const lastVisitColumn: Column = {
    key: 'lastVisit',
    label: t('roster.last_visit'),
    render: (row) => (
      <OverdueBadge lastVisitDate={row.lastVisitDate} intervalDays={visitIntervalDays} />
    ),
  };

  const exitedColumn: Column = {
    key: 'exitedAt',
    label: t('roster.exited'),
    render: (row) => text(row.exitedAt),
  };

  const reasonColumn: Column = {
    key: 'exitReason',
    label: t('roster.reason'),
    render: (row) =>
      row.exitReason ? <ExitReasonBadge reason={row.exitReason} /> : text(null),
  };

  const statusColumn: Column = {
    key: 'status',
    label: t('roster.status'),
    render: (row) =>
      row.nutritionalStatus ? (
        <NutritionalStatusBadge status={row.nutritionalStatus} />
      ) : (
        text(null)
      ),
  };

  const kindColumns = (): Column[] => {
    switch (kind) {
      case 'PREGNANCY':
        return [
          nameColumn,
          ageColumn,
          communityColumn,
          weightColumn,
          {
            key: 'gestation',
            label: t('roster.gestation'),
            render: (row) =>
              row.gestationMonths === null || row.gestationMonths === undefined
                ? text(null)
                : `${row.gestationMonths}${t('roster.month_suffix')}`,
          },
          { key: 'due', label: t('roster.due'), render: (row) => text(row.dueDate) },
        ];
      case 'NUTRITION':
        return [nameColumn, ageColumn, communityColumn, weightColumn, statusColumn];
      case 'MIDWIFE':
        return [
          nameColumn,
          ageColumn,
          communityColumn,
          {
            key: 'mothers',
            label: t('roster.mothers_assigned'),
            render: (row) =>
              row.mothersAssigned === null || row.mothersAssigned === undefined
                ? text(null)
                : <span className="tabular-nums">{row.mothersAssigned}</span>,
          },
        ];
      case 'STUDENT':
        return [
          nameColumn,
          ageColumn,
          communityColumn,
          { key: 'school', label: t('roster.school'), render: (row) => text(row.school) },
          { key: 'classYear', label: t('roster.year'), render: (row) => text(row.classYear) },
        ];
      case 'FAMILY_PAF':
        return [
          nameColumn,
          communityColumn,
          {
            key: 'members',
            label: t('roster.members'),
            render: (row) =>
              row.memberCount === null || row.memberCount === undefined
                ? text(null)
                : <span className="tabular-nums">{row.memberCount}</span>,
          },
        ];
      default: {
        const exhaustive: never = kind;
        return exhaustive;
      }
    }
  };

  const columns: Column[] = exited
    ? [...kindColumns(), exitedColumn, reasonColumn]
    : [...kindColumns(), lastVisitColumn];

  if (isLoading) {
    return <LoadingState message={t('common.loading')} />;
  }

  if (rows.length === 0) {
    return <EmptyState message={emptyMessage ?? t('roster.empty')} />;
  }

  const visitHref = (row: RosterRow) => `/enrollments/${row.enrollmentId}/visits/new`;

  const primaryBadge = (row: RosterRow): React.ReactNode => {
    if (exited) {
      return row.exitReason ? <ExitReasonBadge reason={row.exitReason} /> : null;
    }
    if (kind === 'NUTRITION' && row.nutritionalStatus) {
      return <NutritionalStatusBadge status={row.nutritionalStatus} />;
    }
    return <OverdueBadge lastVisitDate={row.lastVisitDate} intervalDays={visitIntervalDays} />;
  };

  const metaColumns = (row: RosterRow): Column[] =>
    columns.filter((column) => {
      if (column.key === 'name') {
        return false;
      }
      if (exited) {
        return column.key !== 'exitReason';
      }
      if (kind === 'NUTRITION' && row.nutritionalStatus) {
        return column.key !== 'status';
      }
      return column.key !== 'lastVisit';
    });

  return (
    <div className={className}>
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-hv-border">
          <thead className="bg-hv-page">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className="text-left text-xs font-medium text-hv-gray uppercase tracking-wider px-6 py-3"
                >
                  {column.label}
                </th>
              ))}
              {!exited && (
                <th scope="col" className="px-6 py-3">
                  <span className="sr-only">{t('common.col_actions')}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-hv-border bg-white">
            {rows.map((row) => (
              <tr key={row.enrollmentId} className="hover:bg-hv-page">
                {columns.map((column) => (
                  <td key={column.key} className="px-6 py-4 whitespace-nowrap">
                    {column.render(row)}
                  </td>
                ))}
                {!exited && (
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <Link
                      to={visitHref(row)}
                      className="inline-flex items-center bg-hv-green text-white px-3 py-1 rounded text-sm hover:bg-hv-green-hover transition-colors"
                    >
                      {t('roster.add_visit')}
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {rows.map((row) => (
          <div
            key={row.enrollmentId}
            className="bg-white p-4 rounded-lg border border-hv-border shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              {nameColumn.render(row)}
              {primaryBadge(row)}
            </div>
            <dl className="mt-2 space-y-1">
              {metaColumns(row).map((column) => (
                <div key={column.key} className="flex items-baseline gap-2 text-sm">
                  <dt className="text-xs font-medium text-hv-gray uppercase tracking-wider">
                    {column.label}
                  </dt>
                  <dd className="text-hv-charcoal">{column.render(row)}</dd>
                </div>
              ))}
            </dl>
            {!exited && (
              <Link
                to={visitHref(row)}
                className="mt-3 block w-full text-center bg-hv-green text-white px-4 py-2 rounded hover:bg-hv-green-hover transition-colors"
              >
                {t('roster.add_visit')}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgramRosterTable;
