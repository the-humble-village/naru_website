import React from 'react';
import type { SubjectType, TranslationKey } from '@naru/shared';
import { useTranslation } from '../hooks/useTranslation';

export interface SubjectTypeBadgeProps {
  type: SubjectType;
  className?: string;
}

const BASE = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';

const toneFor = (type: SubjectType): string => {
  switch (type) {
    case 'MOTHER':
      return 'bg-hv-terracotta text-white';
    case 'CHILD':
      return 'bg-hv-accent text-white';
    case 'PERSON':
      return 'bg-hv-sage text-white';
    case 'FAMILY':
      return 'bg-hv-green text-white';
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
};

const LABEL_KEY: Record<SubjectType, TranslationKey> = {
  MOTHER: 'subject_type.mother',
  CHILD: 'subject_type.child',
  PERSON: 'subject_type.person',
  FAMILY: 'subject_type.family',
};

export const SubjectTypeBadge: React.FC<SubjectTypeBadgeProps> = ({ type, className }) => {
  const { t } = useTranslation();

  return (
    <span className={`${BASE} ${toneFor(type)}${className ? ` ${className}` : ''}`}>
      {t(LABEL_KEY[type])}
    </span>
  );
};

export default SubjectTypeBadge;
