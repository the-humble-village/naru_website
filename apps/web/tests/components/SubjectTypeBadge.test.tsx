// AI-assisted: see AI-ATTRIBUTION.md
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { SubjectType } from '@naru/shared';
import SubjectTypeBadge from '@/components/SubjectTypeBadge';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
  default: () => ({ t: (key: string) => key, lang: 'en' }),
}));

// A Record, so a new subject type fails the type-check until it has a row here.
const TONES: Record<SubjectType, string> = {
  MOTHER: 'bg-hv-terracotta',
  CHILD: 'bg-hv-accent',
  PERSON: 'bg-hv-sage',
  FAMILY: 'bg-hv-green',
};

describe('SubjectTypeBadge', () => {
  it.each(Object.entries(TONES) as [SubjectType, string][])(
    'renders %s as a small chip in %s',
    (type, tone) => {
      render(<SubjectTypeBadge type={type} />);
      const chip = screen.getByText(`subject_type.${type.toLowerCase()}`);
      expect(chip).toHaveClass('px-2', 'py-1', 'rounded-full', 'text-xs');
      expect(chip).toHaveClass(tone, 'text-white');
    }
  );
});
