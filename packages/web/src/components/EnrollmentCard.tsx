import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  EnrollmentListItem,
  LocationType,
  TranslationKey,
  VisitListItem,
} from '@naru/shared';
import { listVisits } from '../api/visits';
import { reopenEnrollment } from '../api/enrollments';
import { useTranslation } from '../hooks/useTranslation';
import { WeightDelta } from './WeightDelta';
import { ExitReasonBadge } from './ExitReasonBadge';
import { RoleGate } from './RoleGate';

export interface EnrollmentCardProps {
  enrollment: EnrollmentListItem;
  visits?: VisitListItem[];
  birthingAssistantName?: string | null;
  defaultExpanded?: boolean;
  onReopened?: (id: number) => void;
  className?: string;
}

const LOCATION_LABEL: Record<LocationType, TranslationKey> = {
  SITE: 'location_type.site',
  HOME: 'location_type.home',
  MOBILE_CLINIC: 'location_type.mobile_clinic',
};

const visitWeight = (visit: VisitListItem): number | null =>
  visit.nutritionDetail?.weight ?? visit.pregnancyDetail?.weight ?? null;

const byDateDesc = (a: VisitListItem, b: VisitListItem): number =>
  b.visitDate.localeCompare(a.visitDate);

export const EnrollmentCard: React.FC<EnrollmentCardProps> = ({
  enrollment,
  visits,
  birthingAssistantName,
  defaultExpanded,
  onReopened,
  className,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const isActive = !enrollment.exitedAt;
  const [expanded, setExpanded] = useState(defaultExpanded ?? isActive);

  const supplied = visits !== undefined;
  const visitQuery = useQuery({
    queryKey: ['visits', { enrollmentId: enrollment.id, limit: 3 }],
    queryFn: () => listVisits({ enrollmentId: enrollment.id, limit: 3 }),
    enabled: !supplied && expanded,
  });

  const recentVisits = [...(supplied ? (visits as VisitListItem[]) : visitQuery.data?.items ?? [])]
    .sort(byDateDesc)
    .slice(0, 3);

  const reopen = useMutation({
    mutationFn: () => reopenEnrollment(enrollment.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      void queryClient.invalidateQueries({ queryKey: ['enrollment', enrollment.id] });
      onReopened?.(enrollment.id);
    },
  });

  const latestWeight =
    recentVisits.map(visitWeight).find((weight) => weight !== null) ?? enrollment.exitWeight;

  const kind = enrollment.program.kind;
  const visitCount = supplied ? recentVisits.length : enrollment.visitCount;

  const toggle = () => setExpanded((open) => !open);

  if (!isActive && !expanded) {
    return (
      <div className={`rounded-lg border border-hv-border bg-white${className ? ` ${className}` : ''}`}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={false}
          className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left text-sm text-hv-gray hover:bg-hv-page transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-hv-accent"
        >
          <span aria-hidden="true">&#9654;</span>
          <span className="font-medium uppercase tracking-wider text-xs">
            {t('enrollment.exited')}
          </span>
          <span aria-hidden="true">&middot;</span>
          <span className="font-medium text-hv-charcoal">{enrollment.program.name}</span>
          <span aria-hidden="true">&middot;</span>
          <span className="tabular-nums">
            {enrollment.enrolledAt.slice(0, 7)} &rarr; {enrollment.exitedAt?.slice(0, 7)}
          </span>
          {enrollment.exitReason && <ExitReasonBadge reason={enrollment.exitReason} />}
        </button>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border bg-white p-4 sm:p-6 shadow-sm ${
        isActive ? 'border-hv-accent' : 'border-hv-border'
      }${className ? ` ${className}` : ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              aria-expanded={expanded}
              className="text-hv-gray hover:text-hv-charcoal transition-colors focus:outline-none focus:ring-2 focus:ring-hv-accent rounded"
            >
              <span aria-hidden="true">{expanded ? '▼' : '▶'}</span>
              <span className="sr-only">
                {expanded ? t('enrollment.collapse') : t('enrollment.expand')}
              </span>
            </button>
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                isActive ? 'bg-hv-green text-white' : 'bg-hv-page text-hv-gray'
              }`}
            >
              {isActive ? t('enrollment.active') : t('enrollment.exited')}
            </span>
            <Link
              to={`/enrollments/${enrollment.id}`}
              className="text-lg font-semibold text-hv-green hover:text-hv-green-hover transition-colors"
            >
              {enrollment.program.name}
            </Link>
            {!isActive && enrollment.exitReason && (
              <ExitReasonBadge reason={enrollment.exitReason} />
            )}
          </div>
          <p className="mt-1 text-sm text-hv-gray">
            {t('enrollment.since')} {enrollment.enrolledAt}
            {!isActive && enrollment.exitedAt && (
              <>
                {' '}
                &rarr; {enrollment.exitedAt}
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isActive ? (
            <>
              <Link
                to={`/enrollments/${enrollment.id}/visits/new`}
                className="bg-hv-green text-white px-4 py-2 rounded hover:bg-hv-green-hover transition-colors"
              >
                {t('enrollment.add_visit')}
              </Link>
              <Link
                to={`/enrollments/${enrollment.id}/exit`}
                className="bg-hv-gray text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
              >
                {t('enrollment.exit')}
              </Link>
            </>
          ) : (
            <RoleGate requiredRole="SUPERVISOR">
              <button
                type="button"
                onClick={() => reopen.mutate()}
                disabled={reopen.isPending}
                className="bg-hv-gray text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reopen.isPending ? t('common.saving') : t('enrollment.reopen')}
              </button>
            </RoleGate>
          )}
        </div>
      </div>

      {expanded && (
        <>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {kind === 'PREGNANCY' && (
              <>
                <Detail label={t('enrollment.due_date')} value={enrollment.pregnancyDetail?.dueDate} />
                <Detail
                  label={t('enrollment.pregnancy_number')}
                  value={
                    enrollment.pregnancyDetail?.pregnancyNumber
                      ? `#${enrollment.pregnancyDetail.pregnancyNumber}`
                      : null
                  }
                />
                <Detail
                  label={t('enrollment.birthing_assistant')}
                  value={birthingAssistantName}
                />
              </>
            )}

            {kind === 'NUTRITION' && (
              <>
                <Detail
                  label={t('enrollment.caretaker')}
                  value={enrollment.nutritionDetail?.caretakerName}
                />
                <Detail
                  label={t('enrollment.caretaker_phone')}
                  value={enrollment.nutritionDetail?.caretakerPhone}
                />
              </>
            )}

            {kind === 'STUDENT' && (
              <>
                <Detail label={t('enrollment.school')} value={enrollment.studentDetail?.school} />
                <Detail
                  label={t('enrollment.class_year')}
                  value={enrollment.studentDetail?.classYear}
                />
              </>
            )}

            {(kind === 'PREGNANCY' || kind === 'NUTRITION') && (
              <div className="flex items-baseline gap-2">
                <dt className="text-sm font-medium text-hv-gray">{t('enrollment.weight')}</dt>
                <dd>
                  <WeightDelta from={enrollment.entryWeight} to={latestWeight} />
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-4 border-t border-hv-border pt-3">
            <p className="text-sm font-medium text-hv-gray">
              {visitCount} {t('enrollment.visits')}
            </p>

            {!supplied && visitQuery.isLoading ? (
              <p className="mt-2 text-sm text-hv-gray">{t('common.loading')}</p>
            ) : recentVisits.length === 0 ? (
              <p className="mt-2 text-sm text-hv-gray">{t('enrollment.no_visits')}</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {recentVisits.map((visit) => {
                  const weight = visitWeight(visit);
                  return (
                    <li key={visit.id}>
                      <Link
                        to={`/visits/${visit.id}`}
                        className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded px-2 py-1 text-sm text-hv-charcoal hover:bg-hv-page transition-colors"
                      >
                        <span className="tabular-nums font-medium">{visit.visitDate}</span>
                        <span className="text-hv-gray">{t(LOCATION_LABEL[visit.locationType])}</span>
                        {weight !== null && (
                          <span className="tabular-nums">{weight.toFixed(1)} kg</span>
                        )}
                        {visit.pregnancyDetail?.gestationMonths !== null &&
                          visit.pregnancyDetail?.gestationMonths !== undefined && (
                            <span className="text-hv-gray tabular-nums">
                              {visit.pregnancyDetail.gestationMonths}
                              {t('roster.month_suffix')}
                            </span>
                          )}
                        {visit.nutritionDetail?.nutritionalStatus && (
                          <span className="text-hv-gray">
                            {visit.nutritionDetail.nutritionalStatus}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            <Link
              to={`/enrollments/${enrollment.id}`}
              className="mt-2 inline-block text-sm text-hv-accent hover:text-hv-green transition-colors"
            >
              {t('enrollment.view_all')} &rarr;
            </Link>
          </div>
        </>
      )}
    </div>
  );
};

const Detail: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => (
  <div className="flex items-baseline gap-2">
    <dt className="text-sm font-medium text-hv-gray">{label}</dt>
    <dd className="text-sm text-hv-charcoal">
      {value === null || value === undefined || value === '' ? (
        <span className="text-hv-gray">&mdash;</span>
      ) : (
        value
      )}
    </dd>
  </div>
);

export default EnrollmentCard;
