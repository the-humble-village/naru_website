import React from 'react';
import type { ExitReason, TranslationKey } from '@naru/shared';
import { useTranslation } from '../hooks/useTranslation';

export interface ExitReasonBadgeProps {
  reason: ExitReason;
  className?: string;
}

const BASE = 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium';
const MUTED = 'bg-hv-page text-hv-gray border border-hv-border';

const toneFor = (reason: ExitReason): string => {
  switch (reason) {
    case 'GRADUATED':
      return 'bg-hv-green text-white';
    case 'DIED':
      return 'bg-hv-crisis/10 text-hv-crisis border border-hv-crisis/30';
    case 'WITHDREW':
    case 'MOVED_AWAY':
    case 'TRANSFERRED':
    case 'AGED_OUT':
    case 'LOST':
      return MUTED;
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
};

const LABEL_KEY: Record<ExitReason, TranslationKey> = {
  GRADUATED: 'exit_reason.graduated',
  WITHDREW: 'exit_reason.withdrew',
  MOVED_AWAY: 'exit_reason.moved_away',
  DIED: 'exit_reason.died',
  TRANSFERRED: 'exit_reason.transferred',
  AGED_OUT: 'exit_reason.aged_out',
  LOST: 'exit_reason.lost',
};

export const ExitReasonBadge: React.FC<ExitReasonBadgeProps> = ({ reason, className }) => {
  const { t } = useTranslation();

  return (
    <span className={`${BASE} ${toneFor(reason)}${className ? ` ${className}` : ''}`}>
      {t(LABEL_KEY[reason])}
    </span>
  );
};

export default ExitReasonBadge;
